# CLAUDE.md

Instructions for Claude when editing this repo. This file is loaded automatically into every Claude Code session in this working directory — treat it as the source of truth for conventions.

## What this repo is

Shared Claude Code presets for the Neolink team: skills, subagents, slash commands, hooks, and settings. Consumers install entries into their own Claude Code config via `install.sh`. `README.md` is the entry point; `USAGE.md` is the day-to-day guide for engineers using the presets on projects.

## The stack these presets target

Skills here should assume and reinforce this stack. If a user asks for something outside it, ask before encoding a new opinion.

- **Backend** — NX monorepo, Fastify gateway pattern with `@fastify/autoload`, `fastify-plugin`, tRPC, Zod via `@sinclair/typemap` at Fastify boundaries. The Neolink gateway-service generator produces controller + route boilerplate; observability (structured logs, Prometheus metrics, request tracing) is layered by `neolink-gateway-setup`. OpenAPI + Bruno collections by `api-spec-generator`. House bundles: `@neolinkrnd/fastify-bundle-*`.
- **Frontend** — NX monorepo, Angular 21 (standalone components, signals, `@if`/`@for`/`@switch`, `inject()`, OnPush), Angular Material 3 + CDK, Tailwind with `prettier-plugin-tailwindcss`. tRPC client imports `AppRouter` as a type only. Tests: Vitest. App-first layout (`data-access`, `feat-*`, `ui-*`, `util` inside each app) — not the classic NX library-per-concern split. The portal-* repos (`portal-example`, `portal-neolink`, `portal-hive`) have additional Material 3 showcase conventions.
- **Platform** — Kubernetes on Digital Ocean (DOKS). ArgoCD watches a separate manifests repo; deploys happen by committing image-tag bumps to that repo. Never `kubectl apply` — ArgoCD reverts drift.

## Layout

- `skills/<category>/<skill-name>/SKILL.md` — Claude Skills. Categories: `backend`, `frontend`, `mobile`, `devops`, `data`, `shared`.
- `agents/<category>/<name>.md` — custom subagents.
- `commands/<category>/<name>.md` — slash commands.
- `hooks/*.sh` — shell scripts referenced by `settings.json` hooks.
- `settings/` — shared `settings.json` fragments.
- `templates/` — starter templates. Never installed, never renamed to look like real entries.
- `install.sh` — bulk installer. Symlinks (or copies) everything into `~/.claude` or `./.claude`.
- `install-project.sh` — interactive per-project installer. Detects the stack from `<target>/package.json` and preselects relevant skills. Detection rules live inside the script (search for `flag_skill`) — update them whenever you add a new skill that maps to a detectable dependency or marker file.

## Skills that already exist (don't duplicate, prefer editing)

Backend:
- `backend/neolink-fastify-gateway-generator` — scaffolds Fastify gateway controllers + route registration for `neolink-logistic` gateway-service.
- `backend/neolink-gateway-setup` — production observability for API gateways: structured logging with request-body capture, Prometheus metrics, request tracing, enhanced errors.
- `backend/api-spec-generator` — detects API changes and generates/updates OpenAPI 3.0+ specs and Bruno collections (tRPC / REST / GraphQL).

Frontend:
- `frontend/angular-nx-architect` — app-first NX Angular 21 structure: `data-access`, `feat-*`, `ui-*`, `util` folders inside each app.
- `frontend/angular-neolink-template` — Material 3 showcase conventions specific to `portal-example`, `portal-neolink`, `portal-hive`. Triggers on paths under `apps/portal-*/src/app/pages/mat3/`.
- `frontend/angular-unit-test` — Angular 21 unit tests with Vitest (jsdom). TestBed, ComponentFixture, mocking patterns.

Shared:
- `shared/zod-schema` — schema location, input vs output, strictness, Zod→JSON Schema via typemap.
- `shared/agent-teams` — when to spawn an agent team, which subagents to use as teammates, canonical spawn prompts.
- `shared/team-lead` — runtime conventions for the session that IS the team lead (how to spawn, wait, synthesize, clean up).
- `shared/code-memory-updater` — records patterns, conventions, architectural decisions into `CLAUDE.md` after significant changes.
- `shared/consolidate-memory` — reflective pass over auto-memory: merge duplicates, fix stale facts, prune the index.
- `shared/skill-creator` — create, edit, eval, and benchmark skills (ships with `analyzer`, `comparator`, `grader` sub-agents + Python eval scripts).
- `shared/schedule` — create a reusable self-contained prompt that runs on demand or on an interval.
- `shared/setup-cowork` — guided Cowork setup flow (role → plugin → skill → connectors).

