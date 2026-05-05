import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { appendDailySpread, getHistoryPath, readHistory } from './history';
import type { PairId } from './types';

function tmpFile(): string {
  return join(tmpdir(), `pmws-history-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const TODAY = new Date().toISOString().slice(0, 10);

describe('history store', () => {
  let originalEnv: string | undefined;
  let path: string;

  beforeEach(() => {
    originalEnv = process.env.HISTORY_FILE;
    path = tmpFile();
    process.env.HISTORY_FILE = path;
  });

  afterEach(async () => {
    if (originalEnv === undefined) delete process.env.HISTORY_FILE;
    else process.env.HISTORY_FILE = originalEnv;
    try {
      await rm(path, { force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('getHistoryPath honors HISTORY_FILE env override', () => {
    expect(getHistoryPath()).toBe(path);
  });

  it('readHistory returns empty arrays for every PairId when file is missing', async () => {
    const h = await readHistory();
    const ids: PairId[] = ['fed-may', 'fed-jun', 'btc-100k', 'spx-7000'];
    for (const id of ids) {
      expect(h[id]).toEqual([]);
    }
  });

  it('append → read returns the appended value for that pair', async () => {
    await appendDailySpread('fed-may', 12.5);
    const h = await readHistory();
    expect(h['fed-may']).toEqual([{ date: TODAY, spread: 12.5 }]);
    expect(h['fed-jun']).toEqual([]);
  });

  it('appending twice for the same UTC day overwrites the prior value', async () => {
    await appendDailySpread('btc-100k', 4);
    await appendDailySpread('btc-100k', 9.25);
    const h = await readHistory();
    expect(h['btc-100k']).toEqual([{ date: TODAY, spread: 9.25 }]);
  });

  it('readHistory truncates each pair to the last 7 entries by date', async () => {
    // Seed the file directly with 10 days of synthetic history.
    const dates: string[] = [];
    const base = new Date(Date.UTC(2026, 0, 1));
    const series = [] as { date: string; spread: number }[];
    for (let i = 0; i < 10; i++) {
      const d = new Date(base.getTime() + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      dates.push(iso);
      series.push({ date: iso, spread: i });
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({
        'fed-may': series,
        'fed-jun': [],
        'btc-100k': [],
        'spx-7000': [],
      }),
      'utf8',
    );

    const h = await readHistory();
    expect(h['fed-may']).toHaveLength(7);
    // Should be the LAST 7, sorted ascending.
    expect(h['fed-may'].map((e) => e.date)).toEqual(dates.slice(3));
    expect(h['fed-may'].map((e) => e.spread)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('creates the parent directory when it does not yet exist', async () => {
    const nested = join(tmpdir(), `pmws-nested-${Date.now()}`, 'sub', 'history.json');
    process.env.HISTORY_FILE = nested;
    try {
      await appendDailySpread('spx-7000', -3);
      const h = await readHistory();
      expect(h['spx-7000']).toEqual([{ date: TODAY, spread: -3 }]);
    } finally {
      await rm(dirname(dirname(nested)), { recursive: true, force: true });
    }
  });

  it('a malformed JSON file reads as empty (does not throw)', async () => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '{not json', 'utf8');
    const h = await readHistory();
    expect(h['fed-may']).toEqual([]);
  });
});
