import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDeribitProbability } from './deribit';

interface MockResponse {
  ok: boolean;
  status?: number;
  json: () => unknown;
}

function jsonResponse(payload: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  };
}

/**
 * Build a fetch mock that responds based on URL substrings so the order
 * of Promise.all() calls doesn't matter.
 */
function stubByUrl(routes: Array<{ match: string; response: MockResponse }>) {
  const fn = vi.fn(async (url: string) => {
    for (const route of routes) {
      if (url.includes(route.match)) return route.response;
    }
    throw new Error(`Unexpected fetch url in test: ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchDeribitProbability', () => {
  it('picks the call closest to target strike and returns a probability in [0,100]', async () => {
    // Far-future expiry so the chosen option has positive time-to-expiry.
    // Pick a date well after `now`.
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    future.setUTCMonth(5); // June
    future.setUTCDate(30);

    const day = String(future.getUTCDate()).padStart(2, '0');
    const monthName = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][
      future.getUTCMonth()
    ];
    const yy = String(future.getUTCFullYear() % 100).padStart(2, '0');
    const dateTok = `${day}${monthName}${yy}`;

    stubByUrl([
      {
        match: 'instrument_name=BTC-PERPETUAL',
        response: jsonResponse({ result: { last_price: 95_000 } }),
      },
      {
        match: 'get_book_summary_by_currency',
        response: jsonResponse({
          result: [
            { instrument_name: `BTC-${dateTok}-90000-C`, mark_iv: 60 },
            { instrument_name: `BTC-${dateTok}-100000-C`, mark_iv: 65 },
            { instrument_name: `BTC-${dateTok}-110000-C`, mark_iv: 70 },
            // Decoy: a put at the target strike — should be ignored.
            { instrument_name: `BTC-${dateTok}-100000-P`, mark_iv: 65 },
            // Decoy: invalid instrument name — should be skipped, not throw.
            { instrument_name: `garbage-name`, mark_iv: 50 },
            // Decoy: expired option — should be skipped.
            { instrument_name: `BTC-01JAN20-100000-C`, mark_iv: 50 },
          ],
        }),
      },
    ]);

    const expiryIso = new Date(
      Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 0, 0, 0),
    ).toISOString();

    const result = await fetchDeribitProbability({ strike: 100_000, expiryIso });

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
    // Spot 95k vs strike 100k with ~1y at 65% vol leaves a meaningful tail.
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThan(80);
  });

  it('throws when no call option matches the strike/expiry filter', async () => {
    stubByUrl([
      {
        match: 'instrument_name=BTC-PERPETUAL',
        response: jsonResponse({ result: { last_price: 95_000 } }),
      },
      {
        match: 'get_book_summary_by_currency',
        response: jsonResponse({
          result: [
            // Only puts; no calls available.
            { instrument_name: 'BTC-30JUN30-100000-P', mark_iv: 65 },
          ],
        }),
      },
    ]);

    await expect(
      fetchDeribitProbability({ strike: 100_000, expiryIso: '2030-06-30T00:00:00Z' }),
    ).rejects.toThrow(/no eligible call option/);
  });

  it('skips invalid instrument names and still finds a valid match', async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const day = String(future.getUTCDate()).padStart(2, '0');
    const monthName = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][
      future.getUTCMonth()
    ];
    const yy = String(future.getUTCFullYear() % 100).padStart(2, '0');
    const dateTok = `${day}${monthName}${yy}`;

    stubByUrl([
      {
        match: 'instrument_name=BTC-PERPETUAL',
        response: jsonResponse({ result: { last_price: 95_000 } }),
      },
      {
        match: 'get_book_summary_by_currency',
        response: jsonResponse({
          result: [
            { instrument_name: 'totally-invalid', mark_iv: 60 },
            { instrument_name: 'BTC-XX-not-a-date', mark_iv: 60 },
            { instrument_name: `BTC-${dateTok}-100000-C`, mark_iv: 65 },
          ],
        }),
      },
    ]);

    const expiryIso = new Date(
      Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 0, 0, 0),
    ).toISOString();

    const result = await fetchDeribitProbability({ strike: 100_000, expiryIso });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('throws on ticker HTTP error', async () => {
    stubByUrl([
      {
        match: 'instrument_name=BTC-PERPETUAL',
        response: jsonResponse({}, 500),
      },
      {
        match: 'get_book_summary_by_currency',
        response: jsonResponse({ result: [] }),
      },
    ]);

    await expect(
      fetchDeribitProbability({ strike: 100_000, expiryIso: '2030-06-30T00:00:00Z' }),
    ).rejects.toThrow(/ticker fetch failed/);
  });
});
