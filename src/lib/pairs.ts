import type { PairId } from './types';

/**
 * How the Wall-Street-implied probability is derived for a pair.
 * - `cme-fedwatch`: scrape CME's FedWatch tool for FOMC cut probability.
 * - `deribit-bs`:   pull BTC option chain from Deribit, derive IV, then Black–Scholes N(d2).
 * - `yahoo-spy-bs`: pull SPY option chain from Yahoo Finance, derive IV, then Black–Scholes N(d2).
 */
export type WallStreetMethod = 'cme-fedwatch' | 'deribit-bs' | 'yahoo-spy-bs';

export interface PairConfig {
  id: PairId;
  /** Human-readable event label. */
  label: string;
  /** Polymarket market slug (used by gamma-api `?slug=`). */
  polymarketSlug: string;
  /** How the Wall-Street side is computed. */
  wallstreetMethod: WallStreetMethod;
  /** ISO 8601 event resolution / option expiry. */
  expiry: string;
  /** Strike price for option-derived methods (omitted for Fed pairs). */
  strike?: number;
  /** Suggested arbitrage / divergence trade copy. */
  tradable: string;
}

/**
 * The four matched binary events.
 *
 * NOTE on slugs: Polymarket renames markets frequently — every slug below
 * MUST be re-verified against `https://polymarket.com/event/<slug>` (or via
 * `https://gamma-api.polymarket.com/markets?slug=<slug>`) before any live
 * deployment. If the canonical slug changes, only this file needs editing.
 */
export const PAIRS: readonly PairConfig[] = [
  {
    id: 'fed-may',
    label: 'Fed cut at May 2026 FOMC',
    polymarketSlug: 'fed-decision-in-may-2026',
    wallstreetMethod: 'cme-fedwatch',
    expiry: '2026-05-13T18:00:00.000Z',
    tradable: 'Long Polymarket / Short FedWatch',
  },
  {
    id: 'fed-jun',
    label: 'Fed cut at June 2026 FOMC',
    polymarketSlug: 'fed-decision-in-june-2026',
    wallstreetMethod: 'cme-fedwatch',
    expiry: '2026-06-17T18:00:00.000Z',
    tradable: 'Long FedWatch / Short Polymarket',
  },
  {
    id: 'btc-100k',
    label: 'Bitcoin above $100,000 by Jun 30, 2026',
    polymarketSlug: 'will-bitcoin-reach-100000-by-june-30-2026',
    wallstreetMethod: 'deribit-bs',
    expiry: '2026-06-30T08:00:00.000Z',
    strike: 100000,
    tradable: 'Long Polymarket / Short Deribit calls',
  },
  {
    id: 'spx-7000',
    label: 'S&P 500 above 7,000 by Dec 31, 2026',
    polymarketSlug: 'sp-500-above-7000-by-december-31-2026',
    wallstreetMethod: 'yahoo-spy-bs',
    expiry: '2026-12-31T21:00:00.000Z',
    // SPX target 7000 ↔ SPY 700 (×10). Source clients convert as needed.
    strike: 7000,
    tradable: 'Long SPY calls / Short Polymarket',
  },
] as const;
