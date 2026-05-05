/**
 * Yahoo Finance SPY options source client.
 *
 * SPY tracks ~1/10th of SPX, so we convert an SPX target like 7000 into a
 * SPY target of 700, then read the SPY option chain at the requested expiry.
 * We pick the call whose strike is closest to the SPY target, take its
 * implied volatility (Yahoo returns it as a decimal already), and feed
 * spot/strike/IV/time into `probabilityAboveStrike`.
 *
 * Yahoo blocks unknown user agents on `query2.finance.yahoo.com`, so we send
 * a Mozilla UA. Returns 0..100. Throws when the chain is empty.
 */

import { z } from 'zod';
import { probabilityAboveStrike } from '../black-scholes';

const CallSchema = z.object({
  strike: z.number(),
  impliedVolatility: z.number(),
  expiration: z.number(),
});

const ChainResultSchema = z.object({
  quote: z.object({
    regularMarketPrice: z.number(),
  }),
  options: z.array(
    z.object({
      calls: z.array(CallSchema),
    }),
  ),
});

const YahooChainSchema = z.object({
  optionChain: z.object({
    result: z.array(ChainResultSchema),
  }),
});

export interface YahooSpyArgs {
  /** SPX target index level (e.g. 7000). Will be divided by 10 for SPY. */
  targetIndexLevel: number;
  /** ISO 8601 expiry. */
  expiryIso: string;
}

const DAY_YEAR = 365.25;
const MS_PER_DAY = 86_400_000;

function chainUrl(unixSeconds: number): string {
  return `https://query2.finance.yahoo.com/v7/finance/options/SPY?date=${unixSeconds}`;
}

/**
 * Compute the Wall-Street-implied probability that SPX closes above
 * `targetIndexLevel` by `expiryIso`, derived from SPY's option chain.
 */
export async function fetchSpyImpliedAbove(args: YahooSpyArgs): Promise<number> {
  const { targetIndexLevel, expiryIso } = args;
  const spyTarget = targetIndexLevel / 10;

  const expiry = new Date(expiryIso);
  if (Number.isNaN(expiry.getTime())) {
    throw new Error(`Yahoo SPY: invalid expiryIso ${expiryIso}`);
  }
  const unix = Math.floor(expiry.getTime() / 1000);

  const res = await fetch(chainUrl(unix), {
    next: { revalidate: 300 },
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) {
    throw new Error(`Yahoo SPY chain fetch failed: HTTP ${res.status}`);
  }

  const json = await res.json();
  const parsed = YahooChainSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Yahoo SPY payload invalid: ${parsed.error.message}`);
  }

  const result = parsed.data.optionChain.result[0];
  if (!result) {
    throw new Error('Yahoo SPY chain returned empty result');
  }

  const calls = result.options[0]?.calls ?? [];
  if (calls.length === 0) {
    throw new Error('Yahoo SPY chain returned no calls');
  }

  // Pick call closest to SPY-equivalent target strike.
  const chosen = calls.reduce((best, c) =>
    Math.abs(c.strike - spyTarget) < Math.abs(best.strike - spyTarget) ? c : best,
  );

  const spot = result.quote.regularMarketPrice;
  const t = (expiry.getTime() - Date.now()) / MS_PER_DAY / DAY_YEAR;
  if (t <= 0) {
    throw new Error(`Yahoo SPY: expiry ${expiryIso} is in the past`);
  }

  const prob = probabilityAboveStrike({
    spot,
    strike: spyTarget,
    t,
    vol: chosen.impliedVolatility,
    r: 0,
  });
  return prob * 100;
}
