#!/usr/bin/env bash
# install-project.sh — interactive, per-project installer.
#
# Installs any combination of:
#   - skills    -> <target>/.claude/skills/<name>/
#   - agents    -> <target>/.claude/agents/<name>.md
#   - settings  -> <target>/.claude/settings.json
#                  (enables agent teams + auto memory; skipped if file exists)
#
# Reads the target's package.json and root-level marker files to preselect
# relevant entries. The menu lets you toggle anything before installing.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-project.sh [<target-path>] [flags]

Flags:
  --yes, -y            accept detected selection without showing the menu
  --all                select every skill and agent, skip the menu
  --skill=<name>       force-include a skill (repeatable)
  --agent=<name>       force-include an agent (repeatable)
  --with-settings      force-include the recommended .claude/settings.json
  --no-suggest         start with nothing preselected
  --copy               copy files instead of symlinking
  --help, -h           this help

Stack detection (from <target>/package.json and marker files):
  fastify, @fastify/autoload, fastify-plugin           -> backend skills + backend-implementer
  @neolinkrnd/fastify-bundle-*                          -> backend skills + backend-implementer
  @angular/core OR angular.json, @nx/angular            -> frontend skills + frontend-implementer
  zod, @sinclair/typemap                                -> zod-schema, schema-owner (full-stack only)
  Dockerfile | docker-compose.* | Chart.yaml | k8s/ ... -> argocd-k8s-deploy + deploy-captain
  cross-layer (backend AND frontend signals)            -> schema-owner, agent-teams skill

Settings fragment (opt-in via --with-settings or interactive toggle) writes:
  { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }, "autoMemoryEnabled": true }
  to <target>/.claude/settings.json (skipped if the file already exists).

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
FORCE_SETTINGS=0
FORCE_SKILLS=()
FORCE_AGENTS=()
FORCE_COMMANDS=()

for arg in "$@"; do
  case "$arg" in
    -h|--help)        usage; exit 0 ;;
    --copy)           MODE="copy" ;;
    -y|--yes)         FORCE_YES=1 ;;
    --all)            FORCE_ALL=1 ;;
    --no-suggest)     NO_SUGGEST=1 ;;
    --with-settings)  FORCE_SETTINGS=1 ;;
    --skill=*)        FORCE_SKILLS+=("${arg#--skill=}") ;;
    --agent=*)        FORCE_AGENTS+=("${arg#--agent=}") ;;
    --command=*)      FORCE_COMMANDS+=("${arg#--command=}") ;;
    -*)               echo "install-project.sh: unknown flag '$arg'" >&2; usage >&2; exit 1 ;;
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

# --- discover entries ---------------------------------------------------------
# Parallel arrays. Each entry has a KIND: "skill" | "agent" | "settings".

ENTRY_KIND=()
ENTRY_NAME=()
ENTRY_SRC=()
ENTRY_CATEGORY=()
ENTRY_SELECTED=()
ENTRY_DETECTED=()

# Skills: directories containing SKILL.md
while IFS= read -r skill_md; do
  [ -z "$skill_md" ] && continue
  dir="$(dirname "$skill_md")"
  name="$(basename "$dir")"
  cat_dir="$(dirname "$dir")"
  category="$(basename "$cat_dir")"
  [ "$category" = "skills" ] && category="misc"
  ENTRY_KIND+=("skill")
  ENTRY_NAME+=("$name")
  ENTRY_SRC+=("$dir")
  ENTRY_CATEGORY+=("$category")
  ENTRY_SELECTED+=(0)
  ENTRY_DETECTED+=("")
done <<EOF
$(find "$SOURCE_DIR/skills" -type f -name SKILL.md 2>/dev/null | sort)
EOF

# Agents: *.md under agents/ (excluding README.md)
while IFS= read -r agent_md; do
  [ -z "$agent_md" ] && continue
  name="$(basename "$agent_md" .md)"
  cat_dir="$(dirname "$agent_md")"
  category="$(basename "$cat_dir")"
  [ "$category" = "agents" ] && category="misc"
  ENTRY_KIND+=("agent")
  ENTRY_NAME+=("$name")
  ENTRY_SRC+=("$agent_md")
  ENTRY_CATEGORY+=("$category")
  ENTRY_SELECTED+=(0)
  ENTRY_DETECTED+=("")
