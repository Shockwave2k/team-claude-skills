---
name: code-memory-updater
description: Maintains project memory in CLAUDE.md. Use when significant code changes are made, new patterns introduced, or user asks to update memory. Analyzes changes and documents patterns, conventions, and architectural decisions.
---

# Code Memory Updater

Maintain institutional knowledge in CLAUDE.md files.

## Activation Triggers
- After implementing features/refactoring
- New architectural patterns introduced
- User explicitly asks to update memory
- Complex bugs resolved with insights

## Workflow

1. **Analyze**: Run `git diff` or examine files to identify significant patterns
2. **Extract insights**: Focus on architecture, conventions, naming, libraries, gotchas, optimizations
3. **Update CLAUDE.md**: Read existing file, add insights under sections (Project Structure, Coding Conventions, Architecture Patterns, Common Workflows, Important Gotchas, Dependencies)
4. **Confirm**: Summarize additions and ask for adjustments

## Guidelines
- Be selective - focus on reusable patterns
- Explain WHY, not just what
- Use bullet points, avoid code dumps
- Update existing sections rather than appending blindly
- Keep concise and organized
