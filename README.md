# Triagely — Support Inbox Auto-Triage

An international-grade automation that sits in front of a support inbox: every
inbound message is **classified, scored, prioritized, routed, given an SLA
deadline, and answered with a draft reply** — automatically, deterministically,
and with a full audit trail.

No database and no API key required. The heuristic engine is the default;
an optional OpenAI-compatible LLM refines the result when one is configured.

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

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

The JSON store at `data/store.json` is seeded with ~18 realistic tickets and 6
agents on first read, so the app has data immediately.

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
| `npm run test` | Vitest unit tests (domain only). |
| `npm run reset` | Re-seed the JSON store. |
| `npm run verify` | typecheck + lint + test + build. |

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Default | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | *(empty)* | Enables the LLM refinement pass (engine becomes `hybrid`). |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `LLM_MODEL` | `gpt-4o-mini` | |
| `LLM_CONFIDENCE_THRESHOLD` | `0.85` | Skip the LLM when the heuristic is already confident. |
| `SUPPORT_ORG` / `SUPPORT_SIGNATURE` | `Triagely` | Branding used in replies. |

With no key, the engine is `heuristic` and every feature still works offline.

## HTTP API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/tickets` | List tickets. Filters: `status`, `category`, `priority`, `q`. |
| `POST` | `/api/tickets` | Ingest + triage a raw inbound message (webhook style). |
| `GET` | `/api/tickets/:id` | Fetch a single enriched ticket. |
| `PATCH` | `/api/tickets/:id` | `resolve` · `reopen` · `reassign` · `priority` · `regenerate_draft`. |
| `POST` | `/api/tickets/:id/reply` | Send a reply, appending to the thread. |
| `GET` | `/api/health` | Store liveness and active engine mode. |

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
  application/     use cases — ingest, run-triage, queries, actions
  infrastructure/  file store, env, logger, LLM client
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
Tailwind CSS v4 · Zod · Vitest.
