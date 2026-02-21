import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// SQLite doesn't support enums, so we use text columns with defaults
// Gender values: 'Male', 'Female', 'Other'
// AttendanceStatus values: 'Present', 'Absent', 'Late', 'Excused'
// ReportCardStatus values: 'draft', 'finalized', 'published'
// ExamType values: 'test', 'exam'
// UserStatus values: 'pending', 'active', 'suspended', 'disabled'
// CreatedVia values: 'bulk', 'invite', 'self', 'google', 'admin'
// VacancyStatus values: 'open', 'closed', 'filled'
// ApplicationStatus values: 'pending', 'approved', 'rejected'

// Roles table
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  permissions: text("permissions").notNull().default('[]'), // JSON array as text
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  email: text("email").notNull(),
  recoveryEmail: text("recovery_email"),
  passwordHash: text("password_hash"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  roleId: integer("role_id").notNull().references(() => roles.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  address: text("address"),
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD format
  gender: text("gender"), // 'Male', 'Female', 'Other'
  nationalId: text("national_id"),
  profileImageUrl: text("profile_image_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  authProvider: text("auth_provider").notNull().default('local'),
  googleId: text("google_id").unique(),

  // Security & audit fields
  status: text("status").notNull().default('active'), // 'pending', 'active', 'suspended', 'disabled'
  createdVia: text("created_via").notNull().default('admin'), // 'bulk', 'invite', 'self', 'google', 'admin'
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  lastLoginIp: text("last_login_ip"),
  mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).notNull().default(false),
  mfaSecret: text("mfa_secret"),
  accountLockedUntil: integer("account_locked_until", { mode: "timestamp" }),

  // Profile completion fields
  profileCompleted: integer("profile_completed", { mode: "boolean" }).notNull().default(false),
  profileSkipped: integer("profile_skipped", { mode: "boolean" }).notNull().default(false),
  profileCompletionPercentage: integer("profile_completion_percentage").notNull().default(0),
  state: text("state"),
  country: text("country"),
  securityQuestion: text("security_question"),
  securityAnswerHash: text("security_answer_hash"),
  dataPolicyAgreed: integer("data_policy_agreed", { mode: "boolean" }).notNull().default(false),
  dataPolicyAgreedAt: integer("data_policy_agreed_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  usersEmailIdx: index("users_email_idx").on(table.email),
  usersStatusIdx: index("users_status_idx").on(table.status),
  usersGoogleIdIdx: index("users_google_id_idx").on(table.googleId),
  usersRoleIdIdx: index("users_role_id_idx").on(table.roleId),
  usersUsernameIdx: index("users_username_idx").on(table.username),
  usersDeletedAtIdx: index("users_deleted_at_idx").on(table.deletedAt),
}));

// Password reset tokens table
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  ipAddress: text("ip_address"),
  resetBy: text("reset_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  passwordResetTokensUserIdIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
  passwordResetTokensTokenIdx: index("password_reset_tokens_token_idx").on(table.token),
}));

// Password reset attempts table
export const passwordResetAttempts = sqliteTable("password_reset_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identifier: text("identifier").notNull(),
  ipAddress: text("ip_address").notNull(),
  attemptedAt: integer("attempted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  success: integer("success", { mode: "boolean" }).notNull().default(false),
}, (table) => ({
  passwordResetAttemptsIdentifierIdx: index("password_reset_attempts_identifier_idx").on(table.identifier),
  passwordResetAttemptsIpIdx: index("password_reset_attempts_ip_idx").on(table.ipAddress),
  passwordResetAttemptsTimeIdx: index("password_reset_attempts_time_idx").on(table.attemptedAt),
}));

// Invites table
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  invitesTokenIdx: index("invites_token_idx").on(table.token),
  invitesEmailIdx: index("invites_email_idx").on(table.email),
}));

// Notifications table
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  notificationsUserIdIdx: index("notifications_user_id_idx").on(table.userId),
  notificationsIsReadIdx: index("notifications_is_read_idx").on(table.isRead),
}));

// Academic terms table
export const academicTerms = sqliteTable("academic_terms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  year: text("year").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD format
  endDate: text("end_date").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default('upcoming'), // upcoming, active, completed, archived
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  academicTermsYearIdx: index("academic_terms_year_idx").on(table.year),
  academicTermsStatusIdx: index("academic_terms_status_idx").on(table.status),
  academicTermsCurrentIdx: index("academic_terms_current_idx").on(table.isCurrent),
}));

