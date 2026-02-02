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

// Get centralized database instance and schema from db.ts
// Cast to 'any' to allow dynamic switching between SQLite and PostgreSQL schemas
// Both schemas have the same table structure, just different column type definitions
const db: any = getDatabase();
const schema: any = getSchema();

// Re-export for external use
export { db, isPostgres, isSqlite, getPgClient, getPgPool };

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getUsersByRole(roleId: number): Promise<User[]>;
  getUsersByStatus(status: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  approveUser(userId: string, approvedBy: string): Promise<User>;
  updateUserStatus(userId: string, status: string, updatedBy: string, reason?: string): Promise<User>;

  // Password reset management
  createPasswordResetToken(userId: string, token: string, expiresAt: Date, ipAddress?: string, resetBy?: string): Promise<any>;
  getPasswordResetToken(token: string): Promise<any | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>;
  deleteExpiredPasswordResetTokens(): Promise<boolean>;

  // Password reset attempt tracking (for rate limiting)
  createPasswordResetAttempt(identifier: string, ipAddress: string, success: boolean): Promise<any>;
  getRecentPasswordResetAttempts(identifier: string, minutesAgo: number): Promise<any[]>;
  deleteOldPasswordResetAttempts(hoursAgo: number): Promise<boolean>;

  // Account security
  lockAccount(userId: string, lockUntil: Date): Promise<boolean>;
  unlockAccount(userId: string): Promise<boolean>;
  isAccountLocked(userId: string): Promise<boolean>;

  // Admin recovery powers
  adminResetUserPassword(userId: string, newPasswordHash: string, resetBy: string, forceChange: boolean): Promise<boolean>;
  updateRecoveryEmail(userId: string, recoveryEmail: string, updatedBy: string): Promise<boolean>;

  // Role management
  getRoles(): Promise<Role[]>;
  getRoleByName(name: string): Promise<Role | undefined>;
  getRole(roleId: number): Promise<Role | undefined>;

  // Invite management
  createInvite(invite: InsertInvite): Promise<Invite>;
  getInviteByToken(token: string): Promise<Invite | undefined>;
  getPendingInviteByEmail(email: string): Promise<Invite | undefined>;
  getAllInvites(): Promise<Invite[]>;
  getPendingInvites(): Promise<Invite[]>;
  markInviteAsAccepted(inviteId: number, acceptedBy: string): Promise<void>;
  deleteInvite(inviteId: number): Promise<boolean>;
  deleteExpiredInvites(): Promise<boolean>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Notification management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Profile management
  updateUserProfile(userId: string, profileData: Partial<InsertUser>): Promise<User | undefined>;
  getTeacherProfile(userId: string): Promise<TeacherProfile | undefined>;
  getTeacherProfileByStaffId(staffId: string): Promise<TeacherProfile | undefined>;
  getAllTeacherProfiles(): Promise<TeacherProfile[]>;
  createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile>;
  updateTeacherProfile(userId: string, profile: Partial<InsertTeacherProfile>): Promise<TeacherProfile | undefined>;
  getAdminProfile(userId: string): Promise<AdminProfile | undefined>;
  createAdminProfile(profile: InsertAdminProfile): Promise<AdminProfile>;
  updateAdminProfile(userId: string, profile: Partial<InsertAdminProfile>): Promise<AdminProfile | undefined>;
  getSuperAdminProfile(userId: string): Promise<SuperAdminProfile | undefined>;
  createSuperAdminProfile(profile: InsertSuperAdminProfile): Promise<SuperAdminProfile>;
  updateSuperAdminProfile(userId: string, profile: Partial<InsertSuperAdminProfile>): Promise<SuperAdminProfile | undefined>;
  getParentProfile(userId: string): Promise<ParentProfile | undefined>;
  createParentProfile(profile: InsertParentProfile): Promise<ParentProfile>;
  updateParentProfile(userId: string, profile: Partial<InsertParentProfile>): Promise<ParentProfile | undefined>;
  calculateProfileCompletion(userId: string, roleId: number): Promise<number>;

  // Student management
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  getLinkedStudents(parentId: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, updates: { userPatch?: Partial<InsertUser>; studentPatch?: Partial<InsertStudent> }): Promise<{ user: User; student: Student } | undefined>;
  setUserActive(id: string, isActive: boolean): Promise<User | undefined>;
  deleteStudent(id: string, deletedBy?: string): Promise<boolean>;
  hardDeleteStudent(id: string): Promise<boolean>;
  getStudentsByClass(classId: number): Promise<Student[]>;
  getAllStudents(includeInactive?: boolean): Promise<Student[]>;
  getStudentByAdmissionNumber(admissionNumber: string): Promise<Student | undefined>;

  // Class management
  getClasses(): Promise<Class[]>;
  getAllClasses(includeInactive?: boolean): Promise<Class[]>;
  getClass(id: number): Promise<Class | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: number, classData: Partial<InsertClass>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;

  // Subject management
  getSubjects(): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, subject: Partial<InsertSubject>): Promise<Subject | undefined>;
  deleteSubject(id: number): Promise<boolean>;

  // Academic terms
  getCurrentTerm(): Promise<AcademicTerm | undefined>;
  getTerms(): Promise<AcademicTerm[]>;
  getAcademicTerms(): Promise<AcademicTerm[]>;
  createAcademicTerm(term: any): Promise<AcademicTerm>;
  updateAcademicTerm(id: number, term: any): Promise<AcademicTerm | undefined>;
  deleteAcademicTerm(id: number): Promise<boolean>;
  markTermAsCurrent(id: number): Promise<AcademicTerm | undefined>;

  // Attendance management
  recordAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAttendanceByStudent(studentId: string, date?: string): Promise<Attendance[]>;
  getAttendanceByClass(classId: number, date: string): Promise<Attendance[]>;

  // Exam management
  createExam(exam: InsertExam): Promise<Exam>;
  getAllExams(): Promise<Exam[]>;
  getExamById(id: number): Promise<Exam | undefined>;
  getExamsByClass(classId: number): Promise<Exam[]>;
  getExamsByClassAndTerm(classId: number, termId: number): Promise<Exam[]>;
  updateExam(id: number, exam: Partial<InsertExam>): Promise<Exam | undefined>;
  deleteExam(id: number): Promise<{
    success: boolean;
    deletedCounts: {
      questions: number;
      questionOptions: number;
      sessions: number;
      studentAnswers: number;
      results: number;
      gradingTasks: number;
      performanceEvents: number;
      filesDeleted: number;
      reportCardRefsCleared: number;
    };
  }>;
  recordExamResult(result: InsertExamResult): Promise<ExamResult>;
  updateExamResult(id: number, result: Partial<InsertExamResult>): Promise<ExamResult | undefined>;
  getExamResultsByStudent(studentId: string): Promise<ExamResult[]>;
  getExamResultsByExam(examId: number): Promise<ExamResult[]>;
  getExamResultsByClass(classId: number): Promise<any[]>;
  getExamResultByExamAndStudent(examId: number, studentId: string): Promise<ExamResult | undefined>;

  // Exam questions management
  createExamQuestion(question: InsertExamQuestion): Promise<ExamQuestion>;
  createExamQuestionWithOptions(question: InsertExamQuestion, options?: Array<{optionText: string; isCorrect: boolean}>): Promise<ExamQuestion>;
  createExamQuestionsBulk(questionsData: Array<{question: InsertExamQuestion; options?: Array<{optionText: string; isCorrect: boolean}>}>): Promise<{ created: number; questions: ExamQuestion[]; errors: string[] }>;
  getExamQuestions(examId: number): Promise<ExamQuestion[]>;
  getExamQuestionById(id: number): Promise<ExamQuestion | undefined>;
  updateExamQuestion(id: number, question: Partial<InsertExamQuestion>): Promise<ExamQuestion | undefined>;
  deleteExamQuestion(id: number): Promise<boolean>;
  getExamQuestionCount(examId: number): Promise<number>;
  getExamQuestionCounts(examIds: number[]): Promise<Record<number, number>>;

  // Question options management
  createQuestionOption(option: InsertQuestionOption): Promise<QuestionOption>;
  getQuestionOptions(questionId: number): Promise<QuestionOption[]>;
  getQuestionOptionsBulk(questionIds: number[]): Promise<QuestionOption[]>;
  deleteQuestionOptions(questionId: number): Promise<boolean>;

  // Question Bank management
  createQuestionBank(bank: InsertQuestionBank): Promise<QuestionBank>;
  getAllQuestionBanks(): Promise<QuestionBank[]>;
  getQuestionBankById(id: number): Promise<QuestionBank | undefined>;
  getQuestionBanksBySubject(subjectId: number): Promise<QuestionBank[]>;
  updateQuestionBank(id: number, bank: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined>;
  deleteQuestionBank(id: number): Promise<boolean>;
  
  // Question Bank Items management
  createQuestionBankItem(item: InsertQuestionBankItem, options?: Omit<InsertQuestionBankOption, 'questionItemId'>[]): Promise<QuestionBankItem>;
  getQuestionBankItems(bankId: number, filters?: {questionType?: string; difficulty?: string; tags?: string[]}): Promise<QuestionBankItem[]>;
  getQuestionBankItemById(id: number): Promise<QuestionBankItem | undefined>;
  updateQuestionBankItem(id: number, item: Partial<InsertQuestionBankItem>): Promise<QuestionBankItem | undefined>;
  deleteQuestionBankItem(id: number): Promise<boolean>;
  
  // Question Bank Item Options management
  getQuestionBankItemOptions(questionItemId: number): Promise<QuestionBankOption[]>;
  importQuestionsFromBank(examId: number, questionItemIds: number[], randomize?: boolean, maxQuestions?: number): Promise<{imported: number; questions: ExamQuestion[]}>;

  // Exam sessions management
  createExamSession(session: InsertExamSession): Promise<ExamSession>;
  getExamSessionById(id: number): Promise<ExamSession | undefined>;
  getExamSessionsByExam(examId: number): Promise<ExamSession[]>;
  getExamSessionsByStudent(studentId: string): Promise<ExamSession[]>;
  updateExamSession(id: number, session: Partial<InsertExamSession>): Promise<ExamSession | undefined>;
  deleteExamSession(id: number): Promise<boolean>;
  getActiveExamSession(examId: number, studentId: string): Promise<ExamSession | undefined>;
  getActiveExamSessions(): Promise<ExamSession[]>; // For background cleanup service
  getExpiredExamSessions(now: Date, limit?: number): Promise<ExamSession[]>; // Optimized cleanup query
  createOrGetActiveExamSession(examId: number, studentId: string, sessionData: InsertExamSession): Promise<ExamSession & { wasCreated?: boolean }>; // Idempotent session creation
  
  // Exam retake management
  allowExamRetake(examId: number, studentId: string, archivedBy: string): Promise<{ success: boolean; message: string; archivedSubmissionId?: number }>;
  getExamResultById(id: number): Promise<ExamResult | undefined>;

  // Student answers management
  createStudentAnswer(answer: InsertStudentAnswer): Promise<StudentAnswer>;
  getStudentAnswers(sessionId: number): Promise<StudentAnswer[]>;
  getStudentAnswerById(id: number): Promise<StudentAnswer | undefined>;
  getStudentAnswerBySessionAndQuestion(sessionId: number, questionId: number): Promise<StudentAnswer | undefined>;
  updateStudentAnswer(id: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer | undefined>;
  upsertStudentAnswer(sessionId: number, questionId: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer>;
  getQuestionOptionById(optionId: number): Promise<QuestionOption | undefined>;

  // Performance optimization - single query exam scoring
  getExamScoringData(sessionId: number): Promise<{
    session: ExamSession;
    scoringData: Array<{
      questionId: number;
      questionType: string;
      points: number;
      studentSelectedOptionId: number | null;
      correctOptionId: number | null;
      isCorrect: boolean;
      textAnswer: string | null;
    }>;
    summary: {
      totalQuestions: number;
      maxScore: number;
      studentScore: number;
      autoScoredQuestions: number;
    };
  }>;

  // Announcements
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAnnouncements(targetRole?: string, includeDrafts?: boolean): Promise<Announcement[]>;
  getAnnouncementById(id: number): Promise<Announcement | undefined>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: number): Promise<boolean>;

  // Messages
  sendMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUser(userId: string): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<void>;

  // Gallery
  createGalleryCategory(category: InsertGalleryCategory): Promise<GalleryCategory>;
  getGalleryCategories(): Promise<GalleryCategory[]>;
  uploadGalleryImage(image: InsertGallery): Promise<Gallery>;
  getGalleryImages(categoryId?: number): Promise<Gallery[]>;
  getGalleryImageById(id: string): Promise<Gallery | undefined>;
  deleteGalleryImage(id: string): Promise<boolean>;

  // Study resources management
  createStudyResource(resource: InsertStudyResource): Promise<StudyResource>;
  getStudyResources(filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
    resourceType?: string;
  }): Promise<StudyResource[]>;
  getStudyResourceById(id: number): Promise<StudyResource | undefined>;
  incrementStudyResourceDownloads(id: number): Promise<void>;
  deleteStudyResource(id: number): Promise<boolean>;

  // Home page content management
  createHomePageContent(content: InsertHomePageContent): Promise<HomePageContent>;
  getHomePageContent(contentType?: string): Promise<HomePageContent[]>;
  getHomePageContentById(id: number): Promise<HomePageContent | undefined>;
  updateHomePageContent(id: number, content: Partial<InsertHomePageContent>): Promise<HomePageContent | undefined>;
  deleteHomePageContent(id: number): Promise<boolean>;

  // Contact messages management
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  getContactMessageById(id: number): Promise<ContactMessage | undefined>;
  markContactMessageAsRead(id: number): Promise<boolean>;
  respondToContactMessage(id: number, response: string, respondedBy: string): Promise<ContactMessage | undefined>;

  // Analytics and Reports
  getAnalyticsOverview(): Promise<any>;
  getPerformanceAnalytics(filters: any): Promise<any>;
  getTrendAnalytics(months: number): Promise<any>;
  getAttendanceAnalytics(filters: any): Promise<any>;

  // Performance monitoring
  logPerformanceEvent(event: InsertPerformanceEvent): Promise<PerformanceEvent>;
  getPerformanceMetrics(hours?: number): Promise<{
    totalEvents: number;
    goalAchievementRate: number;
    averageDuration: number;
    slowSubmissions: number;
    eventsByType: Record<string, number>;
  }>;
  getRecentPerformanceAlerts(hours?: number): Promise<PerformanceEvent[]>;

  // Comprehensive grade management
  recordComprehensiveGrade(gradeData: any): Promise<any>;
  getComprehensiveGradesByStudent(studentId: string, termId?: number): Promise<any[]>;
  getComprehensiveGradesByClass(classId: number, termId?: number): Promise<any[]>;
  createReportCard(reportCardData: any, grades: any[]): Promise<any>;

  // Report card retrieval methods
  getReportCard(id: number): Promise<ReportCard | undefined>;
  getReportCardsByStudentId(studentId: string): Promise<ReportCard[]>;
  getReportCardItems(reportCardId: number): Promise<ReportCardItem[]>;
  getReportCardItemById(itemId: number): Promise<ReportCardItem | undefined>;
  getStudentsByParentId(parentId: string): Promise<Student[]>;
  getAcademicTerm(id: number): Promise<AcademicTerm | undefined>;

  // Enhanced report card management
  getReportCardsByClassAndTerm(classId: number, termId: number): Promise<any[]>;
  getReportCardWithItems(reportCardId: number): Promise<any>;
  generateReportCardsForClass(classId: number, termId: number, gradingScale: string, generatedBy: string): Promise<{ created: number; updated: number; errors: string[] }>;
  autoPopulateReportCardScores(reportCardId: number): Promise<{ populated: number; errors: string[] }>;
  overrideReportCardItemScore(itemId: number, data: {
    testScore?: number | null;
    testMaxScore?: number | null;
    examScore?: number | null;
    examMaxScore?: number | null;
    teacherRemarks?: string | null;
    overriddenBy: string;
  }): Promise<ReportCardItem | undefined>;
  updateReportCardStatus(reportCardId: number, status: string, userId: string): Promise<ReportCard | undefined>;
  updateReportCardStatusOptimized(reportCardId: number, status: string, userId: string): Promise<{ reportCard: ReportCard; previousStatus: string } | undefined>;
  updateReportCardRemarks(reportCardId: number, teacherRemarks?: string, principalRemarks?: string): Promise<ReportCard | undefined>;
  getReportCardSkills(reportCardId: number): Promise<any | undefined>;
  saveReportCardSkills(reportCardId: number, skills: any): Promise<any>;
  getExamsWithSubjectsByClassAndTerm(classId: number, termId?: number): Promise<any[]>;
  getExamScoresForReportCard(studentId: string, subjectId: number, termId: number): Promise<{ testExams: any[]; mainExams: any[] }>;
  recalculateReportCard(reportCardId: number, gradingScale: string): Promise<ReportCard | undefined>;

  // Auto-sync exam score to report card (called after exam submission)
  syncExamScoreToReportCard(studentId: string, examId: number, score: number, maxScore: number): Promise<{ success: boolean; reportCardId?: number; message: string; isNewReportCard?: boolean }>;
  
  // Bulk sync all missing exam scores to existing report card items
  syncAllMissingExamScores(termId?: number): Promise<{ synced: number; failed: number; errors: string[] }>;
  
  // Bulk sync exam results for a specific exam to all students' report cards
  syncExamResultsToReportCards(examId: number): Promise<{ synced: number; failed: number; errors: string[] }>;
  
  // Get report cards accessible by a specific teacher (only subjects where they created exams)
  getTeacherAccessibleReportCards(teacherId: string, termId?: number, classId?: number): Promise<any[]>;

  // Report comment templates (admin-managed)
  getReportCommentTemplates(role?: string): Promise<any[]>;
  getReportCommentTemplate(id: number): Promise<any | undefined>;
  createReportCommentTemplate(template: any): Promise<any>;
  updateReportCommentTemplate(id: number, template: any): Promise<any | undefined>;
  deleteReportCommentTemplate(id: number): Promise<boolean>;
  getCommentTemplateByPerformance(role: string, percentage: number): Promise<any | undefined>;

  // Report finalization methods
  getExamResultById(id: number): Promise<ExamResult | undefined>;
  getFinalizedReportsByExams(examIds: number[], filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
  }): Promise<any[]>;
  getAllFinalizedReports(filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
  }): Promise<any[]>;

  // Teacher class assignments
  createTeacherClassAssignment(assignment: InsertTeacherClassAssignment): Promise<TeacherClassAssignment>;
  getTeacherClassAssignments(teacherId: string): Promise<TeacherClassAssignment[]>;
  getTeachersForClassSubject(classId: number, subjectId: number): Promise<User[]>;
  updateTeacherClassAssignment(id: number, assignment: Partial<InsertTeacherClassAssignment>): Promise<TeacherClassAssignment | undefined>;
  deleteTeacherClassAssignment(id: number): Promise<boolean>;
  getTeacherAssignmentsForClass(teacherId: string, classId: number): Promise<Array<{ subjectId: number; subjectName: string }>>;

  // Teacher timetable
  createTimetableEntry(entry: InsertTimetable): Promise<Timetable>;
  getTimetableByTeacher(teacherId: string, termId?: number): Promise<Timetable[]>;
  updateTimetableEntry(id: number, entry: Partial<InsertTimetable>): Promise<Timetable | undefined>;
  deleteTimetableEntry(id: number): Promise<boolean>;

  // Teacher dashboard data
  getTeacherDashboardData(teacherId: string): Promise<{
    profile: TeacherProfile | undefined;
    user: User | undefined;
    assignments: Array<{
      id: number;
      className: string;
      subjectName: string;
      subjectCode: string;
      classLevel: string;
      termName?: string;
    }>;
    timetable: Array<{
      id: number;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      className: string;
      subjectName: string;
      location: string | null;
    }>;
  }>;

  // Manual grading task queue
  createGradingTask(task: InsertGradingTask): Promise<GradingTask>;
  assignGradingTask(taskId: number, teacherId: string): Promise<GradingTask | undefined>;
  getGradingTasksByTeacher(teacherId: string, status?: string): Promise<GradingTask[]>;
  getGradingTasksBySession(sessionId: number): Promise<GradingTask[]>;
  updateGradingTaskStatus(taskId: number, status: string, completedAt?: Date): Promise<GradingTask | undefined>;
  completeGradingTask(taskId: number, pointsEarned: number, feedbackText?: string): Promise<{ task: GradingTask; answer: StudentAnswer } | undefined>;
  getAISuggestedGradingTasks(teacherId: string, status?: string): Promise<any[]>;

  // Audit logging
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;

  // Grading system methods
  getGradingTasks(teacherId: string, status?: string): Promise<any[]>;
  submitManualGrade(gradeData: { taskId: number; score: number; comment: string; graderId: string }): Promise<any>;
  getAllExamSessions(): Promise<any[]>;
  getExamReports(filters: { subjectId?: number; classId?: number }): Promise<any[]>;
  getExamStudentReports(examId: number): Promise<any[]>;
  logPerformanceEvent(event: any): Promise<any>;
  getExpiredExamSessions(cutoffTime: Date, limit: number): Promise<any[]>;
  getScheduledExamsToPublish(now: Date): Promise<Exam[]>; // New method
  updateExam(examId: number, updates: any): Promise<Exam | undefined>; // Updated method

  // Settings management (Module 1)
  getSetting(key: string): Promise<any | undefined>;
  getAllSettings(): Promise<any[]>;
  createSetting(setting: any): Promise<any>;
  updateSetting(key: string, value: string, updatedBy: string): Promise<any | undefined>;
  deleteSetting(key: string): Promise<boolean>;

  // Counters for atomic sequence generation (Module 1)
  getNextSequence(classCode: string, year: string): Promise<number>;
  getCounter(classCode: string, year: string): Promise<any | undefined>;
  resetCounter(classCode: string, year: string): Promise<boolean>;

  // Job Vacancy System
  createVacancy(vacancy: InsertVacancy): Promise<Vacancy>;
  getVacancy(id: string): Promise<Vacancy | undefined>;
  getAllVacancies(status?: string): Promise<Vacancy[]>;
  updateVacancy(id: string, updates: Partial<InsertVacancy>): Promise<Vacancy | undefined>;
  deleteVacancy(id: string): Promise<boolean>;
  
  // Teacher Applications
  createTeacherApplication(application: InsertTeacherApplication): Promise<TeacherApplication>;
  getTeacherApplication(id: string): Promise<TeacherApplication | undefined>;
  getAllTeacherApplications(status?: string): Promise<TeacherApplication[]>;
  updateTeacherApplication(id: string, updates: Partial<TeacherApplication>): Promise<TeacherApplication | undefined>;
  approveTeacherApplication(applicationId: string, approvedBy: string): Promise<{ application: TeacherApplication; approvedTeacher: ApprovedTeacher }>;
  rejectTeacherApplication(applicationId: string, reviewedBy: string, reason: string): Promise<TeacherApplication | undefined>;
  
  // Approved Teachers
  getApprovedTeacherByEmail(email: string): Promise<ApprovedTeacher | undefined>;
  getAllApprovedTeachers(): Promise<ApprovedTeacher[]>;
  deleteApprovedTeacher(id: string): Promise<boolean>;

  // Super Admin methods
  getSuperAdminStats(): Promise<{
    totalAdmins: number;
    totalUsers: number;
    activeSessions: number;
    totalExams: number;
  }>;
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings>;

  // User recovery management
  getDeletedUsers(roleFilter?: number[]): Promise<User[]>;
  restoreUser(userId: string, restoredBy: string): Promise<User | undefined>;
  softDeleteUser(userId: string, deletedBy: string): Promise<boolean>;
  permanentlyDeleteUser(userId: string): Promise<boolean>;
  getExpiredDeletedUsers(retentionDays: number): Promise<User[]>;
  permanentlyDeleteExpiredUsers(retentionDays: number): Promise<{ deleted: number; errors: string[] }>;

  // Student subject assignments
  createStudentSubjectAssignment(assignment: InsertStudentSubjectAssignment): Promise<StudentSubjectAssignment>;
  getStudentSubjectAssignments(studentId: string): Promise<StudentSubjectAssignment[]>;
  getStudentSubjectAssignmentsByClass(classId: number): Promise<StudentSubjectAssignment[]>;
  deleteStudentSubjectAssignment(id: number): Promise<boolean>;
  deleteStudentSubjectAssignmentsByStudent(studentId: string): Promise<boolean>;
  assignSubjectsToStudent(studentId: string, classId: number, subjectIds: number[], termId?: number, assignedBy?: string): Promise<StudentSubjectAssignment[]>;
  
  // Class subject mappings
  createClassSubjectMapping(mapping: InsertClassSubjectMapping): Promise<ClassSubjectMapping>;
  getClassSubjectMappingById(id: number): Promise<ClassSubjectMapping | undefined>;
  getClassSubjectMappings(classId: number, department?: string): Promise<ClassSubjectMapping[]>;
  getAllClassSubjectMappings(): Promise<ClassSubjectMapping[]>;
  getSubjectsByClassAndDepartment(classId: number, department?: string): Promise<Subject[]>;
  deleteClassSubjectMapping(id: number): Promise<boolean>;
  deleteClassSubjectMappingsByClass(classId: number): Promise<boolean>;
  bulkUpdateClassSubjectMappings(additions: Array<{classId: number; subjectId: number; department: string | null; isCompulsory?: boolean}>, removals: Array<{classId: number; subjectId: number; department: string | null}>): Promise<{added: number; removed: number; affectedClassIds: number[]}>;

  // Department-based subject logic
  getSubjectsByCategory(category: string): Promise<Subject[]>;
  getSubjectsForClassLevel(classLevel: string, department?: string): Promise<Subject[]>;
  autoAssignSubjectsToStudent(studentId: string, classId: number, department?: string): Promise<StudentSubjectAssignment[]>;
  
  // Sync students with class_subject_mappings (single source of truth)
  syncStudentsWithClassMappings(classId: number, department?: string): Promise<{synced: number; errors: string[]}>;
  syncAllStudentsWithMappings(): Promise<{synced: number; errors: string[]}>;
  
  // Cleanup and sync report cards with class_subject_mappings
  cleanupReportCardItems(studentId: string): Promise<{removed: number; kept: number}>;
  cleanupReportCardsForClasses(classIds: number[]): Promise<{studentsProcessed: number; itemsRemoved: number; errors: string[]}>;
  cleanupAllReportCards(): Promise<{studentsProcessed: number; itemsRemoved: number; errors: string[]}>;
  
  // FIX: Add missing subjects to existing report cards when new mappings are added
  addMissingSubjectsToReportCards(classIds: number[]): Promise<{studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[]}>;
  repairAllReportCards(): Promise<{studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[]}>;
  
  // Sync report card items when exam subject changes
  syncReportCardItemsOnExamSubjectChange(examId: number, oldSubjectId: number, newSubjectId: number): Promise<{updated: number; errors: string[]}>;

  // Smart deletion methods
  validateDeletion(userId: string): Promise<{
    canDelete: boolean;
    reason?: string;
    blockedBy?: { type: string; description: string; count?: number }[];
    affectedRecords?: { tableName: string; count: number }[];
    filesToDelete?: string[];
  }>;
  deleteUserWithDetails(userId: string, performedBy?: string): Promise<SmartDeletionResult>;
  bulkDeleteUsers(userIds: string[], performedBy?: string): Promise<{
    successful: string[];
    failed: { userId: string; error: string }[];
  }>;
  cleanupOrphanRecords(): Promise<{ tableName: string; deletedCount: number }[]>;
}
// Helper to normalize UUIDs from various formats
function normalizeUuid(raw: any): string | undefined {
  if (!raw) return undefined;

  // If already a valid UUID string, return as-is
  if (typeof raw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  let bytes: number[] | undefined;

  // Handle comma-separated string of numbers
  if (typeof raw === 'string' && raw.includes(',')) {
    const parts = raw.split(',').map(s => parseInt(s.trim()));
    if (parts.length === 16 && parts.every(n => n >= 0 && n <= 255)) {
      bytes = parts;
    }
  }

  // Handle number array or Uint8Array
  if (Array.isArray(raw) && raw.length === 16) {
    bytes = raw;
  } else if (raw instanceof Uint8Array && raw.length === 16) {
    bytes = Array.from(raw);
  }
  // Convert bytes to UUID format
  if (bytes) {
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }
  return undefined;
}
export class DatabaseStorage implements IStorage {
  public db: any;

  constructor() {
    // Use the centralized database instance from db.ts
    this.db = db;
    if (!this.db) {
      throw new Error('Database not available - DATABASE_URL not set or invalid');
    }
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    // Only select columns that exist in the current database schema
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      recoveryEmail: schema.users.recoveryEmail,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      nationalId: schema.users.nationalId,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(eq(schema.users.id, id)).limit(1);

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user as User | undefined;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    // Only select columns that exist in the current database schema
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      recoveryEmail: schema.users.recoveryEmail,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      nationalId: schema.users.nationalId,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(eq(schema.users.email, email)).limit(1);

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user as User | undefined;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date, ipAddress?: string, resetBy?: string): Promise<any> {
    const result = await this.db.insert(schema.passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      ipAddress,
      resetBy,
    }).returning();
    return result[0];
  }
  async getPasswordResetToken(token: string): Promise<any | undefined> {
    const result = await this.db.select()
      .from(schema.passwordResetTokens)
      .where(and(
        eq(schema.passwordResetTokens.token, token),
        dsql`${schema.passwordResetTokens.expiresAt} > NOW()`,
        dsql`${schema.passwordResetTokens.usedAt} IS NULL`
      ))
      .limit(1);
    return result[0];
  }
  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const result = await this.db.update(schema.passwordResetTokens)
      .set({ usedAt: dsql`NOW()` })
      .where(eq(schema.passwordResetTokens.token, token))
      .returning();
    return result.length > 0;
  }
  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    await this.db.delete(schema.passwordResetTokens)
      .where(dsql`${schema.passwordResetTokens.expiresAt} < NOW()`);
    return true;
  }
  async createUser(user: InsertUser): Promise<User> {
    // PostgreSQL requires explicit UUID for varchar primary key
    // Auto-generate if not provided to ensure consistency across all user creation paths
    const userWithId = {
      ...user,
      id: (user as any).id || randomUUID(),
    };
    
    const result = await this.db.insert(schema.users).values(userWithId).returning();
    const createdUser = result[0];
    if (createdUser && createdUser.id) {
      const normalizedId = normalizeUuid(createdUser.id);
      if (normalizedId) {
        createdUser.id = normalizedId;
      }
    }
    return createdUser;
  }
  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const result = await this.db.update(schema.users).set(user).where(eq(schema.users.id, id)).returning();
      const updatedUser = result[0];
      if (updatedUser && updatedUser.id) {
        const normalizedId = normalizeUuid(updatedUser.id);
        if (normalizedId) {
          updatedUser.id = normalizedId;
        }
      }
      return updatedUser;
    } catch (error: any) {
      // Handle missing column errors by filtering out non-existent fields
      if (error?.cause?.code === '42703') {
        const missingColumn = error?.cause?.message?.match(/column "(\w+)" does not exist/)?.[1];

        // Remove the problematic field and retry
        const { [missingColumn]: removed, ...safeUser } = user as any;

        // If we removed the field, retry the update
        if (Object.keys(safeUser).length > 0) {
          const result = await this.db.update(schema.users).set(safeUser).where(eq(schema.users.id, id)).returning();
          const updatedUser = result[0];
          if (updatedUser && updatedUser.id) {
            const normalizedId = normalizeUuid(updatedUser.id);
            if (normalizedId) {
              updatedUser.id = normalizedId;
            }
          }
          return updatedUser;
        }
      }
      throw error;
    }
  }

  async deleteUser(id: string, performedBy?: string): Promise<boolean> {
    try {
      const smartDeletionManager = new SmartDeletionManager();
      const result = await smartDeletionManager.deleteUser(id, performedBy);
      return result.success;
    } catch (error: any) {
      console.error('[Storage] Smart deletion failed:', error.message);
      return false;
    }
  }

  async deleteUserWithDetails(id: string, performedBy?: string): Promise<SmartDeletionResult> {
    const smartDeletionManager = new SmartDeletionManager();
    return await smartDeletionManager.deleteUser(id, performedBy);
  }

  async validateDeletion(id: string): Promise<{ canDelete: boolean; reason?: string; affectedRecords?: any[] }> {
    const smartDeletionManager = new SmartDeletionManager();
    return await smartDeletionManager.validateDeletion(id);
  }

  async cleanupOrphanRecords(): Promise<{ tableName: string; deletedCount: number }[]> {
    return await cleanupOrphanRecords();
  }

  async bulkDeleteUsers(userIds: string[], performedBy?: string): Promise<{ successful: string[]; failed: { userId: string; error: string }[] }> {
    return await bulkDeleteUsers(userIds, performedBy);
  }

  async deleteUserLegacy(id: string): Promise<boolean> {
    const deletionService = new DeletionService();
    deletionService.reset();
    
    try {
      const user = await this.getUser(id);
      if (!user) {
        return false;
      }

      const userRole = user.roleId === 1 ? 'Super Admin' : 
                       user.roleId === 2 ? 'Admin' : 
                       user.roleId === 3 ? 'Teacher' : 
                       user.roleId === 4 ? 'Student' : 
                       user.roleId === 5 ? 'Parent' : 'Unknown';

      console.log(`\n[Legacy Deletion] Starting permanent deletion for ${userRole}: ${user.email || user.username}`);

      const filesToDelete: (string | null | undefined)[] = [];
      
      if (user.profileImageUrl) {
        filesToDelete.push(user.profileImageUrl);
      }

      const teacherProfile = await this.db.select({ signatureUrl: schema.teacherProfiles.signatureUrl })
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, id))
        .limit(1);
      
      if (teacherProfile[0]?.signatureUrl) {
        filesToDelete.push(teacherProfile[0].signatureUrl);
      }

      const teacherExams = await this.db.select({ id: schema.exams.id })
        .from(schema.exams)
        .where(eq(schema.exams.createdBy, id));
      
      for (const exam of teacherExams) {
        try {
          await this.deleteExam(exam.id);
          deletionService.recordDeletion('exams', 1);
        } catch (examError: any) {
          deletionService.recordError(`Failed to delete exam ${exam.id}: ${examError.message}`);
        }
      }

      const questionBanks = await this.db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.createdBy, id));
      
      for (const qb of questionBanks) {
        try {
          const qbItems = await this.db.select({ id: schema.questionBankItems.id, imageUrl: schema.questionBankItems.imageUrl })
            .from(schema.questionBankItems)
            .where(eq(schema.questionBankItems.questionBankId, qb.id));
          
          for (const item of qbItems) {
            if (item.imageUrl) filesToDelete.push(item.imageUrl);
          }
          
          const qbItemIds = qbItems.map((item: { id: number }) => item.id);
          if (qbItemIds.length > 0) {
            await this.db.delete(schema.questionBankOptions)
              .where(inArray(schema.questionBankOptions.questionId, qbItemIds));
            deletionService.recordDeletion('question_bank_options', qbItemIds.length);
            
            await this.db.delete(schema.questionBankItems)
              .where(eq(schema.questionBankItems.questionBankId, qb.id));
            deletionService.recordDeletion('question_bank_items', qbItemIds.length);
          }
          await this.db.delete(schema.questionBanks)
            .where(eq(schema.questionBanks.id, qb.id));
          deletionService.recordDeletion('question_banks', 1);
        } catch (qbError: any) {
          deletionService.recordError(`Failed to delete question bank ${qb.id}: ${qbError.message}`);
        }
      }

      const homePageContent = await this.db.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl })
        .from(schema.homePageContent)
        .where(eq(schema.homePageContent.uploadedBy, id));
      
      for (const content of homePageContent) {
        if (content.imageUrl) filesToDelete.push(content.imageUrl);
      }

      const teacherProfileResult = await this.db.delete(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('teacher_profiles', teacherProfileResult.length);
      
      try {
        const teacherAssignmentsResult = await this.db.delete(schema.teacherClassAssignments)
          .where(eq(schema.teacherClassAssignments.teacherId, id))
          .returning();
        deletionService.recordDeletion('teacher_class_assignments', teacherAssignmentsResult.length);
      } catch (e) {}
      
      try {
        const historyResult = await this.db.delete(schema.teacherAssignmentHistory)
          .where(eq(schema.teacherAssignmentHistory.teacherId, id))
          .returning();
        deletionService.recordDeletion('teacher_assignment_history', historyResult.length);
      } catch (e) {}

      try {
        const timetableResult = await this.db.delete(schema.timetable)
          .where(eq(schema.timetable.teacherId, id))
          .returning();
        deletionService.recordDeletion('timetable', timetableResult.length);
      } catch (e) {}

      try {
        const gradingResult = await this.db.delete(schema.gradingTasks)
          .where(eq(schema.gradingTasks.assignedTeacherId, id))
          .returning();
        deletionService.recordDeletion('grading_tasks', gradingResult.length);
      } catch (e) {}

      const adminResult = await this.db.delete(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('admin_profiles', adminResult.length);
      
      const parentResult = await this.db.delete(schema.parentProfiles)
        .where(eq(schema.parentProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('parent_profiles', parentResult.length);

      try {
        const superAdminResult = await this.db.delete(schema.superAdminProfiles)
          .where(eq(schema.superAdminProfiles.userId, id))
          .returning();
        deletionService.recordDeletion('super_admin_profiles', superAdminResult.length);
      } catch (e) {}
      
      const tokensResult = await this.db.delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, id))
        .returning();
      deletionService.recordDeletion('password_reset_tokens', tokensResult.length);
      
      const invitesAcceptedResult = await this.db.delete(schema.invites)
        .where(eq(schema.invites.acceptedBy, id))
        .returning();
      const invitesCreatedResult = await this.db.delete(schema.invites)
        .where(eq(schema.invites.createdBy, id))
        .returning();
      deletionService.recordDeletion('invites', invitesAcceptedResult.length + invitesCreatedResult.length);
      
      const notificationsResult = await this.db.delete(schema.notifications)
        .where(eq(schema.notifications.userId, id))
        .returning();
      deletionService.recordDeletion('notifications', notificationsResult.length);

      const messagesResult = await this.db.delete(schema.messages)
        .where(or(
          eq(schema.messages.senderId, id),
          eq(schema.messages.recipientId, id)
        ))
        .returning();
      deletionService.recordDeletion('messages', messagesResult.length);

      const announcementsResult = await this.db.delete(schema.announcements)
        .where(eq(schema.announcements.authorId, id))
        .returning();
      deletionService.recordDeletion('announcements', announcementsResult.length);

      try {
        const perfEventsResult = await this.db.delete(schema.performanceEvents)
          .where(eq(schema.performanceEvents.userId, id))
          .returning();
        deletionService.recordDeletion('performance_events', perfEventsResult.length);
      } catch (e) {}

      try {
        const auditResult = await this.db.delete(schema.auditLogs)
          .where(eq(schema.auditLogs.userId, id))
          .returning();
        deletionService.recordDeletion('audit_logs', auditResult.length);
      } catch (e) {}

      try {
        const accessLogsResult = await this.db.delete(schema.unauthorizedAccessLogs)
          .where(eq(schema.unauthorizedAccessLogs.userId, id))
          .returning();
        deletionService.recordDeletion('unauthorized_access_logs', accessLogsResult.length);
      } catch (e) {}
      
      const examSessions = await this.db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));
      
      const sessionIds = examSessions.map((s: { id: number }) => s.id);
      
      if (sessionIds.length > 0) {
        try {
          const sessionGradingResult = await this.db.delete(schema.gradingTasks)
            .where(inArray(schema.gradingTasks.sessionId, sessionIds))
            .returning();
          deletionService.recordDeletion('grading_tasks', sessionGradingResult.length);
        } catch (e) {}

        try {
          const sessionPerfResult = await this.db.delete(schema.performanceEvents)
            .where(inArray(schema.performanceEvents.sessionId, sessionIds))
            .returning();
          deletionService.recordDeletion('performance_events', sessionPerfResult.length);
        } catch (e) {}

        const answersResult = await this.db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds))
          .returning();
        deletionService.recordDeletion('student_answers', answersResult.length);
        
        const sessionsResult = await this.db.delete(schema.examSessions)
          .where(inArray(schema.examSessions.id, sessionIds))
          .returning();
        deletionService.recordDeletion('exam_sessions', sessionsResult.length);
      }

      const examResultsResult = await this.db.delete(schema.examResults)
        .where(eq(schema.examResults.studentId, id))
        .returning();
      deletionService.recordDeletion('exam_results', examResultsResult.length);
      
      const attendanceResult = await this.db.delete(schema.attendance)
        .where(eq(schema.attendance.studentId, id))
        .returning();
      deletionService.recordDeletion('attendance', attendanceResult.length);

      try {
        const caResult = await this.db.delete(schema.continuousAssessment)
          .where(eq(schema.continuousAssessment.studentId, id))
          .returning();
        deletionService.recordDeletion('continuous_assessment', caResult.length);
      } catch (e) {}

      try {
        const subjectAssignResult = await this.db.delete(schema.studentSubjectAssignments)
          .where(eq(schema.studentSubjectAssignments.studentId, id))
          .returning();
        deletionService.recordDeletion('student_subject_assignments', subjectAssignResult.length);
      } catch (e) {}

      try {
        const reportCardItems = await this.db.select({ id: schema.reportCardItems.id })
          .from(schema.reportCardItems)
          .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
          .where(eq(schema.reportCards.studentId, id));
        
        if (reportCardItems.length > 0) {
          const reportCardItemIds = reportCardItems.map((r: any) => r.report_card_items?.id || r.id);
          await this.db.delete(schema.reportCardItems)
            .where(inArray(schema.reportCardItems.id, reportCardItemIds));
          deletionService.recordDeletion('report_card_items', reportCardItemIds.length);
        }
      } catch (e) {}

      try {
        const reportCardsResult = await this.db.delete(schema.reportCards)
          .where(eq(schema.reportCards.studentId, id))
          .returning();
        deletionService.recordDeletion('report_cards', reportCardsResult.length);
      } catch (e) {}
      
      await this.db.update(schema.students)
        .set({ parentId: null })
        .where(eq(schema.students.parentId, id));
      
      const studentResult = await this.db.delete(schema.students)
        .where(eq(schema.students.id, id))
        .returning();
      deletionService.recordDeletion('students', studentResult.length);

      try {
        await this.db.update(schema.classes)
          .set({ classTeacherId: null })
          .where(eq(schema.classes.classTeacherId, id));
      } catch (e) {}

      try {
        await this.db.update(schema.contactMessages)
          .set({ respondedBy: null })
          .where(eq(schema.contactMessages.respondedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.systemSettings)
          .set({ updatedBy: null })
          .where(eq(schema.systemSettings.updatedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.settings)
          .set({ updatedBy: null })
          .where(eq(schema.settings.updatedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.reportCardItems)
          .set({ teacherId: null })
          .where(eq(schema.reportCardItems.teacherId, id));
      } catch (e) {}

      try {
        await this.db.update(schema.reportCardItems)
          .set({ testExamCreatedBy: null })
          .where(eq(schema.reportCardItems.testExamCreatedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.reportCardItems)
          .set({ examExamCreatedBy: null })
          .where(eq(schema.reportCardItems.examExamCreatedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.exams)
          .set({ createdBy: null })
          .where(eq(schema.exams.createdBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.exams)
          .set({ teacherInChargeId: null })
          .where(eq(schema.exams.teacherInChargeId, id));
      } catch (e) {}

      try {
        const vacanciesResult = await this.db.delete(schema.vacancies)
          .where(eq(schema.vacancies.createdBy, id))
          .returning();
        deletionService.recordDeletion('vacancies', vacanciesResult.length);
      } catch (e) {}

      try {
        await this.db.update(schema.teacherApplications)
          .set({ reviewedBy: null })
          .where(eq(schema.teacherApplications.reviewedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.approvedTeachers)
          .set({ approvedBy: null })
          .where(eq(schema.approvedTeachers.approvedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.attendance)
          .set({ recordedBy: null })
          .where(eq(schema.attendance.recordedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.questionBanks)
          .set({ createdBy: null })
          .where(eq(schema.questionBanks.createdBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.homePageContent)
          .set({ uploadedBy: null })
          .where(eq(schema.homePageContent.uploadedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.gallery)
          .set({ uploadedBy: null })
          .where(eq(schema.gallery.uploadedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.studyResources)
          .set({ uploadedBy: null })
          .where(eq(schema.studyResources.uploadedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.studentSubjectAssignments)
          .set({ assignedBy: null })
          .where(eq(schema.studentSubjectAssignments.assignedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.teacherClassAssignments)
          .set({ assignedBy: null })
          .where(eq(schema.teacherClassAssignments.assignedBy, id));
      } catch (e) {}

      try {
        await this.db.update(schema.teacherAssignmentHistory)
          .set({ performedBy: null })
          .where(eq(schema.teacherAssignmentHistory.performedBy, id));
      } catch (e) {}

      if (filesToDelete.length > 0) {
        console.log(`[Smart Deletion] Deleting ${filesToDelete.length} files from storage...`);
        await deletionService.deleteFilesInBatch(filesToDelete);
      }

      const result = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning();
      deletionService.recordDeletion('users', result.length);
      
      const deletionResult = deletionService.getResult();
      const logOutput = formatDeletionLog(deletionResult, id, userRole);
      console.log(logOutput);

      await this.createAuditLog({
        userId: id,
        action: 'user_permanently_deleted',
        entityType: 'user',
        entityId: id,
        oldValue: JSON.stringify({
          email: user.email,
          username: user.username,
          role: userRole,
          firstName: user.firstName,
          lastName: user.lastName
        }),
        newValue: JSON.stringify(deletionResult),
        reason: `Permanent deletion of ${userRole} account: ${user.email || user.username}`,
        ipAddress: 'system',
        userAgent: 'Smart Deletion Service'
      }).catch(() => {});
      
      return result.length > 0;
    } catch (error: any) {
      deletionService.recordError(`Fatal error in deleteUser: ${error.message}`);
      console.error('[Smart Deletion] Error in deleteUser:', error);
      throw error;
    }
  }

  async getUsersByRole(roleId: number): Promise<User[]> {
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(eq(schema.users.roleId, roleId));
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }
  async getUsersByStatus(status: string): Promise<User[]> {
    const result = await this.db.select().from(schema.users).where(sql`${schema.users.status} = ${status}`);
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }
  async getAllUsers(): Promise<User[]> {
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users);
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }
  async approveUser(userId: string, approvedBy: string): Promise<User> {
    const result = await this.db.update(schema.users)
      .set({
        status: 'active',
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }
  async updateUserStatus(userId: string, status: string, updatedBy: string, reason?: string): Promise<User> {
    // Only set approvedBy/approvedAt for actual approvals (status='active')
    // For other status changes (reject/suspend/disable), only update status
    const updates: any = { status };

    if (status === 'active') {
      updates.approvedBy = updatedBy;
      updates.approvedAt = new Date();
    }
    const result = await this.db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning();

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }
  // Role management
  async getRoles(): Promise<Role[]> {
    return await this.db.select().from(schema.roles);
  }
  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await this.db.select().from(schema.roles).where(eq(schema.roles.name, name)).limit(1);
    return result[0];
  }
  async getRole(roleId: number): Promise<Role | undefined> {
    const result = await this.db.select().from(schema.roles).where(eq(schema.roles.id, roleId)).limit(1);
    return result[0];
  }
  // Invite management
  async createInvite(invite: InsertInvite): Promise<Invite> {
    const result = await this.db.insert(schema.invites).values(invite).returning();
    return result[0];
  }
  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const result = await this.db.select().from(schema.invites)
      .where(and(
        eq(schema.invites.token, token),
        isNull(schema.invites.acceptedAt),
        dsql`${schema.invites.expiresAt} > NOW()`
      ))
      .limit(1);
    return result[0];
  }
  async getPendingInviteByEmail(email: string): Promise<Invite | undefined> {
    const result = await this.db.select().from(schema.invites)
      .where(and(
        eq(schema.invites.email, email),
        isNull(schema.invites.acceptedAt)
      ))
      .limit(1);
    return result[0];
  }
  async getAllInvites(): Promise<Invite[]> {
    return await this.db.select().from(schema.invites)
      .orderBy(desc(schema.invites.createdAt));
  }
  async getPendingInvites(): Promise<Invite[]> {
    return await this.db.select().from(schema.invites)
      .where(isNull(schema.invites.acceptedAt))
      .orderBy(desc(schema.invites.createdAt));
  }
  async markInviteAsAccepted(inviteId: number, acceptedBy: string): Promise<void> {
    await this.db.update(schema.invites)
      .set({ acceptedAt: new Date(), acceptedBy })
      .where(eq(schema.invites.id, inviteId));
  }
  async deleteInvite(inviteId: number): Promise<boolean> {
    const result = await this.db.delete(schema.invites)
      .where(eq(schema.invites.id, inviteId))
      .returning();
    return result.length > 0;
  }
  async deleteExpiredInvites(): Promise<boolean> {
    const result = await this.db.delete(schema.invites)
      .where(and(
        dsql`${schema.invites.expiresAt} < NOW()`,
        isNull(schema.invites.acceptedAt)
      ))
      .returning();
    return result.length > 0;
  }
  // Profile management
  async updateUserProfile(userId: string, profileData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await this.db.update(schema.users)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }
  async getTeacherProfile(userId: string): Promise<TeacherProfile | undefined> {
    const [profile] = await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, userId));
    return profile || undefined;
  }
  async updateTeacherProfile(userId: string, profile: Partial<InsertTeacherProfile>): Promise<TeacherProfile | undefined> {
    const result = await this.db.update(schema.teacherProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.teacherProfiles.userId, userId))
      .returning();
    return result[0];
  }
  async getTeacherProfileByStaffId(staffId: string): Promise<TeacherProfile | undefined> {
    const [profile] = await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.staffId, staffId));
    return profile || undefined;
  }
  async getAllTeacherProfiles(): Promise<TeacherProfile[]> {
    const profiles = await db.select().from(schema.teacherProfiles);
    return profiles;
  }
  async createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile> {
    const result = await this.db.insert(schema.teacherProfiles)
      .values(profile)
      .returning();
    return result[0];
  }
  async getAdminProfile(userId: string): Promise<AdminProfile | undefined> {
    const result = await this.db.select().from(schema.adminProfiles)
      .where(eq(schema.adminProfiles.userId, userId))
      .limit(1);
    return result[0];
  }
  async createAdminProfile(profile: InsertAdminProfile): Promise<AdminProfile> {
    const result = await this.db.insert(schema.adminProfiles)
      .values(profile)
      .returning();
    return result[0];
  }
  async updateAdminProfile(userId: string, profile: Partial<InsertAdminProfile>): Promise<AdminProfile | undefined> {
    const result = await this.db.update(schema.adminProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.adminProfiles.userId, userId))
      .returning();
    return result[0];
  }
  async getSuperAdminProfile(userId: string): Promise<SuperAdminProfile | undefined> {
    const result = await this.db.select().from(schema.superAdminProfiles)
      .where(eq(schema.superAdminProfiles.userId, userId))
      .limit(1);
    return result[0];
  }
  async createSuperAdminProfile(profile: InsertSuperAdminProfile): Promise<SuperAdminProfile> {
    const result = await this.db.insert(schema.superAdminProfiles)
      .values(profile)
      .returning();
    return result[0];
  }
  async updateSuperAdminProfile(userId: string, profile: Partial<InsertSuperAdminProfile>): Promise<SuperAdminProfile | undefined> {
    const result = await this.db.update(schema.superAdminProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.superAdminProfiles.userId, userId))
      .returning();
    return result[0];
  }
  async getParentProfile(userId: string): Promise<ParentProfile | undefined> {
    const result = await this.db.select().from(schema.parentProfiles)
      .where(eq(schema.parentProfiles.userId, userId))
      .limit(1);
    return result[0];
  }
  async createParentProfile(profile: InsertParentProfile): Promise<ParentProfile> {
    const result = await this.db.insert(schema.parentProfiles)
      .values(profile)
      .returning();
    return result[0];
  }
  async updateParentProfile(userId: string, profile: Partial<InsertParentProfile>): Promise<ParentProfile | undefined> {
    const result = await this.db.update(schema.parentProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.parentProfiles.userId, userId))
      .returning();
    return result[0];
  }
  async calculateProfileCompletion(userId: string, roleId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone', 'address',
      'dateOfBirth', 'gender', 'profileImageUrl', 'state', 'country',
      'securityQuestion', 'securityAnswerHash', 'dataPolicyAgreed'
    ];

    let completedFields = 0;
    requiredFields.forEach(field => {
      if (user[field as keyof User]) {
        completedFields++;
      }
    });

    // Check role-specific profile completion
    // Role IDs: 1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent
    if (roleId === 1) { // Super Admin
      const superAdminProfile = await this.getSuperAdminProfile(userId);
      if (superAdminProfile?.department) completedFields++;
      if (superAdminProfile?.accessLevel) completedFields++;
      if (superAdminProfile?.twoFactorEnabled !== undefined) completedFields++;
    } else if (roleId === 2) { // Admin
      const adminProfile = await this.getAdminProfile(userId);
      if (adminProfile?.department) completedFields++;
      if (adminProfile?.roleDescription) completedFields++;
      if (adminProfile?.accessLevel) completedFields++;
    } else if (roleId === 3) { // Teacher
      const teacherProfile = await this.getTeacherProfile(userId);
      if (teacherProfile?.subjects && teacherProfile.subjects.length > 0) completedFields++;
      if (teacherProfile?.assignedClasses && teacherProfile.assignedClasses.length > 0) completedFields++;
      if (teacherProfile?.qualification) completedFields++;
      if (teacherProfile?.yearsOfExperience) completedFields++;
    } else if (roleId === 4) { // Student
      const student = await this.getStudent(userId);
      if (student?.classId) completedFields++;
      if (student?.guardianName) completedFields++;
      if (student?.emergencyContact) completedFields++;
    } else if (roleId === 5) { // Parent
      const parentProfile = await this.getParentProfile(userId);
      if (parentProfile?.occupation) completedFields++;
      if (parentProfile?.contactPreference) completedFields++;
      if (parentProfile?.linkedStudents && parentProfile.linkedStudents.length > 0) completedFields++;
    }
    const totalFields = requiredFields.length + 3; // 3 role-specific fields on average
    return Math.round((completedFields / totalFields) * 100);
  }
  // Student management
  async getStudent(id: string): Promise<Student | undefined> {
    const result = await this.db
      .select({
        // Student fields
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        department: schema.students.department,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        emergencyPhone: schema.students.emergencyPhone,
        medicalInfo: schema.students.medicalInfo,
        guardianName: schema.students.guardianName,
        createdAt: schema.students.createdAt,
        // User fields (merged into student object)
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        address: schema.users.address,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        profileImageUrl: schema.users.profileImageUrl,
        recoveryEmail: schema.users.recoveryEmail,
        // Class name (from classes table)
        className: schema.classes.name,
      })
      .from(schema.students)
      .leftJoin(schema.users, eq(schema.students.id, schema.users.id))
      .leftJoin(schema.classes, eq(schema.students.classId, schema.classes.id))
      .where(eq(schema.students.id, id))
      .limit(1);
    
    const student = result[0];
    if (student && student.id) {
      const normalizedId = normalizeUuid(student.id);
      if (normalizedId) {
        student.id = normalizedId;
      }
    }
    return student as any;
  }
  
  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    return this.getStudent(userId);
  }
  
  async getLinkedStudents(parentId: string): Promise<Student[]> {
    const result = await this.db
      .select({
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        department: schema.students.department,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        emergencyPhone: schema.students.emergencyPhone,
        medicalInfo: schema.students.medicalInfo,
        guardianName: schema.students.guardianName,
        createdAt: schema.students.createdAt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        address: schema.users.address,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        profileImageUrl: schema.users.profileImageUrl,
        className: schema.classes.name,
      })
      .from(schema.students)
      .leftJoin(schema.users, eq(schema.students.id, schema.users.id))
      .leftJoin(schema.classes, eq(schema.students.classId, schema.classes.id))
      .where(eq(schema.students.parentId, parentId));
    
    return result.map((student: any) => {
      if (student && student.id) {
        const normalizedId = normalizeUuid(student.id);
        if (normalizedId) {
          student.id = normalizedId;
        }
      }
      return student;
    }) as any[];
  }
  
  async getAllUsernames(): Promise<string[]> {
    const result = await this.db.select({ username: schema.users.username }).from(schema.users).where(sql`${schema.users.username} IS NOT NULL`);
    return result.map((r: { username: string | null }) => r.username).filter((u: string | null): u is string => u !== null);
  }
  async createStudent(student: InsertStudent): Promise<Student> {
    const result = await db.insert(schema.students).values(student).returning();
    return result[0];
  }
  async updateStudent(id: string, updates: { userPatch?: Partial<InsertUser>; studentPatch?: Partial<InsertStudent> }): Promise<{ user: User; student: Student } | undefined> {
    // NOTE: Neon HTTP driver does NOT support transactions
    // Using direct operations instead
    try {
      let updatedUser: User | undefined;
      let updatedStudent: Student | undefined;

      // Update user if userPatch is provided
      if (updates.userPatch && Object.keys(updates.userPatch).length > 0) {
        const userResult = await this.db.update(schema.users)
          .set(updates.userPatch)
          .where(eq(schema.users.id, id))
          .returning();
        updatedUser = userResult[0];
      } else {
        // Get current user data if no updates
        const userResult = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
        updatedUser = userResult[0];
      }
      // Update student if studentPatch is provided
      if (updates.studentPatch && Object.keys(updates.studentPatch).length > 0) {
        const studentResult = await this.db.update(schema.students)
          .set(updates.studentPatch)
          .where(eq(schema.students.id, id))
          .returning();
        updatedStudent = studentResult[0];
      } else {
        // Get current student data if no updates
        const studentResult = await this.db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1);
        updatedStudent = studentResult[0];
      }
      if (updatedUser && updatedStudent) {
        return { user: updatedUser, student: updatedStudent };
      }
      return undefined;
    } catch (error) {
      throw error;
    }
  }
  async setUserActive(id: string, isActive: boolean): Promise<User | undefined> {
    const result = await this.db.update(schema.users)
      .set({ isActive })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }
  async deleteStudent(id: string, deletedBy?: string): Promise<boolean> {
    // Soft deletion by setting user as inactive and recording deletion timestamp
    // This preserves referential integrity for attendance, exams, etc.
    // User can be recovered within retention period
    const result = await this.db.update(schema.users)
      .set({ 
        isActive: false, 
        deletedAt: new Date(),
        deletedBy: deletedBy || null
      })
      .where(eq(schema.users.id, id))
      .returning();
    return result.length > 0;
  }
  async hardDeleteStudent(id: string): Promise<boolean> {
    // Hard deletion with proper cascade handling
    // Delete in correct order to respect foreign key constraints
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // 1. Get all exam sessions for this student
      const examSessions = await this.db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));

      const sessionIds = examSessions.map((session: any) => session.id);

      // 2. Delete student answers for all their exam sessions
      if (sessionIds.length > 0) {
        await this.db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds));
      }
      // 3. Delete exam sessions for this student
      await this.db.delete(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));

      // 4. Delete exam results for this student
      await this.db.delete(schema.examResults)
        .where(eq(schema.examResults.studentId, id));

      // 5. Delete attendance records for this student
      await this.db.delete(schema.attendance)
        .where(eq(schema.attendance.studentId, id));

      // 6. Delete the student record
      await this.db.delete(schema.students)
        .where(eq(schema.students.id, id));

      // 7. Delete the user record
      const userResult = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning();

      return userResult.length > 0;
    } catch (error) {
      throw error;
    }
  }
  async getStudentsByClass(classId: number): Promise<Student[]> {
    // Return all students in class regardless of active status for admin management
    return await db.select().from(schema.students).where(eq(schema.students.classId, classId));
  }
  async getAllStudents(includeInactive = false): Promise<Student[]> {
    if (includeInactive) {
      // Return all students regardless of active status
      return await this.db.select().from(schema.students).orderBy(asc(schema.students.createdAt));
    } else {
      // Only return students with active user accounts
      return await this.db.select({
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        medicalInfo: schema.students.medicalInfo,
        createdAt: schema.students.createdAt,
      })
        .from(schema.students)
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .where(eq(schema.users.isActive, true))
        .orderBy(asc(schema.students.createdAt));
    }
  }

  async getStudentByAdmissionNumber(admissionNumber: string): Promise<Student | undefined> {
    const result = await db.select().from(schema.students).where(eq(schema.students.admissionNumber, admissionNumber)).limit(1);
    return result[0];
  }
  // Class management
  async getClasses(): Promise<Class[]> {
    return await db.select().from(schema.classes).where(eq(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
  }
  async getAllClasses(includeInactive = false): Promise<Class[]> {
    if (includeInactive) {
      return await db.select().from(schema.classes).orderBy(asc(schema.classes.name));
    } else {
      return await db.select().from(schema.classes).where(eq(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
    }
  }

  async getClass(id: number): Promise<Class | undefined> {
    const result = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
    return result[0];
  }
  async createClass(classData: InsertClass): Promise<Class> {
    const result = await db.insert(schema.classes).values(classData).returning();
    return result[0];
  }
  async updateClass(id: number, classData: Partial<InsertClass>): Promise<Class | undefined> {
    const result = await db.update(schema.classes).set(classData).where(eq(schema.classes.id, id)).returning();
    return result[0];
  }
  async deleteClass(id: number): Promise<boolean> {
    const result = await db.delete(schema.classes).where(eq(schema.classes.id, id));
    return result.length > 0;
  }
  // Subject management
  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name));
  }
  async getSubject(id: number): Promise<Subject | undefined> {
    const result = await db.select().from(schema.subjects).where(eq(schema.subjects.id, id)).limit(1);
    return result[0];
  }
  async createSubject(subject: InsertSubject): Promise<Subject> {
    const result = await db.insert(schema.subjects).values(subject).returning();
    return result[0];
  }
  async updateSubject(id: number, subject: Partial<InsertSubject>): Promise<Subject | undefined> {
    const result = await db.update(schema.subjects).set(subject).where(eq(schema.subjects.id, id)).returning();
    return result[0];
  }
  async deleteSubject(id: number): Promise<boolean> {
    const result = await db.delete(schema.subjects).where(eq(schema.subjects.id, id));
    return result.length > 0;
  }
  // Academic terms
  async getCurrentTerm(): Promise<AcademicTerm | undefined> {
    const result = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.isCurrent, true)).limit(1);
    return result[0];
  }
  async getTerms(): Promise<AcademicTerm[]> {
    return await db.select().from(schema.academicTerms).orderBy(desc(schema.academicTerms.startDate));
  }
  async getAcademicTerms(): Promise<AcademicTerm[]> {
    try {
      const terms = await db.select().from(schema.academicTerms).orderBy(desc(schema.academicTerms.startDate));
      return terms;
    } catch (error) {
      throw error;
    }
  }

  async getAcademicTerm(id: number): Promise<AcademicTerm | undefined> {
    try {
      const result = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.id, id)).limit(1);
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  async createAcademicTerm(term: any): Promise<AcademicTerm> {
    try {
      const result = await db.insert(schema.academicTerms).values(term).returning();
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  async updateAcademicTerm(id: number, term: any): Promise<AcademicTerm | undefined> {
    try {
      const result = await db.update(schema.academicTerms).set(term).where(eq(schema.academicTerms.id, id)).returning();
      if (result[0]) {
      }
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  async deleteAcademicTerm(id: number): Promise<boolean> {
    try {
      
      // First check if the term exists
      const existingTerm = await db.select().from(schema.academicTerms)
        .where(eq(schema.academicTerms.id, id))
        .limit(1);
      
      if (!existingTerm || existingTerm.length === 0) {
        return false;
      }
      
      // Check for foreign key constraints - exams using this term
      const examsUsingTerm = await db.select({ id: schema.exams.id })
        .from(schema.exams)
        .where(eq(schema.exams.termId, id));
      
      if (examsUsingTerm && examsUsingTerm.length > 0) {
        throw new Error(`Cannot delete this term. ${examsUsingTerm.length} exam(s) are linked to it. Please reassign or delete those exams first.`);
      }
      // Perform the deletion with returning clause for verification
      const result = await db.delete(schema.academicTerms)
        .where(eq(schema.academicTerms.id, id))
        .returning();
      
      const success = result && result.length > 0;
      
      if (success) {
      } else {
      }
      return success;
    } catch (error: any) {
      
      // Handle specific PostgreSQL errors
      if (error?.code === '23503') {
        throw new Error('Cannot delete this term because it is being used by other records (exams, classes, etc.). Please remove those associations first.');
      }
      throw error;
    }
  }

  async markTermAsCurrent(id: number): Promise<AcademicTerm | undefined> {
    try {
      // First, set all terms to not current
      await db.update(schema.academicTerms).set({ isCurrent: false });
      // Then mark the specified term as current
      const result = await db.update(schema.academicTerms).set({ isCurrent: true }).where(eq(schema.academicTerms.id, id)).returning();
      if (result[0]) {
      }
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Helper method to check if a term is being used
  async getExamsByTerm(termId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams).where(eq(schema.exams.termId, termId));
      return result;
    } catch (error) {
      return [];
    }
  }

  // Attendance management
  async recordAttendance(attendance: InsertAttendance): Promise<Attendance> {
    const result = await db.insert(schema.attendance).values(attendance).returning();
    return result[0];
  }
  async getAttendanceByStudent(studentId: string, date?: string): Promise<Attendance[]> {
    if (date) {
      return await db.select().from(schema.attendance)
        .where(and(eq(schema.attendance.studentId, studentId), eq(schema.attendance.date, date)));
    }
    return await db.select().from(schema.attendance)
      .where(eq(schema.attendance.studentId, studentId))
      .orderBy(desc(schema.attendance.date));
  }
  async getAttendanceByClass(classId: number, date: string): Promise<Attendance[]> {
    return await db.select().from(schema.attendance)
      .where(and(eq(schema.attendance.classId, classId), eq(schema.attendance.date, date)));
  }
  // Exam management
  async createExam(exam: InsertExam): Promise<Exam> {
    const result = await db.insert(schema.exams).values(exam).returning();
    return result[0];
  }
  async getAllExams(): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }

  async getExamById(id: number): Promise<Exam | undefined> {
    const result = await db.select().from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);
    return result[0];
  }
  async getExamsByClass(classId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .where(eq(schema.exams.classId, classId))
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }

  async getExamsByClassAndTerm(classId: number, termId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .where(and(
          eq(schema.exams.classId, classId),
          eq(schema.exams.termId, termId)
        ))
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }

  async updateExam(id: number, exam: Partial<InsertExam>): Promise<Exam | undefined> {
    const result = await db.update(schema.exams)
      .set(exam)
      .where(eq(schema.exams.id, id))
      .returning();
    return result[0];
  }
  async deleteExam(id: number): Promise<{
    success: boolean;
    deletedCounts: {
      questions: number;
      questionOptions: number;
      sessions: number;
      studentAnswers: number;
      results: number;
      gradingTasks: number;
      performanceEvents: number;
      filesDeleted: number;
      reportCardRefsCleared: number;
    };
  }> {
    const deletedCounts = {
      questions: 0,
      questionOptions: 0,
      sessions: 0,
      studentAnswers: 0,
      results: 0,
      gradingTasks: 0,
      performanceEvents: 0,
      filesDeleted: 0,
      reportCardRefsCleared: 0
    };

    try {
      console.log(`[SmartDeletion] Starting comprehensive exam deletion for exam ID: ${id}`);

      // First get all question IDs and image URLs for this exam
      const examQuestions = await db.select({ 
        id: schema.examQuestions.id,
        imageUrl: schema.examQuestions.imageUrl 
      })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.examId, id));
      
      const questionIds = examQuestions.map((q: { id: number }) => q.id);
      deletedCounts.questions = questionIds.length;

      // Delete question images from Cloudinary/local storage
      for (const question of examQuestions) {
        if (question.imageUrl) {
          try {
            const deleted = await deleteFile(question.imageUrl);
            if (deleted) deletedCounts.filesDeleted++;
          } catch (fileError) {
            console.error(`[SmartDeletion] Error deleting question image for question ${question.id}:`, fileError);
          }
        }
      }

      // Get all question option images for these questions
      let optionCount = 0;
      if (questionIds.length > 0) {
        try {
          const questionOptions = await db.select({
            id: schema.questionOptions.id,
            imageUrl: schema.questionOptions.imageUrl
          })
            .from(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds));
          
          optionCount = questionOptions.length;
          
          // Delete question option images from Cloudinary/local storage
          for (const option of questionOptions) {
            if (option.imageUrl) {
              try {
                const deleted = await deleteFile(option.imageUrl);
                if (deleted) deletedCounts.filesDeleted++;
              } catch (fileError) {
                console.error(`[SmartDeletion] Error deleting option image for option ${option.id}:`, fileError);
              }
            }
          }
        } catch (e) {
          // imageUrl column might not exist in question_options - get count without imageUrl
          const optionCountResult = await db.select({ id: schema.questionOptions.id })
            .from(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds));
          optionCount = optionCountResult.length;
        }
      }
      deletedCounts.questionOptions = optionCount;

      // Get all session IDs for this exam (needed for cascading deletes)
      const examSessions = await db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.examId, id));
      
      const sessionIds = examSessions.map((s: { id: number }) => s.id);
      deletedCounts.sessions = sessionIds.length;

      // Delete in order respecting foreign key constraints
      if (sessionIds.length > 0) {
        // Delete grading tasks for these sessions
        const gradingTasksResult = await db.delete(schema.gradingTasks)
          .where(inArray(schema.gradingTasks.sessionId, sessionIds))
          .returning();
        deletedCounts.gradingTasks = gradingTasksResult.length;
        
        // Delete performance events for these sessions  
        const perfEventsResult = await db.delete(schema.performanceEvents)
          .where(inArray(schema.performanceEvents.sessionId, sessionIds))
          .returning();
        deletedCounts.performanceEvents = perfEventsResult.length;

        // Delete student answers by session
        const answersResult = await db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds))
          .returning();
        deletedCounts.studentAnswers = answersResult.length;
      }

      if (questionIds.length > 0) {
        // Delete any remaining student answers by question (fallback)
        const remainingAnswers = await db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.questionId, questionIds))
          .returning();
        deletedCounts.studentAnswers += remainingAnswers.length;

        // Delete question options for all questions in this exam  
        await db.delete(schema.questionOptions)
          .where(inArray(schema.questionOptions.questionId, questionIds));

        // Delete exam questions
        await db.delete(schema.examQuestions)
          .where(eq(schema.examQuestions.examId, id));
      }

      // Delete exam results
      const resultsResult = await db.delete(schema.examResults)
        .where(eq(schema.examResults.examId, id))
        .returning();
      deletedCounts.results = resultsResult.length;

      // Delete exam sessions (after their dependent records are gone)
      await db.delete(schema.examSessions)
        .where(eq(schema.examSessions.examId, id));

      // Clear exam references from report card items (set to NULL instead of deleting)
      // This preserves historical report card data while removing the exam link
      const testExamRefs = await db.update(schema.reportCardItems)
        .set({ testExamId: null })
        .where(eq(schema.reportCardItems.testExamId, id))
        .returning();
      
      const examExamRefs = await db.update(schema.reportCardItems)
        .set({ examExamId: null })
        .where(eq(schema.reportCardItems.examExamId, id))
        .returning();
      
      deletedCounts.reportCardRefsCleared = testExamRefs.length + examExamRefs.length;

      // Finally delete the exam itself
      const result = await db.delete(schema.exams)
        .where(eq(schema.exams.id, id))
        .returning();

      const success = result.length > 0;

      console.log(`[SmartDeletion] Exam ${id} deletion complete:`, {
        success,
        deletedCounts
      });

      return { success, deletedCounts };
    } catch (error) {
      console.error('[SmartDeletion] Error deleting exam:', error);
      throw error;
    }
  }

  async recordExamResult(result: InsertExamResult): Promise<ExamResult> {
    try {
      const examResult = await db.insert(schema.examResults).values(result).returning();
      return examResult[0];
    } catch (error: any) {
      // Handle missing columns by removing autoScored from the insert
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('auto_scored')) {
        const { autoScored, ...resultWithoutAutoScored } = result;
        // Map score to marksObtained for compatibility with existing schema
        const compatibleResult = {
          ...resultWithoutAutoScored,
          marksObtained: result.score || 0
        };
        const examResult = await db.insert(schema.examResults).values(compatibleResult).returning();
        return {
          ...examResult[0],
          autoScored: result.recordedBy === '00000000-0000-0000-0000-000000000001',
          score: examResult[0].marksObtained || 0
        } as ExamResult;
      }
      throw error;
    }
  }

  async updateExamResult(id: number, result: Partial<InsertExamResult>): Promise<ExamResult | undefined> {
    try {
      const updated = await db.update(schema.examResults)
        .set(result)
        .where(eq(schema.examResults.id, id))
        .returning();
      return updated[0];
    } catch (error: any) {
      // Handle missing columns by removing autoScored from the update
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('auto_scored')) {
        const { autoScored, ...resultWithoutAutoScored } = result;
        // Map score to marksObtained for compatibility with existing schema
        const compatibleResult = {
          ...resultWithoutAutoScored,
          marksObtained: result.score || 0
        };
        const updated = await db.update(schema.examResults)
          .set(compatibleResult)
          .where(eq(schema.examResults.id, id))
          .returning();
        return {
          ...updated[0],
          autoScored: result.recordedBy === '00000000-0000-0000-0000-000000000001',
          score: updated[0].marksObtained || 0
        } as ExamResult;
      }
      throw error;
    }
  }

  async getExamResultsByStudent(studentId: string): Promise<ExamResult[]> {
    const SYSTEM_AUTO_SCORING_UUID = '00000000-0000-0000-0000-000000000001';
    
    console.log(`[getExamResultsByStudent] Fetching results for student: ${studentId}`);
    
    // CRITICAL FIX: Use simple, reliable query without complex SQL that might fail
    // This mirrors the approach used by getExamResultByExamAndStudent which works correctly
    // for report cards. We fetch exam_results directly without complex JOINs or casts.
    try {
      // Primary query: Simple and reliable - directly query exam_results table
      const results = await this.db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        studentId: schema.examResults.studentId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        marksObtained: schema.examResults.marksObtained,
        grade: schema.examResults.grade,
        remarks: schema.examResults.remarks,
        autoScored: schema.examResults.autoScored,
        recordedBy: schema.examResults.recordedBy,
        createdAt: schema.examResults.createdAt,
      }).from(schema.examResults)
        .where(eq(schema.examResults.studentId, studentId))
        .orderBy(desc(schema.examResults.createdAt));
      
      console.log(`[getExamResultsByStudent] Primary query returned ${results.length} results`);
      
      // Enrich results with exam's totalMarks if maxScore is null
      const enrichedResults = await Promise.all(results.map(async (result: any) => {
        // Ensure score field is populated from marksObtained if needed
        const finalScore = result.score ?? result.marksObtained ?? 0;
        let finalMaxScore = result.maxScore;
        
        // If maxScore is null, try to get it from the exam
        if (finalMaxScore === null || finalMaxScore === undefined) {
          try {
            const exam = await this.db.select({ totalMarks: schema.exams.totalMarks })
              .from(schema.exams)
              .where(eq(schema.exams.id, result.examId))
              .limit(1);
            finalMaxScore = exam[0]?.totalMarks ?? 100;
          } catch (examLookupError) {
            console.warn(`[getExamResultsByStudent] Could not fetch exam totalMarks for examId ${result.examId}`);
            finalMaxScore = 100;
          }
        }
        
        // Determine autoScored from recordedBy if autoScored column is null
        const isAutoScored = result.autoScored ?? (result.recordedBy === SYSTEM_AUTO_SCORING_UUID);
        
        return {
          ...result,
          score: finalScore,
          maxScore: finalMaxScore,
          autoScored: isAutoScored
        };
      }));
      
      return enrichedResults;
    } catch (primaryError: any) {
      console.error(`[getExamResultsByStudent] Primary query failed for student ${studentId}:`, primaryError?.message || primaryError);
      
      // Fallback: Even simpler query without any computed fields
      try {
        console.log(`[getExamResultsByStudent] Attempting fallback query...`);
        const fallbackResults = await this.db.select()
          .from(schema.examResults)
          .where(eq(schema.examResults.studentId, studentId))
          .orderBy(desc(schema.examResults.createdAt));
        
        console.log(`[getExamResultsByStudent] Fallback query returned ${fallbackResults.length} results`);
        
        // Normalize the fallback results
        return fallbackResults.map((result: any) => ({
          id: result.id,
          examId: result.examId,
          studentId: result.studentId,
          score: result.score ?? result.marksObtained ?? 0,
          maxScore: result.maxScore ?? 100,
          marksObtained: result.marksObtained,
          grade: result.grade,
          remarks: result.remarks,
          autoScored: result.autoScored ?? (result.recordedBy === SYSTEM_AUTO_SCORING_UUID),
          recordedBy: result.recordedBy,
          createdAt: result.createdAt,
        }));
      } catch (fallbackError: any) {
        console.error(`[getExamResultsByStudent] CRITICAL: Fallback query also failed for student ${studentId}:`, fallbackError?.message || fallbackError);
        // Return empty array only if ALL queries fail - but log it
        return [];
      }
    }
  }

  async getExamResultsByExam(examId: number): Promise<ExamResult[]> {
    try {
      return await db.select().from(schema.examResults)
        .where(eq(schema.examResults.examId, examId))
        .orderBy(desc(schema.examResults.createdAt));
    } catch (error: any) {
      // Handle missing columns by selecting only the columns that exist
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('column') && error?.cause?.message?.includes('does not exist')) {
        try {
          return await db.select({
            id: schema.examResults.id,
            examId: schema.examResults.examId,
            studentId: schema.examResults.studentId,
            marksObtained: schema.examResults.marksObtained, // Use legacy field
            grade: schema.examResults.grade,
            remarks: schema.examResults.remarks,
            recordedBy: schema.examResults.recordedBy,
            createdAt: schema.examResults.createdAt,
            // Map marksObtained to score for compatibility
            score: schema.examResults.marksObtained,
            maxScore: dsql`null`.as('maxScore'),
            // Since auto_scored column doesn't exist, determine from recordedBy
            autoScored: dsql`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as('autoScored')
          }).from(schema.examResults)
            .where(eq(schema.examResults.examId, examId))
            .orderBy(desc(schema.examResults.createdAt));
        } catch (fallbackError) {
          return [];
        }
      }
      throw error;
    }
  }

  async getExamResultByExamAndStudent(examId: number, studentId: string): Promise<ExamResult | undefined> {
    const result = await db.select().from(schema.examResults)
      .where(
        sql`${schema.examResults.examId} = ${examId} AND ${schema.examResults.studentId} = ${studentId}`
      )
      .limit(1);
    return result[0];
  }
  async getExamResultsByClass(classId: number): Promise<any[]> {
    try {
      // Join all needed tables to get complete data
      const results = await db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        studentId: schema.examResults.studentId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        marksObtained: schema.examResults.marksObtained,
        grade: schema.examResults.grade,
        remarks: schema.examResults.remarks,
        recordedBy: schema.examResults.recordedBy,
        autoScored: schema.examResults.autoScored,
        createdAt: schema.examResults.createdAt,
        examName: schema.exams.name,
        examType: schema.exams.examType,
        examDate: schema.exams.date,
        totalMarks: schema.exams.totalMarks,
        admissionNumber: schema.students.admissionNumber,
        studentName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`.as('studentName'),
        className: schema.classes.name,
        subjectName: schema.subjects.name,
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .innerJoin(schema.students, eq(schema.examResults.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .leftJoin(schema.classes, eq(schema.exams.classId, schema.classes.id))
        .leftJoin(schema.subjects, eq(schema.exams.subjectId, schema.subjects.id))
        .where(eq(schema.exams.classId, classId))
        .orderBy(desc(schema.examResults.createdAt));

      // Results already contain all needed data from joins
      return results;
    } catch (error: any) {

      // Handle missing columns by using a fallback query
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('column') && error?.cause?.message?.includes('does not exist')) {
        try {
          // Fallback query using only existing columns
          const results = await db.select({
            id: schema.examResults.id,
            examId: schema.examResults.examId,
            studentId: schema.examResults.studentId,
            marksObtained: schema.examResults.marksObtained,
            grade: schema.examResults.grade,
            remarks: schema.examResults.remarks,
            recordedBy: schema.examResults.recordedBy,
            createdAt: schema.examResults.createdAt,
            // Map marksObtained to score for compatibility
            score: schema.examResults.marksObtained,
            maxScore: dsql`null`.as('maxScore'),
            // Infer autoScored based on recordedBy
            autoScored: dsql`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as('autoScored')
          })
            .from(schema.examResults)
            .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
            .where(eq(schema.exams.classId, classId))
            .orderBy(desc(schema.examResults.createdAt));

          // Return fallback results as-is
          return results;
        } catch (fallbackError) {
          return [];
        }
      }
      throw error;
    }
  }


  // Exam questions management
  async createExamQuestion(question: InsertExamQuestion): Promise<ExamQuestion> {
    // Use all available columns from the schema
    const questionData = {
      examId: question.examId,
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points,
      orderNumber: question.orderNumber,
      imageUrl: question.imageUrl,
      autoGradable: question.autoGradable ?? true,
      expectedAnswers: question.expectedAnswers,
      caseSensitive: question.caseSensitive ?? false,
      allowPartialCredit: question.allowPartialCredit ?? false,
      partialCreditRules: question.partialCreditRules,
      explanationText: question.explanationText,
      hintText: question.hintText,
    };
    const result = await db.insert(schema.examQuestions).values(questionData).returning();
    return result[0];
  }
  async createExamQuestionWithOptions(
    question: InsertExamQuestion,
    options?: Array<{optionText: string; isCorrect: boolean}>
  ): Promise<ExamQuestion> {
    // NOTE: Neon HTTP driver does NOT support transactions
    // Using direct inserts instead of db.transaction()
    try {
      // Use all available columns from the schema
      const questionData = {
        examId: question.examId,
        questionText: question.questionText,
        questionType: question.questionType,
        points: question.points,
        orderNumber: question.orderNumber,
        imageUrl: question.imageUrl,
        autoGradable: question.autoGradable ?? true,
        expectedAnswers: question.expectedAnswers,
        caseSensitive: question.caseSensitive ?? false,
        allowPartialCredit: question.allowPartialCredit ?? false,
        partialCreditRules: question.partialCreditRules,
        explanationText: question.explanationText,
        hintText: question.hintText,
      };
      // Insert question first
      const questionResult = await db.insert(schema.examQuestions).values(questionData).returning();
      const createdQuestion = questionResult[0];

      // Insert options if provided
      if (Array.isArray(options) && options.length > 0) {
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          await db.insert(schema.questionOptions).values({
            questionId: createdQuestion.id,
            optionText: option.optionText,
            orderNumber: i + 1,
            isCorrect: option.isCorrect
          });
          // Small delay to prevent connection overload
          if (i < options.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
      return createdQuestion;
    } catch (error) {
      throw new Error(`Failed to create question with options: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async createExamQuestionsBulk(
    questionsData: Array<{
      question: InsertExamQuestion;
      options?: Array<{optionText: string; isCorrect: boolean}>;
    }>
  ): Promise<{ created: number; questions: ExamQuestion[]; errors: string[] }> {
    const createdQuestions: ExamQuestion[] = [];
    const errors: string[] = [];


    // SEQUENTIAL processing to prevent circuit breaker - NO parallel requests
    for (let i = 0; i < questionsData.length; i++) {
      const { question, options } = questionsData[i];

      try {

        const createdQuestion = await this.createExamQuestionWithOptions(question, options);
        createdQuestions.push(createdQuestion);


        // Throttling delay between EACH question to prevent circuit breaker
        if (i < questionsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay between questions
        }
      } catch (error) {
        const errorMsg = `Question ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);

        // Check if this is a circuit breaker error and implement backoff
        if (error instanceof Error && (
          error.message.includes('circuit') ||
          error.message.includes('breaker') ||
          error.message.includes('pool') ||
          error.message.includes('connection')
        )) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second backoff on connection issues
        } else {
          // Normal error delay
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    return {
      created: createdQuestions.length,
      questions: createdQuestions,
      errors
    };
  }
  async getExamQuestions(examId: number): Promise<ExamQuestion[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.examQuestions.id,
      examId: schema.examQuestions.examId,
      questionText: schema.examQuestions.questionText,
      questionType: schema.examQuestions.questionType,
      points: schema.examQuestions.points,
      orderNumber: schema.examQuestions.orderNumber,
      imageUrl: schema.examQuestions.imageUrl,
      createdAt: schema.examQuestions.createdAt,
    }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.examId, examId))
      .orderBy(asc(schema.examQuestions.orderNumber));
  }
  async getExamQuestionById(id: number): Promise<ExamQuestion | undefined> {
    const result = await db.select({
      id: schema.examQuestions.id,
      examId: schema.examQuestions.examId,
      questionText: schema.examQuestions.questionText,
      questionType: schema.examQuestions.questionType,
      points: schema.examQuestions.points,
      orderNumber: schema.examQuestions.orderNumber,
      imageUrl: schema.examQuestions.imageUrl,
      createdAt: schema.examQuestions.createdAt,
    }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.id, id))
      .limit(1);
    return result[0];
  }
  async getExamQuestionCount(examId: number): Promise<number> {
    const result = await db.select({ count: dsql`count(*)` }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.examId, examId));
    return Number(result[0]?.count || 0);
  }
  // Get question counts for multiple exams
  async getExamQuestionCounts(examIds: number[]): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};

    for (const examId of examIds) {
      try {
        const count = await this.getExamQuestionCount(examId);
        counts[examId] = count;
      } catch (error) {
        counts[examId] = 0;
      }
    }

    return counts;
  }
  async updateExamQuestion(id: number, question: Partial<InsertExamQuestion>): Promise<ExamQuestion | undefined> {
    const result = await db.update(schema.examQuestions)
      .set(question)
      .where(eq(schema.examQuestions.id, id))
      .returning();
    return result[0];
  }
  async deleteExamQuestion(id: number): Promise<boolean> {
    try {
      // Get the question first to delete its image
      const question = await db.select({
        id: schema.examQuestions.id,
        imageUrl: schema.examQuestions.imageUrl
      })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.id, id))
        .limit(1);
      
      // Delete question image from Cloudinary/local storage if exists
      if (question[0]?.imageUrl) {
        try {
          await deleteFile(question[0].imageUrl);
        } catch (fileError) {
          console.error(`Error deleting question image for question ${id}:`, fileError);
        }
      }

      // Get question options to delete their images
      try {
        const options = await db.select({
          id: schema.questionOptions.id,
          imageUrl: schema.questionOptions.imageUrl
        })
          .from(schema.questionOptions)
          .where(eq(schema.questionOptions.questionId, id));
        
        for (const option of options) {
          if (option.imageUrl) {
            try {
              await deleteFile(option.imageUrl);
            } catch (fileError) {
              console.error(`Error deleting option image for option ${option.id}:`, fileError);
            }
          }
        }
      } catch (e) {
        // imageUrl column might not exist in question_options
      }

      // IMPORTANT: Delete in correct order to respect foreign key constraints
      // 1. First delete student answers (references both question_id AND selected_option_id -> question_options)
      await db.delete(schema.studentAnswers)
        .where(eq(schema.studentAnswers.questionId, id));

      // 2. Then delete question options (now safe since student_answers are gone)
      await db.delete(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, id));

      // 3. Finally delete the question itself
      const result = await db.delete(schema.examQuestions)
        .where(eq(schema.examQuestions.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deleting exam question:', error);
      throw error;
    }
  }

  // Question options management
  async createQuestionOption(option: InsertQuestionOption): Promise<QuestionOption> {
    const result = await db.insert(schema.questionOptions).values(option).returning();
    return result[0];
  }
  async getQuestionOptions(questionId: number): Promise<QuestionOption[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.questionOptions.id,
      questionId: schema.questionOptions.questionId,
      optionText: schema.questionOptions.optionText,
      isCorrect: schema.questionOptions.isCorrect,
      orderNumber: schema.questionOptions.orderNumber,
      createdAt: schema.questionOptions.createdAt,
    }).from(schema.questionOptions)
      .where(eq(schema.questionOptions.questionId, questionId))
      .orderBy(asc(schema.questionOptions.orderNumber));
  }
  // PERFORMANCE: Bulk fetch question options to eliminate N+1 queries
  async getQuestionOptionsBulk(questionIds: number[]): Promise<QuestionOption[]> {
    if (questionIds.length === 0) {
      return [];
    }
    // Use inArray for efficient bulk query
    return await db.select({
      id: schema.questionOptions.id,
      questionId: schema.questionOptions.questionId,
      optionText: schema.questionOptions.optionText,
      isCorrect: schema.questionOptions.isCorrect,
      orderNumber: schema.questionOptions.orderNumber,
      createdAt: schema.questionOptions.createdAt,
    }).from(schema.questionOptions)
      .where(inArray(schema.questionOptions.questionId, questionIds))
      .orderBy(asc(schema.questionOptions.questionId), asc(schema.questionOptions.orderNumber));
  }
  async deleteQuestionOptions(questionId: number): Promise<boolean> {
    try {
      // First, get the option IDs to clear any references in student_answers
      const options = await db.select({ id: schema.questionOptions.id })
        .from(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, questionId));
      
      const optionIds = options.map((o: { id: number }) => o.id).filter((id: number | null | undefined): id is number => id != null);
      
      // Clear selectedOptionId in student_answers that reference these options
      if (optionIds.length > 0) {
        await db.update(schema.studentAnswers)
          .set({ selectedOptionId: null })
          .where(inArray(schema.studentAnswers.selectedOptionId, optionIds));
      }
      
      // Delete the options
      await db.delete(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, questionId));
      
      return true;
    } catch (error) {
      console.error('Error deleting question options:', error);
      return false;
    }
  }
  // Question Bank management
  async createQuestionBank(bank: InsertQuestionBank): Promise<QuestionBank> {
    const result = await db.insert(schema.questionBanks).values(bank).returning();
    return result[0];
  }
  async getAllQuestionBanks(): Promise<QuestionBank[]> {
    return await db.select().from(schema.questionBanks).orderBy(desc(schema.questionBanks.createdAt));
  }
  async getQuestionBankById(id: number): Promise<QuestionBank | undefined> {
    const result = await db.select().from(schema.questionBanks).where(eq(schema.questionBanks.id, id));
    return result[0];
  }
  async getQuestionBanksBySubject(subjectId: number): Promise<QuestionBank[]> {
    return await db.select().from(schema.questionBanks)
      .where(eq(schema.questionBanks.subjectId, subjectId))
      .orderBy(desc(schema.questionBanks.createdAt));
  }
  async updateQuestionBank(id: number, bank: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined> {
    const result = await db.update(schema.questionBanks)
      .set({ ...bank, updatedAt: new Date() })
      .where(eq(schema.questionBanks.id, id))
      .returning();
    return result[0];
  }
  async deleteQuestionBank(id: number): Promise<boolean> {
    await db.delete(schema.questionBanks).where(eq(schema.questionBanks.id, id));
    return true;
  }
  // Question Bank Items management
  async createQuestionBankItem(item: InsertQuestionBankItem, options?: Omit<InsertQuestionBankOption, 'questionItemId'>[]): Promise<QuestionBankItem> {
    const result = await db.insert(schema.questionBankItems).values(item).returning();
    const questionItem = result[0];

    if (options && options.length > 0) {
      const optionValues = options.map((option) => ({
        questionItemId: questionItem.id,
        ...option
      }));
      await db.insert(schema.questionBankOptions).values(optionValues);
    }
    return questionItem;
  }
  async getQuestionBankItems(bankId: number, filters?: {questionType?: string; difficulty?: string; tags?: string[]}): Promise<QuestionBankItem[]> {
    let query = db.select().from(schema.questionBankItems).where(eq(schema.questionBankItems.bankId, bankId));
    
    if (filters?.questionType) {
      query = query.where(eq(schema.questionBankItems.questionType, filters.questionType));
    }
    if (filters?.difficulty) {
      query = query.where(eq(schema.questionBankItems.difficulty, filters.difficulty));
    }
    return await query.orderBy(desc(schema.questionBankItems.createdAt));
  }
  async getQuestionBankItemById(id: number): Promise<QuestionBankItem | undefined> {
    const result = await db.select().from(schema.questionBankItems).where(eq(schema.questionBankItems.id, id));
    return result[0];
  }
  async updateQuestionBankItem(id: number, item: Partial<InsertQuestionBankItem>): Promise<QuestionBankItem | undefined> {
    const result = await db.update(schema.questionBankItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }
  async deleteQuestionBankItem(id: number): Promise<boolean> {
    await db.delete(schema.questionBankItems).where(eq(schema.questionBankItems.id, id));
    return true;
  }
  async getQuestionBankItemOptions(questionItemId: number): Promise<QuestionBankOption[]> {
    return await db.select().from(schema.questionBankOptions)
      .where(eq(schema.questionBankOptions.questionItemId, questionItemId))
      .orderBy(asc(schema.questionBankOptions.orderNumber));
  }
  async importQuestionsFromBank(examId: number, questionItemIds: number[], randomize: boolean = false, maxQuestions?: number): Promise<{imported: number; questions: ExamQuestion[]}> {
    let selectedItemIds = [...questionItemIds];
    
    if (randomize && maxQuestions && maxQuestions < questionItemIds.length) {
      selectedItemIds = questionItemIds.sort(() => Math.random() - 0.5).slice(0, maxQuestions);
    }
    const questions: ExamQuestion[] = [];
    const existingQuestionsCount = await this.getExamQuestionCount(examId);
    let orderNumber = existingQuestionsCount + 1;

    for (const itemId of selectedItemIds) {
      const bankItem = await this.getQuestionBankItemById(itemId);
      if (!bankItem) continue;

      // Validate questionType to ensure data integrity
      const validTypes: Array<"multiple_choice" | "text" | "essay" | "true_false" | "fill_blank"> = 
        ["multiple_choice", "text", "essay", "true_false", "fill_blank"];
      const questionType = validTypes.includes(bankItem.questionType as any) 
        ? bankItem.questionType as "multiple_choice" | "text" | "essay" | "true_false" | "fill_blank"
        : "text"; // Default to text if invalid

      // Parse expectedAnswers from JSON string or comma-separated string to array
      let expectedAnswersArray: string[] | undefined = undefined;
      if (bankItem.expectedAnswers) {
        if (Array.isArray(bankItem.expectedAnswers)) {
          expectedAnswersArray = bankItem.expectedAnswers;
        } else if (typeof bankItem.expectedAnswers === 'string') {
          try {
            const parsed = JSON.parse(bankItem.expectedAnswers);
            expectedAnswersArray = Array.isArray(parsed) ? parsed : [bankItem.expectedAnswers];
          } catch {
            expectedAnswersArray = bankItem.expectedAnswers.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
      }

      const questionData: InsertExamQuestion = {
        examId,
        questionText: bankItem.questionText,
        questionType,
        points: bankItem.points || 1,
        orderNumber: orderNumber++,
        imageUrl: bankItem.imageUrl ?? undefined,
        autoGradable: bankItem.autoGradable,
        expectedAnswers: expectedAnswersArray,
        caseSensitive: bankItem.caseSensitive ?? undefined,
        explanationText: bankItem.explanationText ?? undefined,
        hintText: bankItem.hintText ?? undefined
      };

      const question = await this.createExamQuestion(questionData);
      questions.push(question);

      if (bankItem.questionType === 'multiple_choice') {
        const bankOptions = await this.getQuestionBankItemOptions(itemId);
        for (const bankOption of bankOptions) {
          await this.createQuestionOption({
            questionId: question.id,
            optionText: bankOption.optionText,
            isCorrect: bankOption.isCorrect,
            orderNumber: bankOption.orderNumber,
            partialCreditValue: 0,
            explanationText: bankOption.explanationText ?? undefined
          });
        }
      }
    }
    return { imported: questions.length, questions };
  }
  // Get AI-suggested grading tasks for teacher review
  async getAISuggestedGradingTasks(teacherId: string, status?: string): Promise<any[]> {
    try {
      // Get teacher's assigned classes and subjects
      const assignments = await this.db.select()
        .from(schema.teacherClassAssignments)
        .where(and(
          eq(schema.teacherClassAssignments.teacherId, teacherId),
          eq(schema.teacherClassAssignments.isActive, true)
        ));

      if (assignments.length === 0) {
        return [];
      }
      const classIds = assignments.map((a: any) => a.classId);
      const subjectIds = assignments.map((a: any) => a.subjectId);

      // Get exams for these classes/subjects
      const exams = await this.db.select()
        .from(schema.exams)
        .where(and(
          inArray(schema.exams.classId, classIds),
          inArray(schema.exams.subjectId, subjectIds)
        ));

      const examIds = exams.map((e: any) => e.id);
      if (examIds.length === 0) {
        return [];
      }
      // Get sessions for these exams
      const sessions = await this.db.select()
        .from(schema.examSessions)
        .where(and(
          inArray(schema.examSessions.examId, examIds),
          eq(schema.examSessions.isCompleted, true)
        ));

      const sessionIds = sessions.map((s: any) => s.id);
      if (sessionIds.length === 0) {
        return [];
      }
      // Get student answers that are AI-suggested (not auto-scored, has points)
      let query = this.db.select({
        id: schema.studentAnswers.id,
        sessionId: schema.studentAnswers.sessionId,
        questionId: schema.studentAnswers.questionId,
        textAnswer: schema.studentAnswers.textAnswer,
        pointsEarned: schema.studentAnswers.pointsEarned,
        feedbackText: schema.studentAnswers.feedbackText,
        autoScored: schema.studentAnswers.autoScored,
        manualOverride: schema.studentAnswers.manualOverride,
        answeredAt: schema.studentAnswers.answeredAt,
        questionText: schema.examQuestions.questionText,
        questionType: schema.examQuestions.questionType,
        points: schema.examQuestions.points,
        expectedAnswers: schema.examQuestions.expectedAnswers,
        studentId: schema.examSessions.studentId,
        examId: schema.examSessions.examId,
        examName: schema.exams.name
      })
        .from(schema.studentAnswers)
        .innerJoin(schema.examQuestions, eq(schema.studentAnswers.questionId, schema.examQuestions.id))
        .innerJoin(schema.examSessions, eq(schema.studentAnswers.sessionId, schema.examSessions.id))
        .innerJoin(schema.exams, eq(schema.examSessions.examId, schema.exams.id))
        .where(and(
          inArray(schema.studentAnswers.sessionId, sessionIds),
          sql`(${schema.examQuestions.questionType} = 'text' OR ${schema.examQuestions.questionType} = 'essay')`,
          sql`${schema.studentAnswers.textAnswer} IS NOT NULL`
        ));

      // Filter by status if provided
      if (status === 'pending') {
        query = query.where(sql`${schema.studentAnswers.autoScored} = false AND ${schema.studentAnswers.manualOverride} = false`);
      } else if (status === 'reviewed') {
        query = query.where(sql`(${schema.studentAnswers.autoScored} = true OR ${schema.studentAnswers.manualOverride} = true)`);
      }
      const results = await query;

      // Get student names
      const studentIds = Array.from(new Set(results.map((r: any) => r.studentId))) as string[];
      const students = await this.db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
        .from(schema.users)
        .where(inArray(schema.users.id, studentIds));

      // Enrich results with student names
      return results.map((r: any) => ({
        ...r,
        studentName: `${students.find((s: any) => s.id === r.studentId)?.firstName} ${students.find((s: any) => s.id === r.studentId)?.lastName}`,
        status: r.autoScored || r.manualOverride ? 'reviewed' : 'pending',
        aiSuggested: r.pointsEarned > 0 && !r.autoScored && !r.manualOverride
      }));

    } catch (error) {
      return [];
    }
  }


  // Exam sessions management
  async createExamSession(session: InsertExamSession): Promise<ExamSession> {
    const result = await db.insert(schema.examSessions).values(session).returning();
    return result[0];
  }
  async getExamSessionById(id: number): Promise<ExamSession | undefined> {
    // Only select columns that actually exist in the current database
    const result = await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.id, id))
      .limit(1);
    return result[0];
  }
  async getExamSessionsByExam(examId: number): Promise<ExamSession[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.examId, examId))
      .orderBy(desc(schema.examSessions.startedAt));
  }
  async getExamSessionsByStudent(studentId: string): Promise<ExamSession[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.studentId, studentId))
      .orderBy(desc(schema.examSessions.startedAt));
  }
  async updateExamSession(id: number, session: Partial<InsertExamSession>): Promise<ExamSession | undefined> {
    // Filter to only existing columns to avoid database errors
    const allowedFields: Partial<InsertExamSession> = {};
    const existingColumns = ['examId', 'studentId', 'startedAt', 'submittedAt', 'timeRemaining', 'isCompleted', 'score', 'maxScore', 'status', 'metadata'];

    // Only include fields that exist in the database
    for (const [key, value] of Object.entries(session)) {
      if (existingColumns.includes(key) && value !== undefined) {
        (allowedFields as any)[key] = value;
      }
    }

    const result = await db.update(schema.examSessions)
      .set(allowedFields)
      .where(eq(schema.examSessions.id, id))
      .returning({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      });
    return result[0];
  }
  async deleteExamSession(id: number): Promise<boolean> {
    const result = await db.delete(schema.examSessions)
      .where(eq(schema.examSessions.id, id));
    return result.length > 0;
  }
  async getActiveExamSession(examId: number, studentId: string): Promise<ExamSession | undefined> {
    const result = await db.select().from(schema.examSessions)
      .where(and(
        eq(schema.examSessions.examId, examId),
        eq(schema.examSessions.studentId, studentId),
        eq(schema.examSessions.isCompleted, false)
      ))
      .limit(1);
    return result[0];
  }
  // Get all active exam sessions for background cleanup service
  async getActiveExamSessions(): Promise<ExamSession[]> {
    // Temporarily select only core columns to avoid missing column errors
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.isCompleted, false))
      .orderBy(desc(schema.examSessions.startedAt));
  }
  // PERFORMANCE: Get only expired sessions directly from database
  async getExpiredExamSessions(now: Date, limit = 100): Promise<ExamSession[]> {
    // Temporarily simplified to work with existing schema - will be enhanced after schema sync
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .where(and(
        eq(schema.examSessions.isCompleted, false),
        // Fallback: Use startedAt + reasonable timeout estimate for expired sessions
        dsql`${schema.examSessions.startedAt} + interval '2 hours' < ${now.toISOString()}`
      ))
      .orderBy(asc(schema.examSessions.startedAt))
      .limit(limit);
  }
  // CIRCUIT BREAKER FIX: Idempotent session creation using UPSERT to prevent connection pool exhaustion
  async createOrGetActiveExamSession(examId: number, studentId: string, sessionData: InsertExamSession): Promise<ExamSession & { wasCreated?: boolean }> {
    try {
      // STEP 1: Try to insert new session - this will fail if an active session already exists due to unique index
      const insertResult = await db.insert(schema.examSessions)
        .values({
          examId: sessionData.examId,
          studentId: studentId,
          startedAt: new Date(),
          timeRemaining: sessionData.timeRemaining,
          isCompleted: false,
          status: 'in_progress'
        })
        .onConflictDoNothing() // This requires the unique index we added
        .returning({
          id: schema.examSessions.id,
          examId: schema.examSessions.examId,
          studentId: schema.examSessions.studentId,
          startedAt: schema.examSessions.startedAt,
          submittedAt: schema.examSessions.submittedAt,
          timeRemaining: schema.examSessions.timeRemaining,
          isCompleted: schema.examSessions.isCompleted,
          score: schema.examSessions.score,
          maxScore: schema.examSessions.maxScore,
          status: schema.examSessions.status,
          createdAt: schema.examSessions.createdAt
        });

      // If insert succeeded, return the new session
      if (insertResult.length > 0) {
        return { ...insertResult[0], wasCreated: true };
      }
      // STEP 2: Insert failed due to conflict, fetch the existing active session
      const existingSession = await db.select({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      }).from(schema.examSessions)
        .where(and(
          eq(schema.examSessions.examId, examId),
          eq(schema.examSessions.studentId, studentId),
          eq(schema.examSessions.isCompleted, false)
        ))
        .limit(1);

      if (existingSession.length > 0) {
        return { ...existingSession[0], wasCreated: false };
      }
      // This should not happen with proper unique index, but handle gracefully
      throw new Error(`Unable to create or retrieve exam session for student ${studentId} exam ${examId}`);

    } catch (error: any) {
      throw error;
    }
  }

  // Exam retake management - allows teacher to reset student exam for retake
  // Uses a transaction to ensure atomic operation - either all changes succeed or all roll back
  async allowExamRetake(examId: number, studentId: string, archivedBy: string): Promise<{ success: boolean; message: string; archivedSubmissionId?: number }> {
    try {
      console.log(`[allowExamRetake] Starting retake process for exam ${examId}, student ${studentId}`);
      
      // 1. Get the existing exam result (outside transaction for validation)
      const existingResult = await this.getExamResultByExamAndStudent(examId, studentId);
      if (!existingResult) {
        return { success: false, message: 'No exam submission found for this student' };
      }

      // 2. Get all exam sessions for this student and exam
      const sessions = await db.select()
        .from(schema.examSessions)
        .where(and(
          eq(schema.examSessions.examId, examId),
          eq(schema.examSessions.studentId, studentId)
        ));

      // 3. Get the student answers from all sessions
      let studentAnswers: any[] = [];
      for (const session of sessions) {
        const answers = await this.getStudentAnswers(session.id);
        studentAnswers = [...studentAnswers, ...answers];
      }

      // 4. Execute archive and cleanup in a transaction for atomicity
      const result = await db.transaction(async (tx: any) => {
        // Archive the submission in exam_submissions_archive table
        const archivedSubmission = await tx.insert(schema.examSubmissionsArchive).values({
          examId,
          studentId,
          originalResultId: existingResult.id,
          originalSessionId: sessions[0]?.id || null,
          score: existingResult.score || existingResult.marksObtained || 0,
          maxScore: existingResult.maxScore || 100,
          grade: existingResult.grade || null,
          remarks: existingResult.remarks || null,
          answersSnapshot: JSON.stringify(studentAnswers),
          archivedBy,
          archiveReason: 'Teacher allowed retake',
          archivedAt: new Date(),
        }).returning();

        console.log(`[allowExamRetake] Archived submission ID: ${archivedSubmission[0]?.id}`);

        // Delete student answers for all sessions
        for (const session of sessions) {
          await tx.delete(schema.studentAnswers)
            .where(eq(schema.studentAnswers.sessionId, session.id));
          console.log(`[allowExamRetake] Deleted answers for session ${session.id}`);
        }

        // Delete all exam sessions
        await tx.delete(schema.examSessions)
          .where(and(
            eq(schema.examSessions.examId, examId),
            eq(schema.examSessions.studentId, studentId)
          ));
        console.log(`[allowExamRetake] Deleted ${sessions.length} sessions`);

        // Delete the exam result
        await tx.delete(schema.examResults)
          .where(eq(schema.examResults.id, existingResult.id));
        console.log(`[allowExamRetake] Deleted exam result ${existingResult.id}`);

        return { archivedSubmissionId: archivedSubmission[0]?.id };
      });

      return {
        success: true,
        message: 'Student can now retake the exam. Previous submission has been archived.',
        archivedSubmissionId: result.archivedSubmissionId
      };

    } catch (error: any) {
      console.error('[allowExamRetake] Error (transaction rolled back):', error);
      return { success: false, message: `Failed to allow retake: ${error.message}` };
    }
  }

  async getExamResultById(id: number): Promise<ExamResult | undefined> {
    const result = await db.select().from(schema.examResults)
      .where(eq(schema.examResults.id, id))
      .limit(1);
    return result[0];
  }

  // Enhanced session management for students
  async getStudentActiveSession(studentId: string): Promise<ExamSession | undefined> {
    const result = await this.db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .where(and(
        eq(schema.examSessions.studentId, studentId),
        eq(schema.examSessions.isCompleted, false)
      ))
      .orderBy(desc(schema.examSessions.createdAt))
      .limit(1);
    return result[0];
  }
  async updateSessionProgress(sessionId: number, progress: { currentQuestionIndex?: number; timeRemaining?: number }): Promise<void> {
    const updates: any = {};
    if (typeof progress.timeRemaining === 'number') {
      updates.timeRemaining = progress.timeRemaining;
    }
    if (typeof progress.currentQuestionIndex === 'number') {
      updates.metadata = JSON.stringify({ currentQuestionIndex: progress.currentQuestionIndex });
    }
    if (Object.keys(updates).length > 0) {
      await this.db.update(schema.examSessions)
        .set(updates)
        .where(eq(schema.examSessions.id, sessionId));
    }
  }

  // Student answers management
  async createStudentAnswer(answer: InsertStudentAnswer): Promise<StudentAnswer> {
    const result = await db.insert(schema.studentAnswers).values(answer).returning();
    return result[0];
  }
  async getStudentAnswers(sessionId: number): Promise<StudentAnswer[]> {
    return await db.select().from(schema.studentAnswers)
      .where(eq(schema.studentAnswers.sessionId, sessionId))
      .orderBy(asc(schema.studentAnswers.answeredAt));
  }
  async getStudentAnswerById(id: number): Promise<StudentAnswer | undefined> {
    const result = await db.select().from(schema.studentAnswers)
      .where(eq(schema.studentAnswers.id, id))
      .limit(1);
    return result[0];
  }
  async updateStudentAnswer(id: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer | undefined> {
    const result = await db.update(schema.studentAnswers)
      .set(answer)
      .where(eq(schema.studentAnswers.id, id))
      .returning();
    return result[0];
  }
  async getStudentAnswerBySessionAndQuestion(sessionId: number, questionId: number): Promise<StudentAnswer | undefined> {
    const result = await db.select().from(schema.studentAnswers)
      .where(and(
        eq(schema.studentAnswers.sessionId, sessionId),
        eq(schema.studentAnswers.questionId, questionId)
      ))
      .limit(1);
    return result[0];
  }
  async upsertStudentAnswer(sessionId: number, questionId: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer> {
    const existing = await this.getStudentAnswerBySessionAndQuestion(sessionId, questionId);
    
    if (existing) {
      const updated = await this.updateStudentAnswer(existing.id, answer);
      return updated!;
    } else {
      return await this.createStudentAnswer({
        sessionId,
        questionId,
        ...answer
      } as InsertStudentAnswer);
    }
  }

  async getQuestionOptionById(optionId: number): Promise<QuestionOption | undefined> {
    const result = await db.select().from(schema.questionOptions)
      .where(eq(schema.questionOptions.id, optionId))
      .limit(1);
    return result[0];
  }
  // OPTIMIZED SCORING: Get all scoring data in a single query for <2s performance
  async getExamScoringData(sessionId: number): Promise<{
    session: ExamSession;
    scoringData: Array<{
      questionId: number;
      questionType: string;
      points: number;
      studentSelectedOptionId: number | null;
      correctOptionId: number | null;
      isCorrect: boolean;
      textAnswer: string | null;
    }>;
    summary: {
      totalQuestions: number;
      maxScore: number;
      studentScore: number;
      autoScoredQuestions: number;
    };
  }> {
    try {

      // First, get the session - select only existing columns
      const sessionResult = await this.db.select({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.id, sessionId))
        .limit(1);

      if (!sessionResult[0]) {
        throw new Error(`Exam session ${sessionId} not found`);
      }
      const session = sessionResult[0];

      // CORRECTED QUERY: Get question data and correct options separately to avoid row multiplication issues
      const questionsQuery = await this.db.select({
        questionId: schema.examQuestions.id,
        questionType: schema.examQuestions.questionType,
        points: schema.examQuestions.points,
        autoGradable: schema.examQuestions.autoGradable,
        expectedAnswers: schema.examQuestions.expectedAnswers,
        caseSensitive: schema.examQuestions.caseSensitive,
        allowPartialCredit: schema.examQuestions.allowPartialCredit,
        partialCreditRules: schema.examQuestions.partialCreditRules,
        studentSelectedOptionId: schema.studentAnswers.selectedOptionId,
        textAnswer: schema.studentAnswers.textAnswer,
      })
        .from(schema.examQuestions)
        .leftJoin(schema.studentAnswers, and(
          eq(schema.studentAnswers.questionId, schema.examQuestions.id),
          eq(schema.studentAnswers.sessionId, sessionId)
        ))
        .where(eq(schema.examQuestions.examId, session.examId))
        .orderBy(asc(schema.examQuestions.orderNumber));

      // Get correct options separately to avoid confusion
      const correctOptionsQuery = await this.db.select({
        questionId: schema.questionOptions.questionId,
        correctOptionId: schema.questionOptions.id,
      })
        .from(schema.questionOptions)
        .innerJoin(schema.examQuestions, eq(schema.questionOptions.questionId, schema.examQuestions.id))
        .where(
          and(
            eq(schema.examQuestions.examId, session.examId),
            eq(schema.questionOptions.isCorrect, true)
          )
        );

      // Get selected option details for partial credit (only for questions with student answers)
      const selectedOptionsQuery = await this.db.select({
        questionId: schema.questionOptions.questionId,
        optionId: schema.questionOptions.id,
        partialCreditValue: schema.questionOptions.partialCreditValue,
        isCorrect: schema.questionOptions.isCorrect,
      })
        .from(schema.questionOptions)
        .innerJoin(schema.studentAnswers, eq(schema.questionOptions.id, schema.studentAnswers.selectedOptionId))
        .where(eq(schema.studentAnswers.sessionId, sessionId));

      // Create lookup maps for efficient processing
      const correctOptionsMap = new Map<number, number>();
      for (const option of correctOptionsQuery) {
        correctOptionsMap.set(option.questionId, option.correctOptionId);
      }
      const selectedOptionsMap = new Map<number, { optionId: number; partialCreditValue: number | null; isCorrect: boolean | null }>();
      for (const option of selectedOptionsQuery) {
        selectedOptionsMap.set(option.questionId, {
          optionId: option.optionId,
          partialCreditValue: option.partialCreditValue,
          isCorrect: option.isCorrect,
        });
      }
      // CORRECTED PROCESSING: Build question data from separate queries
      const questionMap = new Map<number, {
        questionType: string;
        points: number;
        autoGradable: boolean | null;
        expectedAnswers: string[] | null;
        caseSensitive: boolean | null;
        allowPartialCredit: boolean | null;
        partialCreditRules: string | null;
        studentSelectedOptionId: number | null;
        textAnswer: string | null;
        correctOptionId: number | null;
        isCorrect: boolean;
        partialCreditEarned: number;
      }>();

      // Build questions with correct option IDs
      for (const question of questionsQuery) {
        const correctOptionId = correctOptionsMap.get(question.questionId) || null;
        const selectedOptionData = selectedOptionsMap.get(question.questionId);

        questionMap.set(question.questionId, {
          questionType: question.questionType,
          points: question.points || 1,
          autoGradable: question.autoGradable,
          expectedAnswers: question.expectedAnswers,
          caseSensitive: question.caseSensitive,
          allowPartialCredit: question.allowPartialCredit,
          partialCreditRules: question.partialCreditRules,
          studentSelectedOptionId: question.studentSelectedOptionId,
          textAnswer: question.textAnswer,
          correctOptionId,
          isCorrect: false,
          partialCreditEarned: 0,
        });

        // FIXED CORRECTNESS LOGIC: Determine if option-based questions are correct
        if ((question.questionType === 'multiple_choice' ||
          question.questionType === 'true_false' ||
          question.questionType === 'true/false') &&
          correctOptionId && question.studentSelectedOptionId === correctOptionId) {
          questionMap.get(question.questionId)!.isCorrect = true;
        }
        // FIXED PARTIAL CREDIT LOGIC: Award partial credit for incorrect option-based answers
        if (question.allowPartialCredit && selectedOptionData && selectedOptionData.partialCreditValue) {
          const questionData = questionMap.get(question.questionId)!;

          // Only award partial credit if the answer is incorrect but has some value
          if (!questionData.isCorrect && selectedOptionData.partialCreditValue > 0) {
            questionData.partialCreditEarned = Math.min(
              questionData.points,
              selectedOptionData.partialCreditValue
            );
          }
        }
      }
      // ENHANCED AUTO-SCORING: Process text-based questions after collecting all data
      for (const [questionId, question] of Array.from(questionMap.entries())) {
        if (!question.autoGradable) continue;

        // Handle text-based questions (text, fill_blank)
        if ((question.questionType === 'text' || question.questionType === 'fill_blank') &&
          question.expectedAnswers && question.textAnswer) {

          const studentAnswer = question.textAnswer.trim();
          if (!studentAnswer) continue; // Skip empty answers


          // Check against all expected answers
          for (const expectedAnswer of question.expectedAnswers) {
            const normalizedExpected = question.caseSensitive ?
              expectedAnswer.trim() :
              expectedAnswer.trim().toLowerCase();

            const normalizedStudent = question.caseSensitive ?
              studentAnswer :
              studentAnswer.toLowerCase();

            // Exact match
            if (normalizedStudent === normalizedExpected) {
              question.isCorrect = true;
              break;
            }
            // Partial credit for close matches (if enabled)
            if (question.allowPartialCredit && !question.isCorrect) {
              const similarity = this.calculateTextSimilarity(normalizedStudent, normalizedExpected);

              try {
                const partialRules = question.partialCreditRules ?
                  JSON.parse(question.partialCreditRules) :
                  { minSimilarity: 0.8, partialPercentage: 0.5 };

                if (similarity >= (partialRules.minSimilarity || 0.8)) {
                  question.partialCreditEarned = Math.ceil(question.points * (partialRules.partialPercentage || 0.5));
                  break;
                }
              } catch (err) {
              }
            }
          }
        }
      }
      // Convert map to array and calculate summary
      const scoringData = Array.from(questionMap.entries()).map(([questionId, data]) => ({
        questionId,
        ...data,
      }));

      // Calculate summary statistics
      let totalQuestions = scoringData.length;
      let maxScore = 0;
      let studentScore = 0;
      let autoScoredQuestions = 0;


      // Track question types for debugging
      const questionTypeCount: Record<string, number> = {};

      for (const question of scoringData) {
        maxScore += question.points;

        // Count question types for diagnostic
        questionTypeCount[question.questionType] = (questionTypeCount[question.questionType] || 0) + 1;

        // ENHANCED SCORING: Use auto_gradable field from database to determine if question can be auto-scored
        // This is the definitive source of truth for auto-scoring eligibility
        if (question.autoGradable === true) {
          autoScoredQuestions++;

          // Award full points for correct answers
          if (question.isCorrect) {
            studentScore += question.points;
          }
          // Award partial credit if earned
          else if (question.partialCreditEarned > 0) {
            studentScore += question.partialCreditEarned;
          }
          // No credit
          else {
          }
        } else {
        }
      }


      return {
        session,
        scoringData,
        summary: {
          totalQuestions,
          maxScore,
          studentScore,
          autoScoredQuestions,
        }
      };
    } catch (error) {
      throw error;
    }
  }


  // Text similarity calculation for partial credit scoring
  private calculateTextSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
  // Announcements
  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await db.insert(schema.announcements).values(announcement).returning();
    return result[0];
  }
  async getAnnouncements(targetRole?: string, includeDrafts: boolean = false): Promise<Announcement[]> {
    let query = db.select().from(schema.announcements);
    
    // Filter by published status unless includeDrafts is true
    if (!includeDrafts) {
      query = query.where(eq(schema.announcements.isPublished, true));
    }

    if (targetRole && targetRole !== 'all') {
      // Improved filtering logic for JSON strings in both SQLite and PostgreSQL
      query = query.where(or(
        like(schema.announcements.targetRoles, `%\"All\"%`),
        like(schema.announcements.targetRoles, `%\"${targetRole}\"%`),
        eq(schema.announcements.targetRoles, '["All"]'),
        eq(schema.announcements.targetRoles, `["${targetRole}"]`)
      ));
    }
    
    return await query.orderBy(desc(schema.announcements.publishedAt), desc(schema.announcements.createdAt));
  }
  async getAnnouncementById(id: number): Promise<Announcement | undefined> {
    const result = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id)).limit(1);
    return result[0];
  }
  async updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const result = await db.update(schema.announcements).set(announcement).where(eq(schema.announcements.id, id)).returning();
    return result[0];
  }
  async deleteAnnouncement(id: number): Promise<boolean> {
    const [announcement] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
    if (!announcement) return false;

    await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
    
    // Broadcast deletion using standardized emitter
    realtimeService.emitAnnouncementEvent('deleted', { id });

    return true;
  }
  // Messages
  async sendMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(schema.messages).values(message).returning();
    return result[0];
  }
  async getMessagesByUser(userId: string): Promise<Message[]> {
    return await db.select().from(schema.messages)
      .where(eq(schema.messages.recipientId, userId))
      .orderBy(desc(schema.messages.createdAt));
  }
  async markMessageAsRead(id: number): Promise<void> {
    await db.update(schema.messages).set({ isRead: true }).where(eq(schema.messages.id, id));
  }
  // Gallery
  async createGalleryCategory(category: InsertGalleryCategory): Promise<GalleryCategory> {
    const result = await db.insert(schema.galleryCategories).values(category).returning();
    return result[0];
  }
  async getGalleryCategories(): Promise<GalleryCategory[]> {
    return await db.select().from(schema.galleryCategories).orderBy(asc(schema.galleryCategories.name));
  }
  async uploadGalleryImage(image: InsertGallery): Promise<Gallery> {
    const result = await db.insert(schema.gallery).values(image).returning();
    return result[0];
  }
  async getGalleryImages(categoryId?: number): Promise<Gallery[]> {
    if (categoryId) {
      return await db.select().from(schema.gallery)
        .where(eq(schema.gallery.categoryId, categoryId))
        .orderBy(desc(schema.gallery.createdAt));
    }
    return await db.select().from(schema.gallery).orderBy(desc(schema.gallery.createdAt));
  }
  async getGalleryImageById(id: string): Promise<Gallery | undefined> {
    const result = await db.select().from(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .limit(1);
    return result[0];
  }
  async deleteGalleryImage(id: string): Promise<boolean> {
    // First get the image to delete the file
    const image = await db.select({ id: schema.gallery.id, imageUrl: schema.gallery.imageUrl })
      .from(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .limit(1);
    
    // Delete the image file from Cloudinary/local storage
    if (image[0]?.imageUrl) {
      try {
        await deleteFile(image[0].imageUrl);
      } catch (fileError) {
        console.error(`Error deleting gallery image file for image ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .returning();
    return result.length > 0;
  }
  // Study resources management
  async createStudyResource(resource: InsertStudyResource): Promise<StudyResource> {
    const result = await db.insert(schema.studyResources).values(resource).returning();
    return result[0];
  }
  async getStudyResources(filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
    resourceType?: string;
  }): Promise<StudyResource[]> {
    let query = db.select().from(schema.studyResources)
      .where(eq(schema.studyResources.isPublished, true));

    if (filters?.classId) {
      query = query.where(eq(schema.studyResources.classId, filters.classId));
    }
    if (filters?.subjectId) {
      query = query.where(eq(schema.studyResources.subjectId, filters.subjectId));
    }
    if (filters?.termId) {
      query = query.where(eq(schema.studyResources.termId, filters.termId));
    }
    if (filters?.resourceType) {
      query = query.where(eq(schema.studyResources.resourceType, filters.resourceType));
    }
    return await query.orderBy(desc(schema.studyResources.createdAt));
  }
  async getStudyResourceById(id: number): Promise<StudyResource | undefined> {
    const result = await db.select().from(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .limit(1);
    return result[0];
  }
  async incrementStudyResourceDownloads(id: number): Promise<void> {
    await db.update(schema.studyResources)
      .set({ downloads: dsql`${schema.studyResources.downloads} + 1` })
      .where(eq(schema.studyResources.id, id));
  }
  async deleteStudyResource(id: number): Promise<boolean> {
    // First get the resource to delete the file
    const resource = await db.select({ id: schema.studyResources.id, fileUrl: schema.studyResources.fileUrl })
      .from(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .limit(1);
    
    // Delete the file from Cloudinary/local storage
    if (resource[0]?.fileUrl) {
      try {
        await deleteFile(resource[0].fileUrl);
      } catch (fileError) {
        console.error(`Error deleting study resource file for resource ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .returning();
    return result.length > 0;
  }
  // Home page content management
  async createHomePageContent(content: InsertHomePageContent): Promise<HomePageContent> {
    const result = await db.insert(schema.homePageContent).values(content).returning();
    return result[0];
  }


  // Manual Grading System Methods
  async getGradingTasks(teacherId: string, status?: string): Promise<any[]> {
    try {
      // Use PostgreSQL for production, SQLite for development
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];
        
        let query = `
          SELECT
            sa.id,
            es.student_id,
            u.first_name || ' ' || u.last_name as student_name,
            es.exam_id,
            e.name as exam_title,
            eq.id as question_id,
            eq.question_text,
            eq.question_type,
            eq.points as max_marks,
            sa.text_answer as student_answer,
            es.submitted_at,
            CASE
              WHEN sa.id IN (SELECT answer_id FROM manual_scores) THEN 'graded'
              ELSE 'pending'
            END as status,
            ms.awarded_marks as current_score,
            ms.comment as grader_comment
          FROM student_answers sa
          JOIN exam_sessions es ON sa.session_id = es.id
          JOIN exams e ON es.exam_id = e.id
          JOIN exam_questions eq ON sa.question_id = eq.id
          JOIN users u ON es.student_id = u.id
          LEFT JOIN manual_scores ms ON sa.id = ms.answer_id
          WHERE e.created_by = $1
          AND eq.question_type IN ('text', 'essay')
          AND es.is_completed = true
        `;

        if (status && status !== 'all') {
          if (status === 'pending') {
            query += ' AND sa.id NOT IN (SELECT answer_id FROM manual_scores)';
          } else if (status === 'graded') {
            query += ' AND sa.id IN (SELECT answer_id FROM manual_scores)';
          }
        }

        query += ' ORDER BY es.submitted_at DESC';

        // Use Neon's unsafe method for dynamic queries with parameters
        const result = await (pgClient as any).unsafe(query, [teacherId]);
        return result as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching grading tasks:', error);
      return [];
    }
  }

  async submitManualGrade(gradeData: { taskId: number; score: number; comment: string; graderId: string }): Promise<any> {
    try {
      const { taskId, score, comment, graderId } = gradeData;

      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) throw new Error('PostgreSQL client not available');
        
        // Use PostgreSQL upsert syntax
        const result = await pgClient`
          INSERT INTO manual_scores (answer_id, grader_id, awarded_marks, comment, graded_at)
          VALUES (${taskId}, ${graderId}, ${score}, ${comment}, NOW())
          ON CONFLICT (answer_id)
          DO UPDATE SET
            awarded_marks = EXCLUDED.awarded_marks,
            comment = EXCLUDED.comment,
            graded_at = EXCLUDED.graded_at,
            grader_id = EXCLUDED.grader_id
          RETURNING *
        `;

        // Update the student answer with the manual score
        await pgClient`
          UPDATE student_answers
          SET points_earned = ${score}
          WHERE id = ${taskId}
        `;

        // Extract first row from PostgreSQL result
        const rows = result as Record<string, any>[];
        return rows.length > 0 ? rows[0] : null;
      }

      throw new Error('PostgreSQL client not available');
    } catch (error) {
      throw error;
    }
  }

  async getAllExamSessions(): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];
        
        const result = await pgClient`
          SELECT
            es.*,
            e.name as exam_title,
            u.first_name || ' ' || u.last_name as student_name,
            (
              SELECT COUNT(*)
              FROM student_answers sa
              WHERE sa.session_id = es.id
              AND (sa.selected_option_id IS NOT NULL OR sa.text_answer IS NOT NULL)
            ) as answered_questions,
            (
              SELECT COUNT(*)
              FROM exam_questions eq
              WHERE eq.exam_id = es.exam_id
            ) as total_questions
          FROM exam_sessions es
          JOIN exams e ON es.exam_id = e.id
          JOIN users u ON es.student_id = u.id
          ORDER BY es.started_at DESC
        `;

        return result as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam sessions:', error);
      return [];
    }
  }

  async getExamReports(filters: { subjectId?: number; classId?: number }): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];
        
        let query = `
          SELECT
            e.id as exam_id,
            e.name as exam_title,
            c.name as class_name,
            s.name as subject_name,
            e.date as exam_date,
            e.total_marks as max_score,
            COUNT(DISTINCT es.student_id) as total_students,
            COUNT(DISTINCT CASE WHEN es.is_completed THEN es.student_id END) as completed_students,
            COALESCE(AVG(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as average_score,
            COALESCE(
              COUNT(CASE WHEN es.is_completed AND er.marks_obtained >= (e.total_marks * 0.5) THEN 1 END) * 100.0 /
              NULLIF(COUNT(CASE WHEN es.is_completed THEN 1 END), 0),
              0
            ) as pass_rate,
            COALESCE(MAX(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as highest_score,
            COALESCE(MIN(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as lowest_score,
            CASE
              WHEN COUNT(DISTINCT CASE WHEN es.is_completed THEN es.student_id END) = 0 THEN 'ongoing'
              ELSE 'completed'
            END as status,
            COALESCE(
              COUNT(CASE WHEN es.is_completed AND er.id IS NOT NULL THEN 1 END) * 100.0 /
              NULLIF(COUNT(CASE WHEN es.is_completed THEN 1 END), 0),
              0
            ) as grading_progress
          FROM exams e
          JOIN classes c ON e.class_id = c.id
          JOIN subjects s ON e.subject_id = s.id
          LEFT JOIN exam_sessions es ON e.id = es.exam_id
          LEFT JOIN exam_results er ON e.id = er.exam_id AND es.student_id = er.student_id
          WHERE e.is_published = true
        `;

        const params: any[] = [];
        let paramIndex = 1;

        if (filters.classId) {
          query += ` AND e.class_id = $${paramIndex}`;
          params.push(filters.classId);
          paramIndex++;
        }
        if (filters.subjectId) {
          query += ` AND e.subject_id = $${paramIndex}`;
          params.push(filters.subjectId);
          paramIndex++;
        }
        query += `
          GROUP BY e.id, e.name, c.name, s.name, e.date, e.total_marks
          ORDER BY e.date DESC
        `;

        // Use Neon's unsafe method for dynamic queries with parameters
        const result = await (pgClient as any).unsafe(query, params);
        return result as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam reports:', error);
      return [];
    }
  }

  async getExamStudentReports(examId: number): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];
        
        const result = await pgClient`
          SELECT
            u.id as student_id,
            u.first_name || ' ' || u.last_name as student_name,
            st.admission_number,
            COALESCE(er.marks_obtained, 0) as score,
            COALESCE(er.marks_obtained * 100.0 / e.total_marks, 0) as percentage,
            CASE
              WHEN er.marks_obtained >= e.total_marks * 0.9 THEN 'A'
              WHEN er.marks_obtained >= e.total_marks * 0.8 THEN 'B'
              WHEN er.marks_obtained >= e.total_marks * 0.7 THEN 'C'
              WHEN er.marks_obtained >= e.total_marks * 0.6 THEN 'D'
              ELSE 'F'
            END as grade,
            ROW_NUMBER() OVER (ORDER BY er.marks_obtained DESC) as rank,
            EXTRACT(EPOCH FROM (es.submitted_at - es.started_at)) as time_spent,
            es.submitted_at,
            er.auto_scored,
            CASE WHEN EXISTS (
              SELECT 1 FROM manual_scores ms
              JOIN student_answers sa ON ms.answer_id = sa.id
              WHERE sa.session_id = es.id
            ) THEN true ELSE false END as manual_scored
          FROM users u
          JOIN students st ON u.id = st.id
          JOIN exam_sessions es ON u.id = es.student_id
          JOIN exams e ON es.exam_id = e.id
          LEFT JOIN exam_results er ON e.id = er.exam_id AND u.id = er.student_id
          WHERE e.id = ${examId} AND es.is_completed = true
          ORDER BY er.marks_obtained DESC
        `;

        return result as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam student reports:', error);
      return [];
    }
  }


  // Home page content management
  async getHomePageContent(contentType?: string): Promise<HomePageContent[]> {
    if (contentType) {
      return await db.select().from(schema.homePageContent)
        .where(and(eq(schema.homePageContent.contentType, contentType), eq(schema.homePageContent.isActive, true)))
        .orderBy(asc(schema.homePageContent.displayOrder));
    }
    return await db.select().from(schema.homePageContent)
      .where(eq(schema.homePageContent.isActive, true))
      .orderBy(asc(schema.homePageContent.displayOrder), asc(schema.homePageContent.contentType));
  }
  async getHomePageContentById(id: number): Promise<HomePageContent | undefined> {
    const result = await db.select().from(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .limit(1);
    return result[0];
  }
  async updateHomePageContent(id: number, content: Partial<InsertHomePageContent>): Promise<HomePageContent | undefined> {
    const result = await db.update(schema.homePageContent)
      .set({ ...content, updatedAt: new Date() })
      .where(eq(schema.homePageContent.id, id))
      .returning();
    return result[0];
  }
  async deleteHomePageContent(id: number): Promise<boolean> {
    // First get the content to delete the file
    const content = await db.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl })
      .from(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .limit(1);
    
    // Delete the image file from Cloudinary/local storage
    if (content[0]?.imageUrl) {
      try {
        await deleteFile(content[0].imageUrl);
      } catch (fileError) {
        console.error(`Error deleting homepage content image for content ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .returning();
    return result.length > 0;
  }
  // Comprehensive grade management
  async recordComprehensiveGrade(gradeData: any): Promise<any> {
    try {
      // First ensure we have a report card for this student/term
      let reportCard = await db.select()
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.studentId, gradeData.studentId),
          eq(schema.reportCards.termId, gradeData.termId)
        ))
        .limit(1);

      let reportCardId: number;
      if (reportCard.length === 0) {
        // Create new report card
        const newReportCard = await db.insert(schema.reportCards)
          .values({
            studentId: gradeData.studentId,
            classId: gradeData.classId || 1, // Should be provided
            termId: gradeData.termId,
            status: 'draft',
          })
          .returning();
        reportCardId = newReportCard[0].id;
      } else {
        reportCardId = reportCard[0].id;
      }
      // Check if item already exists for this report card/subject
      const existingItem = await db.select()
        .from(schema.reportCardItems)
        .where(and(
          eq(schema.reportCardItems.reportCardId, reportCardId),
          eq(schema.reportCardItems.subjectId, gradeData.subjectId)
        ))
        .limit(1);

      const comprehensiveGradeData = {
        reportCardId: reportCardId,
        subjectId: gradeData.subjectId,
        testScore: gradeData.testScore,
        testMaxScore: gradeData.testMaxScore,
        testWeightedScore: gradeData.testWeightedScore || Math.round((gradeData.testScore / gradeData.testMaxScore) * 40),
        examScore: gradeData.examScore,
        examMaxScore: gradeData.examMaxScore,
        examWeightedScore: gradeData.examWeightedScore || Math.round((gradeData.examScore / gradeData.examMaxScore) * 60),
        obtainedMarks: gradeData.testWeightedScore + gradeData.examWeightedScore || Math.round(((gradeData.testScore / gradeData.testMaxScore) * 40) + ((gradeData.examScore / gradeData.examMaxScore) * 60)),
        percentage: gradeData.percentage || Math.round(((gradeData.testScore / gradeData.testMaxScore) * 40) + ((gradeData.examScore / gradeData.examMaxScore) * 60)),
        grade: gradeData.grade,
        teacherRemarks: gradeData.teacherRemarks,
      };

      if (existingItem.length > 0) {
        // Update existing item
        const result = await db.update(schema.reportCardItems)
          .set(comprehensiveGradeData)
          .where(eq(schema.reportCardItems.id, existingItem[0].id))
          .returning();
        return result[0];
      } else {
        // Create new item
        const result = await db.insert(schema.reportCardItems)
          .values(comprehensiveGradeData)
          .returning();
        return result[0];
      }
    } catch (error) {
      throw error;
    }
  }

  async getComprehensiveGradesByStudent(studentId: string, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        id: schema.reportCardItems.id,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        termId: schema.reportCards.termId,
        createdAt: schema.reportCardItems.createdAt
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.reportCards.studentId, studentId));

      if (termId) {
        query = query.where(and(
          eq(schema.reportCards.studentId, studentId),
          eq(schema.reportCards.termId, termId)
        ));
      }
      return await query.orderBy(schema.subjects.name);
    } catch (error) {
      return [];
    }
  }

  async getComprehensiveGradesByClass(classId: number, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        studentId: schema.reportCards.studentId,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        admissionNumber: schema.students.admissionNumber,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        examScore: schema.reportCardItems.examScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        grade: schema.reportCardItems.grade,
        teacherRemarks: schema.reportCardItems.teacherRemarks
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.students.classId, classId));

      if (termId) {
        query = query.where(and(
          eq(schema.students.classId, classId),
          eq(schema.reportCards.termId, termId)
        ));
      }
      return await query.orderBy(schema.users.firstName, schema.users.lastName, schema.subjects.name);
    } catch (error) {
      return [];
    }
  }

  async createReportCard(reportCardData: any, grades: any[]): Promise<any> {
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // Create main report card record
      const reportCard = await this.db.insert(schema.reportCards)
        .values(reportCardData)
        .returning();

      // Link all grade items to this report card sequentially to avoid connection issues
      if (grades.length > 0) {
        for (const grade of grades) {
          await this.db.update(schema.reportCardItems)
            .set({ reportCardId: reportCard[0].id })
            .where(eq(schema.reportCardItems.id, grade.id));
        }
      }
      return {
        reportCard: reportCard[0],
        grades: grades
      };
    } catch (error) {
      throw error;
    }
  }
  async getReportCard(id: number): Promise<ReportCard | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, id))
        .limit(1);
      
      if (!result[0]) return undefined;
      
      const reportCard = result[0];
      
      // Dynamically fetch signatures from profiles if not stored on report card
      let teacherSignatureUrl = reportCard.teacherSignatureUrl;
      let teacherSignedBy = reportCard.teacherSignedBy;
      let principalSignatureUrl = reportCard.principalSignatureUrl;
      let principalSignedBy = reportCard.principalSignedBy;
      
      // Get class info to fetch class teacher's signature
      const classInfo = await this.getClass(reportCard.classId);
      
      // If no teacher signature stored, fetch from class teacher's profile
      if (!teacherSignatureUrl && classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        if (teacherProfile?.signatureUrl) {
          teacherSignatureUrl = teacherProfile.signatureUrl;
          // Get teacher's name
          const teacherUser = await this.getUser(classInfo.classTeacherId);
          teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
        }
      }
      
      // If no principal signature stored, fetch from an admin with signature
      if (!principalSignatureUrl) {
        // First, check superAdminProfiles for signatures (super admins have higher authority)
        const superAdminsWithSignature = await db.select({
          signatureUrl: schema.superAdminProfiles.signatureUrl,
          userId: schema.superAdminProfiles.userId,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          roleId: schema.users.roleId
        })
          .from(schema.superAdminProfiles)
          .innerJoin(schema.users, eq(schema.superAdminProfiles.userId, schema.users.id))
          .where(and(
            isNotNull(schema.superAdminProfiles.signatureUrl),
            ne(schema.superAdminProfiles.signatureUrl, '')
          ))
          .limit(1);
        
        if (superAdminsWithSignature.length > 0) {
          principalSignatureUrl = superAdminsWithSignature[0].signatureUrl;
          principalSignedBy = `${superAdminsWithSignature[0].firstName} ${superAdminsWithSignature[0].lastName}`;
        } else {
          // Fallback: check regular adminProfiles for signatures
          const adminsWithSignature = await db.select({
            signatureUrl: schema.adminProfiles.signatureUrl,
            userId: schema.adminProfiles.userId,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            roleId: schema.users.roleId
          })
            .from(schema.adminProfiles)
            .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
            .where(and(
              isNotNull(schema.adminProfiles.signatureUrl),
              ne(schema.adminProfiles.signatureUrl, '')
            ))
            .limit(1);
          
          if (adminsWithSignature.length > 0) {
            principalSignatureUrl = adminsWithSignature[0].signatureUrl;
            principalSignedBy = `${adminsWithSignature[0].firstName} ${adminsWithSignature[0].lastName}`;
          }
        }
      }
      
      return {
        ...reportCard,
        teacherSignatureUrl,
        teacherSignedBy,
        principalSignatureUrl,
        principalSignedBy
      } as ReportCard;
    } catch (error) {
      return undefined;
    }
  }

  async getReportCardsByStudentId(studentId: string): Promise<ReportCard[]> {
    try {
      return await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.studentId, studentId))
        .orderBy(desc(schema.reportCards.generatedAt));
    } catch (error) {
      return [];
    }
  }

  async getReportCardItems(reportCardId: number): Promise<ReportCardItem[]> {
    try {
      return await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));
    } catch (error) {
      return [];
    }
  }

  async getReportCardItemById(itemId: number): Promise<ReportCardItem | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.id, itemId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting report card item by id:', error);
      return undefined;
    }
  }

  async getStudentsByParentId(parentId: string): Promise<Student[]> {
    try {
      return await db.select()
        .from(schema.students)
        .where(eq(schema.students.parentId, parentId));
    } catch (error) {
      return [];
    }
  }

  // Enhanced report card management methods
  async getReportCardsByClassAndTerm(classId: number, termId: number): Promise<any[]> {
    try {
      const results = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore,
        averagePercentage: schema.reportCards.averagePercentage,
        overallGrade: schema.reportCards.overallGrade,
        position: schema.reportCards.position,
        totalStudentsInClass: schema.reportCards.totalStudentsInClass,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
        status: schema.reportCards.status,
        gradingScale: schema.reportCards.gradingScale,
        generatedAt: schema.reportCards.generatedAt,
        finalizedAt: schema.reportCards.finalizedAt,
        publishedAt: schema.reportCards.publishedAt,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        studentUsername: schema.users.username,
        studentPhoto: schema.users.profileImageUrl,
        admissionNumber: schema.students.admissionNumber,
        department: schema.students.department,
        className: schema.classes.name,
        classLevel: schema.classes.level
      })
        .from(schema.reportCards)
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ))
        .orderBy(schema.reportCards.position);
      
      return results.map((r: any) => {
        const isSSS = r.className?.startsWith('SS') || r.classLevel?.includes('Senior Secondary');
        return {
          ...r,
          isSSS,
          department: isSSS ? r.department : null
        };
      });
    } catch (error) {
      console.error('Error getting report cards by class and term:', error);
      return [];
    }
  }

  async getReportCardWithItems(reportCardId: number): Promise<any> {
    try {
      const reportCard = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore,
        averagePercentage: schema.reportCards.averagePercentage,
        overallGrade: schema.reportCards.overallGrade,
        position: schema.reportCards.position,
        totalStudentsInClass: schema.reportCards.totalStudentsInClass,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
        status: schema.reportCards.status,
        gradingScale: schema.reportCards.gradingScale,
        generatedAt: schema.reportCards.generatedAt,
        teacherSignatureUrl: schema.reportCards.teacherSignatureUrl,
        teacherSignedBy: schema.reportCards.teacherSignedBy,
        teacherSignedAt: schema.reportCards.teacherSignedAt,
        principalSignatureUrl: schema.reportCards.principalSignatureUrl,
        principalSignedBy: schema.reportCards.principalSignedBy,
        principalSignedAt: schema.reportCards.principalSignedAt,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        studentUsername: schema.users.username,
        studentPhoto: schema.users.profileImageUrl,
        admissionNumber: schema.students.admissionNumber,
        department: schema.students.department,
        className: schema.classes.name,
        classLevel: schema.classes.level,
        termName: schema.academicTerms.name,
        termYear: schema.academicTerms.year
      })
        .from(schema.reportCards)
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .innerJoin(schema.academicTerms, eq(schema.reportCards.termId, schema.academicTerms.id))
        .where(eq(schema.reportCards.id, reportCardId))
        .limit(1);

      if (reportCard.length === 0) return null;
      
      // Add computed fields
      const isSSS = reportCard[0].className?.startsWith('SS') || reportCard[0].classLevel?.includes('Senior Secondary');
      // Use term year directly as it's stored in YYYY/YYYY format (e.g., "2024/2025")
      const academicSession = reportCard[0].termYear || '2024/2025';

      const items = await db.select({
        id: schema.reportCardItems.id,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        subjectCode: schema.subjects.code,
        testExamId: schema.reportCardItems.testExamId,
        testExamCreatedBy: schema.reportCardItems.testExamCreatedBy,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examExamId: schema.reportCardItems.examExamId,
        examExamCreatedBy: schema.reportCardItems.examExamCreatedBy,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        totalMarks: schema.reportCardItems.totalMarks,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        remarks: schema.reportCardItems.remarks,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        isOverridden: schema.reportCardItems.isOverridden,
        overriddenAt: schema.reportCardItems.overriddenAt,
        overriddenBy: schema.reportCardItems.overriddenBy
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.reportCardItems.reportCardId, reportCardId))
        .orderBy(schema.subjects.name);

      // Dynamically fetch signatures from profiles if not stored on report card
      let teacherSignatureUrl = reportCard[0].teacherSignatureUrl;
      let teacherSignedBy = reportCard[0].teacherSignedBy;
      let principalSignatureUrl = reportCard[0].principalSignatureUrl;
      let principalSignedBy = reportCard[0].principalSignedBy;
      
      console.log('[SIGNATURE-DEBUG] Initial state:', { 
        hasStoredTeacherSig: !!teacherSignatureUrl, 
        hasStoredPrincipalSig: !!principalSignatureUrl,
        classId: reportCard[0].classId
      });
      
      // Get class info to fetch class teacher's signature
      const classInfo = await this.getClass(reportCard[0].classId);
      console.log('[SIGNATURE-DEBUG] Class info:', { classTeacherId: classInfo?.classTeacherId });
      
      // If no teacher signature stored, fetch from class teacher's profile
      if (!teacherSignatureUrl && classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        console.log('[SIGNATURE-DEBUG] Teacher profile:', { 
          hasProfile: !!teacherProfile, 
          hasSignature: !!teacherProfile?.signatureUrl,
          signatureLength: teacherProfile?.signatureUrl?.length || 0
        });
        if (teacherProfile?.signatureUrl) {
          teacherSignatureUrl = teacherProfile.signatureUrl;
          // Get teacher's name
          const teacherUser = await this.getUser(classInfo.classTeacherId);
          teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
        }
      }
      
      // If no principal signature stored, fetch from an admin with signature
      if (!principalSignatureUrl) {
        // First, check superAdminProfiles for signatures (super admins have higher authority)
        const superAdminsWithSignature = await db.select({
          signatureUrl: schema.superAdminProfiles.signatureUrl,
          userId: schema.superAdminProfiles.userId,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          roleId: schema.users.roleId
        })
          .from(schema.superAdminProfiles)
          .innerJoin(schema.users, eq(schema.superAdminProfiles.userId, schema.users.id))
          .where(and(
            isNotNull(schema.superAdminProfiles.signatureUrl),
            ne(schema.superAdminProfiles.signatureUrl, '')
          ))
          .limit(1);
        
        console.log('[SIGNATURE-DEBUG] Super admins with signature found:', superAdminsWithSignature.length);
        
        if (superAdminsWithSignature.length > 0) {
          console.log('[SIGNATURE-DEBUG] Using super admin signature from:', superAdminsWithSignature[0].firstName, superAdminsWithSignature[0].lastName);
          principalSignatureUrl = superAdminsWithSignature[0].signatureUrl;
          principalSignedBy = `${superAdminsWithSignature[0].firstName} ${superAdminsWithSignature[0].lastName}`;
        } else {
          // Fallback: check regular adminProfiles for signatures
          const adminsWithSignature = await db.select({
            signatureUrl: schema.adminProfiles.signatureUrl,
            userId: schema.adminProfiles.userId,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            roleId: schema.users.roleId
          })
            .from(schema.adminProfiles)
            .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
            .where(and(
              isNotNull(schema.adminProfiles.signatureUrl),
              ne(schema.adminProfiles.signatureUrl, '')
            ))
            .limit(1);
          
          console.log('[SIGNATURE-DEBUG] Admins with signature found:', adminsWithSignature.length);
          
          if (adminsWithSignature.length > 0) {
            console.log('[SIGNATURE-DEBUG] Using admin signature from:', adminsWithSignature[0].firstName, adminsWithSignature[0].lastName);
            principalSignatureUrl = adminsWithSignature[0].signatureUrl;
            principalSignedBy = `${adminsWithSignature[0].firstName} ${adminsWithSignature[0].lastName}`;
          }
        }
      }

      // Load skills from database
      const skills = await this.getReportCardSkills(reportCardId);

      return { 
        ...reportCard[0], 
        isSSS: isSSS,
        academicSession: academicSession,
        department: isSSS ? reportCard[0].department : null,
        teacherSignatureUrl,
        teacherSignedBy,
        principalSignatureUrl,
        principalSignedBy,
        items,
        affectiveTraits: {
          punctuality: skills?.punctuality || 0,
          neatness: skills?.neatness || 0,
          attentiveness: skills?.attentiveness || 0,
          teamwork: skills?.teamwork || 0,
          leadership: skills?.leadership || 0,
          assignments: skills?.assignments || 0,
          classParticipation: skills?.classParticipation || 0
        },
        psychomotorSkills: {
          sports: skills?.sports || 0,
          handwriting: skills?.handwriting || 0,
          musicalSkills: skills?.musicalSkills || 0,
          creativity: skills?.creativity || 0
        }
      };
    } catch (error) {
      console.error('Error getting report card with items:', error);
      return null;
    }
  }

  async generateReportCardsForClass(classId: number, termId: number, gradingScale: string, generatedBy: string): Promise<{ created: number; updated: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let created = 0;
      let updated = 0;

      // Get all students in the class
      const students = await db.select()
        .from(schema.students)
        .where(eq(schema.students.classId, classId));

      // Get class info to determine if this is a Senior Secondary class
      const classInfo = await this.getClass(classId);
      const isSeniorSecondary = classInfo && 
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level => 
          classInfo.level?.toLowerCase().includes(level.toLowerCase())
        );

      // Get class teacher's signature for pre-population
      let classTeacherSignatureUrl: string | null = null;
      if (classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        classTeacherSignatureUrl = teacherProfile?.signatureUrl || null;
      }

      for (const student of students) {
        try {
          // Check if report card already exists
          const existingReportCard = await db.select()
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.studentId, student.id),
              eq(schema.reportCards.termId, termId)
            ))
            .limit(1);

          let reportCardId: number;

          if (existingReportCard.length === 0) {
            // Get student name for generating default comments
            const studentUser = await this.getUser(student.userId);
            const studentFirstName = studentUser?.firstName || 'Student';
            
            // Create new report card with pre-populated teacher signature and default comments
            const newReportCard = await db.insert(schema.reportCards)
              .values({
                studentId: student.id,
                classId: classId,
                termId: termId,
                status: 'draft',
                gradingScale: gradingScale,
                scoreAggregationMode: 'last',
                generatedBy: generatedBy,
                generatedAt: new Date(),
                // Pre-populate class teacher's signature if available
                teacherSignatureUrl: classTeacherSignatureUrl,
                teacherSignedBy: classTeacherSignatureUrl ? classInfo?.classTeacherId : null,
                teacherSignedAt: classTeacherSignatureUrl ? new Date() : null,
                // Default comments will be generated after scores are populated
              })
              .returning();
            reportCardId = newReportCard[0].id;
            created++;
          } else {
            reportCardId = existingReportCard[0].id;
            updated++;
          }

          // Get student's department for SS students
          const studentDepartment = (student as any).department;
          
          // SINGLE SOURCE OF TRUTH: Use class_subject_mappings
          // For SS students with department, get department-specific subjects
          // For JSS/other students, get all class subjects (no department filter)
          let subjects: any[];
          
          if (isSeniorSecondary && studentDepartment) {
            // SS students with department - get department-specific mappings
            subjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
          } else {
            // JSS/other students - get all class mappings (no department filter)
            subjects = await this.getSubjectsByClassAndDepartment(classId);
          }
          
          // If no subjects assigned for this class/department, log warning and skip
          if (subjects.length === 0) {
            console.log(`[REPORT-CARD] No class_subject_mappings found for class ${classId}, department: ${studentDepartment || 'none'}. Admin must assign subjects via Subject Manager.`);
            errors.push(`No subjects assigned for student ${student.id} (class ${classId}, dept: ${studentDepartment || 'none'}). Admin must configure subjects.`);
            continue;
          }

          // Get the set of valid subject IDs from class_subject_mappings
          const validSubjectIds = new Set(subjects.map(s => s.id));

          // CLEANUP: Remove report card items that are NOT in class_subject_mappings
          // This ensures only the admin-assigned subjects appear on report cards
          const existingItems = await db.select()
            .from(schema.reportCardItems)
            .where(eq(schema.reportCardItems.reportCardId, reportCardId));
          
          for (const item of existingItems) {
            if (!validSubjectIds.has(item.subjectId)) {
              await db.delete(schema.reportCardItems)
                .where(eq(schema.reportCardItems.id, item.id));
              console.log(`[REPORT-CARD] Removed invalid subject ${item.subjectId} from report card ${reportCardId}`);
            }
          }

          // Create or update report card items for each valid subject
          for (const subject of subjects) {
            const existingItem = await db.select()
              .from(schema.reportCardItems)
              .where(and(
                eq(schema.reportCardItems.reportCardId, reportCardId),
                eq(schema.reportCardItems.subjectId, subject.id)
              ))
              .limit(1);

            if (existingItem.length === 0) {
              await db.insert(schema.reportCardItems)
                .values({
                  reportCardId: reportCardId,
                  subjectId: subject.id,
                  totalMarks: 100,
                  obtainedMarks: 0,
                  percentage: 0
                });
            }
          }

          // Auto-populate scores for this report card
          await this.autoPopulateReportCardScores(reportCardId);

        } catch (studentError: any) {
          errors.push(`Failed to generate report card for student ${student.id}: ${studentError.message}`);
        }
      }

      // Recalculate positions for all report cards in this class/term
      await this.recalculateClassPositions(classId, termId);

      return { created, updated, errors };
    } catch (error: any) {
      console.error('Error generating report cards for class:', error);
      return { created: 0, updated: 0, errors: [error.message] };
    }
  }

  async autoPopulateReportCardScores(reportCardId: number): Promise<{ populated: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let populated = 0;

      // Get the report card details
      const reportCard = await this.getReportCard(reportCardId);
      if (!reportCard) {
        return { populated: 0, errors: ['Report card not found'] };
      }

      const gradingScale = (reportCard as any).gradingScale || 'standard';
      let config = getGradingConfig(gradingScale);
      
      // Get system settings for test/exam weights
      const systemSettings = await this.getSystemSettings();
      if (systemSettings) {
        // Override grading config with system settings weights
        const testWeight = systemSettings.testWeight ?? 40;
        const examWeight = systemSettings.examWeight ?? 60;
        config = { ...config, testWeight, examWeight };
      }

      // Get all report card items
      const items = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));

      for (const item of items) {
        try {
          // Skip if item has been manually overridden
          if (item.isOverridden) continue;

          // Get exam scores for this student and subject
          const examScores = await this.getExamScoresForReportCard(
            reportCard.studentId,
            item.subjectId,
            reportCard.termId
          );

          let testScore: number | null = null;
          let testMaxScore: number | null = null;
          let examScore: number | null = null;
          let examMaxScore: number | null = null;

          // Aggregate test scores (type: 'test')
          if (examScores.testExams.length > 0) {
            const lastTest = examScores.testExams[examScores.testExams.length - 1];
            testScore = lastTest.score;
            testMaxScore = lastTest.maxScore;
          }

          // Aggregate main exam scores (type: 'exam')
          if (examScores.mainExams.length > 0) {
            const lastExam = examScores.mainExams[examScores.mainExams.length - 1];
            examScore = lastExam.score;
            examMaxScore = lastExam.maxScore;
          }

          // Calculate weighted score using system settings weights
          const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config);
          const gradeInfo = calculateGrade(weighted.percentage, gradingScale);

          // Update the report card item
          await db.update(schema.reportCardItems)
            .set({
              testScore: testScore,
              testMaxScore: testMaxScore,
              testWeightedScore: Math.round(weighted.testWeighted),
              examScore: examScore,
              examMaxScore: examMaxScore,
              examWeightedScore: Math.round(weighted.examWeighted),
              obtainedMarks: Math.round(weighted.weightedScore),
              percentage: Math.round(weighted.percentage),
              grade: gradeInfo.grade,
              remarks: gradeInfo.remarks,
              updatedAt: new Date()
            })
            .where(eq(schema.reportCardItems.id, item.id));

          populated++;
        } catch (itemError: any) {
          errors.push(`Failed to populate scores for item ${item.id}: ${itemError.message}`);
        }
      }

      // Recalculate report card totals
      await this.recalculateReportCard(reportCardId, gradingScale);

      return { populated, errors };
    } catch (error: any) {
      console.error('Error auto-populating report card scores:', error);
      return { populated: 0, errors: [error.message] };
    }
  }

  async getExamScoresForReportCard(studentId: string, subjectId: number, termId: number): Promise<{ testExams: any[]; mainExams: any[] }> {
    try {
      // Get all exams for this subject and term
      const examResults = await db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        score: schema.examResults.marksObtained,
        maxScore: schema.exams.totalMarks,
        examType: schema.exams.examType,
        examDate: schema.exams.examDate,
        createdAt: schema.examResults.createdAt
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(and(
          eq(schema.examResults.studentId, studentId),
          eq(schema.exams.subjectId, subjectId),
          eq(schema.exams.termId, termId)
        ))
        .orderBy(schema.examResults.createdAt);

      const testExams = examResults.filter((r: any) => r.examType === 'test' || r.examType === 'quiz' || r.examType === 'assignment');
      const mainExams = examResults.filter((r: any) => r.examType === 'exam' || r.examType === 'final' || r.examType === 'midterm');

      return { testExams, mainExams };
    } catch (error) {
      console.error('Error getting exam scores for report card:', error);
      return { testExams: [], mainExams: [] };
    }
  }

  async overrideReportCardItemScore(itemId: number, data: {
    testScore?: number | null;
    testMaxScore?: number | null;
    examScore?: number | null;
    examMaxScore?: number | null;
    teacherRemarks?: string | null;
    overriddenBy: string;
  }): Promise<ReportCardItem | undefined> {
    try {
      // Get the item first to get report card info
      const item = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.id, itemId))
        .limit(1);

      if (item.length === 0) return undefined;

      // Get report card for grading scale
      const reportCard = await this.getReportCard(item[0].reportCardId);
      if (!reportCard) return undefined;

      const gradingScale = (reportCard as any).gradingScale || 'standard';
      const gradingConfig = getGradingConfig(gradingScale);

      // Calculate new weighted score
      const testScore = data.testScore !== undefined ? data.testScore : item[0].testScore;
      const testMaxScore = data.testMaxScore !== undefined ? data.testMaxScore : item[0].testMaxScore;
      const examScore = data.examScore !== undefined ? data.examScore : item[0].examScore;
      const examMaxScore = data.examMaxScore !== undefined ? data.examMaxScore : item[0].examMaxScore;

      const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, gradingConfig);
      const gradeInfo = calculateGrade(weighted.percentage, gradingScale);

      const result = await db.update(schema.reportCardItems)
        .set({
          testScore: testScore,
          testMaxScore: testMaxScore,
          testWeightedScore: Math.round(weighted.testWeighted),
          examScore: examScore,
          examMaxScore: examMaxScore,
          examWeightedScore: Math.round(weighted.examWeighted),
          obtainedMarks: Math.round(weighted.weightedScore),
          percentage: Math.round(weighted.percentage),
          grade: gradeInfo.grade,
          remarks: gradeInfo.remarks,
          teacherRemarks: data.teacherRemarks !== undefined ? data.teacherRemarks : item[0].teacherRemarks,
          isOverridden: true,
          overriddenBy: data.overriddenBy,
          overriddenAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.reportCardItems.id, itemId))
        .returning();

      // Recalculate report card totals
      await this.recalculateReportCard(reportCard.id, gradingScale);

      // Recalculate class positions since scores changed
      if (reportCard.classId && reportCard.termId) {
        await this.recalculateClassPositions(reportCard.classId, reportCard.termId);
      }

      console.log(`[REPORT-CARD-OVERRIDE] Successfully updated item ${itemId} with test: ${testScore}/${testMaxScore}, exam: ${examScore}/${examMaxScore}, grade: ${gradeInfo.grade}`);

      return result[0];
    } catch (error) {
      console.error('Error overriding report card item score:', error);
      return undefined;
    }
  }

  async updateReportCardStatus(reportCardId: number, status: string, userId: string): Promise<ReportCard | undefined> {
    try {
      // Validate status value
      const validStatuses = ['draft', 'finalized', 'published'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Get current report card to check current status
      const currentReportCard = await this.getReportCard(reportCardId);
      if (!currentReportCard) {
        throw new Error('Report card not found');
      }

      const currentStatus = currentReportCard.status || 'draft';

      // Short-circuit: If already in the target status, return current report card without updating timestamps
      if (currentStatus === status) {
        return currentReportCard;
      }

      // Define valid state transitions (centralized state machine)
      const validTransitions: Record<string, string[]> = {
        'draft': ['finalized'],           // Draft can only go to Finalized
        'finalized': ['draft', 'published'],  // Finalized can revert to Draft or go to Published
        'published': ['draft', 'finalized']   // Published can revert to Draft or Finalized
      };

      const allowedNextStatuses = validTransitions[currentStatus] || [];

      // Validate transition
      if (!allowedNextStatuses.includes(status)) {
        throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`);
      }

      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };

      if (status === 'draft') {
        updateData.finalizedAt = null;
        updateData.publishedAt = null;
        updateData.locked = false;
      } else if (status === 'finalized') {
        updateData.finalizedAt = new Date();
        updateData.publishedAt = null;
        updateData.locked = true;
      } else if (status === 'published') {
        updateData.publishedAt = new Date();
        updateData.locked = true;
      }

      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error updating report card status:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  // OPTIMIZED version - single query with conditional update for instant status changes
  async updateReportCardStatusOptimized(reportCardId: number, status: string, userId: string): Promise<{ reportCard: ReportCard; previousStatus: string } | undefined> {
    try {
      // Validate status value upfront
      const validStatuses = ['draft', 'finalized', 'published'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Single efficient query to get just the current status
      const current = await db.select({ 
        id: schema.reportCards.id, 
        status: schema.reportCards.status 
      })
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, reportCardId))
        .limit(1);

      if (!current.length) {
        throw new Error('Report card not found');
      }

      const currentStatus = current[0].status || 'draft';

      // Short-circuit: If already in the target status, get and return full report card
      if (currentStatus === status) {
        const existing = await db.select()
          .from(schema.reportCards)
          .where(eq(schema.reportCards.id, reportCardId))
          .limit(1);
        return { reportCard: existing[0], previousStatus: currentStatus };
      }

      // Validate state transition
      const validTransitions: Record<string, string[]> = {
        'draft': ['finalized'],
        'finalized': ['draft', 'published'],
        'published': ['draft', 'finalized']
      };

      const allowedNextStatuses = validTransitions[currentStatus] || [];
      if (!allowedNextStatuses.includes(status)) {
        throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`);
      }

      // Build update data based on target status
      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };

      if (status === 'draft') {
        updateData.finalizedAt = null;
        updateData.publishedAt = null;
        updateData.locked = false;
      } else if (status === 'finalized') {
        updateData.finalizedAt = new Date();
        updateData.publishedAt = null;
        updateData.locked = true;
      } else if (status === 'published') {
        updateData.publishedAt = new Date();
        updateData.locked = true;
      }

      // Execute update and return in single operation
      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      const updatedReportCard = result[0];

      // CRITICAL: When finalizing, recalculate and persist report card totals and class positions
      // This ensures admin/parent/student views show correct class statistics
      if (status === 'finalized' && updatedReportCard) {
        console.log(`[REPORT-CARD-STATUS] Recalculating totals for finalized report card ${reportCardId}`);
        
        // Recalculate this report card's totals (averagePercentage, totalScore, etc.)
        await this.recalculateReportCard(reportCardId, updatedReportCard.gradingScale || 'standard');
        
        // Recalculate class positions for all students in this class/term
        if (updatedReportCard.classId && updatedReportCard.termId) {
          await this.recalculateClassPositions(updatedReportCard.classId, updatedReportCard.termId);
        }
        
        // Fetch the updated report card with recalculated values
        const finalResult = await db.select()
          .from(schema.reportCards)
          .where(eq(schema.reportCards.id, reportCardId))
          .limit(1);
        
        return { reportCard: finalResult[0], previousStatus: currentStatus };
      }

      return { reportCard: updatedReportCard, previousStatus: currentStatus };
    } catch (error) {
      console.error('Error updating report card status (optimized):', error);
      throw error;
    }
  }

  async updateReportCardRemarks(reportCardId: number, teacherRemarks?: string, principalRemarks?: string): Promise<ReportCard | undefined> {
    try {
      const updateData: any = { updatedAt: new Date() };
      if (teacherRemarks !== undefined) updateData.teacherRemarks = teacherRemarks;
      if (principalRemarks !== undefined) updateData.principalRemarks = principalRemarks;

      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error updating report card remarks:', error);
      return undefined;
    }
  }

  // Report comment template methods
  async getReportCommentTemplates(role?: string): Promise<any[]> {
    try {
      if (role) {
        return await db.select()
          .from(schema.reportCommentTemplates)
          .where(eq(schema.reportCommentTemplates.role, role))
          .orderBy(desc(schema.reportCommentTemplates.minPercentage));
      }
      return await db.select()
        .from(schema.reportCommentTemplates)
        .orderBy(schema.reportCommentTemplates.role, desc(schema.reportCommentTemplates.minPercentage));
    } catch (error) {
      console.error('Error getting report comment templates:', error);
      return [];
    }
  }

  async getReportCommentTemplate(id: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCommentTemplates)
        .where(eq(schema.reportCommentTemplates.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting report comment template:', error);
      return undefined;
    }
  }

  async createReportCommentTemplate(template: any): Promise<any> {
    try {
      const result = await db.insert(schema.reportCommentTemplates)
        .values(template)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating report comment template:', error);
      throw error;
    }
  }

  async updateReportCommentTemplate(id: number, template: any): Promise<any | undefined> {
    try {
      const result = await db.update(schema.reportCommentTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(schema.reportCommentTemplates.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating report comment template:', error);
      return undefined;
    }
  }

  async deleteReportCommentTemplate(id: number): Promise<boolean> {
    try {
      await db.delete(schema.reportCommentTemplates)
        .where(eq(schema.reportCommentTemplates.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting report comment template:', error);
      return false;
    }
  }

  async getCommentTemplateByPerformance(role: string, percentage: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCommentTemplates)
        .where(
          and(
            eq(schema.reportCommentTemplates.role, role),
            eq(schema.reportCommentTemplates.isActive, true),
            lte(schema.reportCommentTemplates.minPercentage, percentage),
            gte(schema.reportCommentTemplates.maxPercentage, percentage)
          )
        )
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting comment template by performance:', error);
      return undefined;
    }
  }

  async getExamsWithSubjectsByClassAndTerm(classId: number, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        id: schema.exams.id,
        title: schema.exams.title,
        subjectId: schema.exams.subjectId,
        subjectName: schema.subjects.name,
        examType: schema.exams.examType,
        totalMarks: schema.exams.totalMarks,
        examDate: schema.exams.examDate,
        status: schema.exams.status,
        termId: schema.exams.termId
      })
        .from(schema.exams)
        .innerJoin(schema.subjects, eq(schema.exams.subjectId, schema.subjects.id))
        .where(eq(schema.exams.classId, classId));

      if (termId) {
        query = query.where(and(
          eq(schema.exams.classId, classId),
          eq(schema.exams.termId, termId)
        ));
      }

      return await query.orderBy(desc(schema.exams.examDate));
    } catch (error) {
      console.error('Error getting exams by class and term:', error);
      return [];
    }
  }

  async recalculateReportCard(reportCardId: number, gradingScale: string): Promise<ReportCard | undefined> {
    try {
      // Get all items for this report card
      const items = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));

      if (items.length === 0) return undefined;

      // Calculate totals
      let totalObtained = 0;
      let totalPossible = 0;
      const grades: string[] = [];

      for (const item of items) {
        totalObtained += item.obtainedMarks || 0;
        totalPossible += item.totalMarks || 100;
        if (item.grade) grades.push(item.grade);
      }

      const averagePercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
      const overallGrade = getOverallGrade(averagePercentage, gradingScale);

      const result = await db.update(schema.reportCards)
        .set({
          totalScore: totalObtained,
          averageScore: Math.round(averagePercentage),
          averagePercentage: Math.round(averagePercentage),
          overallGrade: overallGrade,
          updatedAt: new Date()
        })
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error recalculating report card:', error);
      return undefined;
    }
  }

  private async recalculateClassPositions(classId: number, termId: number): Promise<void> {
    try {
      console.log(`[REPORT-CARD] Calculating class positions for class ${classId}, term ${termId}`);
      
      // Get positioning method from system settings (default to 'average' for fairness)
      const settings = await db.select().from(schema.systemSettings).limit(1);
      const positioningMethod = settings[0]?.positioningMethod || 'average';
      console.log(`[REPORT-CARD] Using positioning method: ${positioningMethod}`);
      
      // Step 1: Get all report cards for this class and term with their total scores
      const reportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore
      })
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ));
      
      if (reportCards.length === 0) {
        console.log(`[REPORT-CARD] No report cards found for class ${classId}, term ${termId}`);
        return;
      }
      
      const totalStudentsInClass = reportCards.length;
      
      // Step 2: Sort based on positioning method
      // 'average' = use averageScore (fair for different subject counts)
      // 'total' = use totalScore (original behavior)
      const sortedCards = [...reportCards].sort((a, b) => {
        let scoreA: number;
        let scoreB: number;
        
        if (positioningMethod === 'average') {
          // Use average score for fair comparison across departments
          scoreA = a.averageScore ?? 0;
          scoreB = b.averageScore ?? 0;
        } else {
          // Use total score (original behavior)
          scoreA = a.totalScore ?? a.averageScore ?? 0;
          scoreB = b.totalScore ?? b.averageScore ?? 0;
        }
        
        return scoreB - scoreA; // Descending order
      });
      
      // Step 3: Calculate positions with proper tie handling
      // Students with same score share same position, next position skips appropriately
      // e.g., if two students are 1st, the next student is 3rd (not 2nd)
      const positionMap = new Map<number, number>(); // reportCardId -> position
      
      let lastAssignedPosition = 1;
      let previousScore: number | null = null;
      
      for (let i = 0; i < sortedCards.length; i++) {
        const card = sortedCards[i];
        const score = positioningMethod === 'average' 
          ? (card.averageScore ?? 0) 
          : (card.totalScore ?? card.averageScore ?? 0);
        
        if (i === 0) {
          // First student always gets position 1
          lastAssignedPosition = 1;
        } else if (score !== previousScore) {
          // Different score from previous - position = current index + 1 (0-indexed to 1-indexed)
          // This correctly skips positions for ties (e.g., after two 1st places, next is 3rd)
          lastAssignedPosition = i + 1;
        }
        // If score equals previousScore, keep lastAssignedPosition (ties share same position)
        
        positionMap.set(card.id, lastAssignedPosition);
        previousScore = score;
      }
      
      // Step 4: Update all report cards with calculated positions
      for (const card of reportCards) {
        const position = positionMap.get(card.id) ?? reportCards.length;
        
        await db.update(schema.reportCards)
          .set({
            position: position,
            totalStudentsInClass: totalStudentsInClass,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCards.id, card.id));
      }
      
      console.log(`[REPORT-CARD] Successfully calculated positions for ${totalStudentsInClass} students in class ${classId}, term ${termId}`);
      
      // Emit WebSocket event for real-time position updates
      try {
        realtimeService.emitTableChange('report_cards', 'UPDATE', {
          event: 'positions_updated',
          classId,
          termId,
          totalStudents: totalStudentsInClass,
          reportCardIds: reportCards.map((rc: { id: number }) => rc.id),
          positions: Array.from(positionMap.entries()).map(([id, pos]) => ({ reportCardId: id, position: pos }))
        });
      } catch (emitError) {
        console.warn(`[REPORT-CARD] Failed to emit position update WebSocket event:`, emitError);
      }
      
    } catch (error) {
      console.error(`[REPORT-CARD] Error calculating class positions for class ${classId}, term ${termId}:`, error);
    }
  }

  // Auto-sync exam score to report card (called immediately after exam submission)
  async syncExamScoreToReportCard(studentId: string, examId: number, score: number, maxScore: number): Promise<{ success: boolean; reportCardId?: number; message: string; isNewReportCard?: boolean }> {
    try {
      console.log(`[REPORT-CARD-SYNC] Starting sync for student ${studentId}, exam ${examId}, score ${score}/${maxScore}`);

      // 1. Get exam details to find subject, class, term, and type
      const exam = await db.select()
        .from(schema.exams)
        .where(eq(schema.exams.id, examId))
        .limit(1);

      if (exam.length === 0) {
        return { success: false, message: 'Exam not found' };
      }

      const examData = exam[0];
      const { subjectId, classId, termId, examType, gradingScale: examGradingScale, createdBy: examCreatedBy } = examData;

      if (!subjectId || !classId || !termId) {
        return { success: false, message: 'Exam missing required fields (subject, class, or term)' };
      }

      // 2. Get student to verify class assignment
      const student = await db.select()
        .from(schema.students)
        .where(eq(schema.students.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return { success: false, message: 'Student not found' };
      }

      // 2b. Get academic term to fetch session year
      const academicTerm = await db.select()
        .from(schema.academicTerms)
        .where(eq(schema.academicTerms.id, termId))
        .limit(1);

      const sessionYear = academicTerm.length > 0 
        ? `${academicTerm[0].year}/${academicTerm[0].year + 1}` 
        : null;

      // 3. Find or create report card for this student/term
      let reportCard = await db.select()
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.studentId, studentId),
          eq(schema.reportCards.termId, termId)
        ))
        .limit(1);

      let reportCardId: number;
      let isNewReportCard = false;
      const gradingScale = examGradingScale || 'standard';

      if (reportCard.length === 0) {
        // Create new report card (auto-generated)
        console.log(`[REPORT-CARD-SYNC] Auto-creating new report card for student ${studentId}, term ${termId}`);
        isNewReportCard = true;
        const newReportCard = await db.insert(schema.reportCards)
          .values({
            studentId,
            classId,
            termId,
            sessionYear,
            status: 'draft',
            gradingScale,
            scoreAggregationMode: 'last',
            generatedAt: new Date(),
            autoGenerated: true,
            locked: false
          })
          .returning();
        reportCardId = newReportCard[0].id;

        // Get student's class to check if Senior Secondary
        const studentClass = await db.select()
          .from(schema.classes)
          .where(eq(schema.classes.id, classId))
          .limit(1);
        
        const isSeniorSecondary = studentClass.length > 0 && 
          (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
        // Normalize department - treat empty/whitespace-only as undefined
        const rawDepartment = (student[0].department || '').trim().toLowerCase();
        const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

        // PRIORITY 1: Check student's personal subject assignments (from studentSubjectAssignments table)
        // This is the authoritative source for what subjects a student should have on their report card
        const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
          .from(schema.studentSubjectAssignments)
          .where(and(
            eq(schema.studentSubjectAssignments.studentId, studentId),
            eq(schema.studentSubjectAssignments.classId, classId),
            eq(schema.studentSubjectAssignments.isActive, true)
          ));
        
        let relevantSubjects: any[] = [];
        
        if (studentSubjectAssignments.length > 0) {
          // Use student's personal subject assignments - respects department selection
          const studentSubjectIds = studentSubjectAssignments.map((a: { subjectId: number }) => a.subjectId);
          relevantSubjects = await db.select()
            .from(schema.subjects)
            .where(and(
              inArray(schema.subjects.id, studentSubjectIds),
              eq(schema.subjects.isActive, true)
            ));
          console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from student's personal assignments`);
        } else {
          // PRIORITY 2: Use class_subject_mappings as SINGLE SOURCE OF TRUTH
          // NO FALLBACK - Admin must configure subjects via Subject Manager
          relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
          
          if (relevantSubjects.length > 0) {
            console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from class_subject_mappings (department: ${studentDepartment || 'none'})`);
          } else {
            // No fallback - if no mappings exist, create empty report card
            // Admin must assign subjects via the Subject Manager
            console.log(`[REPORT-CARD-SYNC] No subjects found in class_subject_mappings for class ${classId}, department: ${studentDepartment || 'none'}. Admin must assign subjects.`);
          }
        }

        console.log(`[REPORT-CARD-SYNC] Creating ${relevantSubjects.length} subject items for ${isSeniorSecondary ? `SS ${studentDepartment || 'no-dept'}` : 'non-SS'} student`);

        for (const subject of relevantSubjects) {
          await db.insert(schema.reportCardItems)
            .values({
              reportCardId,
              subjectId: subject.id,
              totalMarks: 100,
              obtainedMarks: 0,
              percentage: 0
            });
        }
      } else {
        reportCardId = reportCard[0].id;
        
        // ALSO check existing report cards for missing subjects and add them
        // This ensures students get all their assigned subjects even if report card was created before assignments
        const existingItems = await db.select({ subjectId: schema.reportCardItems.subjectId })
          .from(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCardId));
        
        const existingSubjectIds = new Set(existingItems.map((item: { subjectId: number }) => item.subjectId));
        
        // Get student's class and department info
        const studentClass = await db.select()
          .from(schema.classes)
          .where(eq(schema.classes.id, classId))
          .limit(1);
        
        const isSeniorSecondary = studentClass.length > 0 && 
          (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
        const rawDepartment = (student[0].department || '').trim().toLowerCase();
        const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;
        
        // Get all subjects that should be assigned
        const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
          .from(schema.studentSubjectAssignments)
          .where(and(
            eq(schema.studentSubjectAssignments.studentId, studentId),
            eq(schema.studentSubjectAssignments.classId, classId),
            eq(schema.studentSubjectAssignments.isActive, true)
          ));
        
        let assignedSubjectIds: number[] = [];
        
        if (studentSubjectAssignments.length > 0) {
          assignedSubjectIds = studentSubjectAssignments.map((a: { subjectId: number }) => a.subjectId);
        } else {
          const relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
          assignedSubjectIds = relevantSubjects.map(s => s.id);
        }
        
        // Find and add missing subjects
        const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));
        
        if (missingSubjectIds.length > 0) {
          console.log(`[REPORT-CARD-SYNC] Adding ${missingSubjectIds.length} missing subjects to existing report card ${reportCardId} for student ${studentId}`);
          
          for (const missingSubjectId of missingSubjectIds) {
            await db.insert(schema.reportCardItems)
              .values({
                reportCardId,
                subjectId: missingSubjectId,
                totalMarks: 100,
                obtainedMarks: 0,
                percentage: 0
              });
          }
        }
      }

      // 4. Find the report card item for this subject
      let reportCardItem = await db.select()
        .from(schema.reportCardItems)
        .where(and(
          eq(schema.reportCardItems.reportCardId, reportCardId),
          eq(schema.reportCardItems.subjectId, subjectId)
        ))
        .limit(1);

      // Create item if not exists
      if (reportCardItem.length === 0) {
        const newItem = await db.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .returning();
        reportCardItem = newItem;
      }

      // 5. Skip if manually overridden
      if (reportCardItem[0].isOverridden) {
        console.log(`[REPORT-CARD-SYNC] Item ${reportCardItem[0].id} is manually overridden, skipping auto-update`);
        return { success: true, reportCardId, message: 'Skipped - item manually overridden' };
      }

      // 6. Determine if this is a test or exam and update accordingly
      const isTest = ['test', 'quiz', 'assignment'].includes(examType);
      const isMainExam = ['exam', 'final', 'midterm'].includes(examType);

      // CRITICAL: Ensure all values are proper JavaScript numbers to avoid PostgreSQL type conversion errors
      const safeScore = typeof score === 'number' ? score : parseInt(String(score), 10) || 0;
      const safeMaxScore = typeof maxScore === 'number' ? maxScore : parseInt(String(maxScore), 10) || 0;
      const safeExamId = typeof examId === 'number' ? examId : parseInt(String(examId), 10);
      
      console.log(`[REPORT-CARD-SYNC] Type-safe values: score=${safeScore}, maxScore=${safeMaxScore}, examId=${safeExamId}, examType=${examType}`);

      const updateData: any = {
        updatedAt: new Date()
      };

      if (isTest) {
        updateData.testExamId = safeExamId;
        updateData.testExamCreatedBy = examCreatedBy; // Store which teacher created this test
        updateData.testScore = safeScore;
        updateData.testMaxScore = safeMaxScore;
      } else if (isMainExam) {
        updateData.examExamId = safeExamId;
        updateData.examExamCreatedBy = examCreatedBy; // Store which teacher created this exam
        updateData.examScore = safeScore;
        updateData.examMaxScore = safeMaxScore;
      } else {
        // Default to test if type is unknown
        updateData.testExamId = safeExamId;
        updateData.testExamCreatedBy = examCreatedBy;
        updateData.testScore = safeScore;
        updateData.testMaxScore = safeMaxScore;
      }

      // 7. Calculate weighted score with existing scores
      const existingItem = reportCardItem[0];
      const finalTestScore = isTest ? safeScore : (existingItem.testScore ?? null);
      const finalTestMaxScore = isTest ? safeMaxScore : (existingItem.testMaxScore ?? null);
      const finalExamScore = isMainExam ? safeScore : (existingItem.examScore ?? null);
      const finalExamMaxScore = isMainExam ? safeMaxScore : (existingItem.examMaxScore ?? null);

      // CRITICAL: Convert gradingScale string to GradingConfig object
      const gradingConfig = getGradingConfig(gradingScale);
      const weighted = calculateWeightedScore(finalTestScore, finalTestMaxScore, finalExamScore, finalExamMaxScore, gradingConfig);
      const gradeInfo = calculateGrade(weighted.percentage, gradingScale);

      // CRITICAL: Ensure all weighted values are finite integers, defaulting to 0 for NaN/Infinity
      const safeTestWeighted = Number.isFinite(weighted.testWeighted) ? Math.round(weighted.testWeighted) : 0;
      const safeExamWeighted = Number.isFinite(weighted.examWeighted) ? Math.round(weighted.examWeighted) : 0;
      const safeObtainedMarks = Number.isFinite(weighted.weightedScore) ? Math.round(weighted.weightedScore) : 0;
      const safePercentage = Number.isFinite(weighted.percentage) ? Math.round(weighted.percentage) : 0;

      updateData.testWeightedScore = safeTestWeighted;
      updateData.examWeightedScore = safeExamWeighted;
      updateData.obtainedMarks = safeObtainedMarks;
      updateData.percentage = safePercentage;
      updateData.grade = gradeInfo.grade;
      updateData.remarks = gradeInfo.remarks;
      
      console.log(`[REPORT-CARD-SYNC] Update data: testWeighted=${safeTestWeighted}, examWeighted=${safeExamWeighted}, obtained=${safeObtainedMarks}, pct=${safePercentage}, grade=${gradeInfo.grade}`);

      // 8. Update the report card item
      await db.update(schema.reportCardItems)
        .set(updateData)
        .where(eq(schema.reportCardItems.id, existingItem.id));

      console.log(`[REPORT-CARD-SYNC] Updated report card item ${existingItem.id} with ${isTest ? 'test' : 'exam'} score: ${score}/${maxScore}, grade: ${gradeInfo.grade}`);

      // 9. Recalculate report card totals
      await this.recalculateReportCard(reportCardId, gradingScale);

      // 10. Recalculate class positions
      await this.recalculateClassPositions(classId, termId);

      console.log(`[REPORT-CARD-SYNC] Successfully synced exam ${examId} to report card ${reportCardId} (new: ${isNewReportCard})`);

      return { 
        success: true, 
        reportCardId,
        isNewReportCard,
        message: isNewReportCard 
          ? `New report card auto-created. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)`
          : `Score synced to report card. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)` 
      };
    } catch (error: any) {
      console.error('[REPORT-CARD-SYNC] Error syncing exam score to report card:', error);
      return { success: false, message: error.message || 'Failed to sync score to report card' };
    }
  }

  // Get report cards accessible by a specific teacher (only subjects where they created exams)
  // This allows teachers to see and edit only the subjects where they created the test or main exam
  async getTeacherAccessibleReportCards(teacherId: string, termId?: number, classId?: number): Promise<any[]> {
    try {
      // Build conditions for filtering
      const conditions: any[] = [
        or(
          eq(schema.reportCardItems.testExamCreatedBy, teacherId),
          eq(schema.reportCardItems.examExamCreatedBy, teacherId)
        )
      ];

      if (termId) {
        conditions.push(eq(schema.reportCards.termId, termId));
      }
      if (classId) {
        conditions.push(eq(schema.reportCards.classId, classId));
      }

      // Get all report card items where teacher created the test or main exam
      const items = await db.select({
        itemId: schema.reportCardItems.id,
        reportCardId: schema.reportCardItems.reportCardId,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        totalMarks: schema.reportCardItems.totalMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        remarks: schema.reportCardItems.remarks,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        testExamCreatedBy: schema.reportCardItems.testExamCreatedBy,
        examExamCreatedBy: schema.reportCardItems.examExamCreatedBy,
        overriddenBy: schema.reportCardItems.overriddenBy,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        status: schema.reportCards.status,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        admissionNumber: schema.students.admissionNumber,
        className: schema.classes.name,
        termName: schema.academicTerms.name,
        canEditTest: sql<boolean>`CASE WHEN ${schema.reportCardItems.testExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as('canEditTest'),
        canEditExam: sql<boolean>`CASE WHEN ${schema.reportCardItems.examExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as('canEditExam')
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .innerJoin(schema.academicTerms, eq(schema.reportCards.termId, schema.academicTerms.id))
        .where(and(...conditions))
        .orderBy(desc(schema.reportCards.id), schema.subjects.name);

      // Group items by report card for easier frontend consumption
      const reportCardMap = new Map<number, any>();
      
      for (const item of items) {
        if (!reportCardMap.has(item.reportCardId)) {
          reportCardMap.set(item.reportCardId, {
            reportCardId: item.reportCardId,
            studentId: item.studentId,
            studentName: item.studentName,
            admissionNumber: item.admissionNumber,
            classId: item.classId,
            className: item.className,
            termId: item.termId,
            termName: item.termName,
            status: item.status,
            items: []
          });
        }
        
        reportCardMap.get(item.reportCardId)!.items.push({
          itemId: item.itemId,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          testScore: item.testScore,
          testMaxScore: item.testMaxScore,
          examScore: item.examScore,
          examMaxScore: item.examMaxScore,
          testWeightedScore: item.testWeightedScore,
          examWeightedScore: item.examWeightedScore,
          obtainedMarks: item.obtainedMarks,
          totalMarks: item.totalMarks,
          percentage: item.percentage,
          grade: item.grade,
          remarks: item.remarks,
          teacherRemarks: item.teacherRemarks,
          canEditTest: item.canEditTest,
          canEditExam: item.canEditExam
        });
      }

      return Array.from(reportCardMap.values());
    } catch (error) {
      console.error('Error getting teacher accessible report cards:', error);
      return [];
    }
  }

  // Analytics and Reports
  async getAnalyticsOverview(): Promise<any> {
    try {
      // Get basic counts - ONLY counting ACTIVE users for consistency with management pages
      // Role IDs: 1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent
      const [students, teachers, admins, parents] = await Promise.all([
        db.select().from(schema.users).where(and(eq(schema.users.roleId, 4), eq(schema.users.isActive, true))), // Active Students only
        db.select().from(schema.users).where(and(eq(schema.users.roleId, 3), eq(schema.users.isActive, true))), // Active Teachers only
        db.select().from(schema.users).where(and(eq(schema.users.roleId, 2), eq(schema.users.isActive, true))), // Active Admins only
        db.select().from(schema.users).where(and(eq(schema.users.roleId, 5), eq(schema.users.isActive, true)))  // Active Parents only
      ]);

      const [classes, subjects, exams, examResults] = await Promise.all([
        db.select().from(schema.classes).where(eq(schema.classes.isActive, true)), // Active classes only
        db.select().from(schema.subjects).where(eq(schema.subjects.isActive, true)), // Active subjects only
        db.select().from(schema.exams),
        db.select().from(schema.examResults)
      ]);

      // Calculate grade distribution
      const gradeDistribution = this.calculateGradeDistribution(examResults);

      // Calculate average scores by subject
      const subjectPerformance = await this.calculateSubjectPerformance(examResults, subjects);

      return {
        totalUsers: students.length + teachers.length + admins.length + parents.length,
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalAdmins: admins.length,
        totalParents: parents.length,
        totalClasses: classes.length,
        totalSubjects: subjects.length,
        totalExams: exams.length,
        totalExamResults: examResults.length,
        averageClassSize: classes.length > 0 ? Math.round(students.length / classes.length) : 0,
        gradeDistribution,
        subjectPerformance,
        recentActivity: {
          newStudentsThisMonth: students.filter((s: any) =>
            s.createdAt && new Date(s.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length,
          examsThisMonth: exams.filter((e: any) =>
            e.createdAt && new Date(e.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length
        }
      };
    } catch (error) {
      return this.getFallbackAnalytics();
    }
  }

  async getPerformanceAnalytics(filters: any): Promise<any> {
    try {
      let examResults = await db.select().from(schema.examResults);

      // Apply filters
      if (filters.classId) {
        const studentsInClass = await db.select().from(schema.students)
          .where(eq(schema.students.classId, filters.classId));
        const studentIds = studentsInClass.map((s: any) => s.id);
        examResults = examResults.filter((r: any) => studentIds.includes(r.studentId));
      }
      if (filters.subjectId) {
        const examsForSubject = await db.select().from(schema.exams)
          .where(eq(schema.exams.subjectId, filters.subjectId));
        const examIds = examsForSubject.map((e: any) => e.id);
        examResults = examResults.filter((r: any) => examIds.includes(r.examId));
      }
      // Calculate performance metrics
      const totalExams = examResults.length;
      const averageScore = totalExams > 0 ?
        examResults.reduce((sum: any, r: any) => sum + (r.marksObtained || 0), 0) / totalExams : 0;

      const gradeDistribution = this.calculateGradeDistribution(examResults);

      // Performance trends by month
      const performanceTrends = this.calculatePerformanceTrends(examResults);

      // Top and bottom performers
      const studentPerformance = this.calculateStudentPerformance(examResults);

      return {
        totalExams,
        averageScore: Math.round(averageScore * 100) / 100,
        averagePercentage: Math.round((averageScore / 100) * 100), // Assuming 100 is typical total marks
        gradeDistribution,
        performanceTrends,
        topPerformers: studentPerformance.slice(0, 5),
        strugglingStudents: studentPerformance.slice(-5),
        passRate: Math.round((examResults.filter((r: any) => (r.marksObtained || 0) >= 50).length / totalExams) * 100)
      };
    } catch (error) {
      return { error: 'Failed to calculate performance analytics' };
    }
  }

  async getTrendAnalytics(months: number = 6): Promise<any> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // Get data for the specified time period
      // Role IDs: 1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent
      const [students, exams, examResults] = await Promise.all([
        db.select().from(schema.users)
          .where(and(
            eq(schema.users.roleId, 4), // Student
            // Note: In a real implementation, you'd filter by createdAt >= cutoffDate
          )),
        db.select().from(schema.exams),
        db.select().from(schema.examResults)
      ]);

      // Generate monthly trends (simplified for demo)
      const monthlyData = [];
      for (let i = months - 1; i >= 0; i--) {
        const month = new Date();
        month.setMonth(month.getMonth() - i);

        const monthName = month.toLocaleString('default', { month: 'short' });
        const year = month.getFullYear();

        monthlyData.push({
          month: monthName,
          year,
          students: students.length + Math.floor(Math.random() * 10) - 5, // Simulated variance
          exams: Math.floor(exams.length / months) + Math.floor(Math.random() * 3),
          averageScore: 75 + Math.floor(Math.random() * 20) - 10,
          attendance: 85 + Math.floor(Math.random() * 15),
        });
      }
      return {
        monthlyTrends: monthlyData,
        summary: {
          studentsGrowth: monthlyData.length > 1 ?
            ((monthlyData[monthlyData.length - 1].students - monthlyData[0].students) / monthlyData[0].students * 100).toFixed(1) : 0,
          examsTrend: 'stable',
          scoresTrend: 'improving',
          attendanceTrend: 'stable'
        }
      };
    } catch (error) {
      return { error: 'Failed to calculate trend analytics' };
    }
  }

  async getAttendanceAnalytics(filters: any): Promise<any> {
    try {
      let attendance: Attendance[] = await db.select().from(schema.attendance);

      // Apply filters
      if (filters.classId) {
        const studentsInClass = await db.select().from(schema.students)
          .where(eq(schema.students.classId, filters.classId));
        const studentIds = studentsInClass.map((s: any) => s.id);
        attendance = attendance.filter((a: any) => studentIds.includes(a.studentId));
      }
      if (filters.startDate && filters.endDate) {
        attendance = attendance.filter(a => {
          const attendanceDate = new Date(a.date);
          return attendanceDate >= new Date(filters.startDate) &&
                 attendanceDate <= new Date(filters.endDate);
        });
      }
      // Calculate attendance metrics
      const totalRecords = attendance.length;
      const presentCount = attendance.filter(a => a.status === 'Present').length;
      const absentCount = attendance.filter(a => a.status === 'Absent').length;
      const lateCount = attendance.filter(a => a.status === 'Late').length;
      const excusedCount = attendance.filter(a => a.status === 'Excused').length;

      const attendanceRate = totalRecords > 0 ?
        Math.round((presentCount / totalRecords) * 100) : 0;

      return {
        totalRecords,
        attendanceRate,
        statusBreakdown: {
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount
        },
        dailyTrends: this.calculateDailyAttendanceTrends(attendance),
        classComparison: await this.calculateClassAttendanceComparison()
      };
    } catch (error) {
      return { error: 'Failed to calculate attendance analytics' };
    }
  }

  private calculateGradeDistribution(examResults: any[]): any {
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    examResults.forEach(result => {
      const percentage = (result.obtainedMarks / result.totalMarks) * 100;
      if (percentage >= 90) grades.A++;
      else if (percentage >= 80) grades.B++;
      else if (percentage >= 70) grades.C++;
      else if (percentage >= 60) grades.D++;
      else grades.F++;
    });

    return Object.entries(grades).map(([grade, count]) => ({ grade, count }));
  }
  private async calculateSubjectPerformance(examResults: any[], subjects: any[]): Promise<any[]> {
    const subjectMap = new Map();
    subjects.forEach(s => subjectMap.set(s.id, s.name));

    const performance = new Map();
    examResults.forEach(result => {
      const examSubject = result.examId; // Would need to join with exams table in real implementation
      if (!performance.has(examSubject)) {
        performance.set(examSubject, { total: 0, count: 0 });
      }
      const current = performance.get(examSubject);
      current.total += result.obtainedMarks;
      current.count += 1;
    });

    return Array.from(performance.entries()).map(([subjectId, data]) => ({
      subject: subjectMap.get(subjectId) || 'Unknown',
      average: Math.round((data.total / data.count) * 100) / 100,
      examCount: data.count
    }));
  }
  private calculatePerformanceTrends(examResults: any[]): any[] {
    // Simplified trend calculation - group by month
    const trends = new Map();
    examResults.forEach(result => {
      const month = new Date(result.createdAt).toLocaleString('default', { month: 'short' });
      if (!trends.has(month)) {
        trends.set(month, { total: 0, count: 0 });
      }
      const current = trends.get(month);
      current.total += result.obtainedMarks;
      current.count += 1;
    });

    return Array.from(trends.entries()).map(([month, data]) => ({
      month,
      average: Math.round((data.total / data.count) * 100) / 100
    }));
  }
  private calculateStudentPerformance(examResults: any[]): any[] {
    const performance = new Map();
    examResults.forEach(result => {
      if (!performance.has(result.studentId)) {
        performance.set(result.studentId, { total: 0, count: 0 });
      }
      const current = performance.get(result.studentId);
      current.total += result.obtainedMarks;
      current.count += 1;
    });

    return Array.from(performance.entries())
      .map(([studentId, data]) => ({
        studentId,
        average: Math.round((data.total / data.count) * 100) / 100,
        examCount: data.count
      }))
      .sort((a, b) => b.average - a.average);
  }
  private calculateDailyAttendanceTrends(attendance: any[]): any[] {
    const trends = new Map();
    attendance.forEach(record => {
      const date = record.date;
      if (!trends.has(date)) {
        trends.set(date, { present: 0, total: 0 });
      }
      const current = trends.get(date);
      current.total += 1;
      if (record.status === 'Present') current.present += 1;
    });

    return Array.from(trends.entries()).map(([date, data]) => ({
      date,
      rate: Math.round((data.present / data.total) * 100)
    }));
  }
  private async calculateClassAttendanceComparison(): Promise<any[]> {
    try {
      const classes: Class[] = await db.select().from(schema.classes);
      return classes.map(cls => ({
        className: cls.name,
        attendanceRate: 85 + Math.floor(Math.random() * 15), // Simplified for demo
        level: cls.level
      }));
    } catch (error) {
      return [];
    }
  }

  private getFallbackAnalytics(): any {
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalTeachers: 0,
      totalClasses: 0,
      totalSubjects: 0,
      error: 'Unable to calculate analytics - database unavailable'
    };
  }
  // Contact messages management - ensuring 100% database persistence
  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    const result = await this.db.insert(schema.contactMessages).values(message).returning();
    return result[0];
  }
  async getContactMessages(): Promise<ContactMessage[]> {
    return await this.db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt));
  }

  async getFinalizedReportsByExams(examIds: number[], filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
  }): Promise<any[]> {
    try {
      // This would be a complex query joining exam results with exams, students, and subjects
      // For now, return a simplified version
      const results = await this.db.select().from(schema.examResults)
        .where(and(
          inArray(schema.examResults.examId, examIds),
          // Add teacherFinalized field check when column exists
          // eq(schema.examResults.teacherFinalized, true)
        ))
        .orderBy(desc(schema.examResults.createdAt));

      return results;
    } catch (error) {
      return [];
    }
  }

  async getAllFinalizedReports(filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
  }): Promise<any[]> {
    try {
      // This would be a complex query for admins to see all finalized reports
      const results = await this.db.select().from(schema.examResults)
        .orderBy(desc(schema.examResults.createdAt));

      return results;
    } catch (error) {
      return [];
    }
  }

  async getContactMessageById(id: number): Promise<ContactMessage | undefined> {
    const result = await this.db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, id)).limit(1);
    return result[0];
  }
  async markContactMessageAsRead(id: number): Promise<boolean> {
    const result = await this.db.update(schema.contactMessages)
      .set({ isRead: true })
      .where(eq(schema.contactMessages.id, id))
      .returning();
    return result.length > 0;
  }
  async respondToContactMessage(id: number, response: string, respondedBy: string): Promise<ContactMessage | undefined> {
    const result = await this.db.update(schema.contactMessages)
      .set({
        response,
        respondedBy,
        respondedAt: new Date(),
        isRead: true
      })
      .where(eq(schema.contactMessages.id, id))
      .returning();
    return result[0];
  }
  // Performance monitoring implementation
  async logPerformanceEvent(event: InsertPerformanceEvent): Promise<PerformanceEvent> {
    const result = await this.db.insert(schema.performanceEvents).values(event).returning();
    return result[0];
  }
  async getPerformanceMetrics(hours: number = 24): Promise<{
    totalEvents: number;
    goalAchievementRate: number;
    averageDuration: number;
    slowSubmissions: number;
    eventsByType: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const sinceISO = since.toISOString();

      const events = await this.db.select()
        .from(schema.performanceEvents)
        .where(sql`${schema.performanceEvents.createdAt} >= ${sinceISO}`);

      const totalEvents = events.length;
      const goalAchievedCount = events.filter((e: PerformanceEvent) => e.goalAchieved).length;
      const goalAchievementRate = totalEvents > 0 ? (goalAchievedCount / totalEvents) * 100 : 0;

      const averageDuration = totalEvents > 0
        ? events.reduce((sum: number, e: PerformanceEvent) => sum + e.duration, 0) / totalEvents
        : 0;

      const slowSubmissions = events.filter((e: PerformanceEvent) => e.duration > 2000).length;

      const eventsByType: Record<string, number> = {};
      events.forEach((e: PerformanceEvent) => {
        eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
      });

      return {
        totalEvents,
        goalAchievementRate: Math.round(goalAchievementRate * 100) / 100,
        averageDuration: Math.round(averageDuration),
        slowSubmissions,
        eventsByType
      };
    } catch (error) {
      // Return a default structure to prevent errors downstream
      return {
        totalEvents: 0,
        goalAchievementRate: 0,
        averageDuration: 0,
        slowSubmissions: 0,
        eventsByType: {},
      };
    }
  }

  async getRecentPerformanceAlerts(hours: number = 24): Promise<PerformanceEvent[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const sinceISO = since.toISOString();

      const alerts = await this.db.select()
        .from(schema.performanceEvents)
        .where(and(
          sql`${schema.performanceEvents.createdAt} >= ${sinceISO}`,
          eq(schema.performanceEvents.goalAchieved, false)
        ))
        .orderBy(desc(schema.performanceEvents.createdAt))
        .limit(50);
      return alerts;
    } catch (error) {
      return [];
    }
  }

  // Teacher class assignments implementation
  async createTeacherClassAssignment(assignment: InsertTeacherClassAssignment): Promise<TeacherClassAssignment> {
    const result = await this.db.insert(schema.teacherClassAssignments).values(assignment).returning();
    return result[0];
  }
  async getTeacherClassAssignments(teacherId: string): Promise<TeacherClassAssignment[]> {
    return await this.db.select()
      .from(schema.teacherClassAssignments)
      .where(and(
        eq(schema.teacherClassAssignments.teacherId, teacherId),
        eq(schema.teacherClassAssignments.isActive, true)
      ))
      .orderBy(schema.teacherClassAssignments.createdAt);
  }
  async getTeachersForClassSubject(classId: number, subjectId: number): Promise<User[]> {
    const assignments = await this.db.select({
      user: schema.users
    })
      .from(schema.teacherClassAssignments)
      .innerJoin(schema.users, eq(schema.teacherClassAssignments.teacherId, schema.users.id))
      .where(and(
        eq(schema.teacherClassAssignments.classId, classId),
        eq(schema.teacherClassAssignments.subjectId, subjectId),
        eq(schema.teacherClassAssignments.isActive, true)
      ));

    return assignments.map((a: any) => a.user);
  }
  async updateTeacherClassAssignment(id: number, assignment: Partial<InsertTeacherClassAssignment>): Promise<TeacherClassAssignment | undefined> {
    const result = await this.db.update(schema.teacherClassAssignments)
      .set(assignment)
      .where(eq(schema.teacherClassAssignments.id, id))
      .returning();
    return result[0];
  }
  async deleteTeacherClassAssignment(id: number): Promise<boolean> {
    const result = await this.db.delete(schema.teacherClassAssignments)
      .where(eq(schema.teacherClassAssignments.id, id))
      .returning();
    return result.length > 0;
  }

  async getTeacherAssignmentsForClass(teacherId: string, classId: number): Promise<Array<{ subjectId: number; subjectName: string }>> {
    try {
      const now = new Date();
      const assignments = await this.db.select({
        subjectId: schema.teacherClassAssignments.subjectId,
        subjectName: schema.subjects.name
      })
        .from(schema.teacherClassAssignments)
        .innerJoin(schema.subjects, eq(schema.teacherClassAssignments.subjectId, schema.subjects.id))
        .where(and(
          eq(schema.teacherClassAssignments.teacherId, teacherId),
          eq(schema.teacherClassAssignments.classId, classId),
          eq(schema.teacherClassAssignments.isActive, true),
          or(
            isNull(schema.teacherClassAssignments.validUntil),
            gte(schema.teacherClassAssignments.validUntil, now)
          )
        ));
      return assignments;
    } catch (error) {
      console.error('Error getting teacher assignments for class:', error);
      return [];
    }
  }

  // Teacher timetable implementation
  async createTimetableEntry(entry: InsertTimetable): Promise<Timetable> {
    const result = await this.db.insert(schema.timetable).values(entry).returning();
    return result[0];
  }
  async getTimetableByTeacher(teacherId: string, termId?: number): Promise<Timetable[]> {
    const conditions = [
      eq(schema.timetable.teacherId, teacherId),
      eq(schema.timetable.isActive, true)
    ];

    if (termId) {
      conditions.push(eq(schema.timetable.termId, termId));
    }
    return await this.db.select()
      .from(schema.timetable)
      .where(and(...conditions))
      .orderBy(schema.timetable.dayOfWeek, schema.timetable.startTime);
  }
  async updateTimetableEntry(id: number, entry: Partial<InsertTimetable>): Promise<Timetable | undefined> {
    const result = await this.db.update(schema.timetable)
      .set(entry)
      .where(eq(schema.timetable.id, id))
      .returning();
    return result[0];
  }
  async deleteTimetableEntry(id: number): Promise<boolean> {
    const result = await this.db.delete(schema.timetable)
      .where(eq(schema.timetable.id, id))
      .returning();
    return result.length > 0;
  }
  // Teacher dashboard data - comprehensive method
  async getTeacherDashboardData(teacherId: string): Promise<{
    profile: TeacherProfile | undefined;
    user: User | undefined;
    assignments: Array<{
      id: number;
      className: string;
      subjectName: string;
      subjectCode: string;
      classLevel: string;
      termName?: string;
    }>;
    timetable: Array<{
      id: number;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      className: string;
      subjectName: string;
      location: string | null;
    }>;
  }> {
    const profile = await this.getTeacherProfile(teacherId);
    const user = await this.getUser(teacherId);

    const assignmentsData = await this.db.select({
      id: schema.teacherClassAssignments.id,
      className: schema.classes.name,
      classLevel: schema.classes.level,
      subjectName: schema.subjects.name,
      subjectCode: schema.subjects.code,
      termName: schema.academicTerms.name,
    })
      .from(schema.teacherClassAssignments)
      .innerJoin(schema.classes, eq(schema.teacherClassAssignments.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.teacherClassAssignments.subjectId, schema.subjects.id))
      .leftJoin(schema.academicTerms, eq(schema.teacherClassAssignments.termId, schema.academicTerms.id))
      .where(and(
        eq(schema.teacherClassAssignments.teacherId, teacherId),
        eq(schema.teacherClassAssignments.isActive, true)
      ))
      .orderBy(schema.classes.name, schema.subjects.name);

    const timetableData = await this.db.select({
      id: schema.timetable.id,
      dayOfWeek: schema.timetable.dayOfWeek,
      startTime: schema.timetable.startTime,
      endTime: schema.timetable.endTime,
      location: schema.timetable.location,
      className: schema.classes.name,
      subjectName: schema.subjects.name,
    })
      .from(schema.timetable)
      .innerJoin(schema.classes, eq(schema.timetable.classId, schema.classes.id))
      .innerJoin(schema.subjects, eq(schema.timetable.subjectId, schema.subjects.id))
      .where(and(
        eq(schema.timetable.teacherId, teacherId),
        eq(schema.timetable.isActive, true)
      ))
      .orderBy(schema.timetable.dayOfWeek, schema.timetable.startTime);

    return {
      profile,
      user,
      assignments: assignmentsData,
      timetable: timetableData,
    };
  }
  // Manual grading task queue
  async createGradingTask(task: InsertGradingTask): Promise<GradingTask> {
    try {
      const result = await this.db.insert(schema.gradingTasks).values(task).returning();
      return result[0];
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return { id: 0, ...task } as GradingTask;
      }
      throw error;
    }
  }

  async assignGradingTask(taskId: number, teacherId: string): Promise<GradingTask | undefined> {
    try {
      const result = await this.db.update(schema.gradingTasks)
        .set({
          assignedTeacherId: teacherId,
          assignedAt: new Date(),
          status: 'in_progress'
        })
        .where(eq(schema.gradingTasks.id, taskId))
        .returning();
      return result[0];
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  async getGradingTasksByTeacher(teacherId: string, status?: string): Promise<GradingTask[]> {
    try {
      let query = this.db.select().from(schema.gradingTasks)
        .where(eq(schema.gradingTasks.assignedTeacherId, teacherId))
        .orderBy(desc(schema.gradingTasks.priority), asc(schema.gradingTasks.createdAt));

      if (status) {
        query = query.where(and(
          eq(schema.gradingTasks.assignedTeacherId, teacherId),
          eq(schema.gradingTasks.status, status)
        ));
      }
      return await query;
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async getGradingTasksBySession(sessionId: number): Promise<GradingTask[]> {
    try {
      return await this.db.select().from(schema.gradingTasks)
        .where(eq(schema.gradingTasks.sessionId, sessionId))
        .orderBy(desc(schema.gradingTasks.priority), asc(schema.gradingTasks.createdAt));
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  async updateGradingTaskStatus(taskId: number, status: string, completedAt?: Date): Promise<GradingTask | undefined> {
    try {
      const updateData: any = { status };
      if (completedAt) {
        updateData.completedAt = completedAt;
      }
      const result = await this.db.update(schema.gradingTasks)
        .set(updateData)
        .where(eq(schema.gradingTasks.id, taskId))
        .returning();
      return result[0];
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  async completeGradingTask(taskId: number, pointsEarned: number, feedbackText?: string): Promise<{ task: GradingTask; answer: StudentAnswer } | undefined> {
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // Get the task
      const tasks = await this.db.select().from(schema.gradingTasks)
        .where(eq(schema.gradingTasks.id, taskId))
        .limit(1);

      if (tasks.length === 0) {
        return undefined;
      }
      const task = tasks[0];

      // Update the student answer
      const answers = await this.db.update(schema.studentAnswers)
        .set({
          pointsEarned,
          feedbackText,
          autoScored: false,
          manualOverride: true
        })
        .where(eq(schema.studentAnswers.id, task.answerId))
        .returning();

      // Mark task as completed
      const updatedTasks = await this.db.update(schema.gradingTasks)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(schema.gradingTasks.id, taskId))
        .returning();

      return {
        task: updatedTasks[0],
        answer: answers[0]
      };
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  // Audit logging implementation
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await this.db.insert(schema.auditLogs).values(log).returning();
    return result[0];
  }
  async getAuditLogs(filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(schema.auditLogs.userId, filters.userId));
    }
    if (filters?.entityType) {
      conditions.push(eq(schema.auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(schema.auditLogs.entityId, filters.entityId));
    }
    if (filters?.action) {
      conditions.push(eq(schema.auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(dsql`${schema.auditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(dsql`${schema.auditLogs.createdAt} <= ${filters.endDate}`);
    }
    let query = this.db.select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    return await query;
  }
  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await this.db.select()
      .from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entityType, entityType),
        eq(schema.auditLogs.entityId, entityId)
      ))
      .orderBy(desc(schema.auditLogs.createdAt));
  }
  // Notification management implementation
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await this.db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }
  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await this.db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }
  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await this.db.select({ count: dsql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
    return result[0]?.count || 0;
  }
  async markNotificationAsRead(notificationId: number): Promise<Notification | undefined> {
    const result = await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, notificationId))
      .returning();
    return result[0];
  }
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
  }
  // Password reset attempt tracking for rate limiting
  async createPasswordResetAttempt(identifier: string, ipAddress: string, success: boolean): Promise<any> {
    const result = await this.db.insert(schema.passwordResetAttempts).values({
      identifier,
      ipAddress,
      success,
    }).returning();
    return result[0];
  }
  async getRecentPasswordResetAttempts(identifier: string, minutesAgo: number): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return await this.db.select()
      .from(schema.passwordResetAttempts)
      .where(and(
        eq(schema.passwordResetAttempts.identifier, identifier),
        dsql`${schema.passwordResetAttempts.attemptedAt} > ${cutoffTime}`
      ))
      .orderBy(desc(schema.passwordResetAttempts.attemptedAt));
  }
  async deleteOldPasswordResetAttempts(hoursAgo: number): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    await this.db.delete(schema.passwordResetAttempts)
      .where(dsql`${schema.passwordResetAttempts.attemptedAt} < ${cutoffTime}`);
    return true;
  }
  // Account security methods
  async lockAccount(userId: string, lockUntil: Date): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({ accountLockedUntil: lockUntil })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }
  async unlockAccount(userId: string): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({ accountLockedUntil: null })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }
  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.db.select({ accountLockedUntil: schema.users.accountLockedUntil })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].accountLockedUntil) {
      return false;
    }
    return new Date(user[0].accountLockedUntil) > new Date();
  }
  // Admin recovery powers
  async adminResetUserPassword(userId: string, newPasswordHash: string, resetBy: string, forceChange: boolean): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({
        passwordHash: newPasswordHash,
        mustChangePassword: forceChange
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length > 0) {
      await this.createAuditLog({
        userId: resetBy,
        action: 'admin_password_reset',
        entityType: 'user',
        entityId: '0',
        oldValue: null,
        newValue: JSON.stringify({ targetUserId: userId, forceChange }),
        reason: 'Admin initiated password reset',
        ipAddress: null,
        userAgent: null,
      });
    }
    return result.length > 0;
  }
  async updateRecoveryEmail(userId: string, recoveryEmail: string, updatedBy: string): Promise<boolean> {
    const oldUser = await this.getUser(userId);
    const result = await this.db.update(schema.users)
      .set({ recoveryEmail })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length > 0) {
      await this.createAuditLog({
        userId: updatedBy,
        action: 'recovery_email_updated',
        entityType: 'user',
        entityId: '0',
        oldValue: oldUser?.recoveryEmail || null,
        newValue: recoveryEmail,
        reason: 'Recovery email updated by admin',
        ipAddress: null,
        userAgent: null,
      });
    }
    return result.length > 0;
  }
  // NEW METHODS FOR EXAM PUBLISHING
  async getScheduledExamsToPublish(now: Date): Promise<Exam[]> {
    // Convert Date to ISO string for PostgreSQL compatibility
    const nowISO = now.toISOString();
    return await this.db
      .select()
      .from(schema.exams)
      .where(
        and(
          eq(schema.exams.isPublished, false),
          dsql`${schema.exams.startTime} <= ${nowISO}`,
          eq(schema.exams.timerMode, 'global') // Only publish global timer exams automatically
        )
      )
      .limit(50);
  }
  // Settings management methods (Module 1)
  async getSetting(key: string): Promise<any | undefined> {
    const result = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);
    return result[0];
  }
  async getAllSettings(): Promise<any[]> {
    return await this.db
      .select()
      .from(schema.settings)
      .orderBy(asc(schema.settings.key));
  }
  async createSetting(setting: any): Promise<any> {
    const result = await this.db
      .insert(schema.settings)
      .values(setting)
      .returning();
    return result[0];
  }
  async updateSetting(key: string, value: string, updatedBy: string): Promise<any | undefined> {
    const result = await this.db
      .update(schema.settings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(schema.settings.key, key))
      .returning();
    return result[0];
  }
  async deleteSetting(key: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.settings)
      .where(eq(schema.settings.key, key))
      .returning();
    return result.length > 0;
  }
  // Counters for atomic sequence generation (Module 1)
  async getNextSequence(classCode: string, year: string): Promise<number> {
    // Use PostgreSQL's UPSERT with atomic increment to prevent race conditions
    const result = await this.db
      .insert(schema.counters)
      .values({
        classCode,
        year,
        sequence: 1
      })
      .onConflictDoUpdate({
        target: [schema.counters.classCode, schema.counters.year],
        set: {
          sequence: dsql`${schema.counters.sequence} + 1`,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return result[0].sequence;
  }
  async getCounter(classCode: string, year: string): Promise<any | undefined> {
    const result = await this.db
      .select()
      .from(schema.counters)
      .where(
        and(
          eq(schema.counters.classCode, classCode),
          eq(schema.counters.year, year)
        )
      )
      .limit(1);
    return result[0];
  }
  async resetCounter(classCode: string, year: string): Promise<boolean> {
    const result = await this.db
      .update(schema.counters)
      .set({ sequence: 0, updatedAt: new Date() })
      .where(
        and(
          eq(schema.counters.classCode, classCode),
          eq(schema.counters.year, year)
        )
      )
      .returning();
    return result.length > 0;
  }
  // Job Vacancy System implementations
  async createVacancy(vacancy: InsertVacancy): Promise<Vacancy> {
    const result = await this.db.insert(schema.vacancies).values(vacancy).returning();
    return result[0];
  }
  async getVacancy(id: string): Promise<Vacancy | undefined> {
    const result = await this.db.select().from(schema.vacancies).where(eq(schema.vacancies.id, id)).limit(1);
    return result[0];
  }
  async getAllVacancies(status?: string): Promise<Vacancy[]> {
    if (status) {
      return await this.db.select().from(schema.vacancies).where(eq(schema.vacancies.status, status as "open" | "closed" | "filled")).orderBy(desc(schema.vacancies.createdAt));
    }
    return await this.db.select().from(schema.vacancies).orderBy(desc(schema.vacancies.createdAt));
  }
  async updateVacancy(id: string, updates: Partial<InsertVacancy>): Promise<Vacancy | undefined> {
    const result = await this.db
      .update(schema.vacancies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.vacancies.id, id))
      .returning();
    return result[0];
  }
  async deleteVacancy(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.vacancies).where(eq(schema.vacancies.id, id)).returning();
    return result.length > 0;
  }
  // Teacher Applications implementations
  async createTeacherApplication(application: InsertTeacherApplication): Promise<TeacherApplication> {
    const result = await this.db.insert(schema.teacherApplications).values(application).returning();
    return result[0];
  }
  async getTeacherApplication(id: string): Promise<TeacherApplication | undefined> {
    const result = await this.db.select().from(schema.teacherApplications).where(eq(schema.teacherApplications.id, id)).limit(1);
    return result[0];
  }
  async getAllTeacherApplications(status?: string): Promise<TeacherApplication[]> {
    if (status) {
      return await this.db.select().from(schema.teacherApplications).where(eq(schema.teacherApplications.status, status as "pending" | "approved" | "rejected")).orderBy(desc(schema.teacherApplications.dateApplied));
    }
    return await this.db.select().from(schema.teacherApplications).orderBy(desc(schema.teacherApplications.dateApplied));
  }
  async updateTeacherApplication(id: string, updates: Partial<TeacherApplication>): Promise<TeacherApplication | undefined> {
    const result = await this.db
      .update(schema.teacherApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.teacherApplications.id, id))
      .returning();
    return result[0];
  }
  async approveTeacherApplication(applicationId: string, approvedBy: string): Promise<{ application: TeacherApplication; approvedTeacher: ApprovedTeacher }> {
    const application = await this.getTeacherApplication(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }
    // Update application status
    const updatedApplication = await this.db
      .update(schema.teacherApplications)
      .set({
        status: 'approved',
        reviewedBy: approvedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherApplications.id, applicationId))
      .returning();

    // Add to approved teachers
    const approvedTeacher = await this.db
      .insert(schema.approvedTeachers)
      .values({
        applicationId: applicationId,
        googleEmail: application.googleEmail,
        fullName: application.fullName,
        subjectSpecialty: application.subjectSpecialty,
        approvedBy: approvedBy,
      })
      .returning();

    return {
      application: updatedApplication[0],
      approvedTeacher: approvedTeacher[0],
    };
  }
  async rejectTeacherApplication(applicationId: string, reviewedBy: string, reason: string): Promise<TeacherApplication | undefined> {
    const result = await this.db
      .update(schema.teacherApplications)
      .set({
        status: 'rejected',
        reviewedBy: reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherApplications.id, applicationId))
      .returning();
    return result[0];
  }
  // Approved Teachers implementations
  async getApprovedTeacherByEmail(email: string): Promise<ApprovedTeacher | undefined> {
    const result = await this.db.select().from(schema.approvedTeachers).where(eq(schema.approvedTeachers.googleEmail, email)).limit(1);
    return result[0];
  }
  async getAllApprovedTeachers(): Promise<ApprovedTeacher[]> {
    return await this.db.select().from(schema.approvedTeachers).orderBy(desc(schema.approvedTeachers.dateApproved));
  }
  async deleteApprovedTeacher(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.approvedTeachers).where(eq(schema.approvedTeachers.id, id)).returning();
    return result.length > 0;
  }
  // Super Admin implementations
  async getSuperAdminStats(): Promise<{
    totalAdmins: number;
    totalUsers: number;
    activeSessions: number;
    totalExams: number;
  }> {
    const [admins, users, exams] = await Promise.all([
      this.getUsersByRole(1), // Admins have roleId 1
      this.getAllUsers(),
      this.db.select().from(schema.exams),
    ]);

    // Count active sessions (users logged in recently, within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeSessions = users.filter(u => u.updatedAt && u.updatedAt > oneHourAgo).length;

    return {
      totalAdmins: admins.length,
      totalUsers: users.length,
      activeSessions,
      totalExams: exams.length,
    };
  }
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const result = await this.db.select().from(schema.systemSettings).limit(1);
    return result[0];
  }
  async updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    const existing = await this.getSystemSettings();
    const updateData: any = { ...settings };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    if (existing) {
      const result = await db
        .update(schema.systemSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(schema.systemSettings.id, existing.id))
        .returning();
      
      const rows = result as any[];
      if (!rows || !rows.length) throw new Error("Update failed");
      return rows[0];
    } else {
      const result = await db
        .insert(schema.systemSettings)
        .values({ ...updateData, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      
      const rows = result as any[];
      if (!rows || !rows.length) throw new Error("Insert failed");
      return rows[0];
    }
  }

  // User recovery management implementations
  async getDeletedUsers(roleFilter?: number[]): Promise<User[]> {
    // Get users that have been soft-deleted (deletedAt is set)
    if (roleFilter && roleFilter.length > 0) {
      return await this.db.select()
        .from(schema.users)
        .where(and(
          sql`${schema.users.deletedAt} IS NOT NULL`,
          inArray(schema.users.roleId, roleFilter)
        ))
        .orderBy(desc(schema.users.deletedAt));
    }
    return await this.db.select()
      .from(schema.users)
      .where(sql`${schema.users.deletedAt} IS NOT NULL`)
      .orderBy(desc(schema.users.deletedAt));
  }

  async restoreUser(userId: string, restoredBy: string): Promise<User | undefined> {
    // Restore a soft-deleted user by clearing deletedAt and setting isActive to true
    const result = await this.db.update(schema.users)
      .set({ 
        isActive: true, 
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  async softDeleteUser(userId: string, deletedBy: string): Promise<boolean> {
    // Soft delete a user by setting deletedAt and isActive to false
    const result = await this.db.update(schema.users)
      .set({ 
        isActive: false, 
        deletedAt: new Date(),
        deletedBy: deletedBy
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }

  async permanentlyDeleteUser(userId: string): Promise<boolean> {
    // Permanently delete user and all associated data
    try {
      const user = await this.getUser(userId);
      if (!user) return false;

      // Use hard delete based on role
      const roleId = user.roleId;
      
      // Role 4 = Student
      if (roleId === 4) {
        return await this.hardDeleteStudent(userId);
      }
      
      // For other roles, use the smart deletion manager
      const deletionManager = new SmartDeletionManager();
      const result = await deletionManager.deleteUser(userId);
      return result.success;
    } catch (error) {
      console.error('Error permanently deleting user:', error);
      return false;
    }
  }

  async getExpiredDeletedUsers(retentionDays: number): Promise<User[]> {
    // Get users whose deletion date has exceeded the retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    return await this.db.select()
      .from(schema.users)
      .where(and(
        sql`${schema.users.deletedAt} IS NOT NULL`,
        lte(schema.users.deletedAt, cutoffDate)
      ))
      .orderBy(asc(schema.users.deletedAt));
  }

  async permanentlyDeleteExpiredUsers(retentionDays: number): Promise<{ deleted: number; errors: string[] }> {
    const expiredUsers = await this.getExpiredDeletedUsers(retentionDays);
    let deleted = 0;
    const errors: string[] = [];

    for (const user of expiredUsers) {
      try {
        const success = await this.permanentlyDeleteUser(user.id);
        if (success) {
          deleted++;
          console.log(`Permanently deleted expired user: ${user.username || user.email} (ID: ${user.id})`);
        } else {
          errors.push(`Failed to delete user ${user.id}`);
        }
      } catch (error: any) {
        errors.push(`Error deleting user ${user.id}: ${error.message}`);
      }
    }

    return { deleted, errors };
  }

  // Student subject assignment implementations
  async createStudentSubjectAssignment(assignment: InsertStudentSubjectAssignment): Promise<StudentSubjectAssignment> {
    const result = await this.db
      .insert(schema.studentSubjectAssignments)
      .values(assignment)
      .returning();
    return result[0];
  }

  async getStudentSubjectAssignments(studentId: string): Promise<StudentSubjectAssignment[]> {
    return await this.db
      .select()
      .from(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.studentId, studentId));
  }

  async getStudentSubjectAssignmentsByClass(classId: number): Promise<StudentSubjectAssignment[]> {
    return await this.db
      .select()
      .from(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.classId, classId));
  }

  async deleteStudentSubjectAssignment(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteStudentSubjectAssignmentsByStudent(studentId: string): Promise<boolean> {
    await this.db
      .delete(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.studentId, studentId));
    return true;
  }

  async assignSubjectsToStudent(
    studentId: string,
    classId: number,
    subjectIds: number[],
    termId?: number,
    assignedBy?: string
  ): Promise<StudentSubjectAssignment[]> {
    const assignments: StudentSubjectAssignment[] = [];
    
    for (const subjectId of subjectIds) {
      try {
        const result = await this.db
          .insert(schema.studentSubjectAssignments)
          .values({
            studentId,
            classId,
            subjectId,
            termId: termId || null,
            assignedBy: assignedBy || null,
            isActive: true,
          })
          .onConflictDoNothing()
          .returning();
        if (result[0]) {
          assignments.push(result[0]);
        }
      } catch (e) {
        // Skip duplicates
      }
    }
    
    return assignments;
  }

  // Class subject mapping implementations
  async createClassSubjectMapping(mapping: InsertClassSubjectMapping): Promise<ClassSubjectMapping> {
    // Use onConflictDoNothing to handle duplicate mappings gracefully
    const result = await this.db
      .insert(schema.classSubjectMappings)
      .values(mapping)
      .onConflictDoNothing()
      .returning();
    
    // If conflict occurred (no result), fetch the existing mapping
    if (!result[0]) {
      const existing = await this.db
        .select()
        .from(schema.classSubjectMappings)
        .where(
          and(
            eq(schema.classSubjectMappings.classId, mapping.classId),
            eq(schema.classSubjectMappings.subjectId, mapping.subjectId)
          )
        )
        .limit(1);
      return existing[0];
    }
    return result[0];
  }

  async getClassSubjectMappingById(id: number): Promise<ClassSubjectMapping | undefined> {
    const result = await this.db
      .select()
      .from(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.id, id))
      .limit(1);
    return result[0];
  }

  async getClassSubjectMappings(classId: number, department?: string): Promise<ClassSubjectMapping[]> {
    if (department) {
      return await this.db
        .select()
        .from(schema.classSubjectMappings)
        .where(
          and(
            eq(schema.classSubjectMappings.classId, classId),
            or(
              eq(schema.classSubjectMappings.department, department),
              isNull(schema.classSubjectMappings.department)
            )
          )
        );
    }
    return await this.db
      .select()
      .from(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.classId, classId));
  }

  async getAllClassSubjectMappings(): Promise<ClassSubjectMapping[]> {
    return await this.db
      .select()
      .from(schema.classSubjectMappings);
  }

  async getSubjectsByClassAndDepartment(classId: number, department?: string): Promise<Subject[]> {
    const mappings = await this.getClassSubjectMappings(classId, department);
    if (mappings.length === 0) return [];
    
    const subjectIds = mappings.map(m => m.subjectId);
    return await this.db
      .select()
      .from(schema.subjects)
      .where(
        and(
          inArray(schema.subjects.id, subjectIds),
          eq(schema.subjects.isActive, true)
        )
      );
  }

  async deleteClassSubjectMapping(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteClassSubjectMappingsByClass(classId: number): Promise<boolean> {
    await this.db
      .delete(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.classId, classId));
    return true;
  }

  async bulkUpdateClassSubjectMappings(
    additions: Array<{classId: number; subjectId: number; department: string | null; isCompulsory?: boolean}>,
    removals: Array<{classId: number; subjectId: number; department: string | null}>
  ): Promise<{added: number; removed: number; affectedClassIds: number[]}> {
    // Use transaction for atomic updates - all changes commit or rollback together
    return await this.db.transaction(async (tx: any) => {
      const affectedClassIds = new Set<number>();
      let addedCount = 0;
      let removedCount = 0;

      // Process removals first (within transaction)
      for (const removal of removals) {
        const { classId, subjectId, department } = removal;
        if (!classId || !subjectId) continue;
        
        affectedClassIds.add(classId);
        
        // Delete matching mapping
        if (department === null) {
          const result = await tx
            .delete(schema.classSubjectMappings)
            .where(
              and(
                eq(schema.classSubjectMappings.classId, classId),
                eq(schema.classSubjectMappings.subjectId, subjectId),
                sql`${schema.classSubjectMappings.department} IS NULL`
              )
            )
            .returning();
          removedCount += result.length;
        } else {
          const result = await tx
            .delete(schema.classSubjectMappings)
            .where(
              and(
                eq(schema.classSubjectMappings.classId, classId),
                eq(schema.classSubjectMappings.subjectId, subjectId),
                eq(schema.classSubjectMappings.department, department)
              )
            )
            .returning();
          removedCount += result.length;
        }
      }

      // Process additions (within transaction)
      for (const addition of additions) {
        const { classId, subjectId, department, isCompulsory } = addition;
        if (!classId || !subjectId) continue;
        
        affectedClassIds.add(classId);
        
        // Use upsert to handle potential conflicts
        const result = await tx
          .insert(schema.classSubjectMappings)
          .values({
            classId,
            subjectId,
            department: department || null,
            isCompulsory: isCompulsory || false
          })
          .onConflictDoNothing()
          .returning();
        
        if (result.length > 0) {
          addedCount++;
        }
      }

      return {
        added: addedCount,
        removed: removedCount,
        affectedClassIds: Array.from(affectedClassIds)
      };
    });
  }

  // Department-based subject logic implementations
  async getSubjectsByCategory(category: string): Promise<Subject[]> {
    return await this.db
      .select()
      .from(schema.subjects)
      .where(
        and(
          eq(schema.subjects.category, category),
          eq(schema.subjects.isActive, true)
        )
      );
  }

  async getSubjectsForClassLevel(classLevel: string, department?: string): Promise<Subject[]> {
    // SINGLE SOURCE OF TRUTH: Use class_subject_mappings table only
    // No fallback to category-based logic - admin must assign subjects
    // Find a class with this level and get its mapped subjects
    const classesAtLevel = await this.db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.level, classLevel))
      .limit(1);
    
    if (classesAtLevel.length > 0) {
      const classId = classesAtLevel[0].id;
      // Use class_subject_mappings through getSubjectsByClassAndDepartment
      const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, department);
      
      if (mappedSubjects.length > 0) {
        return mappedSubjects;
      }
    }
    
    // No fallback - return empty array if no mappings exist
    // Admin must configure subjects via Subject Manager > Class-Level & Department Assignment
    console.log(`[SUBJECT-ASSIGNMENT] No class_subject_mappings found for level ${classLevel}, department: ${department || 'none'}. Admin must assign subjects.`);
    return [];
  }

  async autoAssignSubjectsToStudent(
    studentId: string,
    classId: number,
    department?: string
  ): Promise<StudentSubjectAssignment[]> {
    // Get the class to determine level
    const classInfo = await this.getClass(classId);
    if (!classInfo) {
      throw new Error('Class not found');
    }
    
    // Get current term
    const currentTerm = await this.getCurrentTerm();
    const termId = currentTerm?.id;
    
    // Get subjects based on class level and department
    // SINGLE SOURCE OF TRUTH: Only use class_subject_mappings - no fallback
    const subjects = await this.getSubjectsForClassLevel(classInfo.level, department);
    
    if (subjects.length === 0) {
      // No fallback - admin must configure subjects via Subject Manager
      console.log(`[AUTO-ASSIGN] No subjects found for class ${classId}, department: ${department || 'none'}. Admin must assign subjects.`);
      return [];
    }
    
    const subjectIds = subjects.map(s => s.id);
    return await this.assignSubjectsToStudent(studentId, classId, subjectIds, termId);
  }

  async syncStudentsWithClassMappings(classId: number, department?: string): Promise<{synced: number; errors: string[]}> {
    const errors: string[] = [];
    let synced = 0;
    
    try {
      const classInfo = await this.getClass(classId);
      if (!classInfo) {
        return { synced: 0, errors: ['Class not found'] };
      }
      
      const isSeniorSecondary = classInfo.level && 
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level => 
          classInfo.level?.toLowerCase().includes(level.toLowerCase())
        );
      
      const students = await this.getStudentsByClass(classId);
      
      for (const student of students) {
        try {
          const studentDept = (student as any).department?.toLowerCase()?.trim() || undefined;
          
          if (department && studentDept !== department.toLowerCase().trim()) {
            continue;
          }
          
          const effectiveDept = isSeniorSecondary ? studentDept : undefined;
          const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, effectiveDept);
          
          if (mappedSubjects.length === 0) {
            errors.push(`No subjects mapped for student ${student.id} (class ${classId}, dept: ${effectiveDept || 'none'})`);
            continue;
          }
          
          await db.delete(schema.studentSubjectAssignments)
            .where(eq(schema.studentSubjectAssignments.studentId, student.id));
          
          const currentTerm = await this.getCurrentTerm();
          for (const subject of mappedSubjects) {
            await db.insert(schema.studentSubjectAssignments)
              .values({
                studentId: student.id,
                classId: classId,
                subjectId: subject.id,
                termId: currentTerm?.id || null,
                isActive: true
              })
              .onConflictDoNothing();
          }
          
          synced++;
        } catch (studentError: any) {
          errors.push(`Failed to sync student ${student.id}: ${studentError.message}`);
        }
      }
      
      console.log(`[SYNC] Synced ${synced} students in class ${classId}${department ? ` (${department})` : ''}`);
      return { synced, errors };
    } catch (error: any) {
      console.error('[SYNC] Error syncing students with class mappings:', error);
      return { synced: 0, errors: [error.message] };
    }
  }

  async syncAllStudentsWithMappings(): Promise<{synced: number; errors: string[]}> {
    let totalSynced = 0;
    const allErrors: string[] = [];
    
    try {
      const classes = await this.getClasses();
      
      for (const classInfo of classes) {
        const result = await this.syncStudentsWithClassMappings(classInfo.id);
        totalSynced += result.synced;
        allErrors.push(...result.errors);
      }
      
      console.log(`[SYNC] Total synced: ${totalSynced} students across ${classes.length} classes`);
      return { synced: totalSynced, errors: allErrors };
    } catch (error: any) {
      console.error('[SYNC] Error syncing all students:', error);
      return { synced: 0, errors: [error.message] };
    }
  }

  async cleanupReportCardItems(studentId: string): Promise<{removed: number; kept: number}> {
    try {
      const student = await this.getStudent(studentId);
      if (!student || !student.classId) {
        return { removed: 0, kept: 0 };
      }

      const classInfo = await this.getClass(student.classId);
      if (!classInfo) {
        return { removed: 0, kept: 0 };
      }

      const isSeniorSecondary = classInfo.level && 
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level => 
          classInfo.level?.toLowerCase().includes(level.toLowerCase()) ||
          classInfo.name?.toLowerCase().includes(level.toLowerCase())
        );
      
      const studentDept = (student as any).department?.toLowerCase()?.trim() || undefined;
      const effectiveDept = isSeniorSecondary ? studentDept : undefined;
      
      const allowedSubjects = await this.getSubjectsByClassAndDepartment(student.classId, effectiveDept);
      const allowedSubjectIds = new Set(allowedSubjects.map(s => s.id));
      
      // If no allowed subjects, we should delete ALL report card items for this student
      // This handles the case where a class lost all its subject mappings

      const reportCards = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.studentId, studentId));
      
      let totalRemoved = 0;
      let totalKept = 0;

      for (const reportCard of reportCards) {
        const items = await db.select()
          .from(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
        
        for (const item of items) {
          if (!allowedSubjectIds.has(item.subjectId)) {
            await db.delete(schema.reportCardItems)
              .where(eq(schema.reportCardItems.id, item.id));
            totalRemoved++;
          } else {
            totalKept++;
          }
        }
      }

      console.log(`[CLEANUP] Student ${studentId}: removed ${totalRemoved} items, kept ${totalKept}`);
      return { removed: totalRemoved, kept: totalKept };
    } catch (error: any) {
      console.error(`[CLEANUP] Error cleaning up report card for student ${studentId}:`, error);
      return { removed: 0, kept: 0 };
    }
  }

  async cleanupReportCardsForClasses(classIds: number[]): Promise<{studentsProcessed: number; itemsRemoved: number; errors: string[]}> {
    let studentsProcessed = 0;
    let totalItemsRemoved = 0;
    const errors: string[] = [];
    
    if (!classIds || classIds.length === 0) {
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [] };
    }
    
    try {
      // Get only students in the affected classes
      const students = await db.select({ id: schema.students.id })
        .from(schema.students)
        .where(inArray(schema.students.classId, classIds));
      
      console.log(`[CLEANUP] Processing ${students.length} students from ${classIds.length} affected classes`);
      
      for (const student of students) {
        try {
          const result = await this.cleanupReportCardItems(student.id);
          totalItemsRemoved += result.removed;
          studentsProcessed++;
        } catch (error: any) {
          errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
        }
      }
      
      console.log(`[CLEANUP] Processed ${studentsProcessed} students in affected classes, removed ${totalItemsRemoved} report card items`);
      return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
    } catch (error: any) {
      console.error('[CLEANUP] Error cleaning up report cards for classes:', error);
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
    }
  }

  async cleanupAllReportCards(): Promise<{studentsProcessed: number; itemsRemoved: number; errors: string[]}> {
    let studentsProcessed = 0;
    let totalItemsRemoved = 0;
    const errors: string[] = [];
    
    try {
      const students = await db.select({ id: schema.students.id })
        .from(schema.students);
      
      for (const student of students) {
        try {
          const result = await this.cleanupReportCardItems(student.id);
          totalItemsRemoved += result.removed;
          studentsProcessed++;
        } catch (error: any) {
          errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
        }
      }
      
      console.log(`[CLEANUP] Processed ${studentsProcessed} students, removed ${totalItemsRemoved} report card items`);
      return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
    } catch (error: any) {
      console.error('[CLEANUP] Error cleaning up all report cards:', error);
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
    }
  }

  /**
   * FIX: Add missing subjects to existing report cards when new mappings are added
   * This ensures report cards are updated when admin adds new subjects to class/department mappings
   */
  async addMissingSubjectsToReportCards(classIds: number[]): Promise<{studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[]}> {
    let studentsProcessed = 0;
    let totalItemsAdded = 0;
    let examScoresSynced = 0;
    const errors: string[] = [];
    
    if (!classIds || classIds.length === 0) {
      return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [] };
    }
    
    try {
      // Get current term for exam lookup
      const currentTerm = await this.getCurrentTerm();
      if (!currentTerm) {
        console.log('[ADD-MISSING-SUBJECTS] No current term found, skipping');
        return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: ['No current term'] };
      }

      // Get students in affected classes (join with users to check isActive status)
      const students = await db.select({
        id: schema.students.id,
        classId: schema.students.classId,
        department: schema.students.department,
        admissionNumber: schema.students.admissionNumber
      })
        .from(schema.students)
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .where(and(
          inArray(schema.students.classId, classIds),
          eq(schema.users.isActive, true)
        ));
      
      console.log(`[ADD-MISSING-SUBJECTS] Processing ${students.length} students from ${classIds.length} classes`);
      
      for (const student of students) {
        try {
          if (!student.classId) continue;
          
          // Get class info to determine if senior secondary
          const classInfo = await this.getClass(student.classId);
          if (!classInfo) continue;
          
          const isSeniorSecondary = classInfo.level && 
            ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level => 
              classInfo.level?.toLowerCase().includes(level.toLowerCase()) ||
              classInfo.name?.toLowerCase().includes(level.toLowerCase())
            );
          
          const studentDept = (student as any).department?.toLowerCase()?.trim() || undefined;
          const effectiveDept = isSeniorSecondary ? studentDept : undefined;
          
          // Get all subjects that SHOULD be assigned to this student
          const allowedSubjects = await this.getSubjectsByClassAndDepartment(student.classId, effectiveDept);
          const allowedSubjectIds = new Set(allowedSubjects.map(s => s.id));
          
          if (allowedSubjects.length === 0) continue;
          
          // Get student's report cards for current term
          const reportCards = await db.select()
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.studentId, student.id),
              eq(schema.reportCards.termId, currentTerm.id)
            ));
          
          for (const reportCard of reportCards) {
            // Get existing items in this report card
            const existingItems = await db.select()
              .from(schema.reportCardItems)
              .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
            
            const existingSubjectIds = new Set(existingItems.map((item: { subjectId: number }) => item.subjectId));
            
            // Find missing subjects (subjects that should be there but aren't)
            const missingSubjectIds = [...allowedSubjectIds].filter(id => !existingSubjectIds.has(id));
            
            if (missingSubjectIds.length > 0) {
              console.log(`[ADD-MISSING-SUBJECTS] Student ${student.id}: adding ${missingSubjectIds.length} missing subjects to report card ${reportCard.id}`);
              
              for (const subjectId of missingSubjectIds) {
                // Create the report card item
                const newItem = await db.insert(schema.reportCardItems)
                  .values({
                    reportCardId: reportCard.id,
                    subjectId,
                    totalMarks: 100,
                    obtainedMarks: 0,
                    percentage: 0
                  })
                  .returning();
                
                totalItemsAdded++;
                
                // Check if there are any exam results for this subject that need to be synced
                const examResults = await db.select({
                  examId: schema.examResults.examId,
                  score: schema.examResults.score,
                  maxScore: schema.examResults.maxScore,
                  examType: schema.exams.examType,
                  gradingScale: schema.exams.gradingScale,
                  createdBy: schema.exams.createdBy
                })
                  .from(schema.examResults)
                  .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
                  .where(and(
                    eq(schema.examResults.studentId, student.id),
                    eq(schema.exams.subjectId, subjectId),
                    eq(schema.exams.termId, currentTerm.id)
                  ));
                
                if (examResults.length > 0 && newItem.length > 0) {
                  // Sync exam scores to the new report card item
                  for (const examResult of examResults) {
                    const isTest = ['test', 'quiz', 'assignment'].includes(examResult.examType);
                    const isMainExam = ['exam', 'final', 'midterm'].includes(examResult.examType);
                    
                    const safeScore = typeof examResult.score === 'number' ? examResult.score : parseInt(String(examResult.score), 10) || 0;
                    const safeMaxScore = typeof examResult.maxScore === 'number' ? examResult.maxScore : parseInt(String(examResult.maxScore), 10) || 0;
                    
                    const updateData: any = { updatedAt: new Date() };
                    
                    if (isTest) {
                      updateData.testExamId = examResult.examId;
                      updateData.testExamCreatedBy = examResult.createdBy;
                      updateData.testScore = safeScore;
                      updateData.testMaxScore = safeMaxScore;
                    } else if (isMainExam) {
                      updateData.examExamId = examResult.examId;
                      updateData.examExamCreatedBy = examResult.createdBy;
                      updateData.examScore = safeScore;
                      updateData.examMaxScore = safeMaxScore;
                    }
                    
                    await db.update(schema.reportCardItems)
                      .set(updateData)
                      .where(eq(schema.reportCardItems.id, newItem[0].id));
                    
                    examScoresSynced++;
                    console.log(`[ADD-MISSING-SUBJECTS] Synced exam ${examResult.examId} score (${safeScore}/${safeMaxScore}) to new item`);
                  }
                  
                  // Recalculate the item's weighted score after syncing
                  await this.recalculateReportCard(reportCard.id, reportCard.gradingScale || 'standard');
                }
              }
            }
          }
          
          studentsProcessed++;
        } catch (studentError: any) {
          errors.push(`Failed to process student ${student.id}: ${studentError.message}`);
        }
      }
      
      console.log(`[ADD-MISSING-SUBJECTS] Completed: ${studentsProcessed} students, ${totalItemsAdded} items added, ${examScoresSynced} exam scores synced`);
      return { studentsProcessed, itemsAdded: totalItemsAdded, examScoresSynced, errors };
    } catch (error: any) {
      console.error('[ADD-MISSING-SUBJECTS] Error:', error);
      return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
    }
  }

  /**
   * FIX: Repair all report cards by adding missing subjects and syncing exam scores
   * This is a comprehensive data repair function for existing affected students
   */
  async repairAllReportCards(): Promise<{studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[]}> {
    try {
      // Get all active classes
      const classes = await db.select({ id: schema.classes.id })
        .from(schema.classes)
        .where(eq(schema.classes.isActive, true));
      
      const classIds = classes.map((c: { id: number }) => c.id);
      console.log(`[REPAIR-REPORT-CARDS] Starting repair for ${classIds.length} classes`);
      
      return await this.addMissingSubjectsToReportCards(classIds);
    } catch (error: any) {
      console.error('[REPAIR-REPORT-CARDS] Error:', error);
      return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
    }
  }

  async syncReportCardItemsOnExamSubjectChange(examId: number, oldSubjectId: number, newSubjectId: number): Promise<{updated: number; errors: string[]}> {
    const errors: string[] = [];
    
    try {
      console.log(`[SYNC] Syncing report card items for exam ${examId}: subject ${oldSubjectId} -> ${newSubjectId}`);
      
      const testExamResult = await db.update(schema.reportCardItems)
        .set({ subjectId: newSubjectId })
        .where(eq(schema.reportCardItems.testExamId, examId));
      
      const examExamResult = await db.update(schema.reportCardItems)
        .set({ subjectId: newSubjectId })
        .where(eq(schema.reportCardItems.examExamId, examId));
      
      const testExamCount = (testExamResult as any)?.rowCount || (testExamResult as any)?.changes || 0;
      const examExamCount = (examExamResult as any)?.rowCount || (examExamResult as any)?.changes || 0;
      const updated = testExamCount + examExamCount;
      
      console.log(`[SYNC] Updated ${updated} report card items for exam ${examId} (testExamId: ${testExamCount}, examExamId: ${examExamCount})`);
      return { updated, errors };
    } catch (error: any) {
      console.error(`[SYNC] Error syncing report card items for exam ${examId}:`, error);
      return { updated: 0, errors: [error.message] };
    }
  }

  /**
   * COMPREHENSIVE FIX: Sync all missing exam scores to existing report card items
   * This finds all exam_results that have scores but aren't reflected in report_card_items
   * and syncs them properly
   */
  async syncAllMissingExamScores(termId?: number): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      console.log(`[SYNC-ALL-MISSING] Starting comprehensive sync of missing exam scores...`);
      
      // Get current term if not specified
      let targetTermId = termId;
      if (!targetTermId) {
        const currentTerm = await this.getCurrentTerm();
        if (currentTerm) {
          targetTermId = currentTerm.id;
        }
      }
      
      // Find all exam results where:
      // 1. The exam is of type 'exam' (main exam)
      // 2. There's a report card for that student/term
      // 3. The report card item exists but has NULL exam_score
      // OR the report card item doesn't exist at all
      const missingExamScores = await db.select({
        examResultId: schema.examResults.id,
        studentId: schema.examResults.studentId,
        examId: schema.examResults.examId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        examType: schema.exams.examType,
        subjectId: schema.exams.subjectId,
        classId: schema.exams.classId,
        examTermId: schema.exams.termId,
        gradingScale: schema.exams.gradingScale,
        createdBy: schema.exams.createdBy,
        reportCardId: schema.reportCards.id,
        reportCardItemId: schema.reportCardItems.id,
        currentExamScore: schema.reportCardItems.examScore,
        currentTestScore: schema.reportCardItems.testScore
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .innerJoin(schema.reportCards, and(
          eq(schema.reportCards.studentId, schema.examResults.studentId),
          eq(schema.reportCards.termId, schema.exams.termId)
        ))
        .leftJoin(schema.reportCardItems, and(
          eq(schema.reportCardItems.reportCardId, schema.reportCards.id),
          eq(schema.reportCardItems.subjectId, schema.exams.subjectId)
        ))
        .where(and(
          sql`${schema.examResults.score} IS NOT NULL`,
          targetTermId ? eq(schema.exams.termId, targetTermId) : sql`1=1`,
          or(
            // Exam type results missing in report card
            and(
              inArray(schema.exams.examType, ['exam', 'final', 'midterm']),
              or(
                sql`${schema.reportCardItems.id} IS NULL`,
                sql`${schema.reportCardItems.exam_score} IS NULL`
              )
            ),
            // Test type results missing in report card
            and(
              inArray(schema.exams.examType, ['test', 'quiz', 'assignment']),
              or(
                sql`${schema.reportCardItems.id} IS NULL`,
                sql`${schema.reportCardItems.test_score} IS NULL`
              )
            )
          )
        ));
      
      console.log(`[SYNC-ALL-MISSING] Found ${missingExamScores.length} exam results to sync`);
      
      // Group by report card to batch recalculations
      const reportCardIdsToRecalculate = new Set<number>();
      
      for (const record of missingExamScores) {
        try {
          const isTest = ['test', 'quiz', 'assignment'].includes(record.examType);
          const isMainExam = ['exam', 'final', 'midterm'].includes(record.examType);
          
          // Skip if the score already exists for this type
          if (isMainExam && record.currentExamScore !== null) continue;
          if (isTest && record.currentTestScore !== null) continue;
          
          const safeScore = typeof record.score === 'number' ? record.score : parseInt(String(record.score), 10) || 0;
          const safeMaxScore = typeof record.maxScore === 'number' ? record.maxScore : parseInt(String(record.maxScore), 10) || 0;
          
          if (record.reportCardItemId) {
            // Update existing report card item
            const updateData: any = { updatedAt: new Date() };
            
            if (isTest) {
              updateData.testExamId = record.examId;
              updateData.testExamCreatedBy = record.createdBy;
              updateData.testScore = safeScore;
              updateData.testMaxScore = safeMaxScore;
            } else if (isMainExam) {
              updateData.examExamId = record.examId;
              updateData.examExamCreatedBy = record.createdBy;
              updateData.examScore = safeScore;
              updateData.examMaxScore = safeMaxScore;
            }
            
            await db.update(schema.reportCardItems)
              .set(updateData)
              .where(eq(schema.reportCardItems.id, record.reportCardItemId));
            
            reportCardIdsToRecalculate.add(record.reportCardId);
            synced++;
            console.log(`[SYNC-ALL-MISSING] Updated item ${record.reportCardItemId}: ${isTest ? 'test' : 'exam'} score ${safeScore}/${safeMaxScore}`);
          } else if (record.reportCardId && record.subjectId) {
            // Create new report card item
            const newItem = await db.insert(schema.reportCardItems)
              .values({
                reportCardId: record.reportCardId,
                subjectId: record.subjectId,
                totalMarks: 100,
                obtainedMarks: 0,
                percentage: 0,
                testExamId: isTest ? record.examId : null,
                testExamCreatedBy: isTest ? record.createdBy : null,
                testScore: isTest ? safeScore : null,
                testMaxScore: isTest ? safeMaxScore : null,
                examExamId: isMainExam ? record.examId : null,
                examExamCreatedBy: isMainExam ? record.createdBy : null,
                examScore: isMainExam ? safeScore : null,
                examMaxScore: isMainExam ? safeMaxScore : null
              })
              .returning();
            
            reportCardIdsToRecalculate.add(record.reportCardId);
            synced++;
            console.log(`[SYNC-ALL-MISSING] Created new item for report card ${record.reportCardId}, subject ${record.subjectId}`);
          }
        } catch (recordError: any) {
          failed++;
          errors.push(`Failed to sync exam result ${record.examResultId}: ${recordError.message}`);
        }
      }
      
      // Recalculate all affected report cards
      console.log(`[SYNC-ALL-MISSING] Recalculating ${reportCardIdsToRecalculate.size} report cards...`);
      for (const reportCardId of reportCardIdsToRecalculate) {
        try {
          await this.recalculateReportCard(reportCardId, 'standard');
        } catch (calcError: any) {
          errors.push(`Failed to recalculate report card ${reportCardId}: ${calcError.message}`);
        }
      }
      
      console.log(`[SYNC-ALL-MISSING] Completed: ${synced} synced, ${failed} failed`);
      return { synced, failed, errors };
    } catch (error: any) {
      console.error('[SYNC-ALL-MISSING] Error:', error);
      return { synced: 0, failed: 0, errors: [error.message] };
    }
  }

  /**
   * Bulk sync all results for a specific exam to report cards
   * Useful for teachers to sync all their exam results at once
   */
  async syncExamResultsToReportCards(examId: number): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      console.log(`[SYNC-EXAM-RESULTS] Starting bulk sync for exam ${examId}...`);
      
      // Get all results for this exam
      const examResults = await db.select({
        id: schema.examResults.id,
        studentId: schema.examResults.studentId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore
      })
        .from(schema.examResults)
        .where(and(
          eq(schema.examResults.examId, examId),
          sql`${schema.examResults.score} IS NOT NULL`
        ));
      
      console.log(`[SYNC-EXAM-RESULTS] Found ${examResults.length} results to sync for exam ${examId}`);
      
      // Get exam details
      const exam = await this.getExamById(examId);
      if (!exam) {
        return { synced: 0, failed: 0, errors: ['Exam not found'] };
      }
      
      for (const result of examResults) {
        try {
          const syncResult = await this.syncExamScoreToReportCard(
            result.studentId,
            examId,
            result.score || 0,
            result.maxScore || exam.totalMarks || 100
          );
          
          if (syncResult.success) {
            synced++;
          } else {
            failed++;
            errors.push(`Student ${result.studentId}: ${syncResult.message}`);
          }
        } catch (studentError: any) {
          failed++;
          errors.push(`Student ${result.studentId}: ${studentError.message}`);
        }
      }
      
      console.log(`[SYNC-EXAM-RESULTS] Completed: ${synced} synced, ${failed} failed`);
      return { synced, failed, errors };
    } catch (error: any) {
      console.error('[SYNC-EXAM-RESULTS] Error:', error);
      return { synced: 0, failed: 0, errors: [error.message] };
    }
  }

  // Report Card Skills Methods
  async getReportCardSkills(reportCardId: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCardSkills)
        .where(eq(schema.reportCardSkills.reportCardId, reportCardId))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error('Error getting report card skills:', error);
      return undefined;
    }
  }

  async saveReportCardSkills(reportCardId: number, skills: any): Promise<any> {
    try {
      const existing = await this.getReportCardSkills(reportCardId);
      
      if (existing) {
        // Only update fields that are explicitly provided in the payload
        // Use incoming value if provided (including 0 for intentional clears), otherwise keep existing
        const mergeSkill = (key: string, existingVal: number) => {
          const newVal = skills[key];
          // If field is present in payload, use it (allows intentional 0s); otherwise keep existing
          return (newVal !== undefined) ? newVal : (existingVal ?? 0);
        };
        
        const result = await db.update(schema.reportCardSkills)
          .set({
            punctuality: mergeSkill('punctuality', existing.punctuality),
            neatness: mergeSkill('neatness', existing.neatness),
            attentiveness: mergeSkill('attentiveness', existing.attentiveness),
            teamwork: mergeSkill('teamwork', existing.teamwork),
            leadership: mergeSkill('leadership', existing.leadership),
            assignments: mergeSkill('assignments', existing.assignments),
            classParticipation: mergeSkill('classParticipation', existing.classParticipation),
            sports: mergeSkill('sports', existing.sports),
            handwriting: mergeSkill('handwriting', existing.handwriting),
            musicalSkills: mergeSkill('musicalSkills', existing.musicalSkills),
            creativity: mergeSkill('creativity', existing.creativity),
            recordedBy: skills.recordedBy,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCardSkills.reportCardId, reportCardId))
          .returning();
        return result[0];
      } else {
        const result = await db.insert(schema.reportCardSkills)
          .values({
            reportCardId,
            punctuality: skills.punctuality || 0,
            neatness: skills.neatness || 0,
            attentiveness: skills.attentiveness || 0,
            teamwork: skills.teamwork || 0,
            leadership: skills.leadership || 0,
            assignments: skills.assignments || 0,
            classParticipation: skills.classParticipation || 0,
            sports: skills.sports || 0,
            handwriting: skills.handwriting || 0,
            musicalSkills: skills.musicalSkills || 0,
            creativity: skills.creativity || 0,
            recordedBy: skills.recordedBy
          })
          .returning();
        return result[0];
      }
    } catch (error: any) {
      console.error('Error saving report card skills:', error);
      throw error;
    }
  }
}
// Initialize storage - PostgreSQL database only
function initializeStorageSync(): IStorage {
  // CRITICAL: Only use PostgreSQL database - no memory storage fallback
  if (!process.env.DATABASE_URL) {
    process.exit(1);
  }
  try {
    const dbStorage = new DatabaseStorage();
    return dbStorage;
  } catch (error) {
    process.exit(1);
  }
}

// Initialize storage - PostgreSQL database only
export const storage: IStorage = initializeStorageSync();