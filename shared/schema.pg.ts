import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL Schema for Production (Neon)
// This schema mirrors the SQLite schema but uses PostgreSQL-specific types

// Roles table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  permissions: text("permissions").notNull().default('[]'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }).notNull(),
  recoveryEmail: varchar("recovery_email", { length: 255 }),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  roleId: integer("role_id").notNull().references(() => roles.id),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  dateOfBirth: varchar("date_of_birth", { length: 10 }),
  gender: varchar("gender", { length: 10 }),
  nationalId: varchar("national_id", { length: 50 }),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").notNull().default(true),
  authProvider: varchar("auth_provider", { length: 20 }).notNull().default('local'),
  googleId: varchar("google_id", { length: 255 }).unique(),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  createdVia: varchar("created_via", { length: 20 }).notNull().default('admin'),
  createdBy: varchar("created_by", { length: 36 }),
  approvedBy: varchar("approved_by", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip", { length: 45 }),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  accountLockedUntil: timestamp("account_locked_until"),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  profileSkipped: boolean("profile_skipped").notNull().default(false),
  profileCompletionPercentage: integer("profile_completion_percentage").notNull().default(0),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  securityQuestion: text("security_question"),
  securityAnswerHash: text("security_answer_hash"),
  dataPolicyAgreed: boolean("data_policy_agreed").notNull().default(false),
  dataPolicyAgreedAt: timestamp("data_policy_agreed_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  usersEmailIdx: index("users_email_idx").on(table.email),
  usersStatusIdx: index("users_status_idx").on(table.status),
  usersGoogleIdIdx: index("users_google_id_idx").on(table.googleId),
  usersRoleIdIdx: index("users_role_id_idx").on(table.roleId),
  usersUsernameIdx: index("users_username_idx").on(table.username),
  usersDeletedAtIdx: index("users_deleted_at_idx").on(table.deletedAt),
}));

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  resetBy: varchar("reset_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  passwordResetTokensUserIdIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
  passwordResetTokensTokenIdx: index("password_reset_tokens_token_idx").on(table.token),
}));

// Password reset attempts table
export const passwordResetAttempts = pgTable("password_reset_attempts", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  success: boolean("success").notNull().default(false),
}, (table) => ({
  passwordResetAttemptsIdentifierIdx: index("password_reset_attempts_identifier_idx").on(table.identifier),
  passwordResetAttemptsIpIdx: index("password_reset_attempts_ip_idx").on(table.ipAddress),
  passwordResetAttemptsTimeIdx: index("password_reset_attempts_time_idx").on(table.attemptedAt),
}));

// Invites table
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: varchar("accepted_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  invitesTokenIdx: index("invites_token_idx").on(table.token),
  invitesEmailIdx: index("invites_email_idx").on(table.email),
}));

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("related_entity_type", { length: 50 }),
  relatedEntityId: varchar("related_entity_id", { length: 36 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  notificationsUserIdIdx: index("notifications_user_id_idx").on(table.userId),
  notificationsIsReadIdx: index("notifications_is_read_idx").on(table.isRead),
}));

// Academic terms table
export const academicTerms = pgTable("academic_terms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  year: varchar("year", { length: 20 }).notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }).notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default('upcoming'),
  isLocked: boolean("is_locked").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  academicTermsYearIdx: index("academic_terms_year_idx").on(table.year),
  academicTermsStatusIdx: index("academic_terms_status_idx").on(table.status),
  academicTermsCurrentIdx: index("academic_terms_current_idx").on(table.isCurrent),
}));

// Classes table
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  level: varchar("level", { length: 50 }).notNull(),
  capacity: integer("capacity").notNull().default(30),
  classTeacherId: varchar("class_teacher_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  currentTermId: integer("current_term_id").references(() => academicTerms.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  category: varchar("category", { length: 20 }).notNull().default('general'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  subjectsCategoryIdx: index("subjects_category_idx").on(table.category),
  subjectsIsActiveIdx: index("subjects_is_active_idx").on(table.isActive),
}));

