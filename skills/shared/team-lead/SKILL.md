---
name: team-lead
description: Use this when Claude is acting as the lead of an agent team — the session that spawned teammates and is coordinating them through a shared task list. Covers how to structure initial tasks, when to wait vs. synthesize, how to run plan-approval, how to handle idle or stuck teammates, and how to clean up safely.
---

# Team lead conventions

Agent teams have no dedicated "lead" subagent definition — the lead is the Claude Code session the user started in their terminal. This skill captures how that session should behave once it has a team running.

## Before spawning

- Restate the user's goal in one sentence. Resolve ambiguity with the user before creating the team; a misaligned goal multiplied across 3–4 teammates wastes more tokens than any upfront question.
- Draft the task list. Aim for 5–6 independent tasks per teammate; smaller than that and coordination overhead dominates, larger and teammates drift too long without check-ins.
- Identify hard dependencies. Shared schema changes must land before backend or frontend code references them — that's a sequencing constraint, not a claim-order preference.

## At spawn time

- Give every teammate a name. Refer to them by name in later prompts (`schema-owner`, `backend-impl`, etc.) — this is the only handle you have once they're running.
- Prefer the subagent definitions from this repo: `backend-implementer`, `frontend-implementer`, `schema-owner`, `reviewer`, `deploy-captain`. Don't reinvent their ownership rules in the spawn prompt.
- Pass each teammate the task-specific context it needs. `CLAUDE.md` and relevant skills load automatically; conversation history does not carry over.
- If the work crosses FE and BE and touches shared contracts, explicitly tell `schema-owner` to go first and block the implementers until the schema lands.

## While the team runs

- **Wait.** If you catch yourself writing code, you're duplicating an implementer's work. Stop.
- Peek at teammates (Shift+Down in-process, or click into their pane in tmux) only if the shared task list hasn't updated in a noticeable stretch.
- If a teammate is stuck on an error: diagnose whether it's environmental (redirect them) or a real obstacle (give them more context, or swap to a different teammate).
- If a teammate asks to modify a file outside its declared ownership, refuse or route the change to the right teammate — don't blanket-approve.

## Plan approval (when required)

- Approve only plans that include tests for the change's critical path.
- Reject plans that modify shared schemas without coordinating with `schema-owner` first.
- Reject plans that touch files outside the teammate's declared ownership (see each agent's "You do not own" block).
- Reject plans that introduce new dependencies, new DB drivers, or new deploy targets without surfacing them to the user.

## Synthesis

When all teammates are idle and the task list is complete, produce one summary to the user containing:

- What landed (per teammate, with file paths).
- What was skipped and why.
- Unresolved disagreements between teammates — do not silently pick a side.
- What the user needs to do next (open PR, run migration, deploy, review a specific file).

## Cleanup

- **Always** run cleanup yourself. Teammates should not — their team context may not resolve correctly.
- Before cleanup, verify the task list shows no in-progress work and every teammate has reported idle.
- If cleanup fails because a teammate is still live, shut that teammate down first (`ask <name> to shut down`), then retry cleanup.

## What the lead does NOT do

- Does not edit implementation files — that's the implementers' job.
- Does not run `kubectl apply`; deploy-captain owns deploys.
- Does not spawn nested teams. Not supported.
- Does not transfer leadership. The session that created the team leads for its lifetime.
- Does not promote itself to teammate. If the lead needs to do real work, the team was probably the wrong shape.
