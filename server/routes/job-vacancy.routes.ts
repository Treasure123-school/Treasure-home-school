import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES, AuthenticatedUser } from './middleware';
import { enhancedCache, EnhancedCache } from '../enhanced-cache';
import { realtimeService } from '../realtime-service';
import { z, ZodError } from 'zod';

const router = Router();

// ==================== JOB VACANCY SYSTEM ROUTES ====================

// Public routes - Job Vacancies (no auth required)
// Vacancies endpoint with caching (5-minute TTL) for improved performance
router.get('/api/vacancies', async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string | undefined;
        const cacheKey = `vacancies:list:${status || 'all'}`;

        const vacancies = await enhancedCache.getOrSet(
            cacheKey,
            () => storage.getAllVacancies(status),
            EnhancedCache.TTL.MEDIUM,  // 5 minutes TTL
            'L1'  // Hot data - public endpoint
        );

        res.json(vacancies);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch vacancies' });
    }
});

router.get('/api/vacancies/:id', async (req: Request, res: Response) => {
    try {
        const vacancy = await storage.getVacancy(req.params.id);
        if (!vacancy) {
            return res.status(404).json({ message: 'Vacancy not found' });
        }
        res.json(vacancy);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch vacancy' });
    }
});

// Teacher Application Submission (public)
const teacherApplicationSchema = z.object({
    vacancyId: z.string().optional().nullable(),
    fullName: z.string().min(1),
    googleEmail: z.string().email().regex(/@gmail\.com$/, 'Must be a Gmail address'),
    phone: z.string().min(1),
    subjectSpecialty: z.string().min(1),
    qualification: z.string().min(1),
    experienceYears: z.number().min(0),
    bio: z.string().min(1),
    resumeUrl: z.string().optional().nullable(),
});

router.post('/api/teacher-applications', async (req: Request, res: Response) => {
    try {
        const validatedData = teacherApplicationSchema.parse(req.body);

        // Check if email already has a pending or approved application
        const existingApplications = await storage.getAllTeacherApplications();
        const existingApp = existingApplications.find(
            (app: any) => app.googleEmail === validatedData.googleEmail &&
                (app.status === 'pending' || app.status === 'approved')
        );

        if (existingApp) {
            return res.status(400).json({
                message: existingApp.status === 'approved'
                    ? 'This email has already been approved'
                    : 'You already have a pending application'
            });
        }
        const application = await storage.createTeacherApplication(validatedData);

        // Create notification for admins
        const admins = await storage.getUsersByRole(ROLES.ADMIN);
        for (const admin of admins) {
            await storage.createNotification({
                userId: admin.id,
                type: 'teacher_application',
                title: 'New Teacher Application',
                message: `${validatedData.fullName} has applied for a teaching position`,
                relatedEntityType: 'teacher_application',
                relatedEntityId: application.id,
            });
            // Also send realtime notification
            realtimeService.emitNotification(admin.id, {
                title: 'New Teacher Application',
                message: `${validatedData.fullName} has applied for a teaching position`,
                type: 'teacher_application'
            });
        }

        // Emit realtime event for application creation
        realtimeService.emitTableChange('teacher_applications', 'INSERT', application);
        realtimeService.emitToRole('admin', 'application.created', application);

        res.status(201).json({
            message: 'Application submitted successfully. You will be notified once reviewed.',
            application
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: 'Failed to submit application' });
    }
});

// Admin-only routes for managing vacancies
router.post('/api/admin/vacancies', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const vacancy = await storage.createVacancy({
            ...req.body,
            createdBy: req.user!.id,
        });

        // Invalidate vacancies cache
        enhancedCache.invalidate(/^vacancies:/);

        // Emit realtime event for vacancy creation
        realtimeService.emitTableChange('vacancies', 'INSERT', vacancy, undefined, req.user!.id);
        realtimeService.emitEvent('vacancy.created', vacancy); // Broadcast publicly

        res.status(201).json(vacancy);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create vacancy' });
    }
});

router.patch('/api/admin/vacancies/:id/close', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const existingVacancy = await storage.getVacancy(req.params.id);
        const vacancy = await storage.updateVacancy(req.params.id, { status: 'closed' });
        if (!vacancy) {
            return res.status(404).json({ message: 'Vacancy not found' });
        }

        // Invalidate vacancies cache
        enhancedCache.invalidate(/^vacancies:/);

        // Emit realtime event for vacancy closure
        realtimeService.emitTableChange('vacancies', 'UPDATE', vacancy, existingVacancy, req.user!.id);
        realtimeService.emitEvent('vacancy.closed', vacancy); // Broadcast publicly

        res.json(vacancy);
    } catch (error) {
        res.status(500).json({ message: 'Failed to close vacancy' });
    }
});

// Admin routes for managing teacher applications
router.get('/api/admin/applications', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string | undefined;
        const applications = await storage.getAllTeacherApplications(status);
        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch applications' });
    }
});

router.patch('/api/admin/applications/:id/status', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const { status } = req.body;

        if (status === 'approved') {
            const result = await storage.approveTeacherApplication(req.params.id, req.user!.id);

            // Create notification for the applicant (if they have an account)
            const applicantUser = await storage.getUserByEmail(result.application.googleEmail);
            if (applicantUser) {
                await storage.createNotification({
                    userId: applicantUser.id,
                    type: 'application_approved',
                    title: 'Application Approved',
                    message: 'Your teacher application has been approved. You can now sign in with Google.',
                    relatedEntityType: 'teacher_application',
                    relatedEntityId: result.application.id,
                });
                // Send realtime notification
                realtimeService.emitNotification(applicantUser.id, {
                    title: 'Application Approved',
                    message: 'Your teacher application has been approved. You can now sign in with Google.',
                    type: 'application_approved'
                });
            }

            // Emit realtime event for application approval
            realtimeService.emitTableChange('teacher_applications', 'UPDATE', result.application, undefined, req.user!.id);
            realtimeService.emitToRole('admin', 'application.approved', result);

            res.json({
                message: 'Application approved successfully',
                ...result
            });
        } else if (status === 'rejected') {
            const { reason } = req.body;
            const application = await storage.rejectTeacherApplication(req.params.id, req.user!.id, reason || 'No reason provided');
            if (!application) {
                return res.status(404).json({ message: 'Application not found' });
            }

            // Emit realtime event for application rejection
            realtimeService.emitTableChange('teacher_applications', 'UPDATE', application, undefined, req.user!.id);
            realtimeService.emitToRole('admin', 'application.rejected', application);

            res.json({
                message: 'Application rejected',
                application
            });
        } else {
            res.status(400).json({ message: 'Invalid status' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to update application' });
    }
});

// Get approved teachers (admin only)
router.get('/api/admin/approved-teachers', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const approvedTeachers = await storage.getAllApprovedTeachers();
        res.json(approvedTeachers);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch approved teachers' });
    }
});

// ==================== END JOB VACANCY SYSTEM ROUTES ====================

export default router;
