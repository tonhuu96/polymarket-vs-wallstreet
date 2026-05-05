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

describe('fetchSpyImpliedAbove', () => {
  it('selects the call closest to SPY-equivalent strike and returns a probability in [0,100]', async () => {
    // expiry one year out
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    const expiryIso = expiry.toISOString();
    const expirationUnix = Math.floor(expiry.getTime() / 1000);

    const fetchMock = mockFetch({
      optionChain: {
        result: [
          {
            quote: { regularMarketPrice: 680 },
            options: [
              {
                calls: [
                  { strike: 650, impliedVolatility: 0.18, expiration: expirationUnix },
                  { strike: 700, impliedVolatility: 0.2, expiration: expirationUnix },
                  { strike: 750, impliedVolatility: 0.22, expiration: expirationUnix },
                ],
              },
            ],
          },
        ],
      },
    });

    const result = await fetchSpyImpliedAbove({
      targetIndexLevel: 7000,
      expiryIso,
    });

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
    // Spot 680 < strike 700 with ~20% vol, ~1y -> roughly 30-50%.
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThan(60);

    // Verify Mozilla UA and revalidate options were sent.
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain('query2.finance.yahoo.com');
    expect(calledOpts).toEqual(
      expect.objectContaining({
        next: { revalidate: 300 },
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('Mozilla') }),
      }),
    );
  });

  it('throws when calls array is empty', async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);

    mockFetch({
      optionChain: {
        result: [
          {
            quote: { regularMarketPrice: 680 },
            options: [{ calls: [] }],
          },
        ],
      },
    });

    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7000, expiryIso: expiry.toISOString() }),
    ).rejects.toThrow(/no calls/);
  });

  it('throws on HTTP error', async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);

    mockFetch({}, false, 500);
    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7000, expiryIso: expiry.toISOString() }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it('throws on malformed payload', async () => {
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);

    mockFetch({ optionChain: { wrong: 'shape' } });
    await expect(
      fetchSpyImpliedAbove({ targetIndexLevel: 7000, expiryIso: expiry.toISOString() }),
    ).rejects.toThrow(/payload invalid/);
  });
});
