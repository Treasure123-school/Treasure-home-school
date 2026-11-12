/** Auto-split from routes.ts module scope — upload-config. See git history. */
import * as schema from '@shared/schema.pg';
import { enhancedCache } from '../enhanced-cache';
import { invalidateVisibilityCache } from '../exam-visibility';
import { SubjectAssignmentService } from '../services/subject-assignment-service';
import { storage } from '../storage';
import { students } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { and } from 'drizzle-orm';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';

// Helper function to extract file path from URL (local filesystem)
export function extractFilePathFromUrl(url: string): string {
  // For local filesystem URLs (e.g., /server/uploads/profiles/image.jpg)
  // Just return the path as-is for deletion
  return url.startsWith('/') ? url.substring(1) : url;
}

/**
 * CRITICAL: Shared helper for comprehensive cache invalidation and student sync
 * when class-subject mappings are modified. This ensures admin changes propagate
 * instantly to exams, report cards, and student visibility.
 * 
 * Called by: POST/DELETE/PUT class-subject-mapping endpoints
 */

export async function invalidateSubjectMappingsAndSync(
  affectedClassIds: number[],
  options: { cleanupReportCards?: boolean; addMissingSubjects?: boolean } = {}
): Promise<{ studentsSynced: number; reportCardItemsRemoved: number; reportCardItemsAdded: number; examScoresSynced: number; cacheKeysInvalidated: number; syncErrors: string[] }> {
  let cacheKeysInvalidated = 0;
  let totalSynced = 0;
  let reportCardItemsRemoved = 0;
  let reportCardItemsAdded = 0;
  let examScoresSynced = 0;
  const syncErrors: string[] = [];

  // 1. Invalidate visibility caches (affects exam visibility)
  for (const classId of affectedClassIds) {
    cacheKeysInvalidated += invalidateVisibilityCache({ classId });
  }

  // 2. Invalidate subject assignment caches (affects subject visibility)
  for (const classId of affectedClassIds) {
    cacheKeysInvalidated += SubjectAssignmentService.invalidateClassCache(classId);
  }

  // 3. Invalidate ALL report card related caches comprehensively
  // Match EXACT patterns used in enhanced-cache.ts:
  cacheKeysInvalidated += enhancedCache.invalidate(/^reportcard:/);        // reportcard:{id}
  cacheKeysInvalidated += enhancedCache.invalidate(/^reportcards:/);       // reportcards:student:*, reportcards:class:*
  cacheKeysInvalidated += enhancedCache.invalidate(/^report-card/);        // any report-card* patterns
  cacheKeysInvalidated += enhancedCache.invalidate(/^student-report/);     // student-report* patterns

  // 4. Sync students with new mappings so changes take effect immediately
  for (const classId of affectedClassIds) {
    const syncResult = await storage.syncStudentsWithClassMappings(classId);
    totalSynced += syncResult.synced;
    if (syncResult.errors && syncResult.errors.length > 0) {
      syncErrors.push(...syncResult.errors);
    }
  }

  // 5. Cleanup report cards for affected classes (remove items for unassigned subjects)
  if (options.cleanupReportCards && affectedClassIds.length > 0) {
    const cleanupResult = await storage.cleanupReportCardsForClasses(affectedClassIds);
    reportCardItemsRemoved = cleanupResult.itemsRemoved;
  }

  // 6. FIX: Add missing subjects to existing report cards when new mappings are added
  // This ensures report cards are updated when admin adds new subjects to class/department mappings
  if (options.addMissingSubjects !== false && affectedClassIds.length > 0) {
    try {
      const addResult = await storage.addMissingSubjectsToReportCards(affectedClassIds);
      reportCardItemsAdded = addResult.itemsAdded;
      examScoresSynced = addResult.examScoresSynced;
      if (addResult.errors && addResult.errors.length > 0) {
        syncErrors.push(...addResult.errors);
      }
    } catch (error: any) {
      console.error('[SUBJECT-MAPPING-SYNC] Error adding missing subjects to report cards:', error);
      syncErrors.push(`Failed to add missing subjects: ${error.message}`);
    }
  }

  console.log(`[SUBJECT-MAPPING-SYNC] Classes: ${affectedClassIds.length}, Students synced: ${totalSynced}, Cache invalidated: ${cacheKeysInvalidated}, Report items removed: ${reportCardItemsRemoved}, Report items added: ${reportCardItemsAdded}, Exam scores synced: ${examScoresSynced}, Errors: ${syncErrors.length}`);

  return { studentsSynced: totalSynced, reportCardItemsRemoved, reportCardItemsAdded, examScoresSynced, cacheKeysInvalidated, syncErrors };
}



