---
name: feature-outcome
description: Use this at the END of a feature build (after the agent team cleans up) to record what actually landed and update the project brain. Writes `.claude/features/<slug>/outcome.md` from the spec + git diff, and patches affected `.claude/rules/*.md` files so new public APIs, schemas, and connection points surface automatically to future sessions. Invoked automatically as Phase 3 of the /feature command; can also be invoked on demand when a feature lands without /feature.
---

# Feature outcome — record what shipped, update the brain

Runs at the tail of a feature build. It answers two questions that otherwise get forgotten in a week:

- *What did we actually ship?* → `.claude/features/<slug>/outcome.md`
- *What parts of the brain are now stale?* → update the matching `.claude/rules/*.md` files

## Inputs

- Feature slug (from `.claude/features/<slug>/spec.md` — if only one spec folder exists, use that).
- Git range: the set of commits that implemented this feature. Figure out via one of:
  - The user tells you the branch or commit range.
  - Current branch vs. its merge base with `main` (most common).
  - If the branch has been merged already, the merge commit's parent vs. the merge.

## Process

### Phase A — Gather

1. Read `.claude/features/<slug>/spec.md`. Extract: goal, planned data model, planned contracts, acceptance criteria.
2. Determine the git range. Show the user what you detected and ask for confirmation if ambiguous.
3. Run `git diff --stat <range>` and `git log --oneline <range>` to see the shape of the change.
4. For each non-trivial file touched, read the new version and the diff to understand what changed.

### Phase B — Write outcome.md

`.claude/features/<slug>/outcome.md`:

    # Outcome: <Feature name>

    **Status.** Shipped / In staging / Reverted (whichever is true).
    **Commit range.** `<base>..<head>` (<N> commits).
    **Dates.** <first commit> → <last commit>.

    ## Goal (reminder from spec)

    One sentence, paraphrased from spec.md.

    ## What landed

    - `apps/shipment-service/src/app/routes/shipments.ts` — new POST /shipments endpoint, …
    - `apps/shipment-service/src/app/repo/shipment-repository.ts` — added `create`, `findById`, `listByOrg`
    - `libs/shared/shipment/util/schemas/shipment.ts` — new `ShipmentSchema`, `CreateShipmentInput`
    - (group sensibly; one line per file with the real change described)

    ## Public API / contracts added

    For each new public surface. Short, concrete.

    ### tRPC
    - `shipment.create` — input `CreateShipmentInput`, output `Shipment`. Requires auth.
    - `shipment.byId` — input `{ id: UUID }`, output `Shipment | null`.

    ### HTTP (gateway)
    - `POST /v1/shipments` — public, rate-limited.

    ### Events
    - Produces `shipment.created` on Kafka (payload: `{ id, orgId, createdAt }`).

    ## Schema / migration

    - New MSSQL table `Shipments(...)` — migration `20260423_add_shipments.sql`.
    - New shared Zod schema `ShipmentSchema` in `libs/shared/shipment/util`.

    ## Connection points for future features

    Short section listing things other features are likely to want to wire into:
    - Subscribe to `shipment.created` on Kafka instead of polling.
    - Call `shipment.byId` (tRPC) rather than re-reading the MSSQL table directly.

    ## Gotchas / follow-ups

    - Anything surprising: concurrency assumptions, missing edge cases, tech-debt IOUs, deferred items from the spec.

    ## Deviations from spec

    Anything in the spec that did NOT land, or landed differently. This is the record of what the team actually did, not what was planned.

### Phase C — Update affected rules files

For each `.claude/rules/<module>.md` whose `paths:` glob overlaps with files touched in the feature:

1. If the feature added to the module's public surface, update the **Public surface** section. Don't rewrite — patch.
2. If the feature added new data (tables, topics, keys), update the **Data** section.
3. If the feature added a new dependency on another module, update **Depends on**.
4. If a rules file doesn't exist yet for a module that got touched, propose creating one (point at `codebase-scan` to do a focused one-module scan).
5. Keep each rules file under 150 lines. If an update pushes it over, propose a split before writing.

