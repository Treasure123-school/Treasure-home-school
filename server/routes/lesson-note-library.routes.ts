/**
 * Lesson Note Library Routes
 *
 * Super Admin — full CRUD on library templates, publish/unpublish
 * Admin       — browse published templates, preview, import into school notes
 * Teacher     — read-only view of school lesson notes
 */

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
import { z } from "zod";

const router = Router();

const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER];

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  title: z.string().min(2).max(255),
  level: z.enum(["primary", "jss", "ss", "custom"]),
  className: z.string().min(1).max(100),
  subjectName: z.string().min(1).max(150),
  term: z.enum(["first", "second", "third"]),
  weekNumber: z.number().int().min(1).max(16),
  topic: z.string().min(1).max(255),
  duration: z.string().max(50).optional(),
  objectives: z.string().optional(),
  entryBehaviour: z.string().optional(),
  instructionalMaterials: z.string().optional(),
  content: z.string().optional(),
  teacherActivities: z.string().optional(),
  studentActivities: z.string().optional(),
  evaluationQuestions: z.string().optional(),
  assignments: z.string().optional(),
  references: z.string().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const importSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  termId: z.number().int().positive(),
});

const createSchoolNoteSchema = z.object({
  title: z.string().min(2).max(255),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  termId: z.number().int().positive().optional(),
  topicId: z.number().int().positive().optional(),
  className: z.string().max(100).optional(),
  subjectName: z.string().max(150).optional(),
  term: z.string().max(20).optional(),
  weekNumber: z.number().int().min(1).max(16).optional(),
  topic: z.string().max(255).optional(),
  duration: z.string().max(50).optional(),
  objectives: z.string().optional(),
  entryBehaviour: z.string().optional(),
  instructionalMaterials: z.string().optional(),
  content: z.string().optional(),
  teacherActivities: z.string().optional(),
  studentActivities: z.string().optional(),
  evaluationQuestions: z.string().optional(),
  assignments: z.string().optional(),
  references: z.string().optional(),
  status: z.enum(["draft", "approved", "published", "archived"]).optional(),
});

// ─── Super Admin: Template Stats ──────────────────────────────────────────────

router.get(
  "/api/lesson-note-library/stats",
  authenticateUser,
  authorizeRoles(...SUPER_ADMIN_ONLY),
  async (_req: Request, res: Response) => {
    try {
      const all = await db.select().from(lessonNoteTemplates);
      const published = all.filter((t) => t.isPublished).length;
      const classes = [...new Set(all.map((t) => t.className))];
      const subjects = [...new Set(all.map((t) => t.subjectName))];
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
      const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

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

      if (!isSuperAdmin) {
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
      const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

      const [template] = await db
        .select()
        .from(lessonNoteTemplates)
        .where(eq(lessonNoteTemplates.id, id));

      if (!template) return sendNotFound(res, "Template not found");
      if (!isSuperAdmin && !template.isPublished)
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
  authorizeRoles(...SUPER_ADMIN_ONLY),
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
  authorizeRoles(...SUPER_ADMIN_ONLY),
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
  authorizeRoles(...SUPER_ADMIN_ONLY),
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

// ─── Super Admin: Delete Template ─────────────────────────────────────────────

router.delete(
  "/api/lesson-note-library/templates/:id",
  authenticateUser,
  authorizeRoles(...SUPER_ADMIN_ONLY),
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
      const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

      const [template] = await db
        .select()
        .from(lessonNoteTemplates)
        .where(eq(lessonNoteTemplates.id, templateId));

      if (!template) return sendNotFound(res, "Template not found");
      if (!isSuperAdmin && !template.isPublished)
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
      const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

      const all = await db.select({
        className: lessonNoteTemplates.className,
        subjectName: lessonNoteTemplates.subjectName,
        level: lessonNoteTemplates.level,
        term: lessonNoteTemplates.term,
      }).from(lessonNoteTemplates).where(
        isSuperAdmin ? undefined as any : eq(lessonNoteTemplates.isPublished, true)
      );

      const classNames = [...new Set(all.map((r) => r.className))].sort();
      const subjectNames = [...new Set(all.map((r) => r.subjectName))].sort();
      const levels = [...new Set(all.map((r) => r.level))].sort();

      sendSuccess(res, { classNames, subjectNames, levels });
    } catch (err) {
      handleRouteError(res, err, "lesson-note-library.filter-options");
    }
  }
);

export default router;
