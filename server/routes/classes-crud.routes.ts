/** Auto-split from routes.ts — classes (orig lines 5895-6018). See git history. */
import type { Express } from 'express';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { and } from 'drizzle-orm';

export async function registerClassesRoutes(app: Express) {
  app.get('/api/classes', authenticateUser, async (req, res) => {
    try {
      // Use cache for classes (rarely changes, high read frequency)
      const classes = await performanceCache.getOrSet(
        PerformanceCache.keys.activeClasses(),
        () => storage.getAllClasses(true),
        PerformanceCache.TTL.MEDIUM // 5 minute cache
      );
      res.json(classes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch classes' });
    }
  });

  // Create a new class - Admin only
  app.post('/api/classes', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { name, level, classTeacherId, capacity } = req.body;

      if (!name || !level) {
        return res.status(400).json({ message: 'Name and level are required' });
      }

      const classData = {
        name,
        level,
        classTeacherId: classTeacherId || null,
        capacity: capacity || 30,
        isActive: true
      };

      const newClass = await storage.createClass(classData);

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      // Emit realtime event for class creation
      realtimeService.emitClassEvent(newClass.id.toString(), 'created', newClass, req.user!.id);

      res.status(201).json(newClass);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ message: 'A class with this name already exists' });
      }
      res.status(500).json({ message: 'Failed to create class' });
    }
  });

  // Update a class - Admin only
  app.put('/api/classes/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const classId = parseInt(req.params.id);

      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

      const { name, level, classTeacherId, capacity, isActive } = req.body;

      const updatedClass = await storage.updateClass(classId, {
        name,
        level,
        classTeacherId: classTeacherId || null,
        capacity,
        isActive
      });

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      // Emit realtime event for class update
      realtimeService.emitClassEvent(classId.toString(), 'updated', updatedClass, req.user!.id);

      res.json(updatedClass);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ message: 'A class with this name already exists' });
      }
      res.status(500).json({ message: 'Failed to update class' });
    }
  });

  // Delete a class - Admin only
  app.delete('/api/classes/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const classId = parseInt(req.params.id);

      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const existingClass = await storage.getClass(classId);
      if (!existingClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

      const success = await storage.deleteClass(classId);

      if (!success) {
        return res.status(500).json({ message: 'Failed to delete class' });
      }

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      // Emit realtime event for class deletion
      realtimeService.emitClassEvent(classId.toString(), 'deleted', { ...existingClass, id: classId }, req.user!.id);

      res.json({ message: 'Class deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete class' });
    }
  });

  // Subjects API endpoint - cached for performance
  // GET /api/subjects/all — returns ALL subjects including archived (Admin/SuperAdmin only, for management page)
}
