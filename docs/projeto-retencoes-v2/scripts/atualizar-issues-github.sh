#!/usr/bin/env bash
# Atualiza no GitHub as issues que JÁ EXISTEM (TASK-01..23) e cria as NOVAS (TASK-24..28).
#
# - Pode ser executado mais de uma vez: issue que já existe é EDITADA (título e corpo), nunca duplicada.
# - Roda em SIMULAÇÃO por padrão (não altera nada no GitHub).
# - Requer bash 4+ (Git Bash do Windows serve) e o GitHub CLI (gh) autenticado: gh auth login
#
# Uso:
#   bash docs/projeto-retencoes-v2/scripts/atualizar-issues-github.sh            # simulação
#   DRY_RUN=0 bash docs/projeto-retencoes-v2/scripts/atualizar-issues-github.sh  # aplica de verdade
#
# Cada TASK-*.md tem, na 2ª linha: <!-- milestone: M1 - Fundação | labels: backend,calculo,P0 -->
set -euo pipefail

REPO="${REPO:-euclideslaurindo/sistema-empenho-financeiro}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../tasks" && pwd)"
DRY_RUN="${DRY_RUN:-1}"

command -v gh >/dev/null 2>&1 || { echo "gh (GitHub CLI) não encontrado. Instale e rode: gh auth login" >&2; exit 1; }

# 1) Descobrir quais TASKs já existem como issue (1 única chamada)
declare -A NUM=()
while IFS=$'\t' read -r numero titulo; do
  if [[ "$titulo" =~ (TASK-[0-9]+) ]]; then NUM["${BASH_REMATCH[1]}"]="$numero"; fi
done < <(gh issue list --repo "$REPO" --state all --limit 300 --json number,title --jq '.[] | "\(.number)\t\(.title)"')
echo "Issues TASK já existentes no GitHub: ${#NUM[@]}"

# 2) Ler cada arquivo (sem processos externos, para ser rápido no Windows)
declare -a EDITAR=() CRIAR=()
declare -A TITULO=() MILESTONE=() LABELS=() CORPO=()
re_ms='milestone: *([^|]*)\|'
re_lb='labels: *([^>]*)-->'
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }

for f in "$DIR"/TASK-*.md; do
  mapfile -t L < "$f"
  [[ "${L[0]}" =~ (TASK-[0-9]+) ]] || { echo "Ignorado (sem id): $f" >&2; continue; }
  id="${BASH_REMATCH[1]}"
  TITULO[$id]="${L[0]#\# }"
  meta="${L[1]}"
  ms=""; lb=""
  [[ "$meta" =~ $re_ms ]] && ms="$(trim "${BASH_REMATCH[1]}")"
  [[ "$meta" =~ $re_lb ]] && lb="$(trim "${BASH_REMATCH[1]}")"
  MILESTONE[$id]="$ms"; LABELS[$id]="${lb// /}"
  printf -v corpo '%s\n' "${L[@]:2}"
  CORPO[$id]="$corpo"
  if [[ -n "${NUM[$id]:-}" ]]; then EDITAR+=("$id"); else CRIAR+=("$id"); fi
done
echo "A editar: ${#EDITAR[@]} | A criar: ${#CRIAR[@]}"

run() { if [ "$DRY_RUN" = "1" ]; then printf '[simulação] '; printf '%q ' "$@"; printf '\n'; else "$@"; fi; }
run_body() { # $1 = corpo ; demais = comando (o corpo entra pela entrada padrão)
  local corpo="$1"; shift
  if [ "$DRY_RUN" = "1" ]; then printf '[simulação] '; printf '%q ' "$@"; printf '(corpo: %s caracteres)\n' "${#corpo}"
  else printf '%s' "$corpo" | "$@"; fi
}

# 3) Labels e milestones só para o que for NOVO
declare -A LBL_OK=() MS_OK=()
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

# 4) Editar as existentes
for id in "${EDITAR[@]}"; do
  extra=()
  [[ "$id" == "TASK-18" ]] && extra=(--remove-label P2)     # T18 passou de P2 para P1
  run_body "${CORPO[$id]}" gh issue edit "${NUM[$id]}" --repo "$REPO" --title "${TITULO[$id]}" --add-label "${LABELS[$id]}" "${extra[@]}" --body-file -
done

# 5) Criar as novas
for id in "${CRIAR[@]}"; do
  run_body "${CORPO[$id]}" gh issue create --repo "$REPO" --title "${TITULO[$id]}" --label "${LABELS[$id]}" --milestone "${MILESTONE[$id]}" --body-file -
done

echo
if [ "$DRY_RUN" = "1" ]; then echo "Simulação concluída. Para aplicar: DRY_RUN=0 bash $0"
else echo "Pronto. Confira em https://github.com/$REPO/issues"; fi
