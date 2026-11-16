/** Lesson note library — Super Admin template CRUD + admin import (extracted). */
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

export function registerLessonNoteTemplateRoutes(router: Router) {

// ─── Super Admin: Template Stats ──────────────────────────────────────────────

router.get(
  "/api/lesson-note-library/stats",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (_req: Request, res: Response) => {
    try {
      const all = await db.select().from(lessonNoteTemplates);
      type TplRow = typeof lessonNoteTemplates.$inferSelect;
      const published = all.filter((t: TplRow) => t.isPublished).length;
      const classes = [...new Set(all.map((t: TplRow) => t.className))];
      const subjects = [...new Set(all.map((t: TplRow) => t.subjectName))];
      const schoolNotes = await db.select().from(schoolLessonNotes);
      sendSuccess(res, {
        total: all.length,
        published,
        draft: all.length - published,
        classesCovered: classes.length,
        subjectsCovered: subjects.length,
        totalSchoolNotes: schoolNotes.length,
      });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.stats");
    }
  }
);

// ─── List Templates ───────────────────────────────────────────────────────────

router.get(
  "/api/lesson-note-library/templates",
  authenticateUser,
  authorizeRoles(...STAFF_ROLES),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = user?.roleId === ROLES.ADMIN;

      const {
        search,
        level,
        className: classNameQ,
        subjectName: subjectNameQ,
        term,
        page = "1",
        limit: limitQ = "20",
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limitQ) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];

      if (!isAdmin) {
        conditions.push(eq(lessonNoteTemplates.isPublished, true));
      }
      if (level) conditions.push(eq(lessonNoteTemplates.level, level));
      if (classNameQ) conditions.push(ilike(lessonNoteTemplates.className, `%${classNameQ}%`));
      if (subjectNameQ) conditions.push(ilike(lessonNoteTemplates.subjectName, `%${subjectNameQ}%`));
      if (term) conditions.push(eq(lessonNoteTemplates.term, term));
      if (search) {
        conditions.push(
          or(
            ilike(lessonNoteTemplates.title, `%${search}%`),
            ilike(lessonNoteTemplates.topic, `%${search}%`),
            ilike(lessonNoteTemplates.subjectName, `%${search}%`),
            ilike(lessonNoteTemplates.className, `%${search}%`)
          )
        );
      }

      const base = db.select().from(lessonNoteTemplates);
      const baseWhere = conditions.length > 0 ? (base as any).where(and(...conditions)) : base;

      const [templates, totalRows] = await Promise.all([
        (baseWhere as any)
          .orderBy(
            asc(lessonNoteTemplates.level),
            asc(lessonNoteTemplates.className),
            asc(lessonNoteTemplates.subjectName),
            asc(lessonNoteTemplates.term),
            asc(lessonNoteTemplates.weekNumber)
          )
          .limit(limitNum)
          .offset(offset),
        (baseWhere as any).then ? null : null, // fallback
      ]);

      // Count total separately for pagination
      const countBase = db
        .select({ total: count() })
        .from(lessonNoteTemplates);
      const [{ total }] = conditions.length > 0
        ? await (countBase as any).where(and(...conditions))
        : await countBase;

      sendSuccess(res, {
        templates,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.list");
    }
  }
);

// ─── Get Single Template ──────────────────────────────────────────────────────

router.get(
  "/api/lesson-note-library/templates/:id",
  authenticateUser,
  authorizeRoles(...STAFF_ROLES),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid template id");

      const user = (req as any).user;
      const isAdmin = user?.roleId === ROLES.ADMIN;

      const [template] = await db
        .select()
        .from(lessonNoteTemplates)
        .where(eq(lessonNoteTemplates.id, id));

      if (!template) return sendNotFound(res, "Template not found");
      if (!isAdmin && !template.isPublished)
        return sendForbidden(res, "Template is not published");

      sendSuccess(res, template);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.get");
    }
  }
);

// ─── Super Admin: Create Template ─────────────────────────────────────────────

router.post(
  "/api/lesson-note-library/templates",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const body = createTemplateSchema.parse(req.body);

      // Check for duplicate
      const existing = await db
        .select()
        .from(lessonNoteTemplates)
        .where(
          and(
            eq(lessonNoteTemplates.className, body.className),
            eq(lessonNoteTemplates.subjectName, body.subjectName),
            eq(lessonNoteTemplates.term, body.term),
            eq(lessonNoteTemplates.weekNumber, body.weekNumber),
            eq(lessonNoteTemplates.topic, body.topic)
          )
        );

      if (existing.length > 0) {
        return sendBadRequest(
          res,
          "A template with this class, subject, term, week and topic already exists."
        );
      }

      const [template] = await db
        .insert(lessonNoteTemplates)
        .values({ ...body, createdBy: user.id })
        .returning();

      sendCreated(res, template);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.create");
    }
  }
);

// ─── Super Admin: Update Template ─────────────────────────────────────────────