// Classes table
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  level: text("level").notNull(),
  capacity: integer("capacity").notNull().default(30),
  classTeacherId: text("class_teacher_id").references(() => users.id, { onDelete: 'set null' }),
  currentTermId: integer("current_term_id").references(() => academicTerms.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Subjects table
export const subjects = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  category: text("category").notNull().default('general'),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Students table
export const students = sqliteTable("students", {
  id: text("id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  admissionNumber: text("admission_number").notNull().unique(),
  classId: integer("class_id").references(() => classes.id),
  parentId: text("parent_id").references(() => users.id, { onDelete: 'set null' }),
  department: text("department"),
  admissionDate: text("admission_date").notNull(), // YYYY-MM-DD format
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  medicalInfo: text("medical_info"),
  guardianName: text("guardian_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Teacher profiles table
export const teacherProfiles = sqliteTable("teacher_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  staffId: text("staff_id").unique(),
  subjects: text("subjects").notNull().default('[]'), // JSON array of integers
  assignedClasses: text("assigned_classes").notNull().default('[]'), // JSON array of integers
  qualification: text("qualification"),
  yearsOfExperience: integer("years_of_experience").notNull().default(0),
  specialization: text("specialization"),
  department: text("department"),
  signatureUrl: text("signature_url"),
  gradingMode: text("grading_mode").notNull().default('manual'),
  autoGradeTheoryQuestions: integer("auto_grade_theory_questions", { mode: "boolean" }).notNull().default(false),
  theoryGradingInstructions: text("theory_grading_instructions"),
  notificationPreference: text("notification_preference").notNull().default('all'),
  availability: text("availability"),
  firstLogin: integer("first_login", { mode: "boolean" }).notNull().default(true),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  verifiedBy: text("verified_by").references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Admin profiles table
export const adminProfiles = sqliteTable("admin_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  department: text("department"),
  roleDescription: text("role_description"),
  accessLevel: text("access_level"),
  signatureUrl: text("signature_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Parent profiles table
export const parentProfiles = sqliteTable("parent_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  occupation: text("occupation"),
  contactPreference: text("contact_preference"),
  linkedStudents: text("linked_students").notNull().default('[]'), // JSON array of UUIDs
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Super Admin profiles table
export const superAdminProfiles = sqliteTable("super_admin_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  department: text("department"),
  accessLevel: text("access_level").notNull().default('full'),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  lastPasswordChange: integer("last_password_change", { mode: "timestamp" }),
  signatureUrl: text("signature_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// System settings table
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolName: text("school_name"),
  schoolShortName: text("school_short_name"),
  schoolMotto: text("school_motto"),
  schoolLogo: text("school_logo"),
  favicon: text("favicon"),
  schoolAddress: text("school_address"),
  schoolPhones: text("school_phones").notNull().default('[]'), // JSON array of {countryCode, number}
  schoolEmails: text("school_emails").notNull().default('[]'), // JSON array of strings
  websiteTitle: text("website_title"),
  footerText: text("footer_text"),
  maintenanceMode: integer("maintenance_mode", { mode: "boolean" }).notNull().default(false),
  maintenanceModeMessage: text("maintenance_mode_message"),
  enableSmsNotifications: integer("enable_sms_notifications", { mode: "boolean" }).notNull().default(false),
  enableEmailNotifications: integer("enable_email_notifications", { mode: "boolean" }).notNull().default(true),
  enableExamsModule: integer("enable_exams_module", { mode: "boolean" }).notNull().default(true),
  enableAttendanceModule: integer("enable_attendance_module", { mode: "boolean" }).notNull().default(true),
  enableResultsModule: integer("enable_results_module", { mode: "boolean" }).notNull().default(true),
  tempPasswordFormat: text("temp_password_format").notNull().default('THS@{year}#{random4}'),
  hideAdminAccountsFromAdmins: integer("hide_admin_accounts_from_admins", { mode: "boolean" }).notNull().default(true),
  testWeight: integer("test_weight").notNull().default(40),
  examWeight: integer("exam_weight").notNull().default(60),
  defaultGradingScale: text("default_grading_scale").notNull().default('standard'),
  scoreAggregationMode: text("score_aggregation_mode").notNull().default('last'),
  autoCreateReportCard: integer("auto_create_report_card", { mode: "boolean" }).notNull().default(true),
  showGradeBreakdown: integer("show_grade_breakdown", { mode: "boolean" }).notNull().default(true),
  allowTeacherOverrides: integer("allow_teacher_overrides", { mode: "boolean" }).notNull().default(true),
  positioningMethod: text("positioning_method").notNull().default('average'),
  deletedUserRetentionDays: integer("deleted_user_retention_days").notNull().default(30),
  // Authentication Settings
  loginIdentifier: text("login_identifier").notNull().default('username'), // 'email', 'username', 'both'
  enableRememberMe: integer("enable_remember_me", { mode: "boolean" }).notNull().default(true),
  enableStudentPortal: integer("enable_student_portal", { mode: "boolean" }).notNull().default(true),
  enableAdminPortal: integer("enable_admin_portal", { mode: "boolean" }).notNull().default(true),
  allowRegistration: integer("allow_registration", { mode: "boolean" }).notNull().default(false),
  defaultRegistrationRoleId: integer("default_registration_role_id").notNull().default(4),
  sessionTimeout: integer("session_timeout").notNull().default(30), // minutes
  allowMultipleLogins: integer("allow_multiple_logins", { mode: "boolean" }).notNull().default(false),
  autoDisableInactiveDays: integer("auto_disable_inactive_days").notNull().default(90),
  requireAdminApproval: integer("require_admin_approval", { mode: "boolean" }).notNull().default(true),
  redirectAfterLogin: text("redirect_after_login").notNull().default('dashboard'), // 'dashboard', 'last_page'
  loginErrorDisplay: text("login_error_display").notNull().default('generic'), // 'generic', 'detailed'
  // Branding & Theme
  primaryColor: text("primary_color").notNull().default('#3b82f6'),
  secondaryColor: text("secondary_color").notNull().default('#1e293b'),
  defaultTheme: text("default_theme").notNull().default('light'), // 'light', 'dark'
  loginPageText: text("login_page_text").notNull().default('Welcome to Treasure Home School Portal'),
  dashboardWelcomeMessage: text("dashboard_welcome_message").notNull().default('Welcome back to your dashboard'),
  // General Configuration
  portalName: text("portal_name").notNull().default('Treasure Home School Portal'),
  timezone: text("timezone").notNull().default('Africa/Lagos'),
  language: text("language").notNull().default('en'),
  dateFormat: text("date_format").notNull().default('DD/MM/YYYY'),
  timeFormat: text("time_format").notNull().default('HH:mm'),
  // Integrations
  enableOnlinePayments: integer("enable_online_payments", { mode: "boolean" }).notNull().default(false),
  // Backup & Restore
  autoBackup: integer("auto_backup", { mode: "boolean" }).notNull().default(false),
  backupFrequency: text("backup_frequency").notNull().default('daily'), // 'daily', 'weekly'
  lastBackupDate: integer("last_backup_date", { mode: "timestamp" }),
  // API & Access Tokens
  enableApiAccess: integer("enable_api_access", { mode: "boolean" }).notNull().default(false),
  apiAccessKey: text("api_access_key"),
  // Security Policies
  minPasswordLength: integer("min_password_length").notNull().default(8),
  requirePasswordNumbers: integer("require_password_numbers", { mode: "boolean" }).notNull().default(true),
  requirePasswordLetters: integer("require_password_letters", { mode: "boolean" }).notNull().default(true),
  requirePasswordSpecial: integer("require_password_special", { mode: "boolean" }).notNull().default(true),
  maxFailedLoginAttempts: integer("max_failed_login_attempts").notNull().default(5),
  enableLockAccount: integer("enable_lock_account", { mode: "boolean" }).notNull().default(true),
  lockoutDuration: integer("lockout_duration").notNull().default(15), // minutes
  passwordResetExpiry: integer("password_reset_expiry").notNull().default(30), // minutes
  invalidateOldPasswordOnReset: integer("invalidate_old_password_on_reset", { mode: "boolean" }).notNull().default(true),
  enableTwoFactor: integer("enable_two_factor", { mode: "boolean" }).notNull().default(false),
  twoFactorTarget: text("two_factor_target").notNull().default('admins'), // 'admins', 'all'
  logoutOnPasswordChange: integer("logout_on_password_change", { mode: "boolean" }).notNull().default(true),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Attendance table
export const attendance = sqliteTable("attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  date: text("date").notNull(), // YYYY-MM-DD format
  status: text("status").notNull(), // 'Present', 'Absent', 'Late', 'Excused'
  recordedBy: text("recorded_by").references(() => users.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Exams table
export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  totalMarks: integer("total_marks").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  teacherInChargeId: text("teacher_in_charge_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  examType: text("exam_type").notNull().default('exam'), // 'test', 'exam'
  timerMode: text("timer_mode").notNull().default('individual'), // 'global', 'individual'
  timeLimit: integer("time_limit"), // in minutes
  startTime: integer("start_time", { mode: "timestamp" }),
  endTime: integer("end_time", { mode: "timestamp" }),
  instructions: text("instructions"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  allowRetakes: integer("allow_retakes", { mode: "boolean" }).notNull().default(false),
  shuffleQuestions: integer("shuffle_questions", { mode: "boolean" }).notNull().default(false),
  autoGradingEnabled: integer("auto_grading_enabled", { mode: "boolean" }).notNull().default(true),
  instantFeedback: integer("instant_feedback", { mode: "boolean" }).notNull().default(false),
  showCorrectAnswers: integer("show_correct_answers", { mode: "boolean" }).notNull().default(false),
  passingScore: integer("passing_score"),
  gradingScale: text("grading_scale").notNull().default('standard'),
  enableProctoring: integer("enable_proctoring", { mode: "boolean" }).notNull().default(false),
  lockdownMode: integer("lockdown_mode", { mode: "boolean" }).notNull().default(false),
  requireWebcam: integer("require_webcam", { mode: "boolean" }).notNull().default(false),
  requireFullscreen: integer("require_fullscreen", { mode: "boolean" }).notNull().default(false),
  maxTabSwitches: integer("max_tab_switches").notNull().default(3),
  shuffleOptions: integer("shuffle_options", { mode: "boolean" }).notNull().default(false),
});

// Exam questions table
export const examQuestions = sqliteTable("exam_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull().references(() => exams.id),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(), // 'multiple_choice', 'text', 'essay', 'true_false', 'fill_blank'
  points: integer("points").notNull().default(1),
  orderNumber: integer("order_number").notNull(),
  imageUrl: text("image_url"),
  autoGradable: integer("auto_gradable", { mode: "boolean" }).notNull().default(true),
  expectedAnswers: text("expected_answers").notNull().default('[]'), // JSON array
  caseSensitive: integer("case_sensitive", { mode: "boolean" }).notNull().default(false),
  allowPartialCredit: integer("allow_partial_credit", { mode: "boolean" }).notNull().default(false),
  partialCreditRules: text("partial_credit_rules"),
  explanationText: text("explanation_text"),
  hintText: text("hint_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  examQuestionsExamIdIdx: index("exam_questions_exam_id_idx").on(table.examId),
  examQuestionsOrderIdx: index("exam_questions_order_idx").on(table.examId, table.orderNumber),
}));

// Question options table
export const questionOptions = sqliteTable("question_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").notNull().references(() => examQuestions.id),
  optionText: text("option_text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  orderNumber: integer("order_number").notNull(),
  partialCreditValue: integer("partial_credit_value").notNull().default(0),
  explanationText: text("explanation_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  questionOptionsQuestionIdIdx: index("question_options_question_id_idx").on(table.questionId),
  questionOptionsCorrectIdx: index("question_options_correct_idx").on(table.questionId, table.isCorrect),
}));

// Student exam sessions table
export const examSessions = sqliteTable("exam_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  timeRemaining: integer("time_remaining"),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  score: integer("score"),
  maxScore: integer("max_score"),
  status: text("status").notNull().default('in_progress'), // 'in_progress', 'submitted', 'graded'
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  examSessionsExamStudentIdx: index("exam_sessions_exam_student_idx").on(table.examId, table.studentId),
  examSessionsStudentCompletedIdx: index("exam_sessions_student_completed_idx").on(table.studentId, table.isCompleted),
  examSessionsActiveSessionsIdx: index("exam_sessions_active_idx").on(table.examId, table.studentId, table.isCompleted),
}));

// Student answers table
export const studentAnswers = sqliteTable("student_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => examSessions.id),
  questionId: integer("question_id").notNull().references(() => examQuestions.id),
  selectedOptionId: integer("selected_option_id").references(() => questionOptions.id),
  textAnswer: text("text_answer"),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  pointsEarned: integer("points_earned").notNull().default(0),
  answeredAt: integer("answered_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  autoScored: integer("auto_scored", { mode: "boolean" }).notNull().default(false),
  manualOverride: integer("manual_override", { mode: "boolean" }).notNull().default(false),
  feedbackText: text("feedback_text"),
  partialCreditReason: text("partial_credit_reason"),
}, (table) => ({
  studentAnswersSessionIdIdx: index("student_answers_session_id_idx").on(table.sessionId),
  studentAnswersSessionQuestionIdx: index("student_answers_session_question_idx").on(table.sessionId, table.questionId),
  studentAnswersQuestionIdx: index("student_answers_question_id_idx").on(table.questionId),
}));

// Exam results table
export const examResults = sqliteTable("exam_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  score: integer("score"),
  maxScore: integer("max_score"),
  marksObtained: integer("marks_obtained"),
  grade: text("grade"),
  remarks: text("remarks"),
  correct_answers: integer("correct_answers"),
  incorrect_answers: integer("incorrect_answers"),
  total_questions: integer("total_questions"),
  submitted_at: integer("submitted_at", { mode: "timestamp" }),
  autoScored: integer("auto_scored", { mode: "boolean" }).notNull().default(false),
  recordedBy: text("recorded_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  examResultsExamIdIdx: index("exam_results_exam_id_idx").on(table.examId),
  examResultsStudentIdIdx: index("exam_results_student_id_idx").on(table.studentId),
  examResultsExamStudentIdx: index("exam_results_exam_student_idx").on(table.examId, table.studentId),
  examResultsAutoScoredIdx: index("exam_results_auto_scored_idx").on(table.autoScored, table.examId),
}));

// Exam submissions archive table - For audit trail when students are allowed to retake exams
export const examSubmissionsArchive = sqliteTable("exam_submissions_archive", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  originalSessionId: integer("original_session_id"),
  originalResultId: integer("original_result_id"),
  oldScore: integer("old_score"),
  oldMaxScore: integer("old_max_score"),
  oldAnswers: text("old_answers"), // JSON string of archived answers
  archivedBy: text("archived_by").notNull().references(() => users.id),
  archiveReason: text("archive_reason").notNull().default('retake_allowed'),
  archivedAt: integer("archived_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  examSubmissionsArchiveExamIdx: index("exam_submissions_archive_exam_idx").on(table.examId),
  examSubmissionsArchiveStudentIdx: index("exam_submissions_archive_student_idx").on(table.studentId),
  examSubmissionsArchiveExamStudentIdx: index("exam_submissions_archive_exam_student_idx").on(table.examId, table.studentId),
}));

// Question Bank tables
export const questionBanks = sqliteTable("question_banks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  classLevel: text("class_level"),
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  questionBanksSubjectIdx: index("question_banks_subject_idx").on(table.subjectId),
  questionBanksCreatedByIdx: index("question_banks_created_by_idx").on(table.createdBy),
}));

// Question bank items
export const questionBankItems = sqliteTable("question_bank_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bankId: integer("bank_id").notNull().references(() => questionBanks.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(),
  points: integer("points").notNull().default(1),
  difficulty: text("difficulty").notNull().default('medium'),
  tags: text("tags").notNull().default('[]'), // JSON array
  imageUrl: text("image_url"),
  autoGradable: integer("auto_gradable", { mode: "boolean" }).notNull().default(true),
  expectedAnswers: text("expected_answers").notNull().default('[]'), // JSON array
  caseSensitive: integer("case_sensitive", { mode: "boolean" }).notNull().default(false),
  explanationText: text("explanation_text"),
  hintText: text("hint_text"),
  practicalInstructions: text("practical_instructions"),
  practicalFileUrl: text("practical_file_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  questionBankItemsBankIdIdx: index("question_bank_items_bank_id_idx").on(table.bankId),
  questionBankItemsTypeIdx: index("question_bank_items_type_idx").on(table.questionType),
  questionBankItemsDifficultyIdx: index("question_bank_items_difficulty_idx").on(table.difficulty),
}));

// Question bank item options
export const questionBankOptions = sqliteTable("question_bank_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionItemId: integer("question_item_id").notNull().references(() => questionBankItems.id, { onDelete: 'cascade' }),
  optionText: text("option_text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  orderNumber: integer("order_number").notNull(),
  explanationText: text("explanation_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  questionBankOptionsItemIdIdx: index("question_bank_options_item_id_idx").on(table.questionItemId),
}));

// Announcements table
export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => users.id, { onDelete: 'set null' }),
  targetRoles: text("target_roles").notNull().default('["All"]'), // JSON array
  targetClasses: text("target_classes").notNull().default('[]'), // JSON array
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  
  // Priority & Type
  priority: text("priority").notNull().default('normal'), // 'normal', 'important', 'urgent'
  announcementType: text("announcement_type").notNull().default('general'), // 'general', 'academic', 'examination', 'event', 'emergency'
  
  // Scheduling & Expiry
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  
  // Attachments (JSON array of file URLs)
  attachments: text("attachments").notNull().default('[]'),
  coverImageUrl: text("cover_image_url"),
  
  // Notification Settings (JSON object)
  notificationSettings: text("notification_settings").notNull().default('{"inApp": true, "email": false, "sms": false}'),
  
  // Status & Analytics
  status: text("status").notNull().default('draft'), // 'draft', 'scheduled', 'published', 'expired', 'archived'
  viewCount: integer("view_count").notNull().default(0),
  allowComments: integer("allow_comments", { mode: "boolean" }).notNull().default(false),
  allowEdit: integer("allow_edit", { mode: "boolean" }).notNull().default(true),
  
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Messages table
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderId: text("sender_id").references(() => users.id, { onDelete: 'set null' }),
  recipientId: text("recipient_id").references(() => users.id, { onDelete: 'set null' }),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Gallery categories table
export const galleryCategories = sqliteTable("gallery_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Gallery table
export const gallery = sqliteTable("gallery", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  categoryId: integer("category_id").references(() => galleryCategories.id),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Home page content table
export const homePageContent = sqliteTable("home_page_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentType: text("content_type").notNull(),
  imageUrl: text("image_url"),
  altText: text("alt_text"),
  caption: text("caption"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Contact messages table
export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  respondedAt: integer("responded_at", { mode: "timestamp" }),
  respondedBy: text("responded_by").references(() => users.id, { onDelete: 'set null' }),
  response: text("response"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Report comment templates table - Admin-managed default comments by performance level
export const reportCommentTemplates = sqliteTable("report_comment_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(), // 'teacher' or 'principal'
  performanceLevel: text("performance_level").notNull(), // 'excellent', 'very_good', 'good', 'fair', 'needs_improvement'
  minPercentage: integer("min_percentage").notNull(),
  maxPercentage: integer("max_percentage").notNull(),
  commentTemplate: text("comment_template").notNull(), // Use {lastName} as placeholder
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Report cards table
export const reportCards = sqliteTable("report_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  averagePercentage: integer("average_percentage"),
  overallGrade: text("overall_grade"),
  teacherRemarks: text("teacher_remarks"),
  principalRemarks: text("principal_remarks"),
  status: text("status").notNull().default('draft'), // 'draft', 'teacher_signed', 'awaiting_approval', 'approved', 'published'
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  teacherSignedBy: text("teacher_signed_by").references(() => users.id, { onDelete: 'set null' }),
  teacherSignedAt: integer("teacher_signed_at", { mode: "timestamp" }),
  teacherSignatureUrl: text("teacher_signature_url"),
  principalSignedBy: text("principal_signed_by").references(() => users.id, { onDelete: 'set null' }),
  principalSignedAt: integer("principal_signed_at", { mode: "timestamp" }),
  principalSignatureUrl: text("principal_signature_url"),
  generatedAt: integer("generated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  finalizedAt: integer("finalized_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Report card items table
export const reportCardItems = sqliteTable("report_card_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportCardId: integer("report_card_id").notNull().references(() => reportCards.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  teacherId: text("teacher_id").references(() => users.id, { onDelete: 'set null' }),
  testExamId: integer("test_exam_id").references(() => exams.id),
  testExamCreatedBy: text("test_exam_created_by").references(() => users.id, { onDelete: 'set null' }),
  testScore: integer("test_score"),
  testMaxScore: integer("test_max_score"),
  testWeightedScore: integer("test_weighted_score"),
  examExamId: integer("exam_exam_id").references(() => exams.id),
  examExamCreatedBy: text("exam_exam_created_by").references(() => users.id, { onDelete: 'set null' }),
  examScore: integer("exam_score"),
  examMaxScore: integer("exam_max_score"),
  examWeightedScore: integer("exam_weighted_score"),
  totalMarks: integer("total_marks").notNull().default(100),
  obtainedMarks: integer("obtained_marks").notNull(),
  percentage: integer("percentage").notNull(),
  grade: text("grade"),
  teacherRemarks: text("teacher_remarks"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Report card skills table - Stores cognitive/affective and psychomotor skill ratings
export const reportCardSkills = sqliteTable("report_card_skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  recordedBy: text("recorded_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  reportCardSkillsReportCardIdx: index("report_card_skills_report_card_idx").on(table.reportCardId),
}));

// Study resources table
export const studyResources = sqliteTable("study_resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  resourceType: text("resource_type").notNull(),
  subjectId: integer("subject_id").references(() => subjects.id),
  classId: integer("class_id").references(() => classes.id),
  termId: integer("term_id").references(() => academicTerms.id),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: 'set null' }),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  downloads: integer("downloads").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Performance events table
export const performanceEvents = sqliteTable("performance_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => examSessions.id),
  eventType: text("event_type").notNull(),
  duration: integer("duration").notNull(),
  goalAchieved: integer("goal_achieved", { mode: "boolean" }).notNull(),
  metadata: text("metadata"),
  clientSide: integer("client_side", { mode: "boolean" }).notNull().default(false),
  userId: text("user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  performanceEventsTypeIdx: index("performance_events_type_idx").on(table.eventType),
  performanceEventsDateIdx: index("performance_events_date_idx").on(table.createdAt),
  performanceEventsGoalIdx: index("performance_events_goal_idx").on(table.goalAchieved, table.eventType),
}));

// Teacher class assignments table
export const teacherClassAssignments = sqliteTable("teacher_class_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  department: text("department"),
  termId: integer("term_id").references(() => academicTerms.id),
  session: text("session"), // Academic session e.g., "2024/2025"
  assignedBy: text("assigned_by").references(() => users.id, { onDelete: 'set null' }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  validUntil: integer("valid_until", { mode: "timestamp" }), // Optional expiration date
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  teacherAssignmentsTeacherIdx: index("teacher_assignments_teacher_idx").on(table.teacherId, table.isActive),
  teacherAssignmentsClassSubjectIdx: index("teacher_assignments_class_subject_idx").on(table.classId, table.subjectId),
  teacherAssignmentsDeptIdx: index("teacher_assignments_dept_idx").on(table.department),
  teacherAssignmentsSessionIdx: index("teacher_assignments_session_idx").on(table.session),
  teacherAssignmentsUniqueIdx: uniqueIndex("teacher_assignments_unique_idx").on(table.teacherId, table.classId, table.subjectId, table.termId),
}));

// Teacher assignment history/audit log
export const teacherAssignmentHistory = sqliteTable("teacher_assignment_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id").references(() => teacherClassAssignments.id, { onDelete: 'set null' }),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  action: text("action").notNull(), // 'created', 'updated', 'disabled', 'deleted'
  previousValues: text("previous_values"), // JSON of old values
  newValues: text("new_values"), // JSON of new values
  performedBy: text("performed_by").references(() => users.id, { onDelete: 'set null' }),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  assignmentHistoryTeacherIdx: index("assignment_history_teacher_idx").on(table.teacherId),
  assignmentHistoryActionIdx: index("assignment_history_action_idx").on(table.action),
  assignmentHistoryDateIdx: index("assignment_history_date_idx").on(table.createdAt),
}));

// Grading boundaries table - Configurable grade thresholds
export const gradingBoundaries = sqliteTable("grading_boundaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g., "Standard", "Custom Science"
  grade: text("grade").notNull(), // e.g., "A", "B", "C", "D", "E", "F"
  minScore: integer("min_score").notNull(), // Minimum score for this grade
  maxScore: integer("max_score").notNull(), // Maximum score for this grade
  remark: text("remark"), // e.g., "Excellent", "Very Good", "Good", "Pass", "Fail"
  gradePoint: integer("grade_point"), // Optional: for GPA calculation
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  termId: integer("term_id").references(() => academicTerms.id),
  classId: integer("class_id").references(() => classes.id), // Optional: class-specific grading
  subjectId: integer("subject_id").references(() => subjects.id), // Optional: subject-specific grading
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  gradingBoundariesNameIdx: index("grading_boundaries_name_idx").on(table.name),
  gradingBoundariesGradeIdx: index("grading_boundaries_grade_idx").on(table.grade),
  gradingBoundariesDefaultIdx: index("grading_boundaries_default_idx").on(table.isDefault),
}));

// Continuous Assessment scores table
export const continuousAssessment = sqliteTable("continuous_assessment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  termId: integer("term_id").notNull().references(() => academicTerms.id),
  testScore: integer("test_score"), // CA score (max typically 40)
  examScore: integer("exam_score"), // Exam score (max typically 60)
  totalScore: integer("total_score"), // Calculated: testScore + examScore
  grade: text("grade"), // Auto-calculated based on grading boundaries
  remark: text("remark"),
  teacherId: text("teacher_id").references(() => users.id, { onDelete: 'set null' }),
  enteredBy: text("entered_by").references(() => users.id, { onDelete: 'set null' }),
  verifiedBy: text("verified_by").references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  lockedBy: text("locked_by").references(() => users.id, { onDelete: 'set null' }),
  lockedAt: integer("locked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  caStudentIdx: index("ca_student_idx").on(table.studentId),
  caClassSubjectIdx: index("ca_class_subject_idx").on(table.classId, table.subjectId),
  caTermIdx: index("ca_term_idx").on(table.termId),
  caTeacherIdx: index("ca_teacher_idx").on(table.teacherId),
  caUniqueIdx: uniqueIndex("ca_unique_idx").on(table.studentId, table.subjectId, table.classId, table.termId),
}));

// Unauthorized access attempts log
export const unauthorizedAccessLogs = sqliteTable("unauthorized_access_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: 'set null' }),
  attemptedAction: text("attempted_action").notNull(),
  attemptedResource: text("attempted_resource").notNull(),
  classId: integer("class_id").references(() => classes.id),
  subjectId: integer("subject_id").references(() => subjects.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  reason: text("reason"), // Why access was denied
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  unauthorizedUserIdx: index("unauthorized_user_idx").on(table.userId),
  unauthorizedActionIdx: index("unauthorized_action_idx").on(table.attemptedAction),
  unauthorizedDateIdx: index("unauthorized_date_idx").on(table.createdAt),
}));

// Student subject assignments table - Links students to their assigned subjects based on class and department
export const studentSubjectAssignments = sqliteTable("student_subject_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  termId: integer("term_id").references(() => academicTerms.id),
  assignedBy: text("assigned_by").references(() => users.id, { onDelete: 'set null' }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  studentSubjectAssignmentsStudentIdx: index("student_subject_assignments_student_idx").on(table.studentId),
  studentSubjectAssignmentsSubjectIdx: index("student_subject_assignments_subject_idx").on(table.subjectId),
  studentSubjectAssignmentsClassIdx: index("student_subject_assignments_class_idx").on(table.classId),
  studentSubjectAssignmentsUniqueIdx: uniqueIndex("student_subject_assignments_unique_idx").on(table.studentId, table.subjectId, table.classId),
}));

