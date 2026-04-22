# Slash commands

Custom slash commands, organized by domain (`backend/`, `frontend/`, `shared/`, etc.). Each command is a single `.md` file with YAML frontmatter; the filename (minus `.md`) becomes the slash command name.

Start from `templates/COMMAND.template.md`. Names must be unique across all categories — the installer flattens them into `~/.claude/commands/`.
