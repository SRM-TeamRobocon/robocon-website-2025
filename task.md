# Task: Clean and Prepare SRM Team Robocon Website Repository for New Developers

You are acting as a Senior Software Engineer, Tech Lead, and Repository Maintainer.

**Repository:** `SRM-TeamRobocon/robocon-website-2025`

**Objective:** Prepare this existing production website repository for onboarding junior web developers who will primarily use AI coding agents such as Codex.

This repository has accumulated old Markdown files, experimental code, temporary files, assets, outdated documentation, and possibly unused directories.

Your job is to turn it into a clean, professional, AI-agent-friendly codebase without breaking any existing functionality.

## 1. Audit the entire repository first

Before changing anything:

- Inspect the full directory structure.
- Identify the framework, dependencies, architecture, routes, components, API endpoints, database connections, authentication, environment variables, and integrations.
- Inspect the current Git branches and tracking state.
- Identify obsolete code, unused files, duplicate assets, temporary outputs, and outdated documentation.
- Find files that are necessary for production, even if they appear unused.
- Check existing instructions such as `AGENTS.md`, `README.md`, and other AI-related configuration files.

Do not assume that a file is unnecessary simply because it is old or has an unusual name.

## 2. Clean up old files

I want a much cleaner repository.

Review all Markdown files, including those in the repository root.

Classify each as:

1. Essential documentation.
2. Useful information that should be consolidated into `/docs`.
3. Historical information that should be archived.
4. Redundant or obsolete documentation that can be deleted.

Remove redundant, outdated, and unnecessary Markdown files only after confirming that their useful content has been preserved where needed.

Do not delete the root `README.md` or `AGENTS.md`; rewrite them if necessary.

Also inspect unnecessary screenshots, experimental folders, development artifacts, and unused assets.

Preserve working application code, active integrations, production assets, environment templates, and anything required for builds or deployments.

## 3. Clean Git branches

Inspect all local branches and remote-tracking branches.

- Keep `main` as the primary working branch.
- Identify stale, merged, and unmerged feature branches.
- Recommend which old branches can safely be removed.
- Delete only local branches that have been confirmed as fully merged and unnecessary.
- Do not delete unmerged branches automatically.
- Do not delete remote branches or modify GitHub settings.
- Do not force-push or rewrite Git history.

I want a clear report of which branches are safe to delete remotely, so I can handle those separately.

## 4. Improve .gitignore

Audit the existing `.gitignore` and update it appropriately.

Ignore unnecessary local or generated files such as:

- Dependency directories.
- Next.js build and cache outputs.
- Local environment files containing secrets.
- Debug logs.
- Temporary exports and scratch files.
- Editor-specific temporary files.
- OS-generated files.
- Locally generated test outputs.

Preserve tracked configuration, lockfiles, environment templates, and project-required assets.

For unwanted folders that are currently tracked, explain whether they should be deleted, archived, or removed from Git tracking.

Never blindly ignore active source code.

## 5. Create a professional /docs folder

This is the MOST IMPORTANT part of the task.

Junior developers will use AI coding agents extensively. Documentation must make it easy for both developers and agents to understand the project without repeatedly exploring the entire codebase.

Organize `/docs` using a clear, practical structure, such as:

```text
docs/
├── README.md
├── getting-started.md
├── architecture.md
├── project-structure.md
├── development-workflow.md
├── coding-standards.md
├── components.md
├── routing.md
├── backend-and-api.md
├── database.md
├── authentication.md
├── environment-setup.md
├── deployment.md
├── troubleshooting.md
└── agent-guide.md
```

Adapt this structure to the actual repository. Do not create unnecessary empty documents.

Every document must reflect the real implementation.

Do not invent routes, components, APIs, database tables, or features.

Documentation should explain:

- What the Robocon website does.
- How the application works.
- Where important code lives.
- How frontend pages and components are organized.
- How APIs communicate with the frontend.
- How the database is accessed.
- How authentication and authorization work, where applicable.
- How to run the project locally.
- How to add a new page.
- How to build a reusable component.
- How to add or modify an API.
- How to debug common errors.
- What should never be modified without approval.

Include practical examples and links to actual files.

## 6. Optimize the repository for AI coding agents

Create or improve the root `AGENTS.md`.

Treat it as the primary instruction entry point for Codex and other coding agents.

It should tell agents to:

1. Read `/docs/README.md` and relevant task-specific documentation before implementing changes.
2. Understand existing patterns before creating new components or APIs.
3. Reuse existing utilities and components.
4. Avoid unnecessary dependencies.
5. Never hardcode secrets or API keys.
6. Never modify unrelated functionality.
7. Avoid rewriting entire files when small changes are sufficient.
8. Follow the project's existing architecture and conventions.
9. Run appropriate validation commands after modifications.
10. Update documentation when changing architecture, APIs, database schemas, or important behavior.
11. Explain any assumptions or incomplete checks.
12. Never invent project functionality.

Make instructions concise and unambiguous.

Avoid excessive or repetitive agent rules that waste context tokens.

The objective is to help junior developers use AI agents safely, not encourage agents to blindly generate code.

## 7. Improve README.md

Rewrite the root README to be a clean entry point for new team members.

Include:

- Project introduction.
- Technology stack.
- Requirements.
- Installation.
- Environment variable setup using placeholders only.
- Development commands.
- Build and lint commands.
- Documentation navigation.
- Branch workflow.
- Contribution instructions.
- Common troubleshooting guidance.

Keep the README concise and link to `/docs` for detailed explanations.

## 8. Preserve production functionality

This website is an existing project, not a new application.

Do not redesign pages or change functionality as part of cleanup.

Do not modify:

- Vercel configuration unnecessarily.
- Production environment variables.
- Database records.
- Authentication secrets.
- Live API credentials.
- Existing integrations.
- GitHub repository settings.

Inspect existing scripts before running them, especially scripts that could alter a database, delete assets, or trigger deployments.

Run available safe validation commands, including lint, type checking where applicable, and production build.

Report any pre-existing failures separately from issues introduced by cleanup.

## 9. Final deliverables

Once complete, provide a summary of:

1. Files deleted.
2. Files consolidated or moved.
3. Files preserved because they are important.
4. `.gitignore` changes.
5. Documentation created or updated.
6. `AGENTS.md` improvements.
7. Local branches deleted and remote branches recommended for deletion.
8. Validation results.
9. Any remaining problems requiring manual attention.

## Important execution rules

- Start by auditing the repository.
- Make a cleanup plan based on actual findings.
- Implement safe, reversible changes.
- If a deletion is uncertain or could remove useful information, preserve the file and flag it for review.
- Do not push commits or perform destructive remote Git operations.
- Never modify GitHub organization settings, permissions, branch protections, or Vercel project settings.
- Do not replace useful existing documentation with generic AI-generated explanations.
- Prioritize correctness and project-specific knowledge over documentation quantity.

**Expected result:** A clean, maintainable, well-documented Robocon website repository that junior developers can clone and understand, and that AI coding agents can work on reliably without damaging existing functionality.