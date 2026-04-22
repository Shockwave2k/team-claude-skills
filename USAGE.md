# Usage guide

How to adopt and get value out of `team-claude-skills` on your projects.

## Who this is for

Every engineer at Neolink who uses Claude Code. The goal of this repo is that Claude already knows our stack (Fastify + tRPC on the backend, Angular 19 on the frontend, Kubernetes + ArgoCD for delivery) and our house conventions the first time you open a new repo.

## Installing

Two installers. Pick based on what you want:

| What you want | Command | Notes |
|---------------|---------|-------|
| Every team skill available globally | `./install.sh` | Symlinks into `~/.claude/{skills,agents,commands}`. Fire-and-forget. |
| Every team skill scoped to one repo | `./install.sh project` (run *inside* the repo) | Symlinks into `<repo>/.claude/`. Overrides user-scope entries of the same name. |
| **Cherry-pick skills for a specific project** | `./install-project.sh <path>` | Interactive menu. Detects the stack from `<path>/package.json` and preselects relevant skills. |
| Accept what the detector picked | `./install-project.sh <path> --yes` | No prompts. Great for fresh clones. |
| Everything into one project | `./install-project.sh <path> --all` | Equivalent to `install.sh project` run inside `<path>`. |
| Copy instead of symlink | add `--copy` to any of the above | Snapshot, no live updates on `git pull`. Rare; prefer symlinks. |

Start with `./install.sh` for your machine. Use `install-project.sh` when a repo has a focused stack (frontend-only, infra-only, …) and you'd rather not see irrelevant backend skills in that project's Claude.

```bash
git clone <repo-url> ~/neolink/team-claude-skills
cd ~/neolink/team-claude-skills
./install.sh
# later
cd ~/neolink/team-claude-skills && git pull   # everyone gets updates instantly
```

### Detection heuristics (`install-project.sh`)

The picker reads files **only from the target project** — its `package.json` and a few root-level marker files/directories. It never inspects this repo, your home dir, or anywhere else.

**Backend — Fastify + tRPC** (triggers `fastify-trpc-service`, `fastify-plugin`)

| Signal | Source |
|--------|--------|
| `fastify` dep | `package.json` |
| `@fastify/autoload` dep | `package.json` |
| `fastify-plugin` dep | `package.json` |
| any `@neolinkrnd/fastify-bundle-*` dep | `package.json` (strong — Neolink backend) |
| `@trpc/server` dep (only strengthens if backend already detected) | `package.json` |
| `@sinclair/typemap` dep (only if backend) | `package.json` |
| `@nx/node` dev dep (only if backend) | `package.json` |

**Frontend — Angular 19** (triggers `angular-19-component`, `nx-angular-library`)

| Signal | Source |
|--------|--------|
| `@angular/core` dep | `package.json` |
| `angular.json` | root file |
| `@nx/angular` dep | `package.json` |
| `@angular/material`, `tailwindcss` deps (strengthen) | `package.json` |
| `tailwind.config.*`, `vitest.config.*`, `playwright.config.*` (strengthen) | root files |
| `@analogjs/vitest-angular` dep (strengthen) | `package.json` |

**Shared** (triggers `zod-schema`)

| Signal | Source |
|--------|--------|
| `zod` dep | `package.json` |
| `@sinclair/typemap` dep | `package.json` |

**DevOps — ArgoCD + Kubernetes** (triggers `argocd-k8s-deploy`)

| Signal | Source |
|--------|--------|
| `Dockerfile`, `Dockerfile.prod`, `Dockerfile.dev` | root file |
| `docker-compose.yml` / `.yaml`, `compose.yml` / `.yaml` | root file |
| `Chart.yaml`, `skaffold.yaml`, `kustomization.yaml` | root file |
| `k8s/`, `kubernetes/`, `manifests/`, `deploy/` | root dir |
| `helm/`, `charts/`, `argocd/`, `.argocd/` | root dir |
| any `@neolinkrnd/*` dep (Neolink service) | `package.json` |

**Key guardrail:** `@trpc/server` alone does **not** trigger backend skills — Angular monorepos legitimately import it for `AppRouter` type inference.

Multiple signals for the same skill stack up in the "# detected:" reason shown in the menu, giving you a quick confidence read on each preselection.

**Subagents (agents)** are discovered and preselected by the same signals:

| Signal class | Agent preselected |
|--------------|-------------------|
| Backend detected | `backend-implementer` |
| Frontend detected | `frontend-implementer` |
| DevOps marker detected | `deploy-captain` |
| Both backend AND frontend detected (full-stack monorepo) | `schema-owner` + the `agent-teams` skill |

