/**
 * GET /api/markets
 *
 * Aggregates the four matched binary events into a single bundle:
 *   - `?demo=1` → returns the hardcoded demo snapshot (no live calls).
 *   - otherwise → fans out to the four source clients in parallel, computes
 *     the spread, persists today's spread for sparklines, and returns the
 *     bundle. If a single pair fails on either side, that pair falls back to
 *     its demo value with `demo: true` flagged so the UI can dim it; the rest
 *     of the bundle stays live.
 *
 * Server-side caching: 5-minute revalidate at the route level, plus
 * `next: { revalidate: 300 }` on every inner `fetch` (set by source clients).
 * Next.js 16 Route Handlers are NOT cached by default — `revalidate` is
 * required.
 */

import { getDemoSnapshot } from '@/lib/demo-snapshot';
import { appendDailySpread } from '@/lib/history';
import { PAIRS, type PairConfig } from '@/lib/pairs';
import { fetchFedWatchCutProb } from '@/lib/sources/cme-fedwatch';
import { fetchDeribitProbability } from '@/lib/sources/deribit';
import { fetchPolymarketYes } from '@/lib/sources/polymarket';
import { fetchSpyImpliedAbove } from '@/lib/sources/yahoo-spy';
import { spreadPp } from '@/lib/spread';
import type { MarketsResponse, PairId, PairSnapshot } from '@/lib/types';

export const revalidate = 300;

/** Resolve the wall-street-side probability for a pair using its configured method. */
async function fetchWallstreet(pair: PairConfig): Promise<number> {
  switch (pair.wallstreetMethod) {
    case 'cme-fedwatch': {
      if (pair.id === 'fed-jun') return fetchFedWatchCutProb('jun-2026');
      if (pair.id === 'fed-jul') return fetchFedWatchCutProb('jul-2026');
      throw new Error(`cme-fedwatch dispatch missing for pair ${pair.id}`);
    }
    case 'deribit-bs': {
      if (pair.strike === undefined) {
        throw new Error(`deribit-bs requires a strike on pair ${pair.id}`);
      }
      return fetchDeribitProbability({ strike: pair.strike, expiryIso: pair.expiry });
    }
    case 'yahoo-spy-bs': {
      if (pair.strike === undefined) {
        throw new Error(`yahoo-spy-bs requires a strike on pair ${pair.id}`);
      }
      return fetchSpyImpliedAbove({
        targetIndexLevel: pair.strike,
        expiryIso: pair.expiry,
      });
    }
  }
}

/**
 * Build a snapshot for a single pair. On any source failure (either side)
 * fall back to the demo value for that pair and tag it `demo: true`.
 */
async function buildLivePair(pair: PairConfig): Promise<PairSnapshot> {
  try {
    const [poly, wall] = await Promise.all([
      fetchPolymarketYes(pair.polymarketSlug),
      fetchWallstreet(pair),
    ]);
    return {
      id: pair.id,
      label: pair.label,
      tradable: pair.tradable,
      expiry: pair.expiry,
      polymarket: poly,
      wallstreet: wall,
      spread: spreadPp(poly, wall),
      demo: false,
    };
  } catch {
    const demoSnap = getDemoSnapshot().pairs.find((p) => p.id === pair.id);
    if (!demoSnap) {
      // Should be unreachable — demo snapshot covers every PairId.
      throw new Error(`No demo fallback registered for pair ${pair.id}`);
    }
    return { ...demoSnap, demo: true };
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get('demo') === '1') {
    return Response.json(getDemoSnapshot() satisfies MarketsResponse);
  }

  const pairs = await Promise.all(PAIRS.map(buildLivePair));

  // Persist only successful (non-demo) spreads so sparklines reflect real data.
  await Promise.all(
    pairs
      .filter((p): p is PairSnapshot & { id: PairId } => !p.demo)
      .map((p) => appendDailySpread(p.id, p.spread)),
  );

  const body: MarketsResponse = {
    pairs,
    updatedAt: new Date().toISOString(),
    demo: false,
  };
  return Response.json(body);
}
