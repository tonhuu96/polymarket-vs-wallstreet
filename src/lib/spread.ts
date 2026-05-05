import type { PairSnapshot } from './types';

/**
 * Percentage-point spread: Polymarket probability minus Wall-Street probability.
 * Both inputs are 0..100. Output is signed pp.
 */
export function spreadPp(poly: number, wall: number): number {
  return poly - wall;
}

/**
 * "Large" spread threshold for UI emphasis. The plan defines large as
 * strictly greater than 10pp absolute — boundary 10 is NOT large.
 */
export function isLargeSpread(s: number): boolean {
  return Math.abs(s) > 10;
}

/**
 * Pick the pair with the largest absolute spread. Signed values are compared
 * by magnitude so a -18pp pair beats a +12pp pair.
 *
 * Throws on an empty array — callers should always have at least one pair.
 */
export function largestSpread(pairs: PairSnapshot[]): PairSnapshot {
  if (pairs.length === 0) {
    throw new Error('largestSpread requires a non-empty pairs array');
  }
  return pairs.reduce((a, b) => (Math.abs(b.spread) > Math.abs(a.spread) ? b : a));
}
