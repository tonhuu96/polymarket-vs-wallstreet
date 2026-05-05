/**
 * Pure Black–Scholes helpers.
 *
 * - `normCdf` is the cumulative distribution function of the standard normal,
 *   approximated via Abramowitz & Stegun 26.2.17 (max abs error ≈ 7.5e-8).
 * - `probabilityAboveStrike` is the risk-neutral P(S_T > K) under GBM, which
 *   is exactly N(d2). Used as a "Wall-Street-implied probability" for binary
 *   above-strike events when an option's IV is observable.
 */

/**
 * Standard normal CDF via Abramowitz & Stegun 26.2.17.
 *
 * The polynomial approximation gives the upper-tail probability for x >= 0;
 * we mirror it for negative inputs.
 */
export function normCdf(x: number): number {
  // Constants from A&S 26.2.17
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const pdf = Math.exp(-0.5 * absX * absX) / Math.sqrt(2 * Math.PI);
  const upperTail = pdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);

  // For x >= 0, N(x) = 1 - upperTail. By symmetry, N(-x) = upperTail.
  return x >= 0 ? 1 - upperTail : upperTail;
}

export interface ProbabilityAboveStrikeArgs {
  /** Current underlying price. */
  spot: number;
  /** Strike price. */
  strike: number;
  /** Time to expiry, in years. */
  t: number;
  /** Annualised volatility (e.g. 0.3 for 30%). */
  vol: number;
  /** Risk-free rate (default 0). */
  r?: number;
}

/**
 * Risk-neutral probability that S_T > K under GBM.
 *
 * Derivation: under risk-neutral measure, ln(S_T / S_0) ~ N((r - vol^2/2)·t, vol^2·t).
 * So P(S_T > K) = N(d2) where d2 = [ln(S/K) + (r - vol^2/2)·t] / (vol·sqrt(t)).
 */
export function probabilityAboveStrike(args: ProbabilityAboveStrikeArgs): number {
  const { spot, strike, t, vol } = args;
  const r = args.r ?? 0;

  if (spot <= 0 || strike <= 0 || t <= 0 || vol <= 0) {
    throw new Error('probabilityAboveStrike requires spot, strike, t, vol > 0');
  }

  const d2 = (Math.log(spot / strike) + (r - 0.5 * vol * vol) * t) / (vol * Math.sqrt(t));
  return normCdf(d2);
}
