import type { MarketsResponse, PairSnapshot } from './types';

/** Fixed timestamp so tests and screenshots are deterministic. */
const DEMO_UPDATED_AT = '2026-05-05T17:00:00.000Z';

/**
 * Hardcoded "what the live bundle would look like" snapshot.
 *
 * Values below are seeded from real Polymarket Gamma readings on 2026-05-05
 * and rounded for stability. Wall-Street values are conservative estimates.
 * The spx-7400 pair is the >15pp divergence used to drive the hero panel.
 */
const DEMO_PAIRS: PairSnapshot[] = [
  {
    id: 'fed-jun',
    label: 'Fed cut at June 2026 FOMC',
    tradable: 'Long Polymarket / Short FedWatch',
    expiry: '2026-06-17T18:00:00.000Z',
    polymarket: 3.0,
    wallstreet: 5.0,
    spread: -2.0,
    demo: true,
  },
  {
    id: 'fed-jul',
    label: 'Fed cut at July 2026 FOMC',
    tradable: 'Long Polymarket / Short FedWatch',
    expiry: '2026-07-29T18:00:00.000Z',
    polymarket: 3.5,
    wallstreet: 12.0,
    spread: -8.5,
    demo: true,
  },
  {
    id: 'btc-150k',
    label: 'Bitcoin above $150,000 by Dec 31, 2026',
    tradable: 'Long Deribit calls / Short Polymarket',
    expiry: '2026-12-31T08:00:00.000Z',
    polymarket: 9.5,
    wallstreet: 22.0,
    spread: -12.5,
    demo: true,
  },
  {
    id: 'spx-7400',
    label: 'S&P 500 hits 7,400 by Dec 31, 2026',
    tradable: 'Long Polymarket / Short SPY puts',
    expiry: '2026-12-31T21:00:00.000Z',
    polymarket: 80.5,
    wallstreet: 60.0,
    spread: 20.5, // |spread| > 15 — drives the hero "biggest divergence" tile
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