// Students table
export const students = pgTable("students", {
  id: varchar("id", { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  admissionNumber: varchar("admission_number", { length: 50 }).notNull().unique(),
  classId: integer("class_id").references(() => classes.id),
  parentId: varchar("parent_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  department: varchar("department", { length: 50 }),
  admissionDate: varchar("admission_date", { length: 10 }).notNull(),
  emergencyContact: varchar("emergency_contact", { length: 255 }),
  emergencyPhone: varchar("emergency_phone", { length: 50 }),
  medicalInfo: text("medical_info"),
  guardianName: varchar("guardian_name", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  studentsDepartmentIdx: index("students_department_idx").on(table.department),
  studentsClassIdIdx: index("students_class_id_idx").on(table.classId),
}));

// Teacher profiles table
export const teacherProfiles = pgTable("teacher_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  staffId: varchar("staff_id", { length: 50 }).unique(),
  subjects: text("subjects").notNull().default('[]'),
  assignedClasses: text("assigned_classes").notNull().default('[]'),
  qualification: text("qualification"),
  yearsOfExperience: integer("years_of_experience").notNull().default(0),
  specialization: varchar("specialization", { length: 255 }),
  department: varchar("department", { length: 255 }),
  signatureUrl: text("signature_url"),
  gradingMode: varchar("grading_mode", { length: 20 }).notNull().default('manual'),
  autoGradeTheoryQuestions: boolean("auto_grade_theory_questions").notNull().default(false),
  theoryGradingInstructions: text("theory_grading_instructions"),
  notificationPreference: varchar("notification_preference", { length: 20 }).notNull().default('all'),
  availability: text("availability"),
  firstLogin: boolean("first_login").notNull().default(true),
  verified: boolean("verified").notNull().default(false),
  verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin profiles table
export const adminProfiles = pgTable("admin_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  department: varchar("department", { length: 255 }),
  roleDescription: text("role_description"),
  accessLevel: varchar("access_level", { length: 50 }),
  signatureUrl: text("signature_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Parent profiles table
export const parentProfiles = pgTable("parent_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  occupation: varchar("occupation", { length: 255 }),
  contactPreference: varchar("contact_preference", { length: 50 }),
  linkedStudents: text("linked_students").notNull().default('[]'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Super Admin profiles table
export const superAdminProfiles = pgTable("super_admin_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  department: varchar("department", { length: 255 }),
  accessLevel: varchar("access_level", { length: 50 }).notNull().default('full'),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  lastPasswordChange: timestamp("last_password_change"),
  signatureUrl: text("signature_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System settings table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  schoolName: varchar("school_name", { length: 255 }),
  schoolShortName: varchar("school_short_name", { length: 50 }),
  schoolMotto: text("school_motto"),
  schoolLogo: text("school_logo"),
  favicon: text("favicon"),
  schoolAddress: text("school_address"),
  schoolPhones: text("school_phones").default('[]'),
  schoolEmails: text("school_emails").default('[]'),
  websiteTitle: varchar("website_title", { length: 255 }),
  footerText: text("footer_text"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceModeMessage: text("maintenance_mode_message"),
  enableSmsNotifications: boolean("enable_sms_notifications").notNull().default(false),
  enableEmailNotifications: boolean("enable_email_notifications").notNull().default(true),
  enableExamsModule: boolean("enable_exams_module").notNull().default(true),
  enableAttendanceModule: boolean("enable_attendance_module").notNull().default(true),
  enableResultsModule: boolean("enable_results_module").notNull().default(true),
  themeColor: varchar("theme_color", { length: 50 }).notNull().default('blue'),
  usernameStudentPrefix: varchar("username_student_prefix", { length: 50 }).notNull().default('THS-STU'),
  usernameParentPrefix: varchar("username_parent_prefix", { length: 50 }).notNull().default('THS-PAR'),
  usernameTeacherPrefix: varchar("username_teacher_prefix", { length: 50 }).notNull().default('THS-TCH'),
  usernameAdminPrefix: varchar("username_admin_prefix", { length: 50 }).notNull().default('THS-ADM'),
  tempPasswordFormat: varchar("temp_password_format", { length: 100 }).notNull().default('THS@{year}#{random4}'),
  hideAdminAccountsFromAdmins: boolean("hide_admin_accounts_from_admins").notNull().default(true),
  testWeight: integer("test_weight").notNull().default(40),
  examWeight: integer("exam_weight").notNull().default(60),
  defaultGradingScale: varchar("default_grading_scale", { length: 50 }).notNull().default('standard'),
  scoreAggregationMode: varchar("score_aggregation_mode", { length: 20 }).notNull().default('last'),
  autoCreateReportCard: boolean("auto_create_report_card").notNull().default(true),
  showGradeBreakdown: boolean("show_grade_breakdown").notNull().default(true),
  allowTeacherOverrides: boolean("allow_teacher_overrides").notNull().default(true),
  positioningMethod: varchar("positioning_method", { length: 20 }).notNull().default('average'),
  deletedUserRetentionDays: integer("deleted_user_retention_days").notNull().default(30),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Attendance table
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  date: varchar("date", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  recordedBy: varchar("recorded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Exams table
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  totalMarks: integer("total_marks").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  teacherInChargeId: varchar("teacher_in_charge_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  examType: varchar("exam_type", { length: 20 }).notNull().default('exam'),
  timerMode: varchar("timer_mode", { length: 20 }).notNull().default('individual'),
  timeLimit: integer("time_limit"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  instructions: text("instructions"),
  isPublished: boolean("is_published").notNull().default(false),
  allowRetakes: boolean("allow_retakes").notNull().default(false),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
  autoGradingEnabled: boolean("auto_grading_enabled").notNull().default(true),
  instantFeedback: boolean("instant_feedback").notNull().default(false),
  showCorrectAnswers: boolean("show_correct_answers").notNull().default(false),
  passingScore: integer("passing_score"),
  gradingScale: varchar("grading_scale", { length: 50 }).notNull().default('standard'),
  enableProctoring: boolean("enable_proctoring").notNull().default(false),
  lockdownMode: boolean("lockdown_mode").notNull().default(false),
  requireWebcam: boolean("require_webcam").notNull().default(false),
  requireFullscreen: boolean("require_fullscreen").notNull().default(false),
  maxTabSwitches: integer("max_tab_switches").notNull().default(3),
  shuffleOptions: boolean("shuffle_options").notNull().default(false),
});

// Exam questions table
export const examQuestions = pgTable("exam_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type", { length: 50 }).notNull(),
  points: integer("points").notNull().default(1),
  orderNumber: integer("order_number").notNull(),
  imageUrl: text("image_url"),
  autoGradable: boolean("auto_gradable").notNull().default(true),
  expectedAnswers: text("expected_answers").notNull().default('[]'),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  allowPartialCredit: boolean("allow_partial_credit").notNull().default(false),
  partialCreditRules: text("partial_credit_rules"),
  explanationText: text("explanation_text"),
  hintText: text("hint_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  examQuestionsExamIdIdx: index("exam_questions_exam_id_idx").on(table.examId),
  examQuestionsOrderIdx: index("exam_questions_order_idx").on(table.examId, table.orderNumber),
}));

// Question options table
export const questionOptions = pgTable("question_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => examQuestions.id),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderNumber: integer("order_number").notNull(),
  partialCreditValue: integer("partial_credit_value").notNull().default(0),
  explanationText: text("explanation_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  questionOptionsQuestionIdIdx: index("question_options_question_id_idx").on(table.questionId),
  questionOptionsCorrectIdx: index("question_options_correct_idx").on(table.questionId, table.isCorrect),
}));

// Student exam sessions table
export const examSessions = pgTable("exam_sessions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
  timeRemaining: integer("time_remaining"),
  isCompleted: boolean("is_completed").notNull().default(false),
  score: integer("score"),
  maxScore: integer("max_score"),
  status: varchar("status", { length: 20 }).notNull().default('in_progress'),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  examSessionsExamStudentIdx: index("exam_sessions_exam_student_idx").on(table.examId, table.studentId),
  examSessionsStudentCompletedIdx: index("exam_sessions_student_completed_idx").on(table.studentId, table.isCompleted),
  examSessionsActiveSessionsIdx: index("exam_sessions_active_idx").on(table.examId, table.studentId, table.isCompleted),
}));

// Student answers table
export const studentAnswers = pgTable("student_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => examSessions.id),
  questionId: integer("question_id").notNull().references(() => examQuestions.id),
  selectedOptionId: integer("selected_option_id").references(() => questionOptions.id),
  textAnswer: text("text_answer"),
  isCorrect: boolean("is_correct"),
  pointsEarned: integer("points_earned").notNull().default(0),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
  autoScored: boolean("auto_scored").notNull().default(false),
  manualOverride: boolean("manual_override").notNull().default(false),
  feedbackText: text("feedback_text"),
  partialCreditReason: text("partial_credit_reason"),
}, (table) => ({
  studentAnswersSessionIdIdx: index("student_answers_session_id_idx").on(table.sessionId),
  studentAnswersSessionQuestionIdx: index("student_answers_session_question_idx").on(table.sessionId, table.questionId),
  studentAnswersQuestionIdx: index("student_answers_question_id_idx").on(table.questionId),
}));

// Exam results table
export const examResults = pgTable("exam_results", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  score: integer("score"),
  maxScore: integer("max_score"),
  marksObtained: integer("marks_obtained"),
  grade: varchar("grade", { length: 10 }),
  remarks: text("remarks"),
  autoScored: boolean("auto_scored").notNull().default(false),
  recordedBy: varchar("recorded_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  examResultsExamIdIdx: index("exam_results_exam_id_idx").on(table.examId),
  examResultsStudentIdIdx: index("exam_results_student_id_idx").on(table.studentId),
  examResultsExamStudentIdx: index("exam_results_exam_student_idx").on(table.examId, table.studentId),
  examResultsAutoScoredIdx: index("exam_results_auto_scored_idx").on(table.autoScored, table.examId),
}));

// Exam submissions archive table - stores archived exam submissions when retakes are allowed
export const examSubmissionsArchive = pgTable("exam_submissions_archive", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  originalResultId: integer("original_result_id"),
  originalSessionId: integer("original_session_id"),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  grade: varchar("grade", { length: 10 }),
  remarks: text("remarks"),
  answersSnapshot: text("answers_snapshot"),
  archivedBy: varchar("archived_by", { length: 36 }).notNull().references(() => users.id),
  archiveReason: text("archive_reason"),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
}, (table) => ({
  examSubmissionsArchiveExamIdx: index("exam_submissions_archive_exam_idx").on(table.examId),
  examSubmissionsArchiveStudentIdx: index("exam_submissions_archive_student_idx").on(table.studentId),
  examSubmissionsArchiveExamStudentIdx: index("exam_submissions_archive_exam_student_idx").on(table.examId, table.studentId),
}));

// Question Bank tables
export const questionBanks = pgTable("question_banks", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  classLevel: varchar("class_level", { length: 50 }),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  questionBanksSubjectIdx: index("question_banks_subject_idx").on(table.subjectId),
  questionBanksCreatedByIdx: index("question_banks_created_by_idx").on(table.createdBy),
}));

// Question bank items
export const questionBankItems = pgTable("question_bank_items", {
  id: serial("id").primaryKey(),
  bankId: integer("bank_id").notNull().references(() => questionBanks.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type", { length: 50 }).notNull(),
  points: integer("points").notNull().default(1),
  difficulty: varchar("difficulty", { length: 20 }).notNull().default('medium'),
  tags: text("tags").notNull().default('[]'),
  imageUrl: text("image_url"),
  autoGradable: boolean("auto_gradable").notNull().default(true),
  expectedAnswers: text("expected_answers").notNull().default('[]'),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  explanationText: text("explanation_text"),
  hintText: text("hint_text"),
  practicalInstructions: text("practical_instructions"),
  practicalFileUrl: text("practical_file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  questionBankItemsBankIdIdx: index("question_bank_items_bank_id_idx").on(table.bankId),
  questionBankItemsTypeIdx: index("question_bank_items_type_idx").on(table.questionType),
  questionBankItemsDifficultyIdx: index("question_bank_items_difficulty_idx").on(table.difficulty),
}));

// Question bank item options
export const questionBankOptions = pgTable("question_bank_options", {
  id: serial("id").primaryKey(),
  questionItemId: integer("question_item_id").notNull().references(() => questionBankItems.id, { onDelete: 'cascade' }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderNumber: integer("order_number").notNull(),
  explanationText: text("explanation_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  questionBankOptionsItemIdIdx: index("question_bank_options_item_id_idx").on(table.questionItemId),
}));

// Announcements table
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  targetRoles: text("target_roles").notNull().default('["All"]'),
  targetClasses: text("target_classes").notNull().default('[]'),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  
  // Priority & Type
  priority: varchar("priority", { length: 20 }).notNull().default('normal'), // 'normal', 'important', 'urgent'
  announcementType: varchar("announcement_type", { length: 50 }).notNull().default('general'), // 'general', 'academic', 'examination', 'event', 'emergency'
  
  // Scheduling & Expiry
  scheduledAt: timestamp("scheduled_at"),
  expiryDate: timestamp("expiry_date"),
  
  // Attachments (JSON array of file URLs)
  attachments: text("attachments").notNull().default('[]'),
  coverImageUrl: text("cover_image_url"),
  
  // Notification Settings (JSON object)
  notificationSettings: text("notification_settings").notNull().default('{"inApp": true, "email": false, "sms": false}'),
  
  // Status & Analytics
  status: varchar("status", { length: 20 }).notNull().default('draft'), // 'draft', 'scheduled', 'published', 'expired', 'archived'
  viewCount: integer("view_count").notNull().default(0),
  allowComments: boolean("allow_comments").notNull().default(false),
  allowEdit: boolean("allow_edit").notNull().default(true),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  recipientId: varchar("recipient_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gallery categories table
export const galleryCategories = pgTable("gallery_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gallery table
export const gallery = pgTable("gallery", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  categoryId: integer("category_id").references(() => galleryCategories.id),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Home page content table
export const homePageContent = pgTable("home_page_content", {
  id: serial("id").primaryKey(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  imageUrl: text("image_url"),
  altText: varchar("alt_text", { length: 255 }),
  caption: text("caption"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contact messages table
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  response: text("response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Report comment templates table - Admin-managed default comments by performance level
export const reportCommentTemplates = pgTable("report_comment_templates", {
  id: serial("id").primaryKey(),
  role: varchar("role", { length: 20 }).notNull(), // 'teacher' or 'principal'
  performanceLevel: varchar("performance_level", { length: 30 }).notNull(), // 'excellent', 'very_good', 'good', 'fair', 'needs_improvement'
  minPercentage: integer("min_percentage").notNull(),
  maxPercentage: integer("max_percentage").notNull(),
  commentTemplate: text("comment_template").notNull(), // Use {lastName} as placeholder
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Report cards table
export const reportCards = pgTable("report_cards", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  sessionYear: varchar("session_year", { length: 20 }),
  totalScore: integer("total_score"),
  averageScore: integer("average_score"),
  averagePercentage: integer("average_percentage"),
  overallGrade: varchar("overall_grade", { length: 10 }),
  position: integer("position"),
  totalStudentsInClass: integer("total_students_in_class"),
  teacherRemarks: text("teacher_remarks"),
  principalRemarks: text("principal_remarks"),
  status: varchar("status", { length: 20 }).notNull().default('draft'),
  gradingScale: varchar("grading_scale", { length: 50 }).notNull().default('standard'),
  scoreAggregationMode: varchar("score_aggregation_mode", { length: 20 }).notNull().default('last'),
  generatedBy: varchar("generated_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  signedBy: varchar("signed_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  signedAt: timestamp("signed_at"),
  teacherSignedBy: varchar("teacher_signed_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  teacherSignedAt: timestamp("teacher_signed_at"),
  teacherSignatureUrl: text("teacher_signature_url"),
  principalSignedBy: varchar("principal_signed_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  principalSignedAt: timestamp("principal_signed_at"),
  principalSignatureUrl: text("principal_signature_url"),
  generatedAt: timestamp("generated_at"),
  finalizedAt: timestamp("finalized_at"),
  publishedAt: timestamp("published_at"),
  locked: boolean("locked").notNull().default(false),
  autoGenerated: boolean("auto_generated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  reportCardsStudentTermIdx: index("report_cards_student_term_idx").on(table.studentId, table.termId),
  reportCardsClassTermIdx: index("report_cards_class_term_idx").on(table.classId, table.termId),
  reportCardsSessionYearIdx: index("report_cards_session_year_idx").on(table.sessionYear),
}));

// Report card items table
export const reportCardItems = pgTable("report_card_items", {
  id: serial("id").primaryKey(),
  reportCardId: integer("report_card_id").notNull().references(() => reportCards.id, { onDelete: 'cascade' }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  testExamId: integer("test_exam_id").references(() => exams.id, { onDelete: 'set null' }),
  testExamCreatedBy: varchar("test_exam_created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  testScore: integer("test_score"),
  testMaxScore: integer("test_max_score"),
  testWeightedScore: integer("test_weighted_score"),
  examExamId: integer("exam_exam_id").references(() => exams.id, { onDelete: 'set null' }),
  examExamCreatedBy: varchar("exam_exam_created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  examScore: integer("exam_score"),
  examMaxScore: integer("exam_max_score"),
  examWeightedScore: integer("exam_weighted_score"),
  totalMarks: integer("total_marks").notNull().default(100),
  obtainedMarks: integer("obtained_marks").notNull().default(0),
  percentage: integer("percentage").notNull().default(0),
  grade: varchar("grade", { length: 10 }),
  remarks: text("remarks"),
  teacherRemarks: text("teacher_remarks"),
  isOverridden: boolean("is_overridden").notNull().default(false),
  overriddenBy: varchar("overridden_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  overriddenAt: timestamp("overridden_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  reportCardItemsReportCardIdx: index("report_card_items_report_card_idx").on(table.reportCardId),
  reportCardItemsSubjectIdx: index("report_card_items_subject_idx").on(table.subjectId),
  reportCardItemsTeacherIdx: index("report_card_items_teacher_idx").on(table.teacherId),
  reportCardItemsTestCreatedByIdx: index("report_card_items_test_created_by_idx").on(table.testExamCreatedBy),
  reportCardItemsExamCreatedByIdx: index("report_card_items_exam_created_by_idx").on(table.examExamCreatedBy),
}));

// Report card skills table - Stores cognitive/affective and psychomotor skill ratings
export const reportCardSkills = pgTable("report_card_skills", {
  id: serial("id").primaryKey(),
  reportCardId: integer("report_card_id").notNull().references(() => reportCards.id, { onDelete: 'cascade' }),
  // Affective traits (1-5 scale)
  punctuality: integer("punctuality"),
  neatness: integer("neatness"),
  attentiveness: integer("attentiveness"),
  teamwork: integer("teamwork"),
  leadership: integer("leadership"),
  assignments: integer("assignments"),
  classParticipation: integer("class_participation"),
  // Psychomotor skills (1-5 scale)
  sports: integer("sports"),
  handwriting: integer("handwriting"),
  musicalSkills: integer("musical_skills"),
  creativity: integer("creativity"),
  // Metadata
  recordedBy: varchar("recorded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  reportCardSkillsReportCardIdx: index("report_card_skills_report_card_idx").on(table.reportCardId),
}));

// Study resources table
export const studyResources = pgTable("study_resources", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: integer("file_size"),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  classId: integer("class_id").references(() => classes.id),
  subjectId: integer("subject_id").references(() => subjects.id),
  termId: integer("term_id").references(() => academicTerms.id),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  downloadCount: integer("download_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  studyResourcesClassIdx: index("study_resources_class_idx").on(table.classId),
  studyResourcesSubjectIdx: index("study_resources_subject_idx").on(table.subjectId),
  studyResourcesTypeIdx: index("study_resources_type_idx").on(table.resourceType),
}));

// Teacher class assignments table
export const teacherClassAssignments = pgTable("teacher_class_assignments", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  department: varchar("department", { length: 50 }),
  termId: integer("term_id").references(() => academicTerms.id),
  session: varchar("session", { length: 20 }), // Academic session e.g., "2024/2025"
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean("is_active").notNull().default(true),
  validUntil: timestamp("valid_until"), // Optional expiration date
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  teacherClassAssignmentsTeacherIdx: index("teacher_class_assignments_teacher_idx").on(table.teacherId),
  teacherClassAssignmentsClassSubjectIdx: index("teacher_class_assignments_class_subject_idx").on(table.classId, table.subjectId),
  teacherClassAssignmentsDeptIdx: index("teacher_class_assignments_dept_idx").on(table.department),
  teacherClassAssignmentsSessionIdx: index("teacher_class_assignments_session_idx").on(table.session),
  teacherClassAssignmentsUniqueIdx: uniqueIndex("teacher_class_assignments_unique_idx").on(table.teacherId, table.classId, table.subjectId, table.termId),
}));

// Teacher assignment history/audit log
export const teacherAssignmentHistory = pgTable("teacher_assignment_history", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").references(() => teacherClassAssignments.id, { onDelete: 'set null' }),
  teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  action: varchar("action", { length: 50 }).notNull(), // 'created', 'updated', 'disabled', 'deleted'
  previousValues: text("previous_values"), // JSON of old values
  newValues: text("new_values"), // JSON of new values
  performedBy: varchar("performed_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  assignmentHistoryTeacherIdx: index("assignment_history_teacher_idx").on(table.teacherId),
  assignmentHistoryActionIdx: index("assignment_history_action_idx").on(table.action),
  assignmentHistoryDateIdx: index("assignment_history_date_idx").on(table.createdAt),
}));

// Grading boundaries table - Configurable grade thresholds
export const gradingBoundaries = pgTable("grading_boundaries", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Standard", "Custom Science"
  grade: varchar("grade", { length: 10 }).notNull(), // e.g., "A", "B", "C", "D", "E", "F"
  minScore: integer("min_score").notNull(), // Minimum score for this grade
  maxScore: integer("max_score").notNull(), // Maximum score for this grade
  remark: varchar("remark", { length: 100 }), // e.g., "Excellent", "Very Good", "Good", "Pass", "Fail"
  gradePoint: integer("grade_point"), // Optional: for GPA calculation
  isDefault: boolean("is_default").notNull().default(false),
  termId: integer("term_id").references(() => academicTerms.id),
  classId: integer("class_id").references(() => classes.id), // Optional: class-specific grading
  subjectId: integer("subject_id").references(() => subjects.id), // Optional: subject-specific grading
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  gradingBoundariesNameIdx: index("grading_boundaries_name_idx").on(table.name),
  gradingBoundariesGradeIdx: index("grading_boundaries_grade_idx").on(table.grade),
  gradingBoundariesDefaultIdx: index("grading_boundaries_default_idx").on(table.isDefault),
}));

// Continuous Assessment scores table
export const continuousAssessment = pgTable("continuous_assessment", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  testScore: integer("test_score"), // CA score (max typically 40)
  examScore: integer("exam_score"), // Exam score (max typically 60)
  totalScore: integer("total_score"), // Calculated: testScore + examScore
  grade: varchar("grade", { length: 10 }), // Auto-calculated based on grading boundaries
  remark: varchar("remark", { length: 100 }),
  teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  enteredBy: varchar("entered_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp("verified_at"),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedBy: varchar("locked_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  caStudentIdx: index("ca_student_idx").on(table.studentId),
  caClassSubjectIdx: index("ca_class_subject_idx").on(table.classId, table.subjectId),
  caTermIdx: index("ca_term_idx").on(table.termId),
  caTeacherIdx: index("ca_teacher_idx").on(table.teacherId),
  caUniqueIdx: uniqueIndex("ca_unique_idx").on(table.studentId, table.subjectId, table.classId, table.termId),
}));

// Unauthorized access attempts log
export const unauthorizedAccessLogs = pgTable("unauthorized_access_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  attemptedAction: varchar("attempted_action", { length: 100 }).notNull(),
  attemptedResource: varchar("attempted_resource", { length: 255 }).notNull(),
  classId: integer("class_id").references(() => classes.id),
  subjectId: integer("subject_id").references(() => subjects.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  reason: text("reason"), // Why access was denied
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  unauthorizedUserIdx: index("unauthorized_user_idx").on(table.userId),
  unauthorizedActionIdx: index("unauthorized_action_idx").on(table.attemptedAction),
  unauthorizedDateIdx: index("unauthorized_date_idx").on(table.createdAt),
}));

// Student subject assignments table - Links students to their assigned subjects based on class and department
export const studentSubjectAssignments = pgTable("student_subject_assignments", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  termId: integer("term_id").references(() => academicTerms.id),
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  studentSubjectAssignmentsStudentIdx: index("student_subject_assignments_student_idx").on(table.studentId),
  studentSubjectAssignmentsSubjectIdx: index("student_subject_assignments_subject_idx").on(table.subjectId),
  studentSubjectAssignmentsClassIdx: index("student_subject_assignments_class_idx").on(table.classId),
  studentSubjectAssignmentsUniqueIdx: uniqueIndex("student_subject_assignments_unique_idx").on(table.studentId, table.subjectId, table.classId),
}));

// Class subject mappings table - Defines which subjects are available for each class level
export const classSubjectMappings = pgTable("class_subject_mappings", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  department: varchar("department", { length: 50 }),
  isCompulsory: boolean("is_compulsory").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  classSubjectMappingsClassIdx: index("class_subject_mappings_class_idx").on(table.classId),
  classSubjectMappingsSubjectIdx: index("class_subject_mappings_subject_idx").on(table.subjectId),
  classSubjectMappingsDeptIdx: index("class_subject_mappings_dept_idx").on(table.department),
  classSubjectMappingsUniqueIdx: uniqueIndex("class_subject_mappings_unique_idx").on(table.classId, table.subjectId, table.department),
}));

// Timetable table
export const timetable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  termId: integer("term_id").references(() => academicTerms.id),
  dayOfWeek: varchar("day_of_week", { length: 20 }).notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  location: varchar("location", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  timetableTeacherIdx: index("timetable_teacher_idx").on(table.teacherId),
  timetableClassIdx: index("timetable_class_idx").on(table.classId),
  timetableDayIdx: index("timetable_day_idx").on(table.dayOfWeek),
}));

// Grading tasks table
export const gradingTasks = pgTable("grading_tasks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => examSessions.id),
  questionId: integer("question_id").notNull().references(() => examQuestions.id),
  answerId: integer("answer_id").notNull().references(() => studentAnswers.id),
  teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  priority: integer("priority").notNull().default(0),
  aiSuggestedScore: integer("ai_suggested_score"),
  aiConfidence: integer("ai_confidence"),
  aiReasoning: text("ai_reasoning"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  gradingTasksTeacherIdx: index("grading_tasks_teacher_idx").on(table.teacherId),
  gradingTasksStatusIdx: index("grading_tasks_status_idx").on(table.status),
  gradingTasksSessionIdx: index("grading_tasks_session_idx").on(table.sessionId),
}));

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  auditLogsUserIdx: index("audit_logs_user_idx").on(table.userId),
  auditLogsEntityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  auditLogsDateIdx: index("audit_logs_date_idx").on(table.createdAt),
  auditLogsActionIdx: index("audit_logs_action_idx").on(table.action),
}));

// Performance events table
export const performanceEvents = pgTable("performance_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => examSessions.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  duration: integer("duration").notNull().default(0),
  goalAchieved: boolean("goal_achieved").notNull().default(false),
  metadata: text("metadata"),
  clientSide: boolean("client_side").notNull().default(false),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  performanceEventsTypeIdx: index("performance_events_type_idx").on(table.eventType),
  performanceEventsDateIdx: index("performance_events_date_idx").on(table.createdAt),
  performanceEventsSessionIdx: index("performance_events_session_idx").on(table.sessionId),
  performanceEventsGoalIdx: index("performance_events_goal_idx").on(table.goalAchieved, table.eventType),
}));

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Counters table for username generation
export const counters = pgTable("counters", {
  id: serial("id").primaryKey(),
  roleCode: varchar("role_code", { length: 10 }).notNull(),
  classCode: varchar("class_code", { length: 50 }),
  year: varchar("year", { length: 10 }),
  sequence: integer("sequence").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  countersRoleCodeIdx: uniqueIndex("counters_role_code_idx").on(table.roleCode),
}));

