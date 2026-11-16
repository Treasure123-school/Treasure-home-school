/** teacher-routes.shared.ts — schemas, auth middlewares, helpers shared by
 *  teacher route files. Extracted from assignment.routes.ts. */
import { Router, Request, Response } from 'express';
import { db } from '../../core/config/database';
import { storage } from '../../storage';
import jwt from 'jsonwebtoken';
import { 
  teacherClassAssignments, 
  teacherAssignmentHistory, 
  gradingBoundaries, 
  continuousAssessment,
  classes,
  subjects,
  users,
  academicTerms,
  students,
  classSubjectMappings
} from '@shared/schema.pg';
import { eq, and, desc, sql, isNull, or, gte, inArray } from 'drizzle-orm';
import { ROLE_IDS } from '@shared/role-constants';
import { z } from 'zod';
import { 
  checkTeacherAssignment, 
  getTeacherAssignments, 
  logUnauthorizedAccess 
} from './auth.middleware';

// JWT secret - must match the one in routes.ts
export const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-key-change-in-production' : undefined);

export 
// Helper to normalize UUIDs from various formats
function normalizeUuid(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }
  let bytes: number[] | undefined;
  if (typeof raw === 'string' && raw.includes(',')) {
    const parts = raw.split(',').map(s => parseInt(s.trim()));
    if (parts.length === 16 && parts.every(n => n >= 0 && n <= 255)) {
      bytes = parts;
    }
  }
  if (Array.isArray(raw) && raw.length === 16) {
    bytes = raw;
  } else if (raw instanceof Uint8Array && raw.length === 16) {
    bytes = Array.from(raw);
  }
  if (bytes) {
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }
  return undefined;
}



export const createAssignmentSchema = z.object({
  teacherId: z.string().min(1),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  termId: z.number().int().positive().optional(),
  session: z.string().optional(),
  department: z.string().optional(),
  validUntil: z.string().optional(),
});

export const updateAssignmentSchema = z.object({
  isActive: z.boolean().optional(),
  termId: z.number().int().positive().optional().nullable(),
  session: z.string().optional(),
  department: z.string().optional(),
  validUntil: z.string().optional().nullable(),
});

export const gradingBoundarySchema = z.object({
  name: z.string().min(1),
  grade: z.string().min(1),
  minScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(0).max(100),
  remark: z.string().optional(),
  gradePoint: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  termId: z.number().int().positive().optional().nullable(),
  classId: z.number().int().positive().optional().nullable(),
  subjectId: z.number().int().positive().optional().nullable(),
});

export const continuousAssessmentSchema = z.object({
  studentId: z.string().min(1),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  termId: z.number().int().positive(),
  testScore: z.number().int().min(0).max(40).optional(),
  examScore: z.number().int().min(0).max(60).optional(),
});

// Secure JWT authentication middleware for this router

// Secure JWT authentication middleware for this router
export const requireAuth = async (req: Request, res: Response, next: any) => {
  try {
    // If req.user is already set by parent middleware, use it
    if (req.user) {
      return next();
    }

    // Otherwise, verify JWT token ourselves
    const authHeader = (req.headers.authorization || '').trim();
    const [scheme, token] = authHeader.split(/\s+/);

    if (!/^bearer$/i.test(scheme) || !token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET as string);
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Normalize decoded userId before database lookup
    const normalizedUserId = normalizeUuid(decoded.userId);
    if (!normalizedUserId) {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    // Validate user still exists in database
    const user = await storage.getUser(normalizedUserId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // Block inactive users
    if (user.isActive === false) {
      return res.status(401).json({ message: 'Account has been deactivated' });
    }

    // Ensure role hasn't changed since token was issued
    if (user.roleId !== decoded.roleId) {
      return res.status(401).json({ message: 'User role has changed, please log in again' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

export const requireAdmin = async (req: Request, res: Response, next: any) => {
  // First authenticate the user
  await requireAuth(req, res, () => {
    if (!req.user) {
      return; // requireAuth already sent response
    }
    const user = req.user as { roleId: number };
    if (user.roleId !== ROLE_IDS.SUPER_ADMIN && user.roleId !== ROLE_IDS.ADMIN) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};


export function sanitizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const sanitized = ip.replace(/[^a-fA-F0-9.:,\s]/g, '').substring(0, 45);
  return sanitized || null;
}

