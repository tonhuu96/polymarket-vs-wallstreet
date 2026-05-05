import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFedWatchCutProb } from './cme-fedwatch';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchFedWatchCutProb', () => {
  it('returns the parsed probability scaled to 0..100 on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ probability: 0.55 }),
      }),
    );

    const result = await fetchFedWatchCutProb('jun-2026');
    expect(result).toBeCloseTo(55, 10);
  });

  it('returns the fallback when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    expect(await fetchFedWatchCutProb('jun-2026')).toBe(5);
    expect(await fetchFedWatchCutProb('jul-2026')).toBe(12);
  });

  it('returns the fallback on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );

    expect(await fetchFedWatchCutProb('jul-2026')).toBe(12);
  });

  it('returns the fallback on malformed JSON payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ wrong: 'shape' }),
      }),
    );

    expect(await fetchFedWatchCutProb('jun-2026')).toBe(5);
  });

  it('returns the fallback when probability is out of [0,1]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ probability: 1.5 }),
      }),
    );

    expect(await fetchFedWatchCutProb('jul-2026')).toBe(12);
  });
});
