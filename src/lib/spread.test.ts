import { describe, it, expect } from 'vitest';
import { spreadPp, isLargeSpread, largestSpread } from './spread';
import type { PairSnapshot } from './types';

const mkPair = (id: string, spread: number): PairSnapshot => ({
  id: id as PairSnapshot['id'],
  label: 'x',
  tradable: 'x',
  expiry: '2026-12-31T00:00:00.000Z',
  polymarket: 50,
  wallstreet: 50,
  spread,
  demo: false,
});

describe('spreadPp', () => {
  it('returns poly minus wall', () => {
    expect(spreadPp(60, 40)).toBe(20);
    expect(spreadPp(40, 60)).toBe(-20);
    expect(spreadPp(0, 0)).toBe(0);
  });
});

describe('isLargeSpread', () => {
  it('true when |spread| > 10', () => {
    expect(isLargeSpread(11)).toBe(true);
    expect(isLargeSpread(-11)).toBe(true);
    expect(isLargeSpread(20)).toBe(true);
  });

  it('false at boundary (10pp is not "large")', () => {
    expect(isLargeSpread(10)).toBe(false);
    expect(isLargeSpread(-10)).toBe(false);
  });

  it('false for small spreads', () => {
    expect(isLargeSpread(0)).toBe(false);
    expect(isLargeSpread(5)).toBe(false);
    expect(isLargeSpread(-9.99)).toBe(false);
  });
});

describe('largestSpread', () => {
  it('picks the pair with biggest absolute spread', () => {
    const pairs = [mkPair('fed-jun', 5), mkPair('fed-jul', -18), mkPair('btc-150k', 12)];
    const winner = largestSpread(pairs);
    expect(winner.id).toBe('fed-jul');
  });

  it('handles signed values correctly (negative wins over smaller positive)', () => {
    const pairs = [mkPair('fed-jun', 9), mkPair('fed-jul', -15)];
    expect(largestSpread(pairs).spread).toBe(-15);
  });

  it('returns the only pair when given one', () => {
    const pairs = [mkPair('fed-jun', 3)];
    expect(largestSpread(pairs).id).toBe('fed-jun');
  });
});
