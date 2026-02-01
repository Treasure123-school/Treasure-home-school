import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateUser, SECRET_KEY, JWT_EXPIRES_IN, ROLES } from "./middleware";
import { sendSuccess, sendBadRequest, sendUnauthorized, sendNotFound, handleRouteError } from "../utils/response-helpers";

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

const isDevelopment = process.env.NODE_ENV !== 'production';
const MAX_LOGIN_ATTEMPTS = isDevelopment ? 100 : 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const LOCKOUT_VIOLATION_WINDOW = 60 * 60 * 1000;
const MAX_RATE_LIMIT_VIOLATIONS = isDevelopment ? 50 : 3;
const BCRYPT_ROUNDS = isDevelopment ? 8 : 12;
const TEST_ACCOUNTS = ['student', 'teacher', 'admin', 'parent', 'superadmin'];

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const lockoutViolations = new Map<string, { count: number; timestamps: number[] }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of Array.from(loginAttempts.entries())) {
    if (now - data.lastAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(key);
    }
  }
  for (const [identifier, data] of Array.from(lockoutViolations.entries())) {
    const recentViolations = data.timestamps.filter((ts: number) => now - ts < LOCKOUT_VIOLATION_WINDOW);
    if (recentViolations.length === 0) {
      lockoutViolations.delete(identifier);
    } else if (recentViolations.length !== data.timestamps.length) {
      lockoutViolations.set(identifier, { count: recentViolations.length, timestamps: recentViolations });
    }
  }
}, 5 * 60 * 1000);

router.get('/me', authenticateUser, async (req: any, res: Response) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return sendNotFound(res, "User not found");
    }
    sendSuccess(res, user);
  } catch (error) {
    handleRouteError(res, error, 'auth.me');
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return sendBadRequest(res, "Invalid login data");
    }

    const { identifier, password } = result.data;
    const isTestAccount = TEST_ACCOUNTS.includes(identifier.toLowerCase());
    
    if (!isTestAccount) {
      const violations = lockoutViolations.get(identifier);
      if (violations && violations.count >= MAX_RATE_LIMIT_VIOLATIONS) {
        return res.status(429).json({ 
          message: "Account temporarily locked due to repeated failed attempts. Please try again later or contact support." 
        });
      }

      const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;

      if (timeSinceLastAttempt < RATE_LIMIT_WINDOW && attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const now = Date.now();
        const currentViolations = lockoutViolations.get(identifier) || { count: 0, timestamps: [] };
        currentViolations.count++;
        currentViolations.timestamps.push(now);
        lockoutViolations.set(identifier, currentViolations);

        const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastAttempt) / 60000);
        return res.status(429).json({ 
          message: `Too many login attempts. Please try again in ${remainingTime} minutes.` 
        });
      }
    }

    const user = await storage.getUserByEmail(identifier) || await storage.getUserByUsername(identifier);
    if (!user) {
      if (!isTestAccount) {
        const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
        loginAttempts.set(identifier, { count: attempts.count + 1, lastAttempt: Date.now() });
      }
      return sendUnauthorized(res, "Invalid credentials");
    }

    if (user.isActive === false) {
      return sendUnauthorized(res, "Your account has been deactivated. Please contact the administrator.");
    }

    const isValidPassword = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!isValidPassword) {
      if (!isTestAccount) {
        const attempts = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
        loginAttempts.set(identifier, { count: attempts.count + 1, lastAttempt: Date.now() });
      }
      return sendUnauthorized(res, "Invalid credentials");
    }

    loginAttempts.delete(identifier);
    lockoutViolations.delete(identifier);

    const token = jwt.sign({ userId: user.id, roleId: user.roleId }, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });
    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        profileImageUrl: user.profileImageUrl || null,
        mustChangePassword: user.mustChangePassword ?? false,
      }
    });
  } catch (error) {
    handleRouteError(res, error, 'auth.login');
  }
});

router.post('/change-password', authenticateUser, async (req: any, res: Response) => {
  try {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) {
      return sendBadRequest(res, "Invalid password data");
    }

    const { currentPassword, newPassword } = result.data;
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return sendNotFound(res, "User not found");
    }

    const isValidPassword = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
    if (!isValidPassword) {
      return sendUnauthorized(res, "Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await storage.updateUser(user.id, { passwordHash: hashedPassword });
    sendSuccess(res, { message: "Password changed successfully" });
  } catch (error) {
    handleRouteError(res, error, 'auth.changePassword');
  }
});

router.post('/logout', authenticateUser, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, { message: "Logged out successfully" });
  } catch (error) {
    handleRouteError(res, error, 'auth.logout');
  }
});

export default router;
