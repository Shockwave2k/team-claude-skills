---
name: project-expert-generator
description: Use this skill when the user wants to generate a project-specific expert skill + agent from an existing codebase's brain. Trigger on phrases like "generate an expert skill for this project", "codify this codebase into a skill and agent", "build a project expert from the brain", "turn our brain into a reusable skill", "create a tailored skill and agent for this repo", "make a neolink-X-expert". Requires `codebase-scan` to have run first (reads `.claude/CLAUDE.md` + `.claude/rules/*.md`). Produces a project-local skill at `.claude/skills/<slug>/SKILL.md` and an opus-backed agent at `.claude/agents/<slug>.md`, both tailored to the project's actual conventions.
---

# Project expert generator

Turns a scanned codebase's brain into a reusable skill + agent pair tailored to that project. Use it after `codebase-scan` has built the brain; this compresses the brain's key conventions into a compact auto-triggering skill and a deep opus-backed expert agent.

The brain (`.claude/CLAUDE.md` + `.claude/rules/*.md`) is a path-scoped reference the user reads when editing specific modules. The generated skill is the 200-line overview that loads every session. The generated agent is the specialist the user delegates to (or spawns as a team member) when they need deep project-specific judgment.

## Prerequisite

- `.claude/CLAUDE.md` must exist (built by `codebase-scan`).
- At least one `.claude/rules/*.md` file should exist; more rules files means a richer output.
- If the brain is missing, stop and tell the user to run `codebase-scan` first.
- If the brain is thin (≤2 rules files), warn the user the output will be shallow and offer to run a more thorough scan first.

## Process

### Phase A — Gather

1. Read `.claude/CLAUDE.md` in full.
2. Read every file under `.claude/rules/*.md`.
3. Extract:
   - **Stack summary** (from CLAUDE.md header).
   - **Module list + purposes** (from the index + per-module rules).
   - **House conventions** — naming, file layout, import patterns, test framework, deploy flow. Prefer patterns that appear in >1 rules file; those are *conventions*, not one-off quirks.
   - **Public API fingerprints** — tRPC procedures, HTTP routes, major exported components.
   - **Data stores** used across the project.
   - **Gotchas** — aggregate the "Gotchas" sections across all rules files; dedupe.
4. Also read `.claude/features/*/outcome.md` if any exist — any patterns repeated across outcomes are worth promoting to conventions.

### Phase B — Propose names + descriptions

Propose a slug. Start from the `package.json` `name` field or the target directory name:

- `hive-logistic` → slug `hive-logistic-expert`
- `portal-website` → slug `portal-website-expert`
- a single-purpose service → slug `<service-name>-expert`

Propose:
- **Skill description** (prescriptive triggers): "Use this skill whenever working on `<project>` — mentions of `<service names>`, `<app names>`, `<domain terms>`, or paths under `apps/<...>`. Covers house conventions, module ownership, and known gotchas."
- **Agent description**: same triggers; frame as deep specialist; model `opus`.

Show both to the user and wait for explicit approval before writing files.

### Phase C — Write the skill

Target: `.claude/skills/<slug>/SKILL.md`. Keep the whole file **under 200 lines** — the skill is the overview that loads every session, not a duplicate of the brain.

    ---
    name: <slug>
    description: <from Phase B, prescriptive, trigger-phrase-rich>
    ---

    # <Project name> — house conventions

    ## Stack

    <one-paragraph stack summary from CLAUDE.md>

    ## Where things live

    | Module | Type | Purpose | Deep brain |
    |--------|------|---------|------------|
    | <...>  | <...>| <...>   | `.claude/rules/<module>.md` |

    ## House conventions

    <aggregated — naming, file layout, imports, test framework, deploy. Only patterns appearing in >1 module.>

    ## Common gotchas

    <deduped bullets from rules "Gotchas" sections>

    ## When to dig deeper

    - Module-specific work → read `.claude/rules/<module>.md`
    - Feature precedent → check `.claude/features/*/outcome.md` for prior similar work
    - Architecture context → `.claude/CLAUDE.md`

    ## Related subagents

    - `<slug>` (this repo) — opus expert; invoke by name for hard problems
    - Generalist teammates (`backend-implementer` / `frontend-implementer`) — for routine work

