/**
 * SPY-options-implied probability via the local yfinance sidecar.
 *
 * Yahoo's public options endpoint now requires an anti-scrape "crumb" token
 * tied to a session cookie, so we delegate to a small Python service that uses
 * the `yfinance` library (which handles the cookie/crumb dance internally).
 *
 * The sidecar lives in `sidecar/yfinance_spy.py` and runs on
 * `http://127.0.0.1:7301` (overridable via `YFINANCE_SIDECAR_URL`).
 *
 * Returns 0..100. Throws on any failure so the per-pair demo fallback in
 * the route handler can take over.
 */

import { z } from 'zod';

const SidecarResponseSchema = z.object({
  probability: z.number(),
  spot: z.number(),
  strike: z.number(),
  iv: z.number(),
  t_years: z.number(),
  expiry: z.string(),
});

export interface YahooSpyArgs {
  /** SPX target index level (e.g. 7400). Sidecar divides by 10 for SPY. */
  targetIndexLevel: number;
  /** ISO 8601 expiry. */
  expiryIso: string;
}

const TIMEOUT_MS = 8_000;

function sidecarBase(): string {
  return process.env.YFINANCE_SIDECAR_URL ?? 'http://127.0.0.1:7301';
}

/**
 * Compute the Wall-Street-implied probability that SPX hits
 * `targetIndexLevel` by `expiryIso`, derived from SPY's option chain.
 */
export async function fetchSpyImpliedAbove(args: YahooSpyArgs): Promise<number> {
  const { targetIndexLevel, expiryIso } = args;
  const date = new Date(expiryIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`yahoo-spy: invalid expiryIso ${expiryIso}`);
  }
  const expiryDay = date.toISOString().slice(0, 10); // YYYY-MM-DD

  const url = new URL('/spy', sidecarBase());
  url.searchParams.set('target_index', String(targetIndexLevel));
  url.searchParams.set('expiry', expiryDay);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      throw new Error(`yfinance sidecar returned HTTP ${res.status}`);
    }
    const json = await res.json();
    const parsed = SidecarResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`yfinance sidecar payload invalid: ${parsed.error.message}`);
    }
    const prob = parsed.data.probability;
    if (!Number.isFinite(prob) || prob < 0 || prob > 100) {
      throw new Error(`yfinance sidecar returned out-of-range probability ${prob}`);
    }
    return prob;
  } finally {
    clearTimeout(timeout);
  }
}
