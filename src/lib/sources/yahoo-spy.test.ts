import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSpyImpliedAbove } from './yahoo-spy';

function mockFetch(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchSpyImpliedAbove (sidecar)', () => {
  it('returns the sidecar probability when the response is valid', async () => {
    const fetchMock = mockFetch({
      probability: 41.19,
      spot: 723.48,
      strike: 740,
      iv: 0.193,
      t_years: 0.655,
      expiry: '2026-12-31',
    });

    const result = await fetchSpyImpliedAbove({
      targetIndexLevel: 7400,
      expiryIso: '2026-12-31T21:00:00Z',
    });

    expect(result).toBeCloseTo(41.19, 5);

    // Verify the sidecar URL was assembled correctly.
    const [calledUrl] = fetchMock.mock.calls[0];
    const u = new URL(String(calledUrl));
    expect(u.host).toBe('127.0.0.1:7301');
    expect(u.pathname).toBe('/spy');
    expect(u.searchParams.get('target_index')).toBe('7400');
    expect(u.searchParams.get('expiry')).toBe('2026-12-31');
  });

  it('honors YFINANCE_SIDECAR_URL', async () => {
    const fetchMock = mockFetch({
      probability: 50,
      spot: 700,
      strike: 700,
      iv: 0.2,
      t_years: 0.5,
      expiry: '2026-12-31',
    });

    const prev = process.env.YFINANCE_SIDECAR_URL;
    process.env.YFINANCE_SIDECAR_URL = 'http://example.test:9999';
    try {
      await fetchSpyImpliedAbove({ targetIndexLevel: 7000, expiryIso: '2026-12-31T21:00:00Z' });
      const [calledUrl] = fetchMock.mock.calls[0];
      const u = new URL(String(calledUrl));
      expect(u.host).toBe('example.test:9999');
    } finally {
      if (prev === undefined) delete process.env.YFINANCE_SIDECAR_URL;
      else process.env.YFINANCE_SIDECAR_URL = prev;
    }
  });

  it('throws on HTTP error so the route handler can fall back to demo', async () => {
    mockFetch({}, false, 502);
    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7400, expiryIso: '2026-12-31T21:00:00Z' }),
    ).rejects.toThrow(/HTTP 502/);
  });

  it('throws on malformed payload', async () => {
    mockFetch({ wrong: 'shape' });
    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7400, expiryIso: '2026-12-31T21:00:00Z' }),
    ).rejects.toThrow(/payload invalid/);
  });

  it('throws when probability is out of [0,100]', async () => {
    mockFetch({
      probability: 150,
      spot: 700,
      strike: 700,
      iv: 0.2,
      t_years: 0.5,
      expiry: '2026-12-31',
    });
    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7400, expiryIso: '2026-12-31T21:00:00Z' }),
    ).rejects.toThrow(/out-of-range/);
  });
});
