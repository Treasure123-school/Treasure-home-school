/** IStorage interface — auto-split from storage.ts. */
import { eq, and, desc, asc, sql, sql as dsql, inArray, isNull, isNotNull, ne, gte, lte, or, like, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";
import { getDatabase, getSchema, getPgClient, getPgPool, isPostgres, isSqlite } from '../db';
import { calculateGrade, calculateWeightedScore, getGradingConfig, getOverallGrade, calculateGradeFromConfig } from '../grading-config';
import { getActiveGradingConfig } from '../grade-scale-service';
import { deleteFile } from '../cloudinary-service';
import { DeletionService, DeletionResult, formatDeletionLog } from '../services/deletion-service';
import { SmartDeletionManager, cleanupOrphanRecords, bulkDeleteUsers, SmartDeletionResult } from '../services/smart-deletion-manager';
import { realtimeService } from '../realtime-service';
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

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByIdentifier(identifier: string): Promise<User | undefined>;
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
  getActiveSubjects(): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, subject: Partial<InsertSubject>): Promise<Subject | undefined>;
  archiveSubject(id: number, userId: string): Promise<Subject | undefined>;
  restoreSubject(id: number, userId: string): Promise<Subject | undefined>;
  getSubjectAudit(id: number): Promise<{
    classLinks: number; studentAssignments: number; exams: number; assignments: number;
    lessonNotes: number; syllabusTopics: number; questionBanks: number;
    reportCardItems: number; continuousAssessments: number;
    timetableEntries: number; studyResources: number; teacherAssignments: number;
    isClean: boolean;
  }>;
  deleteSubject(id: number, userId?: string): Promise<boolean>;

  // Academic sessions
  getAcademicSessions(): Promise<AcademicSession[]>;
  getAcademicSession(id: number): Promise<AcademicSession | undefined>;
  getActiveAcademicSession(): Promise<AcademicSession | undefined>;
  createAcademicSession(session: InsertAcademicSession): Promise<AcademicSession>;
  updateAcademicSession(id: number, session: Partial<InsertAcademicSession>): Promise<AcademicSession | undefined>;
  deleteAcademicSession(id: number): Promise<boolean>;
  markSessionAsCurrent(id: number): Promise<AcademicSession | undefined>;

  // Academic terms
  getCurrentTerm(): Promise<AcademicTerm | undefined>;
  getTerms(): Promise<AcademicTerm[]>;
  getAcademicTerms(): Promise<AcademicTerm[]>;
  getAcademicTerm(id: number): Promise<AcademicTerm | undefined>;
  createAcademicTerm(term: any): Promise<AcademicTerm>;
  updateAcademicTerm(id: number, term: any): Promise<AcademicTerm | undefined>;
  deleteAcademicTerm(id: number): Promise<boolean>;
  markTermAsCurrent(id: number): Promise<AcademicTerm | undefined>;

  // Attendance management
  recordAttendance(attendance: InsertAttendance): Promise<Attendance>;
  batchUpsertAttendance(classId: number, date: string, recordedBy: string, records: Array<{ studentId: string; status: string }>): Promise<void>;
  getAttendanceByStudent(studentId: string, date?: string): Promise<Attendance[]>;
  getAttendanceByClass(classId: number, date: string): Promise<Attendance[]>;
  updateAttendance(id: number, data: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  getAttendanceByClassDateRange(classId: number, startDate: string, endDate: string): Promise<Attendance[]>;

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
  createExamQuestionWithOptions(question: InsertExamQuestion, options?: Array<{ optionText: string; isCorrect: boolean }>): Promise<ExamQuestion>;
  createExamQuestionsBulk(questionsData: Array<{ question: InsertExamQuestion; options?: Array<{ optionText: string; isCorrect: boolean }> }>): Promise<{ created: number; questions: ExamQuestion[]; errors: string[] }>;
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
  getQuestionBankItems(bankId: number, filters?: { questionType?: string; difficulty?: string; tags?: string[] }): Promise<QuestionBankItem[]>;
  getQuestionBankItemById(id: number): Promise<QuestionBankItem | undefined>;
  updateQuestionBankItem(id: number, item: Partial<InsertQuestionBankItem>): Promise<QuestionBankItem | undefined>;
  deleteQuestionBankItem(id: number): Promise<boolean>;

  // Question Bank Item Options management
  getQuestionBankItemOptions(questionItemId: number): Promise<QuestionBankOption[]>;
  importQuestionsFromBank(examId: number, questionItemIds: number[], randomize?: boolean, maxQuestions?: number): Promise<{ imported: number; questions: ExamQuestion[] }>;

  // Enhanced Question Bank (Container) management
  getQuestionBanks(filters?: { subjectId?: number; classId?: number; termId?: number }): Promise<QuestionBank[]>;
  createQuestionBankRecord(data: InsertQuestionBank): Promise<QuestionBank>;
  updateQuestionBankRecord(id: number, data: Partial<InsertQuestionBank>): Promise<QuestionBank>;
  deleteQuestionBankRecord(id: number): Promise<boolean>;

  // Syllabus Topics management
  getSyllabusTopics(filters: { classId?: number; subjectId?: number; termId?: number; isActive?: boolean; isPublished?: boolean }): Promise<SyllabusTopic[]>;
  getSyllabusTopicsStats(): Promise<{ total: number; published: number; draft: number; subjects: number }>;
  getSyllabusTopicById(id: number): Promise<SyllabusTopic | undefined>;
  createSyllabusTopic(topic: InsertSyllabusTopic): Promise<SyllabusTopic>;
  createSyllabusTopicsBulk(topics: InsertSyllabusTopic[]): Promise<{ created: number; topics: SyllabusTopic[]; errors: string[] }>;
  updateSyllabusTopic(id: number, topic: Partial<InsertSyllabusTopic>): Promise<SyllabusTopic | undefined>;
  deleteSyllabusTopic(id: number): Promise<boolean>;

  // Lesson Notes
  getLessonNotes(filters: { classId?: number; subjectId?: number; termId?: number; status?: string; createdBy?: string }): Promise<LessonNote[]>;
  getLessonNotesEnriched(filters: { classId?: number; subjectId?: number; termId?: number; status?: string; createdBy?: string }): Promise<Array<LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }>>;
  getLessonNoteById(id: number): Promise<(LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }) | undefined>;
  getLessonNoteByTopicId(topicId: number, publishedOnly?: boolean): Promise<(LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }) | undefined>;
  createLessonNote(data: InsertLessonNote): Promise<LessonNote>;
  updateLessonNote(id: number, data: Partial<InsertLessonNote>): Promise<LessonNote | undefined>;
  deleteLessonNote(id: number): Promise<boolean>;
  getLessonNotesStats(): Promise<{ total: number; draft: number; submitted: number; approved: number; rejected: number; published: number }>;
  getLessonNotesForTeacherView(teacherId: string, filters: { classId?: number; subjectId?: number; termId?: number }): Promise<Array<LessonNote & { creatorName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }>>;
  isTeacherAssignedToSubject(teacherId: string, classId: number, subjectId: number): Promise<boolean>;

  // Enhanced Question Bank Queries
  getQuestionBankItemsFiltered(filters: { bankId?: number; classId?: number; subjectId?: number; termId?: number; topicId?: number; difficulty?: string; questionType?: string; status?: string; createdBy?: string; statuses?: string[] }): Promise<QuestionBankItem[]>;
  generateQuestionsFromBank(criteria: { bankId?: number; classId?: number; subjectId?: number; termId?: number; distribution: Array<{ topicId?: number; difficulty?: string; count: number }> }): Promise<{ questions: QuestionBankItem[]; shortfalls: string[] }>;

  // Paginated question bank query (used by API routes — requires bankId)
  getQuestionBankItemsPaginated(filters: {
    bankId: number; classId?: number; termId?: number; topicId?: number;
    difficulty?: string; questionType?: string; status?: string;
    createdBy?: string; statuses?: string[];
    page: number; pageSize: number;
  }): Promise<{ items: QuestionBankItem[]; total: number; page: number; pageSize: number; totalPages: number }>;

  // Approval Workflow
  approveQuestionBankItem(id: number, approvedBy: string): Promise<QuestionBankItem | undefined>;
  rejectQuestionBankItem(id: number, rejectedBy: string, reason: string): Promise<QuestionBankItem | undefined>;
  publishQuestionBankItem(id: number): Promise<QuestionBankItem | undefined>;
  unpublishQuestionBankItem(id: number): Promise<QuestionBankItem | undefined>;
  bulkPublishQuestionBankItems(bankId: number): Promise<number>;
  bulkUnpublishQuestionBankItems(bankId: number): Promise<number>;
  deleteAllQuestionBankItems(bankId: number): Promise<number>;
  getPendingQuestionBankItems(filters?: { subjectId?: number; classId?: number; createdBy?: string; page?: number; pageSize?: number }): Promise<{ items: QuestionBankItem[]; total: number; totalPages: number }>;

  // Exam-Question Bank Links
  createExamQuestionBankLink(link: InsertExamQuestionBankLink): Promise<ExamQuestionBankLink>;
  getExamQuestionBankLinks(examId: number): Promise<ExamQuestionBankLink[]>;

  // Exam sessions management
  createExamSession(session: InsertExamSession): Promise<ExamSession>;
  getExamSessionById(id: number): Promise<ExamSession | undefined>;
  getExamSessionsByExam(examId: number): Promise<ExamSession[]>;
  getExamSessionsByStudent(studentId: string): Promise<ExamSession[]>;
  updateExamSession(id: number, session: Partial<InsertExamSession>): Promise<ExamSession | undefined>;
  claimExamSessionForSubmission(id: number, updates: Partial<InsertExamSession>): Promise<ExamSession | undefined>;
  getStudentsByIds(ids: string[]): Promise<Map<string, any>>;
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
  deleteGalleryCategory(id: number): Promise<boolean>;
  uploadGalleryImage(image: InsertGallery): Promise<Gallery>;
  getGalleryImages(categoryId?: number): Promise<Gallery[]>;
  getGalleryImageById(id: string): Promise<Gallery | undefined>;
  updateGalleryImage(id: string, data: Partial<InsertGallery>): Promise<Gallery | undefined>;
  deleteGalleryImage(id: string): Promise<boolean>;

  // News Posts
  createNewsPost(post: InsertNewsPost): Promise<NewsPost>;
  getNewsPosts(filters: { status?: string; category?: string }): Promise<NewsPost[]>;
  getNewsPostById(id: number): Promise<NewsPost | undefined>;
  getNewsPostBySlug(slug: string): Promise<NewsPost | undefined>;
  updateNewsPost(id: number, data: Partial<InsertNewsPost>): Promise<NewsPost | undefined>;
  deleteNewsPost(id: number): Promise<boolean>;

  // FAQs
  createFaq(faq: InsertFaq): Promise<Faq>;
  getFaqs(filters: { isActive?: boolean; category?: string }): Promise<Faq[]>;
  getFaqById(id: number): Promise<Faq | undefined>;
  updateFaq(id: number, data: Partial<InsertFaq>): Promise<Faq | undefined>;
  deleteFaq(id: number): Promise<boolean>;

  // About Sections
  createAboutSection(section: InsertAboutSection): Promise<AboutSection>;
  getAboutSections(filters: { isActive?: boolean }): Promise<AboutSection[]>;
  getAboutSectionById(id: number): Promise<AboutSection | undefined>;
  updateAboutSection(id: number, data: Partial<InsertAboutSection>): Promise<AboutSection | undefined>;
  deleteAboutSection(id: number): Promise<boolean>;

  // Admissions Enquiries
  createAdmissionsEnquiry(enquiry: InsertAdmissionsEnquiry): Promise<AdmissionsEnquiry>;
  getAdmissionsEnquiries(status?: string): Promise<AdmissionsEnquiry[]>;
  updateAdmissionsEnquiry(id: number, data: Partial<AdmissionsEnquiry>): Promise<AdmissionsEnquiry | undefined>;
  deleteAdmissionsEnquiry(id: number): Promise<boolean>;

  // Contact Messages (extended)
  deleteContactMessage(id: number): Promise<boolean>;

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

  // Homepage sections management
  getHomepageSections(): Promise<HomepageSection[]>;
  getHomepageSection(sectionKey: string): Promise<HomepageSection | undefined>;
  upsertHomepageSection(sectionKey: string, data: { sectionTitle?: string; isEnabled?: boolean; displayOrder?: number; content?: any; draftContent?: any; status?: string }, userId?: string): Promise<HomepageSection>;
  updateHomepageSectionsOrder(sections: { sectionKey: string; displayOrder: number }[]): Promise<void>;

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
  reapplyWeightedScoresToItems(reportCardId: number): Promise<{ updated: number; errors: string[] }>;
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
  syncExamScoreToReportCard(studentId: string, examId: number, score: number, maxScore: number, forceSync?: boolean): Promise<{ success: boolean; reportCardId?: number; message: string; isNewReportCard?: boolean }>;

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
  getAllTimetableEntries(filters?: { classId?: number; teacherId?: string; termId?: number }): Promise<Array<{
    id: number; teacherId: string; classId: number; subjectId: number; dayOfWeek: string;
    startTime: string; endTime: string; location: string | null; termId: number | null;
    teacherFirstName: string | null; teacherLastName: string | null;
    className: string; subjectName: string; subjectCode: string;
  }>>;

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

  // Exam payments


  // School Events / Calendar
  getSchoolEvents(filters?: { eventType?: string; startDate?: string; endDate?: string; isActive?: boolean }): Promise<SchoolEvent[]>;
  getSchoolEvent(id: number): Promise<SchoolEvent | undefined>;
  createSchoolEvent(data: InsertSchoolEvent): Promise<SchoolEvent>;
  updateSchoolEvent(id: number, data: Partial<InsertSchoolEvent>): Promise<SchoolEvent | undefined>;
  deleteSchoolEvent(id: number): Promise<boolean>;



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
  bulkUpdateClassSubjectMappings(additions: Array<{ classId: number; subjectId: number; department: string | null; isCompulsory?: boolean }>, removals: Array<{ classId: number; subjectId: number; department: string | null }>): Promise<{ added: number; removed: number; affectedClassIds: number[] }>;

  // Department-based subject logic
  getSubjectsByCategory(category: string): Promise<Subject[]>;
  getSubjectsForClassLevel(classLevel: string, department?: string): Promise<Subject[]>;
  autoAssignSubjectsToStudent(studentId: string, classId: number, department?: string): Promise<StudentSubjectAssignment[]>;

  // Sync students with class_subject_mappings (single source of truth)
  syncStudentsWithClassMappings(classId: number, department?: string): Promise<{ synced: number; errors: string[] }>;
  syncAllStudentsWithMappings(): Promise<{ synced: number; errors: string[] }>;

  // Cleanup and sync report cards with class_subject_mappings
  cleanupReportCardItems(studentId: string): Promise<{ removed: number; kept: number }>;
  cleanupReportCardsForClasses(classIds: number[]): Promise<{ studentsProcessed: number; itemsRemoved: number; errors: string[] }>;
  cleanupAllReportCards(): Promise<{ studentsProcessed: number; itemsRemoved: number; errors: string[] }>;

  // FIX: Add missing subjects to existing report cards when new mappings are added
  addMissingSubjectsToReportCards(classIds: number[]): Promise<{ studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[] }>;
  repairAllReportCards(): Promise<{ studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[] }>;

  // Sync report card items when exam subject changes
  syncReportCardItemsOnExamSubjectChange(examId: number, oldSubjectId: number, newSubjectId: number): Promise<{ updated: number; errors: string[] }>;

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

  // ─── Billing & Payments ───────────────────────────────────────────────────
  getBillingItems(filters?: { category?: string; isActive?: boolean }): Promise<BillingItem[]>;
  getBillingItem(id: number): Promise<BillingItem | undefined>;
  createBillingItem(data: InsertBillingItem): Promise<BillingItem>;
  updateBillingItem(id: number, data: Partial<InsertBillingItem>): Promise<BillingItem | undefined>;
  deleteBillingItem(id: number): Promise<boolean>;

  getBillingPayments(filters?: { billingItemId?: number; studentId?: string; termId?: number; status?: string }): Promise<BillingPayment[]>;
  getBillingPayment(id: number): Promise<BillingPayment | undefined>;
  getStudentBillingPayment(studentId: string, billingItemId: number, termId?: number): Promise<BillingPayment | undefined>;
  createBillingPayment(data: InsertBillingPayment): Promise<BillingPayment>;
  updateBillingPayment(id: number, data: Partial<InsertBillingPayment>): Promise<BillingPayment | undefined>;
  deleteBillingPayment(id: number): Promise<boolean>;
  getOutstandingBillingPayments(billingItemId?: number, termId?: number): Promise<any[]>;
  getBillingFinancialSummary(termId?: number): Promise<any>;

  getBillingFeatureLink(featureKey: string): Promise<BillingFeatureLink | undefined>;
  getBillingFeatureLinks(): Promise<BillingFeatureLink[]>;
  createBillingFeatureLink(data: InsertBillingFeatureLink): Promise<BillingFeatureLink>;
  deleteBillingFeatureLink(id: number): Promise<boolean>;
  deleteBillingFeatureLinkByKey(featureKey: string): Promise<boolean>;
}
// Helper to normalize UUIDs from various formats
