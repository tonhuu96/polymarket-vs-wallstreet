/**
 * Polymarket source client.
 *
 * Polymarket exposes a public Gamma API at `gamma-api.polymarket.com/markets`
 * keyed by slug. The market payload encodes outcome prices as a JSON-encoded
 * string (e.g. `"[\"0.42\",\"0.58\"]"`) — the first element is the YES leg.
 *
 * We return the YES probability as a percentage (0..100). Throws on 404,
 * empty results, or malformed payloads.
 */

import { z } from 'zod';

const MarketSchema = z.object({
  outcomePrices: z.string(),
});

const MarketsArraySchema = z.array(MarketSchema);

const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com/markets';

/**
 * Fetch the YES probability for a Polymarket market by slug.
 *
 * @returns YES probability in 0..100.
 */
export async function fetchPolymarketYes(slug: string): Promise<number> {
  const url = `${POLYMARKET_GAMMA}?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) {
    throw new Error(`Polymarket fetch failed for slug ${slug}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const parsed = MarketsArraySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Polymarket payload invalid for slug ${slug}: ${parsed.error.message}`);
  }

  if (parsed.data.length === 0) {
    throw new Error(`Polymarket returned no markets for slug ${slug}`);
  }

  const first = parsed.data[0];
  let prices: unknown;
  try {
    prices = JSON.parse(first.outcomePrices);
  } catch (err) {
    throw new Error(
      `Polymarket outcomePrices not valid JSON for slug ${slug}: ${(err as Error).message}`,
    );
  }

  if (!Array.isArray(prices) || prices.length === 0) {
    throw new Error(`Polymarket outcomePrices empty/non-array for slug ${slug}`);
  }

  const yes = Number(prices[0]);
  if (!Number.isFinite(yes)) {
    throw new Error(`Polymarket YES price not numeric for slug ${slug}: ${String(prices[0])}`);
  }

  return yes * 100;
}
