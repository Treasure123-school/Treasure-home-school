/** Auto-split from routes.ts — school-events (orig lines 15476-15566). See git history. */
import type { Express } from 'express';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';

export async function registerSchoolEventsRoutes(app: Express) {
  // ==================== SCHOOL EVENTS / CALENDAR ROUTES ====================

  // GET all events (authenticated - all roles can view, active only)
  app.get('/api/events', authenticateUser, async (req, res) => {
    try {
      const { eventType, startDate, endDate } = req.query;
      const filters: any = { isActive: true };
      if (eventType && eventType !== 'all') filters.eventType = eventType as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      const events = await storage.getSchoolEvents(filters);
      return res.json(events);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ message: 'Failed to fetch events', error: error.message });
    }
  });

  // GET all events for admin (includes inactive)
  app.get('/api/admin/events', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { eventType, startDate, endDate } = req.query;
      const filters: any = {};
      if (eventType && eventType !== 'all') filters.eventType = eventType as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      const events = await storage.getSchoolEvents(filters);
      return res.json(events);
    } catch (error: any) {
      console.error('Error fetching admin events:', error);
      return res.status(500).json({ message: 'Failed to fetch events', error: error.message });
    }
  });

  // GET single event
  app.get('/api/events/:id', authenticateUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getSchoolEvent(id);
      if (!event) return res.status(404).json({ message: 'Event not found' });
      return res.json(event);
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to fetch event', error: error.message });
    }
  });

  // POST create event (admin only)
  app.post('/api/admin/events', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const data = {
        ...req.body,
        createdBy: req.user!.id,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        isAllDay: req.body.isAllDay !== undefined ? req.body.isAllDay : true,
      };
      const event = await storage.createSchoolEvent(data);
      return res.status(201).json(event);
    } catch (error: any) {
      console.error('Error creating event:', error);
      return res.status(500).json({ message: 'Failed to create event', error: error.message });
    }
  });

  // PUT update event (admin only)
  app.put('/api/admin/events/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.updateSchoolEvent(id, req.body);
      if (!event) return res.status(404).json({ message: 'Event not found' });
      return res.json(event);
    } catch (error: any) {
      console.error('Error updating event:', error);
      return res.status(500).json({ message: 'Failed to update event', error: error.message });
    }
  });

  // DELETE event (admin only)
  app.delete('/api/admin/events/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSchoolEvent(id);
      if (!deleted) return res.status(404).json({ message: 'Event not found' });
      return res.json({ message: 'Event deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ message: 'Failed to delete event', error: error.message });
    }
  });

  // ==================== END SCHOOL EVENTS / CALENDAR ROUTES ====================

}
