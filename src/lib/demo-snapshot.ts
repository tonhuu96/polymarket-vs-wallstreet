import type { MarketsResponse, PairSnapshot } from './types';

/** Fixed timestamp so tests and screenshots are deterministic. */
const DEMO_UPDATED_AT = '2026-05-05T17:00:00.000Z';

/**
 * Hardcoded "what the live bundle would look like" snapshot.
 *
 * The plan requires:
 *  - exactly 4 pairs (one per PairId)
 *  - at least one pair with |spread| > 15pp
 *  - `demo: true` on the response and on every pair
 *  - deterministic `updatedAt`
 *
 * Values below are realistic-ish (Polymarket tends to overweight short-term
 * Fed cuts; Wall Street has historically discounted them). The fed-jun pair
 * is the >15pp divergence used to drive the hero panel in demo mode.
 */
const DEMO_PAIRS: PairSnapshot[] = [
  {
    id: 'fed-may',
    label: 'Fed cut at May 2026 FOMC',
    tradable: 'Long Polymarket / Short FedWatch',
    expiry: '2026-05-13T18:00:00.000Z',
    polymarket: 22.0,
    wallstreet: 18.0,
    spread: 4.0,
    demo: true,
  },
  {
    id: 'fed-jun',
    label: 'Fed cut at June 2026 FOMC',
    tradable: 'Long FedWatch / Short Polymarket',
    expiry: '2026-06-17T18:00:00.000Z',
    polymarket: 46.0,
    wallstreet: 64.0,
    spread: -18.0, // |spread| > 15 — drives the hero "biggest divergence" tile
    demo: true,
  },
  {
    id: 'btc-100k',
    label: 'Bitcoin above $100,000 by Jun 30, 2026',
    tradable: 'Long Polymarket / Short Deribit calls',
    expiry: '2026-06-30T08:00:00.000Z',
    polymarket: 71.0,
    wallstreet: 58.0,
    spread: 13.0,
    demo: true,
  },
  {
    id: 'spx-7000',
    label: 'S&P 500 above 7,000 by Dec 31, 2026',
    tradable: 'Long SPY calls / Short Polymarket',
    expiry: '2026-12-31T21:00:00.000Z',
    polymarket: 38.0,
    wallstreet: 42.0,
    spread: -4.0,
    demo: true,
  },
];

export function getDemoSnapshot(): MarketsResponse {
  // Deep-clone so consumers can't mutate the module-level constants.
  return {
    pairs: DEMO_PAIRS.map((p) => ({ ...p })),
    updatedAt: DEMO_UPDATED_AT,
    demo: true,
  };
}
