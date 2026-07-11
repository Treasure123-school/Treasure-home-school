// SERVER-AUTHORITATIVE EXAM TIMER
//
// This module centralizes every rule about "how much time is left in this exam"
// so the same logic runs regardless of browser, device, or how long the tab was
// backgrounded/asleep. The single rule: remaining time is always
// `expiresAt - (Date.now() + clockOffsetMs)`, recomputed fresh on every tick —
// never a value that gets decremented locally (decrementing drifts and breaks
// under tab throttling, device sleep, and setInterval delays).
//
// `expiresAt` and `clockOffsetMs` both come from the server:
//  - `expiresAt` is `session.expiresAt` returned by the exam-session APIs
//    (computed server-side from `startedAt + exam.timeLimit`).
//  - `clockOffsetMs` is `serverTime - Date.now()` measured via `/api/server-time`,
//    so a device with a wrong system clock still counts down correctly.

import { apiRequest } from "@/lib/queryClient";

export interface ServerTimeSync {
  offsetMs: number;
  syncedAt: number; // client Date.now() when this offset was measured
}

/**
 * Measure the offset between the server clock and this device's clock.
 * Uses request/response timing (round-trip midpoint) to reduce the error
 * introduced by network latency.
 */
export async function fetchServerTimeOffset(): Promise<ServerTimeSync> {
  const requestStart = Date.now();
  const response = await apiRequest('GET', '/api/server-time');
  const requestEnd = Date.now();

  if (!response.ok) {
    throw new Error('Failed to sync server time');
  }
  const data = await response.json();
  const roundTrip = requestEnd - requestStart;
  // Best estimate of "now" on the server at the moment we received the response:
  // the server timestamp plus half the round trip (assumes symmetric latency).
  const estimatedServerNowAtReceive = data.serverTime + roundTrip / 2;
  const offsetMs = estimatedServerNowAtReceive - requestEnd;

  return { offsetMs, syncedAt: requestEnd };
}

/** Current server time estimate, given a previously measured offset. */
export function getSyncedNow(offsetMs: number): number {
  return Date.now() + offsetMs;
}

/**
 * Compute remaining milliseconds until `expiresAt`, using the synced clock.
 * Returns null if there's no deadline (untimed exam).
 */
export function computeRemainingMs(expiresAt: string | number | Date | null | undefined, offsetMs: number): number | null {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;
  return expiresAtMs - getSyncedNow(offsetMs);
}

export function msToWholeSeconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}
