import { Express } from "express";
import authRoutes from "./modules/auth";
import adminRoutes from "./modules/admin";
import reportsRoutes from "./modules/reports";

export function registerRoutes(app: Express) {
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/reports", reportsRoutes);
}
