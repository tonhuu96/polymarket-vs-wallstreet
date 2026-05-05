# Polymarket vs Wall Street — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js dashboard that compares Polymarket prediction-market probabilities against Wall Street options-implied probabilities for four matched binary events, refreshing every 30s with 5-minute server-side caching, sparklines for 7-day spread history, and a DEMO MODE toggle backed by a hardcoded snapshot.

**Architecture:** Next.js 16 App Router, Route Handlers under `app/api/`, server-side `fetch(..., { next: { revalidate: 300 } })` for 5-min source caching, client uses SWR with 30s polling. Spread history persists to a JSON file under `data/history.json` (1 row per pair per UTC day). DEMO MODE flips a server-driven flag that returns the snapshot bundle instead of live data.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, SWR, Recharts, Zod, Vitest, JetBrains Mono.

**Source-of-truth blueprint:** See `~/Sync/ObsidianTon/Inbox/Polymarket vs Wall Street Tutorial.md` (verbatim). Pre-baked decisions: CME FedWatch unofficial endpoint > Atlanta Fed; SPY × 10 > ^SPX; demo mode = hardcoded snapshot with one >15pp pair.

**Constraint:** This is Next.js **16** — read `node_modules/next/dist/docs/` before using framework features. Route Handlers are NOT cached by default; rely on `fetch(..., { next: { revalidate } })` for server-side caching.

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── markets/route.ts        # GET → live or demo bundle
│   │   └── history/route.ts        # GET → 7-day spread history
│   ├── layout.tsx                  # JetBrains Mono + dark bg
│   ├── globals.css                 # Tailwind + theme
│   └── page.tsx                    # Dashboard (client component)
├── components/
│   ├── DemoToggle.tsx
│   ├── HeroDivergence.tsx
│   ├── MarketRow.tsx
│   └── Sparkline.tsx
└── lib/
    ├── black-scholes.ts            # cumulative normal + P(S_T > K)
    ├── black-scholes.test.ts
    ├── spread.ts                   # spread + bias label
    ├── spread.test.ts
    ├── types.ts                    # Pair, MarketSnapshot, etc.
    ├── demo-snapshot.ts            # hardcoded bundle, ≥1 pair >15pp
    ├── demo-snapshot.test.ts
    ├── history.ts                  # file-based JSON store
    ├── history.test.ts
    ├── pairs.ts                    # 4 pair definitions
    └── sources/
        ├── polymarket.ts
        ├── polymarket.test.ts
        ├── cme-fedwatch.ts         # with hardcoded fallback
        ├── cme-fedwatch.test.ts
        ├── deribit.ts              # BTC chain → BS
        ├── deribit.test.ts
        ├── yahoo-spy.ts            # SPY chain × 10 → BS
        └── yahoo-spy.test.ts
data/
└── history.json                    # gitignored, runtime
```

---

## Task 1: Foundation — types, black-scholes, spread, demo snapshot

**Goal:** Establish core domain types and pure-function libraries with TDD.

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/black-scholes.ts`, `src/lib/black-scholes.test.ts`
- Create: `src/lib/spread.ts`, `src/lib/spread.test.ts`
- Create: `src/lib/pairs.ts`
- Create: `src/lib/demo-snapshot.ts`, `src/lib/demo-snapshot.test.ts`

### Steps

- [ ] **types.ts**: define `PairId = 'fed-may' | 'fed-jun' | 'btc-100k' | 'spx-7000'`, `Side = 'polymarket' | 'wallstreet'`, `PairSnapshot { id; label; tradable; expiry; polymarket: number; wallstreet: number; spread: number; demo: boolean }`, `MarketsResponse { pairs: PairSnapshot[]; updatedAt: string; demo: boolean }`.

- [ ] **pairs.ts**: export the 4 pair configs (id, display label, polymarket slug, wallstreet method enum, expiry ISO, strike if applicable, label like "Fed cut at May 2026 FOMC", tradable copy like "Long Polymarket / Short FedWatch"). Keep slugs in one place so they can be swapped easily when Polymarket renames.

- [ ] **black-scholes.ts**:
  - `normCdf(x: number): number` using Abramowitz & Stegun 26.2.17 approximation.
  - `probabilityAboveStrike({spot, strike, t, vol, r=0}): number` returns `N(d2)` for risk-neutral P(S_T > K) under GBM.
  - Exact return [0,1].

