/** Auto-split from routes.ts — notifications (orig lines 5833-5894). See git history. */
import type { Express } from 'express';
import { authenticateUser } from '../routes/middleware';
import { storage } from '../storage';

export async function registerNotificationsRoutes(app: Express) {
  app.get('/api/notifications', authenticateUser, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const notifications = await storage.getNotificationsByUserId(user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread-count', authenticateUser, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  app.put('/api/notifications/:id/read', authenticateUser, async (req, res) => {
    try {
      const user = req.user;
      const notificationId = parseInt(req.params.id);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // Verify the notification belongs to the user
      const notifications = await storage.getNotificationsByUserId(user.id);
      const notification = notifications.find(n => n.id === notificationId);

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      const updated = await storage.markNotificationAsRead(notificationId);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update notification' });
    }
  });

  app.put('/api/notifications/mark-all-read', authenticateUser, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update notifications' });
    }
  });

  // Classes API endpoint - returns all classes (including inactive) for dropdown population
}
