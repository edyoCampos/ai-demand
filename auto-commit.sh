#!/usr/bin/env bash
# auto_commit.sh
# Refatorado: analisa diffs, gera commits padronizados e executa um único push.
# Mantém comportamento original: agrupa docs/style/tests (chore), cria commits individuais para outros tipos.

set -euo pipefail

# --- Pré-requisitos ---
if ! command -v git >/dev/null 2>&1; then
  printf '%s\n' "Erro: git não encontrado no PATH." >&2
  exit 1
fi

# Associative arrays require bash >= 4
if (( BASH_VERSINFO[0] < 4 )); then
  printf '%s\n' "Erro: este script requer Bash 4 ou superior." >&2
  exit 1
fi

say() { printf '%s\n' "$*"; }
hr()  { printf '%s\n' "----------------------------------------"; }

# --- Repositório ---
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  say "Erro: não está dentro de um repositório Git."
  exit 1
fi
cd "$REPO_ROOT"

# Se não há nada a commitar, sai
if [[ -z "$(git status --porcelain=v1)" ]]; then
  say "Nenhuma mudança para commitar. Saindo."
  exit 0
fi

# Padrões centralizados
DOC_PATH_REGEX='(^|/)docs(/|$)'
DOC_BASENAMES_REGEX='^README([.]|$)'
DOC_EXTS='md|rst|adoc|txt'

TEST_PATH_REGEX='(^|/)(test|tests|__tests__)(/|$)'
TEST_EXT_REGEX='\.(test|spec)\.(js|jsx|ts|tsx|py|rb|go)$'
PLAYWRIGHT_PATH_REGEX='(^|/)playwright(/|$)'

CONFIG_FILES_REGEX='(^|/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml|setup\.py|pom\.xml|build\.gradle|Dockerfile|README\.md)$'

COMMENT_PREFIXES='^(//|#|/\*|\*|\*/|<!--)'

# --- Helpers de classificação ---
is_docs_file() {
  local f="$1"; local b; b=$(basename -- "$f")
  if [[ "$f" =~ $DOC_PATH_REGEX ]] || [[ "$b" =~ $DOC_BASENAMES_REGEX ]] || [[ "$f" =~ \.(${DOC_EXTS})$ ]]; then
    return 0
  fi
  return 1
}

is_test_file() {
  local f="$1"; local b; b=$(basename -- "$f")
  if [[ "$f" =~ $TEST_PATH_REGEX ]] || [[ "$f" =~ $PLAYWRIGHT_PATH_REGEX ]] || [[ "$b" =~ $TEST_EXT_REGEX ]]; then
    return 0
  fi
  return 1
}

is_config_or_deps() {
  local f="$1"
  if [[ "$f" =~ $CONFIG_FILES_REGEX ]]; then
    return 0
  fi
  return 1
}

whitespace_only_change() {
  local f="$1"
  # Se não houver diff, retornar não (1)
  if [[ -z "$(git diff -- "$f")" ]]; then
    return 1
  fi
  # Se o diff ignorando whitespace é vazio -> apenas whitespace mudou
  if [[ -z "$(git diff -w -- "$f")" ]]; then
    return 0
  fi
  return 1
}

comments_only_change() {
  local f="$1"
  local diff; diff=$(git diff -U0 -- "$f" || true)
  # se não houver diff, não é comments-only
  if [[ -z "$diff" ]]; then
    return 1
  fi
  # extrai linhas modificadas (+ ou -), ignora metadados de hunk
  # e verifica se todas as linhas são comentários (por prefixo)
  local payload; payload=$(printf '%s\n' "$diff" | sed -n 's/^[+-]\(.*\)$/\1/p' | sed '/^@@/d' || true)
  if [[ -z "$payload" ]]; then
    return 1
  fi
  # testa cada linha; se alguma não for comentário, falha
  while IFS= read -r line; do
    local trimmed; trimmed="${line#"${line%%[![:space:]]*}"}"
    if [[ ! "$trimmed" =~ $COMMENT_PREFIXES ]]; then
      return 1
    fi
  done <<<"$payload"
  return 0
}

contains_fix_keyword() {
  local f="$1"
  local diff_lower; diff_lower=$(git diff -U0 -- "$f" | tr 'A-Z' 'a-z' || true)
  if printf '%s\n' "$diff_lower" | grep -Eq '\b(fix|bug|error|hotfix|issue)\b'; then
    return 0
  fi
  return 1
}

