#!/usr/bin/env bash
# Rodada 2 (13/10/2026): cria no GitHub as issues NOVAS (TASK-29..37) e COMENTA nas issues
# existentes cujo escopo mudou, SEM apagar o corpo nem os checkboxes que você já marcou.
#
# - Pode ser executado mais de uma vez: issue que já existe NÃO é recriada, e o comentário
#   "Atualização de escopo (rodada 2)" não é repetido.
# - Roda em SIMULAÇÃO por padrão (não altera nada no GitHub).
# - Requer bash 4+ (Git Bash do Windows serve) e o GitHub CLI (gh) autenticado: gh auth login
#
# Uso:
#   bash docs/projeto-retencoes-v2/scripts/atualizar-issues-github.sh              # simulação
#   DRY_RUN=0 bash docs/projeto-retencoes-v2/scripts/atualizar-issues-github.sh    # aplica de verdade
#
# Opções (variáveis de ambiente):
#   COMENTAR="TASK-13 TASK-14"  issues existentes que recebem o comentário de atualização
#   SUBSTITUIR_CORPO=1          em vez de comentar, SUBSTITUI o corpo/título (apaga checkboxes marcados)
#
# Cada TASK-*.md tem, na 2ª linha: <!-- milestone: M11 - ... | labels: backend,calculo,P0 -->
set -euo pipefail

REPO="${REPO:-euclideslaurindo/sistema-empenho-financeiro}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../tasks" && pwd)"
DRY_RUN="${DRY_RUN:-1}"
SUBSTITUIR_CORPO="${SUBSTITUIR_CORPO:-0}"
COMENTAR="${COMENTAR:-TASK-11 TASK-13 TASK-14 TASK-15 TASK-16 TASK-17 TASK-18 TASK-22 TASK-23 TASK-25 TASK-28}"
MARCA='<!-- rodada2-atualizacao -->'

command -v gh >/dev/null 2>&1 || { echo "gh (GitHub CLI) não encontrado. Instale e rode: gh auth login" >&2; exit 1; }

# 1) Quais TASKs já existem como issue (1 única chamada)
declare -A NUM=()
# Se a listagem falhar (ex.: "TLS handshake timeout"), PARA: sem a lista o script acharia que
# nenhuma issue existe e tentaria criar tudo de novo (duplicando).
lista="$(gh issue list --repo "$REPO" --state all --limit 300 --json number,title --jq '.[] | "\(.number)\t\(.title)"')" || {
  echo "ERRO: não consegui listar as issues do GitHub (conexão?). Nada foi alterado. Tente de novo." >&2; exit 1; }
while IFS=$'\t' read -r numero titulo; do
  if [[ "$titulo" =~ (TASK-[0-9]+) ]]; then NUM["${BASH_REMATCH[1]}"]="$numero"; fi
