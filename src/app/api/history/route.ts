/**
 * GET /api/history
 *
 * Returns the on-disk daily spread history, truncated to the last 7 entries
 * per pair. Used by the dashboard's per-row sparklines.
 *
 * Server-side caching: 5-minute revalidate matches `/api/markets`.
 */

import { readHistory } from '@/lib/history';

export const revalidate = 300;

export async function GET(): Promise<Response> {
  return Response.json(await readHistory());
}
