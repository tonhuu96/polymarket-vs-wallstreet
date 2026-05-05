/**
 * Deribit options source client.
 *
 * Uses Deribit's public v2 API (no auth required) to:
 *   1. Read BTC perpetual mark/last price as the spot.
 *   2. Pull the BTC option chain summary for implied vols.
 *   3. Pick the call closest to the target strike with expiry on/after the
 *      requested ISO.
 *   4. Convert mark IV (Deribit returns IV as a percentage) to a decimal,
 *      compute time-to-expiry in years, and call `probabilityAboveStrike`.
 *
 * Returns 0..100. Throws if no option matches the strike/expiry constraints.
 */

import { z } from 'zod';
import { probabilityAboveStrike } from '../black-scholes';

const TickerSchema = z.object({
  result: z.object({
    last_price: z.number(),
  }),
});

const BookSummaryItemSchema = z.object({
  instrument_name: z.string(),
  mark_iv: z.number().nullable().optional(),
});

const BookSummarySchema = z.object({
  result: z.array(BookSummaryItemSchema),
});

export interface DeribitArgs {
  /** Target strike (e.g. 100000 for $100k). */
  strike: number;
  /** ISO 8601 expiry on/after which the chosen option must expire. */
  expiryIso: string;
  /** Currency (only BTC currently supported). */
  currency?: 'BTC';
}

const DAY_YEAR = 365.25;
const MS_PER_DAY = 86_400_000;

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

interface ParsedInstrument {
  expiry: Date;
  strike: number;
  isCall: boolean;
}

/**
 * Parse a Deribit option instrument name like `BTC-30JUN26-100000-C`.
 * Returns null on any unexpected shape so callers can skip it.
 */
function parseInstrumentName(name: string): ParsedInstrument | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [, dateStr, strikeStr, typeStr] = parts;

  // Date format: DDMMMYY (e.g. 30JUN26 or 5JUL26).
  const dateMatch = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(dateStr);
  if (!dateMatch) return null;
  const day = Number(dateMatch[1]);
  const month = MONTHS[dateMatch[2]];
  const year = 2000 + Number(dateMatch[3]);
  if (month === undefined || !Number.isFinite(day)) return null;

  // Deribit options expire 08:00 UTC on the expiry date.
  const expiry = new Date(Date.UTC(year, month, day, 8, 0, 0));
  if (Number.isNaN(expiry.getTime())) return null;

  const strike = Number(strikeStr);
  if (!Number.isFinite(strike)) return null;

  if (typeStr !== 'C' && typeStr !== 'P') return null;

  return { expiry, strike, isCall: typeStr === 'C' };
}

const TICKER_URL = 'https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL';
const SUMMARY_URL =
  'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option';

/**
 * Compute the Wall-Street-implied probability that BTC closes above `strike`
 * by `expiryIso`, using Deribit option implied vols.
 */
export async function fetchDeribitProbability(args: DeribitArgs): Promise<number> {
  const { strike, expiryIso, currency = 'BTC' } = args;
  if (currency !== 'BTC') {
    throw new Error(`Deribit client currently only supports BTC, got ${currency}`);
  }

  const targetExpiry = new Date(expiryIso);
  if (Number.isNaN(targetExpiry.getTime())) {
    throw new Error(`Deribit: invalid expiryIso ${expiryIso}`);
  }

  const [tickerRes, summaryRes] = await Promise.all([
    fetch(TICKER_URL, { next: { revalidate: 300 } }),
    fetch(SUMMARY_URL, { next: { revalidate: 300 } }),
  ]);

  if (!tickerRes.ok) {
    throw new Error(`Deribit ticker fetch failed: HTTP ${tickerRes.status}`);
  }
  if (!summaryRes.ok) {
    throw new Error(`Deribit summary fetch failed: HTTP ${summaryRes.status}`);
  }

  const tickerJson = await tickerRes.json();
  const ticker = TickerSchema.safeParse(tickerJson);
  if (!ticker.success) {
    throw new Error(`Deribit ticker payload invalid: ${ticker.error.message}`);
  }
  const spot = ticker.data.result.last_price;

  const summaryJson = await summaryRes.json();
  const summary = BookSummarySchema.safeParse(summaryJson);
  if (!summary.success) {
    throw new Error(`Deribit summary payload invalid: ${summary.error.message}`);
  }

  // Filter to calls that:
  //   - parse cleanly,
  //   - are calls,
  //   - expire on/after the target expiry,
  //   - have a usable mark_iv.
  const candidates: Array<{ parsed: ParsedInstrument; markIv: number }> = [];
  for (const item of summary.data.result) {
    const parsed = parseInstrumentName(item.instrument_name);
    if (!parsed || !parsed.isCall) continue;
    if (parsed.expiry.getTime() < targetExpiry.getTime()) continue;
    const markIv = item.mark_iv;
    if (markIv === null || markIv === undefined || !Number.isFinite(markIv) || markIv <= 0) {
      continue;
    }
    candidates.push({ parsed, markIv });
  }

  if (candidates.length === 0) {
    throw new Error(
      `Deribit: no eligible call option found for strike ~${strike} expiring on/after ${expiryIso}`,
    );
  }

  // Pick the call whose strike is closest to the target.
  candidates.sort(
    (a, b) => Math.abs(a.parsed.strike - strike) - Math.abs(b.parsed.strike - strike),
  );
  const chosen = candidates[0];

  const now = Date.now();
  const t = (chosen.parsed.expiry.getTime() - now) / MS_PER_DAY / DAY_YEAR;
  if (t <= 0) {
    throw new Error(
      `Deribit: chosen option already expired (${chosen.parsed.expiry.toISOString()})`,
    );
  }

  const vol = chosen.markIv / 100; // Deribit mark_iv is in percent.
  const prob = probabilityAboveStrike({
    spot,
    strike: chosen.parsed.strike,
    t,
    vol,
    r: 0,
  });

  return prob * 100;
}