### Phase D — Update the features index in `.claude/CLAUDE.md`

Prepend a one-line entry to the "Features delivered" list:

    - **<Feature name>** (2026-04-23) — one-line summary. See `.claude/features/<slug>/outcome.md`.

Trim the list to the most recent ~10. Older entries stay in `.claude/features/` but drop off the index.

### Phase E — Stale outcome detection (housekeeping)

After writing your own outcome, do a quick sanity check on older outcomes. The features folder is a decaying asset — without this check, it drifts into archaeology.

1. List every `.claude/features/*/outcome.md` file except the one you just wrote.
2. For each, extract all file paths referenced in the "What landed" and "Public API / contracts added" sections. Typical pattern: `` `apps/foo/src/bar.ts` `` or `apps/foo/src/bar.ts — ...`.
3. Check each referenced path against the current working tree with `test -f` (or `fs.existsSync` via Bash).
4. For each outcome, compute `broken_ratio = missing_files / total_refs`.
5. If `broken_ratio > 0.4` (more than 40% of referenced files are gone), the outcome is likely stale. Append an entry to `.claude/features/_stale.md` (create the file if missing):

        # Stale feature outcomes

        Auto-flagged by feature-outcome. These outcomes reference files that no longer exist — the feature has likely been refactored or replaced. Review and either update, archive to `.claude/features/_archive/`, or delete.

        ## 2026-04-24 — stale check

        - `features/user-import/outcome.md` — 7/10 refs missing (70%). Last updated 2025-09-12.
        - `features/legacy-auth/outcome.md` — 5/8 refs missing (62%). Last updated 2025-08-03.

6. Never auto-delete or auto-archive. The user decides. Your job is visibility.

Skip this phase entirely if:
- There are zero other outcomes in the folder (nothing to stale-check).
- The current run is restoring an outcome from an archive (not a real feature completion).

### Phase F — Report

Print a short summary to the user:

    Feature: shipment-creation
    Outcome:  .claude/features/shipment-creation/outcome.md  (written)
    Updated:  rules/shipment-service.md, rules/gateway-service.md
    Indexed:  added to .claude/CLAUDE.md "Features delivered"
    Skipped:  rules/iam-service.md (no overlap)
    Stale:    2 older outcomes flagged — see .claude/features/_stale.md

## Rules

- **Only document what's in the diff.** Don't invent. If the spec said "add rate limiting" but the diff doesn't touch rate limiting, it's a deviation — record it under "Deviations from spec", don't claim it shipped.
- **Concrete file refs, not narration.** Every "what landed" bullet should resolve to a file path a reader can open.
- **Additive patches to rules files.** Never rewrite a rules file wholesale — patch the sections that changed. This preserves hand-curated context the user added.
- **If the feature shipped without a spec.md**, still run. Derive the feature slug from the branch name or ask the user. Write outcome.md with "(no spec on record)" at the top.
- **Never run a migration, never deploy, never touch source code.** This skill is read-only on source; it only writes `.claude/`.
- **If /feature called this as Phase 3**, assume the user expects it to run unattended — only pause for ambiguous git ranges or rules-file size overages.

## Permission requirement

Same as `codebase-scan`: writes to `.claude/` are blocked unless the project's `settings.json` or `settings.local.json` explicitly allows them. Look for a `permissions.allow` block listing `Write(./.claude/features/**)`, `Edit(./.claude/rules/**)`, etc.

For **non-interactive `claude -p`** invocations: as of CLI 2.1.x, writes to `.claude/` are blocked by a hardcoded sensitive-path guard that no permission flag bypasses. If invoking this skill via `claude -p`, either run interactively (regular `claude`) so you can click through prompts, or use a staging-dir pattern: write to `./.brain-out/` and have an outer shell script relocate to `.claude/` afterward. The `bootstrap-project.sh` script demonstrates this pattern.
