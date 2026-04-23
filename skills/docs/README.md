# Document skills

Anthropic-provided skills for working with Office document formats. Each one is user-triggered (by mentioning a file type or task), not auto-attached by stack detection.

- `docx` — create, read, edit Word documents. Supports tracked changes, comments, tables of contents, headings, letterheads.
- `pdf` — read, merge, split, rotate, watermark, fill forms, OCR scanned PDFs.
- `pptx` — create or edit slide decks. Templates, layouts, speaker notes, comments.
- `xlsx` — read, edit, or create spreadsheets (including `.xlsm`, `.csv`, `.tsv`). Formulas, charts, formatting.

These ship with Python scripts under `scripts/`; Claude Code invokes them when the skill activates. Each directory has its own `LICENSE.txt` — preserve these files as-is.

The installer does **not** preselect these skills during stack detection (they're file-format-driven, not codebase-driven). Toggle them on in the manager or via `--skill=<name>` on the CLI when you want them available in a project.
