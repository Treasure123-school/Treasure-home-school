import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Define table schemas in smaller chunks and export them
// This avoids a single massive file
export * from "./schema/users";
export * from "./schema/academic";
export * from "./schema/exams";
export * from "./schema/students";
export * from "./schema/teachers";
export * from "./schema/admin-parent";
export * from "./schema/system";
export * from "./schema/attendance";
export * from "./schema/communication";
export * from "./schema/grading";
export * from "./schema/library";
export * from "./schema/audit";
export * from "./schema/timetable";
export * from "./schema/invites";
export * from "./schema/recovery";
export * from "./schema/gallery";
export * from "./schema/home-page";
export * from "./schema/contact";
export * from "./schema/notification";
export * from "./schema/exam-question";
export * from "./schema/question-bank";
export * from "./schema/exam-session";
export * from "./schema/student-answer";
export * from "./schema/performance";
export * from "./schema/teacher-assignment";
export * from "./schema/grading-task";
export * from "./schema/report-card";
export * from "./schema/student-subject";
export * from "./schema/class-mapping";
