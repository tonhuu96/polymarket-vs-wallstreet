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
 * The four matched binary events, verified against Polymarket Gamma on
 * 2026-05-05. The May 2026 FOMC market the original tutorial referenced
 * is no longer tradeable; the original BTC > $100k market closed once BTC
 * cleared that level — both were re-pointed at the next active strikes.
 *
 * Re-verify before any redeploy:
 *   curl -s 'https://gamma-api.polymarket.com/markets?slug=<slug>'
 */
export const PAIRS: readonly PairConfig[] = [
  {
    id: 'fed-jun',
    label: 'Fed cut at June 2026 FOMC',
    polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-june-2026-meeting',
    wallstreetMethod: 'cme-fedwatch',
    expiry: '2026-06-17T18:00:00.000Z',
    tradable: 'Long Polymarket / Short FedWatch',
  },
  {
    id: 'fed-jul',
    label: 'Fed cut at July 2026 FOMC',
    polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-july-2026-meeting',
    wallstreetMethod: 'cme-fedwatch',
    expiry: '2026-07-29T18:00:00.000Z',
    tradable: 'Long Polymarket / Short FedWatch',
  },
  {
    id: 'btc-150k',
    label: 'Bitcoin above $150,000 by Dec 31, 2026',
    polymarketSlug: 'will-bitcoin-hit-150k-by-december-31-2026',
    wallstreetMethod: 'deribit-bs',
    expiry: '2026-12-31T08:00:00.000Z',
    strike: 150000,
    tradable: 'Long Deribit calls / Short Polymarket',
  },
  {
    id: 'spx-7400',
    label: 'S&P 500 hits 7,400 by Dec 31, 2026',
    polymarketSlug: 'spx-hit-7400-high-dec-2026',
    wallstreetMethod: 'yahoo-spy-bs',
    expiry: '2026-12-31T21:00:00.000Z',
    // SPX target 7400 ↔ SPY 740 (×10). Source clients convert as needed.
    strike: 7400,
    tradable: 'Long Polymarket / Short SPY puts',
  },
] as const;
