import { eq, and, desc, asc, sql, sql as dsql, inArray, isNull, isNotNull, ne, gte, lte, or, like, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";
import { getDatabase, getSchema, getPgClient, getPgPool, isPostgres, isSqlite } from "./db";
import { calculateGrade, calculateWeightedScore, getGradingConfig, getOverallGrade, calculateGradeFromConfig } from "./grading-config";
import { getActiveGradingConfig } from "./grade-scale-service";
import { deleteFile } from "./cloudinary-service";
import { DeletionService, DeletionResult, formatDeletionLog } from "./services/deletion-service";
import { SmartDeletionManager, cleanupOrphanRecords, bulkDeleteUsers, SmartDeletionResult } from "./services/smart-deletion-manager";
import { realtimeService } from "./realtime-service";
import type {
  User, InsertUser, Student, InsertStudent, Class, InsertClass,
  Subject, InsertSubject, Attendance, InsertAttendance, Exam, InsertExam,
  ExamResult, InsertExamResult, Announcement, InsertAnnouncement,
  Message, InsertMessage, Gallery, InsertGallery, GalleryCategory, InsertGalleryCategory,
  HomePageContent, InsertHomePageContent, ContactMessage, InsertContactMessage,
  Role, AcademicTerm, AcademicSession, InsertAcademicSession, ExamQuestion, InsertExamQuestion, QuestionOption, InsertQuestionOption,
  ExamSession, InsertExamSession, StudentAnswer, InsertStudentAnswer,
  StudyResource, InsertStudyResource, PerformanceEvent, InsertPerformanceEvent,
  TeacherClassAssignment, InsertTeacherClassAssignment, GradingTask, InsertGradingTask, AuditLog, InsertAuditLog, ReportCard, ReportCardItem,
  Notification, InsertNotification, TeacherProfile,
  QuestionBank, InsertQuestionBank, QuestionBankItem, InsertQuestionBankItem, QuestionBankOption, InsertQuestionBankOption,
  Invite, InsertInvite, InsertAuditLog as InsertAuditLogType, InsertNotification as InsertNotificationType,
  AdminProfile, InsertAdminProfile, ParentProfile, InsertParentProfile, InsertTeacherProfile,
  SuperAdminProfile, InsertSuperAdminProfile, SystemSettings, InsertSystemSettings, Vacancy, InsertVacancy,
  TeacherApplication, InsertTeacherApplication, ApprovedTeacher,
  Timetable, InsertTimetable,
  StudentSubjectAssignment, InsertStudentSubjectAssignment, ClassSubjectMapping, InsertClassSubjectMapping,
  SyllabusTopic, InsertSyllabusTopic, ExamQuestionBankLink, InsertExamQuestionBankLink,
  LessonNote, InsertLessonNote,
  SchoolEvent, InsertSchoolEvent,
  NewsPost, InsertNewsPost, Faq, InsertFaq, AboutSection, InsertAboutSection,
  AdmissionsEnquiry, InsertAdmissionsEnquiry,
  HomepageSection, InsertHomepageSection,
  BillingItem, InsertBillingItem,
  BillingPayment, InsertBillingPayment,
  BillingFeatureLink, InsertBillingFeatureLink,
} from '@shared/schema.pg';

// Get centralized database instance and schema from db.ts
// Cast to 'any' to allow dynamic switching between SQLite and PostgreSQL schemas
// Both schemas have the same table structure, just different column type definitions
const db: any = getDatabase();
const schema: any = getSchema();

// Re-export for external use
export { db, isPostgres, isSqlite, getPgClient, getPgPool };
export * from './storage/index';