- [ ] **black-scholes.test.ts**: assert `normCdf(0) ≈ 0.5`, `normCdf(1.96) ≈ 0.975` (±1e-3), `probabilityAboveStrike({spot:100,strike:100,t:0.5,vol:0.3,r:0})` between 0.4 and 0.5, `probabilityAboveStrike({spot:200,strike:100,t:0.5,vol:0.3,r:0})` > 0.95, `probabilityAboveStrike({spot:50,strike:100,t:0.5,vol:0.3,r:0})` < 0.05.

- [ ] **spread.ts**: `spreadPp(poly: number, wall: number) => poly - wall` (in percentage points, both inputs 0–100). `isLargeSpread(s) => Math.abs(s) > 10`. `largestSpread(pairs) => pairs.reduce((a,b)=>Math.abs(b.spread)>Math.abs(a.spread)?b:a)`.

- [ ] **spread.test.ts**: tests for the three helpers including signed largest selection.

- [ ] **demo-snapshot.ts**: hardcoded `MarketsResponse` with realistic-looking values; one pair MUST have `Math.abs(spread) > 15`. Set `updatedAt` to a fixed ISO so tests are deterministic.

- [ ] **demo-snapshot.test.ts**: assert structure (4 pairs, all PairIds present), at least one pair has spread > 15pp.

- [ ] **Run tests**: `npm test` — all green.

- [ ] **Commit**: `feat(core): types, black-scholes, spread, demo snapshot`

---

## Task 2: Source clients (Polymarket, CME FedWatch, Deribit, Yahoo SPY)

**Goal:** Four async functions, each `() => Promise<number>` returning a probability in 0–100. Each isolated, each tested with `vi.fn()` mocked `fetch`.

**Files:**
- Create: `src/lib/sources/polymarket.ts`, `polymarket.test.ts`
- Create: `src/lib/sources/cme-fedwatch.ts`, `cme-fedwatch.test.ts`
- Create: `src/lib/sources/deribit.ts`, `deribit.test.ts`
- Create: `src/lib/sources/yahoo-spy.ts`, `yahoo-spy.test.ts`

### Steps

