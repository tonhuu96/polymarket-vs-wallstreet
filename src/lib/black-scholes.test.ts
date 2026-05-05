import { describe, it, expect } from 'vitest';
import { normCdf, probabilityAboveStrike } from './black-scholes';

describe('normCdf', () => {
  it('normCdf(0) ~= 0.5', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 3);
  });

  it('normCdf(1.96) ~= 0.975', () => {
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
  });

  it('normCdf(-1.96) ~= 0.025 (symmetry)', () => {
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('returns values in [0,1]', () => {
    for (const x of [-10, -3, -1, 0, 1, 3, 10]) {
      const v = normCdf(x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('probabilityAboveStrike', () => {
  it('ATM with positive vol gives ~ slightly < 0.5 (between 0.4 and 0.5)', () => {
    const p = probabilityAboveStrike({ spot: 100, strike: 100, t: 0.5, vol: 0.3, r: 0 });
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.5);
  });

  it('deep ITM (spot >> strike) > 0.95', () => {
    const p = probabilityAboveStrike({ spot: 200, strike: 100, t: 0.5, vol: 0.3, r: 0 });
    expect(p).toBeGreaterThan(0.95);
  });

  it('deep OTM (spot << strike) < 0.05', () => {
    const p = probabilityAboveStrike({ spot: 50, strike: 100, t: 0.5, vol: 0.3, r: 0 });
    expect(p).toBeLessThan(0.05);
  });

  it('default r=0 works when omitted', () => {
    const p = probabilityAboveStrike({ spot: 100, strike: 100, t: 0.5, vol: 0.3 });
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.5);
  });

  it('returns value in [0,1]', () => {
    const p = probabilityAboveStrike({ spot: 120, strike: 100, t: 0.25, vol: 0.4, r: 0.02 });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
