/** Lesson note library — school lesson notes CRUD + filter options (extracted). */
import { Router, Request, Response } from "express";
import { db } from "../storage";
import {
  lessonNoteTemplates,
  schoolLessonNotes,
  classes,
  subjects,
  academicTerms,
} from "@shared/schema.pg";
import { eq, and, ilike, or, inArray, asc, desc, count, isNull, isNotNull } from "drizzle-orm";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  handleRouteError,
  parseIntParam,
} from "../utils/response-helpers";
import { ADMIN_ONLY, ADMIN_ROLES, STAFF_ROLES, createTemplateSchema,
  updateTemplateSchema, importSchema, createSchoolNoteSchema } from "./lesson-note-library.shared";
import { z } from "zod";

export function registerLessonNoteSchoolRoutes(router: Router) {

// ─── School Lesson Notes: List ─────────────────────────────────────────────────

router.get(
  "/api/lesson-note-library/school-notes",
  authenticateUser,
  authorizeRoles(...STAFF_ROLES),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        search,
        classId: classIdQ,
        subjectId: subjectIdQ,
        termId: termIdQ,
        status: statusQ,
        page = "1",
        limit: limitQ = "20",
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limitQ) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];

      if (classIdQ) conditions.push(eq(schoolLessonNotes.classId, parseInt(classIdQ)));
      if (subjectIdQ) conditions.push(eq(schoolLessonNotes.subjectId, parseInt(subjectIdQ)));
      if (termIdQ) conditions.push(eq(schoolLessonNotes.termId, parseInt(termIdQ)));
      if (statusQ) conditions.push(eq(schoolLessonNotes.status, statusQ));
      if (search) {
        conditions.push(
          or(
            ilike(schoolLessonNotes.title, `%${search}%`),
            ilike(schoolLessonNotes.topic, `%${search}%`),
            ilike(schoolLessonNotes.subjectName, `%${search}%`),
            ilike(schoolLessonNotes.className, `%${search}%`)
          )
        );
      }

      const base = db.select().from(schoolLessonNotes);
      const baseWhere = conditions.length > 0 ? (base as any).where(and(...conditions)) : base;

      const notes = await (baseWhere as any)
        .orderBy(desc(schoolLessonNotes.updatedAt))
        .limit(limitNum)
        .offset(offset);

      const countBase = db.select({ total: count() }).from(schoolLessonNotes);
      const [{ total }] = conditions.length > 0
        ? await (countBase as any).where(and(...conditions))
        : await countBase;

      sendSuccess(res, {
        notes,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.school-notes.list");
    }
  }
);

// ─── School Lesson Notes: Get Single ──────────────────────────────────────────

router.get(
  "/api/lesson-note-library/school-notes/:id",
  authenticateUser,
  authorizeRoles(...STAFF_ROLES),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid note id");

      const [note] = await db
        .select()
        .from(schoolLessonNotes)
        .where(eq(schoolLessonNotes.id, id));

      if (!note) return sendNotFound(res, "School lesson note not found");
      sendSuccess(res, note);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.school-notes.get");
    }
  }
);

// ─── School Lesson Notes: Create ──────────────────────────────────────────────

router.post(
  "/api/lesson-note-library/school-notes",
  authenticateUser,
  authorizeRoles(...ADMIN_ROLES),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const body = createSchoolNoteSchema.parse(req.body);

      const [note] = await db
        .insert(schoolLessonNotes)
        .values({ ...body, createdBy: user.id })
        .returning();

      sendCreated(res, note);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.school-notes.create");
    }
  }
);

// ─── School Lesson Notes: Update ──────────────────────────────────────────────

router.put(
  "/api/lesson-note-library/school-notes/:id",
  authenticateUser,
  authorizeRoles(...ADMIN_ROLES),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid note id");

      const body = createSchoolNoteSchema.partial().parse(req.body);
      const [updated] = await db
        .update(schoolLessonNotes)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(schoolLessonNotes.id, id))
        .returning();

      if (!updated) return sendNotFound(res, "School lesson note not found");
      sendSuccess(res, updated);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.school-notes.update");
    }
  }
);

// ─── School Lesson Notes: Delete ──────────────────────────────────────────────

router.delete(
  "/api/lesson-note-library/school-notes/:id",
  authenticateUser,
  authorizeRoles(...ADMIN_ROLES),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid note id");

      const [deleted] = await db
        .delete(schoolLessonNotes)
        .where(eq(schoolLessonNotes.id, id))
        .returning();

      if (!deleted) return sendNotFound(res, "School lesson note not found");
      sendSuccess(res, { message: "School lesson note deleted" });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.school-notes.delete");
    }
  }
);

// ─── Distinct filter values for UI dropdowns ──────────────────────────────────

router.get(
  "/api/lesson-note-library/filter-options",
  authenticateUser,
  authorizeRoles(...STAFF_ROLES),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = user?.roleId === ROLES.ADMIN;

      const all = await db.select({
        className: lessonNoteTemplates.className,
        subjectName: lessonNoteTemplates.subjectName,
        level: lessonNoteTemplates.level,
        term: lessonNoteTemplates.term,
      }).from(lessonNoteTemplates).where(
        isAdmin ? undefined as any : eq(lessonNoteTemplates.isPublished, true)
      );

      type FilterRow = { className: string; subjectName: string; level: string; term: string };
      const classNames = [...new Set(all.map((r: FilterRow) => r.className))].sort();
      const subjectNames = [...new Set(all.map((r: FilterRow) => r.subjectName))].sort();
      const levels = [...new Set(all.map((r: FilterRow) => r.level))].sort();

      sendSuccess(res, { classNames, subjectNames, levels });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.filter-options");
    }
  }
);

}
