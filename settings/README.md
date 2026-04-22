# Settings fragments

Shared `settings.json` snippets that teams can merge into their own Claude Code config. The installer does NOT touch `settings.json` — consumers apply fragments manually (or via the `update-config` skill) to avoid clobbering personal settings.

Organize fragments by purpose (e.g. `permissions.json`, `hooks.json`, `env.json`) and keep each one minimal and mergeable.
