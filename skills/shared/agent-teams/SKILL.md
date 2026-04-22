---
name: agent-teams
description: Use this when the user's task spans multiple layers at once (backend + frontend) or benefits from parallel investigation from several angles, and running multiple coordinated Claude Code sessions would help. Covers when to spawn a team vs a single subagent, which Neolink subagents to use as teammates, and concrete spawn prompts.
---

# Agent teams on Neolink projects

Claude Code's **agent teams** (experimental) spawn multiple Claude Code sessions that coordinate via a shared task list and direct messaging. Unlike subagents — which only report back to the caller — teammates talk to each other. That matters for cross-layer work.

## When to spawn a team

Good fits:

- **Full-stack feature** — a new domain that needs a tRPC router, an Angular feature lib, and a shared Zod schema. Use `backend-implementer` + `frontend-implementer` + `schema-owner`.
- **Parallel code review** — three `reviewer` teammates with different lenses (security, performance, coverage) challenge each other's findings.
- **Bug with competing hypotheses** — multiple investigators who try to disprove each other's theories. Converges on the root cause faster than one agent that anchors on the first explanation.

Bad fits (use a single session or subagents):

- Sequential work where step 2 depends on step 1.
- Same-file edits — teammates will clobber each other.
- Small changes. Coordination overhead exceeds the parallelism win on anything under a couple of hours of work.

## Enablement

Agent teams are experimental and disabled by default. The installer writes this to `.claude/settings.json` when `--with-settings` is selected:

    {
      "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
      "autoMemoryEnabled": true
    }

Display modes:
- **In-process** — all teammates run in your main terminal; Shift+Down cycles between them. Works in any terminal.
- **Split-pane** — each teammate in its own pane. Requires `tmux` or iTerm2 with the `it2` CLI.

## Neolink team members (installed as subagents)

| Agent | Use as teammate when |
|-------|---------------------|
| `backend-implementer` | Task touches Fastify routes, tRPC procedures, or backend-local schemas |
| `frontend-implementer` | Task touches Angular components, feature libs, or tRPC client wiring |
| `schema-owner` | Task changes schemas under `libs/shared/*/util/schemas/` |
| `reviewer` | PR review — spawn 2–3 with different lenses |
| `deploy-captain` | Task ends in a deploy, promotion, or rollback |

All of these are also usable as plain subagents (the lead of a single session can delegate to them) — agent-team use is additive.

## Canonical spawn prompts

**Full-stack feature:**

    Create an agent team to add the "Shipment" domain:
    - schema-owner: add shared Shipment input/output schemas under libs/shared/logistics/util/schemas/.
    - backend-implementer: add the tRPC shipmentRouter with CRUD procedures.
    - frontend-implementer: add libs/portal/shipments/feature-list with a data-access store consuming the router.
    Require plan approval before the implementers make changes.

**Parallel code review:**

    Create a team of 3 reviewers for PR #142:
    - one focused on security
    - one on backend performance and Mongoose query shapes
    - one on Angular test coverage and a11y
    Have them read each other's findings and flag disagreements.

**Bug with competing hypotheses:**

    The order list freezes after the 100th item. Spawn 4 teammates to investigate competing hypotheses (change detection, WebSocket backpressure, Mongoose cursor leak, Material virtual-scroll misuse). Have them challenge each other's theories.

## Do

- Give each teammate a distinct ownership scope; overlap causes file conflicts.
- Tell the lead when to wait and when to synthesize — it tends to start coding if left idle.
- Name teammates at spawn so you can message them by name later.
- Clean up the team when done (`Clean up the team`) — stale teammates waste tokens.

## Do not

- Do not spawn teams for routine single-layer tasks — a session or subagent is cheaper.
- Do not have two teammates editing the same file. Partition by module from the start.
- Do not pre-author a team config — Claude manages `~/.claude/teams/<team>/config.json` itself.
