# Project rules

## UI design — required for every future agent edit
- Use only the existing Robocon font, Aldrich. Reuse the Next font from `src/app/layout.tsx` and CSS variable `--font-robocon`. Apply it to headings, body text, controls and generated-image captions. Do not introduce other font families.
- Use sharp corners: `border-radius: 0`. No rounded cards, buttons, inputs, badges, panels or pill controls. Do not add Tailwind `rounded-*` utilities.
- Keep copy concise and functional. Avoid decorative slogans and repeated instructions.
- These rules apply to any UI an agent creates or modifies going forward. Do not restyle untouched pages without a request. The current restyle is scoped to Halloween.
- Supplied artwork may retain its original shapes and embedded lettering; these rules govern application UI and text the application generates.

## Code discovery
Prefer codebase-memory-mcp graph tools: search_graph, trace_path, get_code_snippet, query_graph and get_architecture. Index the repository first if needed. Fall back to rg for literals, configuration, non-code files, or insufficient graph results.