// Vacancies table
export const vacancies = pgTable("vacancies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  deadline: timestamp("deadline").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('open'),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  vacanciesStatusIdx: index("vacancies_status_idx").on(table.status),
  vacanciesDeadlineIdx: index("vacancies_deadline_idx").on(table.deadline),
}));

// Teacher applications table
export const teacherApplications = pgTable("teacher_applications", {
  id: varchar("id", { length: 36 }).primaryKey(),
  vacancyId: varchar("vacancy_id", { length: 36 }).references(() => vacancies.id, { onDelete: 'set null' }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  qualifications: text("qualifications"),
  experience: text("experience"),
  subjectSpecialty: varchar("subject_specialty", { length: 255 }),
  coverLetter: text("cover_letter"),
  resumeUrl: text("resume_url"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  teacherApplicationsStatusIdx: index("teacher_applications_status_idx").on(table.status),
  teacherApplicationsEmailIdx: index("teacher_applications_email_idx").on(table.email),
}));

// Approved teachers table
export const approvedTeachers = pgTable("approved_teachers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  applicationId: varchar("application_id", { length: 36 }).references(() => teacherApplications.id, { onDelete: 'set null' }),
  googleEmail: varchar("google_email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  subjectSpecialty: varchar("subject_specialty", { length: 255 }),
  approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  dateApproved: timestamp("date_approved").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  approvedTeachersEmailIdx: index("approved_teachers_email_idx").on(table.googleEmail),
}));

