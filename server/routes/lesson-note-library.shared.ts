/** Lesson note library — shared role sets + validation schemas.
 *  Extracted from lesson-note-library.routes.ts. */
import { ROLES } from "./middleware";
import { z } from "zod";

export const ADMIN_ONLY = [ROLES.ADMIN];
export const ADMIN_ROLES = [ROLES.ADMIN];
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.TEACHER];


// ─── Validation Schemas ───────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
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

export const updateTemplateSchema = createTemplateSchema.partial();

export const importSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  termId: z.number().int().positive(),
});

export const createSchoolNoteSchema = z.object({
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