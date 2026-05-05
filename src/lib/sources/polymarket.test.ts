import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPolymarketYes } from './polymarket';

function mockFetch(response: { ok: boolean; status?: number; json?: () => unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (() => Promise.resolve(null)),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchPolymarketYes', () => {
  it('returns YES probability scaled to 0..100', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: () => Promise.resolve([{ outcomePrices: '["0.42","0.58"]' }]),
    });

    const result = await fetchPolymarketYes('some-slug');

    expect(result).toBeCloseTo(42, 10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('gamma-api.polymarket.com/markets');
    expect(calledUrl).toContain('slug=some-slug');
    expect(calledOpts).toEqual(expect.objectContaining({ next: { revalidate: 300 } }));
  });

  it('throws on 404', async () => {
    mockFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });
    await expect(fetchPolymarketYes('missing')).rejects.toThrow(/HTTP 404/);
  });

  it('throws on empty array', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve([]) });
    await expect(fetchPolymarketYes('empty')).rejects.toThrow(/no markets/);
  });

  it('throws when outcomePrices is malformed JSON', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve([{ outcomePrices: 'not-json' }]),
    });
    await expect(fetchPolymarketYes('bad')).rejects.toThrow(/not valid JSON/);
  });

  it('throws when payload shape is invalid', async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve([{ wrong: 'shape' }]),
    });
    await expect(fetchPolymarketYes('shape')).rejects.toThrow(/payload invalid/);
  });
});
