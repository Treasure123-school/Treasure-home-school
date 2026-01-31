import { type Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes as registerApiRoutes } from "./routes/index";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register modular API routes
  registerApiRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
