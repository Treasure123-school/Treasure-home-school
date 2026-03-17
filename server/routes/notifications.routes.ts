/**
 * Notifications Routes
 * 
 * Handles user notifications.
 */

import { Router, Response } from "express";
import { storage } from "../storage";
import { authenticateUser } from "./middleware";
import { sendSuccess, sendNotFound, sendUnauthorized, handleRouteError } from "../utils/response-helpers";

const router = Router();

router.get('/', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    const notifications = await storage.getNotificationsByUserId(req.user.id);
    sendSuccess(res, notifications);
  } catch (error) {
    handleRouteError(res, error, 'notifications.list');
  }
});

router.get('/unread-count', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    const count = await storage.getUnreadNotificationCount(req.user.id);
    sendSuccess(res, { count });
  } catch (error) {
    handleRouteError(res, error, 'notifications.unreadCount');
  }
});

router.put('/:id/read', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    const notificationId = parseInt(req.params.id);
    
    const notifications = await storage.getNotificationsByUserId(req.user.id);
    const notification = notifications.find(n => n.id === notificationId);

    if (!notification) {
      return sendNotFound(res, 'Notification not found');
    }
    
    const updated = await storage.markNotificationAsRead(notificationId);
    sendSuccess(res, updated);
  } catch (error) {
    handleRouteError(res, error, 'notifications.markRead');
  }
});

router.put('/mark-all-read', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    await storage.markAllNotificationsAsRead(req.user.id);
    sendSuccess(res, { message: 'All notifications marked as read' });
  } catch (error) {
    handleRouteError(res, error, 'notifications.markAllRead');
  }
});

export default router;