truncate_msg() {
  local s="$1"
  local max=60
  if (( ${#s} > max )); then
    # corta e retira espaços finais
    printf '%s' "${s:0:max}" | sed -E 's/[[:space:]]+$//'
  else
    printf '%s' "$s"
  fi
}

# --- Ler status com -z (robusto para espaços e renames) ---
declare -a FILES STATUS OLD_PATHS
while IFS= read -r -d '' entry; do
  local_st="${entry:0:2}"
  local_path="${entry:3}"
  if [[ "${local_st:0:1}" == "R" || "${local_st:0:1}" == "C" ]]; then
    # rename/copy: next token é o path original
    IFS= read -r -d '' orig || orig=""
    FILES+=("$local_path")
    STATUS+=("$local_st")
    OLD_PATHS+=("$orig")
  else
    FILES+=("$local_path")
    STATUS+=("$local_st")
    OLD_PATHS+=("")
  fi
done < <(git -c core.quotepath=off status --porcelain=v1 -z)

# --- Inferir tipo e mensagem por arquivo ---
infer_type_and_message() {
  local status="$1" f="$2" oldpath="${3:-}"
  local base; base=$(basename -- "$f")

  # Deleção (staged "D " ou unstaged " D")
  if [[ "${status:0:1}" == "D" || "${status:1:1}" == "D" ]]; then
    printf '%s\n' "chore|remove ${base}"
    return
  fi

  # Rename (R) — descrever origem -> destino
  if [[ "${status:0:1}" == "R" && -n "$oldpath" ]]; then
    local oldb; oldb=$(basename -- "$oldpath")
    printf '%s\n' "chore|renomeia ${oldb} para ${base}"
    return
  fi

  # Novos arquivos
  if [[ "$status" == "??" || "${status:0:1}" == "A" ]]; then
    if is_docs_file "$f"; then
      printf '%s\n' "docs|adiciona ${base}"
    elif is_test_file "$f"; then
      printf '%s\n' "chore|adiciona testes ${base}"
    elif is_config_or_deps "$f"; then
      printf '%s\n' "chore|adiciona configuração ${base}"
    else
      printf '%s\n' "feat|adiciona ${base}"
    fi
    return
  fi

  # Modificações
  if is_docs_file "$f"; then
    printf '%s\n' "docs|atualiza documentação em ${base}"
    return
  fi
  if whitespace_only_change "$f"; then
    printf '%s\n' "style|ajusta formatação em ${base}"
    return
  fi
  if comments_only_change "$f"; then
    printf '%s\n' "docs|atualiza comentários em ${base}"
    return
  fi
  if contains_fix_keyword "$f"; then
    printf '%s\n' "fix|corrige lógica em ${base}"
    return
  fi
  if is_test_file "$f"; then
    printf '%s\n' "chore|atualiza testes ${base}"
    return
  fi
  if is_config_or_deps "$f"; then
    printf '%s\n' "chore|atualiza configuração ${base}"
    return
  fi
  printf '%s\n' "refactor|refatora ${base}"
}

# --- Agrupamento e planejamento de commits ---
# Limpar variáveis do ambiente se existirem
unset TYPES REASONS GROUPS 2>/dev/null || true
declare -A TYPES
declare -A REASONS
declare -A GROUPS        # chave -> lista separada por '|:|' (simples)
declare -a SOLO_FILES=()
declare -a SOLO_TYPES=()
declare -a SOLO_MSGS=()

GROUP_KEY_DOCS="docs"
GROUP_KEY_STYLE="style"
GROUP_KEY_CHORE_TESTS="chore_tests"
GROUPS["$GROUP_KEY_DOCS"]=""
GROUPS["$GROUP_KEY_STYLE"]=""
GROUPS["$GROUP_KEY_CHORE_TESTS"]=""

for i in "${!FILES[@]}"; do
  f="${FILES[$i]}"; st="${STATUS[$i]}"; oldp="${OLD_PATHS[$i]}"
  read -r inf <<<"$(infer_type_and_message "$st" "$f" "$oldp")"
  # separa tipo|mensagem
  typ="${inf%%|*}"
  msg="${inf#*|}"
  short="$(truncate_msg "$msg")"
  TYPES["$f"]="$typ"
  REASONS["$f"]="$short"

  if [[ "$typ" == "docs" ]]; then
    GROUPS["$GROUP_KEY_DOCS"]+="$f|:|"
  elif [[ "$typ" == "style" ]]; then
    GROUPS["$GROUP_KEY_STYLE"]+="$f|:|"
  elif [[ "$typ" == "chore" && $(is_test_file "$f"; echo $?) -eq 0 ]]; then
    GROUPS["$GROUP_KEY_CHORE_TESTS"]+="$f|:|"
  else
    SOLO_FILES+=("$f")
    SOLO_TYPES+=("$typ")
    SOLO_MSGS+=("$short")
  fi
done

# Auditoria
hr
say "Decisões de tipo por arquivo (antes de executar):"
for f in "${FILES[@]}"; do
  say "- ${f}: ${TYPES[$f]} — motivo: ${REASONS[$f]}"
done
hr

# Plano resumido
say "Resumo do plano de commits:"
if [[ -n "${GROUPS[$GROUP_KEY_DOCS]}" ]]; then
  # conta ocorrências
  count=$(awk -F'\\|:\\|' 'NF{print NF-1}' <<<"${GROUPS[$GROUP_KEY_DOCS]}|:|" || true)
  say "• 1 commit docs para ${count} arquivo(s)."
fi
if [[ -n "${GROUPS[$GROUP_KEY_STYLE]}" ]]; then
  count=$(awk -F'\\|:\\|' 'NF{print NF-1}' <<<"${GROUPS[$GROUP_KEY_STYLE]}|:|" || true)
  say "• 1 commit style para ${count} arquivo(s)."
fi
if [[ -n "${GROUPS[$GROUP_KEY_CHORE_TESTS]}" ]]; then
  count=$(awk -F'\\|:\\|' 'NF{print NF-1}' <<<"${GROUPS[$GROUP_KEY_CHORE_TESTS]}|:|" || true)
  say "• 1 commit chore (testes) para ${count} arquivo(s)."
fi
if ((${#SOLO_FILES[@]})); then
  say "• ${#SOLO_FILES[@]} commit(s) individuais (feat/fix/refactor/chore)."
fi
hr
say "Prosseguindo em 5s. Pressione Ctrl+C para abortar."
sleep 5 || true

# --- Funções de commit ---
_commit_files() {
  local typ="$1"; local msg="$2"; shift 2
  local -a files=("$@")
  # filtra vazios
  local to_add=()
  for f in "${files[@]}"; do
    [[ -n "$f" ]] && to_add+=("$f")
  done
  if ((${#to_add[@]} == 0)); then
    return 0
  fi
  # stage e commit; se não houver alterações reais (ex: file removed antes), pula
  git add -- "${to_add[@]}"
  # se não houver staged changes correspondentes, pular
  if [[ -z "$(git diff --name-only --cached)" ]]; then
    git reset
    return 0
  fi
  commit_msg="$(truncate_msg "${typ}: ${msg}")"
  git commit -m "$commit_msg"
  # limpar índice para não carregar staged leftovers
  git reset
}

# Executa commits por grupo
# docs
if [[ -n "${GROUPS[$GROUP_KEY_DOCS]}" ]]; then
  IFS='|:|' read -ra arr <<<"${GROUPS[$GROUP_KEY_DOCS]}"
  _files=()
  for e in "${arr[@]}"; do
    [[ -n "$e" ]] && _files+=("$e")
  done
  _commit_files "docs" "atualiza documentação" "${_files[@]}"
fi

# style
if [[ -n "${GROUPS[$GROUP_KEY_STYLE]}" ]]; then
  IFS='|:|' read -ra arr <<<"${GROUPS[$GROUP_KEY_STYLE]}"
  _files=()
  for e in "${arr[@]}"; do
    [[ -n "$e" ]] && _files+=("$e")
  done
  _commit_files "style" "ajusta formatação" "${_files[@]}"
fi

# chore tests
if [[ -n "${GROUPS[$GROUP_KEY_CHORE_TESTS]}" ]]; then
  IFS='|:|' read -ra arr <<<"${GROUPS[$GROUP_KEY_CHORE_TESTS]}"
  _files=()
  for e in "${arr[@]}"; do
    [[ -n "$e" ]] && _files+=("$e")
  done
  _commit_files "chore" "atualiza testes de API" "${_files[@]}"
fi

# Commits individuais
for idx in "${!SOLO_FILES[@]}"; do
  f="${SOLO_FILES[$idx]}"; typ="${SOLO_TYPES[$idx]}"; msg="${SOLO_MSGS[$idx]}"
  _commit_files "$typ" "$msg" "$f"
done

hr
say "Commits locais concluídos. Push único em 3s… (Ctrl+C para abortar)"
sleep 3 || true

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
say "Executando: git push origin ${CURRENT_BRANCH}"
if git push origin "$CURRENT_BRANCH"; then
  hr
  say "Push concluído com sucesso."
else
  hr
  say "Falha no push. Verifique as permissões/remote e tente novamente."
  exit 1
fi