// Class subject mappings table - Defines which subjects are available for each class level
export const classSubjectMappings = sqliteTable("class_subject_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  department: text("department"),
  isCompulsory: integer("is_compulsory", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  classSubjectMappingsClassIdx: index("class_subject_mappings_class_idx").on(table.classId),
  classSubjectMappingsSubjectIdx: index("class_subject_mappings_subject_idx").on(table.subjectId),
  classSubjectMappingsDeptIdx: index("class_subject_mappings_dept_idx").on(table.department),
  classSubjectMappingsUniqueIdx: uniqueIndex("class_subject_mappings_unique_idx").on(table.classId, table.subjectId, table.department),
}));

// Timetable table
export const timetable = sqliteTable("timetable", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location"),
  termId: integer("term_id").references(() => academicTerms.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  timetableTeacherIdx: index("timetable_teacher_idx").on(table.teacherId, table.isActive),
  timetableDayIdx: index("timetable_day_idx").on(table.dayOfWeek, table.teacherId),
}));

// Grading tasks table
export const gradingTasks = sqliteTable("grading_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => examSessions.id, { onDelete: 'cascade' }),
  answerId: integer("answer_id").notNull().references(() => studentAnswers.id, { onDelete: 'cascade' }),
  assignedTeacherId: text("assigned_teacher_id").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('pending'),
  priority: integer("priority").notNull().default(0),
  assignedAt: integer("assigned_at", { mode: "timestamp" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  gradingTasksAssignedIdx: index("grading_tasks_assigned_idx").on(table.assignedTeacherId, table.status),
  gradingTasksStatusIdx: index("grading_tasks_status_idx").on(table.status, table.priority),
  gradingTasksSessionIdx: index("grading_tasks_session_idx").on(table.sessionId),
  gradingTasksAnswerUniqueIdx: uniqueIndex("grading_tasks_answer_unique_idx").on(table.answerId),
}));

