# Agents

Reusable subagent definitions for Neolink projects. Each agent is a single `.md` file with YAML frontmatter (`name`, `description`, optional `model` and `tools`). The filename minus `.md` becomes the agent name.

## Where they can run

Every agent here can be invoked three ways:

1. **As a subagent** by Claude in a single session (task delegation).
2. **As a teammate in an agent team** — spawned by the lead, coordinates with other teammates via shared task list and messaging. Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the project's settings. See `skills/shared/agent-teams/` for how to use.
3. **Manually** via `claude --agents` or a direct mention in the prompt.

## Catalogue

| Agent | Category | Use as teammate when |
|-------|----------|---------------------|
| `backend-implementer` | backend | Task touches Fastify routes, tRPC procedures, or backend-local schemas |
| `frontend-implementer` | frontend | Task touches Angular components, feature libs, or tRPC client wiring |
| `schema-owner` | shared | Task changes schemas under `libs/shared/*/util/schemas/` |
| `reviewer` | shared | PR review — spawn 2–3 with different lenses |
| `deploy-captain` | devops | Task ends in a deploy, promotion, or rollback |

## Contributing

Copy `templates/AGENT.template.md` into the right category. The installer flattens filenames into `.claude/agents/`, so names must be unique across categories.

Keep the body short — when the agent runs as a teammate, its body is **appended** to the teammate's system prompt (not replacing it). Heavy duplication of stack details that skills already cover is wasted tokens.
