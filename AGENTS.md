# Agent Rules

## Owner Scope: Stripe
- From the task after LOC-017 onward, preserve existing Stripe functionality and files, but do not modify, extend, localize, refactor, repair, or perform dedicated work on Stripe unless the owner explicitly changes this decision.
- The owner does not use Stripe for this Iran-focused project. Keep it in place; do not remove or disable it. Stripe-specific gaps or provider qualification must not block future tasks.
- See `.agentic/docs/DECISIONS.md`, DEC-008. Changes already made during LOC-017 are retained and verified.

## Build & Verification
- Do NOT run full builds (`npm run build`, `next build`, etc.)
- Use lint (`npm run lint`) or typecheck (`npx tsc --noEmit`) instead for verification
- Run dev server (`npm run dev`) only when explicitly asked
- This project uses **Next.js** -- all dev/build/start commands go through `next`

## MCP Server Conventions
- Every user-facing feature must have corresponding MCP tools
- Keep MCP tools updated when REST API routes change
- Tool descriptions must be clear for AI agents -- state input expectations (e.g. "amounts in cents") and what is returned
- All monetary amounts are in integer cents (e.g. $12.50 = 1250)
- MCP tools use direct DB access via Drizzle, not HTTP self-calls
- All tools are org-scoped via `AuthContext` passed at server creation time
- Use `wrapTool()` from `lib/mcp/errors.ts` for consistent error handling
- Tool files live in `lib/mcp/tools/` and export a `registerXTools(server, ctx)` function
- Register new tool files in `lib/mcp/tools/index.ts`
- Use `.describe()` on every Zod field in tool input schemas
- One tool per operation (no multi-purpose tools)

## Database
- All schema changes require Drizzle migration files -- run `npx drizzle-kit generate` after modifying any file in `lib/db/schema/`
- Never use `npx drizzle-kit push` in production -- it applies changes directly without migrations
- Migration files live in `drizzle/` and must be committed alongside schema changes
