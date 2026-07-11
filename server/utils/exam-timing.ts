// Server-authoritative exam timing helpers.
//
// The client clock can never be trusted (drift, tab throttling, manual clock
// changes, device sleep). Every exam-taking endpoint must derive "how much
// time is left" from the server's own clock plus data stored in the
// database: `session.startedAt` and `exam.timeLimit`. This module centralizes
// that math so every route (progress save, answer save, submit, background
// sweep) agrees on the exact same expiry instant.

export const EXAM_GRACE_MS = 5000; // small allowance for network/round-trip latency only

export const EXAM_SESSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
  LOCKED: 'locked',
} as const;

export type ExamSessionStatusValue = typeof EXAM_SESSION_STATUS[keyof typeof EXAM_SESSION_STATUS];

export interface ExamTimingInput {
  startedAt: Date | string | null | undefined;
  isCompleted?: boolean | null;
}

export interface ExamTimingLike {
  timeLimit?: number | null;
}

export interface ExamTiming {
  hasTimeLimit: boolean;
  startedAtMs: number | null;
  durationMs: number | null;
  expiresAtMs: number | null;
  serverNowMs: number;
  remainingMs: number | null;
  remainingSeconds: number | null;
  isExpired: boolean;
}

/**
 * Compute the authoritative timing state for an exam session, purely from
 * server-known values. Never trust a client-supplied "time remaining".
 */
export function computeExamTiming(session: ExamTimingInput, exam: ExamTimingLike | null | undefined): ExamTiming {
  const serverNowMs = Date.now();

  if (!exam || !exam.timeLimit || !session.startedAt) {
    // No time limit configured (or no start time yet) — exam never expires by timer.
    return {
      hasTimeLimit: false,
      startedAtMs: session.startedAt ? new Date(session.startedAt).getTime() : null,
      durationMs: null,
      expiresAtMs: null,
      serverNowMs,
      remainingMs: null,
      remainingSeconds: null,
      isExpired: false,
    };
  }

  const startedAtMs = new Date(session.startedAt).getTime();
  const durationMs = exam.timeLimit * 60 * 1000;
  const expiresAtMs = startedAtMs + durationMs;
  const remainingMs = expiresAtMs - serverNowMs;
  const isExpired = !session.isCompleted && remainingMs <= -EXAM_GRACE_MS;

  return {
    hasTimeLimit: true,
    startedAtMs,
    durationMs,
    expiresAtMs,
    serverNowMs,
    remainingMs,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    isExpired,
  };
}

/** Small logging helper so expiry-related events are easy to grep across the server log. */
export function logExamTiming(tag: string, details: Record<string, unknown>): void {
  try {
    console.log(`[EXAM-TIMER] ${tag}`, JSON.stringify(details));
  } catch {
    console.log(`[EXAM-TIMER] ${tag}`, details);
  }
}