// Audit logs table
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: 'set null' }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  auditLogsUserIdx: index("audit_logs_user_idx").on(table.userId),
  auditLogsEntityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  auditLogsDateIdx: index("audit_logs_date_idx").on(table.createdAt),
  auditLogsActionIdx: index("audit_logs_action_idx").on(table.action),
}));

// Settings table
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  dataType: text("data_type").notNull().default('string'),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  settingsKeyIdx: index("settings_key_idx").on(table.key),
}));

// Counters table
export const counters = sqliteTable("counters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleCode: text("role_code"),
  classCode: text("class_code"),
  year: text("year"),
  sequence: integer("sequence").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  countersRoleCodeIdx: uniqueIndex("counters_role_code_idx").on(table.roleCode),
}));

// Job Vacancy System tables
export const vacancies = sqliteTable("vacancies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  deadline: integer("deadline", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default('open'), // 'open', 'closed', 'filled'
  createdBy: text("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  vacanciesStatusIdx: index("vacancies_status_idx").on(table.status),
  vacanciesDeadlineIdx: index("vacancies_deadline_idx").on(table.deadline),
}));

export const teacherApplications = sqliteTable("teacher_applications", {
  id: text("id").primaryKey(),
  vacancyId: text("vacancy_id").references(() => vacancies.id, { onDelete: 'set null' }),
  fullName: text("full_name").notNull(),
  googleEmail: text("google_email").notNull(),
  phone: text("phone").notNull(),
  subjectSpecialty: text("subject_specialty").notNull(),
  qualification: text("qualification").notNull(),
  experienceYears: integer("experience_years").notNull(),
  bio: text("bio").notNull(),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  rejectionReason: text("rejection_reason"),
  dateApplied: integer("date_applied", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  teacherApplicationsStatusIdx: index("teacher_applications_status_idx").on(table.status),
  teacherApplicationsEmailIdx: index("teacher_applications_email_idx").on(table.googleEmail),
  teacherApplicationsVacancyIdx: index("teacher_applications_vacancy_idx").on(table.vacancyId),
}));

