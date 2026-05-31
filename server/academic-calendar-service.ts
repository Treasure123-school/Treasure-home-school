/**
 * Academic Calendar Service
 *
 * Provides:
 * - getActiveTerm()       — date-based detection, falls back to isCurrent flag
 * - getActiveSession()    — date-based detection, falls back to isCurrent flag
 * - getUpcomingTerm()     — next term after the current date
 * - checkAndTransition()  — auto-activates/completes sessions+terms, fires notifications
 * - detectCurrentFromDates(items) — pure utility: finds which item's date range contains today
 * - checkTermOverlap()    — session-scoped overlap guard for terms
 * - checkSessionOverlap() — global overlap guard for sessions
 */

import { storage, db } from "./storage";
import * as schema from "@shared/schema.pg";
import { eq, and, ne, lte, gte } from "drizzle-orm";
import type { AcademicTerm, AcademicSession } from "@shared/schema";

// ─── Pure Utility ─────────────────────────────────────────────────────────────

export function detectCurrentFromDates<T extends { startDate: string; endDate: string }>(
  items: T[],
  today: string = new Date().toISOString().split("T")[0]
): T | null {
  return items.find(item => item.startDate <= today && item.endDate >= today) ?? null;
}

// ─── Active Term / Session Lookups ────────────────────────────────────────────

export async function getActiveTerm(): Promise<AcademicTerm | null> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const all = await db.select().from(schema.academicTerms);
    const byDate = detectCurrentFromDates(all, today);
    if (byDate) return byDate;
    // Fall back to isCurrent flag
    return all.find(t => t.isCurrent) ?? null;
  } catch (error) {
    console.error("[AcademicCalendarService] getActiveTerm error:", error);
    return null;
  }
}

export async function getActiveSession(): Promise<AcademicSession | null> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const all = await db.select().from(schema.academicSessions);
    const byDate = detectCurrentFromDates(all, today);
    if (byDate) return byDate;
    // Fall back to isCurrent flag
    return all.find(s => s.isCurrent) ?? null;
  } catch (error) {
    console.error("[AcademicCalendarService] getActiveSession error:", error);
    return null;
  }
}

export async function getUpcomingTerm(): Promise<AcademicTerm | null> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const all = await db.select().from(schema.academicTerms);
    const future = all.filter(t => t.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    return future[0] ?? null;
  } catch (error) {
    console.error("[AcademicCalendarService] getUpcomingTerm error:", error);
    return null;
  }
}

// ─── Calendar State (for GET /api/academic-calendar/current) ─────────────────

export async function getCalendarCurrentState() {
  const today = new Date().toISOString().split("T")[0];

  const [currentTerm, currentSession, upcomingTerm] = await Promise.all([
    getActiveTerm(),
    getActiveSession(),
    getUpcomingTerm(),
  ]);

  const [allSessions, allTerms] = await Promise.all([
    db.select().from(schema.academicSessions),
    db.select().from(schema.academicTerms),
  ]);

  return {
    currentSession: currentSession ?? null,
    currentTerm: currentTerm ?? null,
    upcomingTerm: upcomingTerm ?? null,
    allSessions,
    allTerms,
  };
}

// ─── Overlap Validation ───────────────────────────────────────────────────────

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflictingTerms: Array<{ id: number; name: string; startDate: string; endDate: string }>;
}

/**
 * Check term overlap scoped to the same session.
 * If sessionId is provided, only terms within that session are checked.
 * If no sessionId, checks all terms globally.
 */
export async function checkTermOverlap(
  startDate: string,
  endDate: string,
  excludeId?: number,
  sessionId?: number | null
): Promise<OverlapCheckResult> {
  try {
    const conditions: any[] = [
      lte(schema.academicTerms.startDate, endDate),
      gte(schema.academicTerms.endDate, startDate),
    ];

    if (sessionId != null) {
      conditions.push(eq(schema.academicTerms.sessionId, sessionId));
    }

    const rows = await db
      .select({
        id: schema.academicTerms.id,
        name: schema.academicTerms.name,
        startDate: schema.academicTerms.startDate,
        endDate: schema.academicTerms.endDate,
      })
      .from(schema.academicTerms)
      .where(and(...conditions));

    const conflicts = rows.filter(r => excludeId == null || r.id !== excludeId);
    return { hasOverlap: conflicts.length > 0, conflictingTerms: conflicts };
  } catch (error) {
    console.error("[AcademicCalendarService] checkTermOverlap error:", error);
    return { hasOverlap: false, conflictingTerms: [] };
  }
}

