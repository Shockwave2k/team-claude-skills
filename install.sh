#!/usr/bin/env bash
# install.sh — install team Claude Code presets into ~/.claude or ./.claude
#
# Usage:
#   ./install.sh                   install at user scope (~/.claude), symlinked
#   ./install.sh project           install at project scope (./.claude), symlinked
#   ./install.sh user --copy       copy files instead of symlinking
#   ./install.sh --help

set -euo pipefail

SCOPE="user"
MODE="symlink"

usage() {
  cat <<'EOF'
Usage: install.sh [user|project] [--copy] [--help]

  user      install to $HOME/.claude  (default)
  project   install to $PWD/.claude
  --copy    copy files instead of symlinking (no live updates on 'git pull')
  --help    show this help

Installs:
  skills/**/SKILL.md    -> <target>/skills/<skill-name>/
  agents/**/*.md        -> <target>/agents/<name>.md
  commands/**/*.md      -> <target>/commands/<name>.md

Names must be unique per type — collisions are overwritten in 'find' order.
EOF
}

for arg in "$@"; do
  case "$arg" in
    user|project) SCOPE="$arg" ;;
    --copy)       MODE="copy" ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "install.sh: unknown arg '$arg'" >&2; usage >&2; exit 1 ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$SCOPE" = "user" ]; then
  TARGET="$HOME/.claude"
else
  TARGET="$(pwd)/.claude"
fi

mkdir -p "$TARGET/skills" "$TARGET/agents" "$TARGET/commands"

install_entry() {
  # $1 = source path (file or dir), $2 = destination path
  src="$1"
  dst="$2"
  if [ "$MODE" = "symlink" ]; then
    ln -snf "$src" "$dst"
  else
    rm -rf "$dst"
    if [ -d "$src" ]; then
      cp -R "$src" "$dst"
    else
      cp "$src" "$dst"
    fi
  fi
}

skills_count=0
agents_count=0
commands_count=0

# Skills: every directory containing a SKILL.md
if [ -d "$SOURCE_DIR/skills" ]; then
  while IFS= read -r skill_md; do
    [ -z "$skill_md" ] && continue
    skill_dir="$(dirname "$skill_md")"
    skill_name="$(basename "$skill_dir")"
    install_entry "$skill_dir" "$TARGET/skills/$skill_name"
    skills_count=$((skills_count + 1))
  done <<EOF
$(find "$SOURCE_DIR/skills" -type f -name SKILL.md 2>/dev/null)
EOF
fi

# Agents: *.md under agents/ except README.md
if [ -d "$SOURCE_DIR/agents" ]; then
  while IFS= read -r agent_md; do
    [ -z "$agent_md" ] && continue
    name="$(basename "$agent_md")"
    install_entry "$agent_md" "$TARGET/agents/$name"
    agents_count=$((agents_count + 1))
  done <<EOF
$(find "$SOURCE_DIR/agents" -type f -name "*.md" ! -iname "README.md" 2>/dev/null)
EOF
fi

# Commands: *.md under commands/ except README.md
if [ -d "$SOURCE_DIR/commands" ]; then
  while IFS= read -r cmd_md; do
    [ -z "$cmd_md" ] && continue
    name="$(basename "$cmd_md")"
    install_entry "$cmd_md" "$TARGET/commands/$name"
    commands_count=$((commands_count + 1))
  done <<EOF
$(find "$SOURCE_DIR/commands" -type f -name "*.md" ! -iname "README.md" 2>/dev/null)
EOF
fi

echo "Installed into $TARGET (mode: $MODE)"
echo "  skills:   $skills_count"
echo "  agents:   $agents_count"
echo "  commands: $commands_count"
echo
echo "Restart Claude Code (or start a new session) to pick up new skills."
