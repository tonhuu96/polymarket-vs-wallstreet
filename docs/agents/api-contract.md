# API contract

Machine-readable contract for any agent runtime consuming this dashboard.

The dashboard exposes two HTTP endpoints. Both are GET, JSON, no auth, idempotent.

| Endpoint | Purpose | Cache (server) |
|----------|---------|----------------|
| `/api/markets` | Live snapshot of all 4 pairs | 5 min |
| `/api/history` | 7-day spread history per pair | 5 min |

Reach the dashboard at:

- **Local dev**: `http://localhost:3000`
- **Tailscale serve (Pi)**: `https://raspberrypi.tail01eb90.ts.net:8443`

If your runtime is on the same tailnet, use the Tailscale URL. Otherwise run the dashboard locally or proxy.

---

## `GET /api/markets`

Returns the bundle of 4 matched pairs with current probabilities and spread.

### Query parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `demo` | `'1' \| absent` | absent | When `1`, returns the hardcoded demo snapshot. Use only for testing your integration. |

### Response: `MarketsResponse`

```json
{
  "pairs": [
    {
      "id": "fed-jun",
      "label": "Fed cut at June 2026 FOMC",
      "tradable": "Long Polymarket / Short FedWatch",
      "expiry": "2026-06-17T18:00:00.000Z",
      "polymarket": 2.95,
      "wallstreet": 5.0,
      "spread": -2.05,
      "demo": false
    },
    {
      "id": "fed-jul",
      "label": "Fed cut at July 2026 FOMC",
      "tradable": "Long Polymarket / Short FedWatch",
      "expiry": "2026-07-29T18:00:00.000Z",
      "polymarket": 3.25,
      "wallstreet": 12.0,
      "spread": -8.75,
      "demo": false
    },
    {
      "id": "btc-150k",
      "label": "Bitcoin above $150,000 by Dec 31, 2026",
      "tradable": "Long Deribit calls / Short Polymarket",
      "expiry": "2026-12-31T08:00:00.000Z",
      "polymarket": 9.5,
      "wallstreet": 4.64,
      "spread": 4.86,
      "demo": false
    },
    {
      "id": "spx-7400",
      "label": "S&P 500 hits 7,400 by Dec 31, 2026",
      "tradable": "Long Polymarket / Short SPY puts",
      "expiry": "2026-12-31T21:00:00.000Z",
      "polymarket": 80.5,
      "wallstreet": 41.19,
      "spread": 39.31,
      "demo": false
    }
  ],
  "updatedAt": "2026-05-05T15:18:00.000Z",
  "demo": false
}
```

### Field semantics

| Field | Type | Range | Notes |
|-------|------|-------|-------|
| `pairs[].id` | `'fed-jun' \| 'fed-jul' \| 'btc-150k' \| 'spx-7400'` | — | Stable identifier. Treat as enum. |
| `pairs[].label` | `string` | — | Human-readable event description. |
| `pairs[].tradable` | `string` | — | Suggested directional trade copy. **Editorial; do not trade off this verbatim.** |
| `pairs[].expiry` | `string` (ISO 8601) | — | Resolution / option expiry instant. |
| `pairs[].polymarket` | `number` | `[0, 100]` | Polymarket-implied probability, **percent**. |
| `pairs[].wallstreet` | `number` | `[0, 100]` | Wall-Street-implied probability, **percent**. |
| `pairs[].spread` | `number` | `[-100, 100]` | `polymarket - wallstreet`, in **percentage points**, signed. |
| `pairs[].demo` | `boolean` | — | When `true`, this individual pair fell back to the hardcoded snapshot (one of its sources failed). The rest of the bundle is still live. |
| `updatedAt` | `string` (ISO 8601) | — | When the bundle was assembled by the server. |
| `demo` | `boolean` | — | When `true`, the entire bundle is the hardcoded snapshot. Only happens via `?demo=1`. |

### Status codes

| Code | Meaning |
|------|---------|
| `200` | Always (per-pair failures are absorbed via demo fallback, not surfaced as errors). |
| `5xx` | Genuine dashboard failure. Retry with backoff. |

### Curl

```bash
curl -s 'http://localhost:3000/api/markets'
curl -s 'http://localhost:3000/api/markets?demo=1'
```

---

## `GET /api/history`

Returns up to 7 days of recent spread values per pair, used by the dashboard's sparklines. Each pair gets one entry per UTC day; the most recent value for a given UTC day overwrites earlier values for that day.

### Response: `HistoryResponse`

```json
{
  "fed-jun":   [{ "date": "2026-04-29", "spread": -1.4 }, { "date": "2026-04-30", "spread": -2.0 }],
  "fed-jul":   [{ "date": "2026-04-29", "spread": -7.1 }],
  "btc-150k":  [],
  "spx-7400":  [{ "date": "2026-04-30", "spread": 38.2 }]
}
```

### Field semantics

| Field | Type | Notes |
|-------|------|-------|
| top-level keys | `PairId` | Same enum as `/api/markets`. |
| `[].date` | `string` (`YYYY-MM-DD`, UTC) | One row per UTC day. |
| `[].spread` | `number` | Same percentage-point semantics as `/api/markets`. |

### Curl

```bash
curl -s 'http://localhost:3000/api/history'
```

---

## Caching

- Both endpoints carry `revalidate = 300` server-side. Polling faster than every ~30s is wasted requests.
- The dashboard's frontend polls `/api/markets` every 30 s and `/api/history` every 60 s. **An agent should match or be slower** — generally every 60–300 s is appropriate.
- Per-source caches (Polymarket, Deribit, Yahoo, FedWatch) are also gated at 5 min. If you hammer the endpoint you'll get cached values back.

---

## Error handling

The API is designed so that consumers can poll and trust the response shape. Specifically:

- A failing data source for one pair does NOT take down `/api/markets`. The pair gets `demo: true` and a hardcoded value; the bundle's outer `demo: false` stays.
- The dashboard never returns partial JSON. Any non-200 means the dashboard itself is unreachable.
- An agent should treat per-pair `demo: true` the way the UI does: dim it, mention it as "fallback", do not generate trading commentary off it.

---

## Source provenance per pair

For agents that want to attribute their commentary:

| Pair | Polymarket source | Wall Street source |
|------|-------------------|--------------------|
| `fed-jun` | Polymarket Gamma — `will-the-fed-decrease-interest-rates-by-25-bps-after-the-june-2026-meeting` | CME FedWatch (currently hardcoded fallback) |
| `fed-jul` | Polymarket Gamma — `will-the-fed-decrease-interest-rates-by-25-bps-after-the-july-2026-meeting` | CME FedWatch (currently hardcoded fallback) |
| `btc-150k` | Polymarket Gamma — `will-bitcoin-hit-150k-by-december-31-2026` | Deribit BTC option chain → Black-Scholes N(d2) |
| `spx-7400` | Polymarket Gamma — `spx-hit-7400-high-dec-2026` | yfinance SPY option chain → Black-Scholes N(d2), via Python sidecar |

The CME FedWatch line is the weakest — there is no formally documented JSON endpoint, so it currently falls through to hardcoded values (`jun-2026: 5%`, `jul-2026: 12%`). Treat Fed wallstreet probabilities as advisory until the live source is wired.

---

## Versioning

This contract is the source of truth. If you need a stable contract version, pin against the commit SHA — once the repo cuts a `v0.x` tag, this doc will note the matching schema.

If a field changes shape, the response will fail Zod validation server-side and the route returns 5xx — no silent contract drift.