export const approvedTeachers = sqliteTable("approved_teachers", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").references(() => teacherApplications.id, { onDelete: 'set null' }),
  googleEmail: text("google_email").notNull().unique(),
  fullName: text("full_name").notNull(),
  subjectSpecialty: text("subject_specialty"),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: 'set null' }),
  dateApproved: integer("date_approved", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  approvedTeachersEmailIdx: index("approved_teachers_email_idx").on(table.googleEmail),
}));

// Insert schemas
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertPasswordResetAttemptSchema = createInsertSchema(passwordResetAttempts).omit({ id: true, attemptedAt: true });
export const insertInviteSchema = createInsertSchema(invites).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ createdAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, createdAt: true });
export const insertAcademicTermSchema = createInsertSchema(academicTerms).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertExamSchema = createInsertSchema(exams).omit({ id: true, createdAt: true }).extend({
  classId: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().positive("Please select a valid class")
  ),
  subjectId: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().positive("Please select a valid subject")
  ),
  termId: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().positive("Please select a valid term")
  ),
  totalMarks: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().positive("Total marks must be a positive number")
  ),
  name: z.string().min(1, "Exam name is required"),
  date: z.string()
    .min(1, "Exam date is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
    }, "Please enter a valid date"),
  examType: z.enum(['test', 'exam']).default('exam'),
  timerMode: z.string().default('individual'),
  timeLimit: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().int().min(1, "Time limit must be at least 1 minute").optional()
  ),
  passingScore: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
    z.number().int().min(0).max(100, "Passing score must be between 0 and 100").optional()
  ),
  startTime: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : new Date(val as string),
    z.date().optional()
  ),
  endTime: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : new Date(val as string),
    z.date().optional()
  ),
  instructions: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : val,
    z.string().optional()
  ),
  gradingScale: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? 'standard' : val,
    z.string().default('standard')
  ),
  teacherInChargeId: z.preprocess(
    (val) => val === '' || val === null || val === undefined ? undefined : val,
    z.string().optional()
  ),
  isPublished: z.boolean().default(false),
  allowRetakes: z.boolean().default(false),
  shuffleQuestions: z.boolean().default(false),
  autoGradingEnabled: z.boolean().default(true),
  instantFeedback: z.boolean().default(false),
  showCorrectAnswers: z.boolean().default(false),
});
export const insertExamResultSchema = createInsertSchema(examResults).omit({ id: true, createdAt: true });
export const insertExamSubmissionsArchiveSchema = createInsertSchema(examSubmissionsArchive).omit({ id: true, archivedAt: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertGalleryCategorySchema = createInsertSchema(galleryCategories).omit({ id: true, createdAt: true });
export const insertGallerySchema = createInsertSchema(gallery).omit({ id: true, createdAt: true });
export const insertHomePageContentSchema = createInsertSchema(homePageContent).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true });
export const insertReportCommentTemplateSchema = createInsertSchema(reportCommentTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportCardSchema = createInsertSchema(reportCards).omit({ id: true, createdAt: true });
export const insertReportCardSkillsSchema = createInsertSchema(reportCardSkills).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportCardItemSchema = createInsertSchema(reportCardItems).omit({ id: true, createdAt: true });
export const insertStudyResourceSchema = createInsertSchema(studyResources).omit({ id: true, createdAt: true, downloads: true });
export const insertPerformanceEventSchema = createInsertSchema(performanceEvents).omit({ id: true, createdAt: true });
export const insertTeacherClassAssignmentSchema = createInsertSchema(teacherClassAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeacherAssignmentHistorySchema = createInsertSchema(teacherAssignmentHistory).omit({ id: true, createdAt: true });
export const insertGradingBoundarySchema = createInsertSchema(gradingBoundaries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContinuousAssessmentSchema = createInsertSchema(continuousAssessment).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUnauthorizedAccessLogSchema = createInsertSchema(unauthorizedAccessLogs).omit({ id: true, createdAt: true });
export const insertTimetableSchema = createInsertSchema(timetable).omit({ id: true, createdAt: true });
export const insertGradingTaskSchema = createInsertSchema(gradingTasks).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCounterSchema = createInsertSchema(counters).omit({ id: true, createdAt: true, updatedAt: true });

// Student schemas
export const createStudentWithAutoCredsSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required" }),
  profileImageUrl: z.string().optional(),
  admissionNumber: z.string().min(1, "Admission number is required"),
  classId: z.coerce.number().positive("Please select a valid class"),
  parentId: z.string().optional().nullable(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format"),
  emergencyContact: z.string().min(1, "Emergency contact is required"),
  medicalInfo: z.string().optional(),
  parentEmail: z.string().email("Invalid parent email").optional(),
  parentPhone: z.string().optional(),
});

export type CreateStudentWithAutoCredsRequest = z.infer<typeof createStudentWithAutoCredsSchema>;

export const createStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required" }),
  profileImageUrl: z.string().optional(),
  classId: z.coerce.number().positive("Please select a valid class"),
  parentId: z.string().optional().nullable(),
  parentPhone: z.string().optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format"),
  emergencyContact: z.string().optional(),
  medicalInfo: z.string().optional(),
  guardianName: z.string().optional(),
  department: z.enum(['science', 'art', 'commercial']).optional().nullable(),
});

