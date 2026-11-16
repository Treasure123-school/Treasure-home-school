/** CSV upload + bulk provisioning + import preview/commit endpoints — split from invites.routes.ts. */
/** Auto-split from routes.ts — invites (orig lines 7631-9354). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { contactSchema, BCRYPT_ROUNDS } from '../routes/upload-config';
import { upload, uploadCSV } from '../routes/upload-config';
import { generatePassword, generateUsername, getNextUserNumber } from '../auth-utils';
import { realtimeService } from '../realtime-service';
import { ROLES, SECRET_KEY, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { insertContactMessageSchema, insertUserSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { ZodError, z } from 'zod';

export async function registerUserCsvRoutes(app: Express) {
  // CSV Upload for bulk user provisioning
  app.post("/api/admin/upload-users-csv", authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }
      // Read and parse CSV file (uploadCSV uses multer memoryStorage, so the
      // file is an in-memory buffer — there is no req.file.path on disk)
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV file must contain header and at least one row" });
      }
      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      // Expected columns: studentName, class, parentName, parentEmail
      const requiredColumns = ['studentname', 'class', 'parentname', 'parentemail'];
      const hasRequiredColumns = requiredColumns.every(col => headers.includes(col));

      if (!hasRequiredColumns) {
        return res.status(400).json({
          message: "CSV must contain columns: studentName, class, parentName, parentEmail"
        });
      }
      const currentYear = new Date().getFullYear().toString();
      const { generateUsername, generatePassword } = await import('../auth-utils');

      // Get all existing usernames to ensure uniqueness
      const allUsers = await storage.getAllUsers();
      const existingUsernames = allUsers.map(u => u.username).filter((u): u is string => !!u);
      const createdUsers: any[] = [];
      const errors: string[] = [];

      // Get roles
      const studentRoleData = await storage.getRoleByName('Student');
      const parentRoleData = await storage.getRoleByName('Parent');

      if (!studentRoleData || !parentRoleData) {
        return res.status(500).json({ message: "Required roles (Student, Parent) not found in database" });
      }
      // Parse each row
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        try {
          // Extract data
          const studentName = row['studentname'];
          const className = row['class'];
          const rollNo = row['rollno'] || String(i);
          const parentName = row['parentname'];
          const parentEmail = row['parentemail'];

          if (!studentName || !className || !parentName || !parentEmail) {
            errors.push(`Row ${i + 1}: Missing required fields`);
            continue;
          }
          // Split student name
          const [studentFirstName, ...studentLastParts] = studentName.split(' ');
          const studentLastName = studentLastParts.join(' ') || studentFirstName;

          // Split parent name
          const [parentFirstName, ...parentLastParts] = parentName.split(' ');
          const parentLastName = parentLastParts.join(' ') || parentFirstName;

          // Check if parent already exists
          let parent = await storage.getUserByEmail(parentEmail);
          let parentId: string;
          let parentCredentials = null;

          if (!parent) {
            // Create parent account - calculate correct sequence number
            const parentCount = existingUsernames.filter(u => u.startsWith(`THS-PAR-`)).length + 1;
            const parentUsername = generateUsername(parentRoleData.id, parentCount);
            const parentPassword = generatePassword(currentYear);
            const parentPasswordHash = await bcrypt.hash(parentPassword, BCRYPT_ROUNDS);

            // Generate UUID for parent (required for PostgreSQL)
            const csvParentId = randomUUID();

            parent = await storage.createUser({
              id: csvParentId, // PostgreSQL requires explicit UUID
              username: parentUsername,
              email: parentEmail,
              passwordHash: parentPasswordHash,
              roleId: parentRoleData.id,
              firstName: parentFirstName,
              lastName: parentLastName,
              mustChangePassword: true,
              profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
              profileSkipped: false // 🔧 FIX: CSV import parents start with incomplete profile
            } as any);

            // CRITICAL: Track newly created username to prevent duplicates in same batch
            existingUsernames.push(parentUsername);
            parentCredentials = { username: parentUsername, password: parentPassword };
            parentId = parent.id;
          } else {
            parentId = parent.id;
          }
          // Get class (including inactive classes to allow CSV uploads to any existing class)
          const classObj = await storage.getAllClasses(true);
          const studentClass = classObj.find(c => c.name.toLowerCase() === className.toLowerCase());

          if (!studentClass) {
            errors.push(`Row ${i + 1}: Class "${className}" not found`);
            continue;
          }
          // Create student account - calculate correct sequence number
          const studentCount = existingUsernames.filter(u => u.startsWith(`THS-STU-`)).length + 1;
          const studentUsername = generateUsername(studentRoleData.id, studentCount);
          const studentPassword = generatePassword(currentYear);
          const studentPasswordHash = await bcrypt.hash(studentPassword, BCRYPT_ROUNDS);

          // Generate UUID for student (required for PostgreSQL)
          const csvStudentId = randomUUID();

          const studentUser = await storage.createUser({
            id: csvStudentId, // PostgreSQL requires explicit UUID
            username: studentUsername,
            email: '', // No auto-generated email; user can add real email via profile
            passwordHash: studentPasswordHash,
            roleId: studentRoleData.id,
            firstName: studentFirstName,
            lastName: studentLastName,
            mustChangePassword: true,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: CSV import students start with incomplete profile
          } as any);

          // CRITICAL: Track newly created username to prevent duplicates in same batch
          existingUsernames.push(studentUsername);

          // Create student record
          const admissionNumber = studentUsername;
          await storage.createStudent({
            id: studentUser.id,
            admissionNumber,
            admissionDate: new Date().toISOString().split('T')[0], // Today's date as admission date
            classId: studentClass.id,
            parentId: parentId
          });

          createdUsers.push({
            type: 'student',
            name: studentName,
            username: studentUsername,
            password: studentPassword,
            class: className,
            parent: {
              name: parentName,
              email: parentEmail,
              credentials: parentCredentials
            }
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully created ${createdUsers.length} users`,
        users: createdUsers,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  // Preview CSV import (validate and return preview)
  app.post('/api/admin/import/preview', authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      // uploadCSV uses multer memoryStorage — read from the in-memory buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const { previewCSVImport } = await import('../csv-import-service');

      const preview = await previewCSVImport(csvContent);

      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to preview CSV' });
    }
  });

  // Preview CSV import (student endpoint - same as admin/import/preview)
  app.post('/api/students/csv-preview', authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      // uploadCSV uses multer memoryStorage — read from the in-memory buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const { previewCSVImport } = await import('../csv-import-service');

      const preview = await previewCSVImport(csvContent);

      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to preview CSV' });
    }
  });

  // Commit CSV import (create users from validated CSV)
  app.post('/api/students/csv-commit', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { validRows } = req.body;

      if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
        return res.status(400).json({ message: 'No valid rows to import' });
      }
      const { commitCSVImport } = await import('../csv-import-service');
      const adminUserId = req.user!.id;

      const result = await commitCSVImport(validRows, adminUserId);

      // Log audit event
      await storage.createAuditLog({
        userId: adminUserId,
        action: 'bulk_student_import',
        entityType: 'student',
        entityId: '0', // Bulk operation
        newValue: JSON.stringify({ count: result.successCount, failed: result.failedRows.length }),
        reason: `Bulk imported ${result.successCount} students via CSV`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null
      });

      res.json({
        message: `Successfully imported ${result.successCount} students`,
        successCount: result.successCount,
        failedRows: result.failedRows,
        credentials: result.credentials
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to import students' });
    }
  });
}
