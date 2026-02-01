import { Express } from "express";
import authRoutes from "./modules/auth";
import adminRoutes from "./modules/admin";
import reportsRoutes from "./modules/reports";
import examsRoutes from "./modules/exams";
import studentsRoutes from "./modules/students";
import teachersRoutes from "./modules/teachers";
import academicRoutes from "./modules/academic";
import teacherAssignmentsRouter from "../teacher-assignment-routes";

export function registerRoutes(app: Express) {
  // Authentication Routes
  app.use("/api/auth", authRoutes);
  
  // Admin & Management Routes
  app.use("/api/admin", adminRoutes);
  app.use("/api/academic", academicRoutes);
  app.use("/api/students", studentsRoutes);
  app.use("/api/teachers", teachersRoutes);
  
  // Academic & Result Routes
  app.use("/api/exams", examsRoutes);
  app.use("/api/reports", reportsRoutes);
  
  // Legacy/Teacher Assignment Routes
  app.use("/", teacherAssignmentsRouter);
}