done <<EOF
$(find "$SOURCE_DIR/agents" -type f -name "*.md" ! -iname "README.md" 2>/dev/null | sort)
EOF

# Commands: *.md under commands/ (excluding README.md) → become slash commands
while IFS= read -r cmd_md; do
  [ -z "$cmd_md" ] && continue
  name="$(basename "$cmd_md" .md)"
  cat_dir="$(dirname "$cmd_md")"
  category="$(basename "$cat_dir")"
  [ "$category" = "commands" ] && category="misc"
  ENTRY_KIND+=("command")
  ENTRY_NAME+=("$name")
  ENTRY_SRC+=("$cmd_md")
  ENTRY_CATEGORY+=("$category")
  ENTRY_SELECTED+=(0)
  ENTRY_DETECTED+=("")
done <<EOF
$(find "$SOURCE_DIR/commands" -type f -name "*.md" ! -iname "README.md" 2>/dev/null | sort)
EOF

# Settings pseudo-entry (always last)
ENTRY_KIND+=("settings")
ENTRY_NAME+=("enable agent teams + auto memory")
ENTRY_SRC+=("$SOURCE_DIR/settings/recommended.json")
ENTRY_CATEGORY+=("project-settings")
ENTRY_SELECTED+=(0)
ENTRY_DETECTED+=("")

N=${#ENTRY_NAME[@]}
if [ "$N" -eq 0 ]; then
  echo "install-project.sh: no entries discovered under $SOURCE_DIR" >&2
  exit 1
fi

# --- stack detection ----------------------------------------------------------
# All reads are scoped to $TARGET_PATH. Never this repo, never $HOME.

PKG_JSON="$TARGET_PATH/package.json"

have_dep_literal() {
  [ -f "$PKG_JSON" ] || return 1
  grep -q "\"$1\"[[:space:]]*:" "$PKG_JSON"
}
have_dep_prefix() {
  [ -f "$PKG_JSON" ] || return 1
  grep -q "\"$1" "$PKG_JSON"
}
has_file() {
  local p
  for p in "$@"; do [ -f "$TARGET_PATH/$p" ] && return 0; done
  return 1
}
has_dir() {
  local p
  for p in "$@"; do [ -d "$TARGET_PATH/$p" ] && return 0; done
  return 1
}
has_file_glob() {
  local g match
  for g in "$@"; do
    for match in "$TARGET_PATH"/$g; do
      [ -e "$match" ] && return 0
    done
  done
  return 1
}

flag_entry() {
  # $1 = kind, $2 = name, $3 = reason
  local kind="$1" name="$2" reason="$3" i
  for i in $(seq 0 $((N - 1))); do
    if [ "${ENTRY_KIND[$i]}" = "$kind" ] && [ "${ENTRY_NAME[$i]}" = "$name" ]; then
      ENTRY_SELECTED[$i]=1
      if [ -z "${ENTRY_DETECTED[$i]}" ]; then
        ENTRY_DETECTED[$i]="$reason"
      else
        case ",${ENTRY_DETECTED[$i]}," in
          *",$reason,"*) : ;;
          *) ENTRY_DETECTED[$i]="${ENTRY_DETECTED[$i]}, $reason" ;;
        esac
      fi
      return 0
    fi
  done
  return 0
}