`reviewer` is not preselected — it's an opt-in for code-review workflows. Toggle it in the menu or pass `--agent=reviewer` to force-include it.

## Agent Teams

The installer also optionally writes a project `.claude/settings.json` that enables [Claude Code's Agent Teams](https://code.claude.com/docs/en/agent-teams) — experimental parallel-Claude-Code-sessions coordinated via a shared task list. This lets you work on backend and frontend simultaneously, with a `backend-implementer` teammate and a `frontend-implementer` teammate in separate contexts, coordinating through the lead.

### Enabling

Two paths:

1. Run `./install-project.sh <path> --with-settings` (or toggle the "enable agent teams + auto memory" entry in the interactive menu). The installer writes `.claude/settings.json` only if one doesn't already exist. If one does, it prints a skip message and you merge manually — see `settings/README.md` for the exact keys.
2. Manually add to your `.claude/settings.json`:

    ```json
    {
      "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
      "autoMemoryEnabled": true
    }
    ```

Restart Claude Code after changing settings. Split-pane display needs `tmux` or iTerm2 with the `it2` CLI; in-process mode (Shift+Down to cycle teammates) works anywhere.

### When to spawn a team

The `agent-teams` skill (installed when the detector sees both backend and frontend signals) has the full playbook. In short:

- **Full-stack feature** — `backend-implementer` + `frontend-implementer` + `schema-owner`, coordinated by the lead.
- **Parallel code review** — 2–3 `reviewer` teammates with different lenses (security / performance / coverage) that challenge each other.
- **Bug with competing hypotheses** — multiple investigators that try to disprove each other's theories. Converges on the root cause faster than a single anchored agent.

Example spawn prompt for a full-stack feature:

    Create an agent team to add the "Shipment" domain:
    - schema-owner: add shared Shipment input/output schemas under libs/shared/logistics/util/schemas/.
    - backend-implementer: add the tRPC shipmentRouter with CRUD procedures.
    - frontend-implementer: add libs/portal/shipments/feature-list with a data-access store consuming the router.
    Require plan approval before the implementers make changes.

### Limits to know

- **One team per session.** Clean up (`Clean up the team`) before starting another.
- **No nested teams.** Teammates can't spawn sub-teams.
- **Higher token cost.** Each teammate is a separate Claude instance. Use for work that genuinely benefits from parallelism.
- **Session resume doesn't restore in-process teammates.** After `/resume`, tell the lead to respawn teammates.

## Auto Memory

Auto memory is Claude Code's mechanism for accumulating knowledge across sessions without you writing anything. It complements `CLAUDE.md` — where `CLAUDE.md` is what **you** tell Claude, auto memory is what **Claude notes for itself** based on corrections and patterns it sees during your work.

### How it works on Neolink projects

- **On by default** in Claude Code v2.1.59+. The installer writes `autoMemoryEnabled: true` into `.claude/settings.json` to make the intent explicit.
- **Per-project, machine-local**: notes live at `~/.claude/projects/<project>/memory/MEMORY.md` on your machine. Not shared via git; not shared across machines.
- **Loaded at session start**: the first 200 lines / 25 KB of `MEMORY.md` are read into every session. Claude moves deeper notes into topic files that it reads on demand.
- **You can audit it anytime** with `/memory` in a Claude Code session. It's all plain markdown — edit or delete as you like.

### Why it matters here

Work on Neolink spans services and is bursty — a tRPC refactor today, a deploy tomorrow, a bug triage next week. Auto memory captures things Claude learned the hard way ("this service uses the `mssql` driver, not Mongoose — we found out when the previous migration failed") so future sessions don't relearn the same lesson.

It's a safety net against context loss, not a replacement for `CLAUDE.md`. The division:

| Put it in… | When |
|------------|------|
| `CLAUDE.md` | Stable, repeatable rules you'd want every teammate to follow |
| Auto memory | Claude-discovered facts and preferences, especially machine-local ones you don't want in git |
| A skill in this repo | Multi-step workflows or conventions that apply across projects |

### Interaction with `CLAUDE.md`

Both are loaded at session start. When they conflict, Claude may pick either — keep `CLAUDE.md` authoritative and let auto memory be the "oh, also" layer. If you see auto memory drifting from team policy, open `/memory`, edit the offending note, and push the rule into `CLAUDE.md` or a skill so it travels via git.

### Turning it off

If you need to, set `"autoMemoryEnabled": false` in `.claude/settings.local.json` (so it's personal, not committed) or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` as an env var.

### Menu commands

- `1 3 5` — toggle entries 1, 3, 5 (space-separated numbers)
- `a` — select all, `n` — select none, `s` — select only detected entries
- `[Enter]` — install the current selection
- `q` — cancel without writing anything

## How a skill actually gets triggered

Claude decides to activate a skill based on its `description:` frontmatter, not by filename matching. The description is a sentence telling Claude **when** to use the skill. Two practical consequences:

1. **Vague descriptions mean the skill never fires.** "Helpful Angular skill" triggers nothing. "Use this when adding or modifying Angular 19 components" triggers on the first component task.
2. **Overlapping descriptions collide.** If two skills both match, Claude picks one — usually the one with the more specific description. Keep triggers disjoint.

You can see which skills matched in Claude Code's session log. If the right skill isn't firing, the description needs sharpening — open a PR.

## Using a team skill on a project

After install, just work normally. When you ask Claude something like *"add a tRPC router for the Shipments domain"*, Claude reads `fastify-trpc-service`, follows the conventions it encodes, and produces code that matches the rest of our codebase.

You don't need to `/invoke` anything. Skills auto-attach.

## Per-project customisation

Sometimes a project has quirks the team skill doesn't cover. Three escape hatches, in order of preference:

1. **Project-local `CLAUDE.md`** at the repo root. Claude Code loads it automatically. Put project-specific rules (env var names, non-standard paths, open migrations) there. This is the right place for stuff that would be wrong to merge into the team skill.
2. **Project-local skill** at `<repo>/.claude/skills/<name>/SKILL.md`. This shadows a team skill with the same name and takes precedence in that project. Use when an entire workflow differs.
3. **Fork and upstream.** If the project's convention is the better one, open a PR against this repo so the rest of the team gets it too.

Do not edit files under `~/.claude/skills/` that were installed as symlinks — you'll be editing the repo. Change them in the repo and commit.

## Writing project CLAUDE.md files that play well

When a project imports from this repo, its `CLAUDE.md` should be short and additive. Point at the skill you're leaning on; don't duplicate it.

    # CLAUDE.md (project-level)

    Stack: NX + Fastify + tRPC backend, see the team's `fastify-trpc-service` skill
    for house conventions. This repo adds:

    - Database: PostgreSQL (NOT the team default MongoDB). Mongoose is not installed.
    - Feature flags via LaunchDarkly; do not check env vars for flags.
    - All new routes go under `/api/v2/*` during the v1 deprecation.

## What lives here today

**Skills** (auto-triggered by description match):

- Backend: `fastify-trpc-service`, `fastify-plugin`
- Frontend: `angular-19-component`, `nx-angular-library`
- Shared: `zod-schema`, `agent-teams`
- DevOps: `argocd-k8s-deploy`
- Reference: `example-skill` (don't delete)

**Subagents** (delegatable workers; also usable as agent-team teammates):

- Backend: `backend-implementer`
- Frontend: `frontend-implementer`
- Shared: `schema-owner`, `reviewer`
- DevOps: `deploy-captain`

**Settings fragments** (optional, opt-in via `--with-settings`):

- `settings/recommended.json` — enables agent teams + explicit auto memory
- `settings/agent-teams.json` — agent teams only

Skill categories `mobile` and `data` are scaffolded empty — add when needed.

## Contributing back

1. Branch, copy the matching template from `templates/`.
2. Write the skill where a teammate would reach for a bullet list and think *"I wish Claude already knew this"* — that's the target.
3. Keep descriptions specific. Test locally by asking Claude a prompt the skill should match; confirm it attaches.
4. Run `./install.sh` — verify your new entry appears in the summary.
5. Open a PR.

See `CLAUDE.md` for the detailed conventions Claude follows when editing this repo.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Skill doesn't fire | Description too generic, or trigger doesn't match user's phrasing | Sharpen the description, include likely trigger phrases |
| Wrong skill fires | Two descriptions overlap | Differentiate them; make the less relevant one narrower |
| `./install.sh` reports 0 for a type | Wrong filename or directory layout | `SKILL.md` must be exact; agent/command files must be `*.md` directly under `agents/<cat>/` or `commands/<cat>/` |
| Install worked but Claude Code doesn't see the skill | Session started before install | Restart Claude Code or open a new session |
| Changes to a skill aren't picked up | Installed in `--copy` mode | Re-run `./install.sh` (or switch to symlink mode) |
