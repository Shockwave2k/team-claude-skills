---
name: codebase-scan
description: Use this when the user asks to scan, index, map, or "build the brain" for an existing codebase — or phrases like "document the structure", "catalog the services", "orient Claude to this repo". Produces `.claude/CLAUDE.md` (high-level architecture map) plus one path-scoped `.claude/rules/<module>.md` per service/app/lib so per-module knowledge auto-loads only when Claude edits files in that module. Works best on NX monorepos and service-oriented repos, but fine on anything with a recognisable structure. Run once per project; re-run after big restructures.
---

# Codebase scan — build the per-project brain

The goal is to produce a layered, path-scoped context map that loads intelligently:

- `.claude/CLAUDE.md` — always-loaded high-level map (<200 lines). Domain overview, module index, cross-cutting conventions.
- `.claude/rules/<module>.md` — loads only when Claude reads files matching `paths:`. Per-module deep knowledge (<150 lines each).

## Process

### Phase A — Discover

1. Identify the repo type. Signals: `nx.json`, `package.json` with `workspaces`, `apps/` + `libs/` dirs, a single `src/`, a mix of service dirs at root. Report what you found.
2. Enumerate modules:
   - NX: every `apps/*` and `libs/*/*` with a `project.json` or `package.json`.
   - Service-per-dir: every top-level dir with its own entry point.
   - Single app: the whole repo is one module.
3. Build the module list and show it to the user. Ask: "I'll scan these N modules; any you want to skip or add?"

### Phase B — Scan each module (parallelise with subagents for >3 modules)

For each module, read these files (whatever's present) and extract the signal:

- Entry points: `main.ts`, `index.ts`, `app.ts`, `bootstrap.ts`, the file referenced by `project.json#targets.serve.options.main`.
- Public API surface:
  - Backend: Fastify route registrations, tRPC routers, HTTP controllers.
  - Frontend: public exports from `index.ts`, component selectors.
  - Libs: named exports from the barrel file.
- Data stores: look for `Mongoose`, `mssql`, `Cassandra`, `Redis`, `Kafka` imports.
- External deps: services called via tRPC client, fetch URLs, message queues.
- Internal deps: which other `apps/*` or `libs/*` it imports.
- Tests: framework (`vitest`, `jest`), location pattern.

Summarise each module as a single `.claude/rules/<module>.md`:

    ---
    paths:
      - "<module-path>/**/*"
    ---

    # <module name>

    **Purpose.** One-to-two-sentence description of what this module does, written in the active voice ("Handles shipment lifecycle: create, update, track"). Avoid fluff.

    ## Public surface
    - List exported routes / procedures / components with file refs and I/O shapes where useful
    - For tRPC: name → input schema → output schema
    - For Fastify: method path → handler location

    ## Key files
    - `src/foo/bar.ts` — one-line description of what it owns
    - …

    ## Data
    - MSSQL table(s) touched: X, Y
    - Kafka topics: produced/consumed
    - Redis keys: namespaces

    ## Depends on
    - `libs/shared/util-types`
    - `iam-service` (JWT validation)

    ## Gotchas
    - Anything surprising a future contributor would want to know (concurrency, schema quirks, workarounds)

Keep each rules file **under 150 lines**. If a module is bigger than that, split: `shipment-service-repo.md` + `shipment-service-routes.md` + `shipment-service-kafka.md` each with a narrower `paths:` glob.

### Phase C — Write the overview

Assemble `.claude/CLAUDE.md` — the always-loaded map:

    # <Project name>

    **Stack.** One line. (e.g., "NX monorepo, Fastify 5 + tRPC v11, MSSQL + Cassandra + Redis + Kafka, deployed via ArgoCD.")

    **What this repo is.** One paragraph. What the whole system does, who uses it, the 2–3 most important invariants a contributor must know.

    ## Module index

    | Module | Type | Purpose | Rules file |
    |--------|------|---------|------------|
    | `gateway-service` | service | public REST gateway, auth, rate limiting | `.claude/rules/gateway-service.md` |
    | `shipment-service` | service | shipment domain: CRUD, tracking, Kafka events | `.claude/rules/shipment-service.md` |
    | … | | | |

    ## Cross-cutting conventions

    Only things that apply everywhere. Code style, commit format, deploy flow, naming. Keep this list short — 10 bullets max. Prefer linking to team skills (`fastify-trpc-service`, `angular-nx-architect`, etc.) over duplicating them here.

    ## Features delivered

    See `.claude/features/` for ADRs of shipped features. Most recent first:
    - (empty until the first feature lands via /feature)

Target: **<200 lines total** for `CLAUDE.md`. If you go over, move detail into a rules file.

### Phase D — Report

When done, print a summary:

- Number of rules files written
- Any modules that looked too big (>150 lines worth of brain) and were split
- Any modules where the public surface was unclear — flag these for the user to review
- Remind the user to carve out the brain files from `.claude/`'s gitignore so they get committed (see the team skills repo's README for the exact gitignore snippet)

## Rules

- **Read the actual code.** Do not invent conventions that aren't in the repo. A scan that hallucinates is worse than no scan.
- **Prefer concrete file references** over abstractions. "`src/lib/kafka-publisher.ts#publishShipmentEvent`" beats "a Kafka publishing abstraction exists somewhere."
- **Never auto-run migrations, generate code, or modify source files.** This skill is read-only on source; it only writes `.claude/`.
- **Parallelise with subagents** when scanning >3 modules. One subagent per module keeps each agent's context focused on that module.
- **If the existing `.claude/CLAUDE.md` exists**, do not clobber it — diff and propose merges, let the user approve before overwriting.
- **Keep rule bodies tight.** Every line should pay for itself. "See `foo.ts`" beats a five-line summary of what `foo.ts` does.

## Permission requirement

Claude Code treats `.claude/` as a sensitive path and blocks `Write` / `Edit` there even under `--dangerously-skip-permissions`. Before this skill can persist its output, the project must allow writes to the brain files. Put this in `.claude/settings.json` (committed) or `.claude/settings.local.json` (machine-local):

    {
      "permissions": {
        "allow": [
          "Write(./.claude/CLAUDE.md)",
          "Edit(./.claude/CLAUDE.md)",
          "Write(./.claude/rules/**)",
          "Edit(./.claude/rules/**)",
          "Write(./.claude/features/**)",
          "Edit(./.claude/features/**)"
        ]
      }
    }

The repo's `settings/recommended.json` includes these rules; `install-project.sh --with-settings` will write them for fresh projects. For projects that already have a committed `settings.json`, the `tools/rerun-feature.sh` script writes a `settings.local.json` with the rules before invoking the scan.

If you invoke this skill and all your drafts land "in context" but no files appear under `.claude/`, this is why — add the allow rules and retry.