if [ "$NO_SUGGEST" -eq 0 ] && [ "$FORCE_ALL" -eq 0 ]; then
  # ---- Backend: Fastify gateway + observability + API spec -----------------
  IS_BACKEND=0
  if have_dep_literal "fastify"; then
    IS_BACKEND=1
    flag_entry "skill" "neolink-fastify-gateway-generator" "fastify"
    flag_entry "skill" "neolink-gateway-setup"             "fastify"
    flag_entry "skill" "api-spec-generator"                "fastify"
  fi
  if have_dep_literal "@fastify/autoload"; then
    IS_BACKEND=1
    flag_entry "skill" "neolink-fastify-gateway-generator" "@fastify/autoload"
  fi
  if have_dep_literal "fastify-plugin"; then
    IS_BACKEND=1
    flag_entry "skill" "neolink-fastify-gateway-generator" "fastify-plugin dep"
  fi
  if have_dep_prefix "@neolinkrnd/fastify-bundle"; then
    IS_BACKEND=1
    flag_entry "skill" "neolink-fastify-gateway-generator" "@neolinkrnd/fastify-bundle-*"
    flag_entry "skill" "neolink-gateway-setup"             "@neolinkrnd/fastify-bundle-*"
  fi
  if [ "$IS_BACKEND" -eq 1 ]; then
    have_dep_literal "@trpc/server"      && flag_entry "skill" "api-spec-generator"                "@trpc/server"
    have_dep_literal "@sinclair/typemap" && flag_entry "skill" "neolink-fastify-gateway-generator" "@sinclair/typemap"
    have_dep_literal "@nx/node"          && flag_entry "skill" "neolink-fastify-gateway-generator" "@nx/node"
    flag_entry "agent" "backend-implementer" "backend detected"
  fi

  # ---- Frontend: Angular 21 + NX -------------------------------------------
  IS_FRONTEND=0
  if have_dep_literal "@angular/core" || has_file "angular.json"; then
    IS_FRONTEND=1
    flag_entry "skill" "angular-nx-architect" "@angular/core"
    flag_entry "skill" "angular-unit-test"    "@angular/core"
  fi
  if have_dep_literal "@nx/angular"; then
    IS_FRONTEND=1
    flag_entry "skill" "angular-nx-architect" "@nx/angular"
  fi
  if [ "$IS_FRONTEND" -eq 1 ]; then
    have_dep_literal "@angular/material"         && flag_entry "skill" "angular-nx-architect" "@angular/material"
    have_dep_literal "tailwindcss"               && flag_entry "skill" "angular-nx-architect" "tailwindcss"
    has_file_glob "tailwind.config.*"            && flag_entry "skill" "angular-nx-architect" "tailwind.config"
    have_dep_literal "vitest"                    && flag_entry "skill" "angular-unit-test"    "vitest"
    has_file_glob "vitest.config.*"              && flag_entry "skill" "angular-unit-test"    "vitest.config"
    has_file_glob "playwright.config.*"          && flag_entry "skill" "angular-unit-test"    "playwright.config"

    # Neolink portal repos only — angular-neolink-template is specific to
    # apps/portal-example, portal-neolink, portal-hive.
    PKG_NAME="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PKG_JSON" 2>/dev/null | head -1)"
    case "$PKG_NAME" in
      *portal*|*neolink*) flag_entry "skill" "angular-neolink-template" "portal/neolink package name" ;;
    esac
    if has_file_glob "apps/portal-*"; then
      flag_entry "skill" "angular-neolink-template" "apps/portal-* present"
    fi

    flag_entry "agent" "frontend-implementer" "frontend detected"
  fi

  # ---- Shared: Zod (still valid; no replacement among the new skills) ------
  if have_dep_literal "zod";              then flag_entry "skill" "zod-schema" "zod"; fi
  if have_dep_literal "@sinclair/typemap"; then flag_entry "skill" "zod-schema" "@sinclair/typemap"; fi

  # ---- DevOps: ArgoCD + Kubernetes -----------------------------------------
  IS_DEVOPS=0
  for marker in Dockerfile Dockerfile.prod Dockerfile.dev \
                docker-compose.yml docker-compose.yaml compose.yml compose.yaml \
                Chart.yaml skaffold.yaml kustomization.yaml; do
    if has_file "$marker"; then
      IS_DEVOPS=1
      flag_entry "skill" "argocd-k8s-deploy" "$marker"
    fi
  done
  for d in k8s kubernetes manifests deploy helm charts .argocd argocd; do
    if has_dir "$d"; then
      IS_DEVOPS=1
      flag_entry "skill" "argocd-k8s-deploy" "$d/"
    fi
  done
  if have_dep_prefix "@neolinkrnd/"; then
    IS_DEVOPS=1
    flag_entry "skill" "argocd-k8s-deploy" "@neolinkrnd/* (Neolink service)"
  fi
  [ "$IS_DEVOPS" -eq 1 ] && flag_entry "agent" "deploy-captain" "deploy markers"

  # ---- Full-stack monorepo: shared schemas + agent-teams + team-lead ------
  if [ "$IS_BACKEND" -eq 1 ] && [ "$IS_FRONTEND" -eq 1 ]; then
    flag_entry "agent" "schema-owner"  "full-stack monorepo"
    flag_entry "skill" "agent-teams"   "full-stack monorepo"
    flag_entry "skill" "team-lead"     "agent-teams enabled"
  fi

  # ---- Project brain: codebase-scan + feature-outcome for any stack -------
  if [ "$IS_BACKEND" -eq 1 ] || [ "$IS_FRONTEND" -eq 1 ]; then
    flag_entry "skill"   "codebase-scan"   "stack detected"
    flag_entry "skill"   "feature-outcome" "stack detected"
    flag_entry "command" "feature"         "stack detected"
  fi

  # ---- Project settings: preselect only if no settings.json exists yet -----
  if [ ! -f "$TARGET_PATH/.claude/settings.json" ]; then
    flag_entry "settings" "enable agent teams + auto memory" "no existing settings.json"
  fi
