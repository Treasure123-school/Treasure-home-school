/**
 * Messages Routes
 * 
 * Handles internal messaging between students, teachers, and admins.
 */

import { Router, Response } from "express";
import { storage } from "../storage";
import { authenticateUser } from "./middleware";
import { sendSuccess, sendNotFound, sendUnauthorized, handleRouteError } from "../utils/response-helpers";
import { realtimeService } from "../realtime-service";

const router = Router();

// Lookup a user by identifier (username, ID, email, staffId, or admissionNumber)
router.get('/lookup/:identifier', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    
    const identifier = req.params.identifier?.trim();
    if (!identifier) {
      return res.status(400).json({ message: 'Identifier is required' });
    }

    const user = await storage.getUserByIdentifier(identifier);
    
    if (!user) {
      return sendNotFound(res, 'User not found');
    }
    
    // Return sanitized user info (never expose password hash)
    const { passwordHash, ...safeUser } = user as any;
    
    // Add role name for better display — gracefully handle missing roleId
    let roleName = 'Unknown';
    try {
      if (user.roleId) {
        const role = await storage.getRole(user.roleId);
        roleName = role?.name || 'Unknown';
      }
    } catch (_) {}
    
    sendSuccess(res, { 
      ...safeUser, 
      roleName 
    });
  } catch (error) {
    handleRouteError(res, error, 'users.lookup');
  }
});

// Get all messages for the current user
router.get('/user/:userId', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    
    const userId = req.params.userId;
    
    // Safety check: users can only fetch their own messages unless they are admin
    if (req.user.id !== userId && req.user.roleId !== 1) {
      return sendUnauthorized(res, 'You can only view your own messages');
    }
    
    const messages = await storage.getMessagesByUser(userId);
    sendSuccess(res, messages);
  } catch (error) {
    handleRouteError(res, error, 'messages.list');
  }
});

// Send a new message
router.post('/', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    
    const { recipientId, subject, content } = req.body;
    
    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Recipient and content are required' });
    }
    
    const message = await storage.sendMessage({
      senderId: req.user.id,
      recipientId,
      subject: subject || '(No Subject)',
      content,
      isRead: false
    });
    
    // Broadcast real-time notification to the recipient
    realtimeService.broadcastNewMessage(recipientId, message);
    
    sendSuccess(res, message, 201);
  } catch (error) {
    handleRouteError(res, error, 'messages.send');
  }
});

// Mark a message as read
router.post('/:id/read', authenticateUser, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }
    
    // Verify message exists and belongs to the user (as recipient)
    const messages = await storage.getMessagesByUser(req.user.id);
    const message = messages.find((m: any) => m.id === messageId);
    
    if (!message) {
      return sendNotFound(res, 'Message not found');
    }
    
    if (message.recipientId !== req.user.id) {
      return sendUnauthorized(res, 'You can only mark your own messages as read');
    }
    
    await storage.markMessageAsRead(messageId);
    sendSuccess(res, { message: 'Message marked as read' });
  } catch (error) {
    handleRouteError(res, error, 'messages.markRead');
  }
});

export default router;
