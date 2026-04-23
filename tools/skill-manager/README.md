# skill-manager

Small local web app for assigning `team-claude-skills` to projects without having to run the CLI each time. Does the same thing as `install-project.sh` — just with checkboxes.

## Run

```bash
node tools/skill-manager/server.js
# then open http://localhost:4599
```

Zero `npm install`. Stock Node 18+ only.

Override the port with `PORT=8080 node tools/skill-manager/server.js`.

## What it does

- **Project list** — register local project paths; persists across restarts at `~/.claude/team-claude-skills-ui/projects.json`. Removing from the list does not touch the project.
- **Folder picker** — type a path, or click the 📁 button to browse. The picker flags directories that look like projects (`package.json` or `.git` present).
- **Stack detection** — same rules as `install-project.sh`: reads each project's `package.json` and root-level marker files (`Dockerfile`, `angular.json`, `k8s/`, `@neolinkrnd/*`, …) to preselect relevant skills and agents.
- **Preselection** — detected entries start checked. Already-installed entries also start checked (and carry an `installed` badge). Uncheck anything you don't want; Apply will remove what you unchecked.
- **Collapsible categories** — each section (skills, agents) groups entries by category. Categories with detected / installed items start expanded; empty ones start collapsed.
- **Independent settings toggles** — "Enable agent teams" and "Enable auto memory" are two separate checkboxes. Apply merges them into any existing `.claude/settings.json`: only the two keys we manage (`env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and `autoMemoryEnabled`) are touched; everything else in the file is preserved. Unchecking a toggle removes that specific key. If the resulting file contains nothing, it's deleted.
- **Apply** — writes / removes symlinks in `<project>/.claude/skills/` and `<project>/.claude/agents/` to match your selection exactly, and merges settings toggles into `<project>/.claude/settings.json`.
- **Malformed settings.json** — if the existing file can't be parsed as JSON, settings changes are skipped (with a message) rather than clobbering your custom config.

## Logs & diagnostics

The server prints a line to stdout for every apply, showing the absolute target path and every change it made:

```
[2026-04-23 12:00:00] apply -> /Users/me/code/my-service/.claude/
  + skill:fastify-plugin
  - agent:deploy-captain
  + updated settings.json (autoMemoryEnabled=true)
```

If the UI says something changed but you don't see it on disk, check that log — it shows the exact path the server wrote to. The manager always writes into `<project>/.claude/`, which is commonly gitignored; a plain `ls` in the project root won't show it. Use `ls -la .claude/` to see it, or trust the log.

API responses are `Cache-Control: no-store` so the browser never serves stale state after an apply.

## What it doesn't do

- Doesn't manage live agent team sessions — that's Claude Code's job. This tool handles the wiring only.
- Doesn't commit anything. Installed entries are symlinks; everything is reversible.
- Doesn't need a build step — one server file, three static files.

## Layout

```
tools/skill-manager/
├── server.js         # HTTP server (no npm deps)
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── README.md
```

## When to prefer this over `install-project.sh`

Use the web app when:
- You're managing multiple projects and want an overview of what's installed where.
- You want to see detection reasons next to each option without re-reading the installer output.
- You want to flip things on/off repeatedly while iterating.

Use the shell installer when:
- You're bootstrapping a fresh project in one shot (`./install-project.sh <path> --yes`).
- You're scripting it in CI or a post-clone hook.
- You don't have a browser handy.