fi

# --all forces every skill + agent + command (NOT settings — that can clobber existing config)
if [ "$FORCE_ALL" -eq 1 ]; then
  for i in $(seq 0 $((N - 1))); do
    case "${ENTRY_KIND[$i]}" in
      skill|agent|command) ENTRY_SELECTED[$i]=1 ;;
    esac
  done
fi

# Force-select via flags
force_select() {
  # $1 = kind, $2 = name
  local kind="$1" name="$2" i matched=0
  for i in $(seq 0 $((N - 1))); do
    if [ "${ENTRY_KIND[$i]}" = "$kind" ] && [ "${ENTRY_NAME[$i]}" = "$name" ]; then
      ENTRY_SELECTED[$i]=1
      ENTRY_DETECTED[$i]="${ENTRY_DETECTED[$i]:+${ENTRY_DETECTED[$i]}, }--$kind"
      matched=1
    fi
  done
  if [ "$matched" -eq 0 ]; then
    echo "warn: --$kind=$name not found" >&2
  fi
  return 0
}

if [ "${#FORCE_SKILLS[@]}" -gt 0 ]; then
  for s in "${FORCE_SKILLS[@]}"; do force_select "skill" "$s"; done
fi
if [ "${#FORCE_AGENTS[@]}" -gt 0 ]; then
  for a in "${FORCE_AGENTS[@]}"; do force_select "agent" "$a"; done
fi
if [ "${#FORCE_COMMANDS[@]}" -gt 0 ]; then
  for c in "${FORCE_COMMANDS[@]}"; do force_select "command" "$c"; done
fi
if [ "$FORCE_SETTINGS" -eq 1 ]; then
  force_select "settings" "enable agent teams + auto memory"
fi

# --- menu rendering -----------------------------------------------------------

