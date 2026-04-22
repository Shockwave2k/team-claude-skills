# team-claude-skills

Shared Claude Code presets for the Neolink team — skills, subagents, slash commands, hooks, and settings.

## Install

```bash
git clone <repo-url> ~/neolink/team-claude-skills
cd ~/neolink/team-claude-skills
./install.sh                              # user scope: everything into ~/.claude (default)
./install.sh project                      # project scope: everything into ./.claude
./install.sh user --copy                  # copy files instead of symlinking

./install-project.sh <path>               # interactive per-project picker with stack detection
./install-project.sh <path> --yes         # accept detected skills, no prompts
./install-project.sh <path> --all         # install every skill into that project
```

Use `install.sh` for the "give me everything" case, and `install-project.sh` to cherry-pick skills into a specific repo based on its `package.json` (detects Fastify, tRPC, Angular, Zod, Dockerfile, `@neolinkrnd/*`, etc.).

Symlink mode is the default. Once installed, a `git pull` in this repo updates everyone's Claude Code — no reinstall needed.

Restart Claude Code (or open a new session) to pick up newly installed skills.

**For day-to-day usage on projects, troubleshooting, and per-project customisation, read [`USAGE.md`](./USAGE.md).**

## Stack this repo targets

- **Backend** — NX monorepo, Fastify 5 + `@fastify/autoload`, tRPC v11, Zod (+ `@sinclair/typemap`), Mongoose / `mssql`, Vault, the house `@neolinkrnd/fastify-bundle-*` plugins.
- **Frontend** — NX monorepo, Angular 19 (standalone + signals + new control flow), Angular Material, Tailwind, Vitest, Playwright, tRPC client.
- **Platform** — Kubernetes on Digital Ocean, deployed via ArgoCD watching a manifests repo (GitOps).

## Layout

| Path | Contents |
|------|----------|
| `skills/<category>/<name>/SKILL.md` | Claude Skills, organized by domain |
| `agents/<category>/<name>.md` | Custom subagents |
| `commands/<category>/<name>.md` | Slash commands |
| `hooks/` | Shell scripts referenced by `settings.json` hooks |
| `settings/` | Shared `settings.json` fragments |
| `templates/` | Starter templates for new skills/agents/commands |
| `USAGE.md` | How engineers adopt and use these presets on their projects |
| `CLAUDE.md` | Conventions for Claude when editing this repo |
| `install.sh` | Installer |

Categories under `skills/`, `agents/`, `commands/`: `backend`, `frontend`, `mobile`, `devops`, `data`, `shared`. `shared` is for anything cross-cutting.

## Contribute

1. Copy the matching template from `templates/` into the right category folder.
2. Fill in the frontmatter — especially `description`, which is how Claude decides when to trigger the entry. Be specific.
3. Run `./install.sh` and test it in Claude Code.
4. Open a PR.

See `CLAUDE.md` for detailed conventions. That file is also loaded automatically by Claude Code when working in this repo, so future edits stay consistent.
