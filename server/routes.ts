import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, db, IStorage } from "./storage";
import * as schema from "@shared/schema.pg";
import { authenticateUser, authorizeRoles, normalizeUuid, SECRET_KEY, JWT_EXPIRES_IN, ROLES, AuthenticatedUser } from "./routes/middleware";
import { insertUserSchema, insertStudentSchema, insertAttendanceSchema, insertAnnouncementSchema, insertMessageSchema, insertExamSchema, insertExamResultSchema, insertExamQuestionSchema, insertQuestionOptionSchema, createQuestionOptionSchema, insertHomePageContentSchema, insertContactMessageSchema, insertExamSessionSchema, updateExamSessionSchema, insertStudentAnswerSchema, createStudentSchema, InsertUser, InsertStudentAnswer } from '@shared/schema.pg';
import { users, students } from "@shared/schema.pg";
import { z, ZodError } from "zod";
import multer from "multer";
import { parse as parseCSVSync } from "csv-parse/sync";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import PDFDocument from "pdfkit";
import { generateUsername, generatePassword, getNextUserNumber, generateStudentPassword } from "./auth-utils";
import { generateStudentUsername, generateParentUsername, generateTeacherUsername, generateAdminUsername } from "./username-generator";
import passport from "passport";
import session from "express-session";
import memorystore from "memorystore";
import { and, eq, sql, desc, ne, isNotNull, inArray } from "drizzle-orm";
import { realtimeService } from "./realtime-service";
import { computeExamTiming, logExamTiming, EXAM_SESSION_STATUS } from "./utils/exam-timing";
import { getProfileImagePath, getHomepageImagePath } from "./storage-path-utils";
import { uploadFileToStorage, replaceFile, deleteFileFromStorage } from "./upload-service";
import teacherAssignmentRoutes from "./teacher-assignment-routes";
import gradeScaleRoutes from "./grade-scale-routes";
import jobVacancyRoutes from "./routes/job-vacancy.routes";
import settingsRoutes from "./routes/settings.routes";
import { billingRouter } from "./routes/billing.routes";
import reportCardSkillsRoutes from "./routes/report-card-skills.routes";
import questionBankRoutes from "./routes/question-bank.routes";
import curriculumTemplateRoutes from "./routes/curriculum-templates.routes";
import lessonNoteLibraryRoutes from "./routes/lesson-note-library.routes";
import termsRoutes from "./routes/terms.routes";
import sessionsRoutes from "./routes/sessions.routes";
import calendarRoutes from "./routes/calendar.routes";
import uploadRoutes from "./routes/upload.routes";
import messagesRoutes from "./routes/messages.routes";
import lessonNotesRoutes from "./routes/lesson-notes.routes";
import aiConfigRoutes from "./routes/ai-config.routes";
import websiteManagementRoutes from "./routes/website-management.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import { validateTeacherCanCreateExam, validateTeacherCanEnterScores, validateTeacherCanViewResults, getTeacherAssignments, validateExamTimeWindow, logExamAccess } from "./teacher-auth-middleware";
import { getVisibleExamsForStudent, getVisibleExamsForParent, invalidateVisibilityCache, warmVisibilityCache } from "./exam-visibility";
import { calculateClassTeacherPermissions, getClassTeacherPermissionDeniedMessage } from "@shared/class-teacher-permissions";
import { SubjectAssignmentService } from "./services/subject-assignment-service";
import { performanceCache, PerformanceCache } from "./performance-cache";
import { enhancedCache, EnhancedCache } from "./enhanced-cache";
import { reliableSyncService } from "./services/reliable-sync-service";


