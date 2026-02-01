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
import { createStudentStorage } from "./storage/modules/student-storage";
import { createTeacherStorage } from "./storage/modules/teacher-storage";
import { createAttendanceStorage } from "./storage/modules/attendance-storage";
import { createCommStorage } from "./storage/modules/comm-storage";
import { createAdminStorage } from "./storage/modules/admin-storage";

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
  getStudent(id: string): Promise<Student | undefined>;
  getStudentsByClass(classId: number): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, update: Partial<InsertStudent>): Promise<Student>;
  getTeacherProfile(userId: string): Promise<TeacherProfile | undefined>;
  getAllTeachers(): Promise<TeacherProfile[]>;
  createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile>;
  getAttendance(classId: number, date: Date): Promise<Attendance[]>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getMessages(userId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(settings: InsertSystemSettings): Promise<SystemSettings>;
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  private db: any;
  private schema: any;
  private userStorage: ReturnType<typeof createUserStorage>;
  private academicStorage: ReturnType<typeof createAcademicStorage>;
  private examStorage: ReturnType<typeof createExamStorage>;
  private reportStorage: ReturnType<typeof createReportStorage>;
  private studentStorage: ReturnType<typeof createStudentStorage>;
  private teacherStorage: ReturnType<typeof createTeacherStorage>;
  private attendanceStorage: ReturnType<typeof createAttendanceStorage>;
  private commStorage: ReturnType<typeof createCommStorage>;
  private adminStorage: ReturnType<typeof createAdminStorage>;

  constructor() {
    this.db = db;
    this.schema = schema;
    this.userStorage = createUserStorage(this.db, this.schema);
    this.academicStorage = createAcademicStorage(this.db, this.schema);
    this.examStorage = createExamStorage(this.db, this.schema);
    this.reportStorage = createReportStorage(this.db, this.schema);
    this.studentStorage = createStudentStorage(this.db, this.schema);
    this.teacherStorage = createTeacherStorage(this.db, this.schema);
    this.attendanceStorage = createAttendanceStorage(this.db, this.schema);
    this.commStorage = createCommStorage(this.db, this.schema);
    this.adminStorage = createAdminStorage(this.db, this.schema);
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

  async getStudent(id: string) { return this.studentStorage.getStudent(id); }
  async getStudentsByClass(classId: number) { return this.studentStorage.getStudentsByClass(classId); }
  async createStudent(student: any) { return this.studentStorage.createStudent(student); }
  async updateStudent(id: string, update: any) { return this.studentStorage.updateStudent(id, update); }

  async getTeacherProfile(userId: string) { return this.teacherStorage.getTeacherProfile(userId); }
  async getAllTeachers() { return this.teacherStorage.getAllTeachers(); }
  async createTeacherProfile(profile: any) { return this.teacherStorage.createTeacherProfile(profile); }

  async getAttendance(classId: number, date: Date) { return this.attendanceStorage.getAttendance(classId, date); }
  async createAttendance(attendance: any) { return this.attendanceStorage.createAttendance(attendance); }

  async getAnnouncements() { return this.commStorage.getAnnouncements(); }
  async createAnnouncement(announcement: any) { return this.commStorage.createAnnouncement(announcement); }
  async getMessages(userId: string) { return this.commStorage.getMessages(userId); }
  async createMessage(message: any) { return this.commStorage.createMessage(message); }

  async getSystemSettings() { return this.adminStorage.getSystemSettings(); }
  async updateSystemSettings(settings: any) { return this.adminStorage.updateSystemSettings(settings); }
  async getAuditLogs() { return this.adminStorage.getAuditLogs(); }
  async createAuditLog(log: any) { return this.adminStorage.createAuditLog(log); }
}

export const storage = new DatabaseStorage();
