/** ExamSessionTracker — duplicate exam-session detection, extracted from realtime-service.ts. */
import type { Socket } from 'socket.io';
import type { Server as SocketIOServer } from 'socket.io';
import type { ActiveExamSession, SocketUser } from './realtime.types';

export class ExamSessionTracker {
  private activeExamSessions = new Map<number, ActiveExamSession>();
  private socketToSession = new Map<string, number>();

  constructor(
    private getIO: () => SocketIOServer | null,
    private getSocketUser: (socketId: string) => SocketUser | undefined,
  ) {}

  // EXAM SECURITY: Register an active exam session for duplicate detection
  register(socket: Socket, data: { sessionId: number; examId: number }) {
    const user = this.getSocketUser(socket.id);
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
        this.getIO()?.to(existingSession.socketId).emit('exam:duplicate_session', {
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
  heartbeat(socket: Socket, data: { sessionId: number }) {
    const session = this.activeExamSessions.get(data.sessionId);

    if (session && session.socketId === socket.id) {
      session.lastPing = new Date();
      socket.emit('exam:heartbeat_ack', { sessionId: data.sessionId, timestamp: Date.now() });
    }
  }

  // EXAM SECURITY: Handle session unregistration when exam ends
  unregister(socket: Socket, data: { sessionId: number }) {
    const session = this.activeExamSessions.get(data.sessionId);

    if (session && session.socketId === socket.id) {
      this.activeExamSessions.delete(data.sessionId);
      this.socketToSession.delete(socket.id);
      socket.leave(`exam_session:${data.sessionId}`);
      console.log(`📋 Exam session unregistered: Session ${data.sessionId}, Socket ${socket.id}`);
    }
  }

  // Clean up exam session registration on socket disconnect (if any)
  cleanupOnDisconnect(socketId: string) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;
    const session = this.activeExamSessions.get(sessionId);
    if (session && session.socketId === socketId) {
      this.activeExamSessions.delete(sessionId);
      console.log(`   → Cleaned up exam session ${sessionId} on disconnect`);
    }
    this.socketToSession.delete(socketId);
  }
}
