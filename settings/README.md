# Settings fragments

Ready-to-use snippets for a project's `.claude/settings.json`. The `install-project.sh` installer can write one of these when you opt in (`--with-settings`, or toggle it in the interactive menu) — but only if the project has no existing `settings.json`. If one exists, the installer skips and you merge manually.

## Fragments

### `recommended.json` (what the installer writes)

```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "autoMemoryEnabled": true
}
```

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — turns on Claude Code's [agent teams](https://code.claude.com/docs/en/agent-teams) feature. Needed to spawn cross-layer teams with `backend-implementer` + `frontend-implementer` etc.
- `autoMemoryEnabled: true` — makes [auto memory](https://code.claude.com/docs/en/memory#auto-memory) explicit. It's on by default in Claude Code v2.1.59+, but setting this documents intent and prevents accidental opt-outs at higher settings layers.

### `agent-teams.json`

Same as above but without the memory flag — useful if you want to turn on teams without touching memory config.

## Merging into an existing `settings.json`

The installer does not merge. If your project already has `settings.json`, add these keys yourself:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "autoMemoryEnabled": true
}
```

If the `env` block already exists, add `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` to it rather than replacing the block.

## Scope note

These fragments target `.claude/settings.json` (project scope, shared with the team via git). Personal overrides belong in `.claude/settings.local.json` or `~/.claude/settings.json`; don't put team defaults there.
