<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent guide

This repo serves two audiences. Pick the section that matches what you're doing.

## A. You are modifying this codebase

You're a coding agent. You're going to edit files, run tests, commit, push.

- **Stack**: Next.js 16 + React 19 + Tailwind 4 + Vitest + Zod. Read `node_modules/next/dist/docs/` (the Next 16 caveat above is real — Route Handlers are not cached by default).
- **Source layout**: see [`README.md`](README.md) "Project layout".
- **Plan of record**: [`docs/plan.md`](docs/plan.md). The pair set, source clients, and API shape are pinned to this file. If you change a contract, update the plan.
- **Tests**: `npm test` (52 vitest cases). Add a test for any new branch in source clients or API logic. Pure-function libs (`black-scholes`, `spread`, `history`) all live under `src/lib/` with a sibling `*.test.ts`.
- **Polymarket slugs drift**: re-verify every slug in `src/lib/pairs.ts` against `https://gamma-api.polymarket.com/markets?slug=<slug>` before assuming a pair is live. The original tutorial's slug set was already partially stale on day one.
- **Sidecar**: SPY data routes through a Python yfinance service in `sidecar/`. If you add another option-derived source, prefer adding to the sidecar over re-implementing the cookie/crumb dance in Node.
- **Auto-commit hook noise**: Akane's environment commits-on-edit. Before pushing, soft-reset to your last clean SHA and make one labelled commit per feature.

## B. You are consuming this dashboard as a runtime agent

You're an agent running inside OpenClaw, Hermes, n8n, a Cloudflare Worker, etc. You're going to poll the API, reason about divergences, and post commentary or alerts.

You do not need to read the source. The contract is documented:

- **[`docs/agents/api-contract.md`](docs/agents/api-contract.md)** — endpoints, JSON schemas, curl examples, cache semantics, error modes. Machine-readable enough to wire yourself in.
- **[`docs/agents/divergence-commentator.md`](docs/agents/divergence-commentator.md)** — runtime-agnostic reference agent: system prompt, polling cadence, alert thresholds, output format. Drop-in for any LLM-driven runtime.

The dashboard is the source of truth for both probabilities and history. Do not call Polymarket / Deribit / Yahoo directly — those calls are already cached server-side at 5 minutes, and bypassing the API just creates rate-limit risk and divergence between what you see and what the dashboard shows.

If your runtime needs tool-style metadata (OpenAPI, JSON-Schema, MCP), generate it from `docs/agents/api-contract.md` — that file is the single source.