DevOps:
- `devops/argocd-k8s-deploy` — GitOps flow, image-tag bump, promotion, rollback, no-`kubectl-apply` rule.

Document formats (user-triggered, not preselected by stack detection):
- `docs/docx`, `docs/pdf`, `docs/pptx`, `docs/xlsx` — Anthropic-provided skills for creating/editing Office files. Each ships with Python scripts and an Anthropic `LICENSE.txt` — preserve the license file as-is.

## Subagents that already exist (don't duplicate, prefer editing)

Every subagent here is installable as a plain subagent AND usable as a teammate in an agent team.

- `agents/backend/backend-implementer.md` — hands-on Fastify + tRPC implementer.
- `agents/frontend/frontend-implementer.md` — hands-on Angular 19 implementer.
- `agents/shared/schema-owner.md` — owns shared Zod schemas under `libs/shared/*/util/schemas/`.
- `agents/shared/reviewer.md` — PR reviewer; gets assigned a lens at spawn (security, performance, coverage, conventions, deploy-safety).
- `agents/devops/deploy-captain.md` — deploy / promote / rollback through the ArgoCD flow; never imperatively mutates the cluster.

## Settings fragments

- `settings/recommended.json` — enables `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and `autoMemoryEnabled`. Written to `<target>/.claude/settings.json` by `install-project.sh --with-settings` (or via the interactive menu's "enable agent teams + auto memory" entry), but only if the target has no existing `settings.json`.
- `settings/agent-teams.json` — just the agent teams env flag, for teams that manage memory differently.

Do not write settings to `~/.claude/settings.json` from the installer — user-scope settings belong to the user, not the team presets.

## Where does the "team lead" live?

Agent Teams have no dedicated lead subagent — the lead is the Claude Code session the user started in their terminal. What lives in this repo is the **conventions the lead follows**, which are in `skills/shared/team-lead/SKILL.md`. It's a regular skill, auto-loaded when relevant. The installer flags it for full-stack targets (same trigger as `agent-teams`), so any project that gets the agent-teams skill also gets the team-lead skill.

Do not create `agents/shared/team-lead.md`. Spawning the lead as a teammate contradicts the Claude Code model.

## `tools/` — auxiliary tools shipped with this repo

- `tools/skill-manager/` — local browser UI for managing per-project installations. Zero npm deps, stock Node 18+. When the install semantics in `install-project.sh` change (new detection signal, new kind of entry), update the Node app's equivalent logic in `tools/skill-manager/server.js` — the two must stay in sync.
- Known divergence: the web UI offers **independent** `agent teams` and `auto memory` settings toggles and **merges** them into any existing `settings.json` (only the two keys we own are touched; others preserved; toggling both off deletes the file). `install-project.sh --with-settings` still writes the combined `settings/recommended.json` fragment in one shot and skips if the file already exists. The shell flag is coarse by design (one-shot CLI use); the web UI is granular because it's interactive. Don't try to unify them — if a CLI user wants independent control today, they edit `.claude/settings.json` by hand.
- API surface worth remembering when editing the server: `GET /api/catalog`, `GET /api/projects`, `POST /api/projects`, `DELETE /api/projects/:i`, `GET /api/projects/:i/status`, `POST /api/projects/:i/apply` (body `{ skills, agents, settings: { agentTeams, autoMemory } }`), `GET /api/fs?path=…` (browse; hides dotfiles; returns `projectLike` hint per subdir).
- Any future tool goes under `tools/<name>/`. Keep each tool self-contained; do not cross-import between tools.

## Adding a skill

1. Pick the right category under `skills/`. If none fits, ask the user before inventing a new one.
2. Copy `templates/SKILL.template.md` to `skills/<category>/<skill-name>/SKILL.md`.
3. Frontmatter:
   - `name` — must match the directory name exactly.
   - `description` — precise "Use when…" sentence. Claude reads this to decide whether to trigger the skill, so vague descriptions mean the skill never fires.
4. Keep the body short and actionable. Front-load the instructions — readers scan.

## Adding a subagent

1. Copy `templates/AGENT.template.md` to `agents/<category>/<name>.md`.
2. Frontmatter: `name` (matches filename), `description`, optional `model` (`sonnet` | `opus` | `haiku`), optional `tools`.
3. Body is the system prompt for the subagent.

## Adding a slash command

1. Copy `templates/COMMAND.template.md` to `commands/<category>/<name>.md`.
2. Frontmatter: `description`, optional `argument-hint`.
3. Body is the prompt template. Use `$ARGUMENTS` to interpolate user-provided args.

## Rules

- `name` in frontmatter must match the filename (minus `.md`) or the skill directory name. The installer flattens everything into one namespace per type, so **names must be unique across categories**. Collisions are silently overwritten in the order `find` visits them.
- Do not add emojis unless the user explicitly asks.
- Do not delete `skills/example-skill/` — kept as a reference for contributors.
- Do not commit secrets, API keys, internal hostnames, or customer data.
- Prefer editing existing entries over creating new ones.
- When adding a new category, update the list here AND in `README.md`.

## Editing `install.sh` and `install-project.sh`

- Must work on macOS stock `bash 3.2` and modern Linux `bash`. No `declare -A`, no process substitution into read-from-array patterns that rely on bash 4+. Use `<<EOF $(...)` heredocs for piping `find` output into `while IFS= read` loops — that's the pattern already established.
- Run `bash -n <script>` after every edit as a syntax check.
- `install.sh` must stay idempotent and non-interactive. Flags only.
- `install-project.sh` is interactive by default, non-interactive with `--yes` / `--all` / `--skill=` / `--agent=` / `--with-settings`. Detection reads only from `$TARGET_PATH` — never from this repo, never from `~`.
- Entry types managed by a single array family (`ENTRY_KIND`, `ENTRY_NAME`, `ENTRY_SRC`, `ENTRY_CATEGORY`, `ENTRY_SELECTED`, `ENTRY_DETECTED`). `ENTRY_KIND` is `skill` | `agent` | `settings`. Adding new entries means appending to the arrays during discovery.
- When you add a new skill or agent that maps to a detectable signal, extend the detection block (search for the `if [ "$NO_SUGGEST" -eq 0 ]` guard) with a new `flag_entry <kind> <name> <reason>` call. Do not duplicate helpers — use `have_dep_literal`, `have_dep_prefix`, `has_file`, `has_dir`, `has_file_glob`.
- **Mirror detection changes in `tools/skill-manager/server.js`** (the `detectStack` function). It's intentionally a hand-maintained parallel implementation — there's no shared source of truth. When you add a new signal, add it in both places and verify with `node -c tools/skill-manager/server.js` plus a quick curl-driven end-to-end.
- `set -e` footgun: functions that end on a `&& <cmd>` chain where the test can fail will cause the script to exit when called from a `then` body. Always end helpers with an explicit `return 0`. `flag_entry` and `force_select` already follow this pattern — keep it.
- The settings pseudo-entry is special: it never symlinks. It writes `settings/recommended.json` to `<target>/.claude/settings.json` only if that file doesn't exist. Do not add logic that mutates an existing `settings.json` without the user's explicit ask — JSON merge in bash is unsafe.

## Testing the detector after changes

Construct fake project trees in a temp dir and run `install-project.sh <tmp> --yes`. A minimal smoke sweep:

- **Backend fixture**: a `package.json` with `fastify`, `@trpc/server`, `@neolinkrnd/fastify-bundle-*`, `zod`, and a `Dockerfile`. Expect: both fastify skills, `argocd-k8s-deploy`, `zod-schema`.
- **Frontend fixture**: a `package.json` with `@angular/core`, `@nx/angular`, `@trpc/server` (!) and `zod`. Expect: both angular skills, `zod-schema`. Must NOT select backend skills despite `@trpc/server` — that's the key regression to catch.
- **Infra fixture**: no `package.json`, just `Chart.yaml` or `k8s/`. Expect: `argocd-k8s-deploy` only.
- **Empty fixture**: empty dir. Expect: "Nothing selected."

## When the user asks to add X

Typical requests: "add a skill for writing Rails migrations", "add a subagent for Go PRs", "add an agent team role for QA". Default sequence:

1. Decide the type: skill (auto-triggered knowledge), subagent (delegatable worker, usable standalone or as teammate), or settings fragment.
2. Pick the category under `skills/<cat>/` or `agents/<cat>/`. Ask if ambiguous.
3. Check the inventory above — if something close exists, extend it instead of adding a sibling.
4. Start from the matching template. Descriptions must be specific "Use when…" sentences.
5. If the new entry maps to a detectable signal (dependency, marker file), extend the detection block in `install-project.sh` — otherwise users have to force-include it via `--skill=` / `--agent=`.
6. Update the inventory list in this file AND in `USAGE.md`. Update `README.md` only if you added a new category.
7. Run `./install.sh` and `./install-project.sh <tmp> --all` against a scratch dir to confirm counts increase as expected.
8. Suggest a git commit message — do not commit unless asked.

## The `destroy/` directory

`destroy/` holds two historical `package-*.json` files the user put there as reference dependency snapshots. The installers never read from `destroy/` — detection is scoped to the target project only. Don't reference `destroy/` as a source of truth for current stack details; read the actual files in the target repo instead. The user may delete `destroy/` at any time; keep your work independent of it.