export type CreateStudentRequest = z.infer<typeof createStudentSchema>;

export const quickCreateStudentSchema = z.object({
  fullName: z.string()
    .min(2, "Full name is required")
    .refine(
      (name) => name.trim().split(/\s+/).length >= 2,
      "Please enter both first and last name (e.g., 'John Adebayo')"
    ),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required" }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  classId: z.coerce.number().positive("Please select a valid class"),
  department: z.enum(['science', 'art', 'commercial']).optional().nullable(),
});

export type QuickCreateStudentRequest = z.infer<typeof quickCreateStudentSchema>;

export const csvStudentSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  class: z.string().min(1, "Class is required"),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required" }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  parentEmail: z.string().email("Invalid parent email").optional(),
  parentPhone: z.string().optional(),
  emergencyContact: z.string().min(1, "Emergency contact is required"),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format").optional(),
  medicalInfo: z.string().optional(),
  guardianName: z.string().optional(),
});

export type CsvStudentData = z.infer<typeof csvStudentSchema>;

export const insertExamQuestionSchema = createInsertSchema(examQuestions).omit({ id: true, createdAt: true }).extend({
  examId: z.coerce.number().positive("Please select a valid exam"),
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(['multiple_choice', 'text', 'essay', 'true_false', 'fill_blank'], { required_error: "Question type is required" }),
  points: z.preprocess((val) => val === '' ? 1 : val, z.coerce.number().int().min(0, "Points must be a non-negative number").default(1)),
  orderNumber: z.coerce.number().int().min(1, "Order number must be a positive number"),
  imageUrl: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
  expectedAnswers: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(s => s !== '');
    return undefined;
  }, z.array(z.string()).optional()),
  explanationText: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
  hintText: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
  partialCreditRules: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
});

