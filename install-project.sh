#!/usr/bin/env bash
# install-project.sh — interactive, per-project installer.
#
# Takes a target path, detects the stack (from package.json + marker files),
# preselects relevant skills, lets you toggle, then installs to <target>/.claude/skills/.
#
# Usage:
#   ./install-project.sh                           prompt for target, then interactive menu
#   ./install-project.sh <path>                    target <path>, interactive menu
#   ./install-project.sh <path> --yes              accept detected selection, no menu
#   ./install-project.sh <path> --all              install every skill, no menu
#   ./install-project.sh <path> --skill=<name>...  force-include specific skills
#   ./install-project.sh <path> --copy             copy instead of symlink
#   ./install-project.sh <path> --no-suggest       start with nothing selected
#   ./install-project.sh --help

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-project.sh [<target-path>] [flags]

Flags:
  --yes, -y            accept detected selection without showing the menu
  --all                select every skill, skip the menu
  --skill=<name>       force-include a skill (repeatable)
  --no-suggest         start with nothing preselected
  --copy               copy files instead of symlinking
  --help, -h           this help

Stack detection (from <target>/package.json and marker files):
  fastify, @trpc/server, @neolinkrnd/fastify-bundle-*  -> backend skills
  @angular/core, @nx/angular                            -> frontend skills
  zod                                                   -> shared/zod-schema
  Dockerfile OR @neolinkrnd/* deps                      -> devops/argocd-k8s-deploy

Interactive menu commands:
  1 3 5      toggle entries 1, 3, 5
  a          select all
  n          select none
  s          select only detected (suggested) entries
  [Enter]    install the current selection
  q          cancel
EOF
}

TARGET_PATH=""
MODE="symlink"
FORCE_YES=0
FORCE_ALL=0
NO_SUGGEST=0
FORCE_SKILLS=()

for arg in "$@"; do
  case "$arg" in
    -h|--help)     usage; exit 0 ;;
    --copy)        MODE="copy" ;;
    -y|--yes)      FORCE_YES=1 ;;
    --all)         FORCE_ALL=1 ;;
    --no-suggest)  NO_SUGGEST=1 ;;
    --skill=*)     FORCE_SKILLS+=("${arg#--skill=}") ;;
    -*)            echo "install-project.sh: unknown flag '$arg'" >&2; usage >&2; exit 1 ;;
    *)
      if [ -n "$TARGET_PATH" ]; then
        echo "install-project.sh: multiple target paths given ('$TARGET_PATH', '$arg')" >&2
        exit 1
      fi
      TARGET_PATH="$arg"
      ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$TARGET_PATH" ]; then
  printf "Target project path: "
  read -r TARGET_PATH
fi
TARGET_PATH="${TARGET_PATH/#\~/$HOME}"

if [ ! -d "$TARGET_PATH" ]; then
  echo "install-project.sh: '$TARGET_PATH' is not a directory" >&2
  exit 1
fi
TARGET_PATH="$(cd "$TARGET_PATH" && pwd)"

# --- discover skills ----------------------------------------------------------

SKILL_NAMES=()
SKILL_PATHS=()
SKILL_CATEGORIES=()

while IFS= read -r skill_md; do
  [ -z "$skill_md" ] && continue
  dir="$(dirname "$skill_md")"
  name="$(basename "$dir")"
  cat_dir="$(dirname "$dir")"
  category="$(basename "$cat_dir")"
  [ "$category" = "skills" ] && category="misc"
  SKILL_NAMES+=("$name")
  SKILL_PATHS+=("$dir")
  SKILL_CATEGORIES+=("$category")
done <<EOF
$(find "$SOURCE_DIR/skills" -type f -name SKILL.md 2>/dev/null | sort)
EOF

N=${#SKILL_NAMES[@]}
if [ "$N" -eq 0 ]; then
  echo "install-project.sh: no skills found under $SOURCE_DIR/skills" >&2
  exit 1
fi

SELECTED=()
DETECTED=()
for i in $(seq 0 $((N - 1))); do
  SELECTED[$i]=0
  DETECTED[$i]=""
done

# --- stack detection ----------------------------------------------------------

PKG_JSON="$TARGET_PATH/package.json"

have_dep_literal() {
  # literal dependency name match in package.json
  [ -f "$PKG_JSON" ] || return 1
  grep -q "\"$1\"[[:space:]]*:" "$PKG_JSON"
}

have_dep_prefix() {
  # any dep key starting with prefix $1 (e.g. '@neolinkrnd/', '@nx/')
  [ -f "$PKG_JSON" ] || return 1
  grep -q "\"$1" "$PKG_JSON"
}

has_file() {
  # one or more paths relative to TARGET_PATH; returns 0 if any exists as file
  local p
  for p in "$@"; do
    [ -f "$TARGET_PATH/$p" ] && return 0
  done
  return 1
}

has_dir() {
  local p
  for p in "$@"; do
    [ -d "$TARGET_PATH/$p" ] && return 0
  done
  return 1
}

has_file_glob() {
  # shallow glob match at the target root (no recursion — keeps it fast)
  local g match
  for g in "$@"; do
    for match in "$TARGET_PATH"/$g; do
      [ -e "$match" ] && return 0
    done
  done
  return 1
}

flag_skill() {
  # $1 = skill name, $2 = reason to display
  local skill="$1" reason="$2" i
  for i in $(seq 0 $((N - 1))); do
    if [ "${SKILL_NAMES[$i]}" = "$skill" ]; then
      SELECTED[$i]=1
      if [ -z "${DETECTED[$i]}" ]; then
        DETECTED[$i]="$reason"
      else
        case ",${DETECTED[$i]}," in
          *",$reason,"*) : ;;
          *) DETECTED[$i]="${DETECTED[$i]}, $reason" ;;
        esac
      fi
      return 0
    fi
  done
}

if [ "$NO_SUGGEST" -eq 0 ] && [ "$FORCE_ALL" -eq 0 ]; then
  # All checks read from $TARGET_PATH only (package.json, root-level marker files/dirs).
  # Each call to flag_skill adds one specific signal as a reason — multiple signals
  # surface in the menu as "# detected: a, b, c".

  # ---- Backend: Fastify + tRPC -----------------------------------------------
  # Gate on fastify itself or the house bundle prefix. @trpc/server alone is NOT
  # enough — frontend monorepos import it for AppRouter type inference.
  IS_BACKEND=0
  if have_dep_literal "fastify"; then
    IS_BACKEND=1
    flag_skill "fastify-trpc-service" "fastify"
    flag_skill "fastify-plugin"       "fastify"
  fi
  if have_dep_literal "@fastify/autoload"; then
    IS_BACKEND=1
    flag_skill "fastify-trpc-service" "@fastify/autoload"
  fi
  if have_dep_literal "fastify-plugin"; then
    IS_BACKEND=1
    flag_skill "fastify-plugin" "fastify-plugin dep"
  fi
  if have_dep_prefix "@neolinkrnd/fastify-bundle"; then
    IS_BACKEND=1
    flag_skill "fastify-trpc-service" "@neolinkrnd/fastify-bundle-*"
    flag_skill "fastify-plugin"       "@neolinkrnd/fastify-bundle-*"
  fi
  if [ "$IS_BACKEND" -eq 1 ]; then
    have_dep_literal "@trpc/server"      && flag_skill "fastify-trpc-service" "@trpc/server"
    have_dep_literal "@sinclair/typemap" && flag_skill "fastify-trpc-service" "@sinclair/typemap"
    have_dep_literal "@nx/node"          && flag_skill "fastify-trpc-service" "@nx/node"
  fi

  # ---- Frontend: Angular 19 --------------------------------------------------
  IS_FRONTEND=0
  if have_dep_literal "@angular/core" || has_file "angular.json"; then
    IS_FRONTEND=1
    flag_skill "angular-19-component" "@angular/core"
    flag_skill "nx-angular-library"   "@angular/core"
  fi
  if have_dep_literal "@nx/angular"; then
    IS_FRONTEND=1
    flag_skill "nx-angular-library" "@nx/angular"
  fi
  if [ "$IS_FRONTEND" -eq 1 ]; then
    have_dep_literal "@angular/material"         && flag_skill "angular-19-component" "@angular/material"
    have_dep_literal "tailwindcss"               && flag_skill "angular-19-component" "tailwindcss"
    has_file_glob "tailwind.config.*"            && flag_skill "angular-19-component" "tailwind.config"
    have_dep_literal "@analogjs/vitest-angular"  && flag_skill "angular-19-component" "@analogjs/vitest-angular"
    has_file_glob "vitest.config.*"              && flag_skill "angular-19-component" "vitest.config"
    has_file_glob "playwright.config.*"          && flag_skill "angular-19-component" "playwright.config"
  fi

  # ---- Shared: Zod -----------------------------------------------------------
  if have_dep_literal "zod"; then flag_skill "zod-schema" "zod"; fi
  if have_dep_literal "@sinclair/typemap"; then flag_skill "zod-schema" "@sinclair/typemap"; fi

  # ---- DevOps: ArgoCD + Kubernetes deploy ------------------------------------
  # Any of these implies the project ships somewhere containerised / orchestrated.
  # @neolinkrnd/* deps mean it's a Neolink service — we always deploy those via ArgoCD.
  for marker in Dockerfile Dockerfile.prod Dockerfile.dev \
                docker-compose.yml docker-compose.yaml compose.yml compose.yaml \
                Chart.yaml skaffold.yaml kustomization.yaml; do
    has_file "$marker" && flag_skill "argocd-k8s-deploy" "$marker"
  done
  for d in k8s kubernetes manifests deploy helm charts .argocd argocd; do
    has_dir "$d" && flag_skill "argocd-k8s-deploy" "$d/"
  done
  have_dep_prefix "@neolinkrnd/" && flag_skill "argocd-k8s-deploy" "@neolinkrnd/* (Neolink service)"
fi

if [ "$FORCE_ALL" -eq 1 ]; then
  for i in $(seq 0 $((N - 1))); do SELECTED[$i]=1; done
fi

if [ "${#FORCE_SKILLS[@]}" -gt 0 ]; then
  for forced in "${FORCE_SKILLS[@]}"; do
    matched=0
    for i in $(seq 0 $((N - 1))); do
      if [ "${SKILL_NAMES[$i]}" = "$forced" ]; then
        SELECTED[$i]=1
        DETECTED[$i]="${DETECTED[$i]:+${DETECTED[$i]}, }--skill"
        matched=1
      fi
    done
    [ "$matched" -eq 0 ] && echo "warn: --skill=$forced not found" >&2
  done
fi

# --- menu rendering -----------------------------------------------------------

render_menu() {
  echo
  echo "Target:  $TARGET_PATH"
  echo "Source:  $SOURCE_DIR"
  [ -f "$PKG_JSON" ] && echo "Package: $(grep -m1 '"name"' "$PKG_JSON" 2>/dev/null | sed 's/[[:space:]]*"name"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"
  echo
  local last_cat="" mark idx line i
  for i in $(seq 0 $((N - 1))); do
    if [ "${SKILL_CATEGORIES[$i]}" != "$last_cat" ]; then
      echo "  [${SKILL_CATEGORIES[$i]}]"
      last_cat="${SKILL_CATEGORIES[$i]}"
    fi
    mark="[ ]"
    [ "${SELECTED[$i]}" -eq 1 ] && mark="[x]"
    idx=$((i + 1))
    printf -v line "    %s %2d) %-28s" "$mark" "$idx" "${SKILL_NAMES[$i]}"
    if [ -n "${DETECTED[$i]}" ]; then
      line="$line  # detected: ${DETECTED[$i]}"
    fi
    echo "$line"
  done
  echo
  echo "  Toggle: numbers (e.g. '1 3 5')   a=all  n=none  s=suggested  [Enter]=install  q=cancel"
}

# --- interactive loop ---------------------------------------------------------

if [ "$FORCE_YES" -eq 0 ] && [ "$FORCE_ALL" -eq 0 ]; then
  while :; do
    render_menu
    printf "> "
    if ! read -r input; then echo; exit 0; fi
    case "$input" in
      "")   break ;;
      q|Q)  echo "cancelled."; exit 0 ;;
      a|A)  for i in $(seq 0 $((N - 1))); do SELECTED[$i]=1; done ;;
      n|N)  for i in $(seq 0 $((N - 1))); do SELECTED[$i]=0; done ;;
      s|S)
        for i in $(seq 0 $((N - 1))); do
          if [ -n "${DETECTED[$i]}" ]; then SELECTED[$i]=1; else SELECTED[$i]=0; fi
        done
        ;;
      *)
        for tok in $input; do
          case "$tok" in
            ''|*[!0-9]*) echo "  (ignored: '$tok')" ;;
            *)
              idx=$((tok - 1))
              if [ "$idx" -ge 0 ] && [ "$idx" -lt "$N" ]; then
                if [ "${SELECTED[$idx]}" -eq 1 ]; then SELECTED[$idx]=0; else SELECTED[$idx]=1; fi
              else
                echo "  (out of range: $tok)"
              fi
              ;;
          esac
        done
        ;;
    esac
  done
fi

# --- install ------------------------------------------------------------------

mkdir -p "$TARGET_PATH/.claude/skills"

installed=0
installed_names=""
for i in $(seq 0 $((N - 1))); do
  [ "${SELECTED[$i]}" -eq 1 ] || continue
  src="${SKILL_PATHS[$i]}"
  dst="$TARGET_PATH/.claude/skills/${SKILL_NAMES[$i]}"
  if [ "$MODE" = "symlink" ]; then
    ln -snf "$src" "$dst"
  else
    rm -rf "$dst"
    cp -R "$src" "$dst"
  fi
  installed=$((installed + 1))
  installed_names="${installed_names}  - ${SKILL_NAMES[$i]}
"
done

echo
if [ "$installed" -eq 0 ]; then
  echo "Nothing selected. No changes made."
else
  echo "Installed $installed skill(s) into $TARGET_PATH/.claude/skills (mode: $MODE):"
  printf "%s" "$installed_names"
  echo
  echo "Restart Claude Code in that project to pick them up."
fi
