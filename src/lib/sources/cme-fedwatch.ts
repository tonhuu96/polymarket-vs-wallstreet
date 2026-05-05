/**
 * CME FedWatch source client.
 *
 * The CME publishes a FedWatch tool that derives implied rate-cut probabilities
 * from Fed Funds futures. Their JSON endpoint is unofficial and shifts often,
 * so we attempt a best-effort live fetch behind a 5-second timeout and fall
 * back to a sensible hardcoded snapshot on any error path.
 *
 * Returns probability of a rate **cut** at the given meeting, in 0..100.
 */

import { z } from 'zod';

export type FedMeeting = 'may-2026' | 'jun-2026';

const FALLBACKS: Record<FedMeeting, number> = {
  'may-2026': 18,
  'jun-2026': 64,
};

const FedWatchPayloadSchema = z.object({
  probability: z.number(),
});

const TIMEOUT_MS = 5_000;

function liveUrl(meeting: FedMeeting): string {
  return `https://www.cmegroup.com/services/sandbox/fedwatch/${meeting}.json`;
}

/**
 * Fetch the implied probability of a Fed rate cut at the given FOMC meeting.
 *
 * Falls back to a hardcoded snapshot on any failure (network, non-200,
 * malformed payload, timeout). Returns 0..100.
 */
export async function fetchFedWatchCutProb(meeting: FedMeeting): Promise<number> {
  const fallback = FALLBACKS[meeting];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(liveUrl(meeting), {
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    if (!res.ok) return fallback;

    const json = await res.json();
    const parsed = FedWatchPayloadSchema.safeParse(json);
    if (!parsed.success) return fallback;

    const prob = parsed.data.probability;
    if (!Number.isFinite(prob) || prob < 0 || prob > 1) return fallback;

    return prob * 100;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
