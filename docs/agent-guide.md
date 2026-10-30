# Working with coding agents

[AGENTS.md](../AGENTS.md) is the instruction entry point. Give the agent a bounded
task, expected behavior, and relevant guide, for example:

> Read docs/routing.md and docs/coding-standards.md. Add the requested text to the
> existing projects page using its current theme and components. Preserve other
> pages. Validate the diff and report checks actually run.

For backend work also read [authentication](authentication.md) and
[backend/database](backend-and-api.md). Trace callers and authorization before
changing shared logic. Prefer the codebase-memory MCP graph; index if absent.
Use `rg` for literals/configuration or when graph results are insufficient.

Review the proposed diff yourself. Verify that the agent reused existing code,
kept secrets server-side, preserved role checks, and did not modify unrelated
features. Ask it to explain assumptions, incomplete checks, and remaining risks.
Plans in `docs/archive` and dated feature notes do not authorize migrations,
deployments, messaging, or implementation of unrelated features.

The repository may contain ignored local agent files with outdated instructions.
Use AGENTS.md and these guides for onboarding. Preserve personal worktrees and
private environments; never copy them into a PR to make a task reproducible.