router.put(
  "/api/lesson-note-library/templates/:id",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid template id");

      const body = updateTemplateSchema.parse(req.body);
      const [updated] = await db
        .update(lessonNoteTemplates)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(lessonNoteTemplates.id, id))
        .returning();

      if (!updated) return sendNotFound(res, "Template not found");
      sendSuccess(res, updated);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.update");
    }
  }
);

// ─── Super Admin: Toggle Publish ──────────────────────────────────────────────

router.patch(
  "/api/lesson-note-library/templates/:id/publish",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid template id");

      const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body);
      const [updated] = await db
        .update(lessonNoteTemplates)
        .set({ isPublished, updatedAt: new Date() })
        .where(eq(lessonNoteTemplates.id, id))
        .returning();

      if (!updated) return sendNotFound(res, "Template not found");
      sendSuccess(res, updated);
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.publish");
    }
  }
);

// ─── Super Admin: Bulk Publish All Templates ──────────────────────────────────

router.post(
  "/api/lesson-note-library/templates/publish-all",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (_req: Request, res: Response) => {
    try {
      const result = await db
        .update(lessonNoteTemplates)
        .set({ isPublished: true, updatedAt: new Date() })
        .returning({ id: lessonNoteTemplates.id });
      sendSuccess(res, { updated: result.length, message: `${result.length} templates published.` });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.publish-all");
    }
  }
);

// ─── Super Admin: Delete Template ─────────────────────────────────────────────

router.delete(
  "/api/lesson-note-library/templates/:id",
  authenticateUser,
  authorizeRoles(...ADMIN_ONLY),
  async (req: Request, res: Response) => {
    try {
      const id = parseIntParam(req.params.id);
      if (!id) return sendBadRequest(res, "Invalid template id");

      const [deleted] = await db
        .delete(lessonNoteTemplates)
        .where(eq(lessonNoteTemplates.id, id))
        .returning();

      if (!deleted) return sendNotFound(res, "Template not found");
      sendSuccess(res, { message: "Template deleted" });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.templates.delete");
    }
  }
);

// ─── Admin: Import Template → School Note ────────────────────────────────────

router.post(
  "/api/lesson-note-library/templates/:id/import",
  authenticateUser,
  authorizeRoles(...ADMIN_ROLES),
  async (req: Request, res: Response) => {
    try {
      const templateId = parseIntParam(req.params.id);
      if (!templateId) return sendBadRequest(res, "Invalid template id");

      const user = (req as any).user;
      const isAdmin = user?.roleId === ROLES.ADMIN;

      const [template] = await db
        .select()
        .from(lessonNoteTemplates)
        .where(eq(lessonNoteTemplates.id, templateId));

      if (!template) return sendNotFound(res, "Template not found");
      if (!isAdmin && !template.isPublished)
        return sendForbidden(res, "This template is not published yet");

      const body = importSchema.parse(req.body);

      // Verify class, subject, term exist
      const [cls] = await db.select().from(classes).where(eq(classes.id, body.classId));
      if (!cls) return sendBadRequest(res, "Class not found");

      const [subj] = await db.select().from(subjects).where(eq(subjects.id, body.subjectId));
      if (!subj) return sendBadRequest(res, "Subject not found");

      const [term] = await db
        .select()
        .from(academicTerms)
        .where(eq(academicTerms.id, body.termId));
      if (!term) return sendBadRequest(res, "Term not found");

      // Check for duplicate import (same template + class + term)
      const existing = await db
        .select()
        .from(schoolLessonNotes)
        .where(
          and(
            eq(schoolLessonNotes.templateId, templateId),
            eq(schoolLessonNotes.classId, body.classId),
            eq(schoolLessonNotes.termId, body.termId)
          )
        );

      if (existing.length > 0) {
        return sendBadRequest(
          res,
          "This template has already been imported for the selected class and term."
        );
      }

      const [schoolNote] = await db
        .insert(schoolLessonNotes)
        .values({
          templateId,
          classId: body.classId,
          subjectId: body.subjectId,
          termId: body.termId,
          title: template.title,
          className: cls.name,
          subjectName: subj.name,
          term: template.term,
          weekNumber: template.weekNumber,
          topic: template.topic,
          duration: template.duration,
          objectives: template.objectives,
          entryBehaviour: template.entryBehaviour,
          instructionalMaterials: template.instructionalMaterials,
          content: template.content,
          teacherActivities: template.teacherActivities,
          studentActivities: template.studentActivities,
          evaluationQuestions: template.evaluationQuestions,
          assignments: template.assignments,
          references: template.references,
          status: "draft",
          createdBy: user.id,
        })
        .returning();

      sendCreated(res, {
        message: "Template imported successfully as a school lesson note.",
        schoolNote,
      });
    } catch (err) {
      if ((err as any)?.code === "23505") {
        return sendBadRequest(
          res,
          "This template has already been imported for the selected class and term."
        );
      }
      handleRouteError(res, err, "lesson-note-library.import");
    }
  }
);
}
