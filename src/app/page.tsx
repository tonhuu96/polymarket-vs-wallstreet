'use client';

/**
 * Dashboard root. Two SWR feeds drive the page:
 *
 *   1. /api/markets[?demo=1]  — refreshed every 30s, drives hero + rows.
 *   2. /api/history           — refreshed every 60s, drives sparklines.
 *
 * The demo flag round-trips through the URL via <DemoToggle /> and is the
 * single source of truth: the toggle reads it from `useSearchParams` and the
 * page passes it through to the markets fetch.
 */

import { Suspense } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { DemoToggle } from '@/components/DemoToggle';
import { HeroDivergence } from '@/components/HeroDivergence';
import { MarketRow } from '@/components/MarketRow';
import type { HistoryStore } from '@/lib/history';
import type { MarketsResponse, PairId } from '@/lib/types';

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

function Dashboard() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';

  const marketsUrl = `/api/markets${isDemo ? '?demo=1' : ''}`;
  const {
    data: markets,
    error: marketsError,
    isLoading: marketsLoading,
  } = useSWR<MarketsResponse>(marketsUrl, fetcher, { refreshInterval: 30_000 });

  const { data: history } = useSWR<HistoryStore>('/api/history', fetcher, {
    refreshInterval: 60_000,
  });

  const pairs = markets?.pairs ?? [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            POLYMARKET vs WALL STREET
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
            real-time prediction-market arbitrage
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {marketsLoading
              ? 'loading…'
              : markets
                ? `updated ${new Date(markets.updatedAt).toLocaleString()}`
                : ''}
          </p>
        </div>
        <DemoToggle />
      </header>

      {marketsError && (
        <div className="mb-6 rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          failed to load markets: {String((marketsError as Error).message)}
        </div>
      )}

      <HeroDivergence pairs={pairs} />

      <section className="mt-12">
        <h2 className="mb-4 text-xs uppercase tracking-widest text-zinc-500">MARKETS</h2>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 border-b border-zinc-800 px-4 py-3 text-xs uppercase tracking-widest text-zinc-500">
            <div>Event</div>
            <div className="text-right">Polymarket</div>
            <div className="text-right">Wall Street</div>
            <div className="text-right">Spread</div>
            <div className="text-right">Trade</div>
          </div>

          {pairs.length === 0 && !marketsError ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-600">loading rows…</div>
          ) : (
            pairs.map((pair) => (
              <MarketRow
                key={pair.id}
                pair={pair}
                history={history?.[pair.id as PairId] ?? []}
              />
            ))
          )}
        </div>
      </section>

      <footer className="mt-12 text-xs text-zinc-600">
        Sources: Polymarket, CME FedWatch, Deribit, Yahoo Finance · Refreshes every 30s
        {markets ? ` · Updated ${new Date(markets.updatedAt).toLocaleString()}` : ''}
      </footer>
    </div>
  );
}

export default function Home() {
  // useSearchParams() needs a Suspense boundary in Next 16 client pages.
  return (
    <Suspense fallback={<div className="px-6 py-12 text-zinc-500">loading…</div>}>
      <Dashboard />
    </Suspense>
  );
}
