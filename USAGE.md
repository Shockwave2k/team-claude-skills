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

- Backend: `fastify-trpc-service`, `fastify-plugin`
- Frontend: `angular-19-component`, `nx-angular-library`
- Shared: `zod-schema`
- DevOps: `argocd-k8s-deploy`
- Example: `example-skill` (reference, don't delete)

Categories `mobile` and `data` are scaffolded empty — add when needed.

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
