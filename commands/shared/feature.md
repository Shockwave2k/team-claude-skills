---
description: Start a new feature — refine the spec first, then spawn an agent team to build it.
argument-hint: <short feature description>
---

The user has started a new feature via /feature:

$ARGUMENTS

This command enforces a strict two-phase workflow. Do NOT skip phase 1.

## Phase 1 — Refinement (no code, no team spawn yet)

Goal: produce a concrete, testable spec before any implementation. The spec becomes the source of truth that every teammate works from in phase 2.

1. Restate the feature in one sentence. Confirm with the user.
2. Ask structured questions to fill in each section below. Push back on vague answers — "let's decide that now, it'll come up during the build."
   - **Goal & users** — what problem does this solve? who's it for?
   - **Data model** — entities, fields, types, relationships. Zod schema sketches where helpful.
   - **Contracts** — tRPC procedures, HTTP routes, shared schemas. Inputs and outputs for each.
   - **Integrations** — existing domains, services, external APIs that this touches.
   - **Edge cases** — failure modes, concurrent access, stale data, auth, rate limits.
   - **Out of scope** — explicit list of what you're NOT doing.
   - **Acceptance** — how do we know it's done? what tests prove it?
3. When every section has a concrete answer, write the spec to:
   `.claude/features/<slug>/spec.md`
   where `<slug>` is a kebab-case identifier derived from the feature name.
4. Show the user the spec and ask: "ready to spawn the team?" Wait for explicit confirmation before Phase 2.

## Phase 2 — Team spawn (only after the user confirms the spec)

5. Propose team composition based on what the spec touches:
   - `schema-owner` if shared Zod schemas are added/changed
   - `backend-implementer` if Fastify routes / tRPC procedures / backend code changes
   - `frontend-implementer` if Angular code changes
   - `deploy-captain` if a deploy is part of completion
   - `reviewer` — opt-in; spawn 2–3 with different lenses for a review pass after implementation
6. Confirm the composition with the user.
7. Spawn the team per the `agent-teams` skill's canonical prompts. Pass the spec file path to each teammate in its spawn prompt so they all work from the same source of truth.
8. Require plan approval before implementers make changes.
9. Coordinate per the `team-lead` skill. When all teammates report idle and the task list is complete, synthesize the outcome, then clean up the team.

## Phase 3 — Outcome recording (after team cleanup)

10. Invoke the `feature-outcome` skill with the feature slug. This:
    - Reads the spec, diffs the feature branch, and writes `.claude/features/<slug>/outcome.md`
    - Patches `.claude/rules/*.md` files for every module the feature touched so new public APIs, schemas, and connection points surface automatically to future sessions
    - Prepends a one-line entry to `.claude/CLAUDE.md` "Features delivered"
11. **If the feature added or changed backend API surface** (new tRPC procedures, new Fastify routes, new GraphQL resolvers), immediately invoke the `api-spec-generator` skill afterwards. This regenerates or updates `openapi.yaml` and Bruno (`.bru`) collection files so API docs stay in sync with the code that just landed. Skip this only if the feature was purely frontend / config / docs.
12. Show the user the outcome report, any rules-file patches, and the API spec diff. This is what keeps the project brain — and the API docs — from drifting.

**Do not skip Phase 3.** The purpose is institutional memory + living API docs — if you skip it, future features rediscover the same wiring by trial and error, and Bruno/OpenAPI rot.

If `.claude/rules/` doesn't exist yet in this project, tell the user to run the `codebase-scan` skill first to establish the brain, then re-invoke `feature-outcome` once that's done.

## Hard rules

- NO implementation code during Phase 1.
- NO team spawn during Phase 1.
- NO skipping the spec file — it's the team's source of truth in Phase 2.
- NO skipping Phase 3 — institutional memory is the whole point of this workflow.
- If the user says "just build it" or tries to skip refinement, point them back to this workflow and ask for the missing info.
- If the user wants to change the spec mid-build, pause the team, update `spec.md`, then resume.