export const insertQuestionOptionSchema = createInsertSchema(questionOptions).omit({ id: true, createdAt: true }).extend({
  questionId: z.coerce.number().positive("Please select a valid question"),
  orderNumber: z.coerce.number().int().min(1, "Order number must be a positive number"),
  partialCreditValue: z.preprocess((val) => val === '' ? 0 : val, z.coerce.number().int().min(0, "Partial credit must be non-negative").default(0)),
  explanationText: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
});

export const createQuestionOptionSchema = insertQuestionOptionSchema.omit({ questionId: true, orderNumber: true }).extend({
  partialCreditValue: z.preprocess((val) => val === '' ? 0 : val, z.coerce.number().int().min(0, "Partial credit must be non-negative").default(0)).optional(),
  explanationText: z.preprocess((val) => val === '' ? undefined : val, z.string().optional()),
});

export const insertExamSessionSchema = createInsertSchema(examSessions).omit({ 
  id: true, 
  createdAt: true, 
  startedAt: true,
  studentId: true
}).partial().required({ 
  examId: true
}).extend({
  submittedAt: z.union([z.date(), z.string()]).optional().transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  })
});

export const updateExamSessionSchema = z.object({
  isCompleted: z.boolean().optional(),
  submittedAt: z.coerce.date().refine(d => !isNaN(d.getTime()), 'Invalid date').optional(),
  timeRemaining: z.number().int().min(0).optional(),
  status: z.enum(['in_progress', 'submitted']).optional(),
  submissionMethod: z.string().optional(),
  autoSubmitted: z.boolean().optional()
}).strict();

