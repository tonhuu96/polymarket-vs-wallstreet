/**
 * One row in the markets list. 5-column grid:
 *   Event | Polymarket % | Wall Street % | Spread | Trade copy + sparkline
 *
 * Numeric cells use `tabular-nums` so columns don't jitter as values change.
 * When |spread| > 10pp the spread cell glows red. Demo-fallback rows
 * (a single source failed and we substituted the demo value) dim to 60%
 * opacity and show a tiny "demo" badge so the user knows it's not live.
 */

import { Sparkline } from './Sparkline';
import { isLargeSpread } from '@/lib/spread';
import type { HistoryEntry } from '@/lib/history';
import type { PairSnapshot } from '@/lib/types';

export interface MarketRowProps {
  pair: PairSnapshot;
  history: HistoryEntry[];
}

export function MarketRow({ pair, history }: MarketRowProps) {
  const big = isLargeSpread(pair.spread);
  const sign = pair.spread >= 0 ? '+' : '−';
  const magnitude = Math.abs(pair.spread).toFixed(1);

  const spreadCellClass = big
    ? 'rounded bg-gradient-to-r from-red-950/60 to-red-900/30 px-2 py-1 text-red-300'
    : 'text-zinc-400';

  return (
    <div
      className={
        'grid grid-cols-[2fr_1fr_1fr_1fr_2fr] items-center gap-4 border-b border-zinc-800 px-4 py-4 ' +
        (pair.demo ? 'opacity-60' : '')
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-zinc-100">{pair.label}</span>
        {pair.demo && (
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
            demo
          </span>
        )}
      </div>
      <div className="text-right tabular-nums text-zinc-200">{pair.polymarket.toFixed(1)}%</div>
      <div className="text-right tabular-nums text-zinc-200">{pair.wallstreet.toFixed(1)}%</div>
      <div className={`text-right tabular-nums font-semibold ${spreadCellClass}`}>
        {sign}
        {magnitude}pp
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="truncate text-xs text-zinc-500">{pair.tradable}</span>
        <Sparkline history={history} />
      </div>
    </div>
  );
}
