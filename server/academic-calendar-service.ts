/**
 * Academic Calendar Service
 *
 * Handles:
 * - Auto-detection of the current term from today's date
 * - Term status transitions (upcoming → active → completed)
 * - Overlap validation for term date ranges
 * - Notifications when terms transition
 */

import { db } from "./storage";
import * as schema from "@shared/schema.pg";
import { eq, and, ne, or, lte, gte, not } from "drizzle-orm";
import type { AcademicTerm, AcademicSession } from "@shared/schema";

export interface TermTransitionResult {
  activated: number[];
  completed: number[];
  errors: string[];
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflictingTerms: Array<{ id: number; name: string; startDate: string; endDate: string }>;
}

// ─── Overlap Validation ──────────────────────────────────────────────────────

export async function checkTermOverlap(
  startDate: string,
  endDate: string,
  excludeId?: number
): Promise<OverlapCheckResult> {
  try {
    let query = db
      .select({ id: schema.academicTerms.id, name: schema.academicTerms.name, startDate: schema.academicTerms.startDate, endDate: schema.academicTerms.endDate })
      .from(schema.academicTerms)
      .where(
        and(
          lte(schema.academicTerms.startDate, endDate),
          gte(schema.academicTerms.endDate, startDate)
        )
      );

    const rows = await query;
    const conflicts = rows.filter(r => excludeId == null || r.id !== excludeId);

    return {
      hasOverlap: conflicts.length > 0,
      conflictingTerms: conflicts,
    };
  } catch (error) {
    console.error("[AcademicCalendarService] Overlap check error:", error);
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
      .select({ id: schema.academicSessions.id, name: schema.academicSessions.name, startDate: schema.academicSessions.startDate, endDate: schema.academicSessions.endDate })
      .from(schema.academicSessions)
      .where(
        and(
          lte(schema.academicSessions.startDate, endDate),
          gte(schema.academicSessions.endDate, startDate)
        )
      );

    const conflicts = rows.filter(r => excludeId == null || r.id !== excludeId);

    return {
      hasOverlap: conflicts.length > 0,
      conflictingTerms: conflicts,
    };
  } catch (error) {
    console.error("[AcademicCalendarService] Session overlap check error:", error);
    return { hasOverlap: false, conflictingTerms: [] };
  }
}

// ─── Current Term / Session Detection ────────────────────────────────────────

export async function detectCurrentTermByDate(): Promise<AcademicTerm | null> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const results = await db
      .select()
      .from(schema.academicTerms)
      .where(
        and(
          lte(schema.academicTerms.startDate, today),
          gte(schema.academicTerms.endDate, today)
        )
      )
      .limit(1);
    return results[0] ?? null;
  } catch (error) {
    console.error("[AcademicCalendarService] detectCurrentTermByDate error:", error);
    return null;
  }
}

export async function detectCurrentSessionByDate(): Promise<AcademicSession | null> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const results = await db
      .select()
      .from(schema.academicSessions)
      .where(
        and(
          lte(schema.academicSessions.startDate, today),
          gte(schema.academicSessions.endDate, today)
        )
      )
      .limit(1);
    return results[0] ?? null;
  } catch (error) {
    console.error("[AcademicCalendarService] detectCurrentSessionByDate error:", error);
    return null;
  }
}

// ─── Current Term API Endpoint Helper ────────────────────────────────────────

export async function getCalendarCurrentState() {
  const today = new Date().toISOString().split("T")[0];

  const [markedCurrentTerm] = await db
    .select()
    .from(schema.academicTerms)
    .where(eq(schema.academicTerms.isCurrent, true))
    .limit(1);

  const detectedTerm = await detectCurrentTermByDate();
  const currentSession = await detectCurrentSessionByDate();

  const allTerms = await db
    .select()
    .from(schema.academicTerms)
    .where(eq(schema.academicTerms.isCurrent, false));

  const allSessions = await db.select().from(schema.academicSessions);

  return {
    today,
    currentTerm: markedCurrentTerm ?? null,
    detectedTerm: detectedTerm ?? null,
    currentSession: currentSession ?? null,
    allSessions,
    upcomingTerms: allTerms.filter(t => t.startDate > today),
  };
}

// ─── Term Status Transition Engine ───────────────────────────────────────────

export async function runTermTransitions(): Promise<TermTransitionResult> {
  const today = new Date().toISOString().split("T")[0];
  const result: TermTransitionResult = { activated: [], completed: [], errors: [] };

  try {
    const allTerms = await db.select().from(schema.academicTerms);

    for (const term of allTerms) {
      try {
        const shouldBeActive = term.startDate <= today && term.endDate >= today;
        const shouldBeCompleted = term.endDate < today;
        const shouldBeUpcoming = term.startDate > today;

        if (shouldBeActive && term.status !== "active") {
          await db
            .update(schema.academicTerms)
            .set({ status: "active", isCurrent: true })
            .where(eq(schema.academicTerms.id, term.id));

          // Unset isCurrent on all other terms
          await db
            .update(schema.academicTerms)
            .set({ isCurrent: false })
            .where(and(eq(schema.academicTerms.isCurrent, true), ne(schema.academicTerms.id, term.id)));

          result.activated.push(term.id);
          console.log(`[AcademicCalendarService] Term activated: ${term.name} (id=${term.id})`);

          await sendTermTransitionNotifications(term, "activated");

        } else if (shouldBeCompleted && term.status === "active") {
          await db
            .update(schema.academicTerms)
            .set({ status: "completed" })
            .where(eq(schema.academicTerms.id, term.id));

          result.completed.push(term.id);
          console.log(`[AcademicCalendarService] Term completed: ${term.name} (id=${term.id})`);

          await sendTermTransitionNotifications(term, "completed");

        } else if (shouldBeUpcoming && term.status === "active") {
          // Edge case: term was set active but start date is in the future
          await db
            .update(schema.academicTerms)
            .set({ status: "upcoming" })
            .where(eq(schema.academicTerms.id, term.id));
        }
      } catch (termError: any) {
        result.errors.push(`Term ${term.id}: ${termError.message}`);
      }
    }

    // Sync active sessions
    await runSessionTransitions(today);

  } catch (error: any) {
    result.errors.push(`Global error: ${error.message}`);
    console.error("[AcademicCalendarService] runTermTransitions error:", error);
  }

  return result;
}

async function runSessionTransitions(today: string): Promise<void> {
  try {
    const allSessions = await db.select().from(schema.academicSessions);
    for (const session of allSessions) {
      const shouldBeActive = session.startDate <= today && session.endDate >= today;
      const newState = shouldBeActive;
      if (session.isActive !== newState) {
        await db
          .update(schema.academicSessions)
          .set({ isActive: newState })
          .where(eq(schema.academicSessions.id, session.id));
      }
    }
  } catch (error) {
    console.error("[AcademicCalendarService] runSessionTransitions error:", error);
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function sendTermTransitionNotifications(
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

    // Notify admins, teachers, and students (roles 1–4)
    const targetRoleIds = event === "activated" ? [1, 2, 3, 4] : [1, 2];

    const users = await db
      .select({ id: schema.users.id, roleId: schema.users.roleId })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));

    const targets = users.filter(u => targetRoleIds.includes(u.roleId));

    for (const user of targets) {
      try {
        await db.insert(schema.notifications).values({
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

    console.log(`[AcademicCalendarService] Sent ${event} notifications to ${targets.length} users for term ${term.name}`);
  } catch (error) {
    console.error("[AcademicCalendarService] sendTermTransitionNotifications error:", error);
  }
}
