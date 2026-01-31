import { Express } from "express";
import authRoutes from "./modules/auth";
import adminRoutes from "./modules/admin";
import healthRoutes from "./health.routes";
import termsRoutes from "./terms.routes";
import classesRoutes from "./classes.routes";
import subjectsRoutes from "./subjects.routes";
import notificationsRoutes from "./notifications.routes";

export function registerRoutes(app: Express) {
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/terms", termsRoutes);
  app.use("/api/classes", classesRoutes);
  app.use("/api/subjects", subjectsRoutes);
  app.use("/api/notifications", notificationsRoutes);
}