export const loginSchema = z.object({
  identifier: z.string().min(1), // Can be username or email
  password: z.string().min(1)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().min(1)
});


// Rate limiting for login attempts (simple in-memory store)
export const loginAttempts = new Map();
export const lockoutViolations = new Map(); // Track rate limit violations per user with timestamp
export const isDevelopment = process.env.NODE_ENV !== 'production';
export const MAX_LOGIN_ATTEMPTS = isDevelopment ? 100 : 5; // Higher threshold for dev/load testing
export const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
export const LOCKOUT_VIOLATION_WINDOW = 60 * 60 * 1000; // 1 hour window for tracking violations
export const MAX_RATE_LIMIT_VIOLATIONS = isDevelopment ? 50 : 3; // Higher threshold for dev/load testing
export const BCRYPT_ROUNDS = isDevelopment ? 8 : 12; // Faster bcrypt in development for load testing
const TEST_ACCOUNTS = ['student', 'teacher', 'admin', 'parent', 'superadmin']; // Skip rate limiting for these

// Periodic cleanup of expired violations and login attempts
setInterval(() => {
  const now = Date.now();

  // Clean up old login attempts
  for (const [key, data] of Array.from(loginAttempts.entries())) {
    if (now - data.lastAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(key);
    }
  }

  // Clean up old lockout violations
  for (const [identifier, data] of Array.from(lockoutViolations.entries())) {
    const recentViolations = data.timestamps.filter((ts: number) => now - ts < LOCKOUT_VIOLATION_WINDOW);
    if (recentViolations.length === 0) {
      lockoutViolations.delete(identifier);
    } else if (recentViolations.length !== data.timestamps.length) {
      lockoutViolations.set(identifier, { count: recentViolations.length, timestamps: recentViolations });
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes


// Configure multer for file uploads - ALL files stored locally in server/uploads

export const uploadDir = 'server/uploads';
const galleryDir = 'server/uploads/gallery';
const profileDir = 'server/uploads/profiles';
const studyResourcesDir = 'server/uploads/study-resources';
const homepageDir = 'server/uploads/homepage';

// Ensure upload directories exist
fs.mkdir(uploadDir, { recursive: true }).catch(() => { });
fs.mkdir(galleryDir, { recursive: true }).catch(() => { });
fs.mkdir(profileDir, { recursive: true }).catch(() => { });
fs.mkdir(studyResourcesDir, { recursive: true }).catch(() => { });
fs.mkdir(homepageDir, { recursive: true }).catch(() => { });

// Replace disk storage with memory storage for serverless support (Vercel/Render)
const storage_multer = multer.memoryStorage();

export const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024, // Increased to 10MB to allow uncompressed uploads
  },
  fileFilter: (req, file, cb) => {
    // Branding and system settings need more flexible validation if they are being mapped to homepage
    const isBranding = req.body.uploadType === 'logo' || req.body.uploadType === 'favicon' || req.body.uploadType === 'branding';

    // Support more types and be more permissive for branding
    const allowedTypes = isBranding ? /jpeg|jpg|png|gif|webp|ico|svg/ : /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Configure branding upload route explicitly to handle Cloudinary if available
const brandingUpload = upload.single("file");

// Separate multer configuration for study resources (documents)
export const uploadDocument = multer({
  storage: storage_multer,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf' || file.mimetype.includes('word');

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only document files (PDF, DOC, DOCX, TXT) are allowed!'));
    }
  }
});

// Assignment submission upload (PDF, DOC, DOCX, images up to 10MB)
export const uploadAssignment = multer({
  storage: storage_multer,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /pdf|doc|docx|txt|png|jpg|jpeg|gif|webp/;
    const extOk = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = /pdf|doc|word|image|text/.test(file.mimetype);
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error('File type not allowed. Use PDF, DOC, DOCX, TXT, or images.'));
  },
});

// CSV upload configuration for bulk user provisioning
const csvDir = 'server/uploads/csv';
fs.mkdir(csvDir, { recursive: true }).catch(() => { });

export const uploadCSV = multer({
  storage: storage_multer,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for CSV
  }
});

// BACKGROUND AUTO-PUBLISHING SERVICE - Makes scheduled exams live
