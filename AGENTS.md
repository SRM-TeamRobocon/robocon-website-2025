# Project rules

## Start here
- Read `docs/README.md` and the task-specific guide before editing. Current source wins over archived plans.
- Inspect existing patterns, callers, and relevant configuration. Reuse components and utilities; avoid new dependencies.
- Make the smallest complete change. Do not rewrite whole files or modify unrelated behavior.
- Never invent routes, tables, features, or validation results. State assumptions and incomplete checks.
- Never hardcode secrets or expose server credentials in client code, logs, documentation, or commits.
- API handlers must enforce the relevant session, role, ownership, and input checks; proxy checks alone are insufficient.
- Do not alter production data, credentials, deployments, GitHub settings, or remote branches without explicit task authorization. Inspect scripts before running them; seed/import/email scripts have external effects.
- Validate with `npx tsc --noEmit`, `npm run lint`, and `npm run build` as appropriate. The existing lint command is broken; report this rather than claiming it passed. See `docs/development-workflow.md`.
- Update the relevant docs when changing APIs, schemas, architecture, environment variables, or important behavior.
- Preserve other worktrees and uncommitted user changes. Do not force-push or rewrite history.

## UI design — required for every future agent edit
- Use only the existing Robocon font, Aldrich. Reuse the Next font from `src/app/layout.tsx` and CSS variable `--font-robocon`. Apply it to headings, body text, controls and generated-image captions. Do not introduce other font families.
- Use sharp corners: `border-radius: 0`. No rounded cards, buttons, inputs, badges, panels or pill controls. Do not add Tailwind `rounded-*` utilities.
- Keep copy concise and functional. Avoid decorative slogans and repeated instructions.
- These rules apply to any UI an agent creates or modifies going forward. Do not restyle untouched pages without a request. The current restyle is scoped to Halloween.
- Supplied artwork may retain its original shapes and embedded lettering; these rules govern application UI and text the application generates.

## Code discovery
Prefer codebase-memory-mcp graph tools: search_graph, trace_path, get_code_snippet, query_graph and get_architecture. Index the repository first if needed. Fall back to rg for literals, configuration, non-code files, or insufficient graph results.