// Sync audit log table - tracks all exam-to-report-card sync attempts for reliability and debugging
export const syncAuditLogs = pgTable("sync_audit_logs", {
  id: serial("id").primaryKey(),
  syncType: varchar("sync_type", { length: 50 }).notNull(), // 'exam_submit', 'manual_sync', 'bulk_sync', 'retry'
  studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  examId: integer("exam_id").references(() => exams.id, { onDelete: 'set null' }),
  examResultId: integer("exam_result_id").references(() => examResults.id, { onDelete: 'set null' }),
  reportCardId: integer("report_card_id").references(() => reportCards.id, { onDelete: 'set null' }),
  reportCardItemId: integer("report_card_item_id").references(() => reportCardItems.id, { onDelete: 'set null' }),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: 'set null' }),
  termId: integer("term_id").references(() => academicTerms.id, { onDelete: 'set null' }),
  score: integer("score"),
  maxScore: integer("max_score"),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // 'pending', 'success', 'failed', 'retrying'
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  lastRetryAt: timestamp("last_retry_at"),
  nextRetryAt: timestamp("next_retry_at"),
  triggeredBy: varchar("triggered_by", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  syncedAt: timestamp("synced_at"),
  metadata: text("metadata"), // JSON string for additional context
  idempotencyKey: varchar("idempotency_key", { length: 100 }), // Prevents duplicate syncs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  syncAuditLogsStudentIdx: index("sync_audit_logs_student_idx").on(table.studentId),
  syncAuditLogsExamIdx: index("sync_audit_logs_exam_idx").on(table.examId),
  syncAuditLogsStatusIdx: index("sync_audit_logs_status_idx").on(table.status),
  syncAuditLogsTypeIdx: index("sync_audit_logs_type_idx").on(table.syncType),
  syncAuditLogsIdempotencyIdx: uniqueIndex("sync_audit_logs_idempotency_idx").on(table.idempotencyKey),
  syncAuditLogsCreatedAtIdx: index("sync_audit_logs_created_at_idx").on(table.createdAt),
  syncAuditLogsRetryIdx: index("sync_audit_logs_retry_idx").on(table.status, table.nextRetryAt),
}));

