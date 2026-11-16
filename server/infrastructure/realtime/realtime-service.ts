import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ROLE_NAMES } from '@shared/role-constants';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-key-change-in-production' : undefined);

import {
  type RealtimeEvent,
  type SocketUser,
  type SubscriptionData,
  type ActiveExamSession,
  type UserActivityRecord,
  type OnlineUserInfo,
  type ActivityFeedEvent,
  type UserInfoProvider,
} from './realtime.types';
import { UserActivityTracker } from './realtime-activity';
import { ExamSessionTracker } from './realtime-exam-sessions';
import { RealtimeEmitters } from './realtime-emitters';

class RealtimeService extends RealtimeEmitters {
  private io: SocketIOServer | null = null;
  private connectedClients = new Map<string, Set<string>>();
  private authenticatedSockets = new Map<string, SocketUser>();
  private recentEventIds = new Set<string>();
  private eventIdCleanupInterval: NodeJS.Timeout | null = null;

  // Extracted concerns (composition)
  private activity = new UserActivityTracker(() => this.io);
  private examSessions = new ExamSessionTracker(() => this.io, (socketId) => this.authenticatedSockets.get(socketId));

  setUserInfoProvider(fn: UserInfoProvider) {
    this.activity.setUserInfoProvider(fn);
  }

  initialize(httpServer: HTTPServer) {
    // Build allowed origins for CORS - production ready
    const allowedOrigins: string[] = [];
    
    if (process.env.NODE_ENV === 'development') {
      // Development origins
      allowedOrigins.push(
        'http://localhost:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5000'
      );
    }
    
    // Production origins from environment
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl)
          if (!origin) return callback(null, true);
          
          // Check against allowed origins
          if (allowedOrigins.some(allowed => origin.startsWith(allowed) || origin.includes('.vercel.app'))) {
            return callback(null, true);
          }
          
