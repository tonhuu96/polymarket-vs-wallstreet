import { describe, it, expect } from 'vitest';
import { getDemoSnapshot } from './demo-snapshot';
import type { PairId } from './types';

const ALL_IDS: PairId[] = ['fed-jun', 'fed-jul', 'btc-150k', 'spx-7400'];

describe('getDemoSnapshot', () => {
  const snap = getDemoSnapshot();

  it('returns demo: true', () => {
    expect(snap.demo).toBe(true);
  });

  it('has a deterministic ISO updatedAt', () => {
    expect(typeof snap.updatedAt).toBe('string');
    expect(() => new Date(snap.updatedAt).toISOString()).not.toThrow();
    // deterministic: calling again yields the same value
    expect(getDemoSnapshot().updatedAt).toBe(snap.updatedAt);
  });

  it('has exactly 4 pairs', () => {
    expect(snap.pairs).toHaveLength(4);
  });

  it('contains all four PairIds', () => {
    const ids = snap.pairs.map((p) => p.id).sort();
    expect(ids).toEqual([...ALL_IDS].sort());
  });

  it('every pair carries demo: true', () => {
    for (const p of snap.pairs) expect(p.demo).toBe(true);
  });

  it('poly/wall values are 0..100 and spread = poly - wall', () => {
    for (const p of snap.pairs) {
      expect(p.polymarket).toBeGreaterThanOrEqual(0);
      expect(p.polymarket).toBeLessThanOrEqual(100);
      expect(p.wallstreet).toBeGreaterThanOrEqual(0);
      expect(p.wallstreet).toBeLessThanOrEqual(100);
      expect(p.spread).toBeCloseTo(p.polymarket - p.wallstreet, 6);
    }
  });

  it('at least one pair has |spread| > 15', () => {
    const big = snap.pairs.find((p) => Math.abs(p.spread) > 15);
    expect(big).toBeDefined();
  });

  it('each pair has non-empty label, tradable, and ISO expiry', () => {
    for (const p of snap.pairs) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.tradable.length).toBeGreaterThan(0);
      expect(() => new Date(p.expiry).toISOString()).not.toThrow();
    }
  });
});
