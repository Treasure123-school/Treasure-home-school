/** Auto-split from routes.ts — parents-portal (orig lines 5311-5832). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { BCRYPT_ROUNDS } from '../routes/upload-config';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { generateParentUsername } from '../username-generator';
import { students } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

export async function registerParentsPortalRoutes(app: Express) {

  // File storage already initialized in server/index.ts

  app.get('/api/auth/me', authenticateUser, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      // Fetch full user details from database to check isActive status
      const fullUser = await storage.getUser(user.id);
      if (!fullUser || !fullUser.isActive) {
        return res.status(403).json({ message: 'Account is inactive' });
      }
      const { passwordHash, ...userWithoutPassword } = fullUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Parent-child linking endpoint
  // ── Parent Management Endpoints (Admin) ─────────────────────────────────────

  // List all parents enriched with linked students
  app.get('/api/parents', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const parentRole = await storage.getRoleByName('Parent');
      if (!parentRole) return res.status(500).json({ message: 'Parent role not found' });

      const parentUsers = await storage.getUsersByRole(parentRole.id);
      const [allStudents, allClasses, allUsers] = await Promise.all([
        storage.getAllStudents(),
        storage.getAllClasses(),
        storage.getAllUsers(),
      ]);

      const userMap: Record<string, any> = {};
      allUsers.forEach((u: any) => { userMap[u.id] = u; });
      const classMap: Record<number, any> = {};
      allClasses.forEach((c: any) => { classMap[c.id] = c; });

      const parents = parentUsers.map((parent: any) => {
        const linkedStudents = allStudents
          .filter((s: any) => s.parentId === parent.id)
          .map((s: any) => {
            const su = userMap[s.id];
            const cls = classMap[s.classId];
            return {
              id: s.id,
              admissionNumber: s.admissionNumber,
              firstName: su?.firstName ?? '',
              lastName: su?.lastName ?? '',
              username: su?.username ?? '',
              className: cls?.name ?? '',
              classId: s.classId,
            };
          });
        const { passwordHash: _, ...safeParent } = parent;
        return { ...safeParent, linkedStudents };
      });

      res.json(parents);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch parents' });
    }
  });

  // Student autocomplete search for parent linking
  app.get('/api/students/search', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      const q = (req.query.q as string || '').toLowerCase().trim();
      if (!q || q.length < 1) return res.json([]);

      const [allStudents, allUsers, allClasses] = await Promise.all([
        storage.getAllStudents(),
        storage.getAllUsers(),
        storage.getAllClasses(),
      ]);

      const userMap: Record<string, any> = {};
      allUsers.forEach((u: any) => { userMap[u.id] = u; });
      const classMap: Record<number, any> = {};
      allClasses.forEach((c: any) => { classMap[c.id] = c; });

      const results = allStudents
        .map((s: any) => {
          const u = userMap[s.id];
          if (!u) return null;
          return {
            id: s.id,
            admissionNumber: s.admissionNumber ?? '',
            firstName: u.firstName ?? '',
            lastName: u.lastName ?? '',
            username: u.username ?? '',
            className: classMap[s.classId]?.name ?? '',
            classId: s.classId,
            parentId: s.parentId,
          };
        })
        .filter((s: any): s is NonNullable<typeof s> => {
          if (!s) return false;
          const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
          return (
            fullName.includes(q) ||
            s.username.toLowerCase().includes(q) ||
            s.admissionNumber.toLowerCase().includes(q)
          );
        })
        .slice(0, 15);

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to search students' });
    }
  });

  // Create a new parent
  app.post('/api/parents', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, gender, studentIds = [] } = req.body;
      if (!firstName || !lastName) {
        return res.status(400).json({ message: 'First name and last name are required' });
      }

      const parentRole = await storage.getRoleByName('Parent');
      if (!parentRole) return res.status(500).json({ message: 'Parent role not found' });

      const { generateParentUsername, generateTempPassword } = await import('../username-generator');
      const username = await generateParentUsername();
      const plainPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

      const newUser = await storage.createUser({
        id: crypto.randomUUID(),
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        gender: gender || null,
        username,
        passwordHash,
        roleId: parentRole.id,
        isActive: true,
        status: 'active',
        mustChangePassword: true,
      } as any);

      // Create parent profile
      await storage.createParentProfile({
        userId: newUser.id,
        linkedStudents: JSON.stringify(studentIds),
        occupation: null,
        contactPreference: null,
      });

      // Link each student to this parent
      if (Array.isArray(studentIds) && studentIds.length > 0) {
        for (const sid of studentIds) {
          await storage.updateStudent(sid, { studentPatch: { parentId: newUser.id } });
        }
      }

      const { passwordHash: _, ...safeUser } = newUser;
      res.status(201).json({
        user: safeUser,
        credentials: { username, password: plainPassword },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create parent' });
    }
  });

  // Update parent info
  app.put('/api/parents/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, gender } = req.body;

      const updated = await storage.updateUser(id, { firstName, lastName, email, phone, gender });
      if (!updated) return res.status(404).json({ message: 'Parent not found' });

      const { passwordHash: _, ...safe } = updated;
      res.json(safe);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update parent' });
    }
  });

  // Link additional students to an existing parent
  app.post('/api/parents/:id/link-students', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const parentId = req.params.id;
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ message: 'studentIds array is required' });
      }

      for (const sid of studentIds) {
        await storage.updateStudent(sid, { studentPatch: { parentId } });
      }

      // Update parent profile linkedStudents
      const profile = await storage.getParentProfile(parentId);
      const current: string[] = profile ? JSON.parse(profile.linkedStudents || '[]') : [];
      const merged = Array.from(new Set([...current, ...studentIds]));
      await storage.updateParentProfile(parentId, { linkedStudents: JSON.stringify(merged) });

      res.json({ message: `Linked ${studentIds.length} student(s) successfully` });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to link students' });
    }
  });

  // Unlink a student from a parent
  app.delete('/api/parents/:id/unlink/:studentId', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id: parentId, studentId } = req.params;
      await storage.updateStudent(studentId, { studentPatch: { parentId: null } });

      // Remove from parent profile linkedStudents
      const profile = await storage.getParentProfile(parentId);
      if (profile) {
        const current: string[] = JSON.parse(profile.linkedStudents || '[]');
        const updated = current.filter(sid => sid !== studentId);
        await storage.updateParentProfile(parentId, { linkedStudents: JSON.stringify(updated) });
      }

      res.json({ message: 'Student unlinked successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to unlink student' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  app.get('/api/parents/children/:parentId', authenticateUser, async (req, res) => {
    try {
      const parentId = req.params.parentId;
      const user = req.user;

      // Security: Only allow parents to access their own children or admins
      if (user?.roleId !== ROLES.PARENT && user?.roleId !== ROLES.ADMIN && user?.id !== parentId) {
        return res.status(403).json({ message: 'Unauthorized access to parent records' });
      }
      const children = await storage.getStudentsByParentId(parentId);
      res.json(children);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch children records' });
    }
  });

  // ═══════════════════════════════════════════════════════
  // PARENT PORTAL API ROUTES
  // ═══════════════════════════════════════════════════════

  // GET /api/parent/children - Parent's own children (convenience, no ID needed)
  app.get('/api/parent/children', authenticateUser, authorizeRoles(ROLES.PARENT, ROLES.ADMIN), async (req, res) => {
    try {
      const parentId = req.user!.id;
      const students = await storage.getStudentsByParentId(parentId);
      // Enrich with user info (name, etc.)
      const enriched = await Promise.all(students.map(async (s: any) => {
        const userInfo = await storage.getUser(s.id);
        let className = null;
        if (s.classId) {
          const cls = await storage.getClass(s.classId);
          className = cls?.name ?? null;
        }
        return {
          id: s.id,
          admissionNumber: s.admissionNumber,
          classId: s.classId,
          className,
          department: s.department,
          admissionDate: s.admissionDate,
          firstName: userInfo?.firstName ?? '',
          lastName: userInfo?.lastName ?? '',
          email: userInfo?.email ?? '',
          profileImageUrl: userInfo?.profileImageUrl ?? null,
        };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch children' });
    }
  });

  // GET /api/parent/child-reports/:childId - Report cards for a specific child
  app.get('/api/parent/child-reports/:childId', authenticateUser, authorizeRoles(ROLES.PARENT, ROLES.ADMIN), async (req, res) => {
    try {
      const parentId = req.user!.id;
      const { childId } = req.params;
      // Verify ownership
      const children = await storage.getStudentsByParentId(parentId);
      const isOwner = (req.user!.roleId === ROLES.ADMIN) ||
        children.some((c: any) => c.id === childId);
      if (!isOwner) return res.status(403).json({ message: 'Access denied' });

      const reportCards = await db.select()
        .from(schema.reportCards)
        .where(and(eq(schema.reportCards.studentId, childId), eq(schema.reportCards.status, 'published')))
        .orderBy(desc(schema.reportCards.createdAt));

      const userInfo = await storage.getUser(childId);
      const student = children.find((c: any) => c.id === childId) || await storage.getStudent(childId);
      let className = null;
      if (student?.classId) {
        const cls = await storage.getClass(student.classId);
        className = cls?.name ?? null;
      }

      // Pre-fetch principal signature + name for all report cards using designated principal
      const { principalName: parentPrincipalName, principalSignatureUrl: parentPrincipalSignatureUrl } =
        await resolveDesignatedPrincipal(db, storage);
      const parentPrincipalSignature: string | null = parentPrincipalSignatureUrl;

      const enriched = await Promise.all(reportCards.map(async (rc: any) => {
        const items = await db.select().from(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, rc.id));
        const term = rc.termId ? await storage.getAcademicTerm(rc.termId) : null;
        const enrichedItems = await Promise.all(items.map(async (item: any) => {
          let subjectName = 'Unknown';
          if (item.subjectId) {
            const subj = await storage.getSubject(item.subjectId);
            subjectName = subj?.name ?? 'Unknown';
          }
          // Normalize scores: use testScore as primary (matches admin view), falling back to testWeightedScore
          // Use || so that a stored 0 in weighted fields falls back to the raw score
          const testScore = item.testScore || item.testWeightedScore || 0;
          const testWeightedScore = item.testWeightedScore || item.testScore || 0;
          const examScore = item.examScore || item.examWeightedScore || 0;
          const examWeightedScore = item.examWeightedScore || item.examScore || 0;
          return { ...item, subjectName, testScore, testWeightedScore, examScore, examWeightedScore };
        }));

        // Resolve teacher signature + name
        let teacherSignatureUrl = rc.teacherSignatureUrl || null;
        let teacherName = '';
        if (rc.classId) {
          const rcClass = await storage.getClass(rc.classId);
          if (rcClass?.classTeacherId) {
            if (!teacherSignatureUrl) {
              const teacherProf = await storage.getTeacherProfile(rcClass.classTeacherId);
              if (teacherProf?.signatureUrl) teacherSignatureUrl = teacherProf.signatureUrl;
            }
            const teacherUser = await storage.getUser(rcClass.classTeacherId);
            if (teacherUser) {
              teacherName = `${teacherUser.firstName || ''} ${teacherUser.lastName || ''}`.trim();
            }
          }
        }

        // Resolve principal signature: stored value or pre-fetched admin signature
        const principalSignatureUrl = rc.principalSignatureUrl || parentPrincipalSignature || null;

        // Fetch affective / psychomotor skills
        const skills = await storage.getReportCardSkills(rc.id);

        return {
          ...rc,
          studentName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Unknown',
          admissionNumber: (student as any)?.admissionNumber || null,
          studentPhoto: userInfo?.profileImageUrl || null,
          dateOfBirth: userInfo?.dateOfBirth || null,
          gender: userInfo?.gender || null,
          className,
          academicSession: term?.year ?? '',
          termName: term?.name ?? 'Unknown Term',
          termYear: term?.year ?? '',
          position: rc.position || 0,
          totalStudentsInClass: rc.totalStudentsInClass || 0,
          items: enrichedItems,
          teacherSignatureUrl,
          teacherSignedAt: rc.teacherSignedAt ? new Date(rc.teacherSignedAt).toISOString() : null,
          teacherSignedBy: rc.teacherSignedBy || null,
          teacherName,
          principalSignatureUrl,
          principalSignedAt: rc.principalSignedAt ? new Date(rc.principalSignedAt).toISOString() : null,
          principalSignedBy: rc.principalSignedBy || null,
          principalName: parentPrincipalName,
          affectiveTraits: {
            punctuality: skills?.punctuality || 0,
            neatness: skills?.neatness || 0,
            attentiveness: skills?.attentiveness || 0,
            teamwork: skills?.teamwork || 0,
            leadership: skills?.leadership || 0,
            assignments: skills?.assignments || 0,
            classParticipation: skills?.classParticipation || 0,
            honesty: skills?.honesty || 0,
            politeness: skills?.politeness || 0,
            selfControl: skills?.selfControl || 0,
            obedience: skills?.obedience || 0,
            reliability: skills?.reliability || 0,
            senseOfResponsibility: skills?.senseOfResponsibility || 0,
            relationshipWithOthers: skills?.relationshipWithOthers || 0,
          },
          psychomotorSkills: {
            sports: skills?.sports || 0,
            handwriting: skills?.handwriting || 0,
            musicalSkills: skills?.musicalSkills || 0,
            creativity: skills?.creativity || 0,
            handlingOfTools: skills?.handlingOfTools || 0,
            drawingPainting: skills?.drawingPainting || 0,
            publicSpeaking: skills?.publicSpeaking || 0,
            speechFluency: skills?.speechFluency || 0,
          },
          attendance: {
            timesSchoolOpened: 0,
            timesPresent: 0,
            timesAbsent: 0,
            attendancePercentage: 0,
          },
        };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch child report cards' });
    }
  });

  // GET /api/parent/attendance/:childId - Attendance records for a specific child
  app.get('/api/parent/attendance/:childId', authenticateUser, authorizeRoles(ROLES.PARENT, ROLES.ADMIN), async (req, res) => {
    try {
      const parentId = req.user!.id;
      const { childId } = req.params;
      const children = await storage.getStudentsByParentId(parentId);
      const isOwner = (req.user!.roleId === ROLES.ADMIN) ||
        children.some((c: any) => c.id === childId);
      if (!isOwner) return res.status(403).json({ message: 'Access denied' });

      const records = await storage.getAttendanceByStudent(childId);
      const total = records.length;
      const present = records.filter((r: any) => r.status === 'Present').length;
      const absent = records.filter((r: any) => r.status === 'Absent').length;
      const late = records.filter((r: any) => r.status === 'Late').length;
      const excused = records.filter((r: any) => r.status === 'Excused').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

      res.json({ records, summary: { total, present, absent, late, excused, rate } });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch attendance' });
    }
  });

  // GET /api/parent/grades/:childId - Exam results for a specific child
  app.get('/api/parent/grades/:childId', authenticateUser, authorizeRoles(ROLES.PARENT, ROLES.ADMIN), async (req, res) => {
    try {
      const parentId = req.user!.id;
      const { childId } = req.params;
      const children = await storage.getStudentsByParentId(parentId);
      const isOwner = (req.user!.roleId === ROLES.ADMIN) ||
        children.some((c: any) => c.id === childId);
      if (!isOwner) return res.status(403).json({ message: 'Access denied' });

      const results = await storage.getExamResultsByStudent(childId);
      const enriched = await Promise.all(results.map(async (r: any) => {
        let examName = 'Unknown Exam';
        let subjectName = 'Unknown';
        let examDate = null;
        let examType = 'exam';
        let termId: number | null = null;
        let termName: string | null = null;
        let termYear: string | null = null;
        if (r.examId) {
          const exam = await storage.getExamById(r.examId);
          if (exam) {
            examName = exam.name;
            examDate = exam.date;
            examType = exam.examType ?? 'exam';
            if (exam.subjectId) {
              const subj = await storage.getSubject(exam.subjectId!);
              subjectName = subj?.name ?? 'Unknown';
            }
            if (exam.termId) {
              termId = exam.termId;
              const term = await storage.getAcademicTerm(exam.termId!);
              if (term) {
                termName = term.name ?? null;
                termYear = (term as any).year ?? null;
              }
            }
          }
        }
        const score = r.score ?? r.marksObtained ?? 0;
        const maxScore = r.maxScore ?? 100;
        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        return { ...r, examName, subjectName, examDate, examType, score, maxScore, percentage, termId, termName, termYear };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch grades' });
    }
  });

  // GET /api/parent/profile - Parent's own profile
  app.get('/api/parent/profile', authenticateUser, authorizeRoles(ROLES.PARENT), async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      const profile = await storage.getParentProfile(userId);
      res.json({ user, profile });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // PUT /api/parent/profile - Update parent's own profile
  app.put('/api/parent/profile', authenticateUser, authorizeRoles(ROLES.PARENT), async (req, res) => {
    try {
      const userId = req.user!.id;
      const { firstName, lastName, phone, address } = req.body;
      await storage.updateUser(userId, { firstName, lastName, phone });
      const user = await storage.getUser(userId);
      const profile = await storage.getParentProfile(userId);
      res.json({ user, profile });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Notification API endpoints
}
