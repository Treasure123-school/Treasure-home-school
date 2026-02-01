import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-secret-key-change-in-production' : undefined);

export interface RealtimeEvent {
  eventId: string;
  eventType: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  oldData?: any;
  timestamp: number;
  userId?: string;
}

export interface SocketUser {
  id: string;
  userId: string;
  role: string;
  classIds?: string[];
  authorizedClasses?: string[];
  authorizedStudentIds?: string[];
}

interface SubscriptionData {
  table?: string;
  channel?: string;
  userId?: string;
  classId?: string;
  examId?: string | number;
  reportCardId?: string | number;
}

// Track active exam sessions for duplicate detection
interface ActiveExamSession {
  socketId: string;
  sessionId: number;
  userId: string;
  examId: number;
  registeredAt: Date;
  lastPing: Date;
}

class RealtimeService {
  private io: SocketIOServer | null = null;
  private connectedClients = new Map<string, Set<string>>();
  private authenticatedSockets = new Map<string, SocketUser>();
  private recentEventIds = new Set<string>();
  private eventIdCleanupInterval: NodeJS.Timeout | null = null;
  
  // Duplicate session detection: Map<sessionId, ActiveExamSession>
  private activeExamSessions = new Map<number, ActiveExamSession>();
  // Track socket to session mapping for cleanup
  private socketToSession = new Map<string, number>();

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
    