export const insertStudentAnswerSchema = createInsertSchema(studentAnswers).omit({ id: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertTeacherProfileSchema = createInsertSchema(teacherProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminProfileSchema = createInsertSchema(adminProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParentProfileSchema = createInsertSchema(parentProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudentSubjectAssignmentSchema = createInsertSchema(studentSubjectAssignments).omit({ id: true, createdAt: true });
export const insertClassSubjectMappingSchema = createInsertSchema(classSubjectMappings).omit({ id: true, createdAt: true });

// Vacancy schemas
export const insertVacancySchema = createInsertSchema(vacancies).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherApplicationSchema = createInsertSchema(teacherApplications).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  dateApplied: true,
  reviewedAt: true,
  reviewedBy: true,
  status: true,
});

export const insertApprovedTeacherSchema = createInsertSchema(approvedTeachers).omit({ 
  id: true,
  createdAt: true,
  dateApproved: true,
});

export const insertSuperAdminProfileSchema = createInsertSchema(superAdminProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestionBankSchema = createInsertSchema(questionBanks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuestionBankItemSchema = createInsertSchema(questionBankItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuestionBankOptionSchema = createInsertSchema(questionBankOptions).omit({ id: true, createdAt: true });

// Types
export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type PasswordResetAttempt = typeof passwordResetAttempts.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type AcademicTerm = typeof academicTerms.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamResult = typeof examResults.$inferSelect;
export type ExamSubmissionsArchive = typeof examSubmissionsArchive.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type GalleryCategory = typeof galleryCategories.$inferSelect;
export type Gallery = typeof gallery.$inferSelect;
export type HomePageContent = typeof homePageContent.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type ReportCommentTemplate = typeof reportCommentTemplates.$inferSelect;
export type ReportCard = typeof reportCards.$inferSelect;
export type ReportCardItem = typeof reportCardItems.$inferSelect;
export type StudyResource = typeof studyResources.$inferSelect;
export type PerformanceEvent = typeof performanceEvents.$inferSelect;
export type TeacherClassAssignment = typeof teacherClassAssignments.$inferSelect;
export type Timetable = typeof timetable.$inferSelect;
export type GradingTask = typeof gradingTasks.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type ParentProfile = typeof parentProfiles.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Counter = typeof counters.$inferSelect;

export type TeacherProfileWithUser = TeacherProfile & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  recoveryEmail: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  profileImageUrl: string | null;
};

export type ExamQuestion = typeof examQuestions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type ExamSession = typeof examSessions.$inferSelect;
export type StudentAnswer = typeof studentAnswers.$inferSelect;

export type QuestionBank = typeof questionBanks.$inferSelect;
export type QuestionBankItem = typeof questionBankItems.$inferSelect;
export type QuestionBankOption = typeof questionBankOptions.$inferSelect;

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type InsertPasswordResetAttempt = z.infer<typeof insertPasswordResetAttemptSchema>;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertAcademicTerm = z.infer<typeof insertAcademicTermSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;
export type InsertExamSubmissionsArchive = z.infer<typeof insertExamSubmissionsArchiveSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertGalleryCategory = z.infer<typeof insertGalleryCategorySchema>;
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type InsertHomePageContent = z.infer<typeof insertHomePageContentSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type InsertReportCommentTemplate = z.infer<typeof insertReportCommentTemplateSchema>;
export type InsertReportCard = z.infer<typeof insertReportCardSchema>;
export type InsertReportCardItem = z.infer<typeof insertReportCardItemSchema>;
export type ReportCardSkills = typeof reportCardSkills.$inferSelect;
export type InsertReportCardSkills = z.infer<typeof insertReportCardSkillsSchema>;
export type InsertStudyResource = z.infer<typeof insertStudyResourceSchema>;
export type InsertPerformanceEvent = z.infer<typeof insertPerformanceEventSchema>;
export type InsertTeacherClassAssignment = z.infer<typeof insertTeacherClassAssignmentSchema>;
export type TeacherAssignmentHistory = typeof teacherAssignmentHistory.$inferSelect;
export type InsertTeacherAssignmentHistory = z.infer<typeof insertTeacherAssignmentHistorySchema>;
export type GradingBoundary = typeof gradingBoundaries.$inferSelect;
export type InsertGradingBoundary = z.infer<typeof insertGradingBoundarySchema>;
export type ContinuousAssessment = typeof continuousAssessment.$inferSelect;
export type InsertContinuousAssessment = z.infer<typeof insertContinuousAssessmentSchema>;
export type UnauthorizedAccessLog = typeof unauthorizedAccessLogs.$inferSelect;
export type InsertUnauthorizedAccessLog = z.infer<typeof insertUnauthorizedAccessLogSchema>;
export type InsertTimetable = z.infer<typeof insertTimetableSchema>;
export type InsertGradingTask = z.infer<typeof insertGradingTaskSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertTeacherProfile = z.infer<typeof insertTeacherProfileSchema>;
export type InsertAdminProfile = z.infer<typeof insertAdminProfileSchema>;
export type InsertParentProfile = z.infer<typeof insertParentProfileSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertCounter = z.infer<typeof insertCounterSchema>;

export type InsertExamQuestion = z.infer<typeof insertExamQuestionSchema>;
export type InsertQuestionOption = z.infer<typeof insertQuestionOptionSchema>;
export type CreateQuestionOption = z.infer<typeof createQuestionOptionSchema>;
export type InsertExamSession = z.infer<typeof insertExamSessionSchema>;
export type UpdateExamSession = z.infer<typeof updateExamSessionSchema>;
export type InsertStudentAnswer = z.infer<typeof insertStudentAnswerSchema>;

export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;
export type InsertQuestionBankItem = z.infer<typeof insertQuestionBankItemSchema>;
export type InsertQuestionBankOption = z.infer<typeof insertQuestionBankOptionSchema>;

export type Vacancy = typeof vacancies.$inferSelect;
export type TeacherApplication = typeof teacherApplications.$inferSelect;
export type ApprovedTeacher = typeof approvedTeachers.$inferSelect;

export type InsertVacancy = z.infer<typeof insertVacancySchema>;
export type InsertTeacherApplication = z.infer<typeof insertTeacherApplicationSchema>;
export type InsertApprovedTeacher = z.infer<typeof insertApprovedTeacherSchema>;

export type SuperAdminProfile = typeof superAdminProfiles.$inferSelect;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSuperAdminProfile = z.infer<typeof insertSuperAdminProfileSchema>;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export type StudentSubjectAssignment = typeof studentSubjectAssignments.$inferSelect;
export type InsertStudentSubjectAssignment = z.infer<typeof insertStudentSubjectAssignmentSchema>;
export type ClassSubjectMapping = typeof classSubjectMappings.$inferSelect;
export type InsertClassSubjectMapping = z.infer<typeof insertClassSubjectMappingSchema>;
