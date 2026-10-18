# Triagely — Support Inbox Auto-Triage

An international-grade automation that sits in front of a support inbox: every
inbound message is **classified, scored, prioritized, routed, given an SLA
deadline, and answered with a draft reply** — automatically, deterministically,
and with a full audit trail.

No external services required: the deterministic engine and a local JSON store
work out of the box. Point `DATABASE_URL` at Postgres for durable storage, and
set `LLM_API_KEY` to add optional model-based refinement. Operators sign in to
act on tickets; replies can be delivered by email via `RESEND_API_KEY`, and new
tickets can arrive from a provider's inbound email webhook.

## What it does

- **Classify** each message into `billing · technical · account · refund · product · request · general` with a confidence score.
- **Read sentiment** (`negative / neutral / positive`) and compute an urgency score.
- **Prioritize** (`urgent / high / medium / low`) from an explainable score.
- **Route** to the best specialist by category, language and current workload (round-robin fallback).
- **Apply an SLA policy** — response targets of 15m / 1h / 4h / 24h by priority — and track `within / at_risk / breached` live.
- **Draft a reply** from a template, or upgrade it with the LLM pass.
- **Detect duplicates** by message id.
- **Record an audit trail** of everything the automation and humans do.

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Operations overview: KPIs, category volume, priority mix, needs-attention list, recent tickets, agent workload. |
| `/inbox` | Filterable, searchable queue with live SLA state. |
| `/inbox/[id]` | Conversation, triage breakdown, SLA meter, assignment/priority controls, suggested reply, audit trail. |
| `/analytics` | Automation coverage, SLA compliance, category/sentiment mix, volume, per-agent performance. |
| `/simulate` | Compose a fake inbound email and run it through the live ingest pipeline. |
| `/login` | Operator sign-in. Reading data is public; mutations require a session. |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

The store is seeded with ~18 realistic tickets and 6 agents on first read, so
the app has data immediately. By default it is a JSON file at `data/store.json`;
set `DATABASE_URL` to persist to Postgres instead.

```bash
npm run reset      # wipe data/store.json and re-seed
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (Turbopack). |
| `npm run build` / `npm start` | Production build and server. |
| `npm run lint` | ESLint, zero warnings allowed. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest: domain units + a Postgres store integration test. |
| `npm run reset` | Re-seed the JSON store. |
| `npm run verify` | typecheck + lint + test + build. |

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | *(empty)* | Postgres connection string. When set, the store persists to the database; otherwise a JSON file. |
| `LLM_API_KEY` | *(empty)* | Enables the LLM refinement pass (engine becomes `hybrid`). |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `LLM_MODEL` | `gpt-4o-mini` | |
| `LLM_CONFIDENCE_THRESHOLD` | `0.85` | Skip the LLM when the heuristic is already confident. |
| `SUPPORT_ORG` / `SUPPORT_SIGNATURE` | `Triagely` | Branding used in replies. |
| `AUTH_SECRET` | *(dev default)* | Signs session cookies. Set in production. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@triagely.app` / `triagely-admin` | Bootstrap admin seeded on first sign-in. |
| `RESEND_API_KEY` | *(empty)* | Delivers replies by email via Resend. Empty = dry-run. |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` | `Triagely <onboarding@resend.dev>` | Sender identity for outbound email. |
| `INBOUND_WEBHOOK_SECRET` | *(empty)* | Shared secret required on inbound email webhooks. |
| `API_BOOTSTRAP_KEY` | *(empty)* | Optional admin API key for `/api/v1`, accepted straight from the environment. |

With no key, the engine is `heuristic` and every feature still works offline.

## Authentication

Accounts live in `triagely_users` (Postgres) or `data/users.json` (file backend).
Passwords are stored as scrypt hashes; sessions are stateless HMAC-signed
httpOnly cookies (`AUTH_SECRET`). On the first sign-in an admin is seeded from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (or the documented default).

**Reading** tickets, analytics and the health check is public. **Mutations** —
ingesting, replying, resolving, reassigning, changing priority — require a
session and return `401` without one. The UI prompts sign-in and the audit trail
records the operator's name.

## Email

- **Outbound.** Sending a reply records it on the ticket, then delivers it by
  email (subject `Re: …`). With `RESEND_API_KEY` the free Resend tier is used;
  with no key it runs in **dry-run** mode — logged and audited, never sent.
  Delivery is best-effort: a failure is audited but does not undo the reply.
- **Inbound.** `POST /api/inbound/email` accepts a provider webhook (Resend
  `email.received`, Mailgun-style form fields, or a generic JSON body), normalises
  it and runs the full ingest pipeline. Protect it with `INBOUND_WEBHOOK_SECRET`
  (sent as `x-triagely-signature` or `Authorization: Bearer <secret>`).

## Public API (v1)

A versioned, machine-to-machine REST API under `/api/v1`, authenticated with an
API key (`x-api-key: tgk_…` or `Authorization: Bearer tgk_…`). Separate from the
session-based UI endpoints, so external systems (helpdesk sync, Zapier, a
backend) can drive tickets headlessly.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/v1/tickets` | List tickets. Filters: `status`, `category`, `priority`, `q`; paged with `limit` (max 200) + `offset`. |
| `POST` | `/api/v1/tickets` | Ingest + triage a raw inbound message. |
| `GET` | `/api/v1/tickets/:id` | Fetch an enriched ticket. |
| `PATCH` | `/api/v1/tickets/:id` | `resolve` · `reopen` · `reassign` · `priority` · `regenerate_draft`. |
| `POST` | `/api/v1/tickets/:id/reply` | Send a reply (email delivery), appending to the thread. |
| `GET` | `/api/v1/analytics` | Aggregated analytics. |

