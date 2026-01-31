import express from "express";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { validateEnvironment } from "./env-validation";
import { performanceMonitor } from "./performance-monitor";
import { databaseOptimizer } from "./database-optimization";
import { requestLogger, errorHandler } from "./middleware";
import { initializeSystem } from "./initialization";

const isProduction = process.env.NODE_ENV === 'production';
validateEnvironment(isProduction);

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use('/uploads', express.static('server/uploads'));
app.use(requestLogger);

(async () => {
  await initializeSystem();
  const server = await registerRoutes(app);
  
  performanceMonitor.start();
  databaseOptimizer.createPerformanceIndexes();

  if (app.get("env") === "development" || !!process.env.REPLIT_DEV_DOMAIN) {
    await setupVite(app, server);
  } else if (!process.env.FRONTEND_URL) {
    serveStatic(app);
  }

  app.use(errorHandler);

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`serving on port ${port}`);
  });
})();
