'use client';

/**
 * Tiny inline 7-day spread sparkline. Recharts requires a client component
 * boundary. Strictly presentational — no interactivity, no axes, no tooltip.
 *
 * Color rule: red-400 if the latest |spread| > 10pp (matches the hot-row
 * threshold), zinc-400 otherwise. Empty data → centered em-dash placeholder.
 */

import { Line, LineChart, ResponsiveContainer } from 'recharts';
import type { HistoryEntry } from '@/lib/history';

const WIDTH = 120;
const HEIGHT = 24;

export interface SparklineProps {
  history: HistoryEntry[];
}

export function Sparkline({ history }: SparklineProps) {
  if (!history || history.length === 0) {
    return (
      <div
        style={{ width: WIDTH, height: HEIGHT }}
        className="flex items-center justify-center text-xs text-zinc-600"
      >
        —
      </div>
    );
  }

  const latest = history[history.length - 1].spread;
  const stroke = Math.abs(latest) > 10 ? '#f87171' /* red-400 */ : '#a1a1aa'; /* zinc-400 */

  return (
    <div style={{ width: WIDTH, height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="spread"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