- [ ] **polymarket.ts**: `fetchPolymarketYes(slug: string): Promise<number>` — GET `https://gamma-api.polymarket.com/markets?slug={slug}`, parse first market, parse `outcomePrices` (it's a JSON-encoded string per Polymarket convention), return `Number(prices[0]) * 100`. Use Zod to validate. Use `next: { revalidate: 300 }` on the fetch.

- [ ] **polymarket.test.ts**: mock `fetch` to return `[{ outcomePrices: '["0.42","0.58"]' }]`, assert returns 42. Test 404 → throws. Test malformed → throws.

- [ ] **cme-fedwatch.ts**: `fetchFedWatchCutProb(meeting: 'may-2026' | 'jun-2026'): Promise<number>`. Try the unofficial endpoint (`https://www.cmegroup.com/services/sandbox/lookup`-style — agent should research the live endpoint or use a placeholder). If the fetch fails or returns malformed data, fall back to a hardcoded snapshot map: `{ 'may-2026': 18, 'jun-2026': 64 }`. Catch network errors gracefully.

- [ ] **cme-fedwatch.test.ts**: mock fetch failure → returns fallback. mock success → returns parsed value.

- [ ] **deribit.ts**: `fetchDeribitProbability({ strike, expiryIso, currency='BTC' }): Promise<number>` — GET `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option`, find option closest to strike + expiry, derive implied vol, then call `probabilityAboveStrike(...)`. Spot from `https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL`. Returns 0–100.

- [ ] **deribit.test.ts**: mock both endpoints, assert deterministic output. Edge: missing strike → throws.

- [ ] **yahoo-spy.ts**: `fetchSpyImpliedAbove({ targetIndexLevel, expiryIso }): Promise<number>` — convert SPX target to SPY (target/10). Use `https://query2.finance.yahoo.com/v7/finance/options/SPY?date={unix}`. Pick option closest to SPY-equivalent strike, extract `impliedVolatility` and `regularMarketPrice` for spot, call `probabilityAboveStrike`. Returns 0–100.

- [ ] **yahoo-spy.test.ts**: mock chain payload, assert correct strike selection and probability bounds.

- [ ] **Run tests**: `npm test`.

- [ ] **Commit**: `feat(sources): polymarket, cme, deribit, yahoo clients`

---

## Task 3: API routes + history persistence

**Goal:** Aggregate the 4 pairs in one endpoint, persist daily spread snapshot for sparklines.

**Files:**
- Create: `src/lib/history.ts`, `history.test.ts`
- Create: `src/app/api/markets/route.ts`
- Create: `src/app/api/history/route.ts`
- Modify: `.gitignore` (add `data/`)

### Steps

- [ ] **history.ts**: `appendDailySpread(pairId, spread)` — read `data/history.json`, upsert entry for today UTC, write back. `readHistory(): Record<PairId, {date: string; spread: number}[]>` returning at most 7 most-recent days. Use `node:fs/promises`. Create `data/` if missing.

- [ ] **history.test.ts**: temp-dir override (env var `HISTORY_FILE` for test isolation). assert append → read returns the value. assert >7 days truncated.

- [ ] **app/api/markets/route.ts**: 
  ```ts
  export const revalidate = 300;
  export async function GET(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.get('demo') === '1') {
      return Response.json(getDemoSnapshot());
    }
    const pairs = await Promise.all(PAIRS.map(buildLivePair));
    pairs.forEach(p => appendDailySpread(p.id, p.spread));
    return Response.json({ pairs, updatedAt: new Date().toISOString(), demo: false });
  }
  ```
  Where `buildLivePair(pair)` calls the right source pair, computes spread, returns `PairSnapshot`. Wrap each pair in a try/catch — if one source fails, fall back to demo value for that pair only and tag it.

- [ ] **app/api/history/route.ts**: `export const revalidate = 300;` GET → `Response.json(readHistory())`.

- [ ] **Update `.gitignore`**: append `\ndata/\n`.

- [ ] **Run tests**: `npm test`.

- [ ] **Commit**: `feat(api): markets aggregation + history persistence`

---

## Task 4: UI — dashboard page, components, dark theme

**Goal:** Match the spec UI: dark theme, JetBrains Mono numbers, 5-column row, hero stat, sparklines, demo toggle.

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Replace: `src/app/page.tsx`
- Create: `src/components/DemoToggle.tsx`, `HeroDivergence.tsx`, `MarketRow.tsx`, `Sparkline.tsx`

### Steps

- [ ] **layout.tsx**: replace Geist with `JetBrains_Mono` from `next/font/google` (subset 'latin', variable `--font-jetbrains`). Set `<html className="dark">` and body bg `bg-zinc-950 text-zinc-100`.

- [ ] **globals.css**: dark vars only, accent reds (`--color-spread-red: oklch(0.65 0.22 25)`), accent green for negative-but-positive (Polymarket favored), tabular-nums helper.

- [ ] **DemoToggle.tsx** (client): pill toggle that flips a search-param via `useRouter`. Reads `?demo=1` from URL.

- [ ] **HeroDivergence.tsx**: takes `pairs`, picks largest spread, renders huge 4xl number with red gradient if abs > 10, sub-label "{event} · Polymarket says X% / Wall St says Y%".

- [ ] **MarketRow.tsx**: 5-column grid (event | poly% | wall% | spread | trade copy). Spread cell red bg gradient when abs > 10. Sparkline inline at the row's right. Tabular-nums.

- [ ] **Sparkline.tsx**: thin Recharts `<LineChart>` (no axes, ~120×24px), shows last 7 days of spread for that pair. Color matches sign of latest spread.

- [ ] **page.tsx** (client component): SWR with 30s `refreshInterval` hitting `/api/markets?demo={demo}` and `/api/history`. Renders `<Header><DemoToggle/></Header><HeroDivergence/><table of MarketRow/>`.

- [ ] **Manual smoke**: `npm run dev`, hit http://localhost:3000, toggle demo, verify both modes render. (Live mode may show fallbacks until sources are reachable from Pi.)

- [ ] **Run tests + lint + build**: `npm test && npm run lint && npm run build`.

- [ ] **Commit**: `feat(ui): dashboard, components, dark theme`

---

## Task 5: README + GitHub push

**Files:**
- Create: `README.md` (overwrite scaffold)

### Steps

- [ ] **README.md**: Title, blueprint summary, stack, env (none required), `npm install && npm run dev`, demo mode usage, source list, deployment notes (Pi via Tailscale serve), credits to original tutorial.

- [ ] **Commit + push**: `git push`.

- [ ] **Update vault status block** in `~/Sync/ObsidianTon/Inbox/Polymarket vs Wall Street Tutorial.md` with deployed URL and final test count.

---

## Self-review checklist

- [x] All 4 pairs covered (Fed May, Fed Jun, BTC, SPX)
- [x] All 4 sources covered
- [x] Black-Scholes + cumulative normal both implemented
- [x] Demo mode includes >15pp pair
- [x] 5-min server cache, 30s client poll
- [x] Spread red threshold 10pp
- [x] Sparkline 7-day history
- [x] JetBrains Mono + dark theme