Do not re-enumerate everything in the brain. If a section would duplicate a rules file, link to it instead.

### Phase D — Write the agent

Target: `.claude/agents/<slug>.md`. Keep the whole file **under 150 lines**.

    ---
    name: <slug>
    description: <from Phase B>
    model: opus
    tools: Read, Edit, Write, Bash, Grep, Glob
    ---

    You are the expert for <project>. You know this codebase deeply — every service, every convention, every gotcha.

    Before editing anything, read the relevant `.claude/rules/<module>.md` and any related `.claude/features/*/outcome.md`. The `<slug>` skill is loaded every session and summarizes house conventions; this body expands on role and coordination.

    ## What you own

    <all modules from the rules index>

    ## What you do not own

    - Deploy manifests → route to `deploy-captain`
    - Cross-repo contracts / shared Zod schemas → route to `schema-owner`
    - Non-Neolink third-party integrations → flag to the user, don't guess

    ## How you work

    - Push back on proposed changes that violate house conventions — cite the specific rule.
    - Prefer patching existing files over creating new ones; new modules need a justification.
    - When the task is large, split it and delegate the routine parts to `backend-implementer` or `frontend-implementer`. You focus on the parts that need project-specific judgment.

    ## As an agent-team teammate

    - You're typically the architect / reviewer, not the primary implementer.
    - Implementers ask "how do we do X here?" — you answer from the brain and from memory.
    - Step in directly only for tricky changes the generalist flagged.

### Phase E — Tell the user the gitignore carve-out

The project's `.gitignore` likely ignores `/.claude/skills/*` and `/.claude/agents/*` (installer output is symlinks that are useless cross-machine). The generated files need explicit un-ignoring so they get committed. Print — **do not auto-edit** — the exact lines:

    # project-expert-generator output (commit these):
    !/.claude/skills/<slug>/
    !/.claude/agents/<slug>.md

Tell the user to paste these into their `.gitignore`, then `git add .claude/skills/<slug>/ .claude/agents/<slug>.md`.

### Phase F — Report

    Generated:
      .claude/skills/<slug>/SKILL.md        (<N> lines)
      .claude/agents/<slug>.md              (<M> lines)

    Next steps:
      1. Add to .gitignore:
           !/.claude/skills/<slug>/
           !/.claude/agents/<slug>.md
      2. Restart Claude Code — the skill will auto-attach on relevant tasks;
         the agent is invocable by name.
      3. Commit the new files with the next brain update.

## Rules

- **Everything in the generated output must trace back to the brain.** No invented conventions.
- **Compress, don't duplicate.** The skill is an overview; the brain is the deep reference. Linking is better than copying.
- **Opinionated, not encyclopedic.** The skill should read like "here's how we do things here", not "here's a survey of the codebase".
- **Don't clobber existing generated files.** If `.claude/skills/<slug>/` already exists, diff and propose the patch; wait for approval.
- **Leave the brain alone.** This skill reads `.claude/CLAUDE.md` and `.claude/rules/*.md`; it does not edit them. Rules updates go through `feature-outcome` or `codebase-scan`.

## Permission requirement

Writes to `.claude/skills/**` and `.claude/agents/**` are blocked by Claude Code's sensitive-path guard. The team's `settings/recommended.json` includes the allow rules; if missing in your current project, add this to `.claude/settings.local.json`:

    {
      "permissions": {
        "allow": [
          "Write(./.claude/skills/**)",
          "Edit(./.claude/skills/**)",
          "Write(./.claude/agents/**)",
          "Edit(./.claude/agents/**)"
        ]
      }
    }

For **non-interactive `claude -p`** invocations: as of CLI 2.1.x, writes to `.claude/` are blocked by a hardcoded sensitive-path guard that no permission flag can bypass. The scripts (`tools/bootstrap-project.sh`) work around this by telling Claude to write to `./.brain-out/` instead, then relocating the files to `.claude/` after Claude exits. If you're invoking this skill manually via `claude -p`, use the same staging-dir pattern or run interactively.
