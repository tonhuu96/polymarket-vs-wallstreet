'use client';

/**
 * Pill toggle that flips the `?demo=1` URL search param.
 *
 * - ON  → red glow "DEMO MODE" pill, fed snapshot returned by /api/markets.
 * - OFF → muted zinc "LIVE" pill, real source clients fan out.
 *
 * Uses `router.replace` so toggling doesn't pollute back/forward history,
 * and preserves any other params currently on the URL.
 */

import { useRouter, useSearchParams } from 'next/navigation';

export function DemoToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    if (isDemo) {
      next.delete('demo');
    } else {
      next.set('demo', '1');
    }
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : '/');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDemo}
      className={
        'rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-widest transition-colors ' +
        (isDemo
          ? 'border-red-500/60 bg-red-950/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200')
      }
    >
      {isDemo ? 'DEMO MODE' : 'LIVE'}
    </button>
  );
}
