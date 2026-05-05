/**
 * File-based JSON store for daily spread history.
 *
 * Schema on disk:
 *   {
 *     [pairId: PairId]: Array<{ date: string; spread: number }>
 *   }
 * where `date` is `YYYY-MM-DD` in UTC.
 *
 * Behavior:
 *  - One row per pair per UTC day. Re-appending on the same day overwrites.
 *  - `readHistory()` truncates each pair's array to the last 7 entries.
 *  - Missing file → empty record. Missing dir → created on write.
 *  - `HISTORY_FILE` env var overrides the default path (used by tests).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PairId } from './types';

const ALL_PAIR_IDS: readonly PairId[] = ['fed-may', 'fed-jun', 'btc-100k', 'spx-7000'] as const;

export interface HistoryEntry {
  /** UTC `YYYY-MM-DD`. */
  date: string;
  /** Signed percentage-point spread (poly − wall). */
  spread: number;
}

export type HistoryStore = Record<PairId, HistoryEntry[]>;

const MAX_ENTRIES_PER_PAIR = 7;

/** Resolve the on-disk history path. `HISTORY_FILE` env wins; default is `data/history.json` relative to cwd. */
export function getHistoryPath(): string {
  const override = process.env.HISTORY_FILE;
  if (override && override.length > 0) return override;
  // `process.cwd()` is dynamic; the comment tells Turbopack not to trace from here.
  return resolve(/* turbopackIgnore: true */ process.cwd(), 'data', 'history.json');
}

/** Today's date in UTC as `YYYY-MM-DD`. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build an empty store with every PairId mapped to []. */
function emptyStore(): HistoryStore {
  const out = {} as HistoryStore;
  for (const id of ALL_PAIR_IDS) out[id] = [];
  return out;
}

/** Read raw store from disk; missing/malformed → empty store. Does NOT truncate. */
async function readRaw(): Promise<HistoryStore> {
  const path = getHistoryPath();
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return emptyStore();
  }

  const out = emptyStore();
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const id of ALL_PAIR_IDS) {
      const arr = (parsed as Record<string, unknown>)[id];
      if (Array.isArray(arr)) {
        const cleaned: HistoryEntry[] = [];
        for (const e of arr) {
          if (
            e &&
            typeof e === 'object' &&
            typeof (e as HistoryEntry).date === 'string' &&
            typeof (e as HistoryEntry).spread === 'number' &&
            Number.isFinite((e as HistoryEntry).spread)
          ) {
            cleaned.push({ date: (e as HistoryEntry).date, spread: (e as HistoryEntry).spread });
          }
        }
        out[id] = cleaned;
      }
    }
  }
  return out;
}

/**
 * Append (or upsert) today's spread for a pair. If an entry for today's UTC
 * date already exists, it is overwritten. The on-disk file is created if
 * missing, including its parent directory.
 */
export async function appendDailySpread(pairId: PairId, spread: number): Promise<void> {
  const store = await readRaw();
  const series = store[pairId] ?? [];
  const today = todayUtc();
  const existingIdx = series.findIndex((e) => e.date === today);
  const entry: HistoryEntry = { date: today, spread };
  if (existingIdx >= 0) {
    series[existingIdx] = entry;
  } else {
    series.push(entry);
  }
  // Keep the on-disk file tidy — no need to grow unbounded.
  series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  store[pairId] = series;

  const path = getHistoryPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Read history with each pair truncated to the most recent 7 entries
 * (sorted ascending by date). Missing file → empty arrays for every pair.
 */
export async function readHistory(): Promise<HistoryStore> {
  const store = await readRaw();
  for (const id of ALL_PAIR_IDS) {
    const sorted = [...(store[id] ?? [])].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    store[id] = sorted.slice(-MAX_ENTRIES_PER_PAIR);
  }
  return store;
}