**Keys.** Mint and revoke keys from the **API keys** console page (`/keys`, visible
when signed in), or the underlying admin endpoints, which require a signed-in
operator session: `GET`/`POST /api/admin/api-keys`, `DELETE /api/admin/api-keys/:id`.
The full secret (`tgk_<prefix>_<secret>`) is returned **once** at creation; only a
SHA-256 hash is stored, so it can never be recovered. Alternatively, set
`API_BOOTSTRAP_KEY` to accept a fixed admin key from the environment.

```bash
# mint a key (with an operator session cookie), then use it
curl -X POST localhost:3000/api/admin/api-keys -b cookies.txt \
  -H 'content-type: application/json' -d '{"name":"Zapier","role":"agent"}'

curl localhost:3000/api/v1/tickets -H 'x-api-key: tgk_…'
```

## Persistence

The store keeps the whole aggregate (agents, tickets, audit trail, counters) in
a single `triagely_store` row — `id`, `data jsonb`, `updated_at`. It picks a
backend at runtime:

- **Postgres** when `DATABASE_URL` is set — durable across redeploys and shared
  across serverless instances. Mutations run inside a `for update` row lock so
  concurrent writers serialise, and the schema is created automatically.
- **JSON file** at `data/store.json` otherwise (local development).
- **In-memory** if that file is not writable and no database is configured, so
  requests never crash on a read-only FS.

## Deployment

Deploy to Vercel, then add a Postgres database and set `DATABASE_URL` in the
project's environment variables (Neon and Vercel Postgres both have free tiers):

```bash
# create a database (example: Neon), then copy the pooled connection string
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production           # signs session cookies
vercel env add ADMIN_EMAIL production           # bootstrap admin (optional)
vercel env add ADMIN_PASSWORD production        # bootstrap admin password (optional)
vercel env add RESEND_API_KEY production        # outbound email (optional; dry-run without it)
vercel env add INBOUND_WEBHOOK_SECRET production # inbound webhook auth (optional)
```

Without `DATABASE_URL`, Vercel's read-only filesystem makes the store degrade to
in-memory: the app works but data resets on every deploy and is not shared across
instances. With it, tickets, replies and the audit trail persist.

## HTTP API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/tickets` | List tickets. Filters: `status`, `category`, `priority`, `q`. |
| `POST` | `/api/tickets` | Ingest + triage a raw inbound message (webhook style). 🔒 |
| `GET` | `/api/tickets/:id` | Fetch a single enriched ticket. |
| `PATCH` | `/api/tickets/:id` | `resolve` · `reopen` · `reassign` · `priority` · `regenerate_draft`. 🔒 |
| `POST` | `/api/tickets/:id/reply` | Send a reply (email delivery), appending to the thread. 🔒 |
| `POST` | `/api/inbound/email` | Provider inbound-email webhook. Protected by `INBOUND_WEBHOOK_SECRET`. |
| `POST` | `/api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Session endpoints. |
| `GET` | `/api/health` | Store liveness, engine mode, auth/email status. |

🔒 requires a signed-in operator session (`triagely_session` cookie).

Example:

```bash
curl -X POST localhost:3000/api/tickets -H 'content-type: application/json' -d '{
  "fromName": "Dmitri Volkov",
  "fromEmail": "dmitri@northwind-labs.io",
  "subject": "URGENT: checkout is down",
  "body": "Our production checkout returns 500 errors for every customer."
}'
```

## Architecture

Domain-driven, dependency-injected, side-effect free where it matters:

```
src/
  domain/          pure logic, no I/O — schemas, classifier, sentiment,
                   urgency, priority, SLA policy, draft templates   (unit-tested)
  application/     use cases — ingest, run-triage, queries, actions, auth
  infrastructure/  store (Postgres or file), auth (users, password, sessions),
                   email sender, env, logger, LLM client
  app/             routes and API handlers
  components/      UI
```

- `src/domain/` never reads the clock or the filesystem; callers inject `now`,
  which keeps tests exact and lets seeds simulate at-risk/breached tickets.
- Data pages are `export const dynamic = "force-dynamic"` and read the store
  directly, so SLA state is computed at render time.
- Mutations go through API routes; the UI calls `router.refresh()` afterwards.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · Zod · postgres.js · Vitest.
