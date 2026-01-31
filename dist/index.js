var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.pg.ts
var schema_pg_exports = {};
__export(schema_pg_exports, {
  academicTerms: () => academicTerms,
  adminProfiles: () => adminProfiles,
  announcements: () => announcements,
  approvedTeachers: () => approvedTeachers,
  attendance: () => attendance,
  auditLogs: () => auditLogs,
  classSubjectMappings: () => classSubjectMappings,
  classes: () => classes,
  contactMessages: () => contactMessages,
  continuousAssessment: () => continuousAssessment,
  counters: () => counters,
  examQuestions: () => examQuestions,
  examResults: () => examResults,
  examSessions: () => examSessions,
  examSubmissionsArchive: () => examSubmissionsArchive,
  exams: () => exams,
  gallery: () => gallery,
  galleryCategories: () => galleryCategories,
  gradingBoundaries: () => gradingBoundaries,
  gradingTasks: () => gradingTasks,
  homePageContent: () => homePageContent,
  invites: () => invites,
  messages: () => messages,
  notifications: () => notifications,
  parentProfiles: () => parentProfiles,
  passwordResetAttempts: () => passwordResetAttempts,
  passwordResetTokens: () => passwordResetTokens,
  performanceEvents: () => performanceEvents,
  questionBankItems: () => questionBankItems,
  questionBankOptions: () => questionBankOptions,
  questionBanks: () => questionBanks,
  questionOptions: () => questionOptions,
  reportCardItems: () => reportCardItems,
  reportCardSkills: () => reportCardSkills,
  reportCards: () => reportCards,
  reportCommentTemplates: () => reportCommentTemplates,
  roles: () => roles,
  settings: () => settings,
  studentAnswers: () => studentAnswers,
  studentSubjectAssignments: () => studentSubjectAssignments,
  students: () => students,
  studyResources: () => studyResources,
  subjects: () => subjects,
  superAdminProfiles: () => superAdminProfiles,
  syncAuditLogs: () => syncAuditLogs,
  systemSettings: () => systemSettings,
  teacherApplications: () => teacherApplications,
  teacherAssignmentHistory: () => teacherAssignmentHistory,
  teacherClassAssignments: () => teacherClassAssignments,
  teacherProfiles: () => teacherProfiles,
  timetable: () => timetable,
  unauthorizedAccessLogs: () => unauthorizedAccessLogs,
  users: () => users,
  vacancies: () => vacancies
});
import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex, serial, varchar } from "drizzle-orm/pg-core";
var roles, users, passwordResetTokens, passwordResetAttempts, invites, notifications, academicTerms, classes, subjects, students, teacherProfiles, adminProfiles, parentProfiles, superAdminProfiles, systemSettings, attendance, exams, examQuestions, questionOptions, examSessions, studentAnswers, examResults, examSubmissionsArchive, questionBanks, questionBankItems, questionBankOptions, announcements, messages, galleryCategories, gallery, homePageContent, contactMessages, reportCommentTemplates, reportCards, reportCardItems, reportCardSkills, studyResources, teacherClassAssignments, teacherAssignmentHistory, gradingBoundaries, continuousAssessment, unauthorizedAccessLogs, studentSubjectAssignments, classSubjectMappings, timetable, gradingTasks, auditLogs, performanceEvents, settings, counters, vacancies, teacherApplications, approvedTeachers, syncAuditLogs;
var init_schema_pg = __esm({
  "shared/schema.pg.ts"() {
    "use strict";
    roles = pgTable("roles", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull().unique(),
      permissions: text("permissions").notNull().default("[]"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    users = pgTable("users", {
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
      authProvider: varchar("auth_provider", { length: 20 }).notNull().default("local"),
      googleId: varchar("google_id", { length: 255 }).unique(),
      status: varchar("status", { length: 20 }).notNull().default("active"),
      createdVia: varchar("created_via", { length: 20 }).notNull().default("admin"),
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
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      usersEmailIdx: index("users_email_idx").on(table.email),
      usersStatusIdx: index("users_status_idx").on(table.status),
      usersGoogleIdIdx: index("users_google_id_idx").on(table.googleId),
      usersRoleIdIdx: index("users_role_id_idx").on(table.roleId),
      usersUsernameIdx: index("users_username_idx").on(table.username),
      usersDeletedAtIdx: index("users_deleted_at_idx").on(table.deletedAt)
    }));
    passwordResetTokens = pgTable("password_reset_tokens", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
      token: varchar("token", { length: 255 }).notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      usedAt: timestamp("used_at"),
      ipAddress: varchar("ip_address", { length: 45 }),
      resetBy: varchar("reset_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      passwordResetTokensUserIdIdx: index("password_reset_tokens_user_id_idx").on(table.userId),
      passwordResetTokensTokenIdx: index("password_reset_tokens_token_idx").on(table.token)
    }));
    passwordResetAttempts = pgTable("password_reset_attempts", {
      id: serial("id").primaryKey(),
      identifier: varchar("identifier", { length: 255 }).notNull(),
      ipAddress: varchar("ip_address", { length: 45 }).notNull(),
      attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
      success: boolean("success").notNull().default(false)
    }, (table) => ({
      passwordResetAttemptsIdentifierIdx: index("password_reset_attempts_identifier_idx").on(table.identifier),
      passwordResetAttemptsIpIdx: index("password_reset_attempts_ip_idx").on(table.ipAddress),
      passwordResetAttemptsTimeIdx: index("password_reset_attempts_time_idx").on(table.attemptedAt)
    }));
    invites = pgTable("invites", {
      id: serial("id").primaryKey(),
      token: varchar("token", { length: 255 }).notNull().unique(),
      email: varchar("email", { length: 255 }).notNull(),
      roleId: integer("role_id").notNull().references(() => roles.id),
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      expiresAt: timestamp("expires_at").notNull(),
      acceptedAt: timestamp("accepted_at"),
      acceptedBy: varchar("accepted_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      invitesTokenIdx: index("invites_token_idx").on(table.token),
      invitesEmailIdx: index("invites_email_idx").on(table.email)
    }));
    notifications = pgTable("notifications", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
      type: varchar("type", { length: 50 }).notNull(),
      title: varchar("title", { length: 255 }).notNull(),
      message: text("message").notNull(),
      relatedEntityType: varchar("related_entity_type", { length: 50 }),
      relatedEntityId: varchar("related_entity_id", { length: 36 }),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      notificationsUserIdIdx: index("notifications_user_id_idx").on(table.userId),
      notificationsIsReadIdx: index("notifications_is_read_idx").on(table.isRead)
    }));
    academicTerms = pgTable("academic_terms", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      year: varchar("year", { length: 20 }).notNull(),
      startDate: varchar("start_date", { length: 10 }).notNull(),
      endDate: varchar("end_date", { length: 10 }).notNull(),
      isCurrent: boolean("is_current").notNull().default(false),
      status: varchar("status", { length: 20 }).notNull().default("upcoming"),
      isLocked: boolean("is_locked").notNull().default(false),
      description: text("description"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      academicTermsYearIdx: index("academic_terms_year_idx").on(table.year),
      academicTermsStatusIdx: index("academic_terms_status_idx").on(table.status),
      academicTermsCurrentIdx: index("academic_terms_current_idx").on(table.isCurrent)
    }));
    classes = pgTable("classes", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull().unique(),
      level: varchar("level", { length: 50 }).notNull(),
      capacity: integer("capacity").notNull().default(30),
      classTeacherId: varchar("class_teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      currentTermId: integer("current_term_id").references(() => academicTerms.id),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    subjects = pgTable("subjects", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      code: varchar("code", { length: 50 }).notNull().unique(),
      description: text("description"),
      category: varchar("category", { length: 20 }).notNull().default("general"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      subjectsCategoryIdx: index("subjects_category_idx").on(table.category),
      subjectsIsActiveIdx: index("subjects_is_active_idx").on(table.isActive)
    }));
    students = pgTable("students", {
      id: varchar("id", { length: 36 }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
      admissionNumber: varchar("admission_number", { length: 50 }).notNull().unique(),
      classId: integer("class_id").references(() => classes.id),
      parentId: varchar("parent_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      department: varchar("department", { length: 50 }),
      admissionDate: varchar("admission_date", { length: 10 }).notNull(),
      emergencyContact: varchar("emergency_contact", { length: 255 }),
      emergencyPhone: varchar("emergency_phone", { length: 50 }),
      medicalInfo: text("medical_info"),
      guardianName: varchar("guardian_name", { length: 255 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      studentsDepartmentIdx: index("students_department_idx").on(table.department),
      studentsClassIdIdx: index("students_class_id_idx").on(table.classId)
    }));
    teacherProfiles = pgTable("teacher_profiles", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
      staffId: varchar("staff_id", { length: 50 }).unique(),
      subjects: text("subjects").notNull().default("[]"),
      assignedClasses: text("assigned_classes").notNull().default("[]"),
      qualification: text("qualification"),
      yearsOfExperience: integer("years_of_experience").notNull().default(0),
      specialization: varchar("specialization", { length: 255 }),
      department: varchar("department", { length: 255 }),
      signatureUrl: text("signature_url"),
      gradingMode: varchar("grading_mode", { length: 20 }).notNull().default("manual"),
      autoGradeTheoryQuestions: boolean("auto_grade_theory_questions").notNull().default(false),
      theoryGradingInstructions: text("theory_grading_instructions"),
      notificationPreference: varchar("notification_preference", { length: 20 }).notNull().default("all"),
      availability: text("availability"),
      firstLogin: boolean("first_login").notNull().default(true),
      verified: boolean("verified").notNull().default(false),
      verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      verifiedAt: timestamp("verified_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    adminProfiles = pgTable("admin_profiles", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
      department: varchar("department", { length: 255 }),
      roleDescription: text("role_description"),
      accessLevel: varchar("access_level", { length: 50 }),
      signatureUrl: text("signature_url"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    parentProfiles = pgTable("parent_profiles", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
      occupation: varchar("occupation", { length: 255 }),
      contactPreference: varchar("contact_preference", { length: 50 }),
      linkedStudents: text("linked_students").notNull().default("[]"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    superAdminProfiles = pgTable("super_admin_profiles", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
      department: varchar("department", { length: 255 }),
      accessLevel: varchar("access_level", { length: 50 }).notNull().default("full"),
      twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
      twoFactorSecret: text("two_factor_secret"),
      lastPasswordChange: timestamp("last_password_change"),
      signatureUrl: text("signature_url"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    systemSettings = pgTable("system_settings", {
      id: serial("id").primaryKey(),
      schoolName: varchar("school_name", { length: 255 }),
      schoolShortName: varchar("school_short_name", { length: 50 }),
      schoolMotto: text("school_motto"),
      schoolLogo: text("school_logo"),
      favicon: text("favicon"),
      schoolAddress: text("school_address"),
      schoolPhones: text("school_phones").default("[]"),
      schoolEmails: text("school_emails").default("[]"),
      websiteTitle: varchar("website_title", { length: 255 }),
      footerText: text("footer_text"),
      maintenanceMode: boolean("maintenance_mode").notNull().default(false),
      maintenanceModeMessage: text("maintenance_mode_message"),
      enableSmsNotifications: boolean("enable_sms_notifications").notNull().default(false),
      enableEmailNotifications: boolean("enable_email_notifications").notNull().default(true),
      enableExamsModule: boolean("enable_exams_module").notNull().default(true),
      enableAttendanceModule: boolean("enable_attendance_module").notNull().default(true),
      enableResultsModule: boolean("enable_results_module").notNull().default(true),
      themeColor: varchar("theme_color", { length: 50 }).notNull().default("blue"),
      usernameStudentPrefix: varchar("username_student_prefix", { length: 50 }).notNull().default("THS-STU"),
      usernameParentPrefix: varchar("username_parent_prefix", { length: 50 }).notNull().default("THS-PAR"),
      usernameTeacherPrefix: varchar("username_teacher_prefix", { length: 50 }).notNull().default("THS-TCH"),
      usernameAdminPrefix: varchar("username_admin_prefix", { length: 50 }).notNull().default("THS-ADM"),
      tempPasswordFormat: varchar("temp_password_format", { length: 100 }).notNull().default("THS@{year}#{random4}"),
      hideAdminAccountsFromAdmins: boolean("hide_admin_accounts_from_admins").notNull().default(true),
      testWeight: integer("test_weight").notNull().default(40),
      examWeight: integer("exam_weight").notNull().default(60),
      defaultGradingScale: varchar("default_grading_scale", { length: 50 }).notNull().default("standard"),
      scoreAggregationMode: varchar("score_aggregation_mode", { length: 20 }).notNull().default("last"),
      autoCreateReportCard: boolean("auto_create_report_card").notNull().default(true),
      showGradeBreakdown: boolean("show_grade_breakdown").notNull().default(true),
      allowTeacherOverrides: boolean("allow_teacher_overrides").notNull().default(true),
      positioningMethod: varchar("positioning_method", { length: 20 }).notNull().default("average"),
      deletedUserRetentionDays: integer("deleted_user_retention_days").notNull().default(30),
      updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    attendance = pgTable("attendance", {
      id: serial("id").primaryKey(),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      classId: integer("class_id").notNull().references(() => classes.id),
      date: varchar("date", { length: 10 }).notNull(),
      status: varchar("status", { length: 20 }).notNull(),
      recordedBy: varchar("recorded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      notes: text("notes"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    exams = pgTable("exams", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      totalMarks: integer("total_marks").notNull(),
      date: varchar("date", { length: 10 }).notNull(),
      termId: integer("term_id").notNull().references(() => academicTerms.id),
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      teacherInChargeId: varchar("teacher_in_charge_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      examType: varchar("exam_type", { length: 20 }).notNull().default("exam"),
      timerMode: varchar("timer_mode", { length: 20 }).notNull().default("individual"),
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
      gradingScale: varchar("grading_scale", { length: 50 }).notNull().default("standard"),
      enableProctoring: boolean("enable_proctoring").notNull().default(false),
      lockdownMode: boolean("lockdown_mode").notNull().default(false),
      requireWebcam: boolean("require_webcam").notNull().default(false),
      requireFullscreen: boolean("require_fullscreen").notNull().default(false),
      maxTabSwitches: integer("max_tab_switches").notNull().default(3),
      shuffleOptions: boolean("shuffle_options").notNull().default(false)
    });
    examQuestions = pgTable("exam_questions", {
      id: serial("id").primaryKey(),
      examId: integer("exam_id").notNull().references(() => exams.id),
      questionText: text("question_text").notNull(),
      questionType: varchar("question_type", { length: 50 }).notNull(),
      points: integer("points").notNull().default(1),
      orderNumber: integer("order_number").notNull(),
      imageUrl: text("image_url"),
      autoGradable: boolean("auto_gradable").notNull().default(true),
      expectedAnswers: text("expected_answers").notNull().default("[]"),
      caseSensitive: boolean("case_sensitive").notNull().default(false),
      allowPartialCredit: boolean("allow_partial_credit").notNull().default(false),
      partialCreditRules: text("partial_credit_rules"),
      explanationText: text("explanation_text"),
      hintText: text("hint_text"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      examQuestionsExamIdIdx: index("exam_questions_exam_id_idx").on(table.examId),
      examQuestionsOrderIdx: index("exam_questions_order_idx").on(table.examId, table.orderNumber)
    }));
    questionOptions = pgTable("question_options", {
      id: serial("id").primaryKey(),
      questionId: integer("question_id").notNull().references(() => examQuestions.id),
      optionText: text("option_text").notNull(),
      isCorrect: boolean("is_correct").notNull().default(false),
      orderNumber: integer("order_number").notNull(),
      partialCreditValue: integer("partial_credit_value").notNull().default(0),
      explanationText: text("explanation_text"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      questionOptionsQuestionIdIdx: index("question_options_question_id_idx").on(table.questionId),
      questionOptionsCorrectIdx: index("question_options_correct_idx").on(table.questionId, table.isCorrect)
    }));
    examSessions = pgTable("exam_sessions", {
      id: serial("id").primaryKey(),
      examId: integer("exam_id").notNull().references(() => exams.id),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      startedAt: timestamp("started_at").notNull().defaultNow(),
      submittedAt: timestamp("submitted_at"),
      timeRemaining: integer("time_remaining"),
      isCompleted: boolean("is_completed").notNull().default(false),
      score: integer("score"),
      maxScore: integer("max_score"),
      status: varchar("status", { length: 20 }).notNull().default("in_progress"),
      metadata: text("metadata"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      examSessionsExamStudentIdx: index("exam_sessions_exam_student_idx").on(table.examId, table.studentId),
      examSessionsStudentCompletedIdx: index("exam_sessions_student_completed_idx").on(table.studentId, table.isCompleted),
      examSessionsActiveSessionsIdx: index("exam_sessions_active_idx").on(table.examId, table.studentId, table.isCompleted)
    }));
    studentAnswers = pgTable("student_answers", {
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
      partialCreditReason: text("partial_credit_reason")
    }, (table) => ({
      studentAnswersSessionIdIdx: index("student_answers_session_id_idx").on(table.sessionId),
      studentAnswersSessionQuestionIdx: index("student_answers_session_question_idx").on(table.sessionId, table.questionId),
      studentAnswersQuestionIdx: index("student_answers_question_id_idx").on(table.questionId)
    }));
    examResults = pgTable("exam_results", {
      id: serial("id").primaryKey(),
      examId: integer("exam_id").notNull().references(() => exams.id),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      score: integer("score"),
      maxScore: integer("max_score"),
      marksObtained: integer("marks_obtained"),
      grade: varchar("grade", { length: 10 }),
      remarks: text("remarks"),
      autoScored: boolean("auto_scored").notNull().default(false),
      recordedBy: varchar("recorded_by", { length: 36 }).notNull().references(() => users.id),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      examResultsExamIdIdx: index("exam_results_exam_id_idx").on(table.examId),
      examResultsStudentIdIdx: index("exam_results_student_id_idx").on(table.studentId),
      examResultsExamStudentIdx: index("exam_results_exam_student_idx").on(table.examId, table.studentId),
      examResultsAutoScoredIdx: index("exam_results_auto_scored_idx").on(table.autoScored, table.examId)
    }));
    examSubmissionsArchive = pgTable("exam_submissions_archive", {
      id: serial("id").primaryKey(),
      examId: integer("exam_id").notNull().references(() => exams.id),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      originalResultId: integer("original_result_id"),
      originalSessionId: integer("original_session_id"),
      score: integer("score").notNull(),
      maxScore: integer("max_score").notNull(),
      grade: varchar("grade", { length: 10 }),
      remarks: text("remarks"),
      answersSnapshot: text("answers_snapshot"),
      archivedBy: varchar("archived_by", { length: 36 }).notNull().references(() => users.id),
      archiveReason: text("archive_reason"),
      archivedAt: timestamp("archived_at").notNull().defaultNow()
    }, (table) => ({
      examSubmissionsArchiveExamIdx: index("exam_submissions_archive_exam_idx").on(table.examId),
      examSubmissionsArchiveStudentIdx: index("exam_submissions_archive_student_idx").on(table.studentId),
      examSubmissionsArchiveExamStudentIdx: index("exam_submissions_archive_exam_student_idx").on(table.examId, table.studentId)
    }));
    questionBanks = pgTable("question_banks", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      classLevel: varchar("class_level", { length: 50 }),
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      isPublic: boolean("is_public").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      questionBanksSubjectIdx: index("question_banks_subject_idx").on(table.subjectId),
      questionBanksCreatedByIdx: index("question_banks_created_by_idx").on(table.createdBy)
    }));
    questionBankItems = pgTable("question_bank_items", {
      id: serial("id").primaryKey(),
      bankId: integer("bank_id").notNull().references(() => questionBanks.id, { onDelete: "cascade" }),
      questionText: text("question_text").notNull(),
      questionType: varchar("question_type", { length: 50 }).notNull(),
      points: integer("points").notNull().default(1),
      difficulty: varchar("difficulty", { length: 20 }).notNull().default("medium"),
      tags: text("tags").notNull().default("[]"),
      imageUrl: text("image_url"),
      autoGradable: boolean("auto_gradable").notNull().default(true),
      expectedAnswers: text("expected_answers").notNull().default("[]"),
      caseSensitive: boolean("case_sensitive").notNull().default(false),
      explanationText: text("explanation_text"),
      hintText: text("hint_text"),
      practicalInstructions: text("practical_instructions"),
      practicalFileUrl: text("practical_file_url"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      questionBankItemsBankIdIdx: index("question_bank_items_bank_id_idx").on(table.bankId),
      questionBankItemsTypeIdx: index("question_bank_items_type_idx").on(table.questionType),
      questionBankItemsDifficultyIdx: index("question_bank_items_difficulty_idx").on(table.difficulty)
    }));
    questionBankOptions = pgTable("question_bank_options", {
      id: serial("id").primaryKey(),
      questionItemId: integer("question_item_id").notNull().references(() => questionBankItems.id, { onDelete: "cascade" }),
      optionText: text("option_text").notNull(),
      isCorrect: boolean("is_correct").notNull().default(false),
      orderNumber: integer("order_number").notNull(),
      explanationText: text("explanation_text"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      questionBankOptionsItemIdIdx: index("question_bank_options_item_id_idx").on(table.questionItemId)
    }));
    announcements = pgTable("announcements", {
      id: serial("id").primaryKey(),
      title: varchar("title", { length: 255 }).notNull(),
      content: text("content").notNull(),
      authorId: varchar("author_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      targetRoles: text("target_roles").notNull().default('["All"]'),
      targetClasses: text("target_classes").notNull().default("[]"),
      isPublished: boolean("is_published").notNull().default(false),
      publishedAt: timestamp("published_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      // Priority & Type
      priority: varchar("priority", { length: 20 }).notNull().default("normal"),
      // 'normal', 'important', 'urgent'
      announcementType: varchar("announcement_type", { length: 50 }).notNull().default("general"),
      // 'general', 'academic', 'examination', 'event', 'emergency'
      // Scheduling & Expiry
      scheduledAt: timestamp("scheduled_at"),
      expiryDate: timestamp("expiry_date"),
      // Attachments (JSON array of file URLs)
      attachments: text("attachments").notNull().default("[]"),
      coverImageUrl: text("cover_image_url"),
      // Notification Settings (JSON object)
      notificationSettings: text("notification_settings").notNull().default('{"inApp": true, "email": false, "sms": false}'),
      // Status & Analytics
      status: varchar("status", { length: 20 }).notNull().default("draft"),
      // 'draft', 'scheduled', 'published', 'expired', 'archived'
      viewCount: integer("view_count").notNull().default(0),
      allowComments: boolean("allow_comments").notNull().default(false),
      allowEdit: boolean("allow_edit").notNull().default(true),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    messages = pgTable("messages", {
      id: serial("id").primaryKey(),
      senderId: varchar("sender_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      recipientId: varchar("recipient_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      subject: varchar("subject", { length: 255 }).notNull(),
      content: text("content").notNull(),
      isRead: boolean("is_read").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    galleryCategories = pgTable("gallery_categories", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      description: text("description"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    gallery = pgTable("gallery", {
      id: serial("id").primaryKey(),
      imageUrl: text("image_url").notNull(),
      caption: text("caption"),
      categoryId: integer("category_id").references(() => galleryCategories.id),
      uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    homePageContent = pgTable("home_page_content", {
      id: serial("id").primaryKey(),
      contentType: varchar("content_type", { length: 50 }).notNull(),
      imageUrl: text("image_url"),
      altText: varchar("alt_text", { length: 255 }),
      caption: text("caption"),
      isActive: boolean("is_active").notNull().default(true),
      displayOrder: integer("display_order").notNull().default(0),
      uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    contactMessages = pgTable("contact_messages", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      email: varchar("email", { length: 255 }).notNull(),
      subject: varchar("subject", { length: 255 }),
      message: text("message").notNull(),
      isRead: boolean("is_read").notNull().default(false),
      respondedAt: timestamp("responded_at"),
      respondedBy: varchar("responded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      response: text("response"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    reportCommentTemplates = pgTable("report_comment_templates", {
      id: serial("id").primaryKey(),
      role: varchar("role", { length: 20 }).notNull(),
      // 'teacher' or 'principal'
      performanceLevel: varchar("performance_level", { length: 30 }).notNull(),
      // 'excellent', 'very_good', 'good', 'fair', 'needs_improvement'
      minPercentage: integer("min_percentage").notNull(),
      maxPercentage: integer("max_percentage").notNull(),
      commentTemplate: text("comment_template").notNull(),
      // Use {lastName} as placeholder
      isActive: boolean("is_active").notNull().default(true),
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    reportCards = pgTable("report_cards", {
      id: serial("id").primaryKey(),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
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
      status: varchar("status", { length: 20 }).notNull().default("draft"),
      gradingScale: varchar("grading_scale", { length: 50 }).notNull().default("standard"),
      scoreAggregationMode: varchar("score_aggregation_mode", { length: 20 }).notNull().default("last"),
      generatedBy: varchar("generated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      signedBy: varchar("signed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      signedAt: timestamp("signed_at"),
      teacherSignedBy: varchar("teacher_signed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      teacherSignedAt: timestamp("teacher_signed_at"),
      teacherSignatureUrl: text("teacher_signature_url"),
      principalSignedBy: varchar("principal_signed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      principalSignedAt: timestamp("principal_signed_at"),
      principalSignatureUrl: text("principal_signature_url"),
      generatedAt: timestamp("generated_at"),
      finalizedAt: timestamp("finalized_at"),
      publishedAt: timestamp("published_at"),
      locked: boolean("locked").notNull().default(false),
      autoGenerated: boolean("auto_generated").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      reportCardsStudentTermIdx: index("report_cards_student_term_idx").on(table.studentId, table.termId),
      reportCardsClassTermIdx: index("report_cards_class_term_idx").on(table.classId, table.termId),
      reportCardsSessionYearIdx: index("report_cards_session_year_idx").on(table.sessionYear)
    }));
    reportCardItems = pgTable("report_card_items", {
      id: serial("id").primaryKey(),
      reportCardId: integer("report_card_id").notNull().references(() => reportCards.id, { onDelete: "cascade" }),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      testExamId: integer("test_exam_id").references(() => exams.id, { onDelete: "set null" }),
      testExamCreatedBy: varchar("test_exam_created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      testScore: integer("test_score"),
      testMaxScore: integer("test_max_score"),
      testWeightedScore: integer("test_weighted_score"),
      examExamId: integer("exam_exam_id").references(() => exams.id, { onDelete: "set null" }),
      examExamCreatedBy: varchar("exam_exam_created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
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
      overriddenBy: varchar("overridden_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      overriddenAt: timestamp("overridden_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      reportCardItemsReportCardIdx: index("report_card_items_report_card_idx").on(table.reportCardId),
      reportCardItemsSubjectIdx: index("report_card_items_subject_idx").on(table.subjectId),
      reportCardItemsTeacherIdx: index("report_card_items_teacher_idx").on(table.teacherId),
      reportCardItemsTestCreatedByIdx: index("report_card_items_test_created_by_idx").on(table.testExamCreatedBy),
      reportCardItemsExamCreatedByIdx: index("report_card_items_exam_created_by_idx").on(table.examExamCreatedBy)
    }));
    reportCardSkills = pgTable("report_card_skills", {
      id: serial("id").primaryKey(),
      reportCardId: integer("report_card_id").notNull().references(() => reportCards.id, { onDelete: "cascade" }),
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
      recordedBy: varchar("recorded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      reportCardSkillsReportCardIdx: index("report_card_skills_report_card_idx").on(table.reportCardId)
    }));
    studyResources = pgTable("study_resources", {
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
      uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      downloadCount: integer("download_count").notNull().default(0),
      isPublic: boolean("is_public").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      studyResourcesClassIdx: index("study_resources_class_idx").on(table.classId),
      studyResourcesSubjectIdx: index("study_resources_subject_idx").on(table.subjectId),
      studyResourcesTypeIdx: index("study_resources_type_idx").on(table.resourceType)
    }));
    teacherClassAssignments = pgTable("teacher_class_assignments", {
      id: serial("id").primaryKey(),
      teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      department: varchar("department", { length: 50 }),
      termId: integer("term_id").references(() => academicTerms.id),
      session: varchar("session", { length: 20 }),
      // Academic session e.g., "2024/2025"
      assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      isActive: boolean("is_active").notNull().default(true),
      validUntil: timestamp("valid_until"),
      // Optional expiration date
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      teacherClassAssignmentsTeacherIdx: index("teacher_class_assignments_teacher_idx").on(table.teacherId),
      teacherClassAssignmentsClassSubjectIdx: index("teacher_class_assignments_class_subject_idx").on(table.classId, table.subjectId),
      teacherClassAssignmentsDeptIdx: index("teacher_class_assignments_dept_idx").on(table.department),
      teacherClassAssignmentsSessionIdx: index("teacher_class_assignments_session_idx").on(table.session),
      teacherClassAssignmentsUniqueIdx: uniqueIndex("teacher_class_assignments_unique_idx").on(table.teacherId, table.classId, table.subjectId, table.termId)
    }));
    teacherAssignmentHistory = pgTable("teacher_assignment_history", {
      id: serial("id").primaryKey(),
      assignmentId: integer("assignment_id").references(() => teacherClassAssignments.id, { onDelete: "set null" }),
      teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      action: varchar("action", { length: 50 }).notNull(),
      // 'created', 'updated', 'disabled', 'deleted'
      previousValues: text("previous_values"),
      // JSON of old values
      newValues: text("new_values"),
      // JSON of new values
      performedBy: varchar("performed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      reason: text("reason"),
      ipAddress: varchar("ip_address", { length: 45 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      assignmentHistoryTeacherIdx: index("assignment_history_teacher_idx").on(table.teacherId),
      assignmentHistoryActionIdx: index("assignment_history_action_idx").on(table.action),
      assignmentHistoryDateIdx: index("assignment_history_date_idx").on(table.createdAt)
    }));
    gradingBoundaries = pgTable("grading_boundaries", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      // e.g., "Standard", "Custom Science"
      grade: varchar("grade", { length: 10 }).notNull(),
      // e.g., "A", "B", "C", "D", "E", "F"
      minScore: integer("min_score").notNull(),
      // Minimum score for this grade
      maxScore: integer("max_score").notNull(),
      // Maximum score for this grade
      remark: varchar("remark", { length: 100 }),
      // e.g., "Excellent", "Very Good", "Good", "Pass", "Fail"
      gradePoint: integer("grade_point"),
      // Optional: for GPA calculation
      isDefault: boolean("is_default").notNull().default(false),
      termId: integer("term_id").references(() => academicTerms.id),
      classId: integer("class_id").references(() => classes.id),
      // Optional: class-specific grading
      subjectId: integer("subject_id").references(() => subjects.id),
      // Optional: subject-specific grading
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      gradingBoundariesNameIdx: index("grading_boundaries_name_idx").on(table.name),
      gradingBoundariesGradeIdx: index("grading_boundaries_grade_idx").on(table.grade),
      gradingBoundariesDefaultIdx: index("grading_boundaries_default_idx").on(table.isDefault)
    }));
    continuousAssessment = pgTable("continuous_assessment", {
      id: serial("id").primaryKey(),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      termId: integer("term_id").notNull().references(() => academicTerms.id),
      testScore: integer("test_score"),
      // CA score (max typically 40)
      examScore: integer("exam_score"),
      // Exam score (max typically 60)
      totalScore: integer("total_score"),
      // Calculated: testScore + examScore
      grade: varchar("grade", { length: 10 }),
      // Auto-calculated based on grading boundaries
      remark: varchar("remark", { length: 100 }),
      teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      enteredBy: varchar("entered_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      verifiedAt: timestamp("verified_at"),
      isLocked: boolean("is_locked").notNull().default(false),
      lockedBy: varchar("locked_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      lockedAt: timestamp("locked_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      caStudentIdx: index("ca_student_idx").on(table.studentId),
      caClassSubjectIdx: index("ca_class_subject_idx").on(table.classId, table.subjectId),
      caTermIdx: index("ca_term_idx").on(table.termId),
      caTeacherIdx: index("ca_teacher_idx").on(table.teacherId),
      caUniqueIdx: uniqueIndex("ca_unique_idx").on(table.studentId, table.subjectId, table.classId, table.termId)
    }));
    unauthorizedAccessLogs = pgTable("unauthorized_access_logs", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      attemptedAction: varchar("attempted_action", { length: 100 }).notNull(),
      attemptedResource: varchar("attempted_resource", { length: 255 }).notNull(),
      classId: integer("class_id").references(() => classes.id),
      subjectId: integer("subject_id").references(() => subjects.id),
      ipAddress: varchar("ip_address", { length: 45 }),
      userAgent: text("user_agent"),
      reason: text("reason"),
      // Why access was denied
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      unauthorizedUserIdx: index("unauthorized_user_idx").on(table.userId),
      unauthorizedActionIdx: index("unauthorized_action_idx").on(table.attemptedAction),
      unauthorizedDateIdx: index("unauthorized_date_idx").on(table.createdAt)
    }));
    studentSubjectAssignments = pgTable("student_subject_assignments", {
      id: serial("id").primaryKey(),
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      classId: integer("class_id").notNull().references(() => classes.id),
      termId: integer("term_id").references(() => academicTerms.id),
      assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      studentSubjectAssignmentsStudentIdx: index("student_subject_assignments_student_idx").on(table.studentId),
      studentSubjectAssignmentsSubjectIdx: index("student_subject_assignments_subject_idx").on(table.subjectId),
      studentSubjectAssignmentsClassIdx: index("student_subject_assignments_class_idx").on(table.classId),
      studentSubjectAssignmentsUniqueIdx: uniqueIndex("student_subject_assignments_unique_idx").on(table.studentId, table.subjectId, table.classId)
    }));
    classSubjectMappings = pgTable("class_subject_mappings", {
      id: serial("id").primaryKey(),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      department: varchar("department", { length: 50 }),
      isCompulsory: boolean("is_compulsory").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      classSubjectMappingsClassIdx: index("class_subject_mappings_class_idx").on(table.classId),
      classSubjectMappingsSubjectIdx: index("class_subject_mappings_subject_idx").on(table.subjectId),
      classSubjectMappingsDeptIdx: index("class_subject_mappings_dept_idx").on(table.department),
      classSubjectMappingsUniqueIdx: uniqueIndex("class_subject_mappings_unique_idx").on(table.classId, table.subjectId, table.department)
    }));
    timetable = pgTable("timetable", {
      id: serial("id").primaryKey(),
      teacherId: varchar("teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
      classId: integer("class_id").notNull().references(() => classes.id),
      subjectId: integer("subject_id").notNull().references(() => subjects.id),
      termId: integer("term_id").references(() => academicTerms.id),
      dayOfWeek: varchar("day_of_week", { length: 20 }).notNull(),
      startTime: varchar("start_time", { length: 10 }).notNull(),
      endTime: varchar("end_time", { length: 10 }).notNull(),
      location: varchar("location", { length: 100 }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      timetableTeacherIdx: index("timetable_teacher_idx").on(table.teacherId),
      timetableClassIdx: index("timetable_class_idx").on(table.classId),
      timetableDayIdx: index("timetable_day_idx").on(table.dayOfWeek)
    }));
    gradingTasks = pgTable("grading_tasks", {
      id: serial("id").primaryKey(),
      sessionId: integer("session_id").notNull().references(() => examSessions.id),
      questionId: integer("question_id").notNull().references(() => examQuestions.id),
      answerId: integer("answer_id").notNull().references(() => studentAnswers.id),
      teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      priority: integer("priority").notNull().default(0),
      aiSuggestedScore: integer("ai_suggested_score"),
      aiConfidence: integer("ai_confidence"),
      aiReasoning: text("ai_reasoning"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      assignedAt: timestamp("assigned_at"),
      completedAt: timestamp("completed_at")
    }, (table) => ({
      gradingTasksTeacherIdx: index("grading_tasks_teacher_idx").on(table.teacherId),
      gradingTasksStatusIdx: index("grading_tasks_status_idx").on(table.status),
      gradingTasksSessionIdx: index("grading_tasks_session_idx").on(table.sessionId)
    }));
    auditLogs = pgTable("audit_logs", {
      id: serial("id").primaryKey(),
      userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      action: varchar("action", { length: 100 }).notNull(),
      entityType: varchar("entity_type", { length: 50 }).notNull(),
      entityId: varchar("entity_id", { length: 36 }).notNull(),
      oldValue: text("old_value"),
      newValue: text("new_value"),
      reason: text("reason"),
      ipAddress: varchar("ip_address", { length: 45 }),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      auditLogsUserIdx: index("audit_logs_user_idx").on(table.userId),
      auditLogsEntityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
      auditLogsDateIdx: index("audit_logs_date_idx").on(table.createdAt),
      auditLogsActionIdx: index("audit_logs_action_idx").on(table.action)
    }));
    performanceEvents = pgTable("performance_events", {
      id: serial("id").primaryKey(),
      sessionId: integer("session_id").references(() => examSessions.id, { onDelete: "cascade" }),
      eventType: varchar("event_type", { length: 50 }).notNull(),
      duration: integer("duration").notNull().default(0),
      goalAchieved: boolean("goal_achieved").notNull().default(false),
      metadata: text("metadata"),
      clientSide: boolean("client_side").notNull().default(false),
      userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      performanceEventsTypeIdx: index("performance_events_type_idx").on(table.eventType),
      performanceEventsDateIdx: index("performance_events_date_idx").on(table.createdAt),
      performanceEventsSessionIdx: index("performance_events_session_idx").on(table.sessionId),
      performanceEventsGoalIdx: index("performance_events_goal_idx").on(table.goalAchieved, table.eventType)
    }));
    settings = pgTable("settings", {
      id: serial("id").primaryKey(),
      key: varchar("key", { length: 100 }).notNull().unique(),
      value: text("value").notNull(),
      description: text("description"),
      updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    counters = pgTable("counters", {
      id: serial("id").primaryKey(),
      roleCode: varchar("role_code", { length: 10 }).notNull(),
      classCode: varchar("class_code", { length: 50 }),
      year: varchar("year", { length: 10 }),
      sequence: integer("sequence").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      countersRoleCodeIdx: uniqueIndex("counters_role_code_idx").on(table.roleCode)
    }));
    vacancies = pgTable("vacancies", {
      id: varchar("id", { length: 36 }).primaryKey(),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description").notNull(),
      requirements: text("requirements"),
      deadline: timestamp("deadline").notNull(),
      status: varchar("status", { length: 20 }).notNull().default("open"),
      createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      vacanciesStatusIdx: index("vacancies_status_idx").on(table.status),
      vacanciesDeadlineIdx: index("vacancies_deadline_idx").on(table.deadline)
    }));
    teacherApplications = pgTable("teacher_applications", {
      id: varchar("id", { length: 36 }).primaryKey(),
      vacancyId: varchar("vacancy_id", { length: 36 }).references(() => vacancies.id, { onDelete: "set null" }),
      fullName: varchar("full_name", { length: 255 }).notNull(),
      email: varchar("email", { length: 255 }).notNull(),
      phone: varchar("phone", { length: 50 }),
      qualifications: text("qualifications"),
      experience: text("experience"),
      subjectSpecialty: varchar("subject_specialty", { length: 255 }),
      coverLetter: text("cover_letter"),
      resumeUrl: text("resume_url"),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      reviewedAt: timestamp("reviewed_at"),
      reviewNotes: text("review_notes"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      teacherApplicationsStatusIdx: index("teacher_applications_status_idx").on(table.status),
      teacherApplicationsEmailIdx: index("teacher_applications_email_idx").on(table.email)
    }));
    approvedTeachers = pgTable("approved_teachers", {
      id: varchar("id", { length: 36 }).primaryKey(),
      applicationId: varchar("application_id", { length: 36 }).references(() => teacherApplications.id, { onDelete: "set null" }),
      googleEmail: varchar("google_email", { length: 255 }).notNull().unique(),
      fullName: varchar("full_name", { length: 255 }).notNull(),
      subjectSpecialty: varchar("subject_specialty", { length: 255 }),
      approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      dateApproved: timestamp("date_approved").notNull().defaultNow(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      approvedTeachersEmailIdx: index("approved_teachers_email_idx").on(table.googleEmail)
    }));
    syncAuditLogs = pgTable("sync_audit_logs", {
      id: serial("id").primaryKey(),
      syncType: varchar("sync_type", { length: 50 }).notNull(),
      // 'exam_submit', 'manual_sync', 'bulk_sync', 'retry'
      studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
      examId: integer("exam_id").references(() => exams.id, { onDelete: "set null" }),
      examResultId: integer("exam_result_id").references(() => examResults.id, { onDelete: "set null" }),
      reportCardId: integer("report_card_id").references(() => reportCards.id, { onDelete: "set null" }),
      reportCardItemId: integer("report_card_item_id").references(() => reportCardItems.id, { onDelete: "set null" }),
      subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "set null" }),
      termId: integer("term_id").references(() => academicTerms.id, { onDelete: "set null" }),
      score: integer("score"),
      maxScore: integer("max_score"),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      // 'pending', 'success', 'failed', 'retrying'
      errorMessage: text("error_message"),
      errorCode: varchar("error_code", { length: 50 }),
      retryCount: integer("retry_count").notNull().default(0),
      maxRetries: integer("max_retries").notNull().default(3),
      lastRetryAt: timestamp("last_retry_at"),
      nextRetryAt: timestamp("next_retry_at"),
      triggeredBy: varchar("triggered_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
      syncedAt: timestamp("synced_at"),
      metadata: text("metadata"),
      // JSON string for additional context
      idempotencyKey: varchar("idempotency_key", { length: 100 }),
      // Prevents duplicate syncs
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      syncAuditLogsStudentIdx: index("sync_audit_logs_student_idx").on(table.studentId),
      syncAuditLogsExamIdx: index("sync_audit_logs_exam_idx").on(table.examId),
      syncAuditLogsStatusIdx: index("sync_audit_logs_status_idx").on(table.status),
      syncAuditLogsTypeIdx: index("sync_audit_logs_type_idx").on(table.syncType),
      syncAuditLogsIdempotencyIdx: uniqueIndex("sync_audit_logs_idempotency_idx").on(table.idempotencyKey),
      syncAuditLogsCreatedAtIdx: index("sync_audit_logs_created_at_idx").on(table.createdAt),
      syncAuditLogsRetryIdx: index("sync_audit_logs_retry_idx").on(table.status, table.nextRetryAt)
    }));
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  academicTerms: () => academicTerms2,
  adminProfiles: () => adminProfiles2,
  announcements: () => announcements2,
  approvedTeachers: () => approvedTeachers2,
  attendance: () => attendance2,
  auditLogs: () => auditLogs2,
  classSubjectMappings: () => classSubjectMappings2,
  classes: () => classes2,
  contactMessages: () => contactMessages2,
  continuousAssessment: () => continuousAssessment2,
  counters: () => counters2,
  createQuestionOptionSchema: () => createQuestionOptionSchema,
  createStudentSchema: () => createStudentSchema,
  createStudentWithAutoCredsSchema: () => createStudentWithAutoCredsSchema,
  csvStudentSchema: () => csvStudentSchema,
  examQuestions: () => examQuestions2,
  examResults: () => examResults2,
  examSessions: () => examSessions2,
  examSubmissionsArchive: () => examSubmissionsArchive2,
  exams: () => exams2,
  gallery: () => gallery2,
  galleryCategories: () => galleryCategories2,
  gradingBoundaries: () => gradingBoundaries2,
  gradingTasks: () => gradingTasks2,
  homePageContent: () => homePageContent2,
  insertAcademicTermSchema: () => insertAcademicTermSchema,
  insertAdminProfileSchema: () => insertAdminProfileSchema,
  insertAnnouncementSchema: () => insertAnnouncementSchema,
  insertApprovedTeacherSchema: () => insertApprovedTeacherSchema,
  insertAttendanceSchema: () => insertAttendanceSchema,
  insertAuditLogSchema: () => insertAuditLogSchema,
  insertClassSchema: () => insertClassSchema,
  insertClassSubjectMappingSchema: () => insertClassSubjectMappingSchema,
  insertContactMessageSchema: () => insertContactMessageSchema,
  insertContinuousAssessmentSchema: () => insertContinuousAssessmentSchema,
  insertCounterSchema: () => insertCounterSchema,
  insertExamQuestionSchema: () => insertExamQuestionSchema,
  insertExamResultSchema: () => insertExamResultSchema,
  insertExamSchema: () => insertExamSchema,
  insertExamSessionSchema: () => insertExamSessionSchema,
  insertExamSubmissionsArchiveSchema: () => insertExamSubmissionsArchiveSchema,
  insertGalleryCategorySchema: () => insertGalleryCategorySchema,
  insertGallerySchema: () => insertGallerySchema,
  insertGradingBoundarySchema: () => insertGradingBoundarySchema,
  insertGradingTaskSchema: () => insertGradingTaskSchema,
  insertHomePageContentSchema: () => insertHomePageContentSchema,
  insertInviteSchema: () => insertInviteSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertParentProfileSchema: () => insertParentProfileSchema,
  insertPasswordResetAttemptSchema: () => insertPasswordResetAttemptSchema,
  insertPasswordResetTokenSchema: () => insertPasswordResetTokenSchema,
  insertPerformanceEventSchema: () => insertPerformanceEventSchema,
  insertQuestionBankItemSchema: () => insertQuestionBankItemSchema,
  insertQuestionBankOptionSchema: () => insertQuestionBankOptionSchema,
  insertQuestionBankSchema: () => insertQuestionBankSchema,
  insertQuestionOptionSchema: () => insertQuestionOptionSchema,
  insertReportCardItemSchema: () => insertReportCardItemSchema,
  insertReportCardSchema: () => insertReportCardSchema,
  insertReportCardSkillsSchema: () => insertReportCardSkillsSchema,
  insertReportCommentTemplateSchema: () => insertReportCommentTemplateSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertSettingSchema: () => insertSettingSchema,
  insertStudentAnswerSchema: () => insertStudentAnswerSchema,
  insertStudentSchema: () => insertStudentSchema,
  insertStudentSubjectAssignmentSchema: () => insertStudentSubjectAssignmentSchema,
  insertStudyResourceSchema: () => insertStudyResourceSchema,
  insertSubjectSchema: () => insertSubjectSchema,
  insertSuperAdminProfileSchema: () => insertSuperAdminProfileSchema,
  insertSystemSettingsSchema: () => insertSystemSettingsSchema,
  insertTeacherApplicationSchema: () => insertTeacherApplicationSchema,
  insertTeacherAssignmentHistorySchema: () => insertTeacherAssignmentHistorySchema,
  insertTeacherClassAssignmentSchema: () => insertTeacherClassAssignmentSchema,
  insertTeacherProfileSchema: () => insertTeacherProfileSchema,
  insertTimetableSchema: () => insertTimetableSchema,
  insertUnauthorizedAccessLogSchema: () => insertUnauthorizedAccessLogSchema,
  insertUserSchema: () => insertUserSchema,
  insertVacancySchema: () => insertVacancySchema,
  invites: () => invites2,
  messages: () => messages2,
  notifications: () => notifications2,
  parentProfiles: () => parentProfiles2,
  passwordResetAttempts: () => passwordResetAttempts2,
  passwordResetTokens: () => passwordResetTokens2,
  performanceEvents: () => performanceEvents2,
  questionBankItems: () => questionBankItems2,
  questionBankOptions: () => questionBankOptions2,
  questionBanks: () => questionBanks2,
  questionOptions: () => questionOptions2,
  quickCreateStudentSchema: () => quickCreateStudentSchema,
  reportCardItems: () => reportCardItems2,
  reportCardSkills: () => reportCardSkills2,
  reportCards: () => reportCards2,
  reportCommentTemplates: () => reportCommentTemplates2,
  roles: () => roles2,
  settings: () => settings2,
  studentAnswers: () => studentAnswers2,
  studentSubjectAssignments: () => studentSubjectAssignments2,
  students: () => students2,
  studyResources: () => studyResources2,
  subjects: () => subjects2,
  superAdminProfiles: () => superAdminProfiles2,
  systemSettings: () => systemSettings2,
  teacherApplications: () => teacherApplications2,
  teacherAssignmentHistory: () => teacherAssignmentHistory2,
  teacherClassAssignments: () => teacherClassAssignments2,
  teacherProfiles: () => teacherProfiles2,
  timetable: () => timetable2,
  unauthorizedAccessLogs: () => unauthorizedAccessLogs2,
  updateExamSessionSchema: () => updateExamSessionSchema,
  users: () => users2,
  vacancies: () => vacancies2
});
import { sql } from "drizzle-orm";
import { sqliteTable, text as text2, integer as integer2, index as index2, uniqueIndex as uniqueIndex2 } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var roles2, users2, passwordResetTokens2, passwordResetAttempts2, invites2, notifications2, academicTerms2, classes2, subjects2, students2, teacherProfiles2, adminProfiles2, parentProfiles2, superAdminProfiles2, systemSettings2, attendance2, exams2, examQuestions2, questionOptions2, examSessions2, studentAnswers2, examResults2, examSubmissionsArchive2, questionBanks2, questionBankItems2, questionBankOptions2, announcements2, messages2, galleryCategories2, gallery2, homePageContent2, contactMessages2, reportCommentTemplates2, reportCards2, reportCardItems2, reportCardSkills2, studyResources2, performanceEvents2, teacherClassAssignments2, teacherAssignmentHistory2, gradingBoundaries2, continuousAssessment2, unauthorizedAccessLogs2, studentSubjectAssignments2, classSubjectMappings2, timetable2, gradingTasks2, auditLogs2, settings2, counters2, vacancies2, teacherApplications2, approvedTeachers2, insertRoleSchema, insertUserSchema, insertPasswordResetTokenSchema, insertPasswordResetAttemptSchema, insertInviteSchema, insertStudentSchema, insertClassSchema, insertSubjectSchema, insertAcademicTermSchema, insertAttendanceSchema, insertExamSchema, insertExamResultSchema, insertExamSubmissionsArchiveSchema, insertAnnouncementSchema, insertMessageSchema, insertGalleryCategorySchema, insertGallerySchema, insertHomePageContentSchema, insertContactMessageSchema, insertReportCommentTemplateSchema, insertReportCardSchema, insertReportCardSkillsSchema, insertReportCardItemSchema, insertStudyResourceSchema, insertPerformanceEventSchema, insertTeacherClassAssignmentSchema, insertTeacherAssignmentHistorySchema, insertGradingBoundarySchema, insertContinuousAssessmentSchema, insertUnauthorizedAccessLogSchema, insertTimetableSchema, insertGradingTaskSchema, insertAuditLogSchema, insertSettingSchema, insertCounterSchema, createStudentWithAutoCredsSchema, createStudentSchema, quickCreateStudentSchema, csvStudentSchema, insertExamQuestionSchema, insertQuestionOptionSchema, createQuestionOptionSchema, insertExamSessionSchema, updateExamSessionSchema, insertStudentAnswerSchema, insertNotificationSchema, insertTeacherProfileSchema, insertAdminProfileSchema, insertParentProfileSchema, insertStudentSubjectAssignmentSchema, insertClassSubjectMappingSchema, insertVacancySchema, insertTeacherApplicationSchema, insertApprovedTeacherSchema, insertSuperAdminProfileSchema, insertSystemSettingsSchema, insertQuestionBankSchema, insertQuestionBankItemSchema, insertQuestionBankOptionSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    roles2 = sqliteTable("roles", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull().unique(),
      permissions: text2("permissions").notNull().default("[]"),
      // JSON array as text
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    users2 = sqliteTable("users", {
      id: text2("id").primaryKey(),
      username: text2("username").unique(),
      email: text2("email").notNull(),
      recoveryEmail: text2("recovery_email"),
      passwordHash: text2("password_hash"),
      mustChangePassword: integer2("must_change_password", { mode: "boolean" }).notNull().default(true),
      roleId: integer2("role_id").notNull().references(() => roles2.id),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone"),
      address: text2("address"),
      dateOfBirth: text2("date_of_birth"),
      // YYYY-MM-DD format
      gender: text2("gender"),
      // 'Male', 'Female', 'Other'
      nationalId: text2("national_id"),
      profileImageUrl: text2("profile_image_url"),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      authProvider: text2("auth_provider").notNull().default("local"),
      googleId: text2("google_id").unique(),
      // Security & audit fields
      status: text2("status").notNull().default("active"),
      // 'pending', 'active', 'suspended', 'disabled'
      createdVia: text2("created_via").notNull().default("admin"),
      // 'bulk', 'invite', 'self', 'google', 'admin'
      createdBy: text2("created_by"),
      approvedBy: text2("approved_by"),
      approvedAt: integer2("approved_at", { mode: "timestamp" }),
      lastLoginAt: integer2("last_login_at", { mode: "timestamp" }),
      lastLoginIp: text2("last_login_ip"),
      mfaEnabled: integer2("mfa_enabled", { mode: "boolean" }).notNull().default(false),
      mfaSecret: text2("mfa_secret"),
      accountLockedUntil: integer2("account_locked_until", { mode: "timestamp" }),
      // Profile completion fields
      profileCompleted: integer2("profile_completed", { mode: "boolean" }).notNull().default(false),
      profileSkipped: integer2("profile_skipped", { mode: "boolean" }).notNull().default(false),
      profileCompletionPercentage: integer2("profile_completion_percentage").notNull().default(0),
      state: text2("state"),
      country: text2("country"),
      securityQuestion: text2("security_question"),
      securityAnswerHash: text2("security_answer_hash"),
      dataPolicyAgreed: integer2("data_policy_agreed", { mode: "boolean" }).notNull().default(false),
      dataPolicyAgreedAt: integer2("data_policy_agreed_at", { mode: "timestamp" }),
      deletedAt: integer2("deleted_at", { mode: "timestamp" }),
      deletedBy: text2("deleted_by"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      usersEmailIdx: index2("users_email_idx").on(table.email),
      usersStatusIdx: index2("users_status_idx").on(table.status),
      usersGoogleIdIdx: index2("users_google_id_idx").on(table.googleId),
      usersRoleIdIdx: index2("users_role_id_idx").on(table.roleId),
      usersUsernameIdx: index2("users_username_idx").on(table.username),
      usersDeletedAtIdx: index2("users_deleted_at_idx").on(table.deletedAt)
    }));
    passwordResetTokens2 = sqliteTable("password_reset_tokens", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().references(() => users2.id, { onDelete: "cascade" }),
      token: text2("token").notNull().unique(),
      expiresAt: integer2("expires_at", { mode: "timestamp" }).notNull(),
      usedAt: integer2("used_at", { mode: "timestamp" }),
      ipAddress: text2("ip_address"),
      resetBy: text2("reset_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      passwordResetTokensUserIdIdx: index2("password_reset_tokens_user_id_idx").on(table.userId),
      passwordResetTokensTokenIdx: index2("password_reset_tokens_token_idx").on(table.token)
    }));
    passwordResetAttempts2 = sqliteTable("password_reset_attempts", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      identifier: text2("identifier").notNull(),
      ipAddress: text2("ip_address").notNull(),
      attemptedAt: integer2("attempted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      success: integer2("success", { mode: "boolean" }).notNull().default(false)
    }, (table) => ({
      passwordResetAttemptsIdentifierIdx: index2("password_reset_attempts_identifier_idx").on(table.identifier),
      passwordResetAttemptsIpIdx: index2("password_reset_attempts_ip_idx").on(table.ipAddress),
      passwordResetAttemptsTimeIdx: index2("password_reset_attempts_time_idx").on(table.attemptedAt)
    }));
    invites2 = sqliteTable("invites", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      token: text2("token").notNull().unique(),
      email: text2("email").notNull(),
      roleId: integer2("role_id").notNull().references(() => roles2.id),
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      expiresAt: integer2("expires_at", { mode: "timestamp" }).notNull(),
      acceptedAt: integer2("accepted_at", { mode: "timestamp" }),
      acceptedBy: text2("accepted_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      invitesTokenIdx: index2("invites_token_idx").on(table.token),
      invitesEmailIdx: index2("invites_email_idx").on(table.email)
    }));
    notifications2 = sqliteTable("notifications", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().references(() => users2.id, { onDelete: "cascade" }),
      type: text2("type").notNull(),
      title: text2("title").notNull(),
      message: text2("message").notNull(),
      relatedEntityType: text2("related_entity_type"),
      relatedEntityId: text2("related_entity_id"),
      isRead: integer2("is_read", { mode: "boolean" }).notNull().default(false),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      notificationsUserIdIdx: index2("notifications_user_id_idx").on(table.userId),
      notificationsIsReadIdx: index2("notifications_is_read_idx").on(table.isRead)
    }));
    academicTerms2 = sqliteTable("academic_terms", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      year: text2("year").notNull(),
      startDate: text2("start_date").notNull(),
      // YYYY-MM-DD format
      endDate: text2("end_date").notNull(),
      isCurrent: integer2("is_current", { mode: "boolean" }).notNull().default(false),
      status: text2("status").notNull().default("upcoming"),
      // upcoming, active, completed, archived
      isLocked: integer2("is_locked", { mode: "boolean" }).notNull().default(false),
      description: text2("description"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      academicTermsYearIdx: index2("academic_terms_year_idx").on(table.year),
      academicTermsStatusIdx: index2("academic_terms_status_idx").on(table.status),
      academicTermsCurrentIdx: index2("academic_terms_current_idx").on(table.isCurrent)
    }));
    classes2 = sqliteTable("classes", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull().unique(),
      level: text2("level").notNull(),
      capacity: integer2("capacity").notNull().default(30),
      classTeacherId: text2("class_teacher_id").references(() => users2.id, { onDelete: "set null" }),
      currentTermId: integer2("current_term_id").references(() => academicTerms2.id),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    subjects2 = sqliteTable("subjects", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      code: text2("code").notNull().unique(),
      description: text2("description"),
      category: text2("category").notNull().default("general"),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    students2 = sqliteTable("students", {
      id: text2("id").primaryKey().references(() => users2.id, { onDelete: "cascade" }),
      admissionNumber: text2("admission_number").notNull().unique(),
      classId: integer2("class_id").references(() => classes2.id),
      parentId: text2("parent_id").references(() => users2.id, { onDelete: "set null" }),
      department: text2("department"),
      admissionDate: text2("admission_date").notNull(),
      // YYYY-MM-DD format
      emergencyContact: text2("emergency_contact"),
      emergencyPhone: text2("emergency_phone"),
      medicalInfo: text2("medical_info"),
      guardianName: text2("guardian_name"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    teacherProfiles2 = sqliteTable("teacher_profiles", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().unique().references(() => users2.id, { onDelete: "cascade" }),
      staffId: text2("staff_id").unique(),
      subjects: text2("subjects").notNull().default("[]"),
      // JSON array of integers
      assignedClasses: text2("assigned_classes").notNull().default("[]"),
      // JSON array of integers
      qualification: text2("qualification"),
      yearsOfExperience: integer2("years_of_experience").notNull().default(0),
      specialization: text2("specialization"),
      department: text2("department"),
      signatureUrl: text2("signature_url"),
      gradingMode: text2("grading_mode").notNull().default("manual"),
      autoGradeTheoryQuestions: integer2("auto_grade_theory_questions", { mode: "boolean" }).notNull().default(false),
      theoryGradingInstructions: text2("theory_grading_instructions"),
      notificationPreference: text2("notification_preference").notNull().default("all"),
      availability: text2("availability"),
      firstLogin: integer2("first_login", { mode: "boolean" }).notNull().default(true),
      verified: integer2("verified", { mode: "boolean" }).notNull().default(false),
      verifiedBy: text2("verified_by").references(() => users2.id, { onDelete: "set null" }),
      verifiedAt: integer2("verified_at", { mode: "timestamp" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    adminProfiles2 = sqliteTable("admin_profiles", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().unique().references(() => users2.id, { onDelete: "cascade" }),
      department: text2("department"),
      roleDescription: text2("role_description"),
      accessLevel: text2("access_level"),
      signatureUrl: text2("signature_url"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    parentProfiles2 = sqliteTable("parent_profiles", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().unique().references(() => users2.id, { onDelete: "cascade" }),
      occupation: text2("occupation"),
      contactPreference: text2("contact_preference"),
      linkedStudents: text2("linked_students").notNull().default("[]"),
      // JSON array of UUIDs
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    superAdminProfiles2 = sqliteTable("super_admin_profiles", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").notNull().unique().references(() => users2.id, { onDelete: "cascade" }),
      department: text2("department"),
      accessLevel: text2("access_level").notNull().default("full"),
      twoFactorEnabled: integer2("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
      twoFactorSecret: text2("two_factor_secret"),
      lastPasswordChange: integer2("last_password_change", { mode: "timestamp" }),
      signatureUrl: text2("signature_url"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    systemSettings2 = sqliteTable("system_settings", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      schoolName: text2("school_name"),
      schoolShortName: text2("school_short_name"),
      schoolMotto: text2("school_motto"),
      schoolLogo: text2("school_logo"),
      favicon: text2("favicon"),
      schoolAddress: text2("school_address"),
      schoolPhones: text2("school_phones").notNull().default("[]"),
      // JSON array of {countryCode, number}
      schoolEmails: text2("school_emails").notNull().default("[]"),
      // JSON array of strings
      websiteTitle: text2("website_title"),
      footerText: text2("footer_text"),
      maintenanceMode: integer2("maintenance_mode", { mode: "boolean" }).notNull().default(false),
      maintenanceModeMessage: text2("maintenance_mode_message"),
      enableSmsNotifications: integer2("enable_sms_notifications", { mode: "boolean" }).notNull().default(false),
      enableEmailNotifications: integer2("enable_email_notifications", { mode: "boolean" }).notNull().default(true),
      enableExamsModule: integer2("enable_exams_module", { mode: "boolean" }).notNull().default(true),
      enableAttendanceModule: integer2("enable_attendance_module", { mode: "boolean" }).notNull().default(true),
      enableResultsModule: integer2("enable_results_module", { mode: "boolean" }).notNull().default(true),
      tempPasswordFormat: text2("temp_password_format").notNull().default("THS@{year}#{random4}"),
      hideAdminAccountsFromAdmins: integer2("hide_admin_accounts_from_admins", { mode: "boolean" }).notNull().default(true),
      testWeight: integer2("test_weight").notNull().default(40),
      examWeight: integer2("exam_weight").notNull().default(60),
      defaultGradingScale: text2("default_grading_scale").notNull().default("standard"),
      scoreAggregationMode: text2("score_aggregation_mode").notNull().default("last"),
      autoCreateReportCard: integer2("auto_create_report_card", { mode: "boolean" }).notNull().default(true),
      showGradeBreakdown: integer2("show_grade_breakdown", { mode: "boolean" }).notNull().default(true),
      allowTeacherOverrides: integer2("allow_teacher_overrides", { mode: "boolean" }).notNull().default(true),
      positioningMethod: text2("positioning_method").notNull().default("average"),
      deletedUserRetentionDays: integer2("deleted_user_retention_days").notNull().default(30),
      // Authentication Settings
      loginIdentifier: text2("login_identifier").notNull().default("username"),
      // 'email', 'username', 'both'
      enableRememberMe: integer2("enable_remember_me", { mode: "boolean" }).notNull().default(true),
      enableStudentPortal: integer2("enable_student_portal", { mode: "boolean" }).notNull().default(true),
      enableAdminPortal: integer2("enable_admin_portal", { mode: "boolean" }).notNull().default(true),
      allowRegistration: integer2("allow_registration", { mode: "boolean" }).notNull().default(false),
      defaultRegistrationRoleId: integer2("default_registration_role_id").notNull().default(4),
      sessionTimeout: integer2("session_timeout").notNull().default(30),
      // minutes
      allowMultipleLogins: integer2("allow_multiple_logins", { mode: "boolean" }).notNull().default(false),
      autoDisableInactiveDays: integer2("auto_disable_inactive_days").notNull().default(90),
      requireAdminApproval: integer2("require_admin_approval", { mode: "boolean" }).notNull().default(true),
      redirectAfterLogin: text2("redirect_after_login").notNull().default("dashboard"),
      // 'dashboard', 'last_page'
      loginErrorDisplay: text2("login_error_display").notNull().default("generic"),
      // 'generic', 'detailed'
      // Branding & Theme
      primaryColor: text2("primary_color").notNull().default("#3b82f6"),
      secondaryColor: text2("secondary_color").notNull().default("#1e293b"),
      defaultTheme: text2("default_theme").notNull().default("light"),
      // 'light', 'dark'
      loginPageText: text2("login_page_text").notNull().default("Welcome to Treasure Home School Portal"),
      dashboardWelcomeMessage: text2("dashboard_welcome_message").notNull().default("Welcome back to your dashboard"),
      // General Configuration
      portalName: text2("portal_name").notNull().default("Treasure Home School Portal"),
      timezone: text2("timezone").notNull().default("Africa/Lagos"),
      language: text2("language").notNull().default("en"),
      dateFormat: text2("date_format").notNull().default("DD/MM/YYYY"),
      timeFormat: text2("time_format").notNull().default("HH:mm"),
      // Integrations
      enableOnlinePayments: integer2("enable_online_payments", { mode: "boolean" }).notNull().default(false),
      // Backup & Restore
      autoBackup: integer2("auto_backup", { mode: "boolean" }).notNull().default(false),
      backupFrequency: text2("backup_frequency").notNull().default("daily"),
      // 'daily', 'weekly'
      lastBackupDate: integer2("last_backup_date", { mode: "timestamp" }),
      // API & Access Tokens
      enableApiAccess: integer2("enable_api_access", { mode: "boolean" }).notNull().default(false),
      apiAccessKey: text2("api_access_key"),
      // Security Policies
      minPasswordLength: integer2("min_password_length").notNull().default(8),
      requirePasswordNumbers: integer2("require_password_numbers", { mode: "boolean" }).notNull().default(true),
      requirePasswordLetters: integer2("require_password_letters", { mode: "boolean" }).notNull().default(true),
      requirePasswordSpecial: integer2("require_password_special", { mode: "boolean" }).notNull().default(true),
      maxFailedLoginAttempts: integer2("max_failed_login_attempts").notNull().default(5),
      enableLockAccount: integer2("enable_lock_account", { mode: "boolean" }).notNull().default(true),
      lockoutDuration: integer2("lockout_duration").notNull().default(15),
      // minutes
      passwordResetExpiry: integer2("password_reset_expiry").notNull().default(30),
      // minutes
      invalidateOldPasswordOnReset: integer2("invalidate_old_password_on_reset", { mode: "boolean" }).notNull().default(true),
      enableTwoFactor: integer2("enable_two_factor", { mode: "boolean" }).notNull().default(false),
      twoFactorTarget: text2("two_factor_target").notNull().default("admins"),
      // 'admins', 'all'
      logoutOnPasswordChange: integer2("logout_on_password_change", { mode: "boolean" }).notNull().default(true),
      updatedBy: text2("updated_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    attendance2 = sqliteTable("attendance", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      date: text2("date").notNull(),
      // YYYY-MM-DD format
      status: text2("status").notNull(),
      // 'Present', 'Absent', 'Late', 'Excused'
      recordedBy: text2("recorded_by").references(() => users2.id, { onDelete: "set null" }),
      notes: text2("notes"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    exams2 = sqliteTable("exams", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      totalMarks: integer2("total_marks").notNull(),
      date: text2("date").notNull(),
      // YYYY-MM-DD format
      termId: integer2("term_id").notNull().references(() => academicTerms2.id),
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      teacherInChargeId: text2("teacher_in_charge_id").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      examType: text2("exam_type").notNull().default("exam"),
      // 'test', 'exam'
      timerMode: text2("timer_mode").notNull().default("individual"),
      // 'global', 'individual'
      timeLimit: integer2("time_limit"),
      // in minutes
      startTime: integer2("start_time", { mode: "timestamp" }),
      endTime: integer2("end_time", { mode: "timestamp" }),
      instructions: text2("instructions"),
      isPublished: integer2("is_published", { mode: "boolean" }).notNull().default(false),
      allowRetakes: integer2("allow_retakes", { mode: "boolean" }).notNull().default(false),
      shuffleQuestions: integer2("shuffle_questions", { mode: "boolean" }).notNull().default(false),
      autoGradingEnabled: integer2("auto_grading_enabled", { mode: "boolean" }).notNull().default(true),
      instantFeedback: integer2("instant_feedback", { mode: "boolean" }).notNull().default(false),
      showCorrectAnswers: integer2("show_correct_answers", { mode: "boolean" }).notNull().default(false),
      passingScore: integer2("passing_score"),
      gradingScale: text2("grading_scale").notNull().default("standard"),
      enableProctoring: integer2("enable_proctoring", { mode: "boolean" }).notNull().default(false),
      lockdownMode: integer2("lockdown_mode", { mode: "boolean" }).notNull().default(false),
      requireWebcam: integer2("require_webcam", { mode: "boolean" }).notNull().default(false),
      requireFullscreen: integer2("require_fullscreen", { mode: "boolean" }).notNull().default(false),
      maxTabSwitches: integer2("max_tab_switches").notNull().default(3),
      shuffleOptions: integer2("shuffle_options", { mode: "boolean" }).notNull().default(false)
    });
    examQuestions2 = sqliteTable("exam_questions", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      examId: integer2("exam_id").notNull().references(() => exams2.id),
      questionText: text2("question_text").notNull(),
      questionType: text2("question_type").notNull(),
      // 'multiple_choice', 'text', 'essay', 'true_false', 'fill_blank'
      points: integer2("points").notNull().default(1),
      orderNumber: integer2("order_number").notNull(),
      imageUrl: text2("image_url"),
      autoGradable: integer2("auto_gradable", { mode: "boolean" }).notNull().default(true),
      expectedAnswers: text2("expected_answers").notNull().default("[]"),
      // JSON array
      caseSensitive: integer2("case_sensitive", { mode: "boolean" }).notNull().default(false),
      allowPartialCredit: integer2("allow_partial_credit", { mode: "boolean" }).notNull().default(false),
      partialCreditRules: text2("partial_credit_rules"),
      explanationText: text2("explanation_text"),
      hintText: text2("hint_text"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      examQuestionsExamIdIdx: index2("exam_questions_exam_id_idx").on(table.examId),
      examQuestionsOrderIdx: index2("exam_questions_order_idx").on(table.examId, table.orderNumber)
    }));
    questionOptions2 = sqliteTable("question_options", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      questionId: integer2("question_id").notNull().references(() => examQuestions2.id),
      optionText: text2("option_text").notNull(),
      isCorrect: integer2("is_correct", { mode: "boolean" }).notNull().default(false),
      orderNumber: integer2("order_number").notNull(),
      partialCreditValue: integer2("partial_credit_value").notNull().default(0),
      explanationText: text2("explanation_text"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      questionOptionsQuestionIdIdx: index2("question_options_question_id_idx").on(table.questionId),
      questionOptionsCorrectIdx: index2("question_options_correct_idx").on(table.questionId, table.isCorrect)
    }));
    examSessions2 = sqliteTable("exam_sessions", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      examId: integer2("exam_id").notNull().references(() => exams2.id),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      startedAt: integer2("started_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      submittedAt: integer2("submitted_at", { mode: "timestamp" }),
      timeRemaining: integer2("time_remaining"),
      isCompleted: integer2("is_completed", { mode: "boolean" }).notNull().default(false),
      score: integer2("score"),
      maxScore: integer2("max_score"),
      status: text2("status").notNull().default("in_progress"),
      // 'in_progress', 'submitted', 'graded'
      metadata: text2("metadata"),
      // JSON string
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      examSessionsExamStudentIdx: index2("exam_sessions_exam_student_idx").on(table.examId, table.studentId),
      examSessionsStudentCompletedIdx: index2("exam_sessions_student_completed_idx").on(table.studentId, table.isCompleted),
      examSessionsActiveSessionsIdx: index2("exam_sessions_active_idx").on(table.examId, table.studentId, table.isCompleted)
    }));
    studentAnswers2 = sqliteTable("student_answers", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      sessionId: integer2("session_id").notNull().references(() => examSessions2.id),
      questionId: integer2("question_id").notNull().references(() => examQuestions2.id),
      selectedOptionId: integer2("selected_option_id").references(() => questionOptions2.id),
      textAnswer: text2("text_answer"),
      isCorrect: integer2("is_correct", { mode: "boolean" }),
      pointsEarned: integer2("points_earned").notNull().default(0),
      answeredAt: integer2("answered_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      autoScored: integer2("auto_scored", { mode: "boolean" }).notNull().default(false),
      manualOverride: integer2("manual_override", { mode: "boolean" }).notNull().default(false),
      feedbackText: text2("feedback_text"),
      partialCreditReason: text2("partial_credit_reason")
    }, (table) => ({
      studentAnswersSessionIdIdx: index2("student_answers_session_id_idx").on(table.sessionId),
      studentAnswersSessionQuestionIdx: index2("student_answers_session_question_idx").on(table.sessionId, table.questionId),
      studentAnswersQuestionIdx: index2("student_answers_question_id_idx").on(table.questionId)
    }));
    examResults2 = sqliteTable("exam_results", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      examId: integer2("exam_id").notNull().references(() => exams2.id),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      score: integer2("score"),
      maxScore: integer2("max_score"),
      marksObtained: integer2("marks_obtained"),
      grade: text2("grade"),
      remarks: text2("remarks"),
      autoScored: integer2("auto_scored", { mode: "boolean" }).notNull().default(false),
      recordedBy: text2("recorded_by").notNull().references(() => users2.id),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      examResultsExamIdIdx: index2("exam_results_exam_id_idx").on(table.examId),
      examResultsStudentIdIdx: index2("exam_results_student_id_idx").on(table.studentId),
      examResultsExamStudentIdx: index2("exam_results_exam_student_idx").on(table.examId, table.studentId),
      examResultsAutoScoredIdx: index2("exam_results_auto_scored_idx").on(table.autoScored, table.examId)
    }));
    examSubmissionsArchive2 = sqliteTable("exam_submissions_archive", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      examId: integer2("exam_id").notNull().references(() => exams2.id),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      originalSessionId: integer2("original_session_id"),
      originalResultId: integer2("original_result_id"),
      oldScore: integer2("old_score"),
      oldMaxScore: integer2("old_max_score"),
      oldAnswers: text2("old_answers"),
      // JSON string of archived answers
      archivedBy: text2("archived_by").notNull().references(() => users2.id),
      archiveReason: text2("archive_reason").notNull().default("retake_allowed"),
      archivedAt: integer2("archived_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      examSubmissionsArchiveExamIdx: index2("exam_submissions_archive_exam_idx").on(table.examId),
      examSubmissionsArchiveStudentIdx: index2("exam_submissions_archive_student_idx").on(table.studentId),
      examSubmissionsArchiveExamStudentIdx: index2("exam_submissions_archive_exam_student_idx").on(table.examId, table.studentId)
    }));
    questionBanks2 = sqliteTable("question_banks", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      description: text2("description"),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      classLevel: text2("class_level"),
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      isPublic: integer2("is_public", { mode: "boolean" }).notNull().default(false),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      questionBanksSubjectIdx: index2("question_banks_subject_idx").on(table.subjectId),
      questionBanksCreatedByIdx: index2("question_banks_created_by_idx").on(table.createdBy)
    }));
    questionBankItems2 = sqliteTable("question_bank_items", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      bankId: integer2("bank_id").notNull().references(() => questionBanks2.id, { onDelete: "cascade" }),
      questionText: text2("question_text").notNull(),
      questionType: text2("question_type").notNull(),
      points: integer2("points").notNull().default(1),
      difficulty: text2("difficulty").notNull().default("medium"),
      tags: text2("tags").notNull().default("[]"),
      // JSON array
      imageUrl: text2("image_url"),
      autoGradable: integer2("auto_gradable", { mode: "boolean" }).notNull().default(true),
      expectedAnswers: text2("expected_answers").notNull().default("[]"),
      // JSON array
      caseSensitive: integer2("case_sensitive", { mode: "boolean" }).notNull().default(false),
      explanationText: text2("explanation_text"),
      hintText: text2("hint_text"),
      practicalInstructions: text2("practical_instructions"),
      practicalFileUrl: text2("practical_file_url"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      questionBankItemsBankIdIdx: index2("question_bank_items_bank_id_idx").on(table.bankId),
      questionBankItemsTypeIdx: index2("question_bank_items_type_idx").on(table.questionType),
      questionBankItemsDifficultyIdx: index2("question_bank_items_difficulty_idx").on(table.difficulty)
    }));
    questionBankOptions2 = sqliteTable("question_bank_options", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      questionItemId: integer2("question_item_id").notNull().references(() => questionBankItems2.id, { onDelete: "cascade" }),
      optionText: text2("option_text").notNull(),
      isCorrect: integer2("is_correct", { mode: "boolean" }).notNull().default(false),
      orderNumber: integer2("order_number").notNull(),
      explanationText: text2("explanation_text"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      questionBankOptionsItemIdIdx: index2("question_bank_options_item_id_idx").on(table.questionItemId)
    }));
    announcements2 = sqliteTable("announcements", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      title: text2("title").notNull(),
      content: text2("content").notNull(),
      authorId: text2("author_id").references(() => users2.id, { onDelete: "set null" }),
      targetRoles: text2("target_roles").notNull().default('["All"]'),
      // JSON array
      targetClasses: text2("target_classes").notNull().default("[]"),
      // JSON array
      isPublished: integer2("is_published", { mode: "boolean" }).notNull().default(false),
      publishedAt: integer2("published_at", { mode: "timestamp" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      // Priority & Type
      priority: text2("priority").notNull().default("normal"),
      // 'normal', 'important', 'urgent'
      announcementType: text2("announcement_type").notNull().default("general"),
      // 'general', 'academic', 'examination', 'event', 'emergency'
      // Scheduling & Expiry
      scheduledAt: integer2("scheduled_at", { mode: "timestamp" }),
      expiryDate: integer2("expiry_date", { mode: "timestamp" }),
      // Attachments (JSON array of file URLs)
      attachments: text2("attachments").notNull().default("[]"),
      coverImageUrl: text2("cover_image_url"),
      // Notification Settings (JSON object)
      notificationSettings: text2("notification_settings").notNull().default('{"inApp": true, "email": false, "sms": false}'),
      // Status & Analytics
      status: text2("status").notNull().default("draft"),
      // 'draft', 'scheduled', 'published', 'expired', 'archived'
      viewCount: integer2("view_count").notNull().default(0),
      allowComments: integer2("allow_comments", { mode: "boolean" }).notNull().default(false),
      allowEdit: integer2("allow_edit", { mode: "boolean" }).notNull().default(true),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    messages2 = sqliteTable("messages", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      senderId: text2("sender_id").references(() => users2.id, { onDelete: "set null" }),
      recipientId: text2("recipient_id").references(() => users2.id, { onDelete: "set null" }),
      subject: text2("subject").notNull(),
      content: text2("content").notNull(),
      isRead: integer2("is_read", { mode: "boolean" }).notNull().default(false),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    galleryCategories2 = sqliteTable("gallery_categories", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      description: text2("description"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    gallery2 = sqliteTable("gallery", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      imageUrl: text2("image_url").notNull(),
      caption: text2("caption"),
      categoryId: integer2("category_id").references(() => galleryCategories2.id),
      uploadedBy: text2("uploaded_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    homePageContent2 = sqliteTable("home_page_content", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      contentType: text2("content_type").notNull(),
      imageUrl: text2("image_url"),
      altText: text2("alt_text"),
      caption: text2("caption"),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      displayOrder: integer2("display_order").notNull().default(0),
      uploadedBy: text2("uploaded_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    contactMessages2 = sqliteTable("contact_messages", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      email: text2("email").notNull(),
      subject: text2("subject"),
      message: text2("message").notNull(),
      isRead: integer2("is_read", { mode: "boolean" }).notNull().default(false),
      respondedAt: integer2("responded_at", { mode: "timestamp" }),
      respondedBy: text2("responded_by").references(() => users2.id, { onDelete: "set null" }),
      response: text2("response"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    reportCommentTemplates2 = sqliteTable("report_comment_templates", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      role: text2("role").notNull(),
      // 'teacher' or 'principal'
      performanceLevel: text2("performance_level").notNull(),
      // 'excellent', 'very_good', 'good', 'fair', 'needs_improvement'
      minPercentage: integer2("min_percentage").notNull(),
      maxPercentage: integer2("max_percentage").notNull(),
      commentTemplate: text2("comment_template").notNull(),
      // Use {lastName} as placeholder
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      updatedBy: text2("updated_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    reportCards2 = sqliteTable("report_cards", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      termId: integer2("term_id").notNull().references(() => academicTerms2.id),
      averagePercentage: integer2("average_percentage"),
      overallGrade: text2("overall_grade"),
      teacherRemarks: text2("teacher_remarks"),
      principalRemarks: text2("principal_remarks"),
      status: text2("status").notNull().default("draft"),
      // 'draft', 'teacher_signed', 'awaiting_approval', 'approved', 'published'
      locked: integer2("locked", { mode: "boolean" }).notNull().default(false),
      teacherSignedBy: text2("teacher_signed_by").references(() => users2.id, { onDelete: "set null" }),
      teacherSignedAt: integer2("teacher_signed_at", { mode: "timestamp" }),
      teacherSignatureUrl: text2("teacher_signature_url"),
      principalSignedBy: text2("principal_signed_by").references(() => users2.id, { onDelete: "set null" }),
      principalSignedAt: integer2("principal_signed_at", { mode: "timestamp" }),
      principalSignatureUrl: text2("principal_signature_url"),
      generatedAt: integer2("generated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      finalizedAt: integer2("finalized_at", { mode: "timestamp" }),
      publishedAt: integer2("published_at", { mode: "timestamp" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    reportCardItems2 = sqliteTable("report_card_items", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      reportCardId: integer2("report_card_id").notNull().references(() => reportCards2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      teacherId: text2("teacher_id").references(() => users2.id, { onDelete: "set null" }),
      testExamId: integer2("test_exam_id").references(() => exams2.id),
      testExamCreatedBy: text2("test_exam_created_by").references(() => users2.id, { onDelete: "set null" }),
      testScore: integer2("test_score"),
      testMaxScore: integer2("test_max_score"),
      testWeightedScore: integer2("test_weighted_score"),
      examExamId: integer2("exam_exam_id").references(() => exams2.id),
      examExamCreatedBy: text2("exam_exam_created_by").references(() => users2.id, { onDelete: "set null" }),
      examScore: integer2("exam_score"),
      examMaxScore: integer2("exam_max_score"),
      examWeightedScore: integer2("exam_weighted_score"),
      totalMarks: integer2("total_marks").notNull().default(100),
      obtainedMarks: integer2("obtained_marks").notNull(),
      percentage: integer2("percentage").notNull(),
      grade: text2("grade"),
      teacherRemarks: text2("teacher_remarks"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    reportCardSkills2 = sqliteTable("report_card_skills", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      reportCardId: integer2("report_card_id").notNull().references(() => reportCards2.id, { onDelete: "cascade" }),
      // Affective traits (1-5 scale)
      punctuality: integer2("punctuality"),
      neatness: integer2("neatness"),
      attentiveness: integer2("attentiveness"),
      teamwork: integer2("teamwork"),
      leadership: integer2("leadership"),
      assignments: integer2("assignments"),
      classParticipation: integer2("class_participation"),
      // Psychomotor skills (1-5 scale)
      sports: integer2("sports"),
      handwriting: integer2("handwriting"),
      musicalSkills: integer2("musical_skills"),
      creativity: integer2("creativity"),
      // Metadata
      recordedBy: text2("recorded_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      reportCardSkillsReportCardIdx: index2("report_card_skills_report_card_idx").on(table.reportCardId)
    }));
    studyResources2 = sqliteTable("study_resources", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      title: text2("title").notNull(),
      description: text2("description"),
      fileUrl: text2("file_url").notNull(),
      fileName: text2("file_name").notNull(),
      fileSize: integer2("file_size"),
      resourceType: text2("resource_type").notNull(),
      subjectId: integer2("subject_id").references(() => subjects2.id),
      classId: integer2("class_id").references(() => classes2.id),
      termId: integer2("term_id").references(() => academicTerms2.id),
      uploadedBy: text2("uploaded_by").references(() => users2.id, { onDelete: "set null" }),
      isPublished: integer2("is_published", { mode: "boolean" }).notNull().default(true),
      downloads: integer2("downloads").notNull().default(0),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    });
    performanceEvents2 = sqliteTable("performance_events", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      sessionId: integer2("session_id").references(() => examSessions2.id),
      eventType: text2("event_type").notNull(),
      duration: integer2("duration").notNull(),
      goalAchieved: integer2("goal_achieved", { mode: "boolean" }).notNull(),
      metadata: text2("metadata"),
      clientSide: integer2("client_side", { mode: "boolean" }).notNull().default(false),
      userId: text2("user_id").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      performanceEventsTypeIdx: index2("performance_events_type_idx").on(table.eventType),
      performanceEventsDateIdx: index2("performance_events_date_idx").on(table.createdAt),
      performanceEventsGoalIdx: index2("performance_events_goal_idx").on(table.goalAchieved, table.eventType)
    }));
    teacherClassAssignments2 = sqliteTable("teacher_class_assignments", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      teacherId: text2("teacher_id").notNull().references(() => users2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      department: text2("department"),
      termId: integer2("term_id").references(() => academicTerms2.id),
      session: text2("session"),
      // Academic session e.g., "2024/2025"
      assignedBy: text2("assigned_by").references(() => users2.id, { onDelete: "set null" }),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      validUntil: integer2("valid_until", { mode: "timestamp" }),
      // Optional expiration date
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      teacherAssignmentsTeacherIdx: index2("teacher_assignments_teacher_idx").on(table.teacherId, table.isActive),
      teacherAssignmentsClassSubjectIdx: index2("teacher_assignments_class_subject_idx").on(table.classId, table.subjectId),
      teacherAssignmentsDeptIdx: index2("teacher_assignments_dept_idx").on(table.department),
      teacherAssignmentsSessionIdx: index2("teacher_assignments_session_idx").on(table.session),
      teacherAssignmentsUniqueIdx: uniqueIndex2("teacher_assignments_unique_idx").on(table.teacherId, table.classId, table.subjectId, table.termId)
    }));
    teacherAssignmentHistory2 = sqliteTable("teacher_assignment_history", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      assignmentId: integer2("assignment_id").references(() => teacherClassAssignments2.id, { onDelete: "set null" }),
      teacherId: text2("teacher_id").notNull().references(() => users2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      action: text2("action").notNull(),
      // 'created', 'updated', 'disabled', 'deleted'
      previousValues: text2("previous_values"),
      // JSON of old values
      newValues: text2("new_values"),
      // JSON of new values
      performedBy: text2("performed_by").references(() => users2.id, { onDelete: "set null" }),
      reason: text2("reason"),
      ipAddress: text2("ip_address"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      assignmentHistoryTeacherIdx: index2("assignment_history_teacher_idx").on(table.teacherId),
      assignmentHistoryActionIdx: index2("assignment_history_action_idx").on(table.action),
      assignmentHistoryDateIdx: index2("assignment_history_date_idx").on(table.createdAt)
    }));
    gradingBoundaries2 = sqliteTable("grading_boundaries", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      name: text2("name").notNull(),
      // e.g., "Standard", "Custom Science"
      grade: text2("grade").notNull(),
      // e.g., "A", "B", "C", "D", "E", "F"
      minScore: integer2("min_score").notNull(),
      // Minimum score for this grade
      maxScore: integer2("max_score").notNull(),
      // Maximum score for this grade
      remark: text2("remark"),
      // e.g., "Excellent", "Very Good", "Good", "Pass", "Fail"
      gradePoint: integer2("grade_point"),
      // Optional: for GPA calculation
      isDefault: integer2("is_default", { mode: "boolean" }).notNull().default(false),
      termId: integer2("term_id").references(() => academicTerms2.id),
      classId: integer2("class_id").references(() => classes2.id),
      // Optional: class-specific grading
      subjectId: integer2("subject_id").references(() => subjects2.id),
      // Optional: subject-specific grading
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      gradingBoundariesNameIdx: index2("grading_boundaries_name_idx").on(table.name),
      gradingBoundariesGradeIdx: index2("grading_boundaries_grade_idx").on(table.grade),
      gradingBoundariesDefaultIdx: index2("grading_boundaries_default_idx").on(table.isDefault)
    }));
    continuousAssessment2 = sqliteTable("continuous_assessment", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      termId: integer2("term_id").notNull().references(() => academicTerms2.id),
      testScore: integer2("test_score"),
      // CA score (max typically 40)
      examScore: integer2("exam_score"),
      // Exam score (max typically 60)
      totalScore: integer2("total_score"),
      // Calculated: testScore + examScore
      grade: text2("grade"),
      // Auto-calculated based on grading boundaries
      remark: text2("remark"),
      teacherId: text2("teacher_id").references(() => users2.id, { onDelete: "set null" }),
      enteredBy: text2("entered_by").references(() => users2.id, { onDelete: "set null" }),
      verifiedBy: text2("verified_by").references(() => users2.id, { onDelete: "set null" }),
      verifiedAt: integer2("verified_at", { mode: "timestamp" }),
      isLocked: integer2("is_locked", { mode: "boolean" }).notNull().default(false),
      lockedBy: text2("locked_by").references(() => users2.id, { onDelete: "set null" }),
      lockedAt: integer2("locked_at", { mode: "timestamp" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      caStudentIdx: index2("ca_student_idx").on(table.studentId),
      caClassSubjectIdx: index2("ca_class_subject_idx").on(table.classId, table.subjectId),
      caTermIdx: index2("ca_term_idx").on(table.termId),
      caTeacherIdx: index2("ca_teacher_idx").on(table.teacherId),
      caUniqueIdx: uniqueIndex2("ca_unique_idx").on(table.studentId, table.subjectId, table.classId, table.termId)
    }));
    unauthorizedAccessLogs2 = sqliteTable("unauthorized_access_logs", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").references(() => users2.id, { onDelete: "set null" }),
      attemptedAction: text2("attempted_action").notNull(),
      attemptedResource: text2("attempted_resource").notNull(),
      classId: integer2("class_id").references(() => classes2.id),
      subjectId: integer2("subject_id").references(() => subjects2.id),
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      reason: text2("reason"),
      // Why access was denied
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      unauthorizedUserIdx: index2("unauthorized_user_idx").on(table.userId),
      unauthorizedActionIdx: index2("unauthorized_action_idx").on(table.attemptedAction),
      unauthorizedDateIdx: index2("unauthorized_date_idx").on(table.createdAt)
    }));
    studentSubjectAssignments2 = sqliteTable("student_subject_assignments", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      studentId: text2("student_id").notNull().references(() => students2.id, { onDelete: "cascade" }),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      termId: integer2("term_id").references(() => academicTerms2.id),
      assignedBy: text2("assigned_by").references(() => users2.id, { onDelete: "set null" }),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      studentSubjectAssignmentsStudentIdx: index2("student_subject_assignments_student_idx").on(table.studentId),
      studentSubjectAssignmentsSubjectIdx: index2("student_subject_assignments_subject_idx").on(table.subjectId),
      studentSubjectAssignmentsClassIdx: index2("student_subject_assignments_class_idx").on(table.classId),
      studentSubjectAssignmentsUniqueIdx: uniqueIndex2("student_subject_assignments_unique_idx").on(table.studentId, table.subjectId, table.classId)
    }));
    classSubjectMappings2 = sqliteTable("class_subject_mappings", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      department: text2("department"),
      isCompulsory: integer2("is_compulsory", { mode: "boolean" }).notNull().default(false),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      classSubjectMappingsClassIdx: index2("class_subject_mappings_class_idx").on(table.classId),
      classSubjectMappingsSubjectIdx: index2("class_subject_mappings_subject_idx").on(table.subjectId),
      classSubjectMappingsDeptIdx: index2("class_subject_mappings_dept_idx").on(table.department),
      classSubjectMappingsUniqueIdx: uniqueIndex2("class_subject_mappings_unique_idx").on(table.classId, table.subjectId, table.department)
    }));
    timetable2 = sqliteTable("timetable", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      teacherId: text2("teacher_id").notNull().references(() => users2.id, { onDelete: "cascade" }),
      classId: integer2("class_id").notNull().references(() => classes2.id),
      subjectId: integer2("subject_id").notNull().references(() => subjects2.id),
      dayOfWeek: text2("day_of_week").notNull(),
      startTime: text2("start_time").notNull(),
      endTime: text2("end_time").notNull(),
      location: text2("location"),
      termId: integer2("term_id").references(() => academicTerms2.id),
      isActive: integer2("is_active", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      timetableTeacherIdx: index2("timetable_teacher_idx").on(table.teacherId, table.isActive),
      timetableDayIdx: index2("timetable_day_idx").on(table.dayOfWeek, table.teacherId)
    }));
    gradingTasks2 = sqliteTable("grading_tasks", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      sessionId: integer2("session_id").notNull().references(() => examSessions2.id, { onDelete: "cascade" }),
      answerId: integer2("answer_id").notNull().references(() => studentAnswers2.id, { onDelete: "cascade" }),
      assignedTeacherId: text2("assigned_teacher_id").references(() => users2.id, { onDelete: "set null" }),
      status: text2("status").notNull().default("pending"),
      priority: integer2("priority").notNull().default(0),
      assignedAt: integer2("assigned_at", { mode: "timestamp" }),
      startedAt: integer2("started_at", { mode: "timestamp" }),
      completedAt: integer2("completed_at", { mode: "timestamp" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      gradingTasksAssignedIdx: index2("grading_tasks_assigned_idx").on(table.assignedTeacherId, table.status),
      gradingTasksStatusIdx: index2("grading_tasks_status_idx").on(table.status, table.priority),
      gradingTasksSessionIdx: index2("grading_tasks_session_idx").on(table.sessionId),
      gradingTasksAnswerUniqueIdx: uniqueIndex2("grading_tasks_answer_unique_idx").on(table.answerId)
    }));
    auditLogs2 = sqliteTable("audit_logs", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      userId: text2("user_id").references(() => users2.id, { onDelete: "set null" }),
      action: text2("action").notNull(),
      entityType: text2("entity_type").notNull(),
      entityId: text2("entity_id").notNull(),
      oldValue: text2("old_value"),
      newValue: text2("new_value"),
      reason: text2("reason"),
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      auditLogsUserIdx: index2("audit_logs_user_idx").on(table.userId),
      auditLogsEntityIdx: index2("audit_logs_entity_idx").on(table.entityType, table.entityId),
      auditLogsDateIdx: index2("audit_logs_date_idx").on(table.createdAt),
      auditLogsActionIdx: index2("audit_logs_action_idx").on(table.action)
    }));
    settings2 = sqliteTable("settings", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      key: text2("key").notNull().unique(),
      value: text2("value").notNull(),
      description: text2("description"),
      dataType: text2("data_type").notNull().default("string"),
      updatedBy: text2("updated_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      settingsKeyIdx: index2("settings_key_idx").on(table.key)
    }));
    counters2 = sqliteTable("counters", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      roleCode: text2("role_code"),
      classCode: text2("class_code"),
      year: text2("year"),
      sequence: integer2("sequence").notNull().default(0),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      countersRoleCodeIdx: uniqueIndex2("counters_role_code_idx").on(table.roleCode)
    }));
    vacancies2 = sqliteTable("vacancies", {
      id: text2("id").primaryKey(),
      title: text2("title").notNull(),
      description: text2("description").notNull(),
      requirements: text2("requirements"),
      deadline: integer2("deadline", { mode: "timestamp" }).notNull(),
      status: text2("status").notNull().default("open"),
      // 'open', 'closed', 'filled'
      createdBy: text2("created_by").references(() => users2.id, { onDelete: "set null" }),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      vacanciesStatusIdx: index2("vacancies_status_idx").on(table.status),
      vacanciesDeadlineIdx: index2("vacancies_deadline_idx").on(table.deadline)
    }));
    teacherApplications2 = sqliteTable("teacher_applications", {
      id: text2("id").primaryKey(),
      vacancyId: text2("vacancy_id").references(() => vacancies2.id, { onDelete: "set null" }),
      fullName: text2("full_name").notNull(),
      googleEmail: text2("google_email").notNull(),
      phone: text2("phone").notNull(),
      subjectSpecialty: text2("subject_specialty").notNull(),
      qualification: text2("qualification").notNull(),
      experienceYears: integer2("experience_years").notNull(),
      bio: text2("bio").notNull(),
      resumeUrl: text2("resume_url"),
      status: text2("status").notNull().default("pending"),
      // 'pending', 'approved', 'rejected'
      reviewedBy: text2("reviewed_by").references(() => users2.id, { onDelete: "set null" }),
      reviewedAt: integer2("reviewed_at", { mode: "timestamp" }),
      rejectionReason: text2("rejection_reason"),
      dateApplied: integer2("date_applied", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      updatedAt: integer2("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      teacherApplicationsStatusIdx: index2("teacher_applications_status_idx").on(table.status),
      teacherApplicationsEmailIdx: index2("teacher_applications_email_idx").on(table.googleEmail),
      teacherApplicationsVacancyIdx: index2("teacher_applications_vacancy_idx").on(table.vacancyId)
    }));
    approvedTeachers2 = sqliteTable("approved_teachers", {
      id: text2("id").primaryKey(),
      applicationId: text2("application_id").references(() => teacherApplications2.id, { onDelete: "set null" }),
      googleEmail: text2("google_email").notNull().unique(),
      fullName: text2("full_name").notNull(),
      subjectSpecialty: text2("subject_specialty"),
      approvedBy: text2("approved_by").references(() => users2.id, { onDelete: "set null" }),
      dateApproved: integer2("date_approved", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
      createdAt: integer2("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
    }, (table) => ({
      approvedTeachersEmailIdx: index2("approved_teachers_email_idx").on(table.googleEmail)
    }));
    insertRoleSchema = createInsertSchema(roles2).omit({ id: true, createdAt: true });
    insertUserSchema = createInsertSchema(users2).omit({ id: true, createdAt: true, updatedAt: true });
    insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens2).omit({ id: true, createdAt: true });
    insertPasswordResetAttemptSchema = createInsertSchema(passwordResetAttempts2).omit({ id: true, attemptedAt: true });
    insertInviteSchema = createInsertSchema(invites2).omit({ id: true, createdAt: true });
    insertStudentSchema = createInsertSchema(students2).omit({ createdAt: true });
    insertClassSchema = createInsertSchema(classes2).omit({ id: true, createdAt: true });
    insertSubjectSchema = createInsertSchema(subjects2).omit({ id: true, createdAt: true });
    insertAcademicTermSchema = createInsertSchema(academicTerms2).omit({ id: true, createdAt: true });
    insertAttendanceSchema = createInsertSchema(attendance2).omit({ id: true, createdAt: true });
    insertExamSchema = createInsertSchema(exams2).omit({ id: true, createdAt: true }).extend({
      classId: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().positive("Please select a valid class")
      ),
      subjectId: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().positive("Please select a valid subject")
      ),
      termId: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().positive("Please select a valid term")
      ),
      totalMarks: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().positive("Total marks must be a positive number")
      ),
      name: z.string().min(1, "Exam name is required"),
      date: z.string().min(1, "Exam date is required").regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").refine((dateStr) => {
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
      }, "Please enter a valid date"),
      examType: z.enum(["test", "exam"]).default("exam"),
      timerMode: z.string().default("individual"),
      timeLimit: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().int().min(1, "Time limit must be at least 1 minute").optional()
      ),
      passingScore: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : Number(val),
        z.number().int().min(0).max(100, "Passing score must be between 0 and 100").optional()
      ),
      startTime: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : new Date(val),
        z.date().optional()
      ),
      endTime: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : new Date(val),
        z.date().optional()
      ),
      instructions: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : val,
        z.string().optional()
      ),
      gradingScale: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? "standard" : val,
        z.string().default("standard")
      ),
      teacherInChargeId: z.preprocess(
        (val) => val === "" || val === null || val === void 0 ? void 0 : val,
        z.string().optional()
      ),
      isPublished: z.boolean().default(false),
      allowRetakes: z.boolean().default(false),
      shuffleQuestions: z.boolean().default(false),
      autoGradingEnabled: z.boolean().default(true),
      instantFeedback: z.boolean().default(false),
      showCorrectAnswers: z.boolean().default(false)
    });
    insertExamResultSchema = createInsertSchema(examResults2).omit({ id: true, createdAt: true });
    insertExamSubmissionsArchiveSchema = createInsertSchema(examSubmissionsArchive2).omit({ id: true, archivedAt: true });
    insertAnnouncementSchema = createInsertSchema(announcements2).omit({ id: true, createdAt: true });
    insertMessageSchema = createInsertSchema(messages2).omit({ id: true, createdAt: true });
    insertGalleryCategorySchema = createInsertSchema(galleryCategories2).omit({ id: true, createdAt: true });
    insertGallerySchema = createInsertSchema(gallery2).omit({ id: true, createdAt: true });
    insertHomePageContentSchema = createInsertSchema(homePageContent2).omit({ id: true, createdAt: true, updatedAt: true });
    insertContactMessageSchema = createInsertSchema(contactMessages2).omit({ id: true, createdAt: true });
    insertReportCommentTemplateSchema = createInsertSchema(reportCommentTemplates2).omit({ id: true, createdAt: true, updatedAt: true });
    insertReportCardSchema = createInsertSchema(reportCards2).omit({ id: true, createdAt: true });
    insertReportCardSkillsSchema = createInsertSchema(reportCardSkills2).omit({ id: true, createdAt: true, updatedAt: true });
    insertReportCardItemSchema = createInsertSchema(reportCardItems2).omit({ id: true, createdAt: true });
    insertStudyResourceSchema = createInsertSchema(studyResources2).omit({ id: true, createdAt: true, downloads: true });
    insertPerformanceEventSchema = createInsertSchema(performanceEvents2).omit({ id: true, createdAt: true });
    insertTeacherClassAssignmentSchema = createInsertSchema(teacherClassAssignments2).omit({ id: true, createdAt: true, updatedAt: true });
    insertTeacherAssignmentHistorySchema = createInsertSchema(teacherAssignmentHistory2).omit({ id: true, createdAt: true });
    insertGradingBoundarySchema = createInsertSchema(gradingBoundaries2).omit({ id: true, createdAt: true, updatedAt: true });
    insertContinuousAssessmentSchema = createInsertSchema(continuousAssessment2).omit({ id: true, createdAt: true, updatedAt: true });
    insertUnauthorizedAccessLogSchema = createInsertSchema(unauthorizedAccessLogs2).omit({ id: true, createdAt: true });
    insertTimetableSchema = createInsertSchema(timetable2).omit({ id: true, createdAt: true });
    insertGradingTaskSchema = createInsertSchema(gradingTasks2).omit({ id: true, createdAt: true });
    insertAuditLogSchema = createInsertSchema(auditLogs2).omit({ id: true, createdAt: true });
    insertSettingSchema = createInsertSchema(settings2).omit({ id: true, createdAt: true, updatedAt: true });
    insertCounterSchema = createInsertSchema(counters2).omit({ id: true, createdAt: true, updatedAt: true });
    createStudentWithAutoCredsSchema = z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      phone: z.string().optional(),
      address: z.string().optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
      gender: z.enum(["Male", "Female", "Other"], { required_error: "Gender is required" }),
      profileImageUrl: z.string().optional(),
      admissionNumber: z.string().min(1, "Admission number is required"),
      classId: z.coerce.number().positive("Please select a valid class"),
      parentId: z.string().optional().nullable(),
      admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format"),
      emergencyContact: z.string().min(1, "Emergency contact is required"),
      medicalInfo: z.string().optional(),
      parentEmail: z.string().email("Invalid parent email").optional(),
      parentPhone: z.string().optional()
    });
    createStudentSchema = z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      phone: z.string().optional(),
      address: z.string().optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
      gender: z.enum(["Male", "Female", "Other"], { required_error: "Gender is required" }),
      profileImageUrl: z.string().optional(),
      classId: z.coerce.number().positive("Please select a valid class"),
      parentId: z.string().optional().nullable(),
      parentPhone: z.string().optional(),
      admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format"),
      emergencyContact: z.string().optional(),
      medicalInfo: z.string().optional(),
      guardianName: z.string().optional(),
      department: z.enum(["science", "art", "commercial"]).optional().nullable()
    });
    quickCreateStudentSchema = z.object({
      fullName: z.string().min(2, "Full name is required").refine(
        (name) => name.trim().split(/\s+/).length >= 2,
        "Please enter both first and last name (e.g., 'John Adebayo')"
      ),
      gender: z.enum(["Male", "Female", "Other"], { required_error: "Gender is required" }),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
      classId: z.coerce.number().positive("Please select a valid class"),
      department: z.enum(["science", "art", "commercial"]).optional().nullable()
    });
    csvStudentSchema = z.object({
      fullName: z.string().min(1, "Full name is required"),
      class: z.string().min(1, "Class is required"),
      gender: z.enum(["Male", "Female", "Other"], { required_error: "Gender is required" }),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
      parentEmail: z.string().email("Invalid parent email").optional(),
      parentPhone: z.string().optional(),
      emergencyContact: z.string().min(1, "Emergency contact is required"),
      admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Admission date must be in YYYY-MM-DD format").optional(),
      medicalInfo: z.string().optional(),
      guardianName: z.string().optional()
    });
    insertExamQuestionSchema = createInsertSchema(examQuestions2).omit({ id: true, createdAt: true }).extend({
      examId: z.coerce.number().positive("Please select a valid exam"),
      questionText: z.string().min(1, "Question text is required"),
      questionType: z.enum(["multiple_choice", "text", "essay", "true_false", "fill_blank"], { required_error: "Question type is required" }),
      points: z.preprocess((val) => val === "" ? 1 : val, z.coerce.number().int().min(0, "Points must be a non-negative number").default(1)),
      orderNumber: z.coerce.number().int().min(1, "Order number must be a positive number"),
      imageUrl: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional()),
      expectedAnswers: z.preprocess((val) => {
        if (val === "" || val === null || val === void 0) return void 0;
        if (Array.isArray(val)) return val;
        if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter((s) => s !== "");
        return void 0;
      }, z.array(z.string()).optional()),
      explanationText: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional()),
      hintText: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional()),
      partialCreditRules: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional())
    });
    insertQuestionOptionSchema = createInsertSchema(questionOptions2).omit({ id: true, createdAt: true }).extend({
      questionId: z.coerce.number().positive("Please select a valid question"),
      orderNumber: z.coerce.number().int().min(1, "Order number must be a positive number"),
      partialCreditValue: z.preprocess((val) => val === "" ? 0 : val, z.coerce.number().int().min(0, "Partial credit must be non-negative").default(0)),
      explanationText: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional())
    });
    createQuestionOptionSchema = insertQuestionOptionSchema.omit({ questionId: true, orderNumber: true }).extend({
      partialCreditValue: z.preprocess((val) => val === "" ? 0 : val, z.coerce.number().int().min(0, "Partial credit must be non-negative").default(0)).optional(),
      explanationText: z.preprocess((val) => val === "" ? void 0 : val, z.string().optional())
    });
    insertExamSessionSchema = createInsertSchema(examSessions2).omit({
      id: true,
      createdAt: true,
      startedAt: true,
      studentId: true
    }).partial().required({
      examId: true
    }).extend({
      submittedAt: z.union([z.date(), z.string()]).optional().transform((val) => {
        if (typeof val === "string") {
          return new Date(val);
        }
        return val;
      })
    });
    updateExamSessionSchema = z.object({
      isCompleted: z.boolean().optional(),
      submittedAt: z.coerce.date().refine((d) => !isNaN(d.getTime()), "Invalid date").optional(),
      timeRemaining: z.number().int().min(0).optional(),
      status: z.enum(["in_progress", "submitted"]).optional(),
      submissionMethod: z.string().optional(),
      autoSubmitted: z.boolean().optional()
    }).strict();
    insertStudentAnswerSchema = createInsertSchema(studentAnswers2).omit({ id: true });
    insertNotificationSchema = createInsertSchema(notifications2).omit({ id: true, createdAt: true });
    insertTeacherProfileSchema = createInsertSchema(teacherProfiles2).omit({ id: true, createdAt: true, updatedAt: true });
    insertAdminProfileSchema = createInsertSchema(adminProfiles2).omit({ id: true, createdAt: true, updatedAt: true });
    insertParentProfileSchema = createInsertSchema(parentProfiles2).omit({ id: true, createdAt: true, updatedAt: true });
    insertStudentSubjectAssignmentSchema = createInsertSchema(studentSubjectAssignments2).omit({ id: true, createdAt: true });
    insertClassSubjectMappingSchema = createInsertSchema(classSubjectMappings2).omit({ id: true, createdAt: true });
    insertVacancySchema = createInsertSchema(vacancies2).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertTeacherApplicationSchema = createInsertSchema(teacherApplications2).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      dateApplied: true,
      reviewedAt: true,
      reviewedBy: true,
      status: true
    });
    insertApprovedTeacherSchema = createInsertSchema(approvedTeachers2).omit({
      id: true,
      createdAt: true,
      dateApproved: true
    });
    insertSuperAdminProfileSchema = createInsertSchema(superAdminProfiles2).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertSystemSettingsSchema = createInsertSchema(systemSettings2).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertQuestionBankSchema = createInsertSchema(questionBanks2).omit({ id: true, createdAt: true, updatedAt: true });
    insertQuestionBankItemSchema = createInsertSchema(questionBankItems2).omit({ id: true, createdAt: true, updatedAt: true });
    insertQuestionBankOptionSchema = createInsertSchema(questionBankOptions2).omit({ id: true, createdAt: true });
  }
});

// server/db.ts
import { drizzle as drizzlePg } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool, neonConfig, neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import ws from "ws";
function initializeDatabase() {
  if (dbInstance) return dbInstance;
  if (databaseUrl) {
    pool = new Pool({ connectionString: databaseUrl });
    dbInstance = drizzlePg(pool, { schema: schema_pg_exports });
    neonClient = neon(databaseUrl);
  } else {
    const sqliteDb = new Database("sqlite.db");
    dbInstance = drizzleSqlite(sqliteDb, { schema: schema_exports });
  }
  return dbInstance;
}
function getDatabase() {
  return db;
}
function getSchema() {
  return isPostgres ? schema_pg_exports : schema_exports;
}
function getPgClient() {
  return neonClient;
}
function getPgPool() {
  return pool;
}
var databaseUrl, isPostgres, dbInstance, pool, neonClient, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema_pg();
    init_schema();
    neonConfig.webSocketConstructor = ws;
    databaseUrl = process.env.DATABASE_URL;
    isPostgres = !!databaseUrl;
    dbInstance = null;
    pool = null;
    neonClient = null;
    db = initializeDatabase();
  }
});

// shared/grading-utils.ts
function getGradingConfig(scaleName = "standard") {
  return GRADING_SCALES[scaleName] || STANDARD_GRADING_SCALE;
}
function calculateGradeFromPercentage(percentage, scaleName = "standard") {
  const config = getGradingConfig(scaleName);
  const normalizedPercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  for (const range of config.ranges) {
    if (normalizedPercentage >= range.min && normalizedPercentage <= range.max) {
      return range;
    }
  }
  return config.ranges[config.ranges.length - 1];
}
function calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config = STANDARD_GRADING_SCALE) {
  let testWeighted = 0;
  let examWeighted = 0;
  let totalWeight = 0;
  if (testScore !== null && testMaxScore !== null && testMaxScore > 0) {
    const testPercentage = testScore / testMaxScore * 100;
    testWeighted = testPercentage / 100 * config.testWeight;
    totalWeight += config.testWeight;
  }
  if (examScore !== null && examMaxScore !== null && examMaxScore > 0) {
    const examPercentage = examScore / examMaxScore * 100;
    examWeighted = examPercentage / 100 * config.examWeight;
    totalWeight += config.examWeight;
  }
  const weightedScore = testWeighted + examWeighted;
  const percentage = totalWeight > 0 ? weightedScore / totalWeight * 100 : 0;
  const gradeInfo = calculateGradeFromPercentage(percentage, config.name);
  return {
    weightedScore: Math.round(weightedScore * 10) / 10,
    percentage: Math.round(percentage * 10) / 10,
    testWeighted: Math.round(testWeighted * 10) / 10,
    examWeighted: Math.round(examWeighted * 10) / 10,
    grade: gradeInfo.grade,
    gradeInfo
  };
}
var STANDARD_GRADING_SCALE, GRADING_SCALES;
var init_grading_utils = __esm({
  "shared/grading-utils.ts"() {
    "use strict";
    STANDARD_GRADING_SCALE = {
      name: "standard",
      scoreAggregationMode: "last",
      testWeight: 40,
      examWeight: 60,
      ranges: [
        { min: 90, max: 100, grade: "A+", points: 4, remarks: "Excellent" },
        { min: 80, max: 89, grade: "A", points: 3.7, remarks: "Very Good" },
        { min: 70, max: 79, grade: "B+", points: 3.3, remarks: "Good" },
        { min: 60, max: 69, grade: "B", points: 3, remarks: "Satisfactory" },
        { min: 50, max: 59, grade: "C", points: 2, remarks: "Pass" },
        { min: 40, max: 49, grade: "D", points: 1, remarks: "Below Average" },
        { min: 0, max: 39, grade: "F", points: 0, remarks: "Fail" }
      ]
    };
    GRADING_SCALES = {
      standard: STANDARD_GRADING_SCALE,
      waec: {
        name: "waec",
        scoreAggregationMode: "last",
        testWeight: 40,
        examWeight: 60,
        ranges: [
          { min: 75, max: 100, grade: "A1", points: 1, remarks: "Excellent" },
          { min: 70, max: 74, grade: "B2", points: 2, remarks: "Very Good" },
          { min: 65, max: 69, grade: "B3", points: 3, remarks: "Good" },
          { min: 60, max: 64, grade: "C4", points: 4, remarks: "Credit" },
          { min: 55, max: 59, grade: "C5", points: 5, remarks: "Credit" },
          { min: 50, max: 54, grade: "C6", points: 6, remarks: "Credit" },
          { min: 45, max: 49, grade: "D7", points: 7, remarks: "Pass" },
          { min: 40, max: 44, grade: "E8", points: 8, remarks: "Pass" },
          { min: 0, max: 39, grade: "F9", points: 9, remarks: "Fail" }
        ]
      },
      percentage: {
        name: "percentage",
        scoreAggregationMode: "last",
        testWeight: 40,
        examWeight: 60,
        ranges: [
          { min: 90, max: 100, grade: "90-100%", points: 4, remarks: "Outstanding" },
          { min: 80, max: 89, grade: "80-89%", points: 3.5, remarks: "Excellent" },
          { min: 70, max: 79, grade: "70-79%", points: 3, remarks: "Very Good" },
          { min: 60, max: 69, grade: "60-69%", points: 2.5, remarks: "Good" },
          { min: 50, max: 59, grade: "50-59%", points: 2, remarks: "Fair" },
          { min: 40, max: 49, grade: "40-49%", points: 1.5, remarks: "Pass" },
          { min: 0, max: 39, grade: "0-39%", points: 0, remarks: "Fail" }
        ]
      }
    };
  }
});

// server/grading-config.ts
function getOverallGrade(averagePercentage, scaleName = "standard") {
  const gradeInfo = calculateGradeFromPercentage(averagePercentage, scaleName);
  return gradeInfo.grade;
}
var init_grading_config = __esm({
  "server/grading-config.ts"() {
    "use strict";
    init_grading_utils();
    init_grading_utils();
  }
});

// server/cloudinary-service.ts
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
function initializeStorage() {
  if (storageInitialized) return;
  console.log("");
  console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502            FILE STORAGE CONFIGURATION                \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  if (isProduction) {
    if (hasCloudinaryConfig) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      console.log("\u2502  Environment: PRODUCTION                            \u2502");
      console.log("\u2502  Storage: CLOUDINARY CDN                            \u2502");
      console.log(`\u2502  Cloud Name: ${(process.env.CLOUDINARY_CLOUD_NAME || "").padEnd(36)}\u2502`);
      console.log("\u2502  Status: \u2705 CONNECTED                               \u2502");
    } else {
      console.log("\u2502  Environment: PRODUCTION                            \u2502");
      console.log("\u2502  Storage: LOCAL (\u26A0\uFE0F Cloudinary not configured)      \u2502");
      console.log("\u2502  Warning: Files will not persist on restart!        \u2502");
      console.log("\u2502  Status: \u26A0\uFE0F FALLBACK MODE                           \u2502");
    }
  } else {
    console.log("\u2502  Environment: DEVELOPMENT                           \u2502");
    console.log("\u2502  Storage: LOCAL FILESYSTEM                          \u2502");
    console.log("\u2502  Location: ./server/uploads/                        \u2502");
    console.log("\u2502  Status: \u2705 READY                                    \u2502");
    if (hasCloudinaryConfig) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      console.log("\u2502  Note: Cloudinary available (set NODE_ENV=production\u2502");
      console.log("\u2502        to use Cloudinary in production)             \u2502");
    }
  }
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  console.log("");
  storageInitialized = true;
}
async function deleteFile(publicIdOrUrl) {
  if (!useCloudinary) {
    try {
      const localPath = publicIdOrUrl.startsWith("/uploads/") ? `server${publicIdOrUrl}` : publicIdOrUrl.startsWith("/") ? `server${publicIdOrUrl}` : publicIdOrUrl;
      await fs.unlink(localPath);
      return true;
    } catch (error) {
      console.error("Local file deletion error:", error);
      return false;
    }
  }
  try {
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.includes("cloudinary.com")) {
      const match = publicIdOrUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (match) {
        publicId = match[1];
      }
    }
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    return false;
  }
}
var isProduction, hasCloudinaryConfig, useCloudinary, storageInitialized, imageTypes, documentTypes, allowedTypes, MAX_IMAGE_SIZE, MAX_DOCUMENT_SIZE;
var init_cloudinary_service = __esm({
  "server/cloudinary-service.ts"() {
    "use strict";
    isProduction = process.env.NODE_ENV === "production";
    hasCloudinaryConfig = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    useCloudinary = isProduction && hasCloudinaryConfig;
    storageInitialized = false;
    initializeStorage();
    imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    documentTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    allowedTypes = [...imageTypes, ...documentTypes];
    MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
  }
});

// server/services/deletion-service.ts
import { v2 as cloudinary2 } from "cloudinary";
import fs2 from "fs/promises";
function formatDeletionLog(result, userId, userRole) {
  const lines = [
    `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
    `         USER DELETION AUDIT LOG                         `,
    `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
    `User ID: ${userId}`,
    `Role: ${userRole}`,
    `Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `Duration: ${result.duration}ms`,
    `Status: ${result.success ? "SUCCESS" : "COMPLETED WITH ERRORS"}`,
    ``,
    `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 DELETED RECORDS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`
  ];
  if (result.deletedRecords.length > 0) {
    for (const record of result.deletedRecords) {
      lines.push(`  ${record.tableName}: ${record.count} records`);
    }
  } else {
    lines.push(`  No records deleted`);
  }
  lines.push(``);
  lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 DELETED FILES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  if (result.deletedFiles.length > 0) {
    const successful = result.deletedFiles.filter((f) => f.success);
    const failed = result.deletedFiles.filter((f) => !f.success);
    lines.push(`  Successful: ${successful.length}`);
    lines.push(`  Failed: ${failed.length}`);
    if (failed.length > 0) {
      lines.push(`  Failed files:`);
      for (const file of failed) {
        lines.push(`    - ${file.url}: ${file.error || "Unknown error"}`);
      }
    }
  } else {
    lines.push(`  No files to delete`);
  }
  if (result.errors.length > 0) {
    lines.push(``);
    lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ERRORS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }
  lines.push(``);
  lines.push(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  lines.push(result.summary);
  lines.push(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
  return lines.join("\n");
}
var DeletionService, deletionService;
var init_deletion_service = __esm({
  "server/services/deletion-service.ts"() {
    "use strict";
    init_cloudinary_service();
    DeletionService = class {
      constructor() {
        this.deletedRecords = [];
        this.deletedFiles = [];
        this.errors = [];
        this.startTime = 0;
      }
      reset() {
        this.deletedRecords = [];
        this.deletedFiles = [];
        this.errors = [];
        this.startTime = Date.now();
      }
      recordDeletion(tableName, count) {
        const existing = this.deletedRecords.find((r) => r.tableName === tableName);
        if (existing) {
          existing.count += count;
        } else {
          this.deletedRecords.push({ tableName, count });
        }
      }
      recordError(error) {
        this.errors.push(error);
        console.error(`[DeletionService] ${error}`);
      }
      async deleteFileFromStorage(url) {
        if (!url) return true;
        try {
          const success = await deleteFile(url);
          this.deletedFiles.push({ url, success });
          return success;
        } catch (error) {
          this.deletedFiles.push({
            url,
            success: false,
            error: error.message || "Unknown error"
          });
          this.recordError(`Failed to delete file ${url}: ${error.message}`);
          return false;
        }
      }
      async deleteFilesInBatch(urls) {
        const validUrls = urls.filter((url) => !!url);
        if (validUrls.length === 0) return 0;
        let successCount = 0;
        if (useCloudinary) {
          const cloudinaryUrls = [];
          const localUrls = [];
          for (const url of validUrls) {
            if (url.includes("cloudinary.com")) {
              cloudinaryUrls.push(url);
            } else {
              localUrls.push(url);
            }
          }
          if (cloudinaryUrls.length > 0) {
            const publicIds = cloudinaryUrls.map((url) => {
              const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
              return match ? match[1] : url;
            }).filter(Boolean);
            try {
              const batchSize = 100;
              for (let i = 0; i < publicIds.length; i += batchSize) {
                const batch = publicIds.slice(i, i + batchSize);
                try {
                  const result = await cloudinary2.api.delete_resources(batch);
                  const batchSuccess = Object.values(result.deleted || {}).filter((v) => v === "deleted").length;
                  successCount += batchSuccess;
                  batch.forEach((id, index3) => {
                    const url = cloudinaryUrls[i + index3];
                    const deleted = result.deleted?.[id] === "deleted";
                    this.deletedFiles.push({ url, success: deleted });
                  });
                } catch (batchError) {
                  this.recordError(`Cloudinary batch delete error: ${batchError.message}`);
                  for (const id of batch) {
                    try {
                      const singleResult = await cloudinary2.uploader.destroy(id);
                      if (singleResult.result === "ok") successCount++;
                      this.deletedFiles.push({
                        url: id,
                        success: singleResult.result === "ok"
                      });
                    } catch (singleError) {
                      this.deletedFiles.push({
                        url: id,
                        success: false,
                        error: singleError.message
                      });
                    }
                  }
                }
              }
            } catch (error) {
              this.recordError(`Cloudinary batch deletion failed: ${error.message}`);
            }
          }
          for (const url of localUrls) {
            const success = await this.deleteLocalFile(url);
            if (success) successCount++;
          }
        } else {
          for (const url of validUrls) {
            const success = await this.deleteLocalFile(url);
            if (success) successCount++;
          }
        }
        return successCount;
      }
      async deleteLocalFile(url) {
        try {
          const localPath = url.startsWith("/") ? url.substring(1) : url;
          await fs2.unlink(localPath);
          this.deletedFiles.push({ url, success: true });
          return true;
        } catch (error) {
          if (error.code !== "ENOENT") {
            this.deletedFiles.push({ url, success: false, error: error.message });
          }
          return false;
        }
      }
      getResult() {
        const duration = Date.now() - this.startTime;
        const totalRecords = this.deletedRecords.reduce((sum, r) => sum + r.count, 0);
        const successfulFiles = this.deletedFiles.filter((f) => f.success).length;
        return {
          success: this.errors.length === 0,
          deletedRecords: this.deletedRecords,
          deletedFiles: this.deletedFiles,
          errors: this.errors,
          duration,
          summary: `Deleted ${totalRecords} records from ${this.deletedRecords.length} tables, ${successfulFiles}/${this.deletedFiles.length} files removed in ${duration}ms`
        };
      }
    };
    deletionService = new DeletionService();
  }
});

// server/services/smart-deletion-manager.ts
import { eq, inArray, or, and, sql as dsql } from "drizzle-orm";
import { v2 as cloudinary3 } from "cloudinary";
async function cleanupOrphanRecords() {
  const results = [];
  console.log("[OrphanCleanup] Starting database orphan cleanup...");
  try {
    const orphanSessions = await db.delete(examSessions).where(dsql`${examSessions.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanSessions.length > 0) {
      results.push({ tableName: "exam_sessions", deletedCount: orphanSessions.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] exam_sessions:", e.message);
  }
  try {
    const orphanResults = await db.delete(examResults).where(dsql`${examResults.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanResults.length > 0) {
      results.push({ tableName: "exam_results", deletedCount: orphanResults.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] exam_results:", e.message);
  }
  try {
    const orphanAttendance = await db.delete(attendance).where(dsql`${attendance.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanAttendance.length > 0) {
      results.push({ tableName: "attendance", deletedCount: orphanAttendance.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] attendance:", e.message);
  }
  try {
    const orphanCA = await db.delete(continuousAssessment).where(dsql`${continuousAssessment.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanCA.length > 0) {
      results.push({ tableName: "continuous_assessment", deletedCount: orphanCA.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] continuous_assessment:", e.message);
  }
  try {
    const orphanReportCards = await db.delete(reportCards).where(dsql`${reportCards.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanReportCards.length > 0) {
      results.push({ tableName: "report_cards", deletedCount: orphanReportCards.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] report_cards:", e.message);
  }
  try {
    const orphanSubjectAssignments = await db.delete(studentSubjectAssignments).where(dsql`${studentSubjectAssignments.studentId} NOT IN (SELECT id FROM students)`).returning();
    if (orphanSubjectAssignments.length > 0) {
      results.push({ tableName: "student_subject_assignments", deletedCount: orphanSubjectAssignments.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] student_subject_assignments:", e.message);
  }
  try {
    const expiredTokens = await db.delete(passwordResetTokens).where(dsql`${passwordResetTokens.expiresAt} < NOW()`).returning();
    if (expiredTokens.length > 0) {
      results.push({ tableName: "password_reset_tokens", deletedCount: expiredTokens.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] password_reset_tokens:", e.message);
  }
  try {
    const expiredInvites = await db.delete(invites).where(and(
      dsql`${invites.expiresAt} < NOW()`,
      dsql`${invites.acceptedAt} IS NULL`
    )).returning();
    if (expiredInvites.length > 0) {
      results.push({ tableName: "invites", deletedCount: expiredInvites.length });
    }
  } catch (e) {
    console.log("[OrphanCleanup] invites:", e.message);
  }
  console.log("[OrphanCleanup] Cleanup complete:", results);
  return results;
}
async function bulkDeleteUsers(userIds, performedBy) {
  const successful = [];
  const failed = [];
  const manager = new SmartDeletionManager();
  for (const userId of userIds) {
    try {
      const result = await manager.deleteUser(userId, performedBy);
      if (result.success) {
        successful.push(userId);
      } else {
        failed.push({ userId, error: result.errors.join(", ") || "Unknown error" });
      }
    } catch (error) {
      failed.push({ userId, error: error.message });
    }
  }
  return { successful, failed };
}
var SmartDeletionManager, smartDeletionManager;
var init_smart_deletion_manager = __esm({
  "server/services/smart-deletion-manager.ts"() {
    "use strict";
    init_schema_pg();
    init_db();
    init_deletion_service();
    init_cloudinary_service();
    SmartDeletionManager = class {
      constructor() {
        this.filesToDelete = [];
        this.deletionService = new DeletionService();
      }
      getRoleFromId(roleId) {
        switch (roleId) {
          case 1:
            return "Super Admin";
          case 2:
            return "Admin";
          case 3:
            return "Teacher";
          case 4:
            return "Student";
          case 5:
            return "Parent";
          default:
            return "Unknown";
        }
      }
      addFileToDelete(url) {
        if (url && typeof url === "string" && url.trim().length > 0) {
          this.filesToDelete.push(url);
        }
      }
      async validateDeletion(userId) {
        try {
          const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (!user[0]) {
            return { canDelete: false, reason: "User not found" };
          }
          const blockedBy = [];
          const affectedRecords = [];
          const filesToDelete = [];
          if (user[0].profileImageUrl) {
            filesToDelete.push(user[0].profileImageUrl);
          }
          const roleId = user[0].roleId;
          const role = this.getRoleFromId(roleId);
          if (role === "Student") {
            const activeExamSessions = await db.select({ id: examSessions.id }).from(examSessions).innerJoin(exams, eq(examSessions.examId, exams.id)).where(and(
              eq(examSessions.studentId, userId),
              eq(examSessions.status, "in_progress")
            ));
            if (activeExamSessions.length > 0) {
              blockedBy.push({
                type: "active_exam_session",
                description: "Student has active exam sessions in progress",
                count: activeExamSessions.length
              });
            }
            const draftReportCards = await db.select({ id: reportCards.id }).from(reportCards).where(and(
              eq(reportCards.studentId, userId),
              eq(reportCards.status, "draft")
            ));
            if (draftReportCards.length > 0) {
              affectedRecords.push({ tableName: "draft_report_cards", count: draftReportCards.length });
            }
            const examSessions3 = await db.select({ id: examSessions.id }).from(examSessions).where(eq(examSessions.studentId, userId));
            if (examSessions3.length > 0) {
              affectedRecords.push({ tableName: "exam_sessions", count: examSessions3.length });
            }
            const examResults3 = await db.select({ id: examResults.id }).from(examResults).where(eq(examResults.studentId, userId));
            if (examResults3.length > 0) {
              affectedRecords.push({ tableName: "exam_results", count: examResults3.length });
            }
            const attendance3 = await db.select({ id: attendance.id }).from(attendance).where(eq(attendance.studentId, userId));
            if (attendance3.length > 0) {
              affectedRecords.push({ tableName: "attendance", count: attendance3.length });
            }
            const reportCards3 = await db.select({ id: reportCards.id }).from(reportCards).where(eq(reportCards.studentId, userId));
            if (reportCards3.length > 0) {
              affectedRecords.push({ tableName: "report_cards", count: reportCards3.length });
            }
            const continuousAssessment3 = await db.select({ id: continuousAssessment.id }).from(continuousAssessment).where(eq(continuousAssessment.studentId, userId));
            if (continuousAssessment3.length > 0) {
              affectedRecords.push({ tableName: "continuous_assessment", count: continuousAssessment3.length });
            }
            const studentSubjectAssignments3 = await db.select({ id: studentSubjectAssignments.id }).from(studentSubjectAssignments).where(eq(studentSubjectAssignments.studentId, userId));
            if (studentSubjectAssignments3.length > 0) {
              affectedRecords.push({ tableName: "student_subject_assignments", count: studentSubjectAssignments3.length });
            }
          }
          if (role === "Teacher") {
            const activeExams = await db.select({ id: exams.id }).from(exams).where(and(
              eq(exams.createdBy, userId),
              eq(exams.isPublished, true)
            ));
            if (activeExams.length > 0) {
              blockedBy.push({
                type: "active_exams",
                description: "Teacher has active exams that need to be completed first",
                count: activeExams.length
              });
            }
            const teacherProfile = await db.select({ signatureUrl: teacherProfiles.signatureUrl }).from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).limit(1);
            if (teacherProfile[0]?.signatureUrl) {
              filesToDelete.push(teacherProfile[0].signatureUrl);
            }
            const exams3 = await db.select({ id: exams.id }).from(exams).where(eq(exams.createdBy, userId));
            if (exams3.length > 0) {
              affectedRecords.push({ tableName: "exams", count: exams3.length });
            }
            const questionBanks3 = await db.select({ id: questionBanks.id }).from(questionBanks).where(eq(questionBanks.createdBy, userId));
            if (questionBanks3.length > 0) {
              affectedRecords.push({ tableName: "question_banks", count: questionBanks3.length });
            }
            const teacherClassAssignments3 = await db.select({ id: teacherClassAssignments.id }).from(teacherClassAssignments).where(eq(teacherClassAssignments.teacherId, userId));
            if (teacherClassAssignments3.length > 0) {
              affectedRecords.push({ tableName: "teacher_class_assignments", count: teacherClassAssignments3.length });
            }
            const timetable3 = await db.select({ id: timetable.id }).from(timetable).where(eq(timetable.teacherId, userId));
            if (timetable3.length > 0) {
              affectedRecords.push({ tableName: "timetable", count: timetable3.length });
            }
          }
          if (role === "Parent") {
            const linkedStudents = await db.select({ id: students.id }).from(students).where(eq(students.parentId, userId));
            if (linkedStudents.length > 0) {
              affectedRecords.push({ tableName: "linked_students", count: linkedStudents.length });
            }
          }
          const messages3 = await db.select({ id: messages.id }).from(messages).where(or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          ));
          if (messages3.length > 0) {
            affectedRecords.push({ tableName: "messages", count: messages3.length });
          }
          const notifications3 = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.userId, userId));
          if (notifications3.length > 0) {
            affectedRecords.push({ tableName: "notifications", count: notifications3.length });
          }
          const announcements3 = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.authorId, userId));
          if (announcements3.length > 0) {
            affectedRecords.push({ tableName: "announcements", count: announcements3.length });
          }
          const canDelete = blockedBy.filter(
            (b) => b.type === "active_exam_session" || b.type === "active_exams"
          ).length === 0;
          return {
            canDelete,
            reason: !canDelete ? "User has active resources that must be completed first" : void 0,
            blockedBy: blockedBy.length > 0 ? blockedBy : void 0,
            affectedRecords,
            filesToDelete
          };
        } catch (error) {
          return { canDelete: false, reason: error.message };
        }
      }
      async deleteUser(userId, performedBy) {
        this.deletionService.reset();
        this.filesToDelete = [];
        try {
          const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (!user[0]) {
            return {
              success: false,
              userId,
              userRole: "Unknown",
              deletedRecords: [],
              deletedFiles: [],
              errors: ["User not found"],
              summary: "Deletion failed: User not found",
              duration: 0
            };
          }
          const startTime = Date.now();
          const userRole = this.getRoleFromId(user[0].roleId);
          const userEmail = user[0].email;
          const username = user[0].username || void 0;
          console.log(`
[SmartDeletion] Starting comprehensive deletion for ${userRole}: ${userEmail || username}`);
          console.log(`[SmartDeletion] User ID: ${userId}`);
          console.log(`[SmartDeletion] Performed by: ${performedBy || "system"}`);
          if (user[0].profileImageUrl) {
            this.addFileToDelete(user[0].profileImageUrl);
          }
          switch (userRole) {
            case "Student":
              await this.deleteStudentData(userId);
              break;
            case "Teacher":
              await this.deleteTeacherData(userId);
              break;
            case "Parent":
              await this.deleteParentData(userId);
              break;
            case "Admin":
              await this.deleteAdminData(userId);
              break;
            case "Super Admin":
              await this.deleteSuperAdminData(userId);
              break;
          }
          await this.deleteCommonUserData(userId);
          if (this.filesToDelete.length > 0) {
            console.log(`[SmartDeletion] Deleting ${this.filesToDelete.length} files from storage...`);
            await this.deleteFilesInBatch(this.filesToDelete);
          }
          const result = await db.delete(users).where(eq(users.id, userId)).returning();
          this.deletionService.recordDeletion("users", result.length);
          const deletionResult = this.deletionService.getResult();
          const logOutput = formatDeletionLog(deletionResult, userId, userRole);
          console.log(logOutput);
          try {
            await db.insert(auditLogs).values({
              userId: performedBy || userId,
              action: "user_permanently_deleted",
              entityType: "user",
              entityId: userId,
              oldValue: JSON.stringify({
                email: userEmail,
                username,
                role: userRole,
                firstName: user[0].firstName,
                lastName: user[0].lastName
              }),
              newValue: JSON.stringify(deletionResult),
              reason: `Permanent deletion of ${userRole} account: ${userEmail || username}`,
              ipAddress: "system",
              userAgent: "Smart Deletion Manager"
            });
          } catch (auditError) {
            console.log("[SmartDeletion] Could not create audit log for deleted user");
          }
          const duration = Date.now() - startTime;
          return {
            ...deletionResult,
            userId,
            userRole,
            userEmail,
            username,
            duration
          };
        } catch (error) {
          this.deletionService.recordError(`Fatal error in deleteUser: ${error.message}`);
          console.error("[SmartDeletion] Error:", error);
          return {
            success: false,
            userId,
            userRole: "Unknown",
            deletedRecords: this.deletionService.getResult().deletedRecords,
            deletedFiles: this.deletionService.getResult().deletedFiles,
            errors: [...this.deletionService.getResult().errors, error.message],
            summary: `Deletion failed: ${error.message}`,
            duration: 0
          };
        }
      }
      async deleteStudentData(userId) {
        console.log("[SmartDeletion] Deleting student-specific data...");
        try {
          const examSessions3 = await db.select({ id: examSessions.id }).from(examSessions).where(eq(examSessions.studentId, userId));
          const sessionIds = examSessions3.map((s) => s.id);
          if (sessionIds.length > 0) {
            try {
              const gradingResult = await db.delete(gradingTasks).where(inArray(gradingTasks.sessionId, sessionIds)).returning();
              this.deletionService.recordDeletion("grading_tasks", gradingResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting grading tasks: ${e.message}`);
            }
            try {
              const perfResult = await db.delete(performanceEvents).where(inArray(performanceEvents.sessionId, sessionIds)).returning();
              this.deletionService.recordDeletion("performance_events", perfResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting performance events: ${e.message}`);
            }
            try {
              const answersResult = await db.delete(studentAnswers).where(inArray(studentAnswers.sessionId, sessionIds)).returning();
              this.deletionService.recordDeletion("student_answers", answersResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting student answers: ${e.message}`);
            }
            try {
              const sessionsResult = await db.delete(examSessions).where(inArray(examSessions.id, sessionIds)).returning();
              this.deletionService.recordDeletion("exam_sessions", sessionsResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting exam sessions: ${e.message}`);
            }
          }
        } catch (e) {
          this.deletionService.recordError(`Error deleting exam sessions: ${e.message}`);
        }
        try {
          const examResultsResult = await db.delete(examResults).where(eq(examResults.studentId, userId)).returning();
          this.deletionService.recordDeletion("exam_results", examResultsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting exam results: ${e.message}`);
        }
        try {
          const attendanceResult = await db.delete(attendance).where(eq(attendance.studentId, userId)).returning();
          this.deletionService.recordDeletion("attendance", attendanceResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting attendance: ${e.message}`);
        }
        try {
          const caResult = await db.delete(continuousAssessment).where(eq(continuousAssessment.studentId, userId)).returning();
          this.deletionService.recordDeletion("continuous_assessment", caResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting continuous assessment: ${e.message}`);
        }
        try {
          const subjectAssignResult = await db.delete(studentSubjectAssignments).where(eq(studentSubjectAssignments.studentId, userId)).returning();
          this.deletionService.recordDeletion("student_subject_assignments", subjectAssignResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting student subject assignments: ${e.message}`);
        }
        try {
          const reportCards3 = await db.select({ id: reportCards.id }).from(reportCards).where(eq(reportCards.studentId, userId));
          const reportCardIds = reportCards3.map((r) => r.id);
          if (reportCardIds.length > 0) {
            try {
              const rcItemsResult = await db.delete(reportCardItems).where(inArray(reportCardItems.reportCardId, reportCardIds)).returning();
              this.deletionService.recordDeletion("report_card_items", rcItemsResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting report card items: ${e.message}`);
            }
            try {
              const reportCardsResult = await db.delete(reportCards).where(eq(reportCards.studentId, userId)).returning();
              this.deletionService.recordDeletion("report_cards", reportCardsResult.length);
            } catch (e) {
              this.deletionService.recordError(`Error deleting report cards: ${e.message}`);
            }
          }
        } catch (e) {
          this.deletionService.recordError(`Error deleting report cards: ${e.message}`);
        }
        try {
          const studentResult = await db.delete(students).where(eq(students.id, userId)).returning();
          this.deletionService.recordDeletion("students", studentResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting student record: ${e.message}`);
        }
      }
      async deleteTeacherData(userId) {
        console.log("[SmartDeletion] Deleting teacher-specific data...");
        try {
          const teacherProfile = await db.select({ signatureUrl: teacherProfiles.signatureUrl }).from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).limit(1);
          if (teacherProfile[0]?.signatureUrl) {
            this.addFileToDelete(teacherProfile[0].signatureUrl);
          }
        } catch (e) {
          this.deletionService.recordError(`Error getting teacher signature: ${e.message}`);
        }
        try {
          const exams3 = await db.select({ id: exams.id }).from(exams).where(eq(exams.createdBy, userId));
          for (const exam of exams3) {
            await this.deleteExamCompletely(exam.id);
          }
        } catch (e) {
          this.deletionService.recordError(`Error deleting teacher exams: ${e.message}`);
        }
        try {
          const questionBanks3 = await db.select({ id: questionBanks.id }).from(questionBanks).where(eq(questionBanks.createdBy, userId));
          for (const qb of questionBanks3) {
            await this.deleteQuestionBankCompletely(qb.id);
          }
        } catch (e) {
          this.deletionService.recordError(`Error deleting question banks: ${e.message}`);
        }
        try {
          const teacherAssignmentsResult = await db.delete(teacherClassAssignments).where(eq(teacherClassAssignments.teacherId, userId)).returning();
          this.deletionService.recordDeletion("teacher_class_assignments", teacherAssignmentsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting teacher assignments: ${e.message}`);
        }
        try {
          const historyResult = await db.delete(teacherAssignmentHistory).where(eq(teacherAssignmentHistory.teacherId, userId)).returning();
          this.deletionService.recordDeletion("teacher_assignment_history", historyResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting assignment history: ${e.message}`);
        }
        try {
          const timetableResult = await db.delete(timetable).where(eq(timetable.teacherId, userId)).returning();
          this.deletionService.recordDeletion("timetable", timetableResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting timetable: ${e.message}`);
        }
        try {
          const gradingResult = await db.delete(gradingTasks).where(eq(gradingTasks.teacherId, userId)).returning();
          this.deletionService.recordDeletion("grading_tasks", gradingResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting grading tasks: ${e.message}`);
        }
        try {
          await db.update(continuousAssessment).set({ teacherId: null }).where(eq(continuousAssessment.teacherId, userId));
        } catch (e) {
        }
        try {
          await db.update(continuousAssessment).set({ enteredBy: null }).where(eq(continuousAssessment.enteredBy, userId));
        } catch (e) {
        }
        try {
          await db.update(continuousAssessment).set({ verifiedBy: null }).where(eq(continuousAssessment.verifiedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(continuousAssessment).set({ lockedBy: null }).where(eq(continuousAssessment.lockedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCardItems).set({ teacherId: null }).where(eq(reportCardItems.teacherId, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCardItems).set({ testExamCreatedBy: null }).where(eq(reportCardItems.testExamCreatedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCardItems).set({ examExamCreatedBy: null }).where(eq(reportCardItems.examExamCreatedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCardItems).set({ overriddenBy: null }).where(eq(reportCardItems.overriddenBy, userId));
        } catch (e) {
        }
        try {
          await db.update(exams).set({ createdBy: null }).where(eq(exams.createdBy, userId));
        } catch (e) {
        }
        try {
          await db.update(exams).set({ teacherInChargeId: null }).where(eq(exams.teacherInChargeId, userId));
        } catch (e) {
        }
        try {
          await db.update(classes).set({ classTeacherId: null }).where(eq(classes.classTeacherId, userId));
        } catch (e) {
        }
        try {
          const teacherProfileResult = await db.delete(teacherProfiles).where(eq(teacherProfiles.userId, userId)).returning();
          this.deletionService.recordDeletion("teacher_profiles", teacherProfileResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting teacher profile: ${e.message}`);
        }
      }
      async deleteParentData(userId) {
        console.log("[SmartDeletion] Deleting parent-specific data...");
        try {
          await db.update(students).set({ parentId: null }).where(eq(students.parentId, userId));
        } catch (e) {
          this.deletionService.recordError(`Error unlinking parent from students: ${e.message}`);
        }
        try {
          const parentResult = await db.delete(parentProfiles).where(eq(parentProfiles.userId, userId)).returning();
          this.deletionService.recordDeletion("parent_profiles", parentResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting parent profile: ${e.message}`);
        }
      }
      async deleteAdminData(userId) {
        console.log("[SmartDeletion] Deleting admin-specific data...");
        try {
          const vacanciesResult = await db.delete(vacancies).where(eq(vacancies.createdBy, userId)).returning();
          this.deletionService.recordDeletion("vacancies", vacanciesResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting vacancies: ${e.message}`);
        }
        try {
          await db.update(teacherApplications).set({ reviewedBy: null }).where(eq(teacherApplications.reviewedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(approvedTeachers).set({ approvedBy: null }).where(eq(approvedTeachers.approvedBy, userId));
        } catch (e) {
        }
        try {
          const adminResult = await db.delete(adminProfiles).where(eq(adminProfiles.userId, userId)).returning();
          this.deletionService.recordDeletion("admin_profiles", adminResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting admin profile: ${e.message}`);
        }
      }
      async deleteSuperAdminData(userId) {
        console.log("[SmartDeletion] Deleting super admin-specific data...");
        await this.deleteAdminData(userId);
        try {
          const superAdminResult = await db.delete(superAdminProfiles).where(eq(superAdminProfiles.userId, userId)).returning();
          this.deletionService.recordDeletion("super_admin_profiles", superAdminResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting super admin profile: ${e.message}`);
        }
      }
      async deleteCommonUserData(userId) {
        console.log("[SmartDeletion] Deleting common user data...");
        try {
          const homePageContent3 = await db.select({ imageUrl: homePageContent.imageUrl }).from(homePageContent).where(eq(homePageContent.uploadedBy, userId));
          for (const content of homePageContent3) {
            this.addFileToDelete(content.imageUrl);
          }
          await db.update(homePageContent).set({ uploadedBy: null }).where(eq(homePageContent.uploadedBy, userId));
        } catch (e) {
          this.deletionService.recordError(`Error handling homepage content: ${e.message}`);
        }
        try {
          const galleryItems = await db.select({ imageUrl: gallery.imageUrl }).from(gallery).where(eq(gallery.uploadedBy, userId));
          for (const item of galleryItems) {
            this.addFileToDelete(item.imageUrl);
          }
          await db.update(gallery).set({ uploadedBy: null }).where(eq(gallery.uploadedBy, userId));
        } catch (e) {
          this.deletionService.recordError(`Error handling gallery: ${e.message}`);
        }
        try {
          const studyResources3 = await db.select({ fileUrl: studyResources.fileUrl }).from(studyResources).where(eq(studyResources.uploadedBy, userId));
          for (const resource of studyResources3) {
            this.addFileToDelete(resource.fileUrl);
          }
          await db.update(studyResources).set({ uploadedBy: null }).where(eq(studyResources.uploadedBy, userId));
        } catch (e) {
          this.deletionService.recordError(`Error handling study resources: ${e.message}`);
        }
        try {
          const tokensResult = await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)).returning();
          this.deletionService.recordDeletion("password_reset_tokens", tokensResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting password tokens: ${e.message}`);
        }
        try {
          const invitesAcceptedResult = await db.delete(invites).where(eq(invites.acceptedBy, userId)).returning();
          const invitesCreatedResult = await db.delete(invites).where(eq(invites.createdBy, userId)).returning();
          this.deletionService.recordDeletion("invites", invitesAcceptedResult.length + invitesCreatedResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting invites: ${e.message}`);
        }
        try {
          const notificationsResult = await db.delete(notifications).where(eq(notifications.userId, userId)).returning();
          this.deletionService.recordDeletion("notifications", notificationsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting notifications: ${e.message}`);
        }
        try {
          const messagesResult = await db.delete(messages).where(or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          )).returning();
          this.deletionService.recordDeletion("messages", messagesResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting messages: ${e.message}`);
        }
        try {
          const announcementsResult = await db.delete(announcements).where(eq(announcements.authorId, userId)).returning();
          this.deletionService.recordDeletion("announcements", announcementsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting announcements: ${e.message}`);
        }
        try {
          const perfEventsResult = await db.delete(performanceEvents).where(eq(performanceEvents.userId, userId)).returning();
          this.deletionService.recordDeletion("performance_events", perfEventsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting performance events: ${e.message}`);
        }
        try {
          const auditResult = await db.delete(auditLogs).where(eq(auditLogs.userId, userId)).returning();
          this.deletionService.recordDeletion("audit_logs", auditResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting audit logs: ${e.message}`);
        }
        try {
          const accessLogsResult = await db.delete(unauthorizedAccessLogs).where(eq(unauthorizedAccessLogs.userId, userId)).returning();
          this.deletionService.recordDeletion("unauthorized_access_logs", accessLogsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting access logs: ${e.message}`);
        }
        try {
          await db.update(contactMessages).set({ respondedBy: null }).where(eq(contactMessages.respondedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(systemSettings).set({ updatedBy: null }).where(eq(systemSettings.updatedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(settings).set({ updatedBy: null }).where(eq(settings.updatedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(attendance).set({ recordedBy: null }).where(eq(attendance.recordedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(questionBanks).set({ createdBy: null }).where(eq(questionBanks.createdBy, userId));
        } catch (e) {
        }
        try {
          await db.update(gradingBoundaries).set({ createdBy: null }).where(eq(gradingBoundaries.createdBy, userId));
        } catch (e) {
        }
        try {
          await db.update(teacherClassAssignments).set({ assignedBy: null }).where(eq(teacherClassAssignments.assignedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(teacherAssignmentHistory).set({ performedBy: null }).where(eq(teacherAssignmentHistory.performedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(studentSubjectAssignments).set({ assignedBy: null }).where(eq(studentSubjectAssignments.assignedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCards).set({ generatedBy: null }).where(eq(reportCards.generatedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(reportCards).set({ signedBy: null }).where(eq(reportCards.signedBy, userId));
        } catch (e) {
        }
        try {
          await db.update(teacherProfiles).set({ verifiedBy: null }).where(eq(teacherProfiles.verifiedBy, userId));
        } catch (e) {
        }
      }
      async deleteExamCompletely(examId) {
        try {
          const questions = await db.select({ id: examQuestions.id, imageUrl: examQuestions.imageUrl }).from(examQuestions).where(eq(examQuestions.examId, examId));
          const questionIds = questions.map((q) => q.id);
          for (const question of questions) {
            this.addFileToDelete(question.imageUrl);
          }
          if (questionIds.length > 0) {
            const sessions = await db.select({ id: examSessions.id }).from(examSessions).where(eq(examSessions.examId, examId));
            const sessionIds = sessions.map((s) => s.id);
            if (sessionIds.length > 0) {
              try {
                const gtResult = await db.delete(gradingTasks).where(inArray(gradingTasks.sessionId, sessionIds)).returning();
                this.deletionService.recordDeletion("grading_tasks", gtResult.length);
              } catch (e) {
              }
              try {
                const peResult = await db.delete(performanceEvents).where(inArray(performanceEvents.sessionId, sessionIds)).returning();
                this.deletionService.recordDeletion("performance_events", peResult.length);
              } catch (e) {
              }
              try {
                const saResult = await db.delete(studentAnswers).where(inArray(studentAnswers.sessionId, sessionIds)).returning();
                this.deletionService.recordDeletion("student_answers", saResult.length);
              } catch (e) {
              }
              try {
                const esResult = await db.delete(examSessions).where(inArray(examSessions.id, sessionIds)).returning();
                this.deletionService.recordDeletion("exam_sessions", esResult.length);
              } catch (e) {
              }
            }
            try {
              const qoResult = await db.delete(questionOptions).where(inArray(questionOptions.questionId, questionIds)).returning();
              this.deletionService.recordDeletion("question_options", qoResult.length);
            } catch (e) {
            }
            try {
              const eqResult = await db.delete(examQuestions).where(eq(examQuestions.examId, examId)).returning();
              this.deletionService.recordDeletion("exam_questions", eqResult.length);
            } catch (e) {
            }
          }
          try {
            const erResult = await db.delete(examResults).where(eq(examResults.examId, examId)).returning();
            this.deletionService.recordDeletion("exam_results", erResult.length);
          } catch (e) {
          }
          try {
            await db.update(reportCardItems).set({ testExamId: null }).where(eq(reportCardItems.testExamId, examId));
          } catch (e) {
          }
          try {
            await db.update(reportCardItems).set({ examExamId: null }).where(eq(reportCardItems.examExamId, examId));
          } catch (e) {
          }
          const result = await db.delete(exams).where(eq(exams.id, examId)).returning();
          this.deletionService.recordDeletion("exams", result.length);
        } catch (error) {
          this.deletionService.recordError(`Failed to delete exam ${examId}: ${error.message}`);
        }
      }
      async deleteQuestionBankCompletely(bankId) {
        try {
          const items = await db.select({
            id: questionBankItems.id,
            imageUrl: questionBankItems.imageUrl,
            practicalFileUrl: questionBankItems.practicalFileUrl
          }).from(questionBankItems).where(eq(questionBankItems.bankId, bankId));
          const itemIds = items.map((i) => i.id);
          for (const item of items) {
            this.addFileToDelete(item.imageUrl);
            this.addFileToDelete(item.practicalFileUrl);
          }
          if (itemIds.length > 0) {
            try {
              const qboResult = await db.delete(questionBankOptions).where(inArray(questionBankOptions.questionItemId, itemIds)).returning();
              this.deletionService.recordDeletion("question_bank_options", qboResult.length);
            } catch (e) {
            }
            try {
              const qbiResult = await db.delete(questionBankItems).where(eq(questionBankItems.bankId, bankId)).returning();
              this.deletionService.recordDeletion("question_bank_items", qbiResult.length);
            } catch (e) {
            }
          }
          const result = await db.delete(questionBanks).where(eq(questionBanks.id, bankId)).returning();
          this.deletionService.recordDeletion("question_banks", result.length);
        } catch (error) {
          this.deletionService.recordError(`Failed to delete question bank ${bankId}: ${error.message}`);
        }
      }
      async deleteFilesInBatch(urls) {
        const validUrls = urls.filter((url) => url && url.trim().length > 0);
        if (validUrls.length === 0) return 0;
        let successCount = 0;
        if (useCloudinary) {
          const cloudinaryUrls = [];
          const localUrls = [];
          for (const url of validUrls) {
            if (url.includes("cloudinary.com")) {
              cloudinaryUrls.push(url);
            } else {
              localUrls.push(url);
            }
          }
          if (cloudinaryUrls.length > 0) {
            const publicIds = cloudinaryUrls.map((url) => {
              const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
              return match ? match[1] : url;
            }).filter(Boolean);
            try {
              const batchSize = 100;
              for (let i = 0; i < publicIds.length; i += batchSize) {
                const batch = publicIds.slice(i, i + batchSize);
                try {
                  const result = await cloudinary3.api.delete_resources(batch);
                  const batchSuccess = Object.values(result.deleted || {}).filter((v) => v === "deleted").length;
                  successCount += batchSuccess;
                  this.deletionService.recordDeletion("cloudinary_files", batchSuccess);
                  console.log(`[SmartDeletion] Cloudinary batch: ${batchSuccess}/${batch.length} files deleted`);
                } catch (batchError) {
                  console.error(`[SmartDeletion] Cloudinary batch error:`, batchError.message);
                  this.deletionService.recordError(`Cloudinary batch error: ${batchError.message}`);
                  for (const id of batch) {
                    try {
                      const singleResult = await cloudinary3.uploader.destroy(id);
                      if (singleResult.result === "ok") {
                        successCount++;
                        this.deletionService.recordDeletion("cloudinary_files", 1);
                      }
                    } catch (singleError) {
                      console.error(`[SmartDeletion] Failed to delete ${id}`);
                    }
                  }
                }
              }
            } catch (error) {
              console.error("[SmartDeletion] Cloudinary deletion failed:", error.message);
              this.deletionService.recordError(`Cloudinary deletion failed: ${error.message}`);
            }
          }
          for (const url of localUrls) {
            const success = await deleteFile(url);
            if (success) {
              successCount++;
              this.deletionService.recordDeletion("local_files", 1);
            }
          }
        } else {
          for (const url of validUrls) {
            const success = await deleteFile(url);
            if (success) {
              successCount++;
              this.deletionService.recordDeletion("local_files", 1);
            }
          }
        }
        console.log(`[SmartDeletion] File cleanup complete: ${successCount}/${validUrls.length} files deleted`);
        return successCount;
      }
    };
    smartDeletionManager = new SmartDeletionManager();
  }
});

// server/realtime-service.ts
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import crypto from "crypto";
var JWT_SECRET, RealtimeService, realtimeService;
var init_realtime_service = __esm({
  "server/realtime-service.ts"() {
    "use strict";
    JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "development" ? "dev-secret-key-change-in-production" : void 0);
    RealtimeService = class {
      constructor() {
        this.io = null;
        this.connectedClients = /* @__PURE__ */ new Map();
        this.authenticatedSockets = /* @__PURE__ */ new Map();
        this.recentEventIds = /* @__PURE__ */ new Set();
        this.eventIdCleanupInterval = null;
        // Duplicate session detection: Map<sessionId, ActiveExamSession>
        this.activeExamSessions = /* @__PURE__ */ new Map();
        // Track socket to session mapping for cleanup
        this.socketToSession = /* @__PURE__ */ new Map();
        this.heartbeatInterval = null;
      }
      initialize(httpServer) {
        const allowedOrigins = [];
        if (process.env.NODE_ENV === "development") {
          allowedOrigins.push(
            "http://localhost:5173",
            "http://localhost:5000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5000"
          );
        }
        if (process.env.FRONTEND_URL) {
          allowedOrigins.push(process.env.FRONTEND_URL);
        }
        if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
          allowedOrigins.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
        }
        if (process.env.REPLIT_DEV_DOMAIN) {
          allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
        }
        this.io = new SocketIOServer(httpServer, {
          cors: {
            origin: (origin, callback) => {
              if (!origin) return callback(null, true);
              if (allowedOrigins.some((allowed) => origin.startsWith(allowed) || origin.includes(".repl.co") || origin.includes(".replit.dev"))) {
                return callback(null, true);
              }
              if (process.env.NODE_ENV === "development") {
                return callback(null, true);
              }
              console.warn(`\u26A0\uFE0F  Socket.IO CORS blocked origin: ${origin}`);
              callback(new Error("CORS not allowed"));
            },
            credentials: true,
            methods: ["GET", "POST"]
          },
          path: "/socket.io/",
          transports: ["websocket", "polling"],
          // Production optimizations
          pingTimeout: 6e4,
          pingInterval: 25e3,
          upgradeTimeout: 3e4,
          maxHttpBufferSize: 1e6,
          // 1MB
          connectTimeout: 45e3
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.startEventIdCleanup();
        this.startHeartbeatCheck();
        console.log("\u2705 Socket.IO Realtime Service initialized");
        console.log(`   \u2192 CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "dynamic (Replit)"}`);
        console.log(`   \u2192 Environment: ${process.env.NODE_ENV || "development"}`);
      }
      setupMiddleware() {
        if (!this.io) return;
        this.io.use((socket, next) => {
          const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
          if (!token) {
            console.log(`\u{1F4E1} Connection rejected: No authentication token provided (${socket.id})`);
            return next(new Error("Authentication required"));
          }
          try {
            if (!JWT_SECRET) {
              console.warn("\u26A0\uFE0F  JWT_SECRET not configured - rejecting connection");
              return next(new Error("Server configuration error"));
            }
            const decoded = jwt.verify(token, JWT_SECRET);
            const role = decoded.roleName || decoded.role || "unknown";
            this.authenticatedSockets.set(socket.id, {
              id: socket.id,
              userId: decoded.userId,
              role,
              authorizedClasses: decoded.authorizedClasses || [],
              authorizedStudentIds: decoded.authorizedStudentIds || []
            });
            console.log(`\u{1F4E1} Authenticated socket: ${socket.id} (User: ${decoded.userId}, Role: ${role}, Classes: ${(decoded.authorizedClasses || []).length})`);
            next();
          } catch (error) {
            console.warn(`\u26A0\uFE0F  Invalid token for socket ${socket.id}:`, error instanceof Error ? error.message : "Unknown error");
            return next(new Error("Invalid or expired token"));
          }
        });
      }
      setupEventHandlers() {
        if (!this.io) return;
        this.io.on("connection", (socket) => {
          const user = this.authenticatedSockets.get(socket.id);
          console.log(`\u{1F4E1} Client connected: ${socket.id}${user ? ` (User: ${user.userId})` : " (Anonymous)"}`);
          if (user) {
            socket.join(`user:${user.userId}`);
            socket.join(`role:${user.role}`);
            console.log(`   \u2192 Auto-joined rooms: user:${user.userId}, role:${user.role}`);
          }
          socket.on("subscribe", (data) => {
            this.handleSubscribe(socket, data);
          });
          socket.on("subscribe:table", (data) => {
            this.handleTableSubscribe(socket, data.table);
          });
          socket.on("subscribe:class", (data) => {
            this.handleClassSubscribe(socket, data.classId);
          });
          socket.on("subscribe:exam", (data) => {
            this.handleExamSubscribe(socket, data.examId);
          });
          socket.on("subscribe:reportcard", (data) => {
            this.handleReportCardSubscribe(socket, data.reportCardId);
          });
          socket.on("unsubscribe", (data) => {
            this.handleUnsubscribe(socket, data);
          });
          socket.on("disconnect", () => {
            this.handleDisconnect(socket);
          });
          socket.on("ping", () => {
            socket.emit("pong", { timestamp: Date.now() });
          });
          socket.on("get:subscriptions", () => {
            const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
            socket.emit("subscriptions", { rooms });
          });
          socket.on("exam:register_session", (data) => {
            this.handleExamSessionRegister(socket, data);
          });
          socket.on("exam:session_heartbeat", (data) => {
            this.handleExamSessionHeartbeat(socket, data);
          });
          socket.on("exam:unregister_session", (data) => {
            this.handleExamSessionUnregister(socket, data);
          });
        });
      }
      // EXAM SECURITY: Handle exam session registration for duplicate detection
      handleExamSessionRegister(socket, data) {
        const user = this.authenticatedSockets.get(socket.id);
        if (!user) {
          socket.emit("exam:session_error", { error: "Authentication required" });
          return;
        }
        const { sessionId, examId } = data;
        const now = /* @__PURE__ */ new Date();
        const existingSession = this.activeExamSessions.get(sessionId);
        if (existingSession && existingSession.socketId !== socket.id) {
          const timeSinceLastPing = now.getTime() - existingSession.lastPing.getTime();
          if (timeSinceLastPing < 1e4) {
            console.log(`\u26A0\uFE0F  DUPLICATE EXAM SESSION DETECTED: Session ${sessionId}, User ${user.userId}`);
            console.log(`   \u2192 Existing socket: ${existingSession.socketId}, New socket: ${socket.id}`);
            socket.emit("exam:duplicate_session", {
              sessionId,
              examId,
              message: "This exam session is already open in another tab or device",
              existingSocketId: existingSession.socketId
            });
            this.io?.to(existingSession.socketId).emit("exam:duplicate_session", {
              sessionId,
              examId,
              message: "This exam session was opened in another tab or device",
              newSocketId: socket.id
            });
            return;
          }
          console.log(`   \u2192 Cleaning up stale exam session: ${sessionId} (socket: ${existingSession.socketId})`);
          this.socketToSession.delete(existingSession.socketId);
        }
        this.activeExamSessions.set(sessionId, {
          socketId: socket.id,
          sessionId,
          userId: user.userId,
          examId,
          registeredAt: now,
          lastPing: now
        });
        this.socketToSession.set(socket.id, sessionId);
        socket.join(`exam_session:${sessionId}`);
        console.log(`\u{1F4CB} Exam session registered: Session ${sessionId}, User ${user.userId}, Socket ${socket.id}`);
        socket.emit("exam:session_registered", { sessionId, examId });
      }
      // EXAM SECURITY: Handle session heartbeat to keep session alive
      handleExamSessionHeartbeat(socket, data) {
        const session = this.activeExamSessions.get(data.sessionId);
        if (session && session.socketId === socket.id) {
          session.lastPing = /* @__PURE__ */ new Date();
          socket.emit("exam:heartbeat_ack", { sessionId: data.sessionId, timestamp: Date.now() });
        }
      }
      // EXAM SECURITY: Handle session unregistration when exam ends
      handleExamSessionUnregister(socket, data) {
        const session = this.activeExamSessions.get(data.sessionId);
        if (session && session.socketId === socket.id) {
          this.activeExamSessions.delete(data.sessionId);
          this.socketToSession.delete(socket.id);
          socket.leave(`exam_session:${data.sessionId}`);
          console.log(`\u{1F4CB} Exam session unregistered: Session ${data.sessionId}, Socket ${socket.id}`);
        }
      }
      handleSubscribe(socket, data) {
        if (data.table) {
          this.handleTableSubscribe(socket, data.table);
        }
        if (data.channel) {
          socket.join(data.channel);
          console.log(`   \u2192 Client ${socket.id} joined channel: ${data.channel}`);
          socket.emit("subscribed", { channel: data.channel });
        }
        if (data.classId) {
          this.handleClassSubscribe(socket, data.classId);
        }
        if (data.examId) {
          this.handleExamSubscribe(socket, data.examId);
        }
        if (data.reportCardId) {
          this.handleReportCardSubscribe(socket, data.reportCardId);
        }
      }
      handleTableSubscribe(socket, table) {
        const user = this.authenticatedSockets.get(socket.id);
        if (!user) {
          socket.emit("subscription_error", { type: "table", table, error: "Authentication required" });
          return;
        }
        const role = this.normalizeRole(user.role);
        const adminOnlyTables = ["users", "students", "teacher_profiles", "admin_profiles", "parent_profiles"];
        const academicTables = ["report_cards", "report_card_items", "exam_results", "exam_sessions", "exams"];
        const fullAccessRoles = ["super_admin", "admin"];
        const academicRoles = ["super_admin", "admin", "teacher"];
        if (adminOnlyTables.includes(table) && !fullAccessRoles.includes(role)) {
          socket.emit("subscription_error", { type: "table", table, error: "Insufficient permissions for this table" });
          console.log(`   \u26A0\uFE0F  Unauthorized table subscription attempt by ${user.userId} (role: ${role}) for table: ${table}`);
          return;
        }
        if (academicTables.includes(table) && !academicRoles.includes(role)) {
          socket.emit("subscription_error", { type: "table", table, error: "Insufficient permissions for academic table" });
          console.log(`   \u26A0\uFE0F  Unauthorized academic table subscription attempt by ${user.userId} (role: ${role}) for table: ${table}`);
          return;
        }
        const channel = `table:${table}`;
        socket.join(channel);
        if (!this.connectedClients.has(table)) {
          this.connectedClients.set(table, /* @__PURE__ */ new Set());
        }
        this.connectedClients.get(table).add(socket.id);
        console.log(`   \u2192 Client ${socket.id} subscribed to table: ${table}`);
        socket.emit("subscribed", { table, channel });
      }
      handleClassSubscribe(socket, classId) {
        const user = this.authenticatedSockets.get(socket.id);
        if (!user) {
          socket.emit("subscription_error", { type: "class", classId, error: "Authentication required" });
          return;
        }
        const role = this.normalizeRole(user.role);
        const fullAccessRoles = ["super_admin", "admin"];
        if (fullAccessRoles.includes(role)) {
          const channel2 = `class:${classId}`;
          socket.join(channel2);
          console.log(`   \u2192 Client ${socket.id} (${role}) subscribed to class: ${classId}`);
          socket.emit("subscribed", { type: "class", classId, channel: channel2 });
          return;
        }
        const authorizedClasses = user.authorizedClasses || [];
        if (!authorizedClasses.includes(classId) && !authorizedClasses.includes(classId.toString())) {
          socket.emit("subscription_error", {
            type: "class",
            classId,
            error: "Access denied: You are not authorized for this class"
          });
          console.log(`   \u26A0\uFE0F  Unauthorized class subscription: ${user.userId} (role: ${role}) attempted to access class ${classId}`);
          return;
        }
        const channel = `class:${classId}`;
        socket.join(channel);
        console.log(`   \u2192 Client ${socket.id} subscribed to class: ${classId}`);
        socket.emit("subscribed", { type: "class", classId, channel });
      }
      handleExamSubscribe(socket, examId) {
        const user = this.authenticatedSockets.get(socket.id);
        if (!user) {
          socket.emit("subscription_error", { type: "exam", examId, error: "Authentication required" });
          return;
        }
        const role = this.normalizeRole(user.role);
        const fullAccessRoles = ["super_admin", "admin"];
        if (fullAccessRoles.includes(role)) {
          const channel = `exam:${examId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (${role}) subscribed to exam: ${examId}`);
          socket.emit("subscribed", { type: "exam", examId, channel });
          return;
        }
        if (role === "teacher") {
          const channel = `exam:${examId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (teacher) subscribed to exam: ${examId}`);
          socket.emit("subscribed", { type: "exam", examId, channel });
          return;
        }
        if (role === "student" && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
          const channel = `exam:${examId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (student) subscribed to exam: ${examId}`);
          socket.emit("subscribed", { type: "exam", examId, channel });
          return;
        }
        socket.emit("subscription_error", { type: "exam", examId, error: "Access denied: insufficient permissions" });
        console.log(`   \u26A0\uFE0F  Unauthorized exam subscription: ${user.userId} (role: ${role})`);
      }
      handleReportCardSubscribe(socket, reportCardId) {
        const user = this.authenticatedSockets.get(socket.id);
        if (!user) {
          socket.emit("subscription_error", { type: "reportcard", reportCardId, error: "Authentication required" });
          return;
        }
        const role = this.normalizeRole(user.role);
        const fullAccessRoles = ["super_admin", "admin"];
        if (fullAccessRoles.includes(role)) {
          const channel = `reportcard:${reportCardId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (${role}) subscribed to report card: ${reportCardId}`);
          socket.emit("subscribed", { type: "reportcard", reportCardId, channel });
          return;
        }
        if (role === "teacher") {
          const channel = `reportcard:${reportCardId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (teacher) subscribed to report card: ${reportCardId}`);
          socket.emit("subscribed", { type: "reportcard", reportCardId, channel });
          return;
        }
        if (role === "student" && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
          const channel = `reportcard:${reportCardId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (student) subscribed to report card: ${reportCardId}`);
          socket.emit("subscribed", { type: "reportcard", reportCardId, channel });
          return;
        }
        if (role === "parent" && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
          const channel = `reportcard:${reportCardId}`;
          socket.join(channel);
          console.log(`   \u2192 Client ${socket.id} (parent) subscribed to report card: ${reportCardId}`);
          socket.emit("subscribed", { type: "reportcard", reportCardId, channel });
          return;
        }
        socket.emit("subscription_error", { type: "reportcard", reportCardId, error: "Access denied: insufficient permissions" });
        console.log(`   \u26A0\uFE0F  Unauthorized report card subscription: ${user.userId} (role: ${role})`);
      }
      // Normalize role names to canonical lowercase slugs
      normalizeRole(role) {
        const roleMap = {
          "super admin": "super_admin",
          "superadmin": "super_admin",
          "super_admin": "super_admin",
          "admin": "admin",
          "administrator": "admin",
          "teacher": "teacher",
          "student": "student",
          "parent": "parent"
        };
        return roleMap[role.toLowerCase()] || role.toLowerCase();
      }
      handleUnsubscribe(socket, data) {
        if (data.table) {
          const channel = `table:${data.table}`;
          socket.leave(channel);
          if (this.connectedClients.has(data.table)) {
            this.connectedClients.get(data.table).delete(socket.id);
            if (this.connectedClients.get(data.table).size === 0) {
              this.connectedClients.delete(data.table);
            }
          }
          console.log(`   \u2192 Client ${socket.id} unsubscribed from table: ${data.table}`);
          socket.emit("unsubscribed", { table: data.table });
        }
        if (data.channel) {
          socket.leave(data.channel);
          console.log(`   \u2192 Client ${socket.id} left channel: ${data.channel}`);
          socket.emit("unsubscribed", { channel: data.channel });
        }
        if (data.classId) {
          socket.leave(`class:${data.classId}`);
          socket.emit("unsubscribed", { type: "class", classId: data.classId });
        }
        if (data.examId) {
          socket.leave(`exam:${data.examId}`);
          socket.emit("unsubscribed", { type: "exam", examId: data.examId });
        }
        if (data.reportCardId) {
          socket.leave(`reportcard:${data.reportCardId}`);
          socket.emit("unsubscribed", { type: "reportcard", reportCardId: data.reportCardId });
        }
      }
      handleDisconnect(socket) {
        const user = this.authenticatedSockets.get(socket.id);
        console.log(`\u{1F4E1} Client disconnected: ${socket.id}${user ? ` (User: ${user.userId})` : ""}`);
        const sessionId = this.socketToSession.get(socket.id);
        if (sessionId) {
          const session = this.activeExamSessions.get(sessionId);
          if (session && session.socketId === socket.id) {
            this.activeExamSessions.delete(sessionId);
            console.log(`   \u2192 Cleaned up exam session ${sessionId} on disconnect`);
          }
          this.socketToSession.delete(socket.id);
        }
        this.connectedClients.forEach((clients, table) => {
          clients.delete(socket.id);
          if (clients.size === 0) {
            this.connectedClients.delete(table);
          }
        });
        this.authenticatedSockets.delete(socket.id);
      }
      generateEventId() {
        return crypto.randomUUID();
      }
      startEventIdCleanup() {
        this.eventIdCleanupInterval = setInterval(() => {
          this.recentEventIds.clear();
        }, 6e4);
      }
      startHeartbeatCheck() {
        this.heartbeatInterval = setInterval(() => {
          if (!this.io) return;
          const now = Date.now();
          this.authenticatedSockets.forEach((user, socketId) => {
            const socket = this.io?.sockets.sockets.get(socketId);
            if (!socket || socket.disconnected) {
              this.authenticatedSockets.delete(socketId);
              this.connectedClients.forEach((clients) => {
                clients.delete(socketId);
              });
            }
          });
        }, 3e4);
      }
      emitTableChange(table, operation, data, oldData, userId) {
        if (!this.io) {
          console.warn("\u26A0\uFE0F  Socket.IO not initialized, cannot emit event");
          return;
        }
        const eventId = this.generateEventId();
        this.recentEventIds.add(eventId);
        const channel = `table:${table}`;
        const payload = {
          eventId,
          eventType: `${table}.${operation.toLowerCase()}`,
          table,
          operation,
          data,
          oldData,
          timestamp: Date.now(),
          userId
        };
        this.io.to(channel).emit("table_change", payload);
        const subscriberCount = this.connectedClients.get(table)?.size || 0;
        if (subscriberCount > 0) {
          console.log(`\u{1F4E4} Emitted ${operation} event for table ${table} to ${subscriberCount} clients (eventId: ${eventId.slice(0, 8)}...)`);
        }
        return eventId;
      }
      emitEvent(eventType, data, rooms) {
        if (!this.io) {
          console.warn("\u26A0\uFE0F  Socket.IO not initialized, cannot emit event");
          return;
        }
        const eventId = this.generateEventId();
        const payload = {
          eventId,
          eventType,
          data,
          timestamp: Date.now()
        };
        if (rooms) {
          const roomList = Array.isArray(rooms) ? rooms : [rooms];
          roomList.forEach((room) => {
            this.io.to(room).emit(eventType, payload);
          });
          console.log(`\u{1F4E4} Emitted ${eventType} to rooms: ${roomList.join(", ")}`);
        } else {
          this.io.emit(eventType, payload);
          console.log(`\u{1F4E4} Broadcast event: ${eventType}`);
        }
        return eventId;
      }
      emitToUser(userId, eventType, data) {
        return this.emitEvent(eventType, data, `user:${userId}`);
      }
      emitToRole(role, eventType, data) {
        return this.emitEvent(eventType, data, `role:${role}`);
      }
      emitToClass(classId, eventType, data) {
        return this.emitEvent(eventType, data, `class:${classId}`);
      }
      emitToExam(examId, eventType, data) {
        return this.emitEvent(eventType, data, `exam:${examId}`);
      }
      emitToReportCard(reportCardId, eventType, data) {
        return this.emitEvent(eventType, data, `reportcard:${reportCardId}`);
      }
      emitToAll(event, data) {
        if (!this.io) {
          console.warn("\u26A0\uFE0F  Socket.IO not initialized, cannot emit event");
          return;
        }
        this.io.emit(event, data);
        console.log(`\u{1F4E4} Broadcast event: ${event}`);
      }
      emitToRoom(room, event, data) {
        if (!this.io) {
          console.warn("\u26A0\uFE0F  Socket.IO not initialized, cannot emit event");
          return;
        }
        this.io.to(room).emit(event, data);
      }
      emitExamEvent(examId, eventType, data) {
        const fullEventType = `exam.${eventType}`;
        this.emitToExam(examId, fullEventType, { ...data, examId });
        if (data.classId) {
          this.emitToClass(data.classId, fullEventType, { ...data, examId });
        }
      }
      // Dedicated method for exam publish/unpublish events
      emitExamPublishEvent(examId, isPublished, data, userId) {
        const eventType = isPublished ? "exam.published" : "exam.unpublished";
        const operation = "UPDATE";
        this.emitTableChange("exams", operation, { ...data, id: examId, isPublished }, void 0, userId);
        this.emitToExam(examId, eventType, { ...data, examId, isPublished });
        this.emitToRole("teacher", eventType, { ...data, examId, isPublished });
        this.emitToRole("admin", eventType, { ...data, examId, isPublished });
        this.emitToRole("super_admin", eventType, { ...data, examId, isPublished });
        if (isPublished && data.classId) {
          this.emitToClass(data.classId.toString(), eventType, { ...data, examId, isPublished });
        }
        console.log(`\u{1F4E4} Emitted ${eventType} for exam ${examId}`);
      }
      emitReportCardEvent(reportCardId, eventType, data, userId) {
        const fullEventType = `reportcard.${eventType}`;
        const operation = eventType === "created" ? "INSERT" : "UPDATE";
        this.emitTableChange("report_cards", operation, { ...data, id: reportCardId }, void 0, userId);
        this.emitToReportCard(reportCardId, fullEventType, data);
        this.emitToRole("teacher", fullEventType, { ...data, reportCardId });
        this.emitToRole("admin", fullEventType, { ...data, reportCardId });
        this.emitToRole("super_admin", fullEventType, { ...data, reportCardId });
        if (data.studentId) {
          this.emitToUser(data.studentId, fullEventType, data);
        }
        if (data.classId) {
          this.emitToClass(data.classId.toString(), fullEventType, data);
        }
        if (eventType === "published" && data.studentId && data.parentIds) {
          const parentIds = Array.isArray(data.parentIds) ? data.parentIds : [data.parentIds];
          parentIds.forEach((parentId) => {
            this.emitToUser(parentId, fullEventType, {
              ...data,
              message: "A new report card has been published for your child"
            });
          });
        }
        console.log(`\u{1F4E4} Emitted reportcard.${eventType} for report card ${reportCardId} (student: ${data.studentId || "unknown"})`);
      }
      // Bulk emit for status changes affecting multiple report cards
      emitBulkReportCardStatusChange(reportCardIds, newStatus, classId, termId, userId) {
        const eventType = newStatus === "published" ? "bulk_published" : newStatus === "finalized" ? "bulk_finalized" : "bulk_reverted";
        const fullEventType = `reportcard.${eventType}`;
        const data = {
          reportCardIds,
          newStatus,
          classId,
          termId,
          count: reportCardIds.length,
          timestamp: Date.now()
        };
        this.emitToRole("teacher", fullEventType, data);
        this.emitToRole("admin", fullEventType, data);
        this.emitToRole("super_admin", fullEventType, data);
        this.emitToClass(classId.toString(), fullEventType, data);
        this.emitTableChange("report_cards", "UPDATE", data, void 0, userId);
        console.log(`\u{1F4E4} Emitted ${fullEventType} for ${reportCardIds.length} report cards in class ${classId}`);
      }
      emitUserEvent(userId, eventType, data, role) {
        const fullEventType = `user.${eventType}`;
        this.emitTableChange("users", eventType.toUpperCase(), data, void 0, userId);
        if (role) {
          this.emitToRole("admin", fullEventType, data);
          this.emitToRole("super_admin", fullEventType, data);
        }
      }
      emitAttendanceEvent(classId, eventType, data) {
        const fullEventType = `attendance.${eventType}`;
        this.emitToClass(classId, fullEventType, data);
        this.emitTableChange("attendance", eventType === "marked" ? "INSERT" : "UPDATE", data);
      }
      emitNotification(userId, notification) {
        this.emitToUser(userId, "notification", notification);
      }
      emitUploadProgress(userId, uploadId, progress, status, url) {
        this.emitToUser(userId, "upload.progress", {
          uploadId,
          progress,
          status,
          url
        });
      }
      // Enhanced helper methods for consistent event emission across all modules
      emitClassEvent(classId, eventType, data, userId) {
        const fullEventType = `class.${eventType}`;
        const operation = eventType === "created" ? "INSERT" : eventType === "updated" ? "UPDATE" : "DELETE";
        this.emitTableChange("classes", operation, data, void 0, userId);
        this.emitToRole("admin", fullEventType, data);
        this.emitToRole("teacher", fullEventType, data);
        if (classId) {
          this.emitToClass(classId, fullEventType, data);
        }
      }
      emitSubjectEvent(eventType, data, userId) {
        const fullEventType = `subject.${eventType}`;
        const operation = eventType === "created" ? "INSERT" : eventType === "updated" ? "UPDATE" : "DELETE";
        this.emitTableChange("subjects", operation, data, void 0, userId);
        this.emitToRole("admin", fullEventType, data);
        this.emitToRole("teacher", fullEventType, data);
      }
      emitAnnouncementEvent(operation, announcement, userId) {
        const fullEventType = `announcement.${operation}`;
        const op = operation === "created" ? "INSERT" : operation === "updated" ? "UPDATE" : "DELETE";
        this.emitTableChange("announcements", op, announcement, void 0, userId);
        this.emitEvent(fullEventType, announcement);
        this.emitEvent("announcements-updated", { operation, id: announcement.id });
        console.log(`\u{1F4E2} Announcement ${operation} broadcasted: ${announcement.title}`);
      }
      emitExamSessionEvent(examId, sessionId, eventType, data, userId) {
        const fullEventType = `examSession.${eventType}`;
        this.emitTableChange("exam_sessions", eventType === "started" ? "INSERT" : "UPDATE", data, void 0, userId);
        this.emitToExam(examId, fullEventType, { sessionId, ...data });
        if (data.classId) {
          this.emitToClass(data.classId.toString(), fullEventType, { sessionId, ...data });
        }
      }
      emitExamResultEvent(examId, eventType, data, userId) {
        const fullEventType = `examResult.${eventType}`;
        const operation = eventType === "created" ? "INSERT" : "UPDATE";
        this.emitTableChange("exam_results", operation, data, void 0, userId);
        this.emitToExam(examId, fullEventType, data);
        if (data.studentId) {
          this.emitToUser(data.studentId.toString(), fullEventType, data);
        }
        if (data.classId) {
          this.emitToClass(data.classId.toString(), fullEventType, data);
        }
      }
      emitTeacherAssignmentEvent(eventType, data, userId) {
        const fullEventType = `teacherAssignment.${eventType}`;
        const operation = eventType === "created" ? "INSERT" : eventType === "updated" ? "UPDATE" : "DELETE";
        this.emitTableChange("teacher_assignments", operation, data, void 0, userId);
        this.emitToRole("admin", fullEventType, data);
        if (data.teacherId) {
          this.emitToUser(data.teacherId.toString(), fullEventType, data);
        }
        if (data.classId) {
          this.emitToClass(data.classId.toString(), fullEventType, data);
        }
      }
      emitParentLinkEvent(parentId, studentId, eventType, data, userId) {
        const fullEventType = `parentLink.${eventType}`;
        const operation = eventType === "linked" ? "INSERT" : "DELETE";
        this.emitTableChange("parent_student_links", operation, data, void 0, userId);
        this.emitToUser(parentId, fullEventType, data);
        this.emitToUser(studentId, fullEventType, data);
        this.emitToRole("admin", fullEventType, data);
      }
      emitSystemSettingEvent(eventType, data, userId) {
        const fullEventType = `system.settings_${eventType}`;
        this.emitTableChange("system_settings", "UPDATE", data, void 0, userId);
        this.emitToRole("super_admin", fullEventType, data);
        this.emitToRole("admin", fullEventType, data);
        if (data.key && ["schoolName", "schoolLogo", "primaryColor", "secondaryColor"].includes(data.key)) {
          this.emitEvent(`system.branding_${eventType}`, { key: data.key, value: data.value });
        }
      }
      // Dashboard stats emission for real-time dashboard updates
      emitDashboardStats(role, stats) {
        this.emitToRole(role, "dashboard.stats_updated", stats);
      }
      // Grading settings event for real-time config updates
      emitGradingSettingsEvent(eventType, data, userId) {
        const fullEventType = `grading_settings.${eventType}`;
        this.emitToRole("admin", fullEventType, data);
        this.emitToRole("super_admin", fullEventType, data);
        this.emitToRole("teacher", fullEventType, data);
        this.emitEvent("grading_settings.changed", {
          testWeight: data.testWeight,
          examWeight: data.examWeight,
          gradingScale: data.gradingScale,
          timestamp: Date.now()
        });
        console.log(`\u{1F4E4} Emitted ${fullEventType} - Test: ${data.testWeight}%, Exam: ${data.examWeight}%`);
      }
      // Enhanced student-specific report card subscription
      emitStudentReportCardUpdate(studentId, reportCardId, eventType, data) {
        const fullEventType = `reportcard.${eventType}`;
        this.emitToUser(studentId, fullEventType, data);
        this.emitToReportCard(reportCardId, fullEventType, data);
        if (data.parentId) {
          this.emitToUser(data.parentId, fullEventType, data);
        }
        console.log(`\u{1F4E4} Emitted student report card update for student ${studentId}`);
      }
      getIO() {
        return this.io;
      }
      getSubscriberCount(table) {
        return this.connectedClients.get(table)?.size || 0;
      }
      getActiveSubscriptions() {
        return Array.from(this.connectedClients.keys());
      }
      getConnectedUserCount() {
        return this.authenticatedSockets.size;
      }
      getRoomSubscriberCount(room) {
        if (!this.io) return 0;
        const roomObj = this.io.sockets.adapter.rooms.get(room);
        return roomObj ? roomObj.size : 0;
      }
      getStats() {
        return {
          totalConnections: this.io?.sockets.sockets.size || 0,
          authenticatedUsers: this.authenticatedSockets.size,
          tableSubscriptions: Object.fromEntries(this.connectedClients),
          activeRooms: this.io ? Array.from(this.io.sockets.adapter.rooms.keys()).filter((r) => !this.io.sockets.sockets.has(r)) : []
        };
      }
      broadcastSystemSettingsUpdate(settings3) {
        this.io?.emit("system_settings_update", settings3);
      }
      shutdown() {
        if (this.eventIdCleanupInterval) {
          clearInterval(this.eventIdCleanupInterval);
        }
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        if (this.io) {
          this.io.close();
        }
        console.log("\u{1F6D1} Socket.IO Realtime Service shut down");
      }
    };
    realtimeService = new RealtimeService();
  }
});

// server/storage.ts
import { eq as eq2, and as and2, desc, asc, sql as sql2, sql as dsql2, inArray as inArray2, isNull, isNotNull, ne, gte, lte, or as or2, like } from "drizzle-orm";
import { randomUUID } from "crypto";
function normalizeUuid(raw) {
  if (!raw) return void 0;
  if (typeof raw === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  let bytes;
  if (typeof raw === "string" && raw.includes(",")) {
    const parts = raw.split(",").map((s) => parseInt(s.trim()));
    if (parts.length === 16 && parts.every((n) => n >= 0 && n <= 255)) {
      bytes = parts;
    }
  }
  if (Array.isArray(raw) && raw.length === 16) {
    bytes = raw;
  } else if (raw instanceof Uint8Array && raw.length === 16) {
    bytes = Array.from(raw);
  }
  if (bytes) {
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return void 0;
}
function initializeStorageSync() {
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
var db2, schema, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_db();
    init_grading_config();
    init_cloudinary_service();
    init_deletion_service();
    init_smart_deletion_manager();
    init_realtime_service();
    db2 = getDatabase();
    schema = getSchema();
    DatabaseStorage = class {
      constructor() {
        this.db = db2;
        if (!this.db) {
          throw new Error("Database not available - DATABASE_URL not set or invalid");
        }
      }
      // User management
      async getUser(id) {
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
          updatedAt: schema.users.updatedAt
        }).from(schema.users).where(eq2(schema.users.id, id)).limit(1);
        const user = result[0];
        if (user && user.id) {
          const normalizedId = normalizeUuid(user.id);
          if (normalizedId) {
            user.id = normalizedId;
          }
        }
        return user;
      }
      async getUserByEmail(email) {
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
          updatedAt: schema.users.updatedAt
        }).from(schema.users).where(eq2(schema.users.email, email)).limit(1);
        const user = result[0];
        if (user && user.id) {
          const normalizedId = normalizeUuid(user.id);
          if (normalizedId) {
            user.id = normalizedId;
          }
        }
        return user;
      }
      async getUserByUsername(username) {
        const result = await this.db.select().from(schema.users).where(eq2(schema.users.username, username)).limit(1);
        const user = result[0];
        if (user && user.id) {
          const normalizedId = normalizeUuid(user.id);
          if (normalizedId) {
            user.id = normalizedId;
          }
        }
        return user;
      }
      async createPasswordResetToken(userId, token, expiresAt, ipAddress, resetBy) {
        const result = await this.db.insert(schema.passwordResetTokens).values({
          userId,
          token,
          expiresAt,
          ipAddress,
          resetBy
        }).returning();
        return result[0];
      }
      async getPasswordResetToken(token) {
        const result = await this.db.select().from(schema.passwordResetTokens).where(and2(
          eq2(schema.passwordResetTokens.token, token),
          dsql2`${schema.passwordResetTokens.expiresAt} > NOW()`,
          dsql2`${schema.passwordResetTokens.usedAt} IS NULL`
        )).limit(1);
        return result[0];
      }
      async markPasswordResetTokenAsUsed(token) {
        const result = await this.db.update(schema.passwordResetTokens).set({ usedAt: dsql2`NOW()` }).where(eq2(schema.passwordResetTokens.token, token)).returning();
        return result.length > 0;
      }
      async deleteExpiredPasswordResetTokens() {
        await this.db.delete(schema.passwordResetTokens).where(dsql2`${schema.passwordResetTokens.expiresAt} < NOW()`);
        return true;
      }
      async createUser(user) {
        const userWithId = {
          ...user,
          id: user.id || randomUUID()
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
      async updateUser(id, user) {
        try {
          const result = await this.db.update(schema.users).set(user).where(eq2(schema.users.id, id)).returning();
          const updatedUser = result[0];
          if (updatedUser && updatedUser.id) {
            const normalizedId = normalizeUuid(updatedUser.id);
            if (normalizedId) {
              updatedUser.id = normalizedId;
            }
          }
          return updatedUser;
        } catch (error) {
          if (error?.cause?.code === "42703") {
            const missingColumn = error?.cause?.message?.match(/column "(\w+)" does not exist/)?.[1];
            const { [missingColumn]: removed, ...safeUser } = user;
            if (Object.keys(safeUser).length > 0) {
              const result = await this.db.update(schema.users).set(safeUser).where(eq2(schema.users.id, id)).returning();
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
      async deleteUser(id, performedBy) {
        try {
          const smartDeletionManager2 = new SmartDeletionManager();
          const result = await smartDeletionManager2.deleteUser(id, performedBy);
          return result.success;
        } catch (error) {
          console.error("[Storage] Smart deletion failed:", error.message);
          return false;
        }
      }
      async deleteUserWithDetails(id, performedBy) {
        const smartDeletionManager2 = new SmartDeletionManager();
        return await smartDeletionManager2.deleteUser(id, performedBy);
      }
      async validateDeletion(id) {
        const smartDeletionManager2 = new SmartDeletionManager();
        return await smartDeletionManager2.validateDeletion(id);
      }
      async cleanupOrphanRecords() {
        return await cleanupOrphanRecords();
      }
      async bulkDeleteUsers(userIds, performedBy) {
        return await bulkDeleteUsers(userIds, performedBy);
      }
      async deleteUserLegacy(id) {
        const deletionService2 = new DeletionService();
        deletionService2.reset();
        try {
          const user = await this.getUser(id);
          if (!user) {
            return false;
          }
          const userRole = user.roleId === 1 ? "Super Admin" : user.roleId === 2 ? "Admin" : user.roleId === 3 ? "Teacher" : user.roleId === 4 ? "Student" : user.roleId === 5 ? "Parent" : "Unknown";
          console.log(`
[Legacy Deletion] Starting permanent deletion for ${userRole}: ${user.email || user.username}`);
          const filesToDelete = [];
          if (user.profileImageUrl) {
            filesToDelete.push(user.profileImageUrl);
          }
          const teacherProfile = await this.db.select({ signatureUrl: schema.teacherProfiles.signatureUrl }).from(schema.teacherProfiles).where(eq2(schema.teacherProfiles.userId, id)).limit(1);
          if (teacherProfile[0]?.signatureUrl) {
            filesToDelete.push(teacherProfile[0].signatureUrl);
          }
          const teacherExams = await this.db.select({ id: schema.exams.id }).from(schema.exams).where(eq2(schema.exams.createdBy, id));
          for (const exam of teacherExams) {
            try {
              await this.deleteExam(exam.id);
              deletionService2.recordDeletion("exams", 1);
            } catch (examError) {
              deletionService2.recordError(`Failed to delete exam ${exam.id}: ${examError.message}`);
            }
          }
          const questionBanks3 = await this.db.select({ id: schema.questionBanks.id }).from(schema.questionBanks).where(eq2(schema.questionBanks.createdBy, id));
          for (const qb of questionBanks3) {
            try {
              const qbItems = await this.db.select({ id: schema.questionBankItems.id, imageUrl: schema.questionBankItems.imageUrl }).from(schema.questionBankItems).where(eq2(schema.questionBankItems.questionBankId, qb.id));
              for (const item of qbItems) {
                if (item.imageUrl) filesToDelete.push(item.imageUrl);
              }
              const qbItemIds = qbItems.map((item) => item.id);
              if (qbItemIds.length > 0) {
                await this.db.delete(schema.questionBankOptions).where(inArray2(schema.questionBankOptions.questionId, qbItemIds));
                deletionService2.recordDeletion("question_bank_options", qbItemIds.length);
                await this.db.delete(schema.questionBankItems).where(eq2(schema.questionBankItems.questionBankId, qb.id));
                deletionService2.recordDeletion("question_bank_items", qbItemIds.length);
              }
              await this.db.delete(schema.questionBanks).where(eq2(schema.questionBanks.id, qb.id));
              deletionService2.recordDeletion("question_banks", 1);
            } catch (qbError) {
              deletionService2.recordError(`Failed to delete question bank ${qb.id}: ${qbError.message}`);
            }
          }
          const homePageContent3 = await this.db.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl }).from(schema.homePageContent).where(eq2(schema.homePageContent.uploadedBy, id));
          for (const content of homePageContent3) {
            if (content.imageUrl) filesToDelete.push(content.imageUrl);
          }
          const teacherProfileResult = await this.db.delete(schema.teacherProfiles).where(eq2(schema.teacherProfiles.userId, id)).returning();
          deletionService2.recordDeletion("teacher_profiles", teacherProfileResult.length);
          try {
            const teacherAssignmentsResult = await this.db.delete(schema.teacherClassAssignments).where(eq2(schema.teacherClassAssignments.teacherId, id)).returning();
            deletionService2.recordDeletion("teacher_class_assignments", teacherAssignmentsResult.length);
          } catch (e) {
          }
          try {
            const historyResult = await this.db.delete(schema.teacherAssignmentHistory).where(eq2(schema.teacherAssignmentHistory.teacherId, id)).returning();
            deletionService2.recordDeletion("teacher_assignment_history", historyResult.length);
          } catch (e) {
          }
          try {
            const timetableResult = await this.db.delete(schema.timetable).where(eq2(schema.timetable.teacherId, id)).returning();
            deletionService2.recordDeletion("timetable", timetableResult.length);
          } catch (e) {
          }
          try {
            const gradingResult = await this.db.delete(schema.gradingTasks).where(eq2(schema.gradingTasks.assignedTeacherId, id)).returning();
            deletionService2.recordDeletion("grading_tasks", gradingResult.length);
          } catch (e) {
          }
          const adminResult = await this.db.delete(schema.adminProfiles).where(eq2(schema.adminProfiles.userId, id)).returning();
          deletionService2.recordDeletion("admin_profiles", adminResult.length);
          const parentResult = await this.db.delete(schema.parentProfiles).where(eq2(schema.parentProfiles.userId, id)).returning();
          deletionService2.recordDeletion("parent_profiles", parentResult.length);
          try {
            const superAdminResult = await this.db.delete(schema.superAdminProfiles).where(eq2(schema.superAdminProfiles.userId, id)).returning();
            deletionService2.recordDeletion("super_admin_profiles", superAdminResult.length);
          } catch (e) {
          }
          const tokensResult = await this.db.delete(schema.passwordResetTokens).where(eq2(schema.passwordResetTokens.userId, id)).returning();
          deletionService2.recordDeletion("password_reset_tokens", tokensResult.length);
          const invitesAcceptedResult = await this.db.delete(schema.invites).where(eq2(schema.invites.acceptedBy, id)).returning();
          const invitesCreatedResult = await this.db.delete(schema.invites).where(eq2(schema.invites.createdBy, id)).returning();
          deletionService2.recordDeletion("invites", invitesAcceptedResult.length + invitesCreatedResult.length);
          const notificationsResult = await this.db.delete(schema.notifications).where(eq2(schema.notifications.userId, id)).returning();
          deletionService2.recordDeletion("notifications", notificationsResult.length);
          const messagesResult = await this.db.delete(schema.messages).where(or2(
            eq2(schema.messages.senderId, id),
            eq2(schema.messages.recipientId, id)
          )).returning();
          deletionService2.recordDeletion("messages", messagesResult.length);
          const announcementsResult = await this.db.delete(schema.announcements).where(eq2(schema.announcements.authorId, id)).returning();
          deletionService2.recordDeletion("announcements", announcementsResult.length);
          try {
            const perfEventsResult = await this.db.delete(schema.performanceEvents).where(eq2(schema.performanceEvents.userId, id)).returning();
            deletionService2.recordDeletion("performance_events", perfEventsResult.length);
          } catch (e) {
          }
          try {
            const auditResult = await this.db.delete(schema.auditLogs).where(eq2(schema.auditLogs.userId, id)).returning();
            deletionService2.recordDeletion("audit_logs", auditResult.length);
          } catch (e) {
          }
          try {
            const accessLogsResult = await this.db.delete(schema.unauthorizedAccessLogs).where(eq2(schema.unauthorizedAccessLogs.userId, id)).returning();
            deletionService2.recordDeletion("unauthorized_access_logs", accessLogsResult.length);
          } catch (e) {
          }
          const examSessions3 = await this.db.select({ id: schema.examSessions.id }).from(schema.examSessions).where(eq2(schema.examSessions.studentId, id));
          const sessionIds = examSessions3.map((s) => s.id);
          if (sessionIds.length > 0) {
            try {
              const sessionGradingResult = await this.db.delete(schema.gradingTasks).where(inArray2(schema.gradingTasks.sessionId, sessionIds)).returning();
              deletionService2.recordDeletion("grading_tasks", sessionGradingResult.length);
            } catch (e) {
            }
            try {
              const sessionPerfResult = await this.db.delete(schema.performanceEvents).where(inArray2(schema.performanceEvents.sessionId, sessionIds)).returning();
              deletionService2.recordDeletion("performance_events", sessionPerfResult.length);
            } catch (e) {
            }
            const answersResult = await this.db.delete(schema.studentAnswers).where(inArray2(schema.studentAnswers.sessionId, sessionIds)).returning();
            deletionService2.recordDeletion("student_answers", answersResult.length);
            const sessionsResult = await this.db.delete(schema.examSessions).where(inArray2(schema.examSessions.id, sessionIds)).returning();
            deletionService2.recordDeletion("exam_sessions", sessionsResult.length);
          }
          const examResultsResult = await this.db.delete(schema.examResults).where(eq2(schema.examResults.studentId, id)).returning();
          deletionService2.recordDeletion("exam_results", examResultsResult.length);
          const attendanceResult = await this.db.delete(schema.attendance).where(eq2(schema.attendance.studentId, id)).returning();
          deletionService2.recordDeletion("attendance", attendanceResult.length);
          try {
            const caResult = await this.db.delete(schema.continuousAssessment).where(eq2(schema.continuousAssessment.studentId, id)).returning();
            deletionService2.recordDeletion("continuous_assessment", caResult.length);
          } catch (e) {
          }
          try {
            const subjectAssignResult = await this.db.delete(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.studentId, id)).returning();
            deletionService2.recordDeletion("student_subject_assignments", subjectAssignResult.length);
          } catch (e) {
          }
          try {
            const reportCardItems3 = await this.db.select({ id: schema.reportCardItems.id }).from(schema.reportCardItems).innerJoin(schema.reportCards, eq2(schema.reportCardItems.reportCardId, schema.reportCards.id)).where(eq2(schema.reportCards.studentId, id));
            if (reportCardItems3.length > 0) {
              const reportCardItemIds = reportCardItems3.map((r) => r.report_card_items?.id || r.id);
              await this.db.delete(schema.reportCardItems).where(inArray2(schema.reportCardItems.id, reportCardItemIds));
              deletionService2.recordDeletion("report_card_items", reportCardItemIds.length);
            }
          } catch (e) {
          }
          try {
            const reportCardsResult = await this.db.delete(schema.reportCards).where(eq2(schema.reportCards.studentId, id)).returning();
            deletionService2.recordDeletion("report_cards", reportCardsResult.length);
          } catch (e) {
          }
          await this.db.update(schema.students).set({ parentId: null }).where(eq2(schema.students.parentId, id));
          const studentResult = await this.db.delete(schema.students).where(eq2(schema.students.id, id)).returning();
          deletionService2.recordDeletion("students", studentResult.length);
          try {
            await this.db.update(schema.classes).set({ classTeacherId: null }).where(eq2(schema.classes.classTeacherId, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.contactMessages).set({ respondedBy: null }).where(eq2(schema.contactMessages.respondedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.systemSettings).set({ updatedBy: null }).where(eq2(schema.systemSettings.updatedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.settings).set({ updatedBy: null }).where(eq2(schema.settings.updatedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.reportCardItems).set({ teacherId: null }).where(eq2(schema.reportCardItems.teacherId, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.reportCardItems).set({ testExamCreatedBy: null }).where(eq2(schema.reportCardItems.testExamCreatedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.reportCardItems).set({ examExamCreatedBy: null }).where(eq2(schema.reportCardItems.examExamCreatedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.exams).set({ createdBy: null }).where(eq2(schema.exams.createdBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.exams).set({ teacherInChargeId: null }).where(eq2(schema.exams.teacherInChargeId, id));
          } catch (e) {
          }
          try {
            const vacanciesResult = await this.db.delete(schema.vacancies).where(eq2(schema.vacancies.createdBy, id)).returning();
            deletionService2.recordDeletion("vacancies", vacanciesResult.length);
          } catch (e) {
          }
          try {
            await this.db.update(schema.teacherApplications).set({ reviewedBy: null }).where(eq2(schema.teacherApplications.reviewedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.approvedTeachers).set({ approvedBy: null }).where(eq2(schema.approvedTeachers.approvedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.attendance).set({ recordedBy: null }).where(eq2(schema.attendance.recordedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.questionBanks).set({ createdBy: null }).where(eq2(schema.questionBanks.createdBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.homePageContent).set({ uploadedBy: null }).where(eq2(schema.homePageContent.uploadedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.gallery).set({ uploadedBy: null }).where(eq2(schema.gallery.uploadedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.studyResources).set({ uploadedBy: null }).where(eq2(schema.studyResources.uploadedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.studentSubjectAssignments).set({ assignedBy: null }).where(eq2(schema.studentSubjectAssignments.assignedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.teacherClassAssignments).set({ assignedBy: null }).where(eq2(schema.teacherClassAssignments.assignedBy, id));
          } catch (e) {
          }
          try {
            await this.db.update(schema.teacherAssignmentHistory).set({ performedBy: null }).where(eq2(schema.teacherAssignmentHistory.performedBy, id));
          } catch (e) {
          }
          if (filesToDelete.length > 0) {
            console.log(`[Smart Deletion] Deleting ${filesToDelete.length} files from storage...`);
            await deletionService2.deleteFilesInBatch(filesToDelete);
          }
          const result = await this.db.delete(schema.users).where(eq2(schema.users.id, id)).returning();
          deletionService2.recordDeletion("users", result.length);
          const deletionResult = deletionService2.getResult();
          const logOutput = formatDeletionLog(deletionResult, id, userRole);
          console.log(logOutput);
          await this.createAuditLog({
            userId: id,
            action: "user_permanently_deleted",
            entityType: "user",
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
            ipAddress: "system",
            userAgent: "Smart Deletion Service"
          }).catch(() => {
          });
          return result.length > 0;
        } catch (error) {
          deletionService2.recordError(`Fatal error in deleteUser: ${error.message}`);
          console.error("[Smart Deletion] Error in deleteUser:", error);
          throw error;
        }
      }
      async getUsersByRole(roleId) {
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
          updatedAt: schema.users.updatedAt
        }).from(schema.users).where(eq2(schema.users.roleId, roleId));
        return result.map((user) => {
          if (user && user.id) {
            const normalizedId = normalizeUuid(user.id);
            if (normalizedId) {
              user.id = normalizedId;
            }
          }
          return user;
        });
      }
      async getUsersByStatus(status) {
        const result = await this.db.select().from(schema.users).where(sql2`${schema.users.status} = ${status}`);
        return result.map((user) => {
          if (user && user.id) {
            const normalizedId = normalizeUuid(user.id);
            if (normalizedId) {
              user.id = normalizedId;
            }
          }
          return user;
        });
      }
      async getAllUsers() {
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
          updatedAt: schema.users.updatedAt
        }).from(schema.users);
        return result.map((user) => {
          if (user && user.id) {
            const normalizedId = normalizeUuid(user.id);
            if (normalizedId) {
              user.id = normalizedId;
            }
          }
          return user;
        });
      }
      async approveUser(userId, approvedBy) {
        const result = await this.db.update(schema.users).set({
          status: "active",
          approvedBy,
          approvedAt: /* @__PURE__ */ new Date()
        }).where(eq2(schema.users.id, userId)).returning();
        const user = result[0];
        if (user && user.id) {
          const normalizedId = normalizeUuid(user.id);
          if (normalizedId) {
            user.id = normalizedId;
          }
        }
        return user;
      }
      async updateUserStatus(userId, status, updatedBy, reason) {
        const updates = { status };
        if (status === "active") {
          updates.approvedBy = updatedBy;
          updates.approvedAt = /* @__PURE__ */ new Date();
        }
        const result = await this.db.update(schema.users).set(updates).where(eq2(schema.users.id, userId)).returning();
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
      async getRoles() {
        return await this.db.select().from(schema.roles);
      }
      async getRoleByName(name) {
        const result = await this.db.select().from(schema.roles).where(eq2(schema.roles.name, name)).limit(1);
        return result[0];
      }
      async getRole(roleId) {
        const result = await this.db.select().from(schema.roles).where(eq2(schema.roles.id, roleId)).limit(1);
        return result[0];
      }
      // Invite management
      async createInvite(invite) {
        const result = await this.db.insert(schema.invites).values(invite).returning();
        return result[0];
      }
      async getInviteByToken(token) {
        const result = await this.db.select().from(schema.invites).where(and2(
          eq2(schema.invites.token, token),
          isNull(schema.invites.acceptedAt),
          dsql2`${schema.invites.expiresAt} > NOW()`
        )).limit(1);
        return result[0];
      }
      async getPendingInviteByEmail(email) {
        const result = await this.db.select().from(schema.invites).where(and2(
          eq2(schema.invites.email, email),
          isNull(schema.invites.acceptedAt)
        )).limit(1);
        return result[0];
      }
      async getAllInvites() {
        return await this.db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt));
      }
      async getPendingInvites() {
        return await this.db.select().from(schema.invites).where(isNull(schema.invites.acceptedAt)).orderBy(desc(schema.invites.createdAt));
      }
      async markInviteAsAccepted(inviteId, acceptedBy) {
        await this.db.update(schema.invites).set({ acceptedAt: /* @__PURE__ */ new Date(), acceptedBy }).where(eq2(schema.invites.id, inviteId));
      }
      async deleteInvite(inviteId) {
        const result = await this.db.delete(schema.invites).where(eq2(schema.invites.id, inviteId)).returning();
        return result.length > 0;
      }
      async deleteExpiredInvites() {
        const result = await this.db.delete(schema.invites).where(and2(
          dsql2`${schema.invites.expiresAt} < NOW()`,
          isNull(schema.invites.acceptedAt)
        )).returning();
        return result.length > 0;
      }
      // Profile management
      async updateUserProfile(userId, profileData) {
        const result = await this.db.update(schema.users).set({ ...profileData, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.users.id, userId)).returning();
        return result[0];
      }
      async getTeacherProfile(userId) {
        const [profile] = await db2.select().from(schema.teacherProfiles).where(eq2(schema.teacherProfiles.userId, userId));
        return profile || void 0;
      }
      async updateTeacherProfile(userId, profile) {
        const result = await this.db.update(schema.teacherProfiles).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.teacherProfiles.userId, userId)).returning();
        return result[0];
      }
      async getTeacherProfileByStaffId(staffId) {
        const [profile] = await db2.select().from(schema.teacherProfiles).where(eq2(schema.teacherProfiles.staffId, staffId));
        return profile || void 0;
      }
      async getAllTeacherProfiles() {
        const profiles = await db2.select().from(schema.teacherProfiles);
        return profiles;
      }
      async createTeacherProfile(profile) {
        const result = await this.db.insert(schema.teacherProfiles).values(profile).returning();
        return result[0];
      }
      async getAdminProfile(userId) {
        const result = await this.db.select().from(schema.adminProfiles).where(eq2(schema.adminProfiles.userId, userId)).limit(1);
        return result[0];
      }
      async createAdminProfile(profile) {
        const result = await this.db.insert(schema.adminProfiles).values(profile).returning();
        return result[0];
      }
      async updateAdminProfile(userId, profile) {
        const result = await this.db.update(schema.adminProfiles).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.adminProfiles.userId, userId)).returning();
        return result[0];
      }
      async getSuperAdminProfile(userId) {
        const result = await this.db.select().from(schema.superAdminProfiles).where(eq2(schema.superAdminProfiles.userId, userId)).limit(1);
        return result[0];
      }
      async createSuperAdminProfile(profile) {
        const result = await this.db.insert(schema.superAdminProfiles).values(profile).returning();
        return result[0];
      }
      async updateSuperAdminProfile(userId, profile) {
        const result = await this.db.update(schema.superAdminProfiles).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.superAdminProfiles.userId, userId)).returning();
        return result[0];
      }
      async getParentProfile(userId) {
        const result = await this.db.select().from(schema.parentProfiles).where(eq2(schema.parentProfiles.userId, userId)).limit(1);
        return result[0];
      }
      async createParentProfile(profile) {
        const result = await this.db.insert(schema.parentProfiles).values(profile).returning();
        return result[0];
      }
      async updateParentProfile(userId, profile) {
        const result = await this.db.update(schema.parentProfiles).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.parentProfiles.userId, userId)).returning();
        return result[0];
      }
      async calculateProfileCompletion(userId, roleId) {
        const user = await this.getUser(userId);
        if (!user) return 0;
        const requiredFields = [
          "firstName",
          "lastName",
          "email",
          "phone",
          "address",
          "dateOfBirth",
          "gender",
          "profileImageUrl",
          "state",
          "country",
          "securityQuestion",
          "securityAnswerHash",
          "dataPolicyAgreed"
        ];
        let completedFields = 0;
        requiredFields.forEach((field) => {
          if (user[field]) {
            completedFields++;
          }
        });
        if (roleId === 1) {
          const superAdminProfile = await this.getSuperAdminProfile(userId);
          if (superAdminProfile?.department) completedFields++;
          if (superAdminProfile?.accessLevel) completedFields++;
          if (superAdminProfile?.twoFactorEnabled !== void 0) completedFields++;
        } else if (roleId === 2) {
          const adminProfile = await this.getAdminProfile(userId);
          if (adminProfile?.department) completedFields++;
          if (adminProfile?.roleDescription) completedFields++;
          if (adminProfile?.accessLevel) completedFields++;
        } else if (roleId === 3) {
          const teacherProfile = await this.getTeacherProfile(userId);
          if (teacherProfile?.subjects && teacherProfile.subjects.length > 0) completedFields++;
          if (teacherProfile?.assignedClasses && teacherProfile.assignedClasses.length > 0) completedFields++;
          if (teacherProfile?.qualification) completedFields++;
          if (teacherProfile?.yearsOfExperience) completedFields++;
        } else if (roleId === 4) {
          const student = await this.getStudent(userId);
          if (student?.classId) completedFields++;
          if (student?.guardianName) completedFields++;
          if (student?.emergencyContact) completedFields++;
        } else if (roleId === 5) {
          const parentProfile = await this.getParentProfile(userId);
          if (parentProfile?.occupation) completedFields++;
          if (parentProfile?.contactPreference) completedFields++;
          if (parentProfile?.linkedStudents && parentProfile.linkedStudents.length > 0) completedFields++;
        }
        const totalFields = requiredFields.length + 3;
        return Math.round(completedFields / totalFields * 100);
      }
      // Student management
      async getStudent(id) {
        const result = await this.db.select({
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
          className: schema.classes.name
        }).from(schema.students).leftJoin(schema.users, eq2(schema.students.id, schema.users.id)).leftJoin(schema.classes, eq2(schema.students.classId, schema.classes.id)).where(eq2(schema.students.id, id)).limit(1);
        const student = result[0];
        if (student && student.id) {
          const normalizedId = normalizeUuid(student.id);
          if (normalizedId) {
            student.id = normalizedId;
          }
        }
        return student;
      }
      async getStudentByUserId(userId) {
        return this.getStudent(userId);
      }
      async getLinkedStudents(parentId) {
        const result = await this.db.select({
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
          className: schema.classes.name
        }).from(schema.students).leftJoin(schema.users, eq2(schema.students.id, schema.users.id)).leftJoin(schema.classes, eq2(schema.students.classId, schema.classes.id)).where(eq2(schema.students.parentId, parentId));
        return result.map((student) => {
          if (student && student.id) {
            const normalizedId = normalizeUuid(student.id);
            if (normalizedId) {
              student.id = normalizedId;
            }
          }
          return student;
        });
      }
      async getAllUsernames() {
        const result = await this.db.select({ username: schema.users.username }).from(schema.users).where(sql2`${schema.users.username} IS NOT NULL`);
        return result.map((r) => r.username).filter((u) => u !== null);
      }
      async createStudent(student) {
        const result = await db2.insert(schema.students).values(student).returning();
        return result[0];
      }
      async updateStudent(id, updates) {
        try {
          let updatedUser;
          let updatedStudent;
          if (updates.userPatch && Object.keys(updates.userPatch).length > 0) {
            const userResult = await this.db.update(schema.users).set(updates.userPatch).where(eq2(schema.users.id, id)).returning();
            updatedUser = userResult[0];
          } else {
            const userResult = await this.db.select().from(schema.users).where(eq2(schema.users.id, id)).limit(1);
            updatedUser = userResult[0];
          }
          if (updates.studentPatch && Object.keys(updates.studentPatch).length > 0) {
            const studentResult = await this.db.update(schema.students).set(updates.studentPatch).where(eq2(schema.students.id, id)).returning();
            updatedStudent = studentResult[0];
          } else {
            const studentResult = await this.db.select().from(schema.students).where(eq2(schema.students.id, id)).limit(1);
            updatedStudent = studentResult[0];
          }
          if (updatedUser && updatedStudent) {
            return { user: updatedUser, student: updatedStudent };
          }
          return void 0;
        } catch (error) {
          throw error;
        }
      }
      async setUserActive(id, isActive) {
        const result = await this.db.update(schema.users).set({ isActive }).where(eq2(schema.users.id, id)).returning();
        return result[0];
      }
      async deleteStudent(id, deletedBy) {
        const result = await this.db.update(schema.users).set({
          isActive: false,
          deletedAt: /* @__PURE__ */ new Date(),
          deletedBy: deletedBy || null
        }).where(eq2(schema.users.id, id)).returning();
        return result.length > 0;
      }
      async hardDeleteStudent(id) {
        try {
          const examSessions3 = await this.db.select({ id: schema.examSessions.id }).from(schema.examSessions).where(eq2(schema.examSessions.studentId, id));
          const sessionIds = examSessions3.map((session) => session.id);
          if (sessionIds.length > 0) {
            await this.db.delete(schema.studentAnswers).where(inArray2(schema.studentAnswers.sessionId, sessionIds));
          }
          await this.db.delete(schema.examSessions).where(eq2(schema.examSessions.studentId, id));
          await this.db.delete(schema.examResults).where(eq2(schema.examResults.studentId, id));
          await this.db.delete(schema.attendance).where(eq2(schema.attendance.studentId, id));
          await this.db.delete(schema.students).where(eq2(schema.students.id, id));
          const userResult = await this.db.delete(schema.users).where(eq2(schema.users.id, id)).returning();
          return userResult.length > 0;
        } catch (error) {
          throw error;
        }
      }
      async getStudentsByClass(classId) {
        return await db2.select().from(schema.students).where(eq2(schema.students.classId, classId));
      }
      async getAllStudents(includeInactive = false) {
        if (includeInactive) {
          return await this.db.select().from(schema.students).orderBy(asc(schema.students.createdAt));
        } else {
          return await this.db.select({
            id: schema.students.id,
            admissionNumber: schema.students.admissionNumber,
            classId: schema.students.classId,
            parentId: schema.students.parentId,
            admissionDate: schema.students.admissionDate,
            emergencyContact: schema.students.emergencyContact,
            medicalInfo: schema.students.medicalInfo,
            createdAt: schema.students.createdAt
          }).from(schema.students).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).where(eq2(schema.users.isActive, true)).orderBy(asc(schema.students.createdAt));
        }
      }
      async getStudentByAdmissionNumber(admissionNumber) {
        const result = await db2.select().from(schema.students).where(eq2(schema.students.admissionNumber, admissionNumber)).limit(1);
        return result[0];
      }
      // Class management
      async getClasses() {
        return await db2.select().from(schema.classes).where(eq2(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
      }
      async getAllClasses(includeInactive = false) {
        if (includeInactive) {
          return await db2.select().from(schema.classes).orderBy(asc(schema.classes.name));
        } else {
          return await db2.select().from(schema.classes).where(eq2(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
        }
      }
      async getClass(id) {
        const result = await db2.select().from(schema.classes).where(eq2(schema.classes.id, id)).limit(1);
        return result[0];
      }
      async createClass(classData) {
        const result = await db2.insert(schema.classes).values(classData).returning();
        return result[0];
      }
      async updateClass(id, classData) {
        const result = await db2.update(schema.classes).set(classData).where(eq2(schema.classes.id, id)).returning();
        return result[0];
      }
      async deleteClass(id) {
        const result = await db2.delete(schema.classes).where(eq2(schema.classes.id, id));
        return result.length > 0;
      }
      // Subject management
      async getSubjects() {
        return await db2.select().from(schema.subjects).orderBy(asc(schema.subjects.name));
      }
      async getSubject(id) {
        const result = await db2.select().from(schema.subjects).where(eq2(schema.subjects.id, id)).limit(1);
        return result[0];
      }
      async createSubject(subject) {
        const result = await db2.insert(schema.subjects).values(subject).returning();
        return result[0];
      }
      async updateSubject(id, subject) {
        const result = await db2.update(schema.subjects).set(subject).where(eq2(schema.subjects.id, id)).returning();
        return result[0];
      }
      async deleteSubject(id) {
        const result = await db2.delete(schema.subjects).where(eq2(schema.subjects.id, id));
        return result.length > 0;
      }
      // Academic terms
      async getCurrentTerm() {
        const result = await db2.select().from(schema.academicTerms).where(eq2(schema.academicTerms.isCurrent, true)).limit(1);
        return result[0];
      }
      async getTerms() {
        return await db2.select().from(schema.academicTerms).orderBy(desc(schema.academicTerms.startDate));
      }
      async getAcademicTerms() {
        try {
          const terms = await db2.select().from(schema.academicTerms).orderBy(desc(schema.academicTerms.startDate));
          return terms;
        } catch (error) {
          throw error;
        }
      }
      async getAcademicTerm(id) {
        try {
          const result = await db2.select().from(schema.academicTerms).where(eq2(schema.academicTerms.id, id)).limit(1);
          return result[0];
        } catch (error) {
          throw error;
        }
      }
      async createAcademicTerm(term) {
        try {
          const result = await db2.insert(schema.academicTerms).values(term).returning();
          return result[0];
        } catch (error) {
          throw error;
        }
      }
      async updateAcademicTerm(id, term) {
        try {
          const result = await db2.update(schema.academicTerms).set(term).where(eq2(schema.academicTerms.id, id)).returning();
          if (result[0]) {
          }
          return result[0];
        } catch (error) {
          throw error;
        }
      }
      async deleteAcademicTerm(id) {
        try {
          const existingTerm = await db2.select().from(schema.academicTerms).where(eq2(schema.academicTerms.id, id)).limit(1);
          if (!existingTerm || existingTerm.length === 0) {
            return false;
          }
          const examsUsingTerm = await db2.select({ id: schema.exams.id }).from(schema.exams).where(eq2(schema.exams.termId, id));
          if (examsUsingTerm && examsUsingTerm.length > 0) {
            throw new Error(`Cannot delete this term. ${examsUsingTerm.length} exam(s) are linked to it. Please reassign or delete those exams first.`);
          }
          const result = await db2.delete(schema.academicTerms).where(eq2(schema.academicTerms.id, id)).returning();
          const success = result && result.length > 0;
          if (success) {
          } else {
          }
          return success;
        } catch (error) {
          if (error?.code === "23503") {
            throw new Error("Cannot delete this term because it is being used by other records (exams, classes, etc.). Please remove those associations first.");
          }
          throw error;
        }
      }
      async markTermAsCurrent(id) {
        try {
          await db2.update(schema.academicTerms).set({ isCurrent: false });
          const result = await db2.update(schema.academicTerms).set({ isCurrent: true }).where(eq2(schema.academicTerms.id, id)).returning();
          if (result[0]) {
          }
          return result[0];
        } catch (error) {
          throw error;
        }
      }
      // Helper method to check if a term is being used
      async getExamsByTerm(termId) {
        try {
          const result = await db2.select().from(schema.exams).where(eq2(schema.exams.termId, termId));
          return result;
        } catch (error) {
          return [];
        }
      }
      // Attendance management
      async recordAttendance(attendance3) {
        const result = await db2.insert(schema.attendance).values(attendance3).returning();
        return result[0];
      }
      async getAttendanceByStudent(studentId, date) {
        if (date) {
          return await db2.select().from(schema.attendance).where(and2(eq2(schema.attendance.studentId, studentId), eq2(schema.attendance.date, date)));
        }
        return await db2.select().from(schema.attendance).where(eq2(schema.attendance.studentId, studentId)).orderBy(desc(schema.attendance.date));
      }
      async getAttendanceByClass(classId, date) {
        return await db2.select().from(schema.attendance).where(and2(eq2(schema.attendance.classId, classId), eq2(schema.attendance.date, date)));
      }
      // Exam management
      async createExam(exam) {
        const result = await db2.insert(schema.exams).values(exam).returning();
        return result[0];
      }
      async getAllExams() {
        try {
          const result = await db2.select().from(schema.exams).orderBy(desc(schema.exams.date));
          return result || [];
        } catch (error) {
          return [];
        }
      }
      async getExamById(id) {
        const result = await db2.select().from(schema.exams).where(eq2(schema.exams.id, id)).limit(1);
        return result[0];
      }
      async getExamsByClass(classId) {
        try {
          const result = await db2.select().from(schema.exams).where(eq2(schema.exams.classId, classId)).orderBy(desc(schema.exams.date));
          return result || [];
        } catch (error) {
          return [];
        }
      }
      async getExamsByClassAndTerm(classId, termId) {
        try {
          const result = await db2.select().from(schema.exams).where(and2(
            eq2(schema.exams.classId, classId),
            eq2(schema.exams.termId, termId)
          )).orderBy(desc(schema.exams.date));
          return result || [];
        } catch (error) {
          return [];
        }
      }
      async updateExam(id, exam) {
        const result = await db2.update(schema.exams).set(exam).where(eq2(schema.exams.id, id)).returning();
        return result[0];
      }
      async deleteExam(id) {
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
          const examQuestions3 = await db2.select({
            id: schema.examQuestions.id,
            imageUrl: schema.examQuestions.imageUrl
          }).from(schema.examQuestions).where(eq2(schema.examQuestions.examId, id));
          const questionIds = examQuestions3.map((q) => q.id);
          deletedCounts.questions = questionIds.length;
          for (const question of examQuestions3) {
            if (question.imageUrl) {
              try {
                const deleted = await deleteFile(question.imageUrl);
                if (deleted) deletedCounts.filesDeleted++;
              } catch (fileError) {
                console.error(`[SmartDeletion] Error deleting question image for question ${question.id}:`, fileError);
              }
            }
          }
          let optionCount = 0;
          if (questionIds.length > 0) {
            try {
              const questionOptions3 = await db2.select({
                id: schema.questionOptions.id,
                imageUrl: schema.questionOptions.imageUrl
              }).from(schema.questionOptions).where(inArray2(schema.questionOptions.questionId, questionIds));
              optionCount = questionOptions3.length;
              for (const option of questionOptions3) {
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
              const optionCountResult = await db2.select({ id: schema.questionOptions.id }).from(schema.questionOptions).where(inArray2(schema.questionOptions.questionId, questionIds));
              optionCount = optionCountResult.length;
            }
          }
          deletedCounts.questionOptions = optionCount;
          const examSessions3 = await db2.select({ id: schema.examSessions.id }).from(schema.examSessions).where(eq2(schema.examSessions.examId, id));
          const sessionIds = examSessions3.map((s) => s.id);
          deletedCounts.sessions = sessionIds.length;
          if (sessionIds.length > 0) {
            const gradingTasksResult = await db2.delete(schema.gradingTasks).where(inArray2(schema.gradingTasks.sessionId, sessionIds)).returning();
            deletedCounts.gradingTasks = gradingTasksResult.length;
            const perfEventsResult = await db2.delete(schema.performanceEvents).where(inArray2(schema.performanceEvents.sessionId, sessionIds)).returning();
            deletedCounts.performanceEvents = perfEventsResult.length;
            const answersResult = await db2.delete(schema.studentAnswers).where(inArray2(schema.studentAnswers.sessionId, sessionIds)).returning();
            deletedCounts.studentAnswers = answersResult.length;
          }
          if (questionIds.length > 0) {
            const remainingAnswers = await db2.delete(schema.studentAnswers).where(inArray2(schema.studentAnswers.questionId, questionIds)).returning();
            deletedCounts.studentAnswers += remainingAnswers.length;
            await db2.delete(schema.questionOptions).where(inArray2(schema.questionOptions.questionId, questionIds));
            await db2.delete(schema.examQuestions).where(eq2(schema.examQuestions.examId, id));
          }
          const resultsResult = await db2.delete(schema.examResults).where(eq2(schema.examResults.examId, id)).returning();
          deletedCounts.results = resultsResult.length;
          await db2.delete(schema.examSessions).where(eq2(schema.examSessions.examId, id));
          const testExamRefs = await db2.update(schema.reportCardItems).set({ testExamId: null }).where(eq2(schema.reportCardItems.testExamId, id)).returning();
          const examExamRefs = await db2.update(schema.reportCardItems).set({ examExamId: null }).where(eq2(schema.reportCardItems.examExamId, id)).returning();
          deletedCounts.reportCardRefsCleared = testExamRefs.length + examExamRefs.length;
          const result = await db2.delete(schema.exams).where(eq2(schema.exams.id, id)).returning();
          const success = result.length > 0;
          console.log(`[SmartDeletion] Exam ${id} deletion complete:`, {
            success,
            deletedCounts
          });
          return { success, deletedCounts };
        } catch (error) {
          console.error("[SmartDeletion] Error deleting exam:", error);
          throw error;
        }
      }
      async recordExamResult(result) {
        try {
          const examResult = await db2.insert(schema.examResults).values(result).returning();
          return examResult[0];
        } catch (error) {
          if (error?.cause?.code === "42703" && error?.cause?.message?.includes("auto_scored")) {
            const { autoScored, ...resultWithoutAutoScored } = result;
            const compatibleResult = {
              ...resultWithoutAutoScored,
              marksObtained: result.score || 0
            };
            const examResult = await db2.insert(schema.examResults).values(compatibleResult).returning();
            return {
              ...examResult[0],
              autoScored: result.recordedBy === "00000000-0000-0000-0000-000000000001",
              score: examResult[0].marksObtained || 0
            };
          }
          throw error;
        }
      }
      async updateExamResult(id, result) {
        try {
          const updated = await db2.update(schema.examResults).set(result).where(eq2(schema.examResults.id, id)).returning();
          return updated[0];
        } catch (error) {
          if (error?.cause?.code === "42703" && error?.cause?.message?.includes("auto_scored")) {
            const { autoScored, ...resultWithoutAutoScored } = result;
            const compatibleResult = {
              ...resultWithoutAutoScored,
              marksObtained: result.score || 0
            };
            const updated = await db2.update(schema.examResults).set(compatibleResult).where(eq2(schema.examResults.id, id)).returning();
            return {
              ...updated[0],
              autoScored: result.recordedBy === "00000000-0000-0000-0000-000000000001",
              score: updated[0].marksObtained || 0
            };
          }
          throw error;
        }
      }
      async getExamResultsByStudent(studentId) {
        const SYSTEM_AUTO_SCORING_UUID = "00000000-0000-0000-0000-000000000001";
        console.log(`[getExamResultsByStudent] Fetching results for student: ${studentId}`);
        try {
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
            createdAt: schema.examResults.createdAt
          }).from(schema.examResults).where(eq2(schema.examResults.studentId, studentId)).orderBy(desc(schema.examResults.createdAt));
          console.log(`[getExamResultsByStudent] Primary query returned ${results.length} results`);
          const enrichedResults = await Promise.all(results.map(async (result) => {
            const finalScore = result.score ?? result.marksObtained ?? 0;
            let finalMaxScore = result.maxScore;
            if (finalMaxScore === null || finalMaxScore === void 0) {
              try {
                const exam = await this.db.select({ totalMarks: schema.exams.totalMarks }).from(schema.exams).where(eq2(schema.exams.id, result.examId)).limit(1);
                finalMaxScore = exam[0]?.totalMarks ?? 100;
              } catch (examLookupError) {
                console.warn(`[getExamResultsByStudent] Could not fetch exam totalMarks for examId ${result.examId}`);
                finalMaxScore = 100;
              }
            }
            const isAutoScored = result.autoScored ?? result.recordedBy === SYSTEM_AUTO_SCORING_UUID;
            return {
              ...result,
              score: finalScore,
              maxScore: finalMaxScore,
              autoScored: isAutoScored
            };
          }));
          return enrichedResults;
        } catch (primaryError) {
          console.error(`[getExamResultsByStudent] Primary query failed for student ${studentId}:`, primaryError?.message || primaryError);
          try {
            console.log(`[getExamResultsByStudent] Attempting fallback query...`);
            const fallbackResults = await this.db.select().from(schema.examResults).where(eq2(schema.examResults.studentId, studentId)).orderBy(desc(schema.examResults.createdAt));
            console.log(`[getExamResultsByStudent] Fallback query returned ${fallbackResults.length} results`);
            return fallbackResults.map((result) => ({
              id: result.id,
              examId: result.examId,
              studentId: result.studentId,
              score: result.score ?? result.marksObtained ?? 0,
              maxScore: result.maxScore ?? 100,
              marksObtained: result.marksObtained,
              grade: result.grade,
              remarks: result.remarks,
              autoScored: result.autoScored ?? result.recordedBy === SYSTEM_AUTO_SCORING_UUID,
              recordedBy: result.recordedBy,
              createdAt: result.createdAt
            }));
          } catch (fallbackError) {
            console.error(`[getExamResultsByStudent] CRITICAL: Fallback query also failed for student ${studentId}:`, fallbackError?.message || fallbackError);
            return [];
          }
        }
      }
      async getExamResultsByExam(examId) {
        try {
          return await db2.select().from(schema.examResults).where(eq2(schema.examResults.examId, examId)).orderBy(desc(schema.examResults.createdAt));
        } catch (error) {
          if (error?.cause?.code === "42703" && error?.cause?.message?.includes("column") && error?.cause?.message?.includes("does not exist")) {
            try {
              return await db2.select({
                id: schema.examResults.id,
                examId: schema.examResults.examId,
                studentId: schema.examResults.studentId,
                marksObtained: schema.examResults.marksObtained,
                // Use legacy field
                grade: schema.examResults.grade,
                remarks: schema.examResults.remarks,
                recordedBy: schema.examResults.recordedBy,
                createdAt: schema.examResults.createdAt,
                // Map marksObtained to score for compatibility
                score: schema.examResults.marksObtained,
                maxScore: dsql2`null`.as("maxScore"),
                // Since auto_scored column doesn't exist, determine from recordedBy
                autoScored: dsql2`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as("autoScored")
              }).from(schema.examResults).where(eq2(schema.examResults.examId, examId)).orderBy(desc(schema.examResults.createdAt));
            } catch (fallbackError) {
              return [];
            }
          }
          throw error;
        }
      }
      async getExamResultByExamAndStudent(examId, studentId) {
        const result = await db2.select().from(schema.examResults).where(
          sql2`${schema.examResults.examId} = ${examId} AND ${schema.examResults.studentId} = ${studentId}`
        ).limit(1);
        return result[0];
      }
      async getExamResultsByClass(classId) {
        try {
          const results = await db2.select({
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
            studentName: sql2`${schema.users.firstName} || ' ' || ${schema.users.lastName}`.as("studentName"),
            className: schema.classes.name,
            subjectName: schema.subjects.name
          }).from(schema.examResults).innerJoin(schema.exams, eq2(schema.examResults.examId, schema.exams.id)).innerJoin(schema.students, eq2(schema.examResults.studentId, schema.students.id)).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).leftJoin(schema.classes, eq2(schema.exams.classId, schema.classes.id)).leftJoin(schema.subjects, eq2(schema.exams.subjectId, schema.subjects.id)).where(eq2(schema.exams.classId, classId)).orderBy(desc(schema.examResults.createdAt));
          return results;
        } catch (error) {
          if (error?.cause?.code === "42703" && error?.cause?.message?.includes("column") && error?.cause?.message?.includes("does not exist")) {
            try {
              const results = await db2.select({
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
                maxScore: dsql2`null`.as("maxScore"),
                // Infer autoScored based on recordedBy
                autoScored: dsql2`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as("autoScored")
              }).from(schema.examResults).innerJoin(schema.exams, eq2(schema.examResults.examId, schema.exams.id)).where(eq2(schema.exams.classId, classId)).orderBy(desc(schema.examResults.createdAt));
              return results;
            } catch (fallbackError) {
              return [];
            }
          }
          throw error;
        }
      }
      // Exam questions management
      async createExamQuestion(question) {
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
          hintText: question.hintText
        };
        const result = await db2.insert(schema.examQuestions).values(questionData).returning();
        return result[0];
      }
      async createExamQuestionWithOptions(question, options) {
        try {
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
            hintText: question.hintText
          };
          const questionResult = await db2.insert(schema.examQuestions).values(questionData).returning();
          const createdQuestion = questionResult[0];
          if (Array.isArray(options) && options.length > 0) {
            for (let i = 0; i < options.length; i++) {
              const option = options[i];
              await db2.insert(schema.questionOptions).values({
                questionId: createdQuestion.id,
                optionText: option.optionText,
                orderNumber: i + 1,
                isCorrect: option.isCorrect
              });
              if (i < options.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
            }
          }
          return createdQuestion;
        } catch (error) {
          throw new Error(`Failed to create question with options: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
      async createExamQuestionsBulk(questionsData) {
        const createdQuestions = [];
        const errors = [];
        for (let i = 0; i < questionsData.length; i++) {
          const { question, options } = questionsData[i];
          try {
            const createdQuestion = await this.createExamQuestionWithOptions(question, options);
            createdQuestions.push(createdQuestion);
            if (i < questionsData.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
          } catch (error) {
            const errorMsg = `Question ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            if (error instanceof Error && (error.message.includes("circuit") || error.message.includes("breaker") || error.message.includes("pool") || error.message.includes("connection"))) {
              await new Promise((resolve) => setTimeout(resolve, 1e3));
            } else {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }
        return {
          created: createdQuestions.length,
          questions: createdQuestions,
          errors
        };
      }
      async getExamQuestions(examId) {
        return await db2.select({
          id: schema.examQuestions.id,
          examId: schema.examQuestions.examId,
          questionText: schema.examQuestions.questionText,
          questionType: schema.examQuestions.questionType,
          points: schema.examQuestions.points,
          orderNumber: schema.examQuestions.orderNumber,
          imageUrl: schema.examQuestions.imageUrl,
          createdAt: schema.examQuestions.createdAt
        }).from(schema.examQuestions).where(eq2(schema.examQuestions.examId, examId)).orderBy(asc(schema.examQuestions.orderNumber));
      }
      async getExamQuestionById(id) {
        const result = await db2.select({
          id: schema.examQuestions.id,
          examId: schema.examQuestions.examId,
          questionText: schema.examQuestions.questionText,
          questionType: schema.examQuestions.questionType,
          points: schema.examQuestions.points,
          orderNumber: schema.examQuestions.orderNumber,
          imageUrl: schema.examQuestions.imageUrl,
          createdAt: schema.examQuestions.createdAt
        }).from(schema.examQuestions).where(eq2(schema.examQuestions.id, id)).limit(1);
        return result[0];
      }
      async getExamQuestionCount(examId) {
        const result = await db2.select({ count: dsql2`count(*)` }).from(schema.examQuestions).where(eq2(schema.examQuestions.examId, examId));
        return Number(result[0]?.count || 0);
      }
      // Get question counts for multiple exams
      async getExamQuestionCounts(examIds) {
        const counts = {};
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
      async updateExamQuestion(id, question) {
        const result = await db2.update(schema.examQuestions).set(question).where(eq2(schema.examQuestions.id, id)).returning();
        return result[0];
      }
      async deleteExamQuestion(id) {
        try {
          const question = await db2.select({
            id: schema.examQuestions.id,
            imageUrl: schema.examQuestions.imageUrl
          }).from(schema.examQuestions).where(eq2(schema.examQuestions.id, id)).limit(1);
          if (question[0]?.imageUrl) {
            try {
              await deleteFile(question[0].imageUrl);
            } catch (fileError) {
              console.error(`Error deleting question image for question ${id}:`, fileError);
            }
          }
          try {
            const options = await db2.select({
              id: schema.questionOptions.id,
              imageUrl: schema.questionOptions.imageUrl
            }).from(schema.questionOptions).where(eq2(schema.questionOptions.questionId, id));
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
          }
          await db2.delete(schema.studentAnswers).where(eq2(schema.studentAnswers.questionId, id));
          await db2.delete(schema.questionOptions).where(eq2(schema.questionOptions.questionId, id));
          const result = await db2.delete(schema.examQuestions).where(eq2(schema.examQuestions.id, id)).returning();
          return result.length > 0;
        } catch (error) {
          console.error("Error deleting exam question:", error);
          throw error;
        }
      }
      // Question options management
      async createQuestionOption(option) {
        const result = await db2.insert(schema.questionOptions).values(option).returning();
        return result[0];
      }
      async getQuestionOptions(questionId) {
        return await db2.select({
          id: schema.questionOptions.id,
          questionId: schema.questionOptions.questionId,
          optionText: schema.questionOptions.optionText,
          isCorrect: schema.questionOptions.isCorrect,
          orderNumber: schema.questionOptions.orderNumber,
          createdAt: schema.questionOptions.createdAt
        }).from(schema.questionOptions).where(eq2(schema.questionOptions.questionId, questionId)).orderBy(asc(schema.questionOptions.orderNumber));
      }
      // PERFORMANCE: Bulk fetch question options to eliminate N+1 queries
      async getQuestionOptionsBulk(questionIds) {
        if (questionIds.length === 0) {
          return [];
        }
        return await db2.select({
          id: schema.questionOptions.id,
          questionId: schema.questionOptions.questionId,
          optionText: schema.questionOptions.optionText,
          isCorrect: schema.questionOptions.isCorrect,
          orderNumber: schema.questionOptions.orderNumber,
          createdAt: schema.questionOptions.createdAt
        }).from(schema.questionOptions).where(inArray2(schema.questionOptions.questionId, questionIds)).orderBy(asc(schema.questionOptions.questionId), asc(schema.questionOptions.orderNumber));
      }
      async deleteQuestionOptions(questionId) {
        try {
          const options = await db2.select({ id: schema.questionOptions.id }).from(schema.questionOptions).where(eq2(schema.questionOptions.questionId, questionId));
          const optionIds = options.map((o) => o.id).filter((id) => id != null);
          if (optionIds.length > 0) {
            await db2.update(schema.studentAnswers).set({ selectedOptionId: null }).where(inArray2(schema.studentAnswers.selectedOptionId, optionIds));
          }
          await db2.delete(schema.questionOptions).where(eq2(schema.questionOptions.questionId, questionId));
          return true;
        } catch (error) {
          console.error("Error deleting question options:", error);
          return false;
        }
      }
      // Question Bank management
      async createQuestionBank(bank) {
        const result = await db2.insert(schema.questionBanks).values(bank).returning();
        return result[0];
      }
      async getAllQuestionBanks() {
        return await db2.select().from(schema.questionBanks).orderBy(desc(schema.questionBanks.createdAt));
      }
      async getQuestionBankById(id) {
        const result = await db2.select().from(schema.questionBanks).where(eq2(schema.questionBanks.id, id));
        return result[0];
      }
      async getQuestionBanksBySubject(subjectId) {
        return await db2.select().from(schema.questionBanks).where(eq2(schema.questionBanks.subjectId, subjectId)).orderBy(desc(schema.questionBanks.createdAt));
      }
      async updateQuestionBank(id, bank) {
        const result = await db2.update(schema.questionBanks).set({ ...bank, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.questionBanks.id, id)).returning();
        return result[0];
      }
      async deleteQuestionBank(id) {
        await db2.delete(schema.questionBanks).where(eq2(schema.questionBanks.id, id));
        return true;
      }
      // Question Bank Items management
      async createQuestionBankItem(item, options) {
        const result = await db2.insert(schema.questionBankItems).values(item).returning();
        const questionItem = result[0];
        if (options && options.length > 0) {
          const optionValues = options.map((option) => ({
            questionItemId: questionItem.id,
            ...option
          }));
          await db2.insert(schema.questionBankOptions).values(optionValues);
        }
        return questionItem;
      }
      async getQuestionBankItems(bankId, filters) {
        let query = db2.select().from(schema.questionBankItems).where(eq2(schema.questionBankItems.bankId, bankId));
        if (filters?.questionType) {
          query = query.where(eq2(schema.questionBankItems.questionType, filters.questionType));
        }
        if (filters?.difficulty) {
          query = query.where(eq2(schema.questionBankItems.difficulty, filters.difficulty));
        }
        return await query.orderBy(desc(schema.questionBankItems.createdAt));
      }
      async getQuestionBankItemById(id) {
        const result = await db2.select().from(schema.questionBankItems).where(eq2(schema.questionBankItems.id, id));
        return result[0];
      }
      async updateQuestionBankItem(id, item) {
        const result = await db2.update(schema.questionBankItems).set({ ...item, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.questionBankItems.id, id)).returning();
        return result[0];
      }
      async deleteQuestionBankItem(id) {
        await db2.delete(schema.questionBankItems).where(eq2(schema.questionBankItems.id, id));
        return true;
      }
      async getQuestionBankItemOptions(questionItemId) {
        return await db2.select().from(schema.questionBankOptions).where(eq2(schema.questionBankOptions.questionItemId, questionItemId)).orderBy(asc(schema.questionBankOptions.orderNumber));
      }
      async importQuestionsFromBank(examId, questionItemIds, randomize = false, maxQuestions) {
        let selectedItemIds = [...questionItemIds];
        if (randomize && maxQuestions && maxQuestions < questionItemIds.length) {
          selectedItemIds = questionItemIds.sort(() => Math.random() - 0.5).slice(0, maxQuestions);
        }
        const questions = [];
        const existingQuestionsCount = await this.getExamQuestionCount(examId);
        let orderNumber = existingQuestionsCount + 1;
        for (const itemId of selectedItemIds) {
          const bankItem = await this.getQuestionBankItemById(itemId);
          if (!bankItem) continue;
          const validTypes = ["multiple_choice", "text", "essay", "true_false", "fill_blank"];
          const questionType = validTypes.includes(bankItem.questionType) ? bankItem.questionType : "text";
          let expectedAnswersArray = void 0;
          if (bankItem.expectedAnswers) {
            if (Array.isArray(bankItem.expectedAnswers)) {
              expectedAnswersArray = bankItem.expectedAnswers;
            } else if (typeof bankItem.expectedAnswers === "string") {
              try {
                const parsed = JSON.parse(bankItem.expectedAnswers);
                expectedAnswersArray = Array.isArray(parsed) ? parsed : [bankItem.expectedAnswers];
              } catch {
                expectedAnswersArray = bankItem.expectedAnswers.split(",").map((s) => s.trim()).filter(Boolean);
              }
            }
          }
          const questionData = {
            examId,
            questionText: bankItem.questionText,
            questionType,
            points: bankItem.points || 1,
            orderNumber: orderNumber++,
            imageUrl: bankItem.imageUrl ?? void 0,
            autoGradable: bankItem.autoGradable,
            expectedAnswers: expectedAnswersArray,
            caseSensitive: bankItem.caseSensitive ?? void 0,
            explanationText: bankItem.explanationText ?? void 0,
            hintText: bankItem.hintText ?? void 0
          };
          const question = await this.createExamQuestion(questionData);
          questions.push(question);
          if (bankItem.questionType === "multiple_choice") {
            const bankOptions = await this.getQuestionBankItemOptions(itemId);
            for (const bankOption of bankOptions) {
              await this.createQuestionOption({
                questionId: question.id,
                optionText: bankOption.optionText,
                isCorrect: bankOption.isCorrect,
                orderNumber: bankOption.orderNumber,
                partialCreditValue: 0,
                explanationText: bankOption.explanationText ?? void 0
              });
            }
          }
        }
        return { imported: questions.length, questions };
      }
      // Get AI-suggested grading tasks for teacher review
      async getAISuggestedGradingTasks(teacherId, status) {
        try {
          const assignments = await this.db.select().from(schema.teacherClassAssignments).where(and2(
            eq2(schema.teacherClassAssignments.teacherId, teacherId),
            eq2(schema.teacherClassAssignments.isActive, true)
          ));
          if (assignments.length === 0) {
            return [];
          }
          const classIds = assignments.map((a) => a.classId);
          const subjectIds = assignments.map((a) => a.subjectId);
          const exams3 = await this.db.select().from(schema.exams).where(and2(
            inArray2(schema.exams.classId, classIds),
            inArray2(schema.exams.subjectId, subjectIds)
          ));
          const examIds = exams3.map((e) => e.id);
          if (examIds.length === 0) {
            return [];
          }
          const sessions = await this.db.select().from(schema.examSessions).where(and2(
            inArray2(schema.examSessions.examId, examIds),
            eq2(schema.examSessions.isCompleted, true)
          ));
          const sessionIds = sessions.map((s) => s.id);
          if (sessionIds.length === 0) {
            return [];
          }
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
          }).from(schema.studentAnswers).innerJoin(schema.examQuestions, eq2(schema.studentAnswers.questionId, schema.examQuestions.id)).innerJoin(schema.examSessions, eq2(schema.studentAnswers.sessionId, schema.examSessions.id)).innerJoin(schema.exams, eq2(schema.examSessions.examId, schema.exams.id)).where(and2(
            inArray2(schema.studentAnswers.sessionId, sessionIds),
            sql2`(${schema.examQuestions.questionType} = 'text' OR ${schema.examQuestions.questionType} = 'essay')`,
            sql2`${schema.studentAnswers.textAnswer} IS NOT NULL`
          ));
          if (status === "pending") {
            query = query.where(sql2`${schema.studentAnswers.autoScored} = false AND ${schema.studentAnswers.manualOverride} = false`);
          } else if (status === "reviewed") {
            query = query.where(sql2`(${schema.studentAnswers.autoScored} = true OR ${schema.studentAnswers.manualOverride} = true)`);
          }
          const results = await query;
          const studentIds = Array.from(new Set(results.map((r) => r.studentId)));
          const students3 = await this.db.select({
            id: schema.users.id,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName
          }).from(schema.users).where(inArray2(schema.users.id, studentIds));
          return results.map((r) => ({
            ...r,
            studentName: `${students3.find((s) => s.id === r.studentId)?.firstName} ${students3.find((s) => s.id === r.studentId)?.lastName}`,
            status: r.autoScored || r.manualOverride ? "reviewed" : "pending",
            aiSuggested: r.pointsEarned > 0 && !r.autoScored && !r.manualOverride
          }));
        } catch (error) {
          return [];
        }
      }
      // Exam sessions management
      async createExamSession(session) {
        const result = await db2.insert(schema.examSessions).values(session).returning();
        return result[0];
      }
      async getExamSessionById(id) {
        const result = await db2.select({
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
        }).from(schema.examSessions).where(eq2(schema.examSessions.id, id)).limit(1);
        return result[0];
      }
      async getExamSessionsByExam(examId) {
        return await db2.select({
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
        }).from(schema.examSessions).where(eq2(schema.examSessions.examId, examId)).orderBy(desc(schema.examSessions.startedAt));
      }
      async getExamSessionsByStudent(studentId) {
        return await db2.select({
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
        }).from(schema.examSessions).where(eq2(schema.examSessions.studentId, studentId)).orderBy(desc(schema.examSessions.startedAt));
      }
      async updateExamSession(id, session) {
        const allowedFields = {};
        const existingColumns = ["examId", "studentId", "startedAt", "submittedAt", "timeRemaining", "isCompleted", "score", "maxScore", "status", "metadata"];
        for (const [key, value] of Object.entries(session)) {
          if (existingColumns.includes(key) && value !== void 0) {
            allowedFields[key] = value;
          }
        }
        const result = await db2.update(schema.examSessions).set(allowedFields).where(eq2(schema.examSessions.id, id)).returning({
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
      async deleteExamSession(id) {
        const result = await db2.delete(schema.examSessions).where(eq2(schema.examSessions.id, id));
        return result.length > 0;
      }
      async getActiveExamSession(examId, studentId) {
        const result = await db2.select().from(schema.examSessions).where(and2(
          eq2(schema.examSessions.examId, examId),
          eq2(schema.examSessions.studentId, studentId),
          eq2(schema.examSessions.isCompleted, false)
        )).limit(1);
        return result[0];
      }
      // Get all active exam sessions for background cleanup service
      async getActiveExamSessions() {
        return await db2.select({
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
        }).from(schema.examSessions).where(eq2(schema.examSessions.isCompleted, false)).orderBy(desc(schema.examSessions.startedAt));
      }
      // PERFORMANCE: Get only expired sessions directly from database
      async getExpiredExamSessions(now, limit = 100) {
        return await db2.select({
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
        }).from(schema.examSessions).where(and2(
          eq2(schema.examSessions.isCompleted, false),
          // Fallback: Use startedAt + reasonable timeout estimate for expired sessions
          dsql2`${schema.examSessions.startedAt} + interval '2 hours' < ${now.toISOString()}`
        )).orderBy(asc(schema.examSessions.startedAt)).limit(limit);
      }
      // CIRCUIT BREAKER FIX: Idempotent session creation using UPSERT to prevent connection pool exhaustion
      async createOrGetActiveExamSession(examId, studentId, sessionData) {
        try {
          const insertResult = await db2.insert(schema.examSessions).values({
            examId: sessionData.examId,
            studentId,
            startedAt: /* @__PURE__ */ new Date(),
            timeRemaining: sessionData.timeRemaining,
            isCompleted: false,
            status: "in_progress"
          }).onConflictDoNothing().returning({
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
          if (insertResult.length > 0) {
            return { ...insertResult[0], wasCreated: true };
          }
          const existingSession = await db2.select({
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
          }).from(schema.examSessions).where(and2(
            eq2(schema.examSessions.examId, examId),
            eq2(schema.examSessions.studentId, studentId),
            eq2(schema.examSessions.isCompleted, false)
          )).limit(1);
          if (existingSession.length > 0) {
            return { ...existingSession[0], wasCreated: false };
          }
          throw new Error(`Unable to create or retrieve exam session for student ${studentId} exam ${examId}`);
        } catch (error) {
          throw error;
        }
      }
      // Exam retake management - allows teacher to reset student exam for retake
      // Uses a transaction to ensure atomic operation - either all changes succeed or all roll back
      async allowExamRetake(examId, studentId, archivedBy) {
        try {
          console.log(`[allowExamRetake] Starting retake process for exam ${examId}, student ${studentId}`);
          const existingResult = await this.getExamResultByExamAndStudent(examId, studentId);
          if (!existingResult) {
            return { success: false, message: "No exam submission found for this student" };
          }
          const sessions = await db2.select().from(schema.examSessions).where(and2(
            eq2(schema.examSessions.examId, examId),
            eq2(schema.examSessions.studentId, studentId)
          ));
          let studentAnswers3 = [];
          for (const session of sessions) {
            const answers = await this.getStudentAnswers(session.id);
            studentAnswers3 = [...studentAnswers3, ...answers];
          }
          const result = await db2.transaction(async (tx) => {
            const archivedSubmission = await tx.insert(schema.examSubmissionsArchive).values({
              examId,
              studentId,
              originalResultId: existingResult.id,
              originalSessionId: sessions[0]?.id || null,
              score: existingResult.score || existingResult.marksObtained || 0,
              maxScore: existingResult.maxScore || 100,
              grade: existingResult.grade || null,
              remarks: existingResult.remarks || null,
              answersSnapshot: JSON.stringify(studentAnswers3),
              archivedBy,
              archiveReason: "Teacher allowed retake",
              archivedAt: /* @__PURE__ */ new Date()
            }).returning();
            console.log(`[allowExamRetake] Archived submission ID: ${archivedSubmission[0]?.id}`);
            for (const session of sessions) {
              await tx.delete(schema.studentAnswers).where(eq2(schema.studentAnswers.sessionId, session.id));
              console.log(`[allowExamRetake] Deleted answers for session ${session.id}`);
            }
            await tx.delete(schema.examSessions).where(and2(
              eq2(schema.examSessions.examId, examId),
              eq2(schema.examSessions.studentId, studentId)
            ));
            console.log(`[allowExamRetake] Deleted ${sessions.length} sessions`);
            await tx.delete(schema.examResults).where(eq2(schema.examResults.id, existingResult.id));
            console.log(`[allowExamRetake] Deleted exam result ${existingResult.id}`);
            return { archivedSubmissionId: archivedSubmission[0]?.id };
          });
          return {
            success: true,
            message: "Student can now retake the exam. Previous submission has been archived.",
            archivedSubmissionId: result.archivedSubmissionId
          };
        } catch (error) {
          console.error("[allowExamRetake] Error (transaction rolled back):", error);
          return { success: false, message: `Failed to allow retake: ${error.message}` };
        }
      }
      async getExamResultById(id) {
        const result = await db2.select().from(schema.examResults).where(eq2(schema.examResults.id, id)).limit(1);
        return result[0];
      }
      // Enhanced session management for students
      async getStudentActiveSession(studentId) {
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
        }).from(schema.examSessions).where(and2(
          eq2(schema.examSessions.studentId, studentId),
          eq2(schema.examSessions.isCompleted, false)
        )).orderBy(desc(schema.examSessions.createdAt)).limit(1);
        return result[0];
      }
      async updateSessionProgress(sessionId, progress) {
        const updates = {};
        if (typeof progress.timeRemaining === "number") {
          updates.timeRemaining = progress.timeRemaining;
        }
        if (typeof progress.currentQuestionIndex === "number") {
          updates.metadata = JSON.stringify({ currentQuestionIndex: progress.currentQuestionIndex });
        }
        if (Object.keys(updates).length > 0) {
          await this.db.update(schema.examSessions).set(updates).where(eq2(schema.examSessions.id, sessionId));
        }
      }
      // Student answers management
      async createStudentAnswer(answer) {
        const result = await db2.insert(schema.studentAnswers).values(answer).returning();
        return result[0];
      }
      async getStudentAnswers(sessionId) {
        return await db2.select().from(schema.studentAnswers).where(eq2(schema.studentAnswers.sessionId, sessionId)).orderBy(asc(schema.studentAnswers.answeredAt));
      }
      async getStudentAnswerById(id) {
        const result = await db2.select().from(schema.studentAnswers).where(eq2(schema.studentAnswers.id, id)).limit(1);
        return result[0];
      }
      async updateStudentAnswer(id, answer) {
        const result = await db2.update(schema.studentAnswers).set(answer).where(eq2(schema.studentAnswers.id, id)).returning();
        return result[0];
      }
      async getStudentAnswerBySessionAndQuestion(sessionId, questionId) {
        const result = await db2.select().from(schema.studentAnswers).where(and2(
          eq2(schema.studentAnswers.sessionId, sessionId),
          eq2(schema.studentAnswers.questionId, questionId)
        )).limit(1);
        return result[0];
      }
      async upsertStudentAnswer(sessionId, questionId, answer) {
        const existing = await this.getStudentAnswerBySessionAndQuestion(sessionId, questionId);
        if (existing) {
          const updated = await this.updateStudentAnswer(existing.id, answer);
          return updated;
        } else {
          return await this.createStudentAnswer({
            sessionId,
            questionId,
            ...answer
          });
        }
      }
      async getQuestionOptionById(optionId) {
        const result = await db2.select().from(schema.questionOptions).where(eq2(schema.questionOptions.id, optionId)).limit(1);
        return result[0];
      }
      // OPTIMIZED SCORING: Get all scoring data in a single query for <2s performance
      async getExamScoringData(sessionId) {
        try {
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
          }).from(schema.examSessions).where(eq2(schema.examSessions.id, sessionId)).limit(1);
          if (!sessionResult[0]) {
            throw new Error(`Exam session ${sessionId} not found`);
          }
          const session = sessionResult[0];
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
            textAnswer: schema.studentAnswers.textAnswer
          }).from(schema.examQuestions).leftJoin(schema.studentAnswers, and2(
            eq2(schema.studentAnswers.questionId, schema.examQuestions.id),
            eq2(schema.studentAnswers.sessionId, sessionId)
          )).where(eq2(schema.examQuestions.examId, session.examId)).orderBy(asc(schema.examQuestions.orderNumber));
          const correctOptionsQuery = await this.db.select({
            questionId: schema.questionOptions.questionId,
            correctOptionId: schema.questionOptions.id
          }).from(schema.questionOptions).innerJoin(schema.examQuestions, eq2(schema.questionOptions.questionId, schema.examQuestions.id)).where(
            and2(
              eq2(schema.examQuestions.examId, session.examId),
              eq2(schema.questionOptions.isCorrect, true)
            )
          );
          const selectedOptionsQuery = await this.db.select({
            questionId: schema.questionOptions.questionId,
            optionId: schema.questionOptions.id,
            partialCreditValue: schema.questionOptions.partialCreditValue,
            isCorrect: schema.questionOptions.isCorrect
          }).from(schema.questionOptions).innerJoin(schema.studentAnswers, eq2(schema.questionOptions.id, schema.studentAnswers.selectedOptionId)).where(eq2(schema.studentAnswers.sessionId, sessionId));
          const correctOptionsMap = /* @__PURE__ */ new Map();
          for (const option of correctOptionsQuery) {
            correctOptionsMap.set(option.questionId, option.correctOptionId);
          }
          const selectedOptionsMap = /* @__PURE__ */ new Map();
          for (const option of selectedOptionsQuery) {
            selectedOptionsMap.set(option.questionId, {
              optionId: option.optionId,
              partialCreditValue: option.partialCreditValue,
              isCorrect: option.isCorrect
            });
          }
          const questionMap = /* @__PURE__ */ new Map();
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
              partialCreditEarned: 0
            });
            if ((question.questionType === "multiple_choice" || question.questionType === "true_false" || question.questionType === "true/false") && correctOptionId && question.studentSelectedOptionId === correctOptionId) {
              questionMap.get(question.questionId).isCorrect = true;
            }
            if (question.allowPartialCredit && selectedOptionData && selectedOptionData.partialCreditValue) {
              const questionData = questionMap.get(question.questionId);
              if (!questionData.isCorrect && selectedOptionData.partialCreditValue > 0) {
                questionData.partialCreditEarned = Math.min(
                  questionData.points,
                  selectedOptionData.partialCreditValue
                );
              }
            }
          }
          for (const [questionId, question] of Array.from(questionMap.entries())) {
            if (!question.autoGradable) continue;
            if ((question.questionType === "text" || question.questionType === "fill_blank") && question.expectedAnswers && question.textAnswer) {
              const studentAnswer = question.textAnswer.trim();
              if (!studentAnswer) continue;
              for (const expectedAnswer of question.expectedAnswers) {
                const normalizedExpected = question.caseSensitive ? expectedAnswer.trim() : expectedAnswer.trim().toLowerCase();
                const normalizedStudent = question.caseSensitive ? studentAnswer : studentAnswer.toLowerCase();
                if (normalizedStudent === normalizedExpected) {
                  question.isCorrect = true;
                  break;
                }
                if (question.allowPartialCredit && !question.isCorrect) {
                  const similarity = this.calculateTextSimilarity(normalizedStudent, normalizedExpected);
                  try {
                    const partialRules = question.partialCreditRules ? JSON.parse(question.partialCreditRules) : { minSimilarity: 0.8, partialPercentage: 0.5 };
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
          const scoringData = Array.from(questionMap.entries()).map(([questionId, data]) => ({
            questionId,
            ...data
          }));
          let totalQuestions = scoringData.length;
          let maxScore = 0;
          let studentScore = 0;
          let autoScoredQuestions = 0;
          const questionTypeCount = {};
          for (const question of scoringData) {
            maxScore += question.points;
            questionTypeCount[question.questionType] = (questionTypeCount[question.questionType] || 0) + 1;
            if (question.autoGradable === true) {
              autoScoredQuestions++;
              if (question.isCorrect) {
                studentScore += question.points;
              } else if (question.partialCreditEarned > 0) {
                studentScore += question.partialCreditEarned;
              } else {
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
              autoScoredQuestions
            }
          };
        } catch (error) {
          throw error;
        }
      }
      // Text similarity calculation for partial credit scoring
      calculateTextSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 1;
        const editDistance = this.getEditDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
      }
      getEditDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
          for (let i = 1; i <= str1.length; i++) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
              matrix[j][i - 1] + 1,
              // deletion
              matrix[j - 1][i] + 1,
              // insertion
              matrix[j - 1][i - 1] + indicator
              // substitution
            );
          }
        }
        return matrix[str2.length][str1.length];
      }
      // Announcements
      async createAnnouncement(announcement) {
        const result = await db2.insert(schema.announcements).values(announcement).returning();
        return result[0];
      }
      async getAnnouncements(targetRole, includeDrafts = false) {
        let query = db2.select().from(schema.announcements);
        if (!includeDrafts) {
          query = query.where(eq2(schema.announcements.isPublished, true));
        }
        if (targetRole && targetRole !== "all") {
          query = query.where(or2(
            like(schema.announcements.targetRoles, `%"All"%`),
            like(schema.announcements.targetRoles, `%"${targetRole}"%`),
            eq2(schema.announcements.targetRoles, '["All"]'),
            eq2(schema.announcements.targetRoles, `["${targetRole}"]`)
          ));
        }
        return await query.orderBy(desc(schema.announcements.publishedAt), desc(schema.announcements.createdAt));
      }
      async getAnnouncementById(id) {
        const result = await db2.select().from(schema.announcements).where(eq2(schema.announcements.id, id)).limit(1);
        return result[0];
      }
      async updateAnnouncement(id, announcement) {
        const result = await db2.update(schema.announcements).set(announcement).where(eq2(schema.announcements.id, id)).returning();
        return result[0];
      }
      async deleteAnnouncement(id) {
        const [announcement] = await db2.select().from(schema.announcements).where(eq2(schema.announcements.id, id));
        if (!announcement) return false;
        await db2.delete(schema.announcements).where(eq2(schema.announcements.id, id));
        realtimeService.emitAnnouncementEvent("deleted", { id });
        return true;
      }
      // Messages
      async sendMessage(message) {
        const result = await db2.insert(schema.messages).values(message).returning();
        return result[0];
      }
      async getMessagesByUser(userId) {
        return await db2.select().from(schema.messages).where(eq2(schema.messages.recipientId, userId)).orderBy(desc(schema.messages.createdAt));
      }
      async markMessageAsRead(id) {
        await db2.update(schema.messages).set({ isRead: true }).where(eq2(schema.messages.id, id));
      }
      // Gallery
      async createGalleryCategory(category) {
        const result = await db2.insert(schema.galleryCategories).values(category).returning();
        return result[0];
      }
      async getGalleryCategories() {
        return await db2.select().from(schema.galleryCategories).orderBy(asc(schema.galleryCategories.name));
      }
      async uploadGalleryImage(image) {
        const result = await db2.insert(schema.gallery).values(image).returning();
        return result[0];
      }
      async getGalleryImages(categoryId) {
        if (categoryId) {
          return await db2.select().from(schema.gallery).where(eq2(schema.gallery.categoryId, categoryId)).orderBy(desc(schema.gallery.createdAt));
        }
        return await db2.select().from(schema.gallery).orderBy(desc(schema.gallery.createdAt));
      }
      async getGalleryImageById(id) {
        const result = await db2.select().from(schema.gallery).where(eq2(schema.gallery.id, parseInt(id))).limit(1);
        return result[0];
      }
      async deleteGalleryImage(id) {
        const image = await db2.select({ id: schema.gallery.id, imageUrl: schema.gallery.imageUrl }).from(schema.gallery).where(eq2(schema.gallery.id, parseInt(id))).limit(1);
        if (image[0]?.imageUrl) {
          try {
            await deleteFile(image[0].imageUrl);
          } catch (fileError) {
            console.error(`Error deleting gallery image file for image ${id}:`, fileError);
          }
        }
        const result = await db2.delete(schema.gallery).where(eq2(schema.gallery.id, parseInt(id))).returning();
        return result.length > 0;
      }
      // Study resources management
      async createStudyResource(resource) {
        const result = await db2.insert(schema.studyResources).values(resource).returning();
        return result[0];
      }
      async getStudyResources(filters) {
        let query = db2.select().from(schema.studyResources).where(eq2(schema.studyResources.isPublished, true));
        if (filters?.classId) {
          query = query.where(eq2(schema.studyResources.classId, filters.classId));
        }
        if (filters?.subjectId) {
          query = query.where(eq2(schema.studyResources.subjectId, filters.subjectId));
        }
        if (filters?.termId) {
          query = query.where(eq2(schema.studyResources.termId, filters.termId));
        }
        if (filters?.resourceType) {
          query = query.where(eq2(schema.studyResources.resourceType, filters.resourceType));
        }
        return await query.orderBy(desc(schema.studyResources.createdAt));
      }
      async getStudyResourceById(id) {
        const result = await db2.select().from(schema.studyResources).where(eq2(schema.studyResources.id, id)).limit(1);
        return result[0];
      }
      async incrementStudyResourceDownloads(id) {
        await db2.update(schema.studyResources).set({ downloads: dsql2`${schema.studyResources.downloads} + 1` }).where(eq2(schema.studyResources.id, id));
      }
      async deleteStudyResource(id) {
        const resource = await db2.select({ id: schema.studyResources.id, fileUrl: schema.studyResources.fileUrl }).from(schema.studyResources).where(eq2(schema.studyResources.id, id)).limit(1);
        if (resource[0]?.fileUrl) {
          try {
            await deleteFile(resource[0].fileUrl);
          } catch (fileError) {
            console.error(`Error deleting study resource file for resource ${id}:`, fileError);
          }
        }
        const result = await db2.delete(schema.studyResources).where(eq2(schema.studyResources.id, id)).returning();
        return result.length > 0;
      }
      // Home page content management
      async createHomePageContent(content) {
        const result = await db2.insert(schema.homePageContent).values(content).returning();
        return result[0];
      }
      // Manual Grading System Methods
      async getGradingTasks(teacherId, status) {
        try {
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
            if (status && status !== "all") {
              if (status === "pending") {
                query += " AND sa.id NOT IN (SELECT answer_id FROM manual_scores)";
              } else if (status === "graded") {
                query += " AND sa.id IN (SELECT answer_id FROM manual_scores)";
              }
            }
            query += " ORDER BY es.submitted_at DESC";
            const result = await pgClient.unsafe(query, [teacherId]);
            return result;
          }
          return [];
        } catch (error) {
          console.error("Error fetching grading tasks:", error);
          return [];
        }
      }
      async submitManualGrade(gradeData) {
        try {
          const { taskId, score, comment, graderId } = gradeData;
          if (isPostgres) {
            const pgClient = getPgClient();
            if (!pgClient) throw new Error("PostgreSQL client not available");
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
            await pgClient`
          UPDATE student_answers
          SET points_earned = ${score}
          WHERE id = ${taskId}
        `;
            const rows = result;
            return rows.length > 0 ? rows[0] : null;
          }
          throw new Error("PostgreSQL client not available");
        } catch (error) {
          throw error;
        }
      }
      async getAllExamSessions() {
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
            return result;
          }
          return [];
        } catch (error) {
          console.error("Error fetching exam sessions:", error);
          return [];
        }
      }
      async getExamReports(filters) {
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
            const params = [];
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
            const result = await pgClient.unsafe(query, params);
            return result;
          }
          return [];
        } catch (error) {
          console.error("Error fetching exam reports:", error);
          return [];
        }
      }
      async getExamStudentReports(examId) {
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
            return result;
          }
          return [];
        } catch (error) {
          console.error("Error fetching exam student reports:", error);
          return [];
        }
      }
      // Home page content management
      async getHomePageContent(contentType) {
        if (contentType) {
          return await db2.select().from(schema.homePageContent).where(and2(eq2(schema.homePageContent.contentType, contentType), eq2(schema.homePageContent.isActive, true))).orderBy(asc(schema.homePageContent.displayOrder));
        }
        return await db2.select().from(schema.homePageContent).where(eq2(schema.homePageContent.isActive, true)).orderBy(asc(schema.homePageContent.displayOrder), asc(schema.homePageContent.contentType));
      }
      async getHomePageContentById(id) {
        const result = await db2.select().from(schema.homePageContent).where(eq2(schema.homePageContent.id, id)).limit(1);
        return result[0];
      }
      async updateHomePageContent(id, content) {
        const result = await db2.update(schema.homePageContent).set({ ...content, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.homePageContent.id, id)).returning();
        return result[0];
      }
      async deleteHomePageContent(id) {
        const content = await db2.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl }).from(schema.homePageContent).where(eq2(schema.homePageContent.id, id)).limit(1);
        if (content[0]?.imageUrl) {
          try {
            await deleteFile(content[0].imageUrl);
          } catch (fileError) {
            console.error(`Error deleting homepage content image for content ${id}:`, fileError);
          }
        }
        const result = await db2.delete(schema.homePageContent).where(eq2(schema.homePageContent.id, id)).returning();
        return result.length > 0;
      }
      // Comprehensive grade management
      async recordComprehensiveGrade(gradeData) {
        try {
          let reportCard = await db2.select().from(schema.reportCards).where(and2(
            eq2(schema.reportCards.studentId, gradeData.studentId),
            eq2(schema.reportCards.termId, gradeData.termId)
          )).limit(1);
          let reportCardId;
          if (reportCard.length === 0) {
            const newReportCard = await db2.insert(schema.reportCards).values({
              studentId: gradeData.studentId,
              classId: gradeData.classId || 1,
              // Should be provided
              termId: gradeData.termId,
              status: "draft"
            }).returning();
            reportCardId = newReportCard[0].id;
          } else {
            reportCardId = reportCard[0].id;
          }
          const existingItem = await db2.select().from(schema.reportCardItems).where(and2(
            eq2(schema.reportCardItems.reportCardId, reportCardId),
            eq2(schema.reportCardItems.subjectId, gradeData.subjectId)
          )).limit(1);
          const comprehensiveGradeData = {
            reportCardId,
            subjectId: gradeData.subjectId,
            testScore: gradeData.testScore,
            testMaxScore: gradeData.testMaxScore,
            testWeightedScore: gradeData.testWeightedScore || Math.round(gradeData.testScore / gradeData.testMaxScore * 40),
            examScore: gradeData.examScore,
            examMaxScore: gradeData.examMaxScore,
            examWeightedScore: gradeData.examWeightedScore || Math.round(gradeData.examScore / gradeData.examMaxScore * 60),
            obtainedMarks: gradeData.testWeightedScore + gradeData.examWeightedScore || Math.round(gradeData.testScore / gradeData.testMaxScore * 40 + gradeData.examScore / gradeData.examMaxScore * 60),
            percentage: gradeData.percentage || Math.round(gradeData.testScore / gradeData.testMaxScore * 40 + gradeData.examScore / gradeData.examMaxScore * 60),
            grade: gradeData.grade,
            teacherRemarks: gradeData.teacherRemarks
          };
          if (existingItem.length > 0) {
            const result = await db2.update(schema.reportCardItems).set(comprehensiveGradeData).where(eq2(schema.reportCardItems.id, existingItem[0].id)).returning();
            return result[0];
          } else {
            const result = await db2.insert(schema.reportCardItems).values(comprehensiveGradeData).returning();
            return result[0];
          }
        } catch (error) {
          throw error;
        }
      }
      async getComprehensiveGradesByStudent(studentId, termId) {
        try {
          let query = db2.select({
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
          }).from(schema.reportCardItems).innerJoin(schema.reportCards, eq2(schema.reportCardItems.reportCardId, schema.reportCards.id)).innerJoin(schema.subjects, eq2(schema.reportCardItems.subjectId, schema.subjects.id)).where(eq2(schema.reportCards.studentId, studentId));
          if (termId) {
            query = query.where(and2(
              eq2(schema.reportCards.studentId, studentId),
              eq2(schema.reportCards.termId, termId)
            ));
          }
          return await query.orderBy(schema.subjects.name);
        } catch (error) {
          return [];
        }
      }
      async getComprehensiveGradesByClass(classId, termId) {
        try {
          let query = db2.select({
            studentId: schema.reportCards.studentId,
            studentName: sql2`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as("studentName"),
            admissionNumber: schema.students.admissionNumber,
            subjectName: schema.subjects.name,
            testScore: schema.reportCardItems.testScore,
            examScore: schema.reportCardItems.examScore,
            obtainedMarks: schema.reportCardItems.obtainedMarks,
            grade: schema.reportCardItems.grade,
            teacherRemarks: schema.reportCardItems.teacherRemarks
          }).from(schema.reportCardItems).innerJoin(schema.reportCards, eq2(schema.reportCardItems.reportCardId, schema.reportCards.id)).innerJoin(schema.students, eq2(schema.reportCards.studentId, schema.students.id)).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).innerJoin(schema.subjects, eq2(schema.reportCardItems.subjectId, schema.subjects.id)).where(eq2(schema.students.classId, classId));
          if (termId) {
            query = query.where(and2(
              eq2(schema.students.classId, classId),
              eq2(schema.reportCards.termId, termId)
            ));
          }
          return await query.orderBy(schema.users.firstName, schema.users.lastName, schema.subjects.name);
        } catch (error) {
          return [];
        }
      }
      async createReportCard(reportCardData, grades) {
        try {
          const reportCard = await this.db.insert(schema.reportCards).values(reportCardData).returning();
          if (grades.length > 0) {
            for (const grade of grades) {
              await this.db.update(schema.reportCardItems).set({ reportCardId: reportCard[0].id }).where(eq2(schema.reportCardItems.id, grade.id));
            }
          }
          return {
            reportCard: reportCard[0],
            grades
          };
        } catch (error) {
          throw error;
        }
      }
      async getReportCard(id) {
        try {
          const result = await db2.select().from(schema.reportCards).where(eq2(schema.reportCards.id, id)).limit(1);
          if (!result[0]) return void 0;
          const reportCard = result[0];
          let teacherSignatureUrl = reportCard.teacherSignatureUrl;
          let teacherSignedBy = reportCard.teacherSignedBy;
          let principalSignatureUrl = reportCard.principalSignatureUrl;
          let principalSignedBy = reportCard.principalSignedBy;
          const classInfo = await this.getClass(reportCard.classId);
          if (!teacherSignatureUrl && classInfo?.classTeacherId) {
            const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
            if (teacherProfile?.signatureUrl) {
              teacherSignatureUrl = teacherProfile.signatureUrl;
              const teacherUser = await this.getUser(classInfo.classTeacherId);
              teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
            }
          }
          if (!principalSignatureUrl) {
            const superAdminsWithSignature = await db2.select({
              signatureUrl: schema.superAdminProfiles.signatureUrl,
              userId: schema.superAdminProfiles.userId,
              firstName: schema.users.firstName,
              lastName: schema.users.lastName,
              roleId: schema.users.roleId
            }).from(schema.superAdminProfiles).innerJoin(schema.users, eq2(schema.superAdminProfiles.userId, schema.users.id)).where(and2(
              isNotNull(schema.superAdminProfiles.signatureUrl),
              ne(schema.superAdminProfiles.signatureUrl, "")
            )).limit(1);
            if (superAdminsWithSignature.length > 0) {
              principalSignatureUrl = superAdminsWithSignature[0].signatureUrl;
              principalSignedBy = `${superAdminsWithSignature[0].firstName} ${superAdminsWithSignature[0].lastName}`;
            } else {
              const adminsWithSignature = await db2.select({
                signatureUrl: schema.adminProfiles.signatureUrl,
                userId: schema.adminProfiles.userId,
                firstName: schema.users.firstName,
                lastName: schema.users.lastName,
                roleId: schema.users.roleId
              }).from(schema.adminProfiles).innerJoin(schema.users, eq2(schema.adminProfiles.userId, schema.users.id)).where(and2(
                isNotNull(schema.adminProfiles.signatureUrl),
                ne(schema.adminProfiles.signatureUrl, "")
              )).limit(1);
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
          };
        } catch (error) {
          return void 0;
        }
      }
      async getReportCardsByStudentId(studentId) {
        try {
          return await db2.select().from(schema.reportCards).where(eq2(schema.reportCards.studentId, studentId)).orderBy(desc(schema.reportCards.generatedAt));
        } catch (error) {
          return [];
        }
      }
      async getReportCardItems(reportCardId) {
        try {
          return await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCardId));
        } catch (error) {
          return [];
        }
      }
      async getReportCardItemById(itemId) {
        try {
          const result = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.id, itemId)).limit(1);
          return result[0];
        } catch (error) {
          console.error("Error getting report card item by id:", error);
          return void 0;
        }
      }
      async getStudentsByParentId(parentId) {
        try {
          return await db2.select().from(schema.students).where(eq2(schema.students.parentId, parentId));
        } catch (error) {
          return [];
        }
      }
      // Enhanced report card management methods
      async getReportCardsByClassAndTerm(classId, termId) {
        try {
          const results = await db2.select({
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
            studentName: sql2`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as("studentName"),
            studentUsername: schema.users.username,
            studentPhoto: schema.users.profileImageUrl,
            admissionNumber: schema.students.admissionNumber,
            department: schema.students.department,
            className: schema.classes.name,
            classLevel: schema.classes.level
          }).from(schema.reportCards).innerJoin(schema.students, eq2(schema.reportCards.studentId, schema.students.id)).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).innerJoin(schema.classes, eq2(schema.reportCards.classId, schema.classes.id)).where(and2(
            eq2(schema.reportCards.classId, classId),
            eq2(schema.reportCards.termId, termId)
          )).orderBy(schema.reportCards.position);
          return results.map((r) => {
            const isSSS = r.className?.startsWith("SS") || r.classLevel?.includes("Senior Secondary");
            return {
              ...r,
              isSSS,
              department: isSSS ? r.department : null
            };
          });
        } catch (error) {
          console.error("Error getting report cards by class and term:", error);
          return [];
        }
      }
      async getReportCardWithItems(reportCardId) {
        try {
          const reportCard = await db2.select({
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
            studentName: sql2`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as("studentName"),
            studentUsername: schema.users.username,
            studentPhoto: schema.users.profileImageUrl,
            admissionNumber: schema.students.admissionNumber,
            department: schema.students.department,
            className: schema.classes.name,
            classLevel: schema.classes.level,
            termName: schema.academicTerms.name,
            termYear: schema.academicTerms.year
          }).from(schema.reportCards).innerJoin(schema.students, eq2(schema.reportCards.studentId, schema.students.id)).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).innerJoin(schema.classes, eq2(schema.reportCards.classId, schema.classes.id)).innerJoin(schema.academicTerms, eq2(schema.reportCards.termId, schema.academicTerms.id)).where(eq2(schema.reportCards.id, reportCardId)).limit(1);
          if (reportCard.length === 0) return null;
          const isSSS = reportCard[0].className?.startsWith("SS") || reportCard[0].classLevel?.includes("Senior Secondary");
          const academicSession = reportCard[0].termYear || "2024/2025";
          const items = await db2.select({
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
          }).from(schema.reportCardItems).innerJoin(schema.subjects, eq2(schema.reportCardItems.subjectId, schema.subjects.id)).where(eq2(schema.reportCardItems.reportCardId, reportCardId)).orderBy(schema.subjects.name);
          let teacherSignatureUrl = reportCard[0].teacherSignatureUrl;
          let teacherSignedBy = reportCard[0].teacherSignedBy;
          let principalSignatureUrl = reportCard[0].principalSignatureUrl;
          let principalSignedBy = reportCard[0].principalSignedBy;
          console.log("[SIGNATURE-DEBUG] Initial state:", {
            hasStoredTeacherSig: !!teacherSignatureUrl,
            hasStoredPrincipalSig: !!principalSignatureUrl,
            classId: reportCard[0].classId
          });
          const classInfo = await this.getClass(reportCard[0].classId);
          console.log("[SIGNATURE-DEBUG] Class info:", { classTeacherId: classInfo?.classTeacherId });
          if (!teacherSignatureUrl && classInfo?.classTeacherId) {
            const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
            console.log("[SIGNATURE-DEBUG] Teacher profile:", {
              hasProfile: !!teacherProfile,
              hasSignature: !!teacherProfile?.signatureUrl,
              signatureLength: teacherProfile?.signatureUrl?.length || 0
            });
            if (teacherProfile?.signatureUrl) {
              teacherSignatureUrl = teacherProfile.signatureUrl;
              const teacherUser = await this.getUser(classInfo.classTeacherId);
              teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
            }
          }
          if (!principalSignatureUrl) {
            const superAdminsWithSignature = await db2.select({
              signatureUrl: schema.superAdminProfiles.signatureUrl,
              userId: schema.superAdminProfiles.userId,
              firstName: schema.users.firstName,
              lastName: schema.users.lastName,
              roleId: schema.users.roleId
            }).from(schema.superAdminProfiles).innerJoin(schema.users, eq2(schema.superAdminProfiles.userId, schema.users.id)).where(and2(
              isNotNull(schema.superAdminProfiles.signatureUrl),
              ne(schema.superAdminProfiles.signatureUrl, "")
            )).limit(1);
            console.log("[SIGNATURE-DEBUG] Super admins with signature found:", superAdminsWithSignature.length);
            if (superAdminsWithSignature.length > 0) {
              console.log("[SIGNATURE-DEBUG] Using super admin signature from:", superAdminsWithSignature[0].firstName, superAdminsWithSignature[0].lastName);
              principalSignatureUrl = superAdminsWithSignature[0].signatureUrl;
              principalSignedBy = `${superAdminsWithSignature[0].firstName} ${superAdminsWithSignature[0].lastName}`;
            } else {
              const adminsWithSignature = await db2.select({
                signatureUrl: schema.adminProfiles.signatureUrl,
                userId: schema.adminProfiles.userId,
                firstName: schema.users.firstName,
                lastName: schema.users.lastName,
                roleId: schema.users.roleId
              }).from(schema.adminProfiles).innerJoin(schema.users, eq2(schema.adminProfiles.userId, schema.users.id)).where(and2(
                isNotNull(schema.adminProfiles.signatureUrl),
                ne(schema.adminProfiles.signatureUrl, "")
              )).limit(1);
              console.log("[SIGNATURE-DEBUG] Admins with signature found:", adminsWithSignature.length);
              if (adminsWithSignature.length > 0) {
                console.log("[SIGNATURE-DEBUG] Using admin signature from:", adminsWithSignature[0].firstName, adminsWithSignature[0].lastName);
                principalSignatureUrl = adminsWithSignature[0].signatureUrl;
                principalSignedBy = `${adminsWithSignature[0].firstName} ${adminsWithSignature[0].lastName}`;
              }
            }
          }
          const skills = await this.getReportCardSkills(reportCardId);
          return {
            ...reportCard[0],
            isSSS,
            academicSession,
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
          console.error("Error getting report card with items:", error);
          return null;
        }
      }
      async generateReportCardsForClass(classId, termId, gradingScale, generatedBy) {
        try {
          const errors = [];
          let created = 0;
          let updated = 0;
          const students3 = await db2.select().from(schema.students).where(eq2(schema.students.classId, classId));
          const classInfo = await this.getClass(classId);
          const isSeniorSecondary = classInfo && ["SS1", "SS2", "SS3", "Senior Secondary"].some(
            (level) => classInfo.level?.toLowerCase().includes(level.toLowerCase())
          );
          let classTeacherSignatureUrl = null;
          if (classInfo?.classTeacherId) {
            const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
            classTeacherSignatureUrl = teacherProfile?.signatureUrl || null;
          }
          for (const student of students3) {
            try {
              const existingReportCard = await db2.select().from(schema.reportCards).where(and2(
                eq2(schema.reportCards.studentId, student.id),
                eq2(schema.reportCards.termId, termId)
              )).limit(1);
              let reportCardId;
              if (existingReportCard.length === 0) {
                const studentUser = await this.getUser(student.userId);
                const studentFirstName = studentUser?.firstName || "Student";
                const newReportCard = await db2.insert(schema.reportCards).values({
                  studentId: student.id,
                  classId,
                  termId,
                  status: "draft",
                  gradingScale,
                  scoreAggregationMode: "last",
                  generatedBy,
                  generatedAt: /* @__PURE__ */ new Date(),
                  // Pre-populate class teacher's signature if available
                  teacherSignatureUrl: classTeacherSignatureUrl,
                  teacherSignedBy: classTeacherSignatureUrl ? classInfo?.classTeacherId : null,
                  teacherSignedAt: classTeacherSignatureUrl ? /* @__PURE__ */ new Date() : null
                  // Default comments will be generated after scores are populated
                }).returning();
                reportCardId = newReportCard[0].id;
                created++;
              } else {
                reportCardId = existingReportCard[0].id;
                updated++;
              }
              const studentDepartment = student.department;
              let subjects3;
              if (isSeniorSecondary && studentDepartment) {
                subjects3 = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
              } else {
                subjects3 = await this.getSubjectsByClassAndDepartment(classId);
              }
              if (subjects3.length === 0) {
                console.log(`[REPORT-CARD] No class_subject_mappings found for class ${classId}, department: ${studentDepartment || "none"}. Admin must assign subjects via Subject Manager.`);
                errors.push(`No subjects assigned for student ${student.id} (class ${classId}, dept: ${studentDepartment || "none"}). Admin must configure subjects.`);
                continue;
              }
              const validSubjectIds = new Set(subjects3.map((s) => s.id));
              const existingItems = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCardId));
              for (const item of existingItems) {
                if (!validSubjectIds.has(item.subjectId)) {
                  await db2.delete(schema.reportCardItems).where(eq2(schema.reportCardItems.id, item.id));
                  console.log(`[REPORT-CARD] Removed invalid subject ${item.subjectId} from report card ${reportCardId}`);
                }
              }
              for (const subject of subjects3) {
                const existingItem = await db2.select().from(schema.reportCardItems).where(and2(
                  eq2(schema.reportCardItems.reportCardId, reportCardId),
                  eq2(schema.reportCardItems.subjectId, subject.id)
                )).limit(1);
                if (existingItem.length === 0) {
                  await db2.insert(schema.reportCardItems).values({
                    reportCardId,
                    subjectId: subject.id,
                    totalMarks: 100,
                    obtainedMarks: 0,
                    percentage: 0
                  });
                }
              }
              await this.autoPopulateReportCardScores(reportCardId);
            } catch (studentError) {
              errors.push(`Failed to generate report card for student ${student.id}: ${studentError.message}`);
            }
          }
          await this.recalculateClassPositions(classId, termId);
          return { created, updated, errors };
        } catch (error) {
          console.error("Error generating report cards for class:", error);
          return { created: 0, updated: 0, errors: [error.message] };
        }
      }
      async autoPopulateReportCardScores(reportCardId) {
        try {
          const errors = [];
          let populated = 0;
          const reportCard = await this.getReportCard(reportCardId);
          if (!reportCard) {
            return { populated: 0, errors: ["Report card not found"] };
          }
          const gradingScale = reportCard.gradingScale || "standard";
          let config = getGradingConfig(gradingScale);
          const systemSettings3 = await this.getSystemSettings();
          if (systemSettings3) {
            const testWeight = systemSettings3.testWeight ?? 40;
            const examWeight = systemSettings3.examWeight ?? 60;
            config = { ...config, testWeight, examWeight };
          }
          const items = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCardId));
          for (const item of items) {
            try {
              if (item.isOverridden) continue;
              const examScores = await this.getExamScoresForReportCard(
                reportCard.studentId,
                item.subjectId,
                reportCard.termId
              );
              let testScore = null;
              let testMaxScore = null;
              let examScore = null;
              let examMaxScore = null;
              if (examScores.testExams.length > 0) {
                const lastTest = examScores.testExams[examScores.testExams.length - 1];
                testScore = lastTest.score;
                testMaxScore = lastTest.maxScore;
              }
              if (examScores.mainExams.length > 0) {
                const lastExam = examScores.mainExams[examScores.mainExams.length - 1];
                examScore = lastExam.score;
                examMaxScore = lastExam.maxScore;
              }
              const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config);
              const gradeInfo = calculateGradeFromPercentage(weighted.percentage, gradingScale);
              await db2.update(schema.reportCardItems).set({
                testScore,
                testMaxScore,
                testWeightedScore: Math.round(weighted.testWeighted),
                examScore,
                examMaxScore,
                examWeightedScore: Math.round(weighted.examWeighted),
                obtainedMarks: Math.round(weighted.weightedScore),
                percentage: Math.round(weighted.percentage),
                grade: gradeInfo.grade,
                remarks: gradeInfo.remarks,
                updatedAt: /* @__PURE__ */ new Date()
              }).where(eq2(schema.reportCardItems.id, item.id));
              populated++;
            } catch (itemError) {
              errors.push(`Failed to populate scores for item ${item.id}: ${itemError.message}`);
            }
          }
          await this.recalculateReportCard(reportCardId, gradingScale);
          return { populated, errors };
        } catch (error) {
          console.error("Error auto-populating report card scores:", error);
          return { populated: 0, errors: [error.message] };
        }
      }
      async getExamScoresForReportCard(studentId, subjectId, termId) {
        try {
          const examResults3 = await db2.select({
            id: schema.examResults.id,
            examId: schema.examResults.examId,
            score: schema.examResults.marksObtained,
            maxScore: schema.exams.totalMarks,
            examType: schema.exams.examType,
            examDate: schema.exams.examDate,
            createdAt: schema.examResults.createdAt
          }).from(schema.examResults).innerJoin(schema.exams, eq2(schema.examResults.examId, schema.exams.id)).where(and2(
            eq2(schema.examResults.studentId, studentId),
            eq2(schema.exams.subjectId, subjectId),
            eq2(schema.exams.termId, termId)
          )).orderBy(schema.examResults.createdAt);
          const testExams = examResults3.filter((r) => r.examType === "test" || r.examType === "quiz" || r.examType === "assignment");
          const mainExams = examResults3.filter((r) => r.examType === "exam" || r.examType === "final" || r.examType === "midterm");
          return { testExams, mainExams };
        } catch (error) {
          console.error("Error getting exam scores for report card:", error);
          return { testExams: [], mainExams: [] };
        }
      }
      async overrideReportCardItemScore(itemId, data) {
        try {
          const item = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.id, itemId)).limit(1);
          if (item.length === 0) return void 0;
          const reportCard = await this.getReportCard(item[0].reportCardId);
          if (!reportCard) return void 0;
          const gradingScale = reportCard.gradingScale || "standard";
          const gradingConfig = getGradingConfig(gradingScale);
          const testScore = data.testScore !== void 0 ? data.testScore : item[0].testScore;
          const testMaxScore = data.testMaxScore !== void 0 ? data.testMaxScore : item[0].testMaxScore;
          const examScore = data.examScore !== void 0 ? data.examScore : item[0].examScore;
          const examMaxScore = data.examMaxScore !== void 0 ? data.examMaxScore : item[0].examMaxScore;
          const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, gradingConfig);
          const gradeInfo = calculateGradeFromPercentage(weighted.percentage, gradingScale);
          const result = await db2.update(schema.reportCardItems).set({
            testScore,
            testMaxScore,
            testWeightedScore: Math.round(weighted.testWeighted),
            examScore,
            examMaxScore,
            examWeightedScore: Math.round(weighted.examWeighted),
            obtainedMarks: Math.round(weighted.weightedScore),
            percentage: Math.round(weighted.percentage),
            grade: gradeInfo.grade,
            remarks: gradeInfo.remarks,
            teacherRemarks: data.teacherRemarks !== void 0 ? data.teacherRemarks : item[0].teacherRemarks,
            isOverridden: true,
            overriddenBy: data.overriddenBy,
            overriddenAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(schema.reportCardItems.id, itemId)).returning();
          await this.recalculateReportCard(reportCard.id, gradingScale);
          if (reportCard.classId && reportCard.termId) {
            await this.recalculateClassPositions(reportCard.classId, reportCard.termId);
          }
          console.log(`[REPORT-CARD-OVERRIDE] Successfully updated item ${itemId} with test: ${testScore}/${testMaxScore}, exam: ${examScore}/${examMaxScore}, grade: ${gradeInfo.grade}`);
          return result[0];
        } catch (error) {
          console.error("Error overriding report card item score:", error);
          return void 0;
        }
      }
      async updateReportCardStatus(reportCardId, status, userId) {
        try {
          const validStatuses = ["draft", "finalized", "published"];
          if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`);
          }
          const currentReportCard = await this.getReportCard(reportCardId);
          if (!currentReportCard) {
            throw new Error("Report card not found");
          }
          const currentStatus = currentReportCard.status || "draft";
          if (currentStatus === status) {
            return currentReportCard;
          }
          const validTransitions = {
            "draft": ["finalized"],
            // Draft can only go to Finalized
            "finalized": ["draft", "published"],
            // Finalized can revert to Draft or go to Published
            "published": ["draft", "finalized"]
            // Published can revert to Draft or Finalized
          };
          const allowedNextStatuses = validTransitions[currentStatus] || [];
          if (!allowedNextStatuses.includes(status)) {
            throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(", ")}`);
          }
          const updateData = {
            status,
            updatedAt: /* @__PURE__ */ new Date()
          };
          if (status === "draft") {
            updateData.finalizedAt = null;
            updateData.publishedAt = null;
            updateData.locked = false;
          } else if (status === "finalized") {
            updateData.finalizedAt = /* @__PURE__ */ new Date();
            updateData.publishedAt = null;
            updateData.locked = true;
          } else if (status === "published") {
            updateData.publishedAt = /* @__PURE__ */ new Date();
            updateData.locked = true;
          }
          const result = await db2.update(schema.reportCards).set(updateData).where(eq2(schema.reportCards.id, reportCardId)).returning();
          return result[0];
        } catch (error) {
          console.error("Error updating report card status:", error);
          throw error;
        }
      }
      // OPTIMIZED version - single query with conditional update for instant status changes
      async updateReportCardStatusOptimized(reportCardId, status, userId) {
        try {
          const validStatuses = ["draft", "finalized", "published"];
          if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`);
          }
          const current = await db2.select({
            id: schema.reportCards.id,
            status: schema.reportCards.status
          }).from(schema.reportCards).where(eq2(schema.reportCards.id, reportCardId)).limit(1);
          if (!current.length) {
            throw new Error("Report card not found");
          }
          const currentStatus = current[0].status || "draft";
          if (currentStatus === status) {
            const existing = await db2.select().from(schema.reportCards).where(eq2(schema.reportCards.id, reportCardId)).limit(1);
            return { reportCard: existing[0], previousStatus: currentStatus };
          }
          const validTransitions = {
            "draft": ["finalized"],
            "finalized": ["draft", "published"],
            "published": ["draft", "finalized"]
          };
          const allowedNextStatuses = validTransitions[currentStatus] || [];
          if (!allowedNextStatuses.includes(status)) {
            throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(", ")}`);
          }
          const updateData = {
            status,
            updatedAt: /* @__PURE__ */ new Date()
          };
          if (status === "draft") {
            updateData.finalizedAt = null;
            updateData.publishedAt = null;
            updateData.locked = false;
          } else if (status === "finalized") {
            updateData.finalizedAt = /* @__PURE__ */ new Date();
            updateData.publishedAt = null;
            updateData.locked = true;
          } else if (status === "published") {
            updateData.publishedAt = /* @__PURE__ */ new Date();
            updateData.locked = true;
          }
          const result = await db2.update(schema.reportCards).set(updateData).where(eq2(schema.reportCards.id, reportCardId)).returning();
          const updatedReportCard = result[0];
          if (status === "finalized" && updatedReportCard) {
            console.log(`[REPORT-CARD-STATUS] Recalculating totals for finalized report card ${reportCardId}`);
            await this.recalculateReportCard(reportCardId, updatedReportCard.gradingScale || "standard");
            if (updatedReportCard.classId && updatedReportCard.termId) {
              await this.recalculateClassPositions(updatedReportCard.classId, updatedReportCard.termId);
            }
            const finalResult = await db2.select().from(schema.reportCards).where(eq2(schema.reportCards.id, reportCardId)).limit(1);
            return { reportCard: finalResult[0], previousStatus: currentStatus };
          }
          return { reportCard: updatedReportCard, previousStatus: currentStatus };
        } catch (error) {
          console.error("Error updating report card status (optimized):", error);
          throw error;
        }
      }
      async updateReportCardRemarks(reportCardId, teacherRemarks, principalRemarks) {
        try {
          const updateData = { updatedAt: /* @__PURE__ */ new Date() };
          if (teacherRemarks !== void 0) updateData.teacherRemarks = teacherRemarks;
          if (principalRemarks !== void 0) updateData.principalRemarks = principalRemarks;
          const result = await db2.update(schema.reportCards).set(updateData).where(eq2(schema.reportCards.id, reportCardId)).returning();
          return result[0];
        } catch (error) {
          console.error("Error updating report card remarks:", error);
          return void 0;
        }
      }
      // Report comment template methods
      async getReportCommentTemplates(role) {
        try {
          if (role) {
            return await db2.select().from(schema.reportCommentTemplates).where(eq2(schema.reportCommentTemplates.role, role)).orderBy(desc(schema.reportCommentTemplates.minPercentage));
          }
          return await db2.select().from(schema.reportCommentTemplates).orderBy(schema.reportCommentTemplates.role, desc(schema.reportCommentTemplates.minPercentage));
        } catch (error) {
          console.error("Error getting report comment templates:", error);
          return [];
        }
      }
      async getReportCommentTemplate(id) {
        try {
          const result = await db2.select().from(schema.reportCommentTemplates).where(eq2(schema.reportCommentTemplates.id, id)).limit(1);
          return result[0];
        } catch (error) {
          console.error("Error getting report comment template:", error);
          return void 0;
        }
      }
      async createReportCommentTemplate(template) {
        try {
          const result = await db2.insert(schema.reportCommentTemplates).values(template).returning();
          return result[0];
        } catch (error) {
          console.error("Error creating report comment template:", error);
          throw error;
        }
      }
      async updateReportCommentTemplate(id, template) {
        try {
          const result = await db2.update(schema.reportCommentTemplates).set({ ...template, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.reportCommentTemplates.id, id)).returning();
          return result[0];
        } catch (error) {
          console.error("Error updating report comment template:", error);
          return void 0;
        }
      }
      async deleteReportCommentTemplate(id) {
        try {
          await db2.delete(schema.reportCommentTemplates).where(eq2(schema.reportCommentTemplates.id, id));
          return true;
        } catch (error) {
          console.error("Error deleting report comment template:", error);
          return false;
        }
      }
      async getCommentTemplateByPerformance(role, percentage) {
        try {
          const result = await db2.select().from(schema.reportCommentTemplates).where(
            and2(
              eq2(schema.reportCommentTemplates.role, role),
              eq2(schema.reportCommentTemplates.isActive, true),
              lte(schema.reportCommentTemplates.minPercentage, percentage),
              gte(schema.reportCommentTemplates.maxPercentage, percentage)
            )
          ).limit(1);
          return result[0];
        } catch (error) {
          console.error("Error getting comment template by performance:", error);
          return void 0;
        }
      }
      async getExamsWithSubjectsByClassAndTerm(classId, termId) {
        try {
          let query = db2.select({
            id: schema.exams.id,
            title: schema.exams.title,
            subjectId: schema.exams.subjectId,
            subjectName: schema.subjects.name,
            examType: schema.exams.examType,
            totalMarks: schema.exams.totalMarks,
            examDate: schema.exams.examDate,
            status: schema.exams.status,
            termId: schema.exams.termId
          }).from(schema.exams).innerJoin(schema.subjects, eq2(schema.exams.subjectId, schema.subjects.id)).where(eq2(schema.exams.classId, classId));
          if (termId) {
            query = query.where(and2(
              eq2(schema.exams.classId, classId),
              eq2(schema.exams.termId, termId)
            ));
          }
          return await query.orderBy(desc(schema.exams.examDate));
        } catch (error) {
          console.error("Error getting exams by class and term:", error);
          return [];
        }
      }
      async recalculateReportCard(reportCardId, gradingScale) {
        try {
          const items = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCardId));
          if (items.length === 0) return void 0;
          let totalObtained = 0;
          let totalPossible = 0;
          const grades = [];
          for (const item of items) {
            totalObtained += item.obtainedMarks || 0;
            totalPossible += item.totalMarks || 100;
            if (item.grade) grades.push(item.grade);
          }
          const averagePercentage = totalPossible > 0 ? totalObtained / totalPossible * 100 : 0;
          const overallGrade = getOverallGrade(averagePercentage, gradingScale);
          const result = await db2.update(schema.reportCards).set({
            totalScore: totalObtained,
            averageScore: Math.round(averagePercentage),
            averagePercentage: Math.round(averagePercentage),
            overallGrade,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(schema.reportCards.id, reportCardId)).returning();
          return result[0];
        } catch (error) {
          console.error("Error recalculating report card:", error);
          return void 0;
        }
      }
      async recalculateClassPositions(classId, termId) {
        try {
          console.log(`[REPORT-CARD] Calculating class positions for class ${classId}, term ${termId}`);
          const settings3 = await db2.select().from(schema.systemSettings).limit(1);
          const positioningMethod = settings3[0]?.positioningMethod || "average";
          console.log(`[REPORT-CARD] Using positioning method: ${positioningMethod}`);
          const reportCards3 = await db2.select({
            id: schema.reportCards.id,
            studentId: schema.reportCards.studentId,
            totalScore: schema.reportCards.totalScore,
            averageScore: schema.reportCards.averageScore
          }).from(schema.reportCards).where(and2(
            eq2(schema.reportCards.classId, classId),
            eq2(schema.reportCards.termId, termId)
          ));
          if (reportCards3.length === 0) {
            console.log(`[REPORT-CARD] No report cards found for class ${classId}, term ${termId}`);
            return;
          }
          const totalStudentsInClass = reportCards3.length;
          const sortedCards = [...reportCards3].sort((a, b) => {
            let scoreA;
            let scoreB;
            if (positioningMethod === "average") {
              scoreA = a.averageScore ?? 0;
              scoreB = b.averageScore ?? 0;
            } else {
              scoreA = a.totalScore ?? a.averageScore ?? 0;
              scoreB = b.totalScore ?? b.averageScore ?? 0;
            }
            return scoreB - scoreA;
          });
          const positionMap = /* @__PURE__ */ new Map();
          let lastAssignedPosition = 1;
          let previousScore = null;
          for (let i = 0; i < sortedCards.length; i++) {
            const card = sortedCards[i];
            const score = positioningMethod === "average" ? card.averageScore ?? 0 : card.totalScore ?? card.averageScore ?? 0;
            if (i === 0) {
              lastAssignedPosition = 1;
            } else if (score !== previousScore) {
              lastAssignedPosition = i + 1;
            }
            positionMap.set(card.id, lastAssignedPosition);
            previousScore = score;
          }
          for (const card of reportCards3) {
            const position = positionMap.get(card.id) ?? reportCards3.length;
            await db2.update(schema.reportCards).set({
              position,
              totalStudentsInClass,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq2(schema.reportCards.id, card.id));
          }
          console.log(`[REPORT-CARD] Successfully calculated positions for ${totalStudentsInClass} students in class ${classId}, term ${termId}`);
          try {
            realtimeService.emitTableChange("report_cards", "UPDATE", {
              event: "positions_updated",
              classId,
              termId,
              totalStudents: totalStudentsInClass,
              reportCardIds: reportCards3.map((rc) => rc.id),
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
      async syncExamScoreToReportCard(studentId, examId, score, maxScore) {
        try {
          console.log(`[REPORT-CARD-SYNC] Starting sync for student ${studentId}, exam ${examId}, score ${score}/${maxScore}`);
          const exam = await db2.select().from(schema.exams).where(eq2(schema.exams.id, examId)).limit(1);
          if (exam.length === 0) {
            return { success: false, message: "Exam not found" };
          }
          const examData = exam[0];
          const { subjectId, classId, termId, examType, gradingScale: examGradingScale, createdBy: examCreatedBy } = examData;
          if (!subjectId || !classId || !termId) {
            return { success: false, message: "Exam missing required fields (subject, class, or term)" };
          }
          const student = await db2.select().from(schema.students).where(eq2(schema.students.id, studentId)).limit(1);
          if (student.length === 0) {
            return { success: false, message: "Student not found" };
          }
          const academicTerm = await db2.select().from(schema.academicTerms).where(eq2(schema.academicTerms.id, termId)).limit(1);
          const sessionYear = academicTerm.length > 0 ? `${academicTerm[0].year}/${academicTerm[0].year + 1}` : null;
          let reportCard = await db2.select().from(schema.reportCards).where(and2(
            eq2(schema.reportCards.studentId, studentId),
            eq2(schema.reportCards.termId, termId)
          )).limit(1);
          let reportCardId;
          let isNewReportCard = false;
          const gradingScale = examGradingScale || "standard";
          if (reportCard.length === 0) {
            console.log(`[REPORT-CARD-SYNC] Auto-creating new report card for student ${studentId}, term ${termId}`);
            isNewReportCard = true;
            const newReportCard = await db2.insert(schema.reportCards).values({
              studentId,
              classId,
              termId,
              sessionYear,
              status: "draft",
              gradingScale,
              scoreAggregationMode: "last",
              generatedAt: /* @__PURE__ */ new Date(),
              autoGenerated: true,
              locked: false
            }).returning();
            reportCardId = newReportCard[0].id;
            const studentClass = await db2.select().from(schema.classes).where(eq2(schema.classes.id, classId)).limit(1);
            const isSeniorSecondary = studentClass.length > 0 && (studentClass[0].level || "").trim().toLowerCase() === "senior secondary";
            const rawDepartment = (student[0].department || "").trim().toLowerCase();
            const studentDepartment = rawDepartment.length > 0 ? rawDepartment : void 0;
            const studentSubjectAssignments3 = await db2.select({ subjectId: schema.studentSubjectAssignments.subjectId }).from(schema.studentSubjectAssignments).where(and2(
              eq2(schema.studentSubjectAssignments.studentId, studentId),
              eq2(schema.studentSubjectAssignments.classId, classId),
              eq2(schema.studentSubjectAssignments.isActive, true)
            ));
            let relevantSubjects = [];
            if (studentSubjectAssignments3.length > 0) {
              const studentSubjectIds = studentSubjectAssignments3.map((a) => a.subjectId);
              relevantSubjects = await db2.select().from(schema.subjects).where(and2(
                inArray2(schema.subjects.id, studentSubjectIds),
                eq2(schema.subjects.isActive, true)
              ));
              console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from student's personal assignments`);
            } else {
              relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
              if (relevantSubjects.length > 0) {
                console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from class_subject_mappings (department: ${studentDepartment || "none"})`);
              } else {
                console.log(`[REPORT-CARD-SYNC] No subjects found in class_subject_mappings for class ${classId}, department: ${studentDepartment || "none"}. Admin must assign subjects.`);
              }
            }
            console.log(`[REPORT-CARD-SYNC] Creating ${relevantSubjects.length} subject items for ${isSeniorSecondary ? `SS ${studentDepartment || "no-dept"}` : "non-SS"} student`);
            for (const subject of relevantSubjects) {
              await db2.insert(schema.reportCardItems).values({
                reportCardId,
                subjectId: subject.id,
                totalMarks: 100,
                obtainedMarks: 0,
                percentage: 0
              });
            }
          } else {
            reportCardId = reportCard[0].id;
            const existingItems = await db2.select({ subjectId: schema.reportCardItems.subjectId }).from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCardId));
            const existingSubjectIds = new Set(existingItems.map((item) => item.subjectId));
            const studentClass = await db2.select().from(schema.classes).where(eq2(schema.classes.id, classId)).limit(1);
            const isSeniorSecondary = studentClass.length > 0 && (studentClass[0].level || "").trim().toLowerCase() === "senior secondary";
            const rawDepartment = (student[0].department || "").trim().toLowerCase();
            const studentDepartment = rawDepartment.length > 0 ? rawDepartment : void 0;
            const studentSubjectAssignments3 = await db2.select({ subjectId: schema.studentSubjectAssignments.subjectId }).from(schema.studentSubjectAssignments).where(and2(
              eq2(schema.studentSubjectAssignments.studentId, studentId),
              eq2(schema.studentSubjectAssignments.classId, classId),
              eq2(schema.studentSubjectAssignments.isActive, true)
            ));
            let assignedSubjectIds = [];
            if (studentSubjectAssignments3.length > 0) {
              assignedSubjectIds = studentSubjectAssignments3.map((a) => a.subjectId);
            } else {
              const relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
              assignedSubjectIds = relevantSubjects.map((s) => s.id);
            }
            const missingSubjectIds = assignedSubjectIds.filter((id) => !existingSubjectIds.has(id));
            if (missingSubjectIds.length > 0) {
              console.log(`[REPORT-CARD-SYNC] Adding ${missingSubjectIds.length} missing subjects to existing report card ${reportCardId} for student ${studentId}`);
              for (const missingSubjectId of missingSubjectIds) {
                await db2.insert(schema.reportCardItems).values({
                  reportCardId,
                  subjectId: missingSubjectId,
                  totalMarks: 100,
                  obtainedMarks: 0,
                  percentage: 0
                });
              }
            }
          }
          let reportCardItem = await db2.select().from(schema.reportCardItems).where(and2(
            eq2(schema.reportCardItems.reportCardId, reportCardId),
            eq2(schema.reportCardItems.subjectId, subjectId)
          )).limit(1);
          if (reportCardItem.length === 0) {
            const newItem = await db2.insert(schema.reportCardItems).values({
              reportCardId,
              subjectId,
              totalMarks: 100,
              obtainedMarks: 0,
              percentage: 0
            }).returning();
            reportCardItem = newItem;
          }
          if (reportCardItem[0].isOverridden) {
            console.log(`[REPORT-CARD-SYNC] Item ${reportCardItem[0].id} is manually overridden, skipping auto-update`);
            return { success: true, reportCardId, message: "Skipped - item manually overridden" };
          }
          const isTest = ["test", "quiz", "assignment"].includes(examType);
          const isMainExam = ["exam", "final", "midterm"].includes(examType);
          const safeScore = typeof score === "number" ? score : parseInt(String(score), 10) || 0;
          const safeMaxScore = typeof maxScore === "number" ? maxScore : parseInt(String(maxScore), 10) || 0;
          const safeExamId = typeof examId === "number" ? examId : parseInt(String(examId), 10);
          console.log(`[REPORT-CARD-SYNC] Type-safe values: score=${safeScore}, maxScore=${safeMaxScore}, examId=${safeExamId}, examType=${examType}`);
          const updateData = {
            updatedAt: /* @__PURE__ */ new Date()
          };
          if (isTest) {
            updateData.testExamId = safeExamId;
            updateData.testExamCreatedBy = examCreatedBy;
            updateData.testScore = safeScore;
            updateData.testMaxScore = safeMaxScore;
          } else if (isMainExam) {
            updateData.examExamId = safeExamId;
            updateData.examExamCreatedBy = examCreatedBy;
            updateData.examScore = safeScore;
            updateData.examMaxScore = safeMaxScore;
          } else {
            updateData.testExamId = safeExamId;
            updateData.testExamCreatedBy = examCreatedBy;
            updateData.testScore = safeScore;
            updateData.testMaxScore = safeMaxScore;
          }
          const existingItem = reportCardItem[0];
          const finalTestScore = isTest ? safeScore : existingItem.testScore ?? null;
          const finalTestMaxScore = isTest ? safeMaxScore : existingItem.testMaxScore ?? null;
          const finalExamScore = isMainExam ? safeScore : existingItem.examScore ?? null;
          const finalExamMaxScore = isMainExam ? safeMaxScore : existingItem.examMaxScore ?? null;
          const gradingConfig = getGradingConfig(gradingScale);
          const weighted = calculateWeightedScore(finalTestScore, finalTestMaxScore, finalExamScore, finalExamMaxScore, gradingConfig);
          const gradeInfo = calculateGradeFromPercentage(weighted.percentage, gradingScale);
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
          await db2.update(schema.reportCardItems).set(updateData).where(eq2(schema.reportCardItems.id, existingItem.id));
          console.log(`[REPORT-CARD-SYNC] Updated report card item ${existingItem.id} with ${isTest ? "test" : "exam"} score: ${score}/${maxScore}, grade: ${gradeInfo.grade}`);
          await this.recalculateReportCard(reportCardId, gradingScale);
          await this.recalculateClassPositions(classId, termId);
          console.log(`[REPORT-CARD-SYNC] Successfully synced exam ${examId} to report card ${reportCardId} (new: ${isNewReportCard})`);
          return {
            success: true,
            reportCardId,
            isNewReportCard,
            message: isNewReportCard ? `New report card auto-created. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)` : `Score synced to report card. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)`
          };
        } catch (error) {
          console.error("[REPORT-CARD-SYNC] Error syncing exam score to report card:", error);
          return { success: false, message: error.message || "Failed to sync score to report card" };
        }
      }
      // Get report cards accessible by a specific teacher (only subjects where they created exams)
      // This allows teachers to see and edit only the subjects where they created the test or main exam
      async getTeacherAccessibleReportCards(teacherId, termId, classId) {
        try {
          const conditions = [
            or2(
              eq2(schema.reportCardItems.testExamCreatedBy, teacherId),
              eq2(schema.reportCardItems.examExamCreatedBy, teacherId)
            )
          ];
          if (termId) {
            conditions.push(eq2(schema.reportCards.termId, termId));
          }
          if (classId) {
            conditions.push(eq2(schema.reportCards.classId, classId));
          }
          const items = await db2.select({
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
            studentName: sql2`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as("studentName"),
            admissionNumber: schema.students.admissionNumber,
            className: schema.classes.name,
            termName: schema.academicTerms.name,
            canEditTest: sql2`CASE WHEN ${schema.reportCardItems.testExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as("canEditTest"),
            canEditExam: sql2`CASE WHEN ${schema.reportCardItems.examExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as("canEditExam")
          }).from(schema.reportCardItems).innerJoin(schema.reportCards, eq2(schema.reportCardItems.reportCardId, schema.reportCards.id)).innerJoin(schema.subjects, eq2(schema.reportCardItems.subjectId, schema.subjects.id)).innerJoin(schema.students, eq2(schema.reportCards.studentId, schema.students.id)).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).innerJoin(schema.classes, eq2(schema.reportCards.classId, schema.classes.id)).innerJoin(schema.academicTerms, eq2(schema.reportCards.termId, schema.academicTerms.id)).where(and2(...conditions)).orderBy(desc(schema.reportCards.id), schema.subjects.name);
          const reportCardMap = /* @__PURE__ */ new Map();
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
            reportCardMap.get(item.reportCardId).items.push({
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
          console.error("Error getting teacher accessible report cards:", error);
          return [];
        }
      }
      // Analytics and Reports
      async getAnalyticsOverview() {
        try {
          const [students3, teachers, admins, parents] = await Promise.all([
            db2.select().from(schema.users).where(and2(eq2(schema.users.roleId, 4), eq2(schema.users.isActive, true))),
            // Active Students only
            db2.select().from(schema.users).where(and2(eq2(schema.users.roleId, 3), eq2(schema.users.isActive, true))),
            // Active Teachers only
            db2.select().from(schema.users).where(and2(eq2(schema.users.roleId, 2), eq2(schema.users.isActive, true))),
            // Active Admins only
            db2.select().from(schema.users).where(and2(eq2(schema.users.roleId, 5), eq2(schema.users.isActive, true)))
            // Active Parents only
          ]);
          const [classes3, subjects3, exams3, examResults3] = await Promise.all([
            db2.select().from(schema.classes).where(eq2(schema.classes.isActive, true)),
            // Active classes only
            db2.select().from(schema.subjects).where(eq2(schema.subjects.isActive, true)),
            // Active subjects only
            db2.select().from(schema.exams),
            db2.select().from(schema.examResults)
          ]);
          const gradeDistribution = this.calculateGradeDistribution(examResults3);
          const subjectPerformance = await this.calculateSubjectPerformance(examResults3, subjects3);
          return {
            totalUsers: students3.length + teachers.length + admins.length + parents.length,
            totalStudents: students3.length,
            totalTeachers: teachers.length,
            totalAdmins: admins.length,
            totalParents: parents.length,
            totalClasses: classes3.length,
            totalSubjects: subjects3.length,
            totalExams: exams3.length,
            totalExamResults: examResults3.length,
            averageClassSize: classes3.length > 0 ? Math.round(students3.length / classes3.length) : 0,
            gradeDistribution,
            subjectPerformance,
            recentActivity: {
              newStudentsThisMonth: students3.filter(
                (s) => s.createdAt && new Date(s.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3)
              ).length,
              examsThisMonth: exams3.filter(
                (e) => e.createdAt && new Date(e.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3)
              ).length
            }
          };
        } catch (error) {
          return this.getFallbackAnalytics();
        }
      }
      async getPerformanceAnalytics(filters) {
        try {
          let examResults3 = await db2.select().from(schema.examResults);
          if (filters.classId) {
            const studentsInClass = await db2.select().from(schema.students).where(eq2(schema.students.classId, filters.classId));
            const studentIds = studentsInClass.map((s) => s.id);
            examResults3 = examResults3.filter((r) => studentIds.includes(r.studentId));
          }
          if (filters.subjectId) {
            const examsForSubject = await db2.select().from(schema.exams).where(eq2(schema.exams.subjectId, filters.subjectId));
            const examIds = examsForSubject.map((e) => e.id);
            examResults3 = examResults3.filter((r) => examIds.includes(r.examId));
          }
          const totalExams = examResults3.length;
          const averageScore = totalExams > 0 ? examResults3.reduce((sum, r) => sum + (r.marksObtained || 0), 0) / totalExams : 0;
          const gradeDistribution = this.calculateGradeDistribution(examResults3);
          const performanceTrends = this.calculatePerformanceTrends(examResults3);
          const studentPerformance = this.calculateStudentPerformance(examResults3);
          return {
            totalExams,
            averageScore: Math.round(averageScore * 100) / 100,
            averagePercentage: Math.round(averageScore / 100 * 100),
            // Assuming 100 is typical total marks
            gradeDistribution,
            performanceTrends,
            topPerformers: studentPerformance.slice(0, 5),
            strugglingStudents: studentPerformance.slice(-5),
            passRate: Math.round(examResults3.filter((r) => (r.marksObtained || 0) >= 50).length / totalExams * 100)
          };
        } catch (error) {
          return { error: "Failed to calculate performance analytics" };
        }
      }
      async getTrendAnalytics(months = 6) {
        try {
          const cutoffDate = /* @__PURE__ */ new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - months);
          const [students3, exams3, examResults3] = await Promise.all([
            db2.select().from(schema.users).where(and2(
              eq2(schema.users.roleId, 4)
              // Student
              // Note: In a real implementation, you'd filter by createdAt >= cutoffDate
            )),
            db2.select().from(schema.exams),
            db2.select().from(schema.examResults)
          ]);
          const monthlyData = [];
          for (let i = months - 1; i >= 0; i--) {
            const month = /* @__PURE__ */ new Date();
            month.setMonth(month.getMonth() - i);
            const monthName = month.toLocaleString("default", { month: "short" });
            const year = month.getFullYear();
            monthlyData.push({
              month: monthName,
              year,
              students: students3.length + Math.floor(Math.random() * 10) - 5,
              // Simulated variance
              exams: Math.floor(exams3.length / months) + Math.floor(Math.random() * 3),
              averageScore: 75 + Math.floor(Math.random() * 20) - 10,
              attendance: 85 + Math.floor(Math.random() * 15)
            });
          }
          return {
            monthlyTrends: monthlyData,
            summary: {
              studentsGrowth: monthlyData.length > 1 ? ((monthlyData[monthlyData.length - 1].students - monthlyData[0].students) / monthlyData[0].students * 100).toFixed(1) : 0,
              examsTrend: "stable",
              scoresTrend: "improving",
              attendanceTrend: "stable"
            }
          };
        } catch (error) {
          return { error: "Failed to calculate trend analytics" };
        }
      }
      async getAttendanceAnalytics(filters) {
        try {
          let attendance3 = await db2.select().from(schema.attendance);
          if (filters.classId) {
            const studentsInClass = await db2.select().from(schema.students).where(eq2(schema.students.classId, filters.classId));
            const studentIds = studentsInClass.map((s) => s.id);
            attendance3 = attendance3.filter((a) => studentIds.includes(a.studentId));
          }
          if (filters.startDate && filters.endDate) {
            attendance3 = attendance3.filter((a) => {
              const attendanceDate = new Date(a.date);
              return attendanceDate >= new Date(filters.startDate) && attendanceDate <= new Date(filters.endDate);
            });
          }
          const totalRecords = attendance3.length;
          const presentCount = attendance3.filter((a) => a.status === "Present").length;
          const absentCount = attendance3.filter((a) => a.status === "Absent").length;
          const lateCount = attendance3.filter((a) => a.status === "Late").length;
          const excusedCount = attendance3.filter((a) => a.status === "Excused").length;
          const attendanceRate = totalRecords > 0 ? Math.round(presentCount / totalRecords * 100) : 0;
          return {
            totalRecords,
            attendanceRate,
            statusBreakdown: {
              present: presentCount,
              absent: absentCount,
              late: lateCount,
              excused: excusedCount
            },
            dailyTrends: this.calculateDailyAttendanceTrends(attendance3),
            classComparison: await this.calculateClassAttendanceComparison()
          };
        } catch (error) {
          return { error: "Failed to calculate attendance analytics" };
        }
      }
      calculateGradeDistribution(examResults3) {
        const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        examResults3.forEach((result) => {
          const percentage = result.obtainedMarks / result.totalMarks * 100;
          if (percentage >= 90) grades.A++;
          else if (percentage >= 80) grades.B++;
          else if (percentage >= 70) grades.C++;
          else if (percentage >= 60) grades.D++;
          else grades.F++;
        });
        return Object.entries(grades).map(([grade, count]) => ({ grade, count }));
      }
      async calculateSubjectPerformance(examResults3, subjects3) {
        const subjectMap = /* @__PURE__ */ new Map();
        subjects3.forEach((s) => subjectMap.set(s.id, s.name));
        const performance = /* @__PURE__ */ new Map();
        examResults3.forEach((result) => {
          const examSubject = result.examId;
          if (!performance.has(examSubject)) {
            performance.set(examSubject, { total: 0, count: 0 });
          }
          const current = performance.get(examSubject);
          current.total += result.obtainedMarks;
          current.count += 1;
        });
        return Array.from(performance.entries()).map(([subjectId, data]) => ({
          subject: subjectMap.get(subjectId) || "Unknown",
          average: Math.round(data.total / data.count * 100) / 100,
          examCount: data.count
        }));
      }
      calculatePerformanceTrends(examResults3) {
        const trends = /* @__PURE__ */ new Map();
        examResults3.forEach((result) => {
          const month = new Date(result.createdAt).toLocaleString("default", { month: "short" });
          if (!trends.has(month)) {
            trends.set(month, { total: 0, count: 0 });
          }
          const current = trends.get(month);
          current.total += result.obtainedMarks;
          current.count += 1;
        });
        return Array.from(trends.entries()).map(([month, data]) => ({
          month,
          average: Math.round(data.total / data.count * 100) / 100
        }));
      }
      calculateStudentPerformance(examResults3) {
        const performance = /* @__PURE__ */ new Map();
        examResults3.forEach((result) => {
          if (!performance.has(result.studentId)) {
            performance.set(result.studentId, { total: 0, count: 0 });
          }
          const current = performance.get(result.studentId);
          current.total += result.obtainedMarks;
          current.count += 1;
        });
        return Array.from(performance.entries()).map(([studentId, data]) => ({
          studentId,
          average: Math.round(data.total / data.count * 100) / 100,
          examCount: data.count
        })).sort((a, b) => b.average - a.average);
      }
      calculateDailyAttendanceTrends(attendance3) {
        const trends = /* @__PURE__ */ new Map();
        attendance3.forEach((record) => {
          const date = record.date;
          if (!trends.has(date)) {
            trends.set(date, { present: 0, total: 0 });
          }
          const current = trends.get(date);
          current.total += 1;
          if (record.status === "Present") current.present += 1;
        });
        return Array.from(trends.entries()).map(([date, data]) => ({
          date,
          rate: Math.round(data.present / data.total * 100)
        }));
      }
      async calculateClassAttendanceComparison() {
        try {
          const classes3 = await db2.select().from(schema.classes);
          return classes3.map((cls) => ({
            className: cls.name,
            attendanceRate: 85 + Math.floor(Math.random() * 15),
            // Simplified for demo
            level: cls.level
          }));
        } catch (error) {
          return [];
        }
      }
      getFallbackAnalytics() {
        return {
          totalUsers: 0,
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSubjects: 0,
          error: "Unable to calculate analytics - database unavailable"
        };
      }
      // Contact messages management - ensuring 100% database persistence
      async createContactMessage(message) {
        const result = await this.db.insert(schema.contactMessages).values(message).returning();
        return result[0];
      }
      async getContactMessages() {
        return await this.db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt));
      }
      async getFinalizedReportsByExams(examIds, filters) {
        try {
          const results = await this.db.select().from(schema.examResults).where(and2(
            inArray2(schema.examResults.examId, examIds)
            // Add teacherFinalized field check when column exists
            // eq(schema.examResults.teacherFinalized, true)
          )).orderBy(desc(schema.examResults.createdAt));
          return results;
        } catch (error) {
          return [];
        }
      }
      async getAllFinalizedReports(filters) {
        try {
          const results = await this.db.select().from(schema.examResults).orderBy(desc(schema.examResults.createdAt));
          return results;
        } catch (error) {
          return [];
        }
      }
      async getContactMessageById(id) {
        const result = await this.db.select().from(schema.contactMessages).where(eq2(schema.contactMessages.id, id)).limit(1);
        return result[0];
      }
      async markContactMessageAsRead(id) {
        const result = await this.db.update(schema.contactMessages).set({ isRead: true }).where(eq2(schema.contactMessages.id, id)).returning();
        return result.length > 0;
      }
      async respondToContactMessage(id, response, respondedBy) {
        const result = await this.db.update(schema.contactMessages).set({
          response,
          respondedBy,
          respondedAt: /* @__PURE__ */ new Date(),
          isRead: true
        }).where(eq2(schema.contactMessages.id, id)).returning();
        return result[0];
      }
      // Performance monitoring implementation
      async logPerformanceEvent(event) {
        const result = await this.db.insert(schema.performanceEvents).values(event).returning();
        return result[0];
      }
      async getPerformanceMetrics(hours = 24) {
        try {
          const since = new Date(Date.now() - hours * 60 * 60 * 1e3);
          const sinceISO = since.toISOString();
          const events = await this.db.select().from(schema.performanceEvents).where(sql2`${schema.performanceEvents.createdAt} >= ${sinceISO}`);
          const totalEvents = events.length;
          const goalAchievedCount = events.filter((e) => e.goalAchieved).length;
          const goalAchievementRate = totalEvents > 0 ? goalAchievedCount / totalEvents * 100 : 0;
          const averageDuration = totalEvents > 0 ? events.reduce((sum, e) => sum + e.duration, 0) / totalEvents : 0;
          const slowSubmissions = events.filter((e) => e.duration > 2e3).length;
          const eventsByType = {};
          events.forEach((e) => {
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
          return {
            totalEvents: 0,
            goalAchievementRate: 0,
            averageDuration: 0,
            slowSubmissions: 0,
            eventsByType: {}
          };
        }
      }
      async getRecentPerformanceAlerts(hours = 24) {
        try {
          const since = new Date(Date.now() - hours * 60 * 60 * 1e3);
          const sinceISO = since.toISOString();
          const alerts = await this.db.select().from(schema.performanceEvents).where(and2(
            sql2`${schema.performanceEvents.createdAt} >= ${sinceISO}`,
            eq2(schema.performanceEvents.goalAchieved, false)
          )).orderBy(desc(schema.performanceEvents.createdAt)).limit(50);
          return alerts;
        } catch (error) {
          return [];
        }
      }
      // Teacher class assignments implementation
      async createTeacherClassAssignment(assignment) {
        const result = await this.db.insert(schema.teacherClassAssignments).values(assignment).returning();
        return result[0];
      }
      async getTeacherClassAssignments(teacherId) {
        return await this.db.select().from(schema.teacherClassAssignments).where(and2(
          eq2(schema.teacherClassAssignments.teacherId, teacherId),
          eq2(schema.teacherClassAssignments.isActive, true)
        )).orderBy(schema.teacherClassAssignments.createdAt);
      }
      async getTeachersForClassSubject(classId, subjectId) {
        const assignments = await this.db.select({
          user: schema.users
        }).from(schema.teacherClassAssignments).innerJoin(schema.users, eq2(schema.teacherClassAssignments.teacherId, schema.users.id)).where(and2(
          eq2(schema.teacherClassAssignments.classId, classId),
          eq2(schema.teacherClassAssignments.subjectId, subjectId),
          eq2(schema.teacherClassAssignments.isActive, true)
        ));
        return assignments.map((a) => a.user);
      }
      async updateTeacherClassAssignment(id, assignment) {
        const result = await this.db.update(schema.teacherClassAssignments).set(assignment).where(eq2(schema.teacherClassAssignments.id, id)).returning();
        return result[0];
      }
      async deleteTeacherClassAssignment(id) {
        const result = await this.db.delete(schema.teacherClassAssignments).where(eq2(schema.teacherClassAssignments.id, id)).returning();
        return result.length > 0;
      }
      async getTeacherAssignmentsForClass(teacherId, classId) {
        try {
          const now = /* @__PURE__ */ new Date();
          const assignments = await this.db.select({
            subjectId: schema.teacherClassAssignments.subjectId,
            subjectName: schema.subjects.name
          }).from(schema.teacherClassAssignments).innerJoin(schema.subjects, eq2(schema.teacherClassAssignments.subjectId, schema.subjects.id)).where(and2(
            eq2(schema.teacherClassAssignments.teacherId, teacherId),
            eq2(schema.teacherClassAssignments.classId, classId),
            eq2(schema.teacherClassAssignments.isActive, true),
            or2(
              isNull(schema.teacherClassAssignments.validUntil),
              gte(schema.teacherClassAssignments.validUntil, now)
            )
          ));
          return assignments;
        } catch (error) {
          console.error("Error getting teacher assignments for class:", error);
          return [];
        }
      }
      // Teacher timetable implementation
      async createTimetableEntry(entry) {
        const result = await this.db.insert(schema.timetable).values(entry).returning();
        return result[0];
      }
      async getTimetableByTeacher(teacherId, termId) {
        const conditions = [
          eq2(schema.timetable.teacherId, teacherId),
          eq2(schema.timetable.isActive, true)
        ];
        if (termId) {
          conditions.push(eq2(schema.timetable.termId, termId));
        }
        return await this.db.select().from(schema.timetable).where(and2(...conditions)).orderBy(schema.timetable.dayOfWeek, schema.timetable.startTime);
      }
      async updateTimetableEntry(id, entry) {
        const result = await this.db.update(schema.timetable).set(entry).where(eq2(schema.timetable.id, id)).returning();
        return result[0];
      }
      async deleteTimetableEntry(id) {
        const result = await this.db.delete(schema.timetable).where(eq2(schema.timetable.id, id)).returning();
        return result.length > 0;
      }
      // Teacher dashboard data - comprehensive method
      async getTeacherDashboardData(teacherId) {
        const profile = await this.getTeacherProfile(teacherId);
        const user = await this.getUser(teacherId);
        const assignmentsData = await this.db.select({
          id: schema.teacherClassAssignments.id,
          className: schema.classes.name,
          classLevel: schema.classes.level,
          subjectName: schema.subjects.name,
          subjectCode: schema.subjects.code,
          termName: schema.academicTerms.name
        }).from(schema.teacherClassAssignments).innerJoin(schema.classes, eq2(schema.teacherClassAssignments.classId, schema.classes.id)).innerJoin(schema.subjects, eq2(schema.teacherClassAssignments.subjectId, schema.subjects.id)).leftJoin(schema.academicTerms, eq2(schema.teacherClassAssignments.termId, schema.academicTerms.id)).where(and2(
          eq2(schema.teacherClassAssignments.teacherId, teacherId),
          eq2(schema.teacherClassAssignments.isActive, true)
        )).orderBy(schema.classes.name, schema.subjects.name);
        const timetableData = await this.db.select({
          id: schema.timetable.id,
          dayOfWeek: schema.timetable.dayOfWeek,
          startTime: schema.timetable.startTime,
          endTime: schema.timetable.endTime,
          location: schema.timetable.location,
          className: schema.classes.name,
          subjectName: schema.subjects.name
        }).from(schema.timetable).innerJoin(schema.classes, eq2(schema.timetable.classId, schema.classes.id)).innerJoin(schema.subjects, eq2(schema.timetable.subjectId, schema.subjects.id)).where(and2(
          eq2(schema.timetable.teacherId, teacherId),
          eq2(schema.timetable.isActive, true)
        )).orderBy(schema.timetable.dayOfWeek, schema.timetable.startTime);
        return {
          profile,
          user,
          assignments: assignmentsData,
          timetable: timetableData
        };
      }
      // Manual grading task queue
      async createGradingTask(task) {
        try {
          const result = await this.db.insert(schema.gradingTasks).values(task).returning();
          return result[0];
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return { id: 0, ...task };
          }
          throw error;
        }
      }
      async assignGradingTask(taskId, teacherId) {
        try {
          const result = await this.db.update(schema.gradingTasks).set({
            assignedTeacherId: teacherId,
            assignedAt: /* @__PURE__ */ new Date(),
            status: "in_progress"
          }).where(eq2(schema.gradingTasks.id, taskId)).returning();
          return result[0];
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return void 0;
          }
          throw error;
        }
      }
      async getGradingTasksByTeacher(teacherId, status) {
        try {
          let query = this.db.select().from(schema.gradingTasks).where(eq2(schema.gradingTasks.assignedTeacherId, teacherId)).orderBy(desc(schema.gradingTasks.priority), asc(schema.gradingTasks.createdAt));
          if (status) {
            query = query.where(and2(
              eq2(schema.gradingTasks.assignedTeacherId, teacherId),
              eq2(schema.gradingTasks.status, status)
            ));
          }
          return await query;
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return [];
          }
          throw error;
        }
      }
      async getGradingTasksBySession(sessionId) {
        try {
          return await this.db.select().from(schema.gradingTasks).where(eq2(schema.gradingTasks.sessionId, sessionId)).orderBy(desc(schema.gradingTasks.priority), asc(schema.gradingTasks.createdAt));
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return [];
          }
          throw error;
        }
      }
      async updateGradingTaskStatus(taskId, status, completedAt) {
        try {
          const updateData = { status };
          if (completedAt) {
            updateData.completedAt = completedAt;
          }
          const result = await this.db.update(schema.gradingTasks).set(updateData).where(eq2(schema.gradingTasks.id, taskId)).returning();
          return result[0];
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return void 0;
          }
          throw error;
        }
      }
      async completeGradingTask(taskId, pointsEarned, feedbackText) {
        try {
          const tasks = await this.db.select().from(schema.gradingTasks).where(eq2(schema.gradingTasks.id, taskId)).limit(1);
          if (tasks.length === 0) {
            return void 0;
          }
          const task = tasks[0];
          const answers = await this.db.update(schema.studentAnswers).set({
            pointsEarned,
            feedbackText,
            autoScored: false,
            manualOverride: true
          }).where(eq2(schema.studentAnswers.id, task.answerId)).returning();
          const updatedTasks = await this.db.update(schema.gradingTasks).set({
            status: "completed",
            completedAt: /* @__PURE__ */ new Date()
          }).where(eq2(schema.gradingTasks.id, taskId)).returning();
          return {
            task: updatedTasks[0],
            answer: answers[0]
          };
        } catch (error) {
          if (error?.cause?.code === "42P01") {
            return void 0;
          }
          throw error;
        }
      }
      // Audit logging implementation
      async createAuditLog(log) {
        const result = await this.db.insert(schema.auditLogs).values(log).returning();
        return result[0];
      }
      async getAuditLogs(filters) {
        const conditions = [];
        if (filters?.userId) {
          conditions.push(eq2(schema.auditLogs.userId, filters.userId));
        }
        if (filters?.entityType) {
          conditions.push(eq2(schema.auditLogs.entityType, filters.entityType));
        }
        if (filters?.entityId) {
          conditions.push(eq2(schema.auditLogs.entityId, filters.entityId));
        }
        if (filters?.action) {
          conditions.push(eq2(schema.auditLogs.action, filters.action));
        }
        if (filters?.startDate) {
          conditions.push(dsql2`${schema.auditLogs.createdAt} >= ${filters.startDate}`);
        }
        if (filters?.endDate) {
          conditions.push(dsql2`${schema.auditLogs.createdAt} <= ${filters.endDate}`);
        }
        let query = this.db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt));
        if (conditions.length > 0) {
          query = query.where(and2(...conditions));
        }
        if (filters?.limit) {
          query = query.limit(filters.limit);
        }
        return await query;
      }
      async getAuditLogsByEntity(entityType, entityId) {
        return await this.db.select().from(schema.auditLogs).where(and2(
          eq2(schema.auditLogs.entityType, entityType),
          eq2(schema.auditLogs.entityId, entityId)
        )).orderBy(desc(schema.auditLogs.createdAt));
      }
      // Notification management implementation
      async createNotification(notification) {
        const result = await this.db.insert(schema.notifications).values(notification).returning();
        return result[0];
      }
      async getNotificationsByUserId(userId) {
        return await this.db.select().from(schema.notifications).where(eq2(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt));
      }
      async getUnreadNotificationCount(userId) {
        const result = await this.db.select({ count: dsql2`count(*)::int` }).from(schema.notifications).where(and2(
          eq2(schema.notifications.userId, userId),
          eq2(schema.notifications.isRead, false)
        ));
        return result[0]?.count || 0;
      }
      async markNotificationAsRead(notificationId) {
        const result = await this.db.update(schema.notifications).set({ isRead: true }).where(eq2(schema.notifications.id, notificationId)).returning();
        return result[0];
      }
      async markAllNotificationsAsRead(userId) {
        await this.db.update(schema.notifications).set({ isRead: true }).where(and2(
          eq2(schema.notifications.userId, userId),
          eq2(schema.notifications.isRead, false)
        ));
      }
      // Password reset attempt tracking for rate limiting
      async createPasswordResetAttempt(identifier, ipAddress, success) {
        const result = await this.db.insert(schema.passwordResetAttempts).values({
          identifier,
          ipAddress,
          success
        }).returning();
        return result[0];
      }
      async getRecentPasswordResetAttempts(identifier, minutesAgo) {
        const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1e3);
        return await this.db.select().from(schema.passwordResetAttempts).where(and2(
          eq2(schema.passwordResetAttempts.identifier, identifier),
          dsql2`${schema.passwordResetAttempts.attemptedAt} > ${cutoffTime}`
        )).orderBy(desc(schema.passwordResetAttempts.attemptedAt));
      }
      async deleteOldPasswordResetAttempts(hoursAgo) {
        const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1e3);
        await this.db.delete(schema.passwordResetAttempts).where(dsql2`${schema.passwordResetAttempts.attemptedAt} < ${cutoffTime}`);
        return true;
      }
      // Account security methods
      async lockAccount(userId, lockUntil) {
        const result = await this.db.update(schema.users).set({ accountLockedUntil: lockUntil }).where(eq2(schema.users.id, userId)).returning();
        return result.length > 0;
      }
      async unlockAccount(userId) {
        const result = await this.db.update(schema.users).set({ accountLockedUntil: null }).where(eq2(schema.users.id, userId)).returning();
        return result.length > 0;
      }
      async isAccountLocked(userId) {
        const user = await this.db.select({ accountLockedUntil: schema.users.accountLockedUntil }).from(schema.users).where(eq2(schema.users.id, userId)).limit(1);
        if (!user[0] || !user[0].accountLockedUntil) {
          return false;
        }
        return new Date(user[0].accountLockedUntil) > /* @__PURE__ */ new Date();
      }
      // Admin recovery powers
      async adminResetUserPassword(userId, newPasswordHash, resetBy, forceChange) {
        const result = await this.db.update(schema.users).set({
          passwordHash: newPasswordHash,
          mustChangePassword: forceChange
        }).where(eq2(schema.users.id, userId)).returning();
        if (result.length > 0) {
          await this.createAuditLog({
            userId: resetBy,
            action: "admin_password_reset",
            entityType: "user",
            entityId: "0",
            oldValue: null,
            newValue: JSON.stringify({ targetUserId: userId, forceChange }),
            reason: "Admin initiated password reset",
            ipAddress: null,
            userAgent: null
          });
        }
        return result.length > 0;
      }
      async updateRecoveryEmail(userId, recoveryEmail, updatedBy) {
        const oldUser = await this.getUser(userId);
        const result = await this.db.update(schema.users).set({ recoveryEmail }).where(eq2(schema.users.id, userId)).returning();
        if (result.length > 0) {
          await this.createAuditLog({
            userId: updatedBy,
            action: "recovery_email_updated",
            entityType: "user",
            entityId: "0",
            oldValue: oldUser?.recoveryEmail || null,
            newValue: recoveryEmail,
            reason: "Recovery email updated by admin",
            ipAddress: null,
            userAgent: null
          });
        }
        return result.length > 0;
      }
      // NEW METHODS FOR EXAM PUBLISHING
      async getScheduledExamsToPublish(now) {
        const nowISO = now.toISOString();
        return await this.db.select().from(schema.exams).where(
          and2(
            eq2(schema.exams.isPublished, false),
            dsql2`${schema.exams.startTime} <= ${nowISO}`,
            eq2(schema.exams.timerMode, "global")
            // Only publish global timer exams automatically
          )
        ).limit(50);
      }
      // Settings management methods (Module 1)
      async getSetting(key) {
        const result = await this.db.select().from(schema.settings).where(eq2(schema.settings.key, key)).limit(1);
        return result[0];
      }
      async getAllSettings() {
        return await this.db.select().from(schema.settings).orderBy(asc(schema.settings.key));
      }
      async createSetting(setting) {
        const result = await this.db.insert(schema.settings).values(setting).returning();
        return result[0];
      }
      async updateSetting(key, value, updatedBy) {
        const result = await this.db.update(schema.settings).set({ value, updatedBy, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.settings.key, key)).returning();
        return result[0];
      }
      async deleteSetting(key) {
        const result = await this.db.delete(schema.settings).where(eq2(schema.settings.key, key)).returning();
        return result.length > 0;
      }
      // Counters for atomic sequence generation (Module 1)
      async getNextSequence(classCode, year) {
        const result = await this.db.insert(schema.counters).values({
          classCode,
          year,
          sequence: 1
        }).onConflictDoUpdate({
          target: [schema.counters.classCode, schema.counters.year],
          set: {
            sequence: dsql2`${schema.counters.sequence} + 1`,
            updatedAt: /* @__PURE__ */ new Date()
          }
        }).returning();
        return result[0].sequence;
      }
      async getCounter(classCode, year) {
        const result = await this.db.select().from(schema.counters).where(
          and2(
            eq2(schema.counters.classCode, classCode),
            eq2(schema.counters.year, year)
          )
        ).limit(1);
        return result[0];
      }
      async resetCounter(classCode, year) {
        const result = await this.db.update(schema.counters).set({ sequence: 0, updatedAt: /* @__PURE__ */ new Date() }).where(
          and2(
            eq2(schema.counters.classCode, classCode),
            eq2(schema.counters.year, year)
          )
        ).returning();
        return result.length > 0;
      }
      // Job Vacancy System implementations
      async createVacancy(vacancy) {
        const result = await this.db.insert(schema.vacancies).values(vacancy).returning();
        return result[0];
      }
      async getVacancy(id) {
        const result = await this.db.select().from(schema.vacancies).where(eq2(schema.vacancies.id, id)).limit(1);
        return result[0];
      }
      async getAllVacancies(status) {
        if (status) {
          return await this.db.select().from(schema.vacancies).where(eq2(schema.vacancies.status, status)).orderBy(desc(schema.vacancies.createdAt));
        }
        return await this.db.select().from(schema.vacancies).orderBy(desc(schema.vacancies.createdAt));
      }
      async updateVacancy(id, updates) {
        const result = await this.db.update(schema.vacancies).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.vacancies.id, id)).returning();
        return result[0];
      }
      async deleteVacancy(id) {
        const result = await this.db.delete(schema.vacancies).where(eq2(schema.vacancies.id, id)).returning();
        return result.length > 0;
      }
      // Teacher Applications implementations
      async createTeacherApplication(application) {
        const result = await this.db.insert(schema.teacherApplications).values(application).returning();
        return result[0];
      }
      async getTeacherApplication(id) {
        const result = await this.db.select().from(schema.teacherApplications).where(eq2(schema.teacherApplications.id, id)).limit(1);
        return result[0];
      }
      async getAllTeacherApplications(status) {
        if (status) {
          return await this.db.select().from(schema.teacherApplications).where(eq2(schema.teacherApplications.status, status)).orderBy(desc(schema.teacherApplications.dateApplied));
        }
        return await this.db.select().from(schema.teacherApplications).orderBy(desc(schema.teacherApplications.dateApplied));
      }
      async updateTeacherApplication(id, updates) {
        const result = await this.db.update(schema.teacherApplications).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.teacherApplications.id, id)).returning();
        return result[0];
      }
      async approveTeacherApplication(applicationId, approvedBy) {
        const application = await this.getTeacherApplication(applicationId);
        if (!application) {
          throw new Error("Application not found");
        }
        const updatedApplication = await this.db.update(schema.teacherApplications).set({
          status: "approved",
          reviewedBy: approvedBy,
          reviewedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(schema.teacherApplications.id, applicationId)).returning();
        const approvedTeacher = await this.db.insert(schema.approvedTeachers).values({
          applicationId,
          googleEmail: application.googleEmail,
          fullName: application.fullName,
          subjectSpecialty: application.subjectSpecialty,
          approvedBy
        }).returning();
        return {
          application: updatedApplication[0],
          approvedTeacher: approvedTeacher[0]
        };
      }
      async rejectTeacherApplication(applicationId, reviewedBy, reason) {
        const result = await this.db.update(schema.teacherApplications).set({
          status: "rejected",
          reviewedBy,
          reviewedAt: /* @__PURE__ */ new Date(),
          rejectionReason: reason,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(schema.teacherApplications.id, applicationId)).returning();
        return result[0];
      }
      // Approved Teachers implementations
      async getApprovedTeacherByEmail(email) {
        const result = await this.db.select().from(schema.approvedTeachers).where(eq2(schema.approvedTeachers.googleEmail, email)).limit(1);
        return result[0];
      }
      async getAllApprovedTeachers() {
        return await this.db.select().from(schema.approvedTeachers).orderBy(desc(schema.approvedTeachers.dateApproved));
      }
      async deleteApprovedTeacher(id) {
        const result = await this.db.delete(schema.approvedTeachers).where(eq2(schema.approvedTeachers.id, id)).returning();
        return result.length > 0;
      }
      // Super Admin implementations
      async getSuperAdminStats() {
        const [admins, users3, exams3] = await Promise.all([
          this.getUsersByRole(1),
          // Admins have roleId 1
          this.getAllUsers(),
          this.db.select().from(schema.exams)
        ]);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
        const activeSessions = users3.filter((u) => u.updatedAt && u.updatedAt > oneHourAgo).length;
        return {
          totalAdmins: admins.length,
          totalUsers: users3.length,
          activeSessions,
          totalExams: exams3.length
        };
      }
      async getSystemSettings() {
        const result = await this.db.select().from(schema.systemSettings).limit(1);
        return result[0];
      }
      async updateSystemSettings(settings3) {
        const existing = await this.getSystemSettings();
        const updateData = { ...settings3 };
        delete updateData.id;
        delete updateData.createdAt;
        delete updateData.updatedAt;
        if (existing) {
          const result = await db2.update(schema.systemSettings).set({ ...updateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(schema.systemSettings.id, existing.id)).returning();
          const rows = result;
          if (!rows || !rows.length) throw new Error("Update failed");
          return rows[0];
        } else {
          const result = await db2.insert(schema.systemSettings).values({ ...updateData, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).returning();
          const rows = result;
          if (!rows || !rows.length) throw new Error("Insert failed");
          return rows[0];
        }
      }
      // User recovery management implementations
      async getDeletedUsers(roleFilter) {
        if (roleFilter && roleFilter.length > 0) {
          return await this.db.select().from(schema.users).where(and2(
            sql2`${schema.users.deletedAt} IS NOT NULL`,
            inArray2(schema.users.roleId, roleFilter)
          )).orderBy(desc(schema.users.deletedAt));
        }
        return await this.db.select().from(schema.users).where(sql2`${schema.users.deletedAt} IS NOT NULL`).orderBy(desc(schema.users.deletedAt));
      }
      async restoreUser(userId, restoredBy) {
        const result = await this.db.update(schema.users).set({
          isActive: true,
          deletedAt: null,
          deletedBy: null,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(schema.users.id, userId)).returning();
        return result[0];
      }
      async softDeleteUser(userId, deletedBy) {
        const result = await this.db.update(schema.users).set({
          isActive: false,
          deletedAt: /* @__PURE__ */ new Date(),
          deletedBy
        }).where(eq2(schema.users.id, userId)).returning();
        return result.length > 0;
      }
      async permanentlyDeleteUser(userId) {
        try {
          const user = await this.getUser(userId);
          if (!user) return false;
          const roleId = user.roleId;
          if (roleId === 4) {
            return await this.hardDeleteStudent(userId);
          }
          const deletionManager = new SmartDeletionManager();
          const result = await deletionManager.deleteUser(userId);
          return result.success;
        } catch (error) {
          console.error("Error permanently deleting user:", error);
          return false;
        }
      }
      async getExpiredDeletedUsers(retentionDays) {
        const cutoffDate = /* @__PURE__ */ new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        return await this.db.select().from(schema.users).where(and2(
          sql2`${schema.users.deletedAt} IS NOT NULL`,
          lte(schema.users.deletedAt, cutoffDate)
        )).orderBy(asc(schema.users.deletedAt));
      }
      async permanentlyDeleteExpiredUsers(retentionDays) {
        const expiredUsers = await this.getExpiredDeletedUsers(retentionDays);
        let deleted = 0;
        const errors = [];
        for (const user of expiredUsers) {
          try {
            const success = await this.permanentlyDeleteUser(user.id);
            if (success) {
              deleted++;
              console.log(`Permanently deleted expired user: ${user.username || user.email} (ID: ${user.id})`);
            } else {
              errors.push(`Failed to delete user ${user.id}`);
            }
          } catch (error) {
            errors.push(`Error deleting user ${user.id}: ${error.message}`);
          }
        }
        return { deleted, errors };
      }
      // Student subject assignment implementations
      async createStudentSubjectAssignment(assignment) {
        const result = await this.db.insert(schema.studentSubjectAssignments).values(assignment).returning();
        return result[0];
      }
      async getStudentSubjectAssignments(studentId) {
        return await this.db.select().from(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.studentId, studentId));
      }
      async getStudentSubjectAssignmentsByClass(classId) {
        return await this.db.select().from(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.classId, classId));
      }
      async deleteStudentSubjectAssignment(id) {
        const result = await this.db.delete(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.id, id)).returning();
        return result.length > 0;
      }
      async deleteStudentSubjectAssignmentsByStudent(studentId) {
        await this.db.delete(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.studentId, studentId));
        return true;
      }
      async assignSubjectsToStudent(studentId, classId, subjectIds, termId, assignedBy) {
        const assignments = [];
        for (const subjectId of subjectIds) {
          try {
            const result = await this.db.insert(schema.studentSubjectAssignments).values({
              studentId,
              classId,
              subjectId,
              termId: termId || null,
              assignedBy: assignedBy || null,
              isActive: true
            }).onConflictDoNothing().returning();
            if (result[0]) {
              assignments.push(result[0]);
            }
          } catch (e) {
          }
        }
        return assignments;
      }
      // Class subject mapping implementations
      async createClassSubjectMapping(mapping) {
        const result = await this.db.insert(schema.classSubjectMappings).values(mapping).onConflictDoNothing().returning();
        if (!result[0]) {
          const existing = await this.db.select().from(schema.classSubjectMappings).where(
            and2(
              eq2(schema.classSubjectMappings.classId, mapping.classId),
              eq2(schema.classSubjectMappings.subjectId, mapping.subjectId)
            )
          ).limit(1);
          return existing[0];
        }
        return result[0];
      }
      async getClassSubjectMappingById(id) {
        const result = await this.db.select().from(schema.classSubjectMappings).where(eq2(schema.classSubjectMappings.id, id)).limit(1);
        return result[0];
      }
      async getClassSubjectMappings(classId, department) {
        if (department) {
          return await this.db.select().from(schema.classSubjectMappings).where(
            and2(
              eq2(schema.classSubjectMappings.classId, classId),
              or2(
                eq2(schema.classSubjectMappings.department, department),
                isNull(schema.classSubjectMappings.department)
              )
            )
          );
        }
        return await this.db.select().from(schema.classSubjectMappings).where(eq2(schema.classSubjectMappings.classId, classId));
      }
      async getAllClassSubjectMappings() {
        return await this.db.select().from(schema.classSubjectMappings);
      }
      async getSubjectsByClassAndDepartment(classId, department) {
        const mappings = await this.getClassSubjectMappings(classId, department);
        if (mappings.length === 0) return [];
        const subjectIds = mappings.map((m) => m.subjectId);
        return await this.db.select().from(schema.subjects).where(
          and2(
            inArray2(schema.subjects.id, subjectIds),
            eq2(schema.subjects.isActive, true)
          )
        );
      }
      async deleteClassSubjectMapping(id) {
        const result = await this.db.delete(schema.classSubjectMappings).where(eq2(schema.classSubjectMappings.id, id)).returning();
        return result.length > 0;
      }
      async deleteClassSubjectMappingsByClass(classId) {
        await this.db.delete(schema.classSubjectMappings).where(eq2(schema.classSubjectMappings.classId, classId));
        return true;
      }
      async bulkUpdateClassSubjectMappings(additions, removals) {
        return await this.db.transaction(async (tx) => {
          const affectedClassIds = /* @__PURE__ */ new Set();
          let addedCount = 0;
          let removedCount = 0;
          for (const removal of removals) {
            const { classId, subjectId, department } = removal;
            if (!classId || !subjectId) continue;
            affectedClassIds.add(classId);
            if (department === null) {
              const result = await tx.delete(schema.classSubjectMappings).where(
                and2(
                  eq2(schema.classSubjectMappings.classId, classId),
                  eq2(schema.classSubjectMappings.subjectId, subjectId),
                  sql2`${schema.classSubjectMappings.department} IS NULL`
                )
              ).returning();
              removedCount += result.length;
            } else {
              const result = await tx.delete(schema.classSubjectMappings).where(
                and2(
                  eq2(schema.classSubjectMappings.classId, classId),
                  eq2(schema.classSubjectMappings.subjectId, subjectId),
                  eq2(schema.classSubjectMappings.department, department)
                )
              ).returning();
              removedCount += result.length;
            }
          }
          for (const addition of additions) {
            const { classId, subjectId, department, isCompulsory } = addition;
            if (!classId || !subjectId) continue;
            affectedClassIds.add(classId);
            const result = await tx.insert(schema.classSubjectMappings).values({
              classId,
              subjectId,
              department: department || null,
              isCompulsory: isCompulsory || false
            }).onConflictDoNothing().returning();
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
      async getSubjectsByCategory(category) {
        return await this.db.select().from(schema.subjects).where(
          and2(
            eq2(schema.subjects.category, category),
            eq2(schema.subjects.isActive, true)
          )
        );
      }
      async getSubjectsForClassLevel(classLevel, department) {
        const classesAtLevel = await this.db.select().from(schema.classes).where(eq2(schema.classes.level, classLevel)).limit(1);
        if (classesAtLevel.length > 0) {
          const classId = classesAtLevel[0].id;
          const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, department);
          if (mappedSubjects.length > 0) {
            return mappedSubjects;
          }
        }
        console.log(`[SUBJECT-ASSIGNMENT] No class_subject_mappings found for level ${classLevel}, department: ${department || "none"}. Admin must assign subjects.`);
        return [];
      }
      async autoAssignSubjectsToStudent(studentId, classId, department) {
        const classInfo = await this.getClass(classId);
        if (!classInfo) {
          throw new Error("Class not found");
        }
        const currentTerm = await this.getCurrentTerm();
        const termId = currentTerm?.id;
        const subjects3 = await this.getSubjectsForClassLevel(classInfo.level, department);
        if (subjects3.length === 0) {
          console.log(`[AUTO-ASSIGN] No subjects found for class ${classId}, department: ${department || "none"}. Admin must assign subjects.`);
          return [];
        }
        const subjectIds = subjects3.map((s) => s.id);
        return await this.assignSubjectsToStudent(studentId, classId, subjectIds, termId);
      }
      async syncStudentsWithClassMappings(classId, department) {
        const errors = [];
        let synced = 0;
        try {
          const classInfo = await this.getClass(classId);
          if (!classInfo) {
            return { synced: 0, errors: ["Class not found"] };
          }
          const isSeniorSecondary = classInfo.level && ["SS1", "SS2", "SS3", "Senior Secondary"].some(
            (level) => classInfo.level?.toLowerCase().includes(level.toLowerCase())
          );
          const students3 = await this.getStudentsByClass(classId);
          for (const student of students3) {
            try {
              const studentDept = student.department?.toLowerCase()?.trim() || void 0;
              if (department && studentDept !== department.toLowerCase().trim()) {
                continue;
              }
              const effectiveDept = isSeniorSecondary ? studentDept : void 0;
              const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, effectiveDept);
              if (mappedSubjects.length === 0) {
                errors.push(`No subjects mapped for student ${student.id} (class ${classId}, dept: ${effectiveDept || "none"})`);
                continue;
              }
              await db2.delete(schema.studentSubjectAssignments).where(eq2(schema.studentSubjectAssignments.studentId, student.id));
              const currentTerm = await this.getCurrentTerm();
              for (const subject of mappedSubjects) {
                await db2.insert(schema.studentSubjectAssignments).values({
                  studentId: student.id,
                  classId,
                  subjectId: subject.id,
                  termId: currentTerm?.id || null,
                  isActive: true
                }).onConflictDoNothing();
              }
              synced++;
            } catch (studentError) {
              errors.push(`Failed to sync student ${student.id}: ${studentError.message}`);
            }
          }
          console.log(`[SYNC] Synced ${synced} students in class ${classId}${department ? ` (${department})` : ""}`);
          return { synced, errors };
        } catch (error) {
          console.error("[SYNC] Error syncing students with class mappings:", error);
          return { synced: 0, errors: [error.message] };
        }
      }
      async syncAllStudentsWithMappings() {
        let totalSynced = 0;
        const allErrors = [];
        try {
          const classes3 = await this.getClasses();
          for (const classInfo of classes3) {
            const result = await this.syncStudentsWithClassMappings(classInfo.id);
            totalSynced += result.synced;
            allErrors.push(...result.errors);
          }
          console.log(`[SYNC] Total synced: ${totalSynced} students across ${classes3.length} classes`);
          return { synced: totalSynced, errors: allErrors };
        } catch (error) {
          console.error("[SYNC] Error syncing all students:", error);
          return { synced: 0, errors: [error.message] };
        }
      }
      async cleanupReportCardItems(studentId) {
        try {
          const student = await this.getStudent(studentId);
          if (!student || !student.classId) {
            return { removed: 0, kept: 0 };
          }
          const classInfo = await this.getClass(student.classId);
          if (!classInfo) {
            return { removed: 0, kept: 0 };
          }
          const isSeniorSecondary = classInfo.level && ["SS1", "SS2", "SS3", "Senior Secondary"].some(
            (level) => classInfo.level?.toLowerCase().includes(level.toLowerCase()) || classInfo.name?.toLowerCase().includes(level.toLowerCase())
          );
          const studentDept = student.department?.toLowerCase()?.trim() || void 0;
          const effectiveDept = isSeniorSecondary ? studentDept : void 0;
          const allowedSubjects = await this.getSubjectsByClassAndDepartment(student.classId, effectiveDept);
          const allowedSubjectIds = new Set(allowedSubjects.map((s) => s.id));
          const reportCards3 = await db2.select().from(schema.reportCards).where(eq2(schema.reportCards.studentId, studentId));
          let totalRemoved = 0;
          let totalKept = 0;
          for (const reportCard of reportCards3) {
            const items = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCard.id));
            for (const item of items) {
              if (!allowedSubjectIds.has(item.subjectId)) {
                await db2.delete(schema.reportCardItems).where(eq2(schema.reportCardItems.id, item.id));
                totalRemoved++;
              } else {
                totalKept++;
              }
            }
          }
          console.log(`[CLEANUP] Student ${studentId}: removed ${totalRemoved} items, kept ${totalKept}`);
          return { removed: totalRemoved, kept: totalKept };
        } catch (error) {
          console.error(`[CLEANUP] Error cleaning up report card for student ${studentId}:`, error);
          return { removed: 0, kept: 0 };
        }
      }
      async cleanupReportCardsForClasses(classIds) {
        let studentsProcessed = 0;
        let totalItemsRemoved = 0;
        const errors = [];
        if (!classIds || classIds.length === 0) {
          return { studentsProcessed: 0, itemsRemoved: 0, errors: [] };
        }
        try {
          const students3 = await db2.select({ id: schema.students.id }).from(schema.students).where(inArray2(schema.students.classId, classIds));
          console.log(`[CLEANUP] Processing ${students3.length} students from ${classIds.length} affected classes`);
          for (const student of students3) {
            try {
              const result = await this.cleanupReportCardItems(student.id);
              totalItemsRemoved += result.removed;
              studentsProcessed++;
            } catch (error) {
              errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
            }
          }
          console.log(`[CLEANUP] Processed ${studentsProcessed} students in affected classes, removed ${totalItemsRemoved} report card items`);
          return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
        } catch (error) {
          console.error("[CLEANUP] Error cleaning up report cards for classes:", error);
          return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
        }
      }
      async cleanupAllReportCards() {
        let studentsProcessed = 0;
        let totalItemsRemoved = 0;
        const errors = [];
        try {
          const students3 = await db2.select({ id: schema.students.id }).from(schema.students);
          for (const student of students3) {
            try {
              const result = await this.cleanupReportCardItems(student.id);
              totalItemsRemoved += result.removed;
              studentsProcessed++;
            } catch (error) {
              errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
            }
          }
          console.log(`[CLEANUP] Processed ${studentsProcessed} students, removed ${totalItemsRemoved} report card items`);
          return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
        } catch (error) {
          console.error("[CLEANUP] Error cleaning up all report cards:", error);
          return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
        }
      }
      /**
       * FIX: Add missing subjects to existing report cards when new mappings are added
       * This ensures report cards are updated when admin adds new subjects to class/department mappings
       */
      async addMissingSubjectsToReportCards(classIds) {
        let studentsProcessed = 0;
        let totalItemsAdded = 0;
        let examScoresSynced = 0;
        const errors = [];
        if (!classIds || classIds.length === 0) {
          return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [] };
        }
        try {
          const currentTerm = await this.getCurrentTerm();
          if (!currentTerm) {
            console.log("[ADD-MISSING-SUBJECTS] No current term found, skipping");
            return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: ["No current term"] };
          }
          const students3 = await db2.select({
            id: schema.students.id,
            classId: schema.students.classId,
            department: schema.students.department,
            admissionNumber: schema.students.admissionNumber
          }).from(schema.students).innerJoin(schema.users, eq2(schema.students.id, schema.users.id)).where(and2(
            inArray2(schema.students.classId, classIds),
            eq2(schema.users.isActive, true)
          ));
          console.log(`[ADD-MISSING-SUBJECTS] Processing ${students3.length} students from ${classIds.length} classes`);
          for (const student of students3) {
            try {
              if (!student.classId) continue;
              const classInfo = await this.getClass(student.classId);
              if (!classInfo) continue;
              const isSeniorSecondary = classInfo.level && ["SS1", "SS2", "SS3", "Senior Secondary"].some(
                (level) => classInfo.level?.toLowerCase().includes(level.toLowerCase()) || classInfo.name?.toLowerCase().includes(level.toLowerCase())
              );
              const studentDept = student.department?.toLowerCase()?.trim() || void 0;
              const effectiveDept = isSeniorSecondary ? studentDept : void 0;
              const allowedSubjects = await this.getSubjectsByClassAndDepartment(student.classId, effectiveDept);
              const allowedSubjectIds = new Set(allowedSubjects.map((s) => s.id));
              if (allowedSubjects.length === 0) continue;
              const reportCards3 = await db2.select().from(schema.reportCards).where(and2(
                eq2(schema.reportCards.studentId, student.id),
                eq2(schema.reportCards.termId, currentTerm.id)
              ));
              for (const reportCard of reportCards3) {
                const existingItems = await db2.select().from(schema.reportCardItems).where(eq2(schema.reportCardItems.reportCardId, reportCard.id));
                const existingSubjectIds = new Set(existingItems.map((item) => item.subjectId));
                const missingSubjectIds = [...allowedSubjectIds].filter((id) => !existingSubjectIds.has(id));
                if (missingSubjectIds.length > 0) {
                  console.log(`[ADD-MISSING-SUBJECTS] Student ${student.id}: adding ${missingSubjectIds.length} missing subjects to report card ${reportCard.id}`);
                  for (const subjectId of missingSubjectIds) {
                    const newItem = await db2.insert(schema.reportCardItems).values({
                      reportCardId: reportCard.id,
                      subjectId,
                      totalMarks: 100,
                      obtainedMarks: 0,
                      percentage: 0
                    }).returning();
                    totalItemsAdded++;
                    const examResults3 = await db2.select({
                      examId: schema.examResults.examId,
                      score: schema.examResults.score,
                      maxScore: schema.examResults.maxScore,
                      examType: schema.exams.examType,
                      gradingScale: schema.exams.gradingScale,
                      createdBy: schema.exams.createdBy
                    }).from(schema.examResults).innerJoin(schema.exams, eq2(schema.examResults.examId, schema.exams.id)).where(and2(
                      eq2(schema.examResults.studentId, student.id),
                      eq2(schema.exams.subjectId, subjectId),
                      eq2(schema.exams.termId, currentTerm.id)
                    ));
                    if (examResults3.length > 0 && newItem.length > 0) {
                      for (const examResult of examResults3) {
                        const isTest = ["test", "quiz", "assignment"].includes(examResult.examType);
                        const isMainExam = ["exam", "final", "midterm"].includes(examResult.examType);
                        const safeScore = typeof examResult.score === "number" ? examResult.score : parseInt(String(examResult.score), 10) || 0;
                        const safeMaxScore = typeof examResult.maxScore === "number" ? examResult.maxScore : parseInt(String(examResult.maxScore), 10) || 0;
                        const updateData = { updatedAt: /* @__PURE__ */ new Date() };
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
                        await db2.update(schema.reportCardItems).set(updateData).where(eq2(schema.reportCardItems.id, newItem[0].id));
                        examScoresSynced++;
                        console.log(`[ADD-MISSING-SUBJECTS] Synced exam ${examResult.examId} score (${safeScore}/${safeMaxScore}) to new item`);
                      }
                      await this.recalculateReportCard(reportCard.id, reportCard.gradingScale || "standard");
                    }
                  }
                }
              }
              studentsProcessed++;
            } catch (studentError) {
              errors.push(`Failed to process student ${student.id}: ${studentError.message}`);
            }
          }
          console.log(`[ADD-MISSING-SUBJECTS] Completed: ${studentsProcessed} students, ${totalItemsAdded} items added, ${examScoresSynced} exam scores synced`);
          return { studentsProcessed, itemsAdded: totalItemsAdded, examScoresSynced, errors };
        } catch (error) {
          console.error("[ADD-MISSING-SUBJECTS] Error:", error);
          return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
        }
      }
      /**
       * FIX: Repair all report cards by adding missing subjects and syncing exam scores
       * This is a comprehensive data repair function for existing affected students
       */
      async repairAllReportCards() {
        try {
          const classes3 = await db2.select({ id: schema.classes.id }).from(schema.classes).where(eq2(schema.classes.isActive, true));
          const classIds = classes3.map((c) => c.id);
          console.log(`[REPAIR-REPORT-CARDS] Starting repair for ${classIds.length} classes`);
          return await this.addMissingSubjectsToReportCards(classIds);
        } catch (error) {
          console.error("[REPAIR-REPORT-CARDS] Error:", error);
          return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
        }
      }
      async syncReportCardItemsOnExamSubjectChange(examId, oldSubjectId, newSubjectId) {
        const errors = [];
        try {
          console.log(`[SYNC] Syncing report card items for exam ${examId}: subject ${oldSubjectId} -> ${newSubjectId}`);
          const testExamResult = await db2.update(schema.reportCardItems).set({ subjectId: newSubjectId }).where(eq2(schema.reportCardItems.testExamId, examId));
          const examExamResult = await db2.update(schema.reportCardItems).set({ subjectId: newSubjectId }).where(eq2(schema.reportCardItems.examExamId, examId));
          const testExamCount = testExamResult?.rowCount || testExamResult?.changes || 0;
          const examExamCount = examExamResult?.rowCount || examExamResult?.changes || 0;
          const updated = testExamCount + examExamCount;
          console.log(`[SYNC] Updated ${updated} report card items for exam ${examId} (testExamId: ${testExamCount}, examExamId: ${examExamCount})`);
          return { updated, errors };
        } catch (error) {
          console.error(`[SYNC] Error syncing report card items for exam ${examId}:`, error);
          return { updated: 0, errors: [error.message] };
        }
      }
      /**
       * COMPREHENSIVE FIX: Sync all missing exam scores to existing report card items
       * This finds all exam_results that have scores but aren't reflected in report_card_items
       * and syncs them properly
       */
      async syncAllMissingExamScores(termId) {
        let synced = 0;
        let failed = 0;
        const errors = [];
        try {
          console.log(`[SYNC-ALL-MISSING] Starting comprehensive sync of missing exam scores...`);
          let targetTermId = termId;
          if (!targetTermId) {
            const currentTerm = await this.getCurrentTerm();
            if (currentTerm) {
              targetTermId = currentTerm.id;
            }
          }
          const missingExamScores = await db2.select({
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
          }).from(schema.examResults).innerJoin(schema.exams, eq2(schema.examResults.examId, schema.exams.id)).innerJoin(schema.reportCards, and2(
            eq2(schema.reportCards.studentId, schema.examResults.studentId),
            eq2(schema.reportCards.termId, schema.exams.termId)
          )).leftJoin(schema.reportCardItems, and2(
            eq2(schema.reportCardItems.reportCardId, schema.reportCards.id),
            eq2(schema.reportCardItems.subjectId, schema.exams.subjectId)
          )).where(and2(
            sql2`${schema.examResults.score} IS NOT NULL`,
            targetTermId ? eq2(schema.exams.termId, targetTermId) : sql2`1=1`,
            or2(
              // Exam type results missing in report card
              and2(
                inArray2(schema.exams.examType, ["exam", "final", "midterm"]),
                or2(
                  sql2`${schema.reportCardItems.id} IS NULL`,
                  sql2`${schema.reportCardItems.exam_score} IS NULL`
                )
              ),
              // Test type results missing in report card
              and2(
                inArray2(schema.exams.examType, ["test", "quiz", "assignment"]),
                or2(
                  sql2`${schema.reportCardItems.id} IS NULL`,
                  sql2`${schema.reportCardItems.test_score} IS NULL`
                )
              )
            )
          ));
          console.log(`[SYNC-ALL-MISSING] Found ${missingExamScores.length} exam results to sync`);
          const reportCardIdsToRecalculate = /* @__PURE__ */ new Set();
          for (const record of missingExamScores) {
            try {
              const isTest = ["test", "quiz", "assignment"].includes(record.examType);
              const isMainExam = ["exam", "final", "midterm"].includes(record.examType);
              if (isMainExam && record.currentExamScore !== null) continue;
              if (isTest && record.currentTestScore !== null) continue;
              const safeScore = typeof record.score === "number" ? record.score : parseInt(String(record.score), 10) || 0;
              const safeMaxScore = typeof record.maxScore === "number" ? record.maxScore : parseInt(String(record.maxScore), 10) || 0;
              if (record.reportCardItemId) {
                const updateData = { updatedAt: /* @__PURE__ */ new Date() };
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
                await db2.update(schema.reportCardItems).set(updateData).where(eq2(schema.reportCardItems.id, record.reportCardItemId));
                reportCardIdsToRecalculate.add(record.reportCardId);
                synced++;
                console.log(`[SYNC-ALL-MISSING] Updated item ${record.reportCardItemId}: ${isTest ? "test" : "exam"} score ${safeScore}/${safeMaxScore}`);
              } else if (record.reportCardId && record.subjectId) {
                const newItem = await db2.insert(schema.reportCardItems).values({
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
                }).returning();
                reportCardIdsToRecalculate.add(record.reportCardId);
                synced++;
                console.log(`[SYNC-ALL-MISSING] Created new item for report card ${record.reportCardId}, subject ${record.subjectId}`);
              }
            } catch (recordError) {
              failed++;
              errors.push(`Failed to sync exam result ${record.examResultId}: ${recordError.message}`);
            }
          }
          console.log(`[SYNC-ALL-MISSING] Recalculating ${reportCardIdsToRecalculate.size} report cards...`);
          for (const reportCardId of reportCardIdsToRecalculate) {
            try {
              await this.recalculateReportCard(reportCardId, "standard");
            } catch (calcError) {
              errors.push(`Failed to recalculate report card ${reportCardId}: ${calcError.message}`);
            }
          }
          console.log(`[SYNC-ALL-MISSING] Completed: ${synced} synced, ${failed} failed`);
          return { synced, failed, errors };
        } catch (error) {
          console.error("[SYNC-ALL-MISSING] Error:", error);
          return { synced: 0, failed: 0, errors: [error.message] };
        }
      }
      /**
       * Bulk sync all results for a specific exam to report cards
       * Useful for teachers to sync all their exam results at once
       */
      async syncExamResultsToReportCards(examId) {
        let synced = 0;
        let failed = 0;
        const errors = [];
        try {
          console.log(`[SYNC-EXAM-RESULTS] Starting bulk sync for exam ${examId}...`);
          const examResults3 = await db2.select({
            id: schema.examResults.id,
            studentId: schema.examResults.studentId,
            score: schema.examResults.score,
            maxScore: schema.examResults.maxScore
          }).from(schema.examResults).where(and2(
            eq2(schema.examResults.examId, examId),
            sql2`${schema.examResults.score} IS NOT NULL`
          ));
          console.log(`[SYNC-EXAM-RESULTS] Found ${examResults3.length} results to sync for exam ${examId}`);
          const exam = await this.getExamById(examId);
          if (!exam) {
            return { synced: 0, failed: 0, errors: ["Exam not found"] };
          }
          for (const result of examResults3) {
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
            } catch (studentError) {
              failed++;
              errors.push(`Student ${result.studentId}: ${studentError.message}`);
            }
          }
          console.log(`[SYNC-EXAM-RESULTS] Completed: ${synced} synced, ${failed} failed`);
          return { synced, failed, errors };
        } catch (error) {
          console.error("[SYNC-EXAM-RESULTS] Error:", error);
          return { synced: 0, failed: 0, errors: [error.message] };
        }
      }
      // Report Card Skills Methods
      async getReportCardSkills(reportCardId) {
        try {
          const result = await db2.select().from(schema.reportCardSkills).where(eq2(schema.reportCardSkills.reportCardId, reportCardId)).limit(1);
          return result[0];
        } catch (error) {
          console.error("Error getting report card skills:", error);
          return void 0;
        }
      }
      async saveReportCardSkills(reportCardId, skills) {
        try {
          const existing = await this.getReportCardSkills(reportCardId);
          if (existing) {
            const mergeSkill = (key, existingVal) => {
              const newVal = skills[key];
              return newVal !== void 0 ? newVal : existingVal ?? 0;
            };
            const result = await db2.update(schema.reportCardSkills).set({
              punctuality: mergeSkill("punctuality", existing.punctuality),
              neatness: mergeSkill("neatness", existing.neatness),
              attentiveness: mergeSkill("attentiveness", existing.attentiveness),
              teamwork: mergeSkill("teamwork", existing.teamwork),
              leadership: mergeSkill("leadership", existing.leadership),
              assignments: mergeSkill("assignments", existing.assignments),
              classParticipation: mergeSkill("classParticipation", existing.classParticipation),
              sports: mergeSkill("sports", existing.sports),
              handwriting: mergeSkill("handwriting", existing.handwriting),
              musicalSkills: mergeSkill("musicalSkills", existing.musicalSkills),
              creativity: mergeSkill("creativity", existing.creativity),
              recordedBy: skills.recordedBy,
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq2(schema.reportCardSkills.reportCardId, reportCardId)).returning();
            return result[0];
          } else {
            const result = await db2.insert(schema.reportCardSkills).values({
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
            }).returning();
            return result[0];
          }
        } catch (error) {
          console.error("Error saving report card skills:", error);
          throw error;
        }
      }
    };
    storage = initializeStorageSync();
  }
});

// server/seed-system-settings.ts
var seed_system_settings_exports = {};
__export(seed_system_settings_exports, {
  seedSystemSettings: () => seedSystemSettings
});
async function seedSystemSettings() {
  try {
    const existingSettings = await db2.select().from(systemSettings2).limit(1);
    if (existingSettings.length === 0) {
      await db2.insert(systemSettings2).values({
        schoolName: "Treasure-Home School",
        schoolMotto: "Honesty and Success",
        schoolEmail: "info@treasurehomeschool.edu.ng",
        schoolPhone: "+234-XXX-XXX-XXXX",
        schoolAddress: "Lagos, Nigeria",
        maintenanceMode: false,
        enableSmsNotifications: false,
        enableEmailNotifications: true,
        enableExamsModule: true,
        enableAttendanceModule: true,
        enableResultsModule: true,
        themeColor: "blue",
        usernameStudentPrefix: "THS-STU",
        usernameParentPrefix: "THS-PAR",
        usernameTeacherPrefix: "THS-TCH",
        usernameAdminPrefix: "THS-ADM",
        tempPasswordFormat: "THS@{year}#{random4}",
        hideAdminAccountsFromAdmins: true
      });
      console.log("\u2705 Default system settings created");
    } else {
      console.log("\u2139\uFE0F  System settings already exist");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`\u274C System settings seeding error: ${errorMessage}`);
    throw error;
  }
}
var init_seed_system_settings = __esm({
  "server/seed-system-settings.ts"() {
    "use strict";
    init_storage();
    init_schema();
  }
});

// server/seed-roles.ts
var seed_roles_exports = {};
__export(seed_roles_exports, {
  seedRoles: () => seedRoles
});
async function seedRoles() {
  try {
    const existingRoles = await db2.select().from(roles2);
    if (existingRoles.length > 0) {
      console.log(`\u2139\uFE0F  Roles already exist (${existingRoles.length} found)`);
      return;
    }
    const requiredRoles = [
      {
        id: 1,
        name: "Super Admin",
        permissions: JSON.stringify(["*"])
      },
      {
        id: 2,
        name: "Admin",
        permissions: JSON.stringify(["manage_users", "manage_classes", "manage_students", "manage_teachers", "manage_exams", "view_reports", "manage_announcements", "manage_gallery", "manage_content"])
      },
      {
        id: 3,
        name: "Teacher",
        permissions: JSON.stringify(["view_students", "manage_attendance", "manage_exams", "grade_exams", "view_classes", "manage_resources"])
      },
      {
        id: 4,
        name: "Student",
        permissions: JSON.stringify(["view_exams", "take_exams", "view_results", "view_resources", "view_announcements"])
      },
      {
        id: 5,
        name: "Parent",
        permissions: JSON.stringify(["view_students", "view_results", "view_attendance", "view_announcements"])
      }
    ];
    console.log("\u{1F4DA} Creating 5 core roles...");
    for (const roleData of requiredRoles) {
      await db2.insert(roles2).values(roleData);
      console.log(`  \u2705 Created role: ${roleData.name}`);
    }
    console.log("\u2705 All 5 roles created successfully!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`\u274C Error seeding roles: ${errorMessage}`);
    throw error;
  }
}
var init_seed_roles = __esm({
  "server/seed-roles.ts"() {
    "use strict";
    init_storage();
    init_schema();
  }
});

// server/seed-test-users.ts
var seed_test_users_exports = {};
__export(seed_test_users_exports, {
  seedTestUsers: () => seedTestUsers
});
import bcrypt2 from "bcrypt";
import { eq as eq3 } from "drizzle-orm";
import { randomUUID as randomUUID2 } from "crypto";
async function seedTestUsers() {
  try {
    const testUsers = [
      {
        id: randomUUID2(),
        username: "superadmin",
        email: "superadmin@treasurehome.com",
        password: "SuperAdmin@123",
        roleId: 1,
        firstName: "Super",
        lastName: "Admin",
        roleName: "Super Admin"
      },
      {
        id: randomUUID2(),
        username: "admin",
        email: "admin@treasurehome.com",
        password: "Admin@123",
        roleId: 2,
        firstName: "Admin",
        lastName: "User",
        roleName: "Admin"
      },
      {
        id: randomUUID2(),
        username: "teacher",
        email: "teacher@treasurehome.com",
        password: "Teacher@123",
        roleId: 3,
        firstName: "John",
        lastName: "Teacher",
        roleName: "Teacher"
      },
      {
        id: randomUUID2(),
        username: "student",
        email: "student@treasurehome.com",
        password: "Student@123",
        roleId: 4,
        firstName: "Jane",
        lastName: "Student",
        roleName: "Student"
      },
      {
        id: randomUUID2(),
        username: "parent",
        email: "parent@treasurehome.com",
        password: "Parent@123",
        roleId: 5,
        firstName: "Peter",
        lastName: "Parent",
        roleName: "Parent"
      }
    ];
    const roles3 = await db2.select().from(roles2);
    const roleMap = {};
    for (const role of roles3) {
      roleMap[role.name] = role.id;
    }
    const classes3 = await db2.select().from(classes2);
    const defaultStudentClass = classes3.find((c) => c.name === "JSS 1") || classes3[0];
    console.log("\u{1F4CB} Creating test user accounts for all 5 roles...");
    for (const userData of testUsers) {
      const existingUser = await db2.select().from(users2).where(eq3(users2.username, userData.username)).limit(1);
      let userId = userData.id;
      if (existingUser.length === 0) {
        const roleId = roleMap[userData.roleName];
        if (!roleId) {
          console.warn(`\u26A0\uFE0F Role "${userData.roleName}" not found`);
          continue;
        }
        const passwordHash = await bcrypt2.hash(userData.password, 12);
        const [newUser] = await db2.insert(users2).values({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          passwordHash,
          roleId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          status: "active",
          isActive: true,
          mustChangePassword: false,
          profileCompleted: true,
          createdVia: "seed"
        }).returning();
        userId = newUser.id;
        console.log(`\u2705 Created ${userData.roleName} account: ${userData.username}`);
      } else {
        userId = existingUser[0].id;
        console.log(`\u2139\uFE0F  ${userData.roleName} account already exists: ${userData.username}`);
      }
      if (userData.roleName === "Student" && defaultStudentClass) {
        const existingStudent = await db2.select().from(students2).where(eq3(students2.id, userId)).limit(1);
        if (existingStudent.length === 0) {
          const admissionNumber = `THS-STU-${userData.username.toUpperCase()}`;
          await db2.insert(students2).values({
            id: userId,
            admissionNumber,
            classId: defaultStudentClass.id,
            admissionDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
          });
          console.log(`   \u2705 Created student record for ${userData.username} in class ${defaultStudentClass.name}`);
        } else {
          console.log(`   \u2139\uFE0F  Student record already exists for ${userData.username}`);
        }
      }
    }
    console.log("\n\u{1F4DD} TEST ACCOUNT CREDENTIALS:\n");
    console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("\u2502         LOGIN CREDENTIALS FOR ALL 5 ROLES           \u2502");
    console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    for (const user of testUsers) {
      console.log(`\u2502 Role: ${user.roleName.padEnd(45)}\u2502`);
      console.log(`\u2502   Username: ${user.username.padEnd(38)}\u2502`);
      console.log(`\u2502   Password: ${user.password.padEnd(38)}\u2502`);
      console.log(`\u2502   Email:    ${user.email.padEnd(38)}\u2502`);
      console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    }
    console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`\u274C Error seeding test users: ${errorMessage}`);
    throw error;
  }
}
var init_seed_test_users = __esm({
  "server/seed-test-users.ts"() {
    "use strict";
    init_storage();
    init_schema();
  }
});

// server/index.ts
import express2 from "express";
import compression from "compression";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// server/routes/modules/auth.ts
init_storage();
import { Router } from "express";
import { z as z2 } from "zod";
import bcrypt from "bcrypt";
import jwt3 from "jsonwebtoken";

// server/routes/middleware.ts
init_storage();
import jwt2 from "jsonwebtoken";

// shared/role-constants.ts
var ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  TEACHER: 3,
  STUDENT: 4,
  PARENT: 5
};
var ROLE_CODES = {
  [ROLE_IDS.SUPER_ADMIN]: "SUP",
  [ROLE_IDS.ADMIN]: "ADM",
  [ROLE_IDS.TEACHER]: "TCH",
  [ROLE_IDS.STUDENT]: "STU",
  [ROLE_IDS.PARENT]: "PAR"
};
var ROLE_NAMES = {
  [ROLE_IDS.SUPER_ADMIN]: "Super Admin",
  [ROLE_IDS.ADMIN]: "Admin",
  [ROLE_IDS.TEACHER]: "Teacher",
  [ROLE_IDS.STUDENT]: "Student",
  [ROLE_IDS.PARENT]: "Parent"
};
var ROLE_PORTALS = {
  [ROLE_IDS.SUPER_ADMIN]: "/portal/superadmin",
  [ROLE_IDS.ADMIN]: "/portal/admin",
  [ROLE_IDS.TEACHER]: "/portal/teacher",
  [ROLE_IDS.STUDENT]: "/portal/student",
  [ROLE_IDS.PARENT]: "/portal/parent"
};

// server/routes/middleware.ts
var JWT_SECRET2 = process.env.JWT_SECRET || (process.env.NODE_ENV === "development" ? "dev-secret-key-change-in-production" : void 0);
if (!JWT_SECRET2) {
  process.exit(1);
}
var SECRET_KEY = JWT_SECRET2;
var JWT_EXPIRES_IN = "24h";
function normalizeUuid2(raw) {
  if (!raw) return void 0;
  if (typeof raw === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  let bytes;
  if (typeof raw === "string" && raw.includes(",")) {
    const parts = raw.split(",").map((s) => parseInt(s.trim()));
    if (parts.length === 16 && parts.every((n) => n >= 0 && n <= 255)) {
      bytes = parts;
    }
  }
  if (Array.isArray(raw) && raw.length === 16) {
    bytes = raw;
  } else if (raw instanceof Uint8Array && raw.length === 16) {
    bytes = Array.from(raw);
  }
  if (bytes) {
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return void 0;
}
var authenticateUser = async (req, res, next) => {
  try {
    const authHeader = (req.headers.authorization || "").trim();
    const [scheme, token] = authHeader.split(/\s+/);
    if (!/^bearer$/i.test(scheme) || !token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    let decoded;
    try {
      decoded = jwt2.verify(token, SECRET_KEY);
    } catch (jwtError) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const normalizedUserId = normalizeUuid2(decoded.userId);
    if (!normalizedUserId) {
      return res.status(401).json({ message: "Invalid token format" });
    }
    const user = await storage.getUser(normalizedUserId);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    if (user.isActive === false) {
      return res.status(401).json({ message: "Account has been deactivated. Please contact administrator." });
    }
    if (user.roleId !== decoded.roleId) {
      return res.status(401).json({ message: "User role has changed, please log in again" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
};
var authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (!allowedRoles.includes(req.user.roleId)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      res.status(403).json({ message: "Authorization failed" });
    }
  };
};

// server/routes/modules/auth.ts
var router = Router();
var loginSchema = z2.object({
  identifier: z2.string().min(1),
  password: z2.string().min(1)
});
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const user = await storage.getUserByUsername(identifier);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash || "");
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt3.sign(
      { userId: user.id, roleId: user.roleId },
      SECRET_KEY,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ message: "Login failed" });
  }
});
var auth_default = router;

// server/routes/modules/admin.ts
init_storage();
import { Router as Router2 } from "express";
var router2 = Router2();
var ALLOWED_SYNC_TABLES = ["classes", "subjects", "academic_terms", "users", "students", "announcements", "exams", "homepage_content", "notifications"];
router2.post("/realtime/sync", authenticateUser, async (req, res) => {
  try {
    const { tables } = req.body;
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ message: "Tables array is required" });
    }
    const normalizedTables = tables.filter((t) => typeof t === "string" && t.length > 0).map((t) => t.toLowerCase().trim());
    const invalidTables = normalizedTables.filter((t) => !ALLOWED_SYNC_TABLES.includes(t));
    if (invalidTables.length > 0) {
      return res.status(400).json({
        message: "Request contains invalid table names",
        invalidTables,
        allowedTables: ALLOWED_SYNC_TABLES
      });
    }
    const uniqueTables = [...new Set(normalizedTables)];
    const userRoleId = req.user.roleId;
    const userId = req.user.id;
    const syncData = {};
    for (const table of uniqueTables) {
      switch (table) {
        case "classes":
          syncData.classes = await storage.getClasses();
          break;
        case "subjects":
          syncData.subjects = await storage.getSubjects();
          break;
        case "academic_terms":
          syncData.academic_terms = await storage.getAcademicTerms();
          break;
        case "users":
          if (userRoleId === ROLE_IDS.ADMIN || userRoleId === ROLE_IDS.SUPER_ADMIN) {
            const allUsers = await storage.getAllUsers();
            syncData.users = allUsers.map((u) => {
              const { passwordHash, ...safe } = u;
              return safe;
            });
          }
          break;
        case "students":
          if (userRoleId === ROLE_IDS.ADMIN || userRoleId === ROLE_IDS.SUPER_ADMIN) {
            const allStudents = await storage.getAllStudents();
            syncData.students = Array.isArray(allStudents) ? allStudents : [];
          }
          break;
        case "announcements":
          syncData.announcements = await storage.getAnnouncements();
          break;
        case "exams":
          syncData.exams = await storage.getAllExams();
          break;
        case "homepage_content":
          if (userRoleId === ROLE_IDS.ADMIN || userRoleId === ROLE_IDS.SUPER_ADMIN) {
            syncData.homepage_content = await storage.getHomePageContent();
          }
          break;
        case "notifications":
          syncData.notifications = await storage.getNotificationsByUserId(userId);
          break;
      }
    }
    res.json({
      success: true,
      data: syncData,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to sync realtime data" });
  }
});
router2.get("/settings", authenticateUser, async (req, res) => {
  try {
    const settings3 = await storage.getSystemSettings();
    res.json(settings3);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});
var admin_default = router2;

// server/routes/modules/reports.ts
init_storage();
import { Router as Router3 } from "express";
var router3 = Router3();
router3.get("/exam-results", authenticateUser, authorizeRoles(ROLE_IDS.STUDENT), async (req, res) => {
  try {
    const studentId = req.user.id;
    const results = await storage.getExamResultsByStudent(studentId);
    const enrichedResults = await Promise.all(results.map(async (result) => {
      const exam = await storage.getExamById(result.examId);
      return {
        ...result,
        examTitle: exam?.name || `Exam #${result.examId}`,
        percentage: result.maxScore > 0 ? Math.round(result.score / result.maxScore * 100) : 0
      };
    }));
    res.json(enrichedResults);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch exam results" });
  }
});
router3.get("/grading/tasks", authenticateUser, authorizeRoles(ROLE_IDS.TEACHER, ROLE_IDS.ADMIN), async (req, res) => {
  try {
    const teacherId = req.user.id;
    const tasks = await storage.getGradingTasksByTeacher(teacherId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch grading tasks" });
  }
});
var reports_default = router3;

// server/routes/index.ts
function registerRoutes(app2) {
  app2.use("/api/auth", auth_default);
  app2.use("/api/admin", admin_default);
  app2.use("/api/reports", reports_default);
}

// server/routes.ts
async function registerRoutes2(app2) {
  registerRoutes(app2);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs3 from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [
    react()
    // Replit plugins temporarily commented out due to installation issues
    // ...(process.env.NODE_ENV !== "production"
    //   ? [
    //       (await import("@replit/vite-plugin-runtime-error-modal")).default(),
    //     ]
    //   : []),
    // ...(process.env.NODE_ENV !== "production" &&
    // process.env.REPL_ID !== undefined
    //   ? [
    //       await import("@replit/vite-plugin-cartographer").then((m) =>
    //         m.cartographer(),
    //       ),
    //     ]
    //   : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-popover",
            "@radix-ui/react-scroll-area"
          ],
          "radix-ui-forms": [
            "@radix-ui/react-label",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-slider",
            "@radix-ui/react-switch"
          ],
          "radix-ui-misc": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-progress",
            "@radix-ui/react-separator",
            "@radix-ui/react-tooltip"
          ],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "icons": ["lucide-react", "react-icons"],
          "animation": ["framer-motion", "canvas-confetti"],
          "charts": ["recharts"]
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  },
  define: {
    // Auto-configure API URL based on environment
    // Development (Replit/Localhost): Use empty string for same-origin requests
    // Production (Vercel): Use VITE_API_URL env var (set to Render backend URL)
    "import.meta.env.VITE_API_URL": JSON.stringify(
      process.env.VITE_API_URL || ""
    )
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath, {
    maxAge: "1y",
    // 1 year for versioned assets (Vite adds hashes to filenames)
    etag: true,
    lastModified: true,
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else if (filePath.match(/\.(js|css|woff2?|ttf|eot)$/)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }
  }));
  app2.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/env-validation.ts
var envConfig = {
  required: [
    "JWT_SECRET"
    // Required in both environments
  ],
  optional: [
    "SESSION_SECRET",
    "FRONTEND_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ],
  productionRequired: [
    "DATABASE_URL",
    // Neon PostgreSQL connection string
    "JWT_SECRET",
    "SESSION_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ]
};
function validateEnvironment(isProduction3) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    environment: isProduction3 ? "production" : "development"
  };
  const requiredVars = isProduction3 ? envConfig.productionRequired : envConfig.required;
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      if (varName === "JWT_SECRET" && !isProduction3) {
        result.warnings.push(`${varName} not set, using development fallback`);
      } else if (varName === "SESSION_SECRET" && !isProduction3) {
        result.warnings.push(`${varName} not set, using development fallback`);
      } else if (isProduction3) {
        result.errors.push(`Missing required environment variable: ${varName}`);
        result.isValid = false;
      } else {
        result.warnings.push(`${varName} not set (optional in development)`);
      }
    }
  }
  for (const varName of envConfig.optional) {
    if (!process.env[varName] && !result.warnings.find((w) => w.includes(varName))) {
      if (varName.startsWith("CLOUDINARY_") && isProduction3) {
        result.warnings.push(`${varName} not set - file uploads will fail`);
      }
    }
  }
  if (!process.env.DATABASE_URL) {
    result.errors.push("DATABASE_URL is required (Neon PostgreSQL). SQLite is not supported.");
    result.isValid = false;
  }
  if (result.errors.length > 0) {
    console.error("\n\u274C Environment Validation Errors:");
    result.errors.forEach((err) => console.error(`   - ${err}`));
  }
  if (result.warnings.length > 0) {
    console.warn("\n\u26A0\uFE0F Environment Warnings:");
    result.warnings.forEach((warn) => console.warn(`   - ${warn}`));
  }
  if (result.isValid) {
    console.log(`
\u2705 Environment validation passed for ${result.environment}`);
  }
  return result;
}

// server/performance-monitor.ts
import { EventEmitter } from "events";

// server/enhanced-cache.ts
var EnhancedCache = class {
  constructor(config) {
    this.l1Cache = /* @__PURE__ */ new Map();
    this.l2Cache = /* @__PURE__ */ new Map();
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.responseTimes = [];
    this.config = {
      maxL1Size: 100,
      maxL2Size: 500,
      defaultTTL: 5 * 60 * 1e3,
      // 5 minutes
      enableStats: true
    };
    this.cleanupInterval = null;
    this.eventListeners = /* @__PURE__ */ new Map();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startCleanup();
  }
  static {
    // TTL Presets (in milliseconds)
    this.TTL = {
      INSTANT: 10 * 1e3,
      // 10 seconds - for rapidly changing data
      SHORT: 30 * 1e3,
      // 30 seconds - for dynamic data
      MEDIUM: 5 * 60 * 1e3,
      // 5 minutes - for semi-static data
      LONG: 30 * 60 * 1e3,
      // 30 minutes - for static data
      HOUR: 60 * 60 * 1e3,
      // 1 hour
      DAY: 24 * 60 * 60 * 1e3
      // 24 hours
    };
  }
  /**
   * Get or set with request coalescing (prevents thundering herd)
   */
  async getOrSet(key, fetchFn, ttlMs = this.config.defaultTTL, tier = "L2") {
    const startTime = Date.now();
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > Date.now()) {
      this.l1Hits++;
      l1Entry.hits++;
      this.recordResponseTime(startTime);
      this.emit("hit", { key, tier: "L1" });
      return l1Entry.data;
    }
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && l2Entry.expiresAt > Date.now()) {
      this.l2Hits++;
      l2Entry.hits++;
      if (l2Entry.hits >= 3) {
        this.promoteToL1(key, l2Entry);
      }
      this.recordResponseTime(startTime);
      this.emit("hit", { key, tier: "L2" });
      return l2Entry.data;
    }
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.l1Hits++;
      return pending;
    }
    this.misses++;
    this.emit("miss", { key });
    const fetchPromise = fetchFn().then((data) => {
      this.set(key, data, ttlMs, tier);
      this.pendingRequests.delete(key);
      this.recordResponseTime(startTime);
      return data;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });
    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }
  /**
   * Direct set with tier specification
   */
  set(key, data, ttlMs = this.config.defaultTTL, tier = "L2") {
    const entry = {
      data,
      expiresAt: Date.now() + ttlMs,
      hits: 0,
      size: this.estimateSize(data),
      tier,
      createdAt: Date.now()
    };
    if (tier === "L1") {
      this.ensureL1Capacity();
      this.l1Cache.set(key, entry);
    } else {
      this.ensureL2Capacity();
      this.l2Cache.set(key, entry);
    }
    this.emit("set", { key, tier });
  }
  /**
   * Get without fetching
   */
  get(key) {
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > Date.now()) {
      this.l1Hits++;
      l1Entry.hits++;
      return l1Entry.data;
    }
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && l2Entry.expiresAt > Date.now()) {
      this.l2Hits++;
      l2Entry.hits++;
      return l2Entry.data;
    }
    this.misses++;
    return null;
  }
  /**
   * Invalidate by key or pattern
   */
  invalidate(keyOrPattern) {
    let count = 0;
    const invalidateFromMap = (cache) => {
      if (typeof keyOrPattern === "string") {
        if (cache.delete(keyOrPattern)) count++;
      } else {
        for (const key of cache.keys()) {
          if (keyOrPattern.test(key)) {
            cache.delete(key);
            count++;
          }
        }
      }
    };
    invalidateFromMap(this.l1Cache);
    invalidateFromMap(this.l2Cache);
    if (count > 0) {
      this.emit("invalidate", { pattern: keyOrPattern.toString(), count });
    }
    return count;
  }
  /**
   * Invalidate all cache entries for a table
   */
  invalidateTable(tableName) {
    return this.invalidate(new RegExp(`^${tableName}:`));
  }
  /**
   * Pre-warm cache with critical data
   */
  async warmCache(warmers) {
    const promises = warmers.map(async ({ key, fetchFn, ttl, tier }) => {
      try {
        const data = await fetchFn();
        this.set(key, data, ttl || this.config.defaultTTL, tier || "L2");
        return { key, success: true };
      } catch (error) {
        console.warn(`Cache warm failed for ${key}:`, error);
        return { key, success: false };
      }
    });
    const results = await Promise.all(promises);
    const successful = results.filter((r) => r.success).length;
    console.log(`\u2705 Cache warmed: ${successful}/${warmers.length} entries`);
  }
  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.l1Hits + this.l2Hits + this.misses;
    const avgResponseTime = this.responseTimes.length > 0 ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length : 0;
    return {
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      misses: this.misses,
      totalRequests,
      hitRate: totalRequests > 0 ? (this.l1Hits + this.l2Hits) / totalRequests * 100 : 0,
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      evictions: this.evictions
    };
  }
  /**
   * Clear all caches
   */
  clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.pendingRequests.clear();
  }
  /**
   * Shutdown gracefully
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
  static {
    // ==================== CACHE KEY GENERATORS ====================
    this.keys = {
      // System data (long TTL)
      systemSettings: () => "system:settings",
      roles: () => "system:roles",
      gradingConfig: () => "system:grading",
      // Reference data (medium TTL)
      classes: () => "ref:classes",
      subjects: () => "ref:subjects",
      academicTerms: () => "ref:terms",
      currentTerm: () => "ref:currentTerm",
      // Homepage & public content (medium TTL)
      homepageContent: () => "homepage:content",
      announcements: () => "announcements:all",
      announcementsByRole: (role) => `announcements:role:${role}`,
      // User data (short TTL)
      user: (id) => `user:${id}`,
      userProfile: (id) => `user:profile:${id}`,
      student: (id) => `student:${id}`,
      // Teacher data (short TTL)
      teacherAssignments: (teacherId) => `teacher:assignments:${teacherId}`,
      teacherDashboard: (teacherId) => `teacher:dashboard:${teacherId}`,
      teacherClasses: (teacherId) => `teacher:classes:${teacherId}`,
      // Exam data (short TTL due to real-time nature)
      exam: (id) => `exam:${id}`,
      examQuestions: (examId) => `exam:questions:${examId}`,
      examsByClass: (classId) => `exams:class:${classId}`,
      examsByTeacher: (teacherId) => `exams:teacher:${teacherId}`,
      visibleExams: (userId, roleId) => `exams:visible:${userId}:${roleId}`,
      // Report cards (medium TTL)
      reportCard: (id) => `reportcard:${id}`,
      reportCardsByStudent: (studentId) => `reportcards:student:${studentId}`,
      reportCardsByClass: (classId, termId) => `reportcards:class:${classId}:term:${termId}`,
      // Notifications (instant TTL due to real-time)
      userNotifications: (userId) => `notifications:user:${userId}`,
      unreadCount: (userId) => `notifications:unread:${userId}`
    };
  }
  // ==================== PRIVATE METHODS ====================
  promoteToL1(key, entry) {
    this.ensureL1Capacity();
    entry.tier = "L1";
    this.l1Cache.set(key, entry);
    this.l2Cache.delete(key);
  }
  ensureL1Capacity() {
    while (this.l1Cache.size >= this.config.maxL1Size) {
      const oldestKey = this.findLRUKey(this.l1Cache);
      if (oldestKey) {
        const entry = this.l1Cache.get(oldestKey);
        this.l1Cache.delete(oldestKey);
        if (entry && entry.expiresAt > Date.now()) {
          entry.tier = "L2";
          this.l2Cache.set(oldestKey, entry);
        }
        this.evictions++;
        this.emit("evict", { key: oldestKey, tier: "L1" });
      }
    }
  }
  ensureL2Capacity() {
    while (this.l2Cache.size >= this.config.maxL2Size) {
      const oldestKey = this.findLRUKey(this.l2Cache);
      if (oldestKey) {
        this.l2Cache.delete(oldestKey);
        this.evictions++;
        this.emit("evict", { key: oldestKey, tier: "L2" });
      }
    }
  }
  findLRUKey(cache) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    return oldestKey;
  }
  estimateSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  recordResponseTime(startTime) {
    if (!this.config.enableStats) return;
    const duration = Date.now() - startTime;
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1e3) {
      this.responseTimes.shift();
    }
  }
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Cache.entries()) {
        if (entry.expiresAt < now) {
          this.l1Cache.delete(key);
        }
      }
      for (const [key, entry] of this.l2Cache.entries()) {
        if (entry.expiresAt < now) {
          this.l2Cache.delete(key);
        }
      }
    }, 60 * 1e3);
  }
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (e) {
        }
      }
    }
  }
  /**
   * Subscribe to cache events
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, /* @__PURE__ */ new Set());
    }
    this.eventListeners.get(event).add(listener);
  }
  /**
   * Unsubscribe from cache events
   */
  off(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
};
var enhancedCache = new EnhancedCache({
  maxL1Size: 150,
  maxL2Size: 800,
  defaultTTL: 5 * 60 * 1e3,
  enableStats: true
});

// server/database-optimization.ts
init_storage();
var DatabaseOptimizer = class {
  constructor() {
    this.queryStats = /* @__PURE__ */ new Map();
    this.slowQueryThreshold = 500;
    // 500ms
    this.slowQueryLog = [];
    this.maxSlowQueryLogSize = 100;
    this.startPeriodicCleanup();
  }
  /**
   * Performance indexes creation script
   * Run this once to ensure all critical indexes exist
   */
  async createPerformanceIndexes() {
    const created = [];
    const errors = [];
    const indexStatements = [
      // User hot paths
      { name: "users_active_role_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_active_role_idx ON users(role_id, is_active)" },
      { name: "users_last_login_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_last_login_idx ON users(last_login_at DESC NULLS LAST)" },
      { name: "users_status_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_status_active_idx ON users(status, is_active) WHERE is_active = true" },
      // Exam sessions hot paths (critical for exam taking)
      { name: "exam_sessions_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_status_idx ON exam_sessions(status)" },
      { name: "exam_sessions_student_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_student_status_idx ON exam_sessions(student_id, status)" },
      { name: "exam_sessions_started_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_started_idx ON exam_sessions(started_at DESC)" },
      { name: "exam_sessions_submitted_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_submitted_idx ON exam_sessions(submitted_at DESC NULLS LAST)" },
      { name: "exam_sessions_timeout_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_timeout_idx ON exam_sessions(is_completed, started_at) WHERE is_completed = false" },
      // Exam hot paths (for listing and filtering)
      { name: "exams_published_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_published_idx ON exams(is_published) WHERE is_published = true" },
      { name: "exams_created_by_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_created_by_idx ON exams(created_by)" },
      { name: "exams_teacher_charge_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_teacher_charge_idx ON exams(teacher_in_charge_id)" },
      { name: "exams_class_term_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_class_term_idx ON exams(class_id, term_id)" },
      { name: "exams_subject_class_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_subject_class_idx ON exams(subject_id, class_id)" },
      { name: "exams_date_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_date_idx ON exams(date DESC)" },
      { name: "exams_time_window_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_time_window_idx ON exams(start_time, end_time)" },
      // Report cards hot paths
      { name: "report_cards_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_status_idx ON report_cards(status)" },
      { name: "report_cards_student_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_student_status_idx ON report_cards(student_id, status)" },
      { name: "report_cards_published_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS report_cards_published_idx ON report_cards(status, published_at DESC) WHERE status = 'published'" },
      // Notifications hot paths
      { name: "notifications_user_unread_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read) WHERE is_read = false" },
      { name: "notifications_created_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_created_idx ON notifications(created_at DESC)" },
      { name: "notifications_user_created_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC)" },
      // Teacher assignments hot paths
      { name: "teacher_assign_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_active_idx ON teacher_class_assignments(teacher_id, is_active) WHERE is_active = true" },
      { name: "teacher_assign_term_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_term_idx ON teacher_class_assignments(term_id)" },
      { name: "teacher_assign_valid_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS teacher_assign_valid_idx ON teacher_class_assignments(valid_until) WHERE valid_until IS NOT NULL" },
      // Attendance hot paths
      { name: "attendance_student_date_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_student_date_idx ON attendance(student_id, date DESC)" },
      { name: "attendance_class_date_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_class_date_idx ON attendance(class_id, date DESC)" },
      { name: "attendance_date_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS attendance_date_status_idx ON attendance(date, status)" },
      // Messages hot paths
      { name: "messages_recipient_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_recipient_idx ON messages(recipient_id, created_at DESC)" },
      { name: "messages_sender_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_sender_idx ON messages(sender_id, created_at DESC)" },
      { name: "messages_unread_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_unread_idx ON messages(recipient_id, is_read) WHERE is_read = false" },
      // Audit logs hot paths (for admin dashboards)
      { name: "audit_logs_user_date_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_user_date_idx ON audit_logs(user_id, created_at DESC)" },
      // Students hot paths
      { name: "students_parent_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS students_parent_idx ON students(parent_id)" },
      // Grading tasks hot paths
      { name: "grading_tasks_pending_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS grading_tasks_pending_idx ON grading_tasks(teacher_id, status) WHERE status = 'pending'" },
      { name: "grading_tasks_priority_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS grading_tasks_priority_idx ON grading_tasks(priority DESC, created_at ASC)" },
      // Continuous assessment hot paths
      { name: "ca_student_term_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS ca_student_term_idx ON continuous_assessment(student_id, term_id)" },
      // Announcements hot paths
      { name: "announcements_published_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS announcements_published_idx ON announcements(is_published, published_at DESC) WHERE is_published = true" },
      // Homepage content hot paths
      { name: "homepage_active_order_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS homepage_active_order_idx ON home_page_content(is_active, display_order) WHERE is_active = true" },
      // ==================== EXAM VISIBILITY OPTIMIZATION INDEXES ====================
      // Critical for student exam access performance (target: <100ms)
      // Students class-based lookup for visibility
      { name: "students_class_dept_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS students_class_dept_idx ON students(class_id, department)" },
      { name: "students_class_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS students_class_active_idx ON students(class_id)" },
      // Subject category for department filtering (SS1-SS3)
      { name: "subjects_category_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS subjects_category_idx ON subjects(category) WHERE is_active = true" },
      { name: "subjects_active_cat_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS subjects_active_cat_idx ON subjects(is_active, category)" },
      // Optimized exam visibility queries
      { name: "exams_visibility_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_visibility_idx ON exams(is_published, class_id, subject_id)" },
      { name: "exams_class_published_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exams_class_published_idx ON exams(class_id, is_published) WHERE is_published = true" },
      // Classes level lookup for SS detection
      { name: "classes_level_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS classes_level_idx ON classes(level)" },
      // ==================== VACANCY OPTIMIZATION INDEXES ====================
      // Critical for public vacancy listing (target: <100ms)
      { name: "vacancies_status_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_status_idx ON vacancies(status)" },
      { name: "vacancies_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_active_idx ON vacancies(status, created_at DESC) WHERE status = 'open'" },
      { name: "vacancies_created_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_created_idx ON vacancies(created_at DESC)" },
      // ==================== EXAM RESULTS & SUBMISSIONS OPTIMIZATION ====================
      // Critical for real-time anti-cheat and grading
      { name: "exam_results_exam_student_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_results_exam_student_idx ON exam_results(exam_id, student_id)" },
      { name: "exam_results_student_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_results_student_idx ON exam_results(student_id)" },
      { name: "student_answers_session_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS student_answers_session_idx ON student_answers(session_id)" },
      { name: "student_answers_question_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS student_answers_question_idx ON student_answers(question_id)" },
      // ==================== SCALABILITY INDEXES ====================
      // For horizontal scaling support with 1000+ concurrent users
      // Session management
      { name: "exam_sessions_exam_student_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_exam_student_idx ON exam_sessions(exam_id, student_id)" },
      { name: "exam_sessions_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS exam_sessions_active_idx ON exam_sessions(status, started_at) WHERE status = 'in_progress'" },
      // User authentication hot paths
      { name: "users_login_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_login_idx ON users(username, is_active) WHERE is_active = true" },
      { name: "users_email_active_idx", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_email_active_idx ON users(email, is_active) WHERE is_active = true" }
    ];
    const pool2 = getPgPool();
    if (!pool2) {
      errors.push("Database pool not available");
      return { created, errors };
    }
    for (const idx of indexStatements) {
      try {
        await pool2.query(idx.sql);
        created.push(idx.name);
      } catch (error) {
        if (error.message?.includes("already exists")) {
          created.push(`${idx.name} (exists)`);
        } else {
          errors.push(`${idx.name}: ${error.message}`);
        }
      }
    }
    return { created, errors };
  }
  /**
   * Analyze table statistics and suggest optimizations
   */
  async analyzeTableStats() {
    const pool2 = getPgPool();
    if (!pool2) return /* @__PURE__ */ new Map();
    const stats = /* @__PURE__ */ new Map();
    const criticalTables = [
      "users",
      "students",
      "exams",
      "exam_sessions",
      "exam_results",
      "student_answers",
      "report_cards",
      "notifications",
      "teacher_class_assignments"
    ];
    for (const table of criticalTables) {
      try {
        const result = await pool2.query(`
          SELECT 
            relname as table_name,
            n_live_tup as row_count,
            n_dead_tup as dead_rows,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
          FROM pg_stat_user_tables 
          WHERE relname = $1
        `, [table]);
        if (result.rows.length > 0) {
          stats.set(table, result.rows[0]);
        }
      } catch (error) {
      }
    }
    return stats;
  }
  /**
   * Get slow query log
   */
  getSlowQueryLog() {
    return [...this.slowQueryLog];
  }
  /**
   * Log a slow query
   */
  logSlowQuery(query, durationMs) {
    if (durationMs >= this.slowQueryThreshold) {
      this.slowQueryLog.push({
        query: query.substring(0, 500),
        // Truncate long queries
        duration: durationMs,
        timestamp: /* @__PURE__ */ new Date()
      });
      if (this.slowQueryLog.length > this.maxSlowQueryLogSize) {
        this.slowQueryLog.shift();
      }
      console.warn(`[SLOW QUERY ${durationMs}ms] ${query.substring(0, 100)}...`);
    }
  }
  /**
   * Record query execution stats
   */
  recordQueryStats(queryId, durationMs) {
    const existing = this.queryStats.get(queryId);
    if (existing) {
      existing.totalCalls++;
      existing.avgDurationMs = (existing.avgDurationMs * (existing.totalCalls - 1) + durationMs) / existing.totalCalls;
      existing.slowestDurationMs = Math.max(existing.slowestDurationMs, durationMs);
      existing.lastCalled = /* @__PURE__ */ new Date();
    } else {
      this.queryStats.set(queryId, {
        query: queryId,
        avgDurationMs: durationMs,
        totalCalls: 1,
        slowestDurationMs: durationMs,
        lastCalled: /* @__PURE__ */ new Date()
      });
    }
    this.logSlowQuery(queryId, durationMs);
  }
  /**
   * Get top N slowest queries
   */
  getTopSlowQueries(n = 10) {
    return Array.from(this.queryStats.values()).sort((a, b) => b.avgDurationMs - a.avgDurationMs).slice(0, n);
  }
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const pool2 = getPgPool();
    const totalQueries = Array.from(this.queryStats.values()).reduce((sum, s) => sum + s.totalCalls, 0);
    const avgQueryTime = totalQueries > 0 ? Array.from(this.queryStats.values()).reduce((sum, s) => sum + s.avgDurationMs * s.totalCalls, 0) / totalQueries : 0;
    return {
      totalQueries,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      slowQueries: this.slowQueryLog.length,
      cacheHitRate: 0,
      // Will be populated from performanceCache
      connectionPoolStats: {
        total: pool2?.totalCount || 0,
        idle: pool2?.idleCount || 0,
        waiting: pool2?.waitingCount || 0
      }
    };
  }
  /**
   * Run VACUUM ANALYZE on critical tables
   */
  async vacuumAnalyzeCriticalTables() {
    const pool2 = getPgPool();
    if (!pool2) return { success: [], errors: ["Database pool not available"] };
    const success = [];
    const errors = [];
    const criticalTables = [
      "exam_sessions",
      "student_answers",
      "exam_results",
      "notifications",
      "report_cards",
      "audit_logs"
    ];
    for (const table of criticalTables) {
      try {
        await pool2.query(`ANALYZE ${table}`);
        success.push(table);
      } catch (error) {
        errors.push(`${table}: ${error.message}`);
      }
    }
    return { success, errors };
  }
  /**
   * Periodic cleanup of stale stats
   */
  startPeriodicCleanup() {
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
      for (const [key, stats] of this.queryStats.entries()) {
        if (stats.lastCalled < oneHourAgo) {
          this.queryStats.delete(key);
        }
      }
    }, 15 * 60 * 1e3);
  }
  /**
   * Reset all statistics
   */
  resetStats() {
    this.queryStats.clear();
    this.slowQueryLog = [];
  }
};
var databaseOptimizer = new DatabaseOptimizer();

// server/socket-optimizer.ts
var SocketOptimizer = class {
  constructor(config) {
    this.io = null;
    this.batchTimer = null;
    this.latencyMeasurements = [];
    this.connectionsByUser = /* @__PURE__ */ new Map();
    this.config = {
      batchingEnabled: true,
      batchIntervalMs: 50,
      // Batch messages every 50ms
      maxBatchSize: 100,
      compressionThreshold: 1024,
      // Compress messages > 1KB
      heartbeatInterval: 25e3,
      deadConnectionTimeout: 6e4,
      maxConnectionsPerUser: 5,
      // Max 5 tabs per user
      enableMetrics: true,
      ...config
    };
    this.stats = this.initializeStats();
    this.messageBatch = { events: [], createdAt: Date.now() };
  }
  /**
   * Initialize Socket.IO with optimizations
   */
  initialize(io) {
    this.io = io;
    this.setupOptimizedHandlers();
    this.startMetricsCollection();
    console.log("\u2705 Socket Optimizer initialized");
  }
  /**
   * Add optimized event emission with batching
   */
  emit(eventType, data, rooms) {
    if (!this.io) return;
    const roomList = rooms ? Array.isArray(rooms) ? rooms : [rooms] : [];
    if (this.config.batchingEnabled) {
      this.addToBatch(eventType, data, roomList);
    } else {
      this.emitImmediate(eventType, data, roomList);
    }
  }
  /**
   * Emit immediately (bypass batching)
   */
  emitImmediate(eventType, data, rooms) {
    if (!this.io) return;
    const payload = this.optimizePayload(data);
    if (rooms.length > 0) {
      for (const room of rooms) {
        this.io.to(room).emit(eventType, payload);
      }
    } else {
      this.io.emit(eventType, payload);
    }
    this.stats.messagesSent++;
    this.stats.bytesTransferred += JSON.stringify(payload).length;
  }
  /**
   * Add message to batch
   */
  addToBatch(eventType, data, rooms) {
    this.messageBatch.events.push({ eventType, data, rooms });
    if (this.messageBatch.events.length >= this.config.maxBatchSize) {
      this.flushBatch();
    }
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchIntervalMs);
    }
  }
  /**
   * Flush message batch
   */
  flushBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    const events = this.messageBatch.events;
    this.messageBatch = { events: [], createdAt: Date.now() };
    if (events.length === 0) return;
    const eventsByRoom = /* @__PURE__ */ new Map();
    const broadcastEvents = [];
    for (const event of events) {
      if (event.rooms && event.rooms.length > 0) {
        for (const room of event.rooms) {
          if (!eventsByRoom.has(room)) {
            eventsByRoom.set(room, []);
          }
          eventsByRoom.get(room).push({ eventType: event.eventType, data: event.data });
        }
      } else {
        broadcastEvents.push({ eventType: event.eventType, data: event.data });
      }
    }
    if (this.io) {
      for (const [room, roomEvents] of eventsByRoom) {
        if (roomEvents.length === 1) {
          this.io.to(room).emit(roomEvents[0].eventType, this.optimizePayload(roomEvents[0].data));
        } else {
          this.io.to(room).emit("batch", { events: roomEvents.map((e) => ({ type: e.eventType, data: this.optimizePayload(e.data) })) });
        }
      }
      for (const event of broadcastEvents) {
        this.io.emit(event.eventType, this.optimizePayload(event.data));
      }
    }
    this.stats.messagesSent += events.length;
  }
  /**
   * Optimize payload (remove unnecessary data, potentially compress)
   */
  optimizePayload(data) {
    if (data === null || data === void 0) return data;
    if (typeof data === "object" && !Array.isArray(data)) {
      const cleaned = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== void 0) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    }
    return data;
  }
  /**
   * Track connection for a user
   */
  trackConnection(userId, socketId) {
    if (!this.connectionsByUser.has(userId)) {
      this.connectionsByUser.set(userId, /* @__PURE__ */ new Set());
    }
    const userConnections = this.connectionsByUser.get(userId);
    if (userConnections.size >= this.config.maxConnectionsPerUser) {
      console.warn(`\u26A0\uFE0F  User ${userId} exceeded max connections (${this.config.maxConnectionsPerUser})`);
      return false;
    }
    userConnections.add(socketId);
    this.stats.totalConnections++;
    this.stats.authenticatedConnections++;
    if (this.stats.totalConnections > this.stats.peakConnections) {
      this.stats.peakConnections = this.stats.totalConnections;
    }
    return true;
  }
  /**
   * Untrack connection for a user
   */
  untrackConnection(userId, socketId) {
    const userConnections = this.connectionsByUser.get(userId);
    if (userConnections) {
      userConnections.delete(socketId);
      if (userConnections.size === 0) {
        this.connectionsByUser.delete(userId);
      }
    }
    if (this.stats.totalConnections > 0) {
      this.stats.totalConnections--;
    }
    if (this.stats.authenticatedConnections > 0) {
      this.stats.authenticatedConnections--;
    }
  }
  /**
   * Record latency measurement
   */
  recordLatency(latencyMs) {
    this.latencyMeasurements.push(latencyMs);
    if (this.latencyMeasurements.length > 1e3) {
      this.latencyMeasurements.shift();
    }
    this.stats.averageLatency = this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length;
  }
  /**
   * Get connection statistics
   */
  getStats() {
    if (this.io) {
      const rooms = this.io.sockets.adapter.rooms;
      this.stats.roomCounts = /* @__PURE__ */ new Map();
      for (const [roomName, sockets] of rooms) {
        if (!roomName.startsWith("/")) {
          this.stats.roomCounts.set(roomName, sockets.size);
        }
      }
    }
    return { ...this.stats };
  }
  /**
   * Get room size
   */
  getRoomSize(room) {
    if (!this.io) return 0;
    return this.io.sockets.adapter.rooms.get(room)?.size || 0;
  }
  /**
   * Broadcast to specific room efficiently
   */
  broadcastToRoom(room, eventType, data) {
    if (!this.io) return;
    this.io.to(room).emit(eventType, this.optimizePayload(data));
    this.stats.messagesSent++;
  }
  /**
   * Get connections per user stats
   */
  getConnectionsPerUser() {
    const result = /* @__PURE__ */ new Map();
    for (const [userId, sockets] of this.connectionsByUser) {
      result.set(userId, sockets.size);
    }
    return result;
  }
  /**
   * Setup optimized event handlers
   */
  setupOptimizedHandlers() {
    if (!this.io) return;
    this.io.on("connection", (socket) => {
      socket.on("ping_measure", () => {
        socket.emit("pong_measure", { timestamp: Date.now() });
      });
      socket.on("subscribe_batch", (rooms) => {
        if (Array.isArray(rooms)) {
          for (const room of rooms.slice(0, 20)) {
            if (typeof room === "string" && room.length < 100) {
              socket.join(room);
            }
          }
        }
      });
      socket.on("unsubscribe_batch", (rooms) => {
        if (Array.isArray(rooms)) {
          for (const room of rooms) {
            if (typeof room === "string") {
              socket.leave(room);
            }
          }
        }
      });
    });
  }
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    if (!this.config.enableMetrics) return;
    setInterval(() => {
      const stats = this.getStats();
      console.log(`\u{1F4E1} Socket Stats: ${stats.totalConnections} connections, ${stats.messagesSent} msgs sent, ${Math.round(stats.averageLatency)}ms avg latency`);
    }, 5 * 60 * 1e3);
  }
  /**
   * Initialize stats object
   */
  initializeStats() {
    return {
      totalConnections: 0,
      authenticatedConnections: 0,
      roomCounts: /* @__PURE__ */ new Map(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      peakConnections: 0,
      averageLatency: 0,
      droppedConnections: 0
    };
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = this.initializeStats();
    this.latencyMeasurements = [];
  }
  /**
   * Shutdown optimizer
   */
  shutdown() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.flushBatch();
  }
};
var socketOptimizer = new SocketOptimizer();

// server/performance-monitor.ts
init_storage();
var PerformanceMonitor = class extends EventEmitter {
  constructor() {
    super();
    this.endpointMetrics = /* @__PURE__ */ new Map();
    this.systemMetrics = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.allResponseTimes = [];
    this.requestTimestamps = [];
    this.isRunning = false;
    this.metricsInterval = null;
    this.startTime = /* @__PURE__ */ new Date();
  }
  /**
   * Start performance monitoring
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 3e4);
    console.log("\u2705 Performance Monitor started");
  }
  /**
   * Stop monitoring
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.isRunning = false;
  }
  /**
   * Record an API request
   */
  recordRequest(method, path3, durationMs, statusCode) {
    const key = `${method}:${path3}`;
    const isError = statusCode >= 400;
    this.totalRequests++;
    if (isError) this.totalErrors++;
    this.allResponseTimes.push(durationMs);
    this.requestTimestamps.push(Date.now());
    if (this.allResponseTimes.length > 1e4) {
      this.allResponseTimes.shift();
    }
    const oneMinuteAgo = Date.now() - 6e4;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinuteAgo) {
      this.requestTimestamps.shift();
    }
    let metrics = this.endpointMetrics.get(key);
    if (!metrics) {
      metrics = {
        path: path3,
        method,
        totalCalls: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        p95DurationMs: 0,
        errorCount: 0,
        lastCalled: /* @__PURE__ */ new Date(),
        responseTimes: []
      };
      this.endpointMetrics.set(key, metrics);
    }
    metrics.totalCalls++;
    metrics.totalDurationMs += durationMs;
    metrics.avgDurationMs = metrics.totalDurationMs / metrics.totalCalls;
    metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
    metrics.lastCalled = /* @__PURE__ */ new Date();
    if (isError) {
      metrics.errorCount++;
    }
    metrics.responseTimes.push(durationMs);
    if (metrics.responseTimes.length > 1e3) {
      metrics.responseTimes.shift();
    }
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    metrics.p95DurationMs = this.percentile(sorted, 95);
    if (durationMs > 500) {
      this.emit("slowRequest", { method, path: path3, durationMs, statusCode });
    }
    if (isError) {
      this.emit("requestError", { method, path: path3, statusCode, durationMs });
    }
  }
  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1e6;
    const metrics = {
      timestamp: /* @__PURE__ */ new Date(),
      memoryUsage,
      cpuUsage: cpuPercent,
      uptime: process.uptime(),
      activeConnections: socketOptimizer.getStats().totalConnections,
      requestsPerSecond: this.requestTimestamps.length / 60
    };
    this.systemMetrics.push(metrics);
    if (this.systemMetrics.length > 100) {
      this.systemMetrics.shift();
    }
  }
  /**
   * Generate comprehensive performance report
   */
  async generateReport() {
    const uptime = (Date.now() - this.startTime.getTime()) / 1e3;
    const sortedResponseTimes = [...this.allResponseTimes].sort((a, b) => a - b);
    const p50 = this.percentile(sortedResponseTimes, 50);
    const p95 = this.percentile(sortedResponseTimes, 95);
    const p99 = this.percentile(sortedResponseTimes, 99);
    const avgResponseTime = this.allResponseTimes.length > 0 ? this.allResponseTimes.reduce((a, b) => a + b, 0) / this.allResponseTimes.length : 0;
    const dbMetrics = await databaseOptimizer.getPerformanceMetrics();
    const slowQueries = databaseOptimizer.getTopSlowQueries(10);
    const cacheStats = enhancedCache.getStats();
    const socketStats = socketOptimizer.getStats();
    const memoryUsage = process.memoryUsage();
    const pool2 = getPgPool();
    const poolStats = {
      total: pool2?.totalCount || 0,
      idle: pool2?.idleCount || 0,
      waiting: pool2?.waitingCount || 0
    };
    const allEndpoints = Array.from(this.endpointMetrics.values());
    const topEndpoints = [...allEndpoints].sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 10);
    const slowestEndpoints = [...allEndpoints].sort((a, b) => b.p95DurationMs - a.p95DurationMs).slice(0, 10);
    const errorsByEndpoint = allEndpoints.filter((e) => e.errorCount > 0).map((e) => ({
      path: `${e.method} ${e.path}`,
      errorCount: e.errorCount,
      errorRate: e.errorCount / e.totalCalls * 100
    })).sort((a, b) => b.errorRate - a.errorRate);
    const recommendations = this.generateRecommendations({
      avgResponseTime,
      p95,
      errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests * 100 : 0,
      cacheHitRate: cacheStats.hitRate,
      slowestEndpoints,
      poolStats,
      memoryUsage
    });
    return {
      generatedAt: /* @__PURE__ */ new Date(),
      uptime,
      summary: {
        totalRequests: this.totalRequests,
        avgResponseTime: Math.round(avgResponseTime),
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests * 100 : 0,
        requestsPerSecond: this.requestTimestamps.length / 60
      },
      database: {
        avgQueryTime: dbMetrics.avgQueryTime,
        slowQueryCount: dbMetrics.slowQueries,
        connectionPoolStats: poolStats,
        topSlowQueries: slowQueries.map((q) => ({
          query: q.query.substring(0, 100),
          avgMs: Math.round(q.avgDurationMs),
          calls: q.totalCalls
        }))
      },
      cache: {
        l1HitRate: cacheStats.l1Size > 0 ? cacheStats.l1Hits / (cacheStats.l1Hits + cacheStats.l2Hits + cacheStats.misses) * 100 : 0,
        l2HitRate: cacheStats.l2Size > 0 ? cacheStats.l2Hits / (cacheStats.l1Hits + cacheStats.l2Hits + cacheStats.misses) * 100 : 0,
        totalHitRate: cacheStats.hitRate,
        size: cacheStats.l1Size + cacheStats.l2Size,
        evictions: cacheStats.evictions
      },
      websocket: {
        activeConnections: socketStats.totalConnections,
        peakConnections: socketStats.peakConnections,
        messagesSent: socketStats.messagesSent,
        avgLatency: Math.round(socketStats.averageLatency)
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      topEndpoints,
      slowestEndpoints,
      errorsByEndpoint,
      recommendations
    };
  }
  /**
   * Generate performance recommendations
   */
  generateRecommendations(data) {
    const recommendations = [];
    if (data.p95 > 500) {
      recommendations.push(`P95 response time (${data.p95}ms) exceeds 500ms target. Consider optimizing slow endpoints or adding caching.`);
    }
    if (data.avgResponseTime > 200) {
      recommendations.push(`Average response time (${Math.round(data.avgResponseTime)}ms) is high. Review database queries and caching strategy.`);
    }
    if (data.errorRate > 1) {
      recommendations.push(`Error rate (${data.errorRate.toFixed(2)}%) exceeds 1% target. Review error logs and fix root causes.`);
    }
    if (data.cacheHitRate < 50) {
      recommendations.push(`Cache hit rate (${data.cacheHitRate.toFixed(1)}%) is below 50%. Consider caching more frequently accessed data.`);
    }
    if (data.poolStats.waiting > 0) {
      recommendations.push(`Database connections are waiting (${data.poolStats.waiting}). Consider increasing pool size.`);
    }
    if (data.poolStats.idle === 0 && data.poolStats.total > 0) {
      recommendations.push("No idle database connections. Pool may be under-provisioned for current load.");
    }
    const heapUsedMB = data.memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = data.memoryUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = heapUsedMB / heapTotalMB * 100;
    if (heapUsagePercent > 85) {
      recommendations.push(`Memory usage (${heapUsagePercent.toFixed(1)}%) is high. Consider memory optimization or increasing heap size.`);
    }
    const criticallySlowEndpoints = data.slowestEndpoints.filter((e) => e.p95DurationMs > 1e3);
    if (criticallySlowEndpoints.length > 0) {
      recommendations.push(`${criticallySlowEndpoints.length} endpoints have P95 > 1000ms. Priority optimization needed.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("System performance is within acceptable parameters. Continue monitoring.");
    }
    return recommendations;
  }
  /**
   * Calculate percentile
   */
  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index3 = Math.ceil(p / 100 * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index3)];
  }
  /**
   * Print formatted report to console
   */
  async printReport() {
    const report = await this.generateReport();
    console.log("\n" + "=".repeat(60));
    console.log("              PERFORMANCE MONITORING REPORT");
    console.log("=".repeat(60));
    console.log(`Generated: ${report.generatedAt.toISOString()}`);
    console.log(`Uptime: ${Math.round(report.uptime)}s`);
    console.log("\n\u{1F4C8} REQUEST SUMMARY");
    console.log("\u2500".repeat(40));
    console.log(`  Total Requests:    ${report.summary.totalRequests}`);
    console.log(`  Requests/sec:      ${report.summary.requestsPerSecond.toFixed(2)}`);
    console.log(`  Error Rate:        ${report.summary.errorRate.toFixed(2)}%`);
    console.log(`  Avg Response:      ${report.summary.avgResponseTime}ms`);
    console.log(`  P50:               ${report.summary.p50ResponseTime}ms`);
    console.log(`  P95:               ${report.summary.p95ResponseTime}ms`);
    console.log(`  P99:               ${report.summary.p99ResponseTime}ms`);
    console.log("\n\u{1F4BE} DATABASE");
    console.log("\u2500".repeat(40));
    console.log(`  Avg Query Time:    ${report.database.avgQueryTime}ms`);
    console.log(`  Slow Queries:      ${report.database.slowQueryCount}`);
    console.log(`  Pool - Total:      ${report.database.connectionPoolStats.total}`);
    console.log(`  Pool - Idle:       ${report.database.connectionPoolStats.idle}`);
    console.log(`  Pool - Waiting:    ${report.database.connectionPoolStats.waiting}`);
    console.log("\n\u{1F5C3}\uFE0F  CACHE");
    console.log("\u2500".repeat(40));
    console.log(`  Hit Rate:          ${report.cache.totalHitRate.toFixed(1)}%`);
    console.log(`  Cache Size:        ${report.cache.size} entries`);
    console.log(`  Evictions:         ${report.cache.evictions}`);
    console.log("\n\u{1F50C} WEBSOCKET");
    console.log("\u2500".repeat(40));
    console.log(`  Active:            ${report.websocket.activeConnections}`);
    console.log(`  Peak:              ${report.websocket.peakConnections}`);
    console.log(`  Messages Sent:     ${report.websocket.messagesSent}`);
    console.log(`  Avg Latency:       ${report.websocket.avgLatency}ms`);
    console.log("\n\u{1F4BB} MEMORY (MB)");
    console.log("\u2500".repeat(40));
    console.log(`  Heap Used:         ${report.memory.heapUsed}MB`);
    console.log(`  Heap Total:        ${report.memory.heapTotal}MB`);
    console.log(`  RSS:               ${report.memory.rss}MB`);
    if (report.slowestEndpoints.length > 0) {
      console.log("\n\u{1F422} TOP 5 SLOWEST ENDPOINTS");
      console.log("\u2500".repeat(40));
      for (const endpoint of report.slowestEndpoints.slice(0, 5)) {
        console.log(`  ${endpoint.method} ${endpoint.path}`);
        console.log(`    Calls: ${endpoint.totalCalls} | Avg: ${Math.round(endpoint.avgDurationMs)}ms | P95: ${endpoint.p95DurationMs}ms`);
      }
    }
    console.log("\n\u{1F4A1} RECOMMENDATIONS");
    console.log("\u2500".repeat(40));
    for (const rec of report.recommendations) {
      console.log(`  \u2022 ${rec}`);
    }
    console.log("\n" + "=".repeat(60) + "\n");
  }
  /**
   * Reset all metrics
   */
  reset() {
    this.endpointMetrics.clear();
    this.systemMetrics = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.allResponseTimes = [];
    this.requestTimestamps = [];
  }
};
var performanceMonitor = new PerformanceMonitor();

// server/middleware.ts
function requestLogger(req, res, next) {
  const start = Date.now();
  const path3 = req.path;
  const isProduction3 = process.env.NODE_ENV === "production";
  let capturedJsonResponse = void 0;
  if (req.method === "GET" && path3.startsWith("/api/")) {
    if (path3.includes("/homepage-content") || path3.includes("/announcements")) {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
    } else if (!path3.includes("/auth")) {
      res.setHeader("Cache-Control", "private, max-age=30");
    }
  }
  if (!isProduction3) {
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      performanceMonitor.recordRequest(req.method, req.route?.path || path3, duration, res.statusCode);
    }
    if (res.statusCode >= 400 && res.statusCode < 500) {
      console.log(`\u274C 4xx ERROR: ${req.method} ${req.originalUrl || path3} - Status ${res.statusCode}`);
    }
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (!isProduction3 && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(sanitizeLogData(capturedJsonResponse))}`;
      }
      console.log(logLine.length > 80 ? logLine.slice(0, 79) + "\u2026" : logLine);
    }
  });
  next();
}
function sanitizeLogData(data) {
  if (Array.isArray(data)) return data.map((item) => sanitizeLogData(item));
  if (data && typeof data === "object") {
    const sanitized = { ...data };
    const sensitiveFields = ["password", "token", "jwt", "secret", "key", "auth", "session"];
    for (const field of sensitiveFields) {
      if (field in sanitized) sanitized[field] = "[REDACTED]";
    }
    for (const key in sanitized) {
      if (sanitized[key] && typeof sanitized[key] === "object") {
        sanitized[key] = sanitizeLogData(sanitized[key]);
      }
    }
    return sanitized;
  }
  return data;
}
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.log(`ERROR: ${req.method} ${req.path} - ${err.message}`);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
}

// server/seed-terms.ts
init_storage();
init_schema();
async function seedAcademicTerms() {
  try {
    const existingTerms = await db2.select().from(academicTerms2);
    if (existingTerms.length === 0) {
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const nextYear = currentYear + 1;
      const academicYear = `${currentYear}/${nextYear}`;
      const defaultTerms = [
        {
          name: "First Term",
          year: academicYear,
          startDate: `${currentYear}-09-01`,
          endDate: `${currentYear}-12-15`,
          isCurrent: true
        },
        {
          name: "Second Term",
          year: academicYear,
          startDate: `${nextYear}-01-06`,
          endDate: `${nextYear}-04-10`,
          isCurrent: false
        },
        {
          name: "Third Term",
          year: academicYear,
          startDate: `${nextYear}-04-21`,
          endDate: `${nextYear}-07-18`,
          isCurrent: false
        }
      ];
      for (const term of defaultTerms) {
        await db2.insert(academicTerms2).values(term);
      }
    } else {
    }
  } catch (error) {
    throw error;
  }
}

// server/initialization.ts
init_db();
import fs4 from "fs/promises";
async function initializeSystem() {
  if (isPostgres) {
    console.log("\u2705 Using POSTGRESQL database");
  }
  try {
    console.log("Seeding academic terms...");
    await seedAcademicTerms();
    const { seedSystemSettings: seedSystemSettings2 } = await Promise.resolve().then(() => (init_seed_system_settings(), seed_system_settings_exports));
    await seedSystemSettings2();
    const { seedRoles: seedRoles2 } = await Promise.resolve().then(() => (init_seed_roles(), seed_roles_exports));
    await seedRoles2();
    const { seedTestUsers: seedTestUsers2 } = await Promise.resolve().then(() => (init_seed_test_users(), seed_test_users_exports));
    await seedTestUsers2();
    await fs4.mkdir("server/uploads/profiles", { recursive: true });
    await fs4.mkdir("server/uploads/homepage", { recursive: true });
    await fs4.mkdir("server/uploads/gallery", { recursive: true });
    await fs4.mkdir("server/uploads/study-resources", { recursive: true });
    await fs4.mkdir("server/uploads/general", { recursive: true });
    await fs4.mkdir("server/uploads/csv", { recursive: true });
    console.log("\u2705 Initialization completed");
  } catch (error) {
    console.error("\u274C Initialization error:", error);
  }
}

// server/index.ts
var isProduction2 = process.env.NODE_ENV === "production";
validateEnvironment(isProduction2);
var app = express2();
app.set("trust proxy", 1);
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"]
}));
app.use(compression());
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use("/uploads", express2.static("server/uploads"));
app.use(requestLogger);
(async () => {
  await initializeSystem();
  const server = await registerRoutes2(app);
  performanceMonitor.start();
  databaseOptimizer.createPerformanceIndexes();
  if (app.get("env") === "development" || !!process.env.REPLIT_DEV_DOMAIN) {
    await setupVite(app, server);
  } else if (!process.env.FRONTEND_URL) {
    serveStatic(app);
  }
  app.use(errorHandler);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`serving on port ${port}`);
  });
})();