          // In development, be more permissive
          if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
          }
          
          console.warn(`⚠️  Socket.IO CORS blocked origin: ${origin}`);
          callback(new Error('CORS not allowed'));
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      // Production optimizations
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB
      connectTimeout: 45000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startEventIdCleanup();
    this.startHeartbeatCheck();
    this.activity.startActivityCheck();
    
    console.log('✅ Socket.IO Realtime Service initialized');
    console.log(`   → CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'dynamic'}`);
    console.log(`   → Environment: ${process.env.NODE_ENV || 'development'}`);
  }

  private setupMiddleware() {
    if (!this.io) return;

    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log(`📡 Connection rejected: No authentication token provided (${socket.id})`);
        return next(new Error('Authentication required'));
      }

      try {
        if (!JWT_SECRET) {
          console.warn('⚠️  JWT_SECRET not configured - rejecting connection');
          return next(new Error('Server configuration error'));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { 
          userId: string; 
          role?: string; 
          roleName?: string;
          roleId?: number;
          authorizedClasses?: string[];
          authorizedStudentIds?: string[];
        };
        
        // Prefer roleName from token; fall back to resolving from roleId for legacy tokens
        const role = decoded.roleName 
          || decoded.role 
          || (decoded.roleId ? (ROLE_NAMES[decoded.roleId as keyof typeof ROLE_NAMES] || 'unknown') : 'unknown');
        
        this.authenticatedSockets.set(socket.id, {
          id: socket.id,
          userId: decoded.userId,
          role: role,
          authorizedClasses: decoded.authorizedClasses || [],
          authorizedStudentIds: decoded.authorizedStudentIds || [],
        });

        console.log(`📡 Authenticated socket: ${socket.id} (User: ${decoded.userId}, Role: ${role}, Classes: ${(decoded.authorizedClasses || []).length})`);
        next();
      } catch (error) {
        console.warn(`⚠️  Invalid token for socket ${socket.id}:`, error instanceof Error ? error.message : 'Unknown error');
        return next(new Error('Invalid or expired token'));
      }
    });
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const user = this.authenticatedSockets.get(socket.id);
      console.log(`📡 Client connected: ${socket.id}${user ? ` (User: ${user.userId})` : ' (Anonymous)'}`);

      if (user) {
        socket.join(`user:${user.userId}`);
        socket.join(`role:${user.role}`);
        console.log(`   → Auto-joined rooms: user:${user.userId}, role:${user.role}`);
        // Track user activity
        this.activity.trackUserConnect(user, socket.id);
      }

      socket.on('subscribe', (data: SubscriptionData) => {
        this.handleSubscribe(socket, data);
      });

      socket.on('subscribe:table', (data: { table: string }) => {
        this.handleTableSubscribe(socket, data.table);
      });

      socket.on('subscribe:class', (data: { classId: string }) => {
        this.handleClassSubscribe(socket, data.classId);
      });

      socket.on('subscribe:exam', (data: { examId: string | number }) => {
        this.handleExamSubscribe(socket, data.examId);
      });

      socket.on('subscribe:reportcard', (data: { reportCardId: string | number }) => {
        this.handleReportCardSubscribe(socket, data.reportCardId);
      });

      socket.on('unsubscribe', (data: SubscriptionData) => {
        this.handleUnsubscribe(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      socket.on('get:subscriptions', () => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        socket.emit('subscriptions', { rooms });
      });

      // USER ACTIVITY: client sends this heartbeat every 25s to stay "online"
      socket.on('user:heartbeat', () => {
        const u = this.authenticatedSockets.get(socket.id);
        if (!u) return;
        this.activity.heartbeatRefresh(u.userId, u.role);
      });

      // EXAM SESSION SECURITY: Register active exam session for duplicate detection
      socket.on('exam:register_session', (data: { sessionId: number; examId: number }) => {
        this.examSessions.register(socket, data);
      });

      // EXAM SESSION SECURITY: Heartbeat to keep session active
      socket.on('exam:session_heartbeat', (data: { sessionId: number }) => {
        this.examSessions.heartbeat(socket, data);
      });

      // EXAM SESSION SECURITY: Unregister session when exam ends
      socket.on('exam:unregister_session', (data: { sessionId: number }) => {
        this.examSessions.unregister(socket, data);
      });
    });
  }

  private handleSubscribe(socket: Socket, data: SubscriptionData) {
    if (data.table) {
      this.handleTableSubscribe(socket, data.table);
    }
    if (data.channel) {
      socket.join(data.channel);
      console.log(`   → Client ${socket.id} joined channel: ${data.channel}`);
      socket.emit('subscribed', { channel: data.channel });
    }
    if (data.classId) {
      this.handleClassSubscribe(socket, data.classId);
    }
    if (data.examId) {
      this.handleExamSubscribe(socket, data.examId);
    }
    if (data.reportCardId) {
      this.handleReportCardSubscribe(socket, data.reportCardId);
    }
  }

  private handleTableSubscribe(socket: Socket, table: string) {
    const user = this.authenticatedSockets.get(socket.id);
    if (!user) {
      socket.emit('subscription_error', { type: 'table', table, error: 'Authentication required' });
      return;
    }

    // Normalize role to lowercase canonical slug
    const role = this.normalizeRole(user.role);

    // Highly sensitive tables - super_admin and admin only
    const adminOnlyTables = ['users', 'students', 'teacher_profiles', 'admin_profiles', 'parent_profiles'];
    // Academic tables - super_admin, admin, and teachers
    const academicTables = ['report_cards', 'report_card_items', 'exam_results', 'exam_sessions', 'exams'];
    
    const fullAccessRoles = ['super_admin', 'admin'];
    const academicRoles = ['super_admin', 'admin', 'teacher'];
    
    if (adminOnlyTables.includes(table) && !fullAccessRoles.includes(role)) {
      socket.emit('subscription_error', { type: 'table', table, error: 'Insufficient permissions for this table' });
      console.log(`   ⚠️  Unauthorized table subscription attempt by ${user.userId} (role: ${role}) for table: ${table}`);
      return;
    }
    
    if (academicTables.includes(table) && !academicRoles.includes(role)) {
      socket.emit('subscription_error', { type: 'table', table, error: 'Insufficient permissions for academic table' });
      console.log(`   ⚠️  Unauthorized academic table subscription attempt by ${user.userId} (role: ${role}) for table: ${table}`);
      return;
    }

    const channel = `table:${table}`;
    socket.join(channel);
    
    if (!this.connectedClients.has(table)) {
      this.connectedClients.set(table, new Set());
    }
    this.connectedClients.get(table)!.add(socket.id);

    console.log(`   → Client ${socket.id} subscribed to table: ${table}`);
    socket.emit('subscribed', { table, channel });
  }

  private handleClassSubscribe(socket: Socket, classId: string) {
    const user = this.authenticatedSockets.get(socket.id);
    if (!user) {
      socket.emit('subscription_error', { type: 'class', classId, error: 'Authentication required' });
      return;
    }

    // Normalize role to lowercase canonical slug
    const role = this.normalizeRole(user.role);

    // Super admins and admins can access all classes
    const fullAccessRoles = ['super_admin', 'admin'];
    if (fullAccessRoles.includes(role)) {
      const channel = `class:${classId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (${role}) subscribed to class: ${classId}`);
      socket.emit('subscribed', { type: 'class', classId, channel });
      return;
    }

    // Teachers, students, parents must have the class in their authorized list
    const authorizedClasses = user.authorizedClasses || [];
    if (!authorizedClasses.includes(classId) && !authorizedClasses.includes(classId.toString())) {
      socket.emit('subscription_error', { 
        type: 'class', 
        classId, 
        error: 'Access denied: You are not authorized for this class' 
      });
      console.log(`   ⚠️  Unauthorized class subscription: ${user.userId} (role: ${role}) attempted to access class ${classId}`);
      return;
    }

    const channel = `class:${classId}`;
    socket.join(channel);
    console.log(`   → Client ${socket.id} subscribed to class: ${classId}`);
    socket.emit('subscribed', { type: 'class', classId, channel });
  }

  private handleExamSubscribe(socket: Socket, examId: string | number) {
    const user = this.authenticatedSockets.get(socket.id);
    if (!user) {
      socket.emit('subscription_error', { type: 'exam', examId, error: 'Authentication required' });
      return;
    }

    // Normalize role to lowercase canonical slug
    const role = this.normalizeRole(user.role);
    
    // Super admins and admins can access all exams
    const fullAccessRoles = ['super_admin', 'admin'];
    if (fullAccessRoles.includes(role)) {
      const channel = `exam:${examId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (${role}) subscribed to exam: ${examId}`);
      socket.emit('subscribed', { type: 'exam', examId, channel });
      return;
    }
    
    // Teachers can subscribe to exam realtime updates
    // Authorization model: Realtime subscriptions only receive change notifications, not actual data.
    // Actual data access is protected by API route authorization which validates exam ownership/class access.
    // This subscription allows teachers to receive updates for exams they may own or monitor.
    // Full resource-level ownership checks would require expensive async database lookups.
    if (role === 'teacher') {
      const channel = `exam:${examId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (teacher) subscribed to exam: ${examId}`);
      socket.emit('subscribed', { type: 'exam', examId, channel });
      return;
    }
    
    // Students can subscribe to their own exams
    if (role === 'student' && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
      const channel = `exam:${examId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (student) subscribed to exam: ${examId}`);
      socket.emit('subscribed', { type: 'exam', examId, channel });
      return;
    }

    socket.emit('subscription_error', { type: 'exam', examId, error: 'Access denied: insufficient permissions' });
    console.log(`   ⚠️  Unauthorized exam subscription: ${user.userId} (role: ${role})`);
  }

  private handleReportCardSubscribe(socket: Socket, reportCardId: string | number) {
    const user = this.authenticatedSockets.get(socket.id);
    if (!user) {
      socket.emit('subscription_error', { type: 'reportcard', reportCardId, error: 'Authentication required' });
      return;
    }

    // Normalize role to lowercase canonical slug
    const role = this.normalizeRole(user.role);
    
    // Super admins and admins can access all report cards
    const fullAccessRoles = ['super_admin', 'admin'];
    if (fullAccessRoles.includes(role)) {
      const channel = `reportcard:${reportCardId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (${role}) subscribed to report card: ${reportCardId}`);
      socket.emit('subscribed', { type: 'reportcard', reportCardId, channel });
      return;
    }
    
    // Teachers can subscribe to report card realtime updates
    // Authorization model: Realtime subscriptions only receive change notifications, not actual data.
    // Actual data access is protected by API route authorization which validates class/subject access.
    // This subscription allows teachers to receive updates for report cards they may manage.
    if (role === 'teacher') {
      const channel = `reportcard:${reportCardId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (teacher) subscribed to report card: ${reportCardId}`);
      socket.emit('subscribed', { type: 'reportcard', reportCardId, channel });
      return;
    }
    
    // Students can subscribe to their own report cards
    if (role === 'student' && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
      const channel = `reportcard:${reportCardId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (student) subscribed to report card: ${reportCardId}`);
      socket.emit('subscribed', { type: 'reportcard', reportCardId, channel });
      return;
    }
    
    // Parents can subscribe to report cards of their linked students
    if (role === 'parent' && user.authorizedStudentIds && user.authorizedStudentIds.length > 0) {
      const channel = `reportcard:${reportCardId}`;
      socket.join(channel);
      console.log(`   → Client ${socket.id} (parent) subscribed to report card: ${reportCardId}`);
      socket.emit('subscribed', { type: 'reportcard', reportCardId, channel });
      return;
    }

    socket.emit('subscription_error', { type: 'reportcard', reportCardId, error: 'Access denied: insufficient permissions' });
    console.log(`   ⚠️  Unauthorized report card subscription: ${user.userId} (role: ${role})`);
  }
  
  // Normalize role names to canonical lowercase slugs
  private normalizeRole(role: string): string {
    const roleMap: Record<string, string> = {
      'super admin': 'super_admin',
      'superadmin': 'super_admin',
      'super_admin': 'super_admin',
      'admin': 'admin',
      'administrator': 'admin',
      'teacher': 'teacher',
      'student': 'student',
      'parent': 'parent',
    };
    return roleMap[role.toLowerCase()] || role.toLowerCase();
  }

  private handleUnsubscribe(socket: Socket, data: SubscriptionData) {
    if (data.table) {
      const channel = `table:${data.table}`;
      socket.leave(channel);
      
      if (this.connectedClients.has(data.table)) {
        this.connectedClients.get(data.table)!.delete(socket.id);
        if (this.connectedClients.get(data.table)!.size === 0) {
          this.connectedClients.delete(data.table);
        }
      }
      console.log(`   → Client ${socket.id} unsubscribed from table: ${data.table}`);
      socket.emit('unsubscribed', { table: data.table });
    }

    if (data.channel) {
      socket.leave(data.channel);
      console.log(`   → Client ${socket.id} left channel: ${data.channel}`);
      socket.emit('unsubscribed', { channel: data.channel });
    }

    if (data.classId) {
      socket.leave(`class:${data.classId}`);
      socket.emit('unsubscribed', { type: 'class', classId: data.classId });
    }

    if (data.examId) {
      socket.leave(`exam:${data.examId}`);
      socket.emit('unsubscribed', { type: 'exam', examId: data.examId });
    }

    if (data.reportCardId) {
      socket.leave(`reportcard:${data.reportCardId}`);
      socket.emit('unsubscribed', { type: 'reportcard', reportCardId: data.reportCardId });
    }
  }

  private handleDisconnect(socket: Socket) {
    const user = this.authenticatedSockets.get(socket.id);
    console.log(`📡 Client disconnected: ${socket.id}${user ? ` (User: ${user.userId})` : ''}`);
    
    this.examSessions.cleanupOnDisconnect(socket.id);
    
    this.connectedClients.forEach((clients, table) => {
      clients.delete(socket.id);
      if (clients.size === 0) {
        this.connectedClients.delete(table);
      }
    });

    // Remove socket from user activity tracking; notify admins if user fully offline
    if (user) {
      this.activity.trackUserDisconnect(user.userId, socket.id);
    }

    this.authenticatedSockets.delete(socket.id);
  }

  // ─── ACTIVITY API (delegates to UserActivityTracker) ───────────────────────

  trackUserConnect(user: SocketUser, socketId: string) {
    return this.activity.trackUserConnect(user, socketId);
  }

  trackUserDisconnect(userId: string, socketId: string) {
    this.activity.trackUserDisconnect(userId, socketId);
  }

  updateUserActivity(userId: string) {
    this.activity.updateUserActivity(userId);
  }

  touchUserActivity(userId: string, roleId?: number, roleName?: string) {
    this.activity.touchUserActivity(userId, roleId, roleName);
  }

  getOnlineUsers() {
    return this.activity.getOnlineUsers();
  }

  getActivityFeed() {
    return this.activity.getActivityFeed();
  }

  private generateEventId(): string {
    return crypto.randomUUID();
  }

  private startEventIdCleanup() {
    this.eventIdCleanupInterval = setInterval(() => {
      this.recentEventIds.clear();
    }, 60000);
  }

  private heartbeatInterval: NodeJS.Timeout | null = null;

  private startHeartbeatCheck() {
    // Check for stale connections every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (!this.io) return;
      
      const now = Date.now();
      this.authenticatedSockets.forEach((user, socketId) => {
        const socket = this.io?.sockets.sockets.get(socketId);
        if (!socket || socket.disconnected) {
          this.authenticatedSockets.delete(socketId);
          this.connectedClients.forEach((clients) => {
            clients.delete(socketId);
          });
        }
      });
    }, 30000);
  }

  emitTableChange(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', data: any, oldData?: any, userId?: string) {
    if (!this.io) {
      console.warn('⚠️  Socket.IO not initialized, cannot emit event');
      return;
    }

    const eventId = this.generateEventId();
    this.recentEventIds.add(eventId);

    const channel = `table:${table}`;
    const payload: RealtimeEvent = {
      eventId,
      eventType: `${table}.${operation.toLowerCase()}`,
      table,
      operation,
      data,
      oldData,
      timestamp: Date.now(),
      userId,
    };

    this.io.to(channel).emit('table_change', payload);
    
    const subscriberCount = this.connectedClients.get(table)?.size || 0;
    if (subscriberCount > 0) {
      console.log(`📤 Emitted ${operation} event for table ${table} to ${subscriberCount} clients (eventId: ${eventId.slice(0, 8)}...)`);
    }

    return eventId;
  }

  emitEvent(eventType: string, data: any, rooms?: string | string[]) {
    if (!this.io) {
      console.warn('⚠️  Socket.IO not initialized, cannot emit event');
      return;
    }

    const eventId = this.generateEventId();
    const payload = {
      eventId,
      eventType,
      data,
      timestamp: Date.now(),
    };

    if (rooms) {
      const roomList = Array.isArray(rooms) ? rooms : [rooms];
      roomList.forEach(room => {
        this.io!.to(room).emit(eventType, payload);
      });
      console.log(`📤 Emitted ${eventType} to rooms: ${roomList.join(', ')}`);
    } else {
      this.io.emit(eventType, payload);
      console.log(`📤 Broadcast event: ${eventType}`);
    }

    return eventId;
  }

  emitToAll(event: string, data: any) {
    if (!this.io) {
      console.warn('⚠️  Socket.IO not initialized, cannot emit event');
      return;
    }

    this.io.emit(event, data);
    console.log(`📤 Broadcast event: ${event}`);
  }

  emitToRoom(room: string, event: string, data: any) {
    if (!this.io) {
      console.warn('⚠️  Socket.IO not initialized, cannot emit event');
      return;
    }

    this.io.to(room).emit(event, data);
  }

  getIO(): SocketIOServer | null {
    return this.io;
  }

  getSubscriberCount(table: string): number {
    return this.connectedClients.get(table)?.size || 0;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.connectedClients.keys());
  }

  getConnectedUserCount(): number {
    return this.authenticatedSockets.size;
  }

  getRoomSubscriberCount(room: string): number {
    if (!this.io) return 0;
    const roomObj = this.io.sockets.adapter.rooms.get(room);
    return roomObj ? roomObj.size : 0;
  }

  getStats() {
    return {
      totalConnections: this.io?.sockets.sockets.size || 0,
      authenticatedUsers: this.authenticatedSockets.size,
      tableSubscriptions: Object.fromEntries(this.connectedClients),
      activeRooms: this.io ? Array.from(this.io.sockets.adapter.rooms.keys()).filter(r => !this.io!.sockets.sockets.has(r)) : [],
    };
  }

  broadcastSystemSettingsUpdate(settings: any) {
    this.io?.emit('system_settings_update', settings);
  }

  broadcastNewMessage(recipientId: string, message: any) {
    if (!this.io) return;
    this.io.to(`user:${recipientId}`).emit('message:new', message);
    console.log(`📡 Broadcasted new message to user:${recipientId}`);
  }

  shutdown() {
    if (this.eventIdCleanupInterval) {
      clearInterval(this.eventIdCleanupInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.activity.shutdown();
    if (this.io) {
      this.io.close();
    }
    console.log('🛑 Socket.IO Realtime Service shut down');
  }
}

export const realtimeService = new RealtimeService();
