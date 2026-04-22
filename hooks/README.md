# Hooks

Shell scripts invoked by Claude Code hooks declared in `settings.json`. Keep them POSIX-friendly and fail loudly — a silent hook is a broken hook.

Scripts here are not installed automatically. Reference them from `settings/` fragments by absolute path (or a path relative to the repo), and document any environment they expect.