export async function checkSessionOverlap(
  startDate: string,
  endDate: string,
  excludeId?: number
): Promise<OverlapCheckResult> {
  try {
    const rows = await db
      .select({
        id: schema.academicSessions.id,
        name: schema.academicSessions.name,
        startDate: schema.academicSessions.startDate,
        endDate: schema.academicSessions.endDate,
      })
      .from(schema.academicSessions)
      .where(
        and(
          lte(schema.academicSessions.startDate, endDate),
          gte(schema.academicSessions.endDate, startDate)
        )
      );

    const conflicts = rows.filter(r => excludeId == null || r.id !== excludeId);
    return { hasOverlap: conflicts.length > 0, conflictingTerms: conflicts };
  } catch (error) {
    console.error("[AcademicCalendarService] checkSessionOverlap error:", error);
    return { hasOverlap: false, conflictingTerms: [] };
  }
}

// ─── Transition Engine ────────────────────────────────────────────────────────

export interface TransitionResult {
  activated: number[];
  completed: number[];
  errors: string[];
}

export async function checkAndTransition(): Promise<TransitionResult> {
  const today = new Date().toISOString().split("T")[0];
  const result: TransitionResult = { activated: [], completed: [], errors: [] };

  try {
    // Transition sessions
    const allSessions = await db.select().from(schema.academicSessions);
    for (const session of allSessions) {
      try {
        const shouldBeActive = session.startDate <= today && session.endDate >= today;
        const shouldBeCompleted = session.endDate < today;

        if (shouldBeActive && session.status !== "active") {
          await db.update(schema.academicSessions)
            .set({ status: "active", isCurrent: true })
            .where(eq(schema.academicSessions.id, session.id));
          // Only one current session at a time
          await db.update(schema.academicSessions)
            .set({ isCurrent: false })
            .where(and(eq(schema.academicSessions.isCurrent, true), ne(schema.academicSessions.id, session.id)));
        } else if (shouldBeCompleted && session.status === "active") {
          await db.update(schema.academicSessions)
            .set({ status: "completed", isCurrent: false })
            .where(eq(schema.academicSessions.id, session.id));
        } else if (!shouldBeActive && !shouldBeCompleted && session.status === "active") {
          await db.update(schema.academicSessions)
            .set({ status: "upcoming" })
            .where(eq(schema.academicSessions.id, session.id));
        }
      } catch (e: any) {
        result.errors.push(`Session ${session.id}: ${e.message}`);
      }
    }

    // Transition terms
    const allTerms = await db.select().from(schema.academicTerms);
    for (const term of allTerms) {
      try {
        const shouldBeActive = term.startDate <= today && term.endDate >= today;
        const shouldBeCompleted = term.endDate < today;

        if (shouldBeActive && term.status !== "active") {
          await db.update(schema.academicTerms)
            .set({ status: "active", isCurrent: true })
            .where(eq(schema.academicTerms.id, term.id));
          // Only one current term at a time
          await db.update(schema.academicTerms)
            .set({ isCurrent: false })
            .where(and(eq(schema.academicTerms.isCurrent, true), ne(schema.academicTerms.id, term.id)));

          result.activated.push(term.id);
          console.log(`[AcademicCalendarService] Term activated: ${term.name} (id=${term.id})`);
          await _sendTermTransitionNotifications(term, "activated");

        } else if (shouldBeCompleted && term.status === "active") {
          await db.update(schema.academicTerms)
            .set({ status: "completed" })
            .where(eq(schema.academicTerms.id, term.id));

          result.completed.push(term.id);
          console.log(`[AcademicCalendarService] Term completed: ${term.name} (id=${term.id})`);
          await _sendTermTransitionNotifications(term, "completed");

        } else if (!shouldBeActive && !shouldBeCompleted && term.status === "active") {
          await db.update(schema.academicTerms)
            .set({ status: "upcoming" })
            .where(eq(schema.academicTerms.id, term.id));
        }
      } catch (e: any) {
        result.errors.push(`Term ${term.id}: ${e.message}`);
      }
    }
  } catch (error: any) {
    result.errors.push(`Global error: ${error.message}`);
    console.error("[AcademicCalendarService] checkAndTransition error:", error);
  }

  return result;
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function _sendTermTransitionNotifications(
  term: AcademicTerm,
  event: "activated" | "completed"
): Promise<void> {
  try {
    const title = event === "activated"
      ? `New Term Started: ${term.name}`
      : `Term Ended: ${term.name}`;
    const message = event === "activated"
      ? `${term.name} (${term.year}) has started and is now the current term.`
      : `${term.name} (${term.year}) has ended.`;

    // All active users: admins, teachers, parents, students (roles 1–5)
    const users = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));

    for (const user of users) {
      try {
        await storage.createNotification({
          userId: user.id,
          type: event === "activated" ? "term_started" : "term_ended",
          title,
          message,
          relatedEntityType: "academic_term",
          relatedEntityId: String(term.id),
          isRead: false,
        });
      } catch {
        // Individual notification failures are non-fatal
      }
    }
    console.log(`[AcademicCalendarService] Sent ${event} notifications to ${users.length} users`);
  } catch (error) {
    console.error("[AcademicCalendarService] _sendTermTransitionNotifications error:", error);
  }
}
