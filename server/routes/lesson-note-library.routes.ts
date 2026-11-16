/** Lesson Note Library Routes — aggregator; split into:
 *  lesson-note-library.shared.ts (roles + zod schemas),
 *  lesson-note-templates.routes.ts (super-admin template CRUD + import),
 *  lesson-note-school.routes.ts (school notes CRUD + filter options). */
import { Router } from "express";
import { registerLessonNoteTemplateRoutes } from "./lesson-note-templates.routes";
import { registerLessonNoteSchoolRoutes } from "./lesson-note-school.routes";

const router = Router();
registerLessonNoteTemplateRoutes(router);
registerLessonNoteSchoolRoutes(router);

export default router;
