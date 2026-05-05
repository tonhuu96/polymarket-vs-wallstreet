import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@/lib/sources/polymarket', () => ({
  fetchPolymarketYes: vi.fn(async (slug: string) => {
    // Deterministic per-slug values so we can assert spread = poly - wall.
    const map: Record<string, number> = {
      'fed-decision-in-may-2026': 25,
      'fed-decision-in-june-2026': 50,
      'will-bitcoin-reach-100000-by-june-30-2026': 70,
      'sp-500-above-7000-by-december-31-2026': 40,
    };
    if (slug in map) return map[slug];
    throw new Error(`unexpected slug ${slug}`);
  }),
}));

vi.mock('@/lib/sources/cme-fedwatch', () => ({
  fetchFedWatchCutProb: vi.fn(async (m: 'may-2026' | 'jun-2026') =>
    m === 'may-2026' ? 20 : 60,
  ),
}));

vi.mock('@/lib/sources/deribit', () => ({
  fetchDeribitProbability: vi.fn(async () => 55),
}));

vi.mock('@/lib/sources/yahoo-spy', () => ({
  fetchSpyImpliedAbove: vi.fn(async () => 42),
}));

describe('GET /api/markets', () => {
  let originalEnv: string | undefined;
  let path: string;

  beforeEach(() => {
    originalEnv = process.env.HISTORY_FILE;
    path = join(
      tmpdir(),
      `pmws-route-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    process.env.HISTORY_FILE = path;
  });

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.HISTORY_FILE;
    else process.env.HISTORY_FILE = originalEnv;
    await rm(path, { force: true });
  });

  it('demo=1 returns the hardcoded snapshot', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/markets?demo=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.pairs).toHaveLength(4);
    expect(body.pairs.every((p: { demo: boolean }) => p.demo)).toBe(true);
  });

  it('live mode returns 4 pairs with computed spreads and demo:false', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/api/markets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(false);
    expect(body.pairs).toHaveLength(4);

    const byId = Object.fromEntries(
      body.pairs.map((p: { id: string }) => [p.id, p]),
    ) as Record<
      string,
      { polymarket: number; wallstreet: number; spread: number; demo: boolean }
    >;

    // poly − wall, all from the mocks above.
    expect(byId['fed-may']).toMatchObject({ polymarket: 25, wallstreet: 20, spread: 5, demo: false });
    expect(byId['fed-jun']).toMatchObject({ polymarket: 50, wallstreet: 60, spread: -10, demo: false });
    expect(byId['btc-100k']).toMatchObject({ polymarket: 70, wallstreet: 55, spread: 15, demo: false });
    expect(byId['spx-7000']).toMatchObject({ polymarket: 40, wallstreet: 42, spread: -2, demo: false });

    // updatedAt should parse as a recent ISO timestamp.
    expect(typeof body.updatedAt).toBe('string');
    expect(Number.isFinite(new Date(body.updatedAt).getTime())).toBe(true);
  });
});
