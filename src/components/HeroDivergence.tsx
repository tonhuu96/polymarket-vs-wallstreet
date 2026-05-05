/**
 * Hero panel: the largest absolute spread across all pairs, blown up huge.
 *
 * - When |spread| > 10pp the number is painted in a red→orange gradient to
 *   signal "this is the trade". Below threshold, neutral zinc.
 * - Eyebrow color hints at sign: positive = Polymarket overweight (green),
 *   negative = Wall Street overweight (blue).
 * - When `pairs` is empty (still loading) renders a calm skeleton instead
 *   of crashing on `largestSpread([])`.
 */

import { largestSpread } from '@/lib/spread';
import type { PairSnapshot } from '@/lib/types';

export interface HeroDivergenceProps {
  pairs: PairSnapshot[];
}

export function HeroDivergence({ pairs }: HeroDivergenceProps) {
  if (pairs.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-8 py-12 text-center">
        <div className="text-xs uppercase tracking-widest text-zinc-500">loading…</div>
        <div className="mt-4 text-7xl font-bold tabular-nums text-zinc-700">—</div>
        <div className="mt-3 text-sm text-zinc-600">awaiting market data</div>
      </section>
    );
  }

  const top = largestSpread(pairs);
  const big = Math.abs(top.spread) > 10;
  const sign = top.spread >= 0 ? '+' : '−';
  const magnitude = Math.abs(top.spread).toFixed(1);

  const eyebrowColor = big
    ? top.spread >= 0
      ? 'text-emerald-400'
      : 'text-sky-400'
    : 'text-zinc-500';

  const eyebrowText = big
    ? top.spread >= 0
      ? 'POLYMARKET FAVORS MORE'
      : 'WALL STREET FAVORS MORE'
    : 'LARGEST DIVERGENCE';

  const numberClass = big
    ? 'bg-gradient-to-br from-red-400 to-orange-500 bg-clip-text text-transparent'
    : 'text-zinc-300';

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-8 py-12 text-center">
      <div className={`text-xs uppercase tracking-widest ${eyebrowColor}`}>{eyebrowText}</div>
      <div className={`mt-4 text-7xl font-bold tabular-nums leading-none ${numberClass}`}>
        {sign}
        {magnitude}
        <span className="text-3xl align-top ml-1">pp</span>
      </div>
      <div className="mt-4 text-sm text-zinc-400">
        {top.label} <span className="text-zinc-600">·</span>{' '}
        <span className="text-zinc-200">Polymarket {top.polymarket.toFixed(0)}%</span>{' '}
        <span className="text-zinc-600">/</span>{' '}
        <span className="text-zinc-200">Wall Street {top.wallstreet.toFixed(0)}%</span>
      </div>
    </section>
  );
}
