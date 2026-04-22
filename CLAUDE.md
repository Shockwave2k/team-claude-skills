# CLAUDE.md

Instructions for Claude when editing this repo. This file is loaded automatically into every Claude Code session in this working directory — treat it as the source of truth for conventions.

## What this repo is

Shared Claude Code presets for the Neolink team: skills, subagents, slash commands, hooks, and settings. Consumers install entries into their own Claude Code config via `install.sh`. `README.md` is the entry point; `USAGE.md` is the day-to-day guide for engineers using the presets on projects.

## The stack these presets target

Skills here should assume and reinforce this stack. If a user asks for something outside it, ask before encoding a new opinion.

- **Backend** — NX monorepo, Fastify 5 (`@fastify/autoload`, `@fastify/sensible`, `fastify-plugin`), tRPC v11, Zod validated via `@sinclair/typemap` at Fastify boundaries, Mongoose (MongoDB) and `mssql` (SQL Server), secrets via `node-vault`. House bundles: `@neolinkrnd/fastify-bundle-{default-controller,error-handler,schema-builder,status-code}` — prefer these over hand-rolled equivalents. Tests: Jest + `@swc-node/register`.
- **Frontend** — NX monorepo, Angular 19 (standalone components, signals, `@if`/`@for`/`@switch`, `inject()`, OnPush), Angular Material + CDK, Tailwind 3 with `prettier-plugin-tailwindcss`. tRPC v11 client imports `AppRouter` as a type only. Tests: Vitest via `@analogjs/vitest-angular`, Playwright for E2E.
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

- `backend/fastify-trpc-service` — Fastify routes + tRPC procedures, autoload layout, typemap, house bundles.
- `backend/fastify-plugin` — when to wrap with `fastify-plugin`, decorator typing, dep ordering.
- `frontend/angular-19-component` — standalone / signals / new control flow / Material + Tailwind rules.
- `frontend/nx-angular-library` — library types (feature/ui/data-access/util), scope tags, boundary rules.
- `shared/zod-schema` — schema location, input vs output, strictness, Zod→JSON Schema via typemap.
- `devops/argocd-k8s-deploy` — GitOps flow, image-tag bump, promotion, rollback, no-`kubectl-apply` rule.
- `skills/example-skill/` — placeholder reference. Do not delete.

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
- `install-project.sh` is interactive by default, non-interactive with `--yes` / `--all` / `--skill=`. Detection reads only from `$TARGET_PATH` — never from this repo, never from `destroy/`, never from `~`. When you add a new skill that maps to a detectable signal, extend the detection block (search for the `if [ "$NO_SUGGEST" -eq 0 ]` guard) with a new `flag_skill <name> <reason>` call.
- Detection helpers already available: `have_dep_literal`, `have_dep_prefix`, `has_file`, `has_dir`, `has_file_glob`. Prefer those over inline `grep`/`test` so rules stay consistent.

## Testing the detector after changes

Construct fake project trees in a temp dir and run `install-project.sh <tmp> --yes`. A minimal smoke sweep:

- **Backend fixture**: a `package.json` with `fastify`, `@trpc/server`, `@neolinkrnd/fastify-bundle-*`, `zod`, and a `Dockerfile`. Expect: both fastify skills, `argocd-k8s-deploy`, `zod-schema`.
- **Frontend fixture**: a `package.json` with `@angular/core`, `@nx/angular`, `@trpc/server` (!) and `zod`. Expect: both angular skills, `zod-schema`. Must NOT select backend skills despite `@trpc/server` — that's the key regression to catch.
- **Infra fixture**: no `package.json`, just `Chart.yaml` or `k8s/`. Expect: `argocd-k8s-deploy` only.
- **Empty fixture**: empty dir. Expect: "Nothing selected."

## When the user asks to add X

The user will typically say something like "add a skill for writing Rails migrations" or "add a subagent for reviewing Go PRs". Your default sequence:

1. Confirm the category (ask if ambiguous).
2. Check the "Skills that already exist" list above — if something close exists, extend it instead of adding a sibling.
3. Read the right template.
4. Write the new file at the right path. Descriptions must be specific "Use when…" sentences; generic ones are worse than nothing because they make existing skills less discoverable.
5. If the new entry names a file, function, or flag from the stack, verify it against the real package (`destroy/package-*.json` has representative dependency snapshots while this repo is young).
6. Update the "Skills that already exist" list above and the one in `USAGE.md`.
7. Update `README.md` only if you added a new category.
8. Run `./install.sh` and confirm the count increased as expected.
9. Suggest a git commit message — do not commit unless asked.