import { registerHealthRoutes } from './routes/performance.routes';
import { registerRealtimeSyncRoutes } from './routes/realtime-sync.routes';
import { registerExamsAnalyticsRoutes } from './routes/exams-analytics.routes';
import { registerExamsManagementRoutes } from './routes/exams-management.routes';
import { registerExamQuestionsRoutes } from './routes/exam-questions.routes';
import { registerExamSessionsRoutes } from './routes/exam-sessions.routes';
import { registerTeacherProfileRoutes } from './routes/teacher-profile.routes';
import { registerTeachersOverviewRoutes } from './routes/teachers-overview.routes';
import { registerParentsPortalRoutes } from './routes/parents-portal.routes';
import { registerNotificationsRoutes } from './routes/notifications-crud.routes';
import { registerClassesRoutes } from './routes/classes-crud.routes';
import { registerSubjectsRoutes } from './routes/subjects-crud.routes';
import { registerHomepageRoutes } from './routes/homepage.routes';
import { registerRecoveryRoutes } from './routes/recovery.routes';
import { registerInvitesRoutes } from './routes/invites.routes';
import { registerStudentProfileRoutes } from './routes/student-profile.routes';
import { registerSuperAdminRoutes } from './routes/super-admin.routes';
import { registerReportCardsRoutes } from './routes/report-cards.routes';
import { registerEnhancedReportCardsRoutes } from './routes/enhanced-report-cards.routes';
import { registerSignaturesRoutes } from './routes/signatures.routes';
import { registerTeacherAssignmentsRoutes } from './routes/teacher-assignments.routes';
import { registerStudentSubjectAssignmentsRoutes } from './routes/student-subject-assignments.routes';
import { registerClassSubjectMappingRoutes } from './routes/class-subject-mapping.routes';
import { registerUnifiedSubjectAssignmentsRoutes } from './routes/unified-subject-assignments.routes';
import { registerReportCommentTemplatesRoutes } from './routes/report-comment-templates.routes';
import { registerSyncAuditLogRoutes } from './routes/sync-audit-log.routes';
import { registerStudentPortalSubjectsRoutes } from './routes/student-portal-subjects.routes';
import { registerStudentClassRankRoutes } from './routes/student-class-rank.routes';
import { registerStudentAssignmentsRoutes } from './routes/student-assignments.routes';
import { registerAdminTimetableRoutes } from './routes/admin-timetable.routes';
import { registerStudentTimetableRoutes } from './routes/student-timetable.routes';
import { registerSchoolEventsRoutes } from './routes/school-events.routes';
import { registerStudentAttendanceRoutes } from './routes/student-attendance.routes';

/** Orchestrator — endpoint bodies live in ./routes/*.routes.ts (split from a 15.6k-line monolith). */
export async function registerRoutes(app: Express): Promise<Server> {
  await registerHealthRoutes(app);
  await registerRealtimeSyncRoutes(app);
  await registerExamsAnalyticsRoutes(app);
  await registerExamsManagementRoutes(app);
  await registerExamQuestionsRoutes(app);
  await registerExamSessionsRoutes(app);
  await registerTeacherProfileRoutes(app);
  await registerTeachersOverviewRoutes(app);
  // ==================== TEACHER ASSIGNMENT ROUTES ====================
  // Register teacher class/subject assignment management routes
  // Note: Authentication is handled within the router via requireAuth/requireAdmin
  // which use the same JWT verification logic
  app.use(teacherAssignmentRoutes);
  app.use(gradeScaleRoutes);

  // Mount modular route files
  app.use(jobVacancyRoutes);
  app.use(settingsRoutes);
  app.use(reportCardSkillsRoutes);
  app.use(questionBankRoutes);
  app.use(curriculumTemplateRoutes);
  app.use(lessonNoteLibraryRoutes);
  app.use('/api/lesson-notes', lessonNotesRoutes);
  app.use(aiConfigRoutes);
  app.use('/api/terms', termsRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/academic-calendar', calendarRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/billing", billingRouter);
  app.use(websiteManagementRoutes);
  app.use(maintenanceRoutes); // admin repair/sync operations (extended 8-min timeout)

  // ==================== END FILE UPLOAD ROUTES ====================

  const isProduction = process.env.NODE_ENV === 'production';
  const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-session-secret-change-in-production' : process.env.JWT_SECRET || SECRET_KEY);

  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  SESSION_SECRET not set in production - using JWT_SECRET as fallback');
  }

  // Configure in-memory session store
  const MemoryStore = memorystore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: 86400000 // Prune expired entries every 24h
  });

  app.use(session({
    store: sessionStore, // Use SQLite session store
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Custom cookie name
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent JavaScript access (XSS protection)
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-domain in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Cookie available for all routes
      // DO NOT set domain attribute for cross-domain (Render ↔ Vercel)
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  await registerParentsPortalRoutes(app);
  await registerNotificationsRoutes(app);
  await registerClassesRoutes(app);
  await registerSubjectsRoutes(app);
  await registerHomepageRoutes(app);
  await registerRecoveryRoutes(app);
  await registerInvitesRoutes(app);
  await registerStudentProfileRoutes(app);
  await registerSuperAdminRoutes(app);
  await registerReportCardsRoutes(app);
  await registerEnhancedReportCardsRoutes(app);
  await registerSignaturesRoutes(app);
  await registerTeacherAssignmentsRoutes(app);
  await registerStudentSubjectAssignmentsRoutes(app);
  await registerClassSubjectMappingRoutes(app);
  await registerUnifiedSubjectAssignmentsRoutes(app);
  await registerReportCommentTemplatesRoutes(app);
  await registerSyncAuditLogRoutes(app);
  await registerStudentPortalSubjectsRoutes(app);
  await registerStudentClassRankRoutes(app);
  await registerStudentAssignmentsRoutes(app);
  await registerAdminTimetableRoutes(app);
  await registerStudentTimetableRoutes(app);
  await registerSchoolEventsRoutes(app);
  await registerStudentAttendanceRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
