# team-claude-skills

Shared Claude Code presets for the Neolink team — skills, subagents, slash commands, hooks, and settings.

## Install

```bash
git clone <repo-url> ~/neolink/team-claude-skills
cd ~/neolink/team-claude-skills

# --- bulk install into ~/.claude or ./.claude ---
./install.sh                              # user scope (default)
./install.sh project                      # project scope
./install.sh user --copy                  # copy instead of symlink

# --- cherry-pick per project (CLI) ---
./install-project.sh <path>               # interactive picker with stack detection
./install-project.sh <path> --yes         # accept detected selection, no prompts
./install-project.sh <path> --all         # install every skill & agent
./install-project.sh <path> --with-settings  # also write .claude/settings.json

# --- cherry-pick per project (browser UI) ---
node tools/skill-manager/server.js        # then open http://localhost:4599
```

`install-project.sh` picks skills, subagents, and (optionally) a `settings.json` fragment based on the target's `package.json` and marker files. The settings fragment enables [Agent Teams](https://code.claude.com/docs/en/agent-teams) (experimental) and [Auto Memory](https://code.claude.com/docs/en/memory#auto-memory), so you can run backend and frontend teammates in parallel and let Claude accumulate project learnings across sessions.

Symlink mode is the default. Once installed, a `git pull` in this repo updates everyone's Claude Code — no reinstall needed.

Restart Claude Code (or open a new session) to pick up newly installed skills.

**For day-to-day usage on projects, troubleshooting, and per-project customisation, read [`USAGE.md`](./USAGE.md).**

## Stack this repo targets

- **Backend** — NX monorepo, Fastify gateway + service pattern with `@fastify/autoload` + `fastify-plugin`, tRPC, Zod (+ `@sinclair/typemap`), `@neolinkrnd/fastify-bundle-*` house bundles, structured logging + Prometheus observability.
- **Frontend** — NX monorepo, Angular 21 (standalone + signals + new control flow), Angular Material 3, Tailwind, Vitest, Playwright, tRPC client. App-first layout (`data-access`, `feat-*`, `ui-*`, `util` inside each app).
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
| `tools/skill-manager/` | Local browser UI for assigning skills/agents to projects (Node, zero deps) |
| `USAGE.md` | How engineers adopt and use these presets on their projects |
| `CLAUDE.md` | Conventions for Claude when editing this repo |
| `install.sh` / `install-project.sh` | CLI installers |

Categories under `skills/`: `backend`, `frontend`, `devops`, `shared`, `docs` (Office-file skills). Under `agents/`: `backend`, `frontend`, `shared`, `devops`. Under `commands/`: `backend`, `frontend`, `shared`.

## Contribute

1. Copy the matching template from `templates/` into the right category folder.
2. Fill in the frontmatter — especially `description`, which is how Claude decides when to trigger the entry. Be specific.
3. Run `./install.sh` and test it in Claude Code.
4. Open a PR.

See `CLAUDE.md` for detailed conventions. That file is also loaded automatically by Claude Code when working in this repo, so future edits stay consistent.