// Export types (compatible with SQLite schema types)
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = typeof subjects.$inferInsert;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type InsertExam = typeof exams.$inferInsert;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type InsertExamQuestion = typeof examQuestions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertQuestionOption = typeof questionOptions.$inferInsert;
export type ExamSession = typeof examSessions.$inferSelect;
export type InsertExamSession = typeof examSessions.$inferInsert;
export type StudentAnswer = typeof studentAnswers.$inferSelect;
export type InsertStudentAnswer = typeof studentAnswers.$inferInsert;
export type ExamResult = typeof examResults.$inferSelect;
export type InsertExamResult = typeof examResults.$inferInsert;
export type ExamSubmissionsArchive = typeof examSubmissionsArchive.$inferSelect;
export type InsertExamSubmissionsArchive = typeof examSubmissionsArchive.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type GalleryCategory = typeof galleryCategories.$inferSelect;
export type InsertGalleryCategory = typeof galleryCategories.$inferInsert;
export type Gallery = typeof gallery.$inferSelect;
export type InsertGallery = typeof gallery.$inferInsert;
export type HomePageContent = typeof homePageContent.$inferSelect;
export type InsertHomePageContent = typeof homePageContent.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;
export type ReportCommentTemplate = typeof reportCommentTemplates.$inferSelect;
export type InsertReportCommentTemplate = typeof reportCommentTemplates.$inferInsert;
export type ReportCard = typeof reportCards.$inferSelect;
export type InsertReportCard = typeof reportCards.$inferInsert;
export type ReportCardItem = typeof reportCardItems.$inferSelect;
export type InsertReportCardItem = typeof reportCardItems.$inferInsert;
export type ReportCardSkills = typeof reportCardSkills.$inferSelect;
export type InsertReportCardSkills = typeof reportCardSkills.$inferInsert;
export type StudyResource = typeof studyResources.$inferSelect;
export type InsertStudyResource = typeof studyResources.$inferInsert;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type InsertTeacherProfile = typeof teacherProfiles.$inferInsert;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type InsertAdminProfile = typeof adminProfiles.$inferInsert;
export type ParentProfile = typeof parentProfiles.$inferSelect;
export type InsertParentProfile = typeof parentProfiles.$inferInsert;
export type SuperAdminProfile = typeof superAdminProfiles.$inferSelect;
export type InsertSuperAdminProfile = typeof superAdminProfiles.$inferInsert;
export type AcademicTerm = typeof academicTerms.$inferSelect;
export type InsertAcademicTerm = typeof academicTerms.$inferInsert;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type PasswordResetAttempt = typeof passwordResetAttempts.$inferSelect;
export type InsertPasswordResetAttempt = typeof passwordResetAttempts.$inferInsert;
export type TeacherClassAssignment = typeof teacherClassAssignments.$inferSelect;
export type InsertTeacherClassAssignment = typeof teacherClassAssignments.$inferInsert;
export type Timetable = typeof timetable.$inferSelect;
export type InsertTimetable = typeof timetable.$inferInsert;
export type GradingTask = typeof gradingTasks.$inferSelect;
export type InsertGradingTask = typeof gradingTasks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type PerformanceEvent = typeof performanceEvents.$inferSelect;
export type InsertPerformanceEvent = typeof performanceEvents.$inferInsert;
export type QuestionBank = typeof questionBanks.$inferSelect;
export type InsertQuestionBank = typeof questionBanks.$inferInsert;
export type QuestionBankItem = typeof questionBankItems.$inferSelect;
export type InsertQuestionBankItem = typeof questionBankItems.$inferInsert;
export type QuestionBankOption = typeof questionBankOptions.$inferSelect;
export type InsertQuestionBankOption = typeof questionBankOptions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;
export type Counter = typeof counters.$inferSelect;
export type InsertCounter = typeof counters.$inferInsert;
export type Vacancy = typeof vacancies.$inferSelect;
export type InsertVacancy = typeof vacancies.$inferInsert;
export type TeacherApplication = typeof teacherApplications.$inferSelect;
export type InsertTeacherApplication = typeof teacherApplications.$inferInsert;
export type ApprovedTeacher = typeof approvedTeachers.$inferSelect;
export type InsertApprovedTeacher = typeof approvedTeachers.$inferInsert;
export type StudentSubjectAssignment = typeof studentSubjectAssignments.$inferSelect;
export type InsertStudentSubjectAssignment = typeof studentSubjectAssignments.$inferInsert;
export type ClassSubjectMapping = typeof classSubjectMappings.$inferSelect;
export type InsertClassSubjectMapping = typeof classSubjectMappings.$inferInsert;
export type SyncAuditLog = typeof syncAuditLogs.$inferSelect;
export type InsertSyncAuditLog = typeof syncAuditLogs.$inferInsert;