    // Support Replit domains dynamically
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      allowedOrigins.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl)
          if (!origin) return callback(null, true);
          
          // Check against allowed origins
          if (allowedOrigins.some(allowed => origin.startsWith(allowed) || origin.includes('.repl.co') || origin.includes('.replit.dev'))) {
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
    
    console.log('✅ Socket.IO Realtime Service initialized');
    console.log(`   → CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'dynamic (Replit)'}`);
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
        
        const role = decoded.roleName || decoded.role || 'unknown';
        
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

      // EXAM SESSION SECURITY: Register active exam session for duplicate detection
      socket.on('exam:register_session', (data: { sessionId: number; examId: number }) => {
        this.handleExamSessionRegister(socket, data);
      });

      // EXAM SESSION SECURITY: Heartbeat to keep session active
      socket.on('exam:session_heartbeat', (data: { sessionId: number }) => {
        this.handleExamSessionHeartbeat(socket, data);
      });

      // EXAM SESSION SECURITY: Unregister session when exam ends
      socket.on('exam:unregister_session', (data: { sessionId: number }) => {
        this.handleExamSessionUnregister(socket, data);
      });
    });
  }

  // EXAM SECURITY: Handle exam session registration for duplicate detection
  private handleExamSessionRegister(socket: Socket, data: { sessionId: number; examId: number }) {
    const user = this.authenticatedSockets.get(socket.id);
    if (!user) {
      socket.emit('exam:session_error', { error: 'Authentication required' });
      return;
    }

    const { sessionId, examId } = data;
    const now = new Date();

    // Check if this session is already registered by another socket
    const existingSession = this.activeExamSessions.get(sessionId);
    
    if (existingSession && existingSession.socketId !== socket.id) {
      // Check if existing session is still active (pinged within last 10 seconds)
      const timeSinceLastPing = now.getTime() - existingSession.lastPing.getTime();
      
      if (timeSinceLastPing < 10000) {
        // Duplicate session detected! Notify both clients
        console.log(`⚠️  DUPLICATE EXAM SESSION DETECTED: Session ${sessionId}, User ${user.userId}`);
        console.log(`   → Existing socket: ${existingSession.socketId}, New socket: ${socket.id}`);
        
        // Notify the new client (the one trying to connect)
        socket.emit('exam:duplicate_session', {
          sessionId,
          examId,
          message: 'This exam session is already open in another tab or device',
          existingSocketId: existingSession.socketId
        });
        
        // Optionally notify the original client too
        this.io?.to(existingSession.socketId).emit('exam:duplicate_session', {
          sessionId,
          examId,
          message: 'This exam session was opened in another tab or device',
          newSocketId: socket.id
        });
        
        return;
      }
      
      // Old session is stale, clean it up
      console.log(`   → Cleaning up stale exam session: ${sessionId} (socket: ${existingSession.socketId})`);
      this.socketToSession.delete(existingSession.socketId);
    }

    // Register this session
    this.activeExamSessions.set(sessionId, {
      socketId: socket.id,
      sessionId,
      userId: user.userId,
      examId,
      registeredAt: now,
      lastPing: now
    });
    this.socketToSession.set(socket.id, sessionId);

    // Join exam-specific room for session events
    socket.join(`exam_session:${sessionId}`);

    console.log(`📋 Exam session registered: Session ${sessionId}, User ${user.userId}, Socket ${socket.id}`);
    socket.emit('exam:session_registered', { sessionId, examId });
  }

  // EXAM SECURITY: Handle session heartbeat to keep session alive
  private handleExamSessionHeartbeat(socket: Socket, data: { sessionId: number }) {
    const session = this.activeExamSessions.get(data.sessionId);
    
    if (session && session.socketId === socket.id) {
      session.lastPing = new Date();
      socket.emit('exam:heartbeat_ack', { sessionId: data.sessionId, timestamp: Date.now() });
    }
  }

  // EXAM SECURITY: Handle session unregistration when exam ends
  private handleExamSessionUnregister(socket: Socket, data: { sessionId: number }) {
    const session = this.activeExamSessions.get(data.sessionId);
    
    if (session && session.socketId === socket.id) {
      this.activeExamSessions.delete(data.sessionId);
      this.socketToSession.delete(socket.id);
      socket.leave(`exam_session:${data.sessionId}`);
      console.log(`📋 Exam session unregistered: Session ${data.sessionId}, Socket ${socket.id}`);
    }
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
    
    // Clean up exam session if this socket had one registered
    const sessionId = this.socketToSession.get(socket.id);
    if (sessionId) {
      const session = this.activeExamSessions.get(sessionId);
      if (session && session.socketId === socket.id) {
        this.activeExamSessions.delete(sessionId);
        console.log(`   → Cleaned up exam session ${sessionId} on disconnect`);
      }
      this.socketToSession.delete(socket.id);
    }
    
    this.connectedClients.forEach((clients, table) => {
      clients.delete(socket.id);
      if (clients.size === 0) {
        this.connectedClients.delete(table);
      }
    });

    this.authenticatedSockets.delete(socket.id);
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

  emitToUser(userId: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `user:${userId}`);
  }

  emitToRole(role: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `role:${role}`);
  }

  emitToClass(classId: string, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `class:${classId}`);
  }

  emitToExam(examId: string | number, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `exam:${examId}`);
  }

  emitToReportCard(reportCardId: string | number, eventType: string, data: any) {
    return this.emitEvent(eventType, data, `reportcard:${reportCardId}`);
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

  emitExamEvent(examId: string | number, eventType: 'started' | 'submitted' | 'graded' | 'timer_tick' | 'auto_submitted', data: any) {
    const fullEventType = `exam.${eventType}`;
    this.emitToExam(examId, fullEventType, { ...data, examId });
    
    if (data.classId) {
      this.emitToClass(data.classId, fullEventType, { ...data, examId });
    }
  }

  // Dedicated method for exam publish/unpublish events
  emitExamPublishEvent(examId: string | number, isPublished: boolean, data: any, userId?: string) {
    const eventType = isPublished ? 'exam.published' : 'exam.unpublished';
    const operation = 'UPDATE';
    
    // Emit table change for cache invalidation
    this.emitTableChange('exams', operation, { ...data, id: examId, isPublished }, undefined, userId);
    
    // Emit specific publish event to exam room
    this.emitToExam(examId, eventType, { ...data, examId, isPublished });
    
    // Notify teachers and admins
    this.emitToRole('teacher', eventType, { ...data, examId, isPublished });
    this.emitToRole('admin', eventType, { ...data, examId, isPublished });
    this.emitToRole('super_admin', eventType, { ...data, examId, isPublished });
    
    // If published, also notify students in the class
    if (isPublished && data.classId) {
      this.emitToClass(data.classId.toString(), eventType, { ...data, examId, isPublished });
    }
    
    console.log(`📤 Emitted ${eventType} for exam ${examId}`);
  }

  emitReportCardEvent(reportCardId: string | number, eventType: 'created' | 'updated' | 'published' | 'finalized' | 'reverted', data: any, userId?: string) {
    const fullEventType = `reportcard.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : 'UPDATE';
    
    // Emit table change for cache invalidation across all subscribers
    this.emitTableChange('report_cards', operation, { ...data, id: reportCardId }, undefined, userId);
    
    // Emit to specific report card room
    this.emitToReportCard(reportCardId, fullEventType, data);
    
    // Always notify teachers and admins about all report card changes
    this.emitToRole('teacher', fullEventType, { ...data, reportCardId });
    this.emitToRole('admin', fullEventType, { ...data, reportCardId });
    this.emitToRole('super_admin', fullEventType, { ...data, reportCardId });
    
    // Notify the student directly
    if (data.studentId) {
      this.emitToUser(data.studentId, fullEventType, data);
    }
    
    // Notify class subscribers
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
    
    // For published reports, also notify parents of the student
    // This ensures parents see real-time updates when report cards become available
    if (eventType === 'published' && data.studentId && data.parentIds) {
      const parentIds = Array.isArray(data.parentIds) ? data.parentIds : [data.parentIds];
      parentIds.forEach((parentId: string) => {
        this.emitToUser(parentId, fullEventType, { 
          ...data, 
          message: 'A new report card has been published for your child'
        });
      });
    }
    
    console.log(`📤 Emitted reportcard.${eventType} for report card ${reportCardId} (student: ${data.studentId || 'unknown'})`);
  }
  
  // Bulk emit for status changes affecting multiple report cards
  emitBulkReportCardStatusChange(reportCardIds: (string | number)[], newStatus: 'finalized' | 'published' | 'draft', classId: string, termId: number, userId?: string) {
    const eventType = newStatus === 'published' ? 'bulk_published' : 
                      newStatus === 'finalized' ? 'bulk_finalized' : 'bulk_reverted';
    const fullEventType = `reportcard.${eventType}`;
    
    const data = {
      reportCardIds,
      newStatus,
      classId,
      termId,
      count: reportCardIds.length,
      timestamp: Date.now()
    };
    
    // Notify teachers and admins about bulk changes
    this.emitToRole('teacher', fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('super_admin', fullEventType, data);
    
    // Notify the class about bulk changes
    this.emitToClass(classId.toString(), fullEventType, data);
    
    // Emit table change for cache invalidation
    this.emitTableChange('report_cards', 'UPDATE', data, undefined, userId);
    
    console.log(`📤 Emitted ${fullEventType} for ${reportCardIds.length} report cards in class ${classId}`);
  }

  emitUserEvent(userId: string, eventType: 'created' | 'updated' | 'deleted', data: any, role?: string) {
    const fullEventType = `user.${eventType}`;
    
    this.emitTableChange('users', eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE', data, undefined, userId);
    
    if (role) {
      this.emitToRole('admin', fullEventType, data);
      this.emitToRole('super_admin', fullEventType, data);
    }
  }

  emitAttendanceEvent(classId: string, eventType: 'marked' | 'updated', data: any) {
    const fullEventType = `attendance.${eventType}`;
    this.emitToClass(classId, fullEventType, data);
    this.emitTableChange('attendance', eventType === 'marked' ? 'INSERT' : 'UPDATE', data);
  }

  emitNotification(userId: string, notification: { title: string; message: string; type?: string }) {
    this.emitToUser(userId, 'notification', notification);
  }

  emitUploadProgress(userId: string, uploadId: string, progress: number, status: 'uploading' | 'completed' | 'failed', url?: string) {
    this.emitToUser(userId, 'upload.progress', {
      uploadId,
      progress,
      status,
      url,
    });
  }

  // Enhanced helper methods for consistent event emission across all modules

  emitClassEvent(classId: string, eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `class.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('classes', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitSubjectEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `subject.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('subjects', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
  }

  emitAnnouncementEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `announcement.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('announcements', operation, data, undefined, userId);
    
    // Security: Define valid role mappings - only these roles can receive announcements
    // Map announcement targetRole strings to authoritative room names
    const VALID_ROLE_ROOMS: Record<string, string> = {
      'student': 'student',
      'teacher': 'teacher',
      'parent': 'parent',
      'admin': 'admin',
      'superadmin': 'superadmin',
      // Case variations for safety
      'Student': 'student',
      'Teacher': 'teacher',
      'Parent': 'parent',
      'Admin': 'admin',
      'SuperAdmin': 'superadmin'
    };
    
    // All valid authenticated role rooms
    const ALL_AUTHENTICATED_ROLES = ['admin', 'superadmin', 'teacher', 'student', 'parent'];
    
    // Broadcast to target roles only (no public broadcasts for security)
    if (data.targetRole && typeof data.targetRole === 'string') {
      // Map to authorized room name, reject if not in whitelist
      const targetRoom = VALID_ROLE_ROOMS[data.targetRole];
      if (targetRoom) {
        this.emitToRole(targetRoom, fullEventType, data);
        // Also emit to admin/superadmin so they always see all announcements
        this.emitToRole('admin', fullEventType, data);
        this.emitToRole('superadmin', fullEventType, data);
      }
      // If targetRole not in whitelist, don't emit (security: reject unknown roles)
    } else {
      // When no specific target role, broadcast to ALL authenticated roles (not public)
      // This ensures announcements reach all authenticated users but not unauthenticated ones
      ALL_AUTHENTICATED_ROLES.forEach(role => {
        this.emitToRole(role, fullEventType, data);
      });
    }
  }

  emitStudentEvent(classId: string | null, eventType: 'created' | 'updated' | 'deleted' | 'enrolled', data: any, userId?: string) {
    const fullEventType = `student.${eventType}`;
    const operation = eventType === 'created' || eventType === 'enrolled' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('students', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitGradingEvent(examId: string | number, eventType: 'reviewed' | 'score_updated' | 'completed', data: any, userId?: string) {
    const fullEventType = `grading.${eventType}`;
    
    this.emitTableChange('student_answers', 'UPDATE', data, undefined, userId);
    this.emitToExam(examId, fullEventType, data);
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitMessageEvent(senderId: string, recipientId: string, eventType: 'sent' | 'read', data: any) {
    const fullEventType = `message.${eventType}`;
    
    this.emitTableChange('messages', eventType === 'sent' ? 'INSERT' : 'UPDATE', data, undefined, senderId);
    this.emitToUser(recipientId, fullEventType, data);
    this.emitToUser(senderId, `message.${eventType === 'sent' ? 'delivered' : 'read_confirmation'}`, data);
  }

  emitHomepageContentEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `homepage.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('homepage_content', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    // Also emit publicly for frontend cache invalidation
    this.emitEvent(fullEventType, { id: data.id, contentType: data.contentType });
  }

  emitStudyResourceEvent(classId: string | null, eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `study_resource.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('study_resources', operation, data, undefined, userId);
    this.emitToRole('teacher', fullEventType, data);
    
    if (classId) {
      this.emitToClass(classId, fullEventType, data);
    }
  }

  emitAnnouncementEvent(operation: 'created' | 'updated' | 'deleted', announcement: any, userId?: string) {
    const fullEventType = `announcement.${operation}`;
    const op = operation === 'created' ? 'INSERT' : operation === 'updated' ? 'UPDATE' : 'DELETE';
    
    // 1. Standard table change event for generic listeners
    this.emitTableChange('announcements', op, announcement, undefined, userId);
    
    // 2. Specific announcement event for direct listeners
    this.emitEvent(fullEventType, announcement);
    
    // 3. Broadcast to all for legacy/general component sync
    this.emitEvent('announcements-updated', { operation, id: announcement.id });
    
    console.log(`📢 Announcement ${operation} broadcasted: ${announcement.title}`);
  }

  emitExamSessionEvent(examId: string | number, sessionId: string | number, eventType: 'started' | 'progress' | 'completed' | 'auto_submitted', data: any, userId?: string) {
    const fullEventType = `examSession.${eventType}`;
    
    this.emitTableChange('exam_sessions', eventType === 'started' ? 'INSERT' : 'UPDATE', data, undefined, userId);
    this.emitToExam(examId, fullEventType, { sessionId, ...data });
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, { sessionId, ...data });
    }
  }

  emitExamResultEvent(examId: string | number, eventType: 'created' | 'updated' | 'graded', data: any, userId?: string) {
    const fullEventType = `examResult.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : 'UPDATE';
    
    this.emitTableChange('exam_results', operation, data, undefined, userId);
    this.emitToExam(examId, fullEventType, data);
    
    // Notify the student
    if (data.studentId) {
      this.emitToUser(data.studentId.toString(), fullEventType, data);
    }
    
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitTeacherAssignmentEvent(eventType: 'created' | 'updated' | 'deleted', data: any, userId?: string) {
    const fullEventType = `teacherAssignment.${eventType}`;
    const operation = eventType === 'created' ? 'INSERT' : eventType === 'updated' ? 'UPDATE' : 'DELETE';
    
    this.emitTableChange('teacher_assignments', operation, data, undefined, userId);
    this.emitToRole('admin', fullEventType, data);
    
    if (data.teacherId) {
      this.emitToUser(data.teacherId.toString(), fullEventType, data);
    }
    if (data.classId) {
      this.emitToClass(data.classId.toString(), fullEventType, data);
    }
  }

  emitParentLinkEvent(parentId: string, studentId: string, eventType: 'linked' | 'unlinked', data: any, userId?: string) {
    const fullEventType = `parentLink.${eventType}`;
    const operation = eventType === 'linked' ? 'INSERT' : 'DELETE';
    
    this.emitTableChange('parent_student_links', operation, data, undefined, userId);
    this.emitToUser(parentId, fullEventType, data);
    this.emitToUser(studentId, fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
  }

  emitSystemSettingEvent(eventType: 'updated', data: any, userId?: string) {
    const fullEventType = `system.settings_${eventType}`;
    
    this.emitTableChange('system_settings', 'UPDATE', data, undefined, userId);
    this.emitToRole('super_admin', fullEventType, data);
    this.emitToRole('admin', fullEventType, data);
    // Emit publicly for theme/branding changes
    if (data.key && ['schoolName', 'schoolLogo', 'primaryColor', 'secondaryColor'].includes(data.key)) {
      this.emitEvent(`system.branding_${eventType}`, { key: data.key, value: data.value });
    }
  }

  // Dashboard stats emission for real-time dashboard updates
  emitDashboardStats(role: string, stats: any) {
    this.emitToRole(role, 'dashboard.stats_updated', stats);
  }

  // Grading settings event for real-time config updates
  emitGradingSettingsEvent(eventType: 'updated', data: any, userId?: string) {
    const fullEventType = `grading_settings.${eventType}`;
    
    this.emitToRole('admin', fullEventType, data);
    this.emitToRole('super_admin', fullEventType, data);
    this.emitToRole('teacher', fullEventType, data);
    
    this.emitEvent('grading_settings.changed', {
      testWeight: data.testWeight,
      examWeight: data.examWeight,
      gradingScale: data.gradingScale,
      timestamp: Date.now()
    });
    
    console.log(`📤 Emitted ${fullEventType} - Test: ${data.testWeight}%, Exam: ${data.examWeight}%`);
  }

  // Enhanced student-specific report card subscription
  emitStudentReportCardUpdate(studentId: string, reportCardId: number | string, eventType: string, data: any) {
    const fullEventType = `reportcard.${eventType}`;
    
    this.emitToUser(studentId, fullEventType, data);
    this.emitToReportCard(reportCardId, fullEventType, data);
    
    if (data.parentId) {
      this.emitToUser(data.parentId, fullEventType, data);
    }
    
    console.log(`📤 Emitted student report card update for student ${studentId}`);
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

  shutdown() {
    if (this.eventIdCleanupInterval) {
      clearInterval(this.eventIdCleanupInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.io) {
      this.io.close();
    }
    console.log('🛑 Socket.IO Realtime Service shut down');
  }
}

export const realtimeService = new RealtimeService();
