/**
 * Core domain types for the Polymarket vs Wall Street dashboard.
 *
 * Both probability fields (`polymarket` and `wallstreet`) are in **percent**
 * (0–100), and `spread` is the percentage-point difference (poly − wall),
 * so it is also expressed in pp (range -100..100).
 */

export type PairId = 'fed-may' | 'fed-jun' | 'btc-100k' | 'spx-7000';

export type Side = 'polymarket' | 'wallstreet';

export interface PairSnapshot {
  /** Stable identifier for the matched event. */
  id: PairId;
  /** Human-friendly event label, e.g. "Fed cut at May 2026 FOMC". */
  label: string;
  /** Suggested directional trade copy, e.g. "Long Polymarket / Short FedWatch". */
  tradable: string;
  /** ISO 8601 expiry/resolution timestamp for the underlying event. */
  expiry: string;
  /** Polymarket-implied probability, 0..100 (percent). */
  polymarket: number;
  /** Wall-Street-implied probability, 0..100 (percent). */
  wallstreet: number;
  /** Polymarket − Wall Street, in percentage points (signed). */
  spread: number;
  /** True when this snapshot came from the hardcoded demo bundle. */
  demo: boolean;
}

export interface MarketsResponse {
  pairs: PairSnapshot[];
  /** ISO 8601 timestamp of when the bundle was assembled. */
  updatedAt: string;
  /** True when the entire bundle is the demo snapshot. */
  demo: boolean;
}
