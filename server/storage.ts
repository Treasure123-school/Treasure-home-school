import { eq, and, desc, asc, sql, sql as dsql, inArray, isNull, isNotNull, ne, gte, lte, or, like } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDatabase, getSchema, getPgClient, getPgPool, isPostgres, isSqlite } from "./db";
import { calculateGrade, calculateWeightedScore, getGradingConfig, getOverallGrade } from "./grading-config";
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
  Role, AcademicTerm, ExamQuestion, InsertExamQuestion, QuestionOption, InsertQuestionOption,
  ExamSession, InsertExamSession, StudentAnswer, InsertStudentAnswer,
  StudyResource, InsertStudyResource, PerformanceEvent, InsertPerformanceEvent,
  TeacherClassAssignment, InsertTeacherClassAssignment, GradingTask, InsertGradingTask, AuditLog, InsertAuditLog, ReportCard, ReportCardItem,
  Notification, InsertNotification, TeacherProfile,
  QuestionBank, InsertQuestionBank, QuestionBankItem, InsertQuestionBankItem, QuestionBankOption, InsertQuestionBankOption,
  Invite, InsertInvite, InsertAuditLog as InsertAuditLogType, InsertNotification as InsertNotificationType,
  UserRecoveryRecord, InsertUserRecoveryRecord,
  AdminProfile, InsertAdminProfile, ParentProfile, InsertParentProfile, InsertTeacherProfile,
  SuperAdminProfile, InsertSuperAdminProfile, SystemSettings, InsertSystemSettings, Vacancy, InsertVacancy,
  TeacherApplication, InsertTeacherApplication, ApprovedTeacher,
  Timetable, InsertTimetable,
  StudentSubjectAssignment, InsertStudentSubjectAssignment, ClassSubjectMapping, InsertClassSubjectMapping
} from "@shared/schema";

import { normalizeUuid } from "./storage/utils";
import { createUserStorage } from "./storage/modules/user-storage";
import { createAcademicStorage } from "./storage/modules/academic-storage";
import { createExamStorage } from "./storage/modules/exam-storage";
import { createReportStorage } from "./storage/modules/report-storage";

const db: any = getDatabase();
const schema: any = getSchema();

export { db, isPostgres, isSqlite, getPgClient, getPgPool };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(roleId: number): Promise<User[]>;
  getClasses(): Promise<Class[]>;
  getClass(id: number): Promise<Class | undefined>;
  getSubjects(): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  getAcademicTerms(): Promise<AcademicTerm[]>;
  getCurrentTerm(): Promise<AcademicTerm | undefined>;
  createExam(exam: InsertExam): Promise<Exam>;
  getAllExams(): Promise<Exam[]>;
  getExamById(id: number): Promise<Exam | undefined>;
  getExamsByClass(classId: number): Promise<Exam[]>;
  getReportCard(id: number): Promise<ReportCard | undefined>;
  getReportCardsByStudentId(studentId: string): Promise<ReportCard[]>;
  getReportCardItems(reportCardId: number): Promise<ReportCardItem[]>;
  // ... rest of the interface will be added as we migrate
}

export class DatabaseStorage implements IStorage {
  private db: any;
  private schema: any;
  private userStorage: ReturnType<typeof createUserStorage>;
  private academicStorage: ReturnType<typeof createAcademicStorage>;
  private examStorage: ReturnType<typeof createExamStorage>;
  private reportStorage: ReturnType<typeof createReportStorage>;

  constructor() {
    this.db = db;
    this.schema = schema;
    this.userStorage = createUserStorage(this.db, this.schema);
    this.academicStorage = createAcademicStorage(this.db, this.schema);
    this.examStorage = createExamStorage(this.db, this.schema);
    this.reportStorage = createReportStorage(this.db, this.schema);
  }

  async getUser(id: string) { return this.userStorage.getUser(id); }
  async getUserByEmail(email: string) { return this.userStorage.getUserByEmail(email); }
  async getUserByUsername(username: string) { return this.userStorage.getUserByUsername(username); }
  async createUser(user: any) { return this.userStorage.createUser(user); }
  async getAllUsers() { return this.userStorage.getAllUsers(); }
  async getUsersByRole(roleId: number) { return this.userStorage.getUsersByRole(roleId); }

  async getClasses() { return this.academicStorage.getClasses(); }
  async getClass(id: number) { return this.academicStorage.getClass(id); }
  async getSubjects() { return this.academicStorage.getSubjects(); }
  async getSubject(id: number) { return this.academicStorage.getSubject(id); }
  async getAcademicTerms() { return this.academicStorage.getAcademicTerms(); }
  async getCurrentTerm() { return this.academicStorage.getCurrentTerm(); }

  async createExam(exam: any) { return this.examStorage.createExam(exam); }
  async getAllExams() { return this.examStorage.getAllExams(); }
  async getExamById(id: number) { return this.examStorage.getExamById(id); }
  async getExamsByClass(classId: number) { return this.examStorage.getExamsByClass(classId); }

  async getReportCard(id: number) { return this.reportStorage.getReportCard(id); }
  async getReportCardsByStudentId(studentId: string) { return this.reportStorage.getReportCardsByStudentId(studentId); }
  async getReportCardItems(reportCardId: number) { return this.reportStorage.getReportCardItems(reportCardId); }
}

export const storage = new DatabaseStorage();
