#!/usr/bin/env bash
# Cria labels, milestones e uma issue por TASK em docs/projeto-retencoes-v2/tasks.
# Requer o GitHub CLI (gh) autenticado:  gh auth login
#
# Uso:
#   bash docs/projeto-retencoes-v2/scripts/criar-issues-github.sh            # SIMULAÇÃO (não cria nada)
#   DRY_RUN=0 bash docs/projeto-retencoes-v2/scripts/criar-issues-github.sh  # cria de verdade
#
# Cada arquivo de task tem, na 2ª linha, um comentário no formato:
#   <!-- milestone: M1 - Fundação | labels: backend,frontend,calculo,P0 -->
set -euo pipefail

REPO="${REPO:-euclideslaurindo/sistema-empenho-financeiro}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../tasks" && pwd)"
DRY_RUN="${DRY_RUN:-1}"

run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[simulação] '; printf '%q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

if [ "$DRY_RUN" != "1" ] && ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) não encontrado. Instale e rode: gh auth login" >&2
  exit 1
fi

declare -A MILESTONES=()
declare -A LABELS=()

# 1) Descobrir milestones e labels usados
for f in "$DIR"/TASK-*.md; do
  meta="$(sed -n '2p' "$f")"
  ms="$(printf '%s' "$meta"  | sed -n 's/.*milestone: *\([^|]*\)|.*/\1/p'  | sed 's/ *$//')"
  lbs="$(printf '%s' "$meta" | sed -n 's/.*labels: *\([^>]*\)-->.*/\1/p'    | sed 's/ *$//')"
  [ -n "$ms" ] && MILESTONES["$ms"]=1
  IFS=',' read -ra arr <<< "$lbs"
  for l in "${arr[@]}"; do l="$(echo "$l" | xargs)"; [ -n "$l" ] && LABELS["$l"]=1; done
done

# 2) Labels (ignora erro se já existir)
for l in "${!LABELS[@]}"; do
  run gh label create "$l" --repo "$REPO" --color "1d76db" --force
done

# 3) Milestones (ignora erro se já existir)
for m in "${!MILESTONES[@]}"; do
  if [ "$DRY_RUN" = "1" ]; then
    echo "[simulação] gh api repos/$REPO/milestones -f title='$m'"
  else
    gh api "repos/$REPO/milestones" -f title="$m" >/dev/null 2>&1 || echo "milestone já existe: $m"
  fi
done

# 4) Uma issue por task
for f in "$DIR"/TASK-*.md; do
  title="$(head -1 "$f" | sed 's/^# *//')"
  meta="$(sed -n '2p' "$f")"
  ms="$(printf '%s' "$meta"  | sed -n 's/.*milestone: *\([^|]*\)|.*/\1/p'  | sed 's/ *$//')"
  lbs="$(printf '%s' "$meta" | sed -n 's/.*labels: *\([^>]*\)-->.*/\1/p'    | sed 's/ *$//' | tr -d ' ')"
  body="$(tail -n +3 "$f")"
  run gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$lbs" --milestone "$ms"
done

echo
if [ "$DRY_RUN" = "1" ]; then
  echo "Simulação concluída. Para criar de verdade: DRY_RUN=0 bash $0"
else
  echo "Issues criadas em https://github.com/$REPO/issues"
fi