render_menu() {
  echo
  echo "Target:  $TARGET_PATH"
  echo "Source:  $SOURCE_DIR"
  [ -f "$PKG_JSON" ] && echo "Package: $(grep -m1 '"name"' "$PKG_JSON" 2>/dev/null | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  echo
  local last_kind="" last_cat="" k c mark idx line i
  for i in $(seq 0 $((N - 1))); do
    k="${ENTRY_KIND[$i]}"
    c="${ENTRY_CATEGORY[$i]}"
    if [ "$k" != "$last_kind" ]; then
      case "$k" in
        skill)    echo "Skills:" ;;
        agent)    echo; echo "Agents (subagents; also usable as agent-team teammates):" ;;
        command)  echo; echo "Slash commands:" ;;
        settings) echo; echo "Project settings:" ;;
      esac
      last_kind="$k"
      last_cat=""
    fi
    if [ "$k" != "settings" ] && [ "$c" != "$last_cat" ]; then
      echo "  [$c]"
      last_cat="$c"
    fi
    mark="[ ]"
    [ "${ENTRY_SELECTED[$i]}" -eq 1 ] && mark="[x]"
    idx=$((i + 1))
    if [ "$k" = "settings" ]; then
      printf -v line "    %s %2d) %s" "$mark" "$idx" "${ENTRY_NAME[$i]}"
    else
      printf -v line "    %s %2d) %-28s" "$mark" "$idx" "${ENTRY_NAME[$i]}"
    fi
    if [ -n "${ENTRY_DETECTED[$i]}" ]; then
      line="$line  # ${ENTRY_DETECTED[$i]}"
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
      a|A)
        for i in $(seq 0 $((N - 1))); do ENTRY_SELECTED[$i]=1; done
        ;;
      n|N)
        for i in $(seq 0 $((N - 1))); do ENTRY_SELECTED[$i]=0; done
        ;;
      s|S)
        for i in $(seq 0 $((N - 1))); do
          if [ -n "${ENTRY_DETECTED[$i]}" ]; then ENTRY_SELECTED[$i]=1; else ENTRY_SELECTED[$i]=0; fi
        done
        ;;
      *)
        for tok in $input; do
          case "$tok" in
            ''|*[!0-9]*) echo "  (ignored: '$tok')" ;;
            *)
              idx=$((tok - 1))
              if [ "$idx" -ge 0 ] && [ "$idx" -lt "$N" ]; then
                if [ "${ENTRY_SELECTED[$idx]}" -eq 1 ]; then
                  ENTRY_SELECTED[$idx]=0
                else
                  ENTRY_SELECTED[$idx]=1
                fi
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

mkdir -p "$TARGET_PATH/.claude/skills" "$TARGET_PATH/.claude/agents" "$TARGET_PATH/.claude/commands"

install_path() {
  # $1 = source (file or dir), $2 = destination
  local src="$1" dst="$2"
  if [ "$MODE" = "symlink" ]; then
    ln -snf "$src" "$dst"
  else
    rm -rf "$dst"
    if [ -d "$src" ]; then cp -R "$src" "$dst"; else cp "$src" "$dst"; fi
  fi
}

skills_installed=0
agents_installed=0
commands_installed=0
settings_result=""
installed_lines=""

for i in $(seq 0 $((N - 1))); do
  [ "${ENTRY_SELECTED[$i]}" -eq 1 ] || continue
  case "${ENTRY_KIND[$i]}" in
    skill)
      install_path "${ENTRY_SRC[$i]}" "$TARGET_PATH/.claude/skills/${ENTRY_NAME[$i]}"
      skills_installed=$((skills_installed + 1))
      installed_lines="${installed_lines}  skill    ${ENTRY_NAME[$i]}
"
      ;;
    agent)
      install_path "${ENTRY_SRC[$i]}" "$TARGET_PATH/.claude/agents/${ENTRY_NAME[$i]}.md"
      agents_installed=$((agents_installed + 1))
      installed_lines="${installed_lines}  agent    ${ENTRY_NAME[$i]}
"
      ;;
    command)
      install_path "${ENTRY_SRC[$i]}" "$TARGET_PATH/.claude/commands/${ENTRY_NAME[$i]}.md"
      commands_installed=$((commands_installed + 1))
      installed_lines="${installed_lines}  command  /${ENTRY_NAME[$i]}
"
      ;;
    settings)
      settings_target="$TARGET_PATH/.claude/settings.json"
      if [ -f "$settings_target" ]; then
        settings_result="skipped — $settings_target already exists (merge manually if desired)"
      else
        cp "${ENTRY_SRC[$i]}" "$settings_target"
        settings_result="wrote $settings_target (agent teams + auto memory enabled)"
      fi
      ;;
  esac
done

total=$((skills_installed + agents_installed + commands_installed))
echo
if [ "$total" -eq 0 ] && [ -z "$settings_result" ]; then
  echo "Nothing selected. No changes made."
  exit 0
fi

echo "Installed into $TARGET_PATH/.claude (mode: $MODE):"
echo "  skills:   $skills_installed"
echo "  agents:   $agents_installed"
echo "  commands: $commands_installed"
if [ -n "$settings_result" ]; then
  echo "  settings: $settings_result"
fi
if [ -n "$installed_lines" ]; then
  echo
  printf "%s" "$installed_lines"
fi
echo
echo "Restart Claude Code in that project to pick up changes."
