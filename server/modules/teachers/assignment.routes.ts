/** assignment.routes.ts — aggregator; split into focused route files. */
import { Router } from 'express';
import teacherAssignmentsRouter from './teacher-assignments.routes';
import gradingBoundariesRouter from './teacher-grading-boundaries.routes';
import teacherClassesRouter from './teacher-classes.routes';

const router = Router();
router.use(teacherAssignmentsRouter);
router.use(gradingBoundariesRouter);
router.use(teacherClassesRouter);

export default router;
