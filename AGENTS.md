<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Triagely conventions

- Next.js 16 (App Router, Turbopack), React 19, TypeScript-strict, Tailwind v4 (`@import "tailwindcss"` in `src/app/globals.css`).
- Async request APIs only: `params`, `searchParams`, `cookies()`, `headers()` are async; read them with `await`.
- Data pages read the store directly and must be `export const dynamic = "force-dynamic"` so they render live data, not build-time snapshots. Store access is async (`getStore`/`mutateStore`): back it with Postgres when `DATABASE_URL` is set, otherwise a JSON file.
- Mutations go through API routes under `src/app/api` and the UI refreshes with `router.refresh()`.
- Auth: reads are public; mutations require a session. Accounts live in `triagely_users` (Postgres) or `data/users.json`; passwords are scrypt hashes; sessions are HMAC-signed httpOnly cookies (`AUTH_SECRET`). Guard mutation routes with `getSession()` from `src/infrastructure/auth/session`.
- Email: outbound replies go through `src/infrastructure/email/sender` (Resend when `RESEND_API_KEY` is set, otherwise dry-run — logged + audited, never sent). Inbound email arrives at `POST /api/inbound/email` and is normalised by the pure `normalizeInbound` parser before ingest.
- Layering: `src/domain` (pure logic, no I/O), `src/application` (use cases), `src/infrastructure` (store, auth, email, llm client, env, logger), `src/app` + `src/components` (UI). Domain modules must stay side-effect free and dependency-injected so they are unit-testable with vitest.
- No API key required: the heuristic triage engine is the default; email dry-runs without a key. Linting: `npm run lint`; types: `npm run typecheck`; tests: `npm run test`. Verify all three before finishing.