done <<< "$lista"
echo "Issues TASK já existentes no GitHub: ${#NUM[@]}"
if [[ ${#NUM[@]} -eq 0 && "${PERMITIR_SEM_ISSUES:-0}" != "1" ]]; then
  echo "ERRO: nenhuma issue TASK encontrada, mas o repositório já deveria ter as TASK-01 a TASK-28." >&2
  echo "Provável falha de conexão ou repositório errado. Nada foi alterado." >&2; exit 1
fi

# 2) Ler cada arquivo (sem processos externos, para ser rápido no Windows)
declare -a CRIAR=() ATUALIZAR=()
declare -A TITULO=() MILESTONE=() LABELS=() CORPO=() ROD2=()
re_ms='milestone: *([^|]*)\|'
re_lb='labels: *([^>]*)-->'
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

for f in "$DIR"/TASK-*.md; do
  mapfile -t L < "$f"
  [[ "${L[0]}" =~ (TASK-[0-9]+) ]] || { echo "Ignorado (sem id): $f" >&2; continue; }
  id="${BASH_REMATCH[1]}"
  TITULO[$id]="${L[0]#\# }"
  meta="${L[1]}"; ms=""; lb=""
  [[ "$meta" =~ $re_ms ]] && ms="$(trim "${BASH_REMATCH[1]}")"
  [[ "$meta" =~ $re_lb ]] && lb="$(trim "${BASH_REMATCH[1]}")"
  MILESTONE[$id]="$ms"; LABELS[$id]="${lb// /}"
  printf -v corpo '%s\n' "${L[@]:2}"; CORPO[$id]="$corpo"
  # trecho "## Atualização de escopo (rodada 2 ..." até o fim do arquivo
  achou=0; trecho=""
  for linha in "${L[@]}"; do
    if [[ $achou -eq 0 && "$linha" == "## Atualização de escopo (rodada 2"* ]]; then achou=1; fi
    if [[ $achou -eq 1 ]]; then trecho+="$linha"$'\n'; fi
  done
  ROD2[$id]="$trecho"
  if [[ -z "${NUM[$id]:-}" ]]; then CRIAR+=("$id"); fi
done
for id in $COMENTAR; do [[ -n "${NUM[$id]:-}" ]] && ATUALIZAR+=("$id"); done
echo "A criar: ${#CRIAR[@]} | A atualizar (comentário): ${#ATUALIZAR[@]}"

run() { if [ "$DRY_RUN" = "1" ]; then printf '[simulação] '; printf '%q ' "$@"; printf '\n'; else "$@"; fi; }
run_body() { # $1 = corpo ; demais = comando (o corpo entra pela entrada padrão)
  local corpo="$1"; shift
  if [ "$DRY_RUN" = "1" ]; then printf '[simulação] '; printf '%q ' "$@"; printf '(corpo: %s caracteres)\n' "${#corpo}"
  else printf '%s' "$corpo" | "$@"; fi
}

# 3) Labels e milestones só para o que for NOVO
declare -A LBL_OK=() MS_OK=()
if [[ ${#CRIAR[@]} -gt 0 ]]; then   # 1 chamada: não recria label que já existe
  while IFS= read -r nome; do [[ -n "$nome" ]] && LBL_OK["$nome"]=1; done \
    < <(gh label list --repo "$REPO" --limit 300 --json name --jq '.[].name')
fi
for id in "${CRIAR[@]}"; do
  IFS=',' read -ra arr <<< "${LABELS[$id]}"
  for l in "${arr[@]}"; do
    [[ -n "$l" && -z "${LBL_OK[$l]:-}" ]] && { run gh label create "$l" --repo "$REPO" --color 1d76db --force; LBL_OK[$l]=1; }
  done
  m="${MILESTONE[$id]}"
  if [[ -n "$m" && -z "${MS_OK[$m]:-}" ]]; then
    if [ "$DRY_RUN" = "1" ]; then echo "[simulação] gh api repos/$REPO/milestones -f title='$m'"
    else gh api "repos/$REPO/milestones" -f title="$m" >/dev/null 2>&1 || echo "milestone já existe: $m"; fi
    MS_OK[$m]=1
  fi
done

# 4) Issues existentes: comentário (ou substituição do corpo, se pedido)
for id in "${ATUALIZAR[@]}"; do
  n="${NUM[$id]}"
  if [[ "$SUBSTITUIR_CORPO" = "1" ]]; then
    run_body "${CORPO[$id]}" gh issue edit "$n" --repo "$REPO" --title "${TITULO[$id]}" --body-file -
    continue
  fi
  if [[ -z "${ROD2[$id]}" ]]; then echo "$id: sem trecho da rodada 2 no arquivo; ignorada."; continue; fi
  if [ "$DRY_RUN" != "1" ]; then
    ja="$(gh issue view "$n" --repo "$REPO" --json comments --jq '.comments[].body' 2>/dev/null || true)"
    if [[ "$ja" == *"$MARCA"* ]]; then echo "$id (#$n): comentário da rodada 2 já existe; ignorada."; continue; fi
  fi
  run_body "$MARCA"$'\n'"${ROD2[$id]}" gh issue comment "$n" --repo "$REPO" --body-file -
done

# 5. Criar as novas
for id in "${CRIAR[@]}"; do
  run_body "${CORPO[$id]}" gh issue create --repo "$REPO" --title "${TITULO[$id]}" --label "${LABELS[$id]}" --milestone "${MILESTONE[$id]}" --body-file -
done

echo
if [ "$DRY_RUN" = "1" ]; then echo "Simulação concluída. Para aplicar: DRY_RUN=0 bash $0"
else echo "Pronto. Confira em https://github.com/$REPO/issues"; fi
