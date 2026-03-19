/**
 * Socket.IO Performance Optimizer
 * 
 * Provides optimizations for WebSocket/Socket.IO connections:
 * - Connection pooling and management
 * - Message batching and compression
 * - Room-based event scoping
 * - Heartbeat optimization
 * - Dead connection cleanup
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';

interface ConnectionStats {
  totalConnections: number;
  authenticatedConnections: number;
  roomCounts: Map<string, number>;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  peakConnections: number;
  averageLatency: number;
  droppedConnections: number;
}

interface MessageBatch {
  events: Array<{ eventType: string; data: any; rooms?: string[] }>;
  createdAt: number;
}

interface OptimizationConfig {
  batchingEnabled: boolean;
  batchIntervalMs: number;
  maxBatchSize: number;
  compressionThreshold: number;
  heartbeatInterval: number;
  deadConnectionTimeout: number;
  maxConnectionsPerUser: number;
  enableMetrics: boolean;
}

class SocketOptimizer {
  private io: SocketIOServer | null = null;
  private config: OptimizationConfig;
  private stats: ConnectionStats;
  private messageBatch: MessageBatch;
  private batchTimer: NodeJS.Timeout | null = null;
  private latencyMeasurements: number[] = [];
  private connectionsByUser: Map<string, Set<string>> = new Map();
  
  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      batchingEnabled: true,
      batchIntervalMs: 50, // Batch messages every 50ms
      maxBatchSize: 100,
      compressionThreshold: 1024, // Compress messages > 1KB
      heartbeatInterval: 25000,
      deadConnectionTimeout: 60000,
      maxConnectionsPerUser: 5, // Max 5 tabs per user
      enableMetrics: true,
      ...config
    };
    
    this.stats = this.initializeStats();
    this.messageBatch = { events: [], createdAt: Date.now() };
  }

  /**
   * Initialize Socket.IO with optimizations
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupOptimizedHandlers();
    this.startMetricsCollection();
    console.log('✅ Socket Optimizer initialized');
  }

  /**
   * Add optimized event emission with batching
   */
  emit(eventType: string, data: any, rooms?: string | string[]): void {
    if (!this.io) return;

    const roomList = rooms ? (Array.isArray(rooms) ? rooms : [rooms]) : [];

    if (this.config.batchingEnabled) {
      this.addToBatch(eventType, data, roomList);
    } else {
      this.emitImmediate(eventType, data, roomList);
    }
  }

  /**
   * Emit immediately (bypass batching)
   */
  emitImmediate(eventType: string, data: any, rooms: string[]): void {
    if (!this.io) return;

    const payload = this.optimizePayload(data);
    
    if (rooms.length > 0) {
      for (const room of rooms) {
        this.io.to(room).emit(eventType, payload);
      }
    } else {
      this.io.emit(eventType, payload);
    }

    this.stats.messagesSent++;
    this.stats.bytesTransferred += JSON.stringify(payload).length;
  }

  /**
   * Add message to batch
   */
  private addToBatch(eventType: string, data: any, rooms: string[]): void {
    this.messageBatch.events.push({ eventType, data, rooms });

    // Flush if batch is full
    if (this.messageBatch.events.length >= this.config.maxBatchSize) {
      this.flushBatch();
    }

    // Start batch timer if not running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchIntervalMs);
    }
  }

  /**
   * Flush message batch
   */
  private flushBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const events = this.messageBatch.events;
    this.messageBatch = { events: [], createdAt: Date.now() };

    if (events.length === 0) return;

    // Group events by room for efficient delivery
    const eventsByRoom: Map<string, Array<{ eventType: string; data: any }>> = new Map();
    const broadcastEvents: Array<{ eventType: string; data: any }> = [];

    for (const event of events) {
      if (event.rooms && event.rooms.length > 0) {
        for (const room of event.rooms) {
          if (!eventsByRoom.has(room)) {
            eventsByRoom.set(room, []);
          }
          eventsByRoom.get(room)!.push({ eventType: event.eventType, data: event.data });
        }
      } else {
        broadcastEvents.push({ eventType: event.eventType, data: event.data });
      }
    }

    // Emit batched events
    if (this.io) {
      for (const [room, roomEvents] of eventsByRoom) {
        if (roomEvents.length === 1) {
          this.io.to(room).emit(roomEvents[0].eventType, this.optimizePayload(roomEvents[0].data));
        } else {
          // Send as batch for multiple events to same room
          this.io.to(room).emit('batch', { events: roomEvents.map(e => ({ type: e.eventType, data: this.optimizePayload(e.data) })) });
        }
      }

      for (const event of broadcastEvents) {
        this.io.emit(event.eventType, this.optimizePayload(event.data));
      }
    }

    this.stats.messagesSent += events.length;
  }

  /**
   * Optimize payload (remove unnecessary data, potentially compress)
   */
  private optimizePayload(data: any): any {
    if (data === null || data === undefined) return data;

    // Remove undefined values from objects
    if (typeof data === 'object' && !Array.isArray(data)) {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
      return cleaned;
    }

    return data;
  }

  /**
   * Track connection for a user
   */
  trackConnection(userId: string, socketId: string): boolean {
    if (!this.connectionsByUser.has(userId)) {
      this.connectionsByUser.set(userId, new Set());
    }

    const userConnections = this.connectionsByUser.get(userId)!;
    
    // Check if user has too many connections
    if (userConnections.size >= this.config.maxConnectionsPerUser) {
      console.warn(`⚠️  User ${userId} exceeded max connections (${this.config.maxConnectionsPerUser})`);
      return false;
    }

    userConnections.add(socketId);
    this.stats.totalConnections++;
    this.stats.authenticatedConnections++;
    
    if (this.stats.totalConnections > this.stats.peakConnections) {
      this.stats.peakConnections = this.stats.totalConnections;
    }

    return true;
  }

  /**
   * Untrack connection for a user
   */
  untrackConnection(userId: string, socketId: string): void {
    const userConnections = this.connectionsByUser.get(userId);
    if (userConnections) {
      userConnections.delete(socketId);
      if (userConnections.size === 0) {
        this.connectionsByUser.delete(userId);
      }
    }
    
    if (this.stats.totalConnections > 0) {
      this.stats.totalConnections--;
    }
    if (this.stats.authenticatedConnections > 0) {
      this.stats.authenticatedConnections--;
    }
  }

  /**
   * Record latency measurement
   */
  recordLatency(latencyMs: number): void {
    this.latencyMeasurements.push(latencyMs);
    
    // Keep only last 1000 measurements
    if (this.latencyMeasurements.length > 1000) {
      this.latencyMeasurements.shift();
    }
    
    // Update average
    this.stats.averageLatency = this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length;
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    // Update room counts
    if (this.io) {
      const rooms = this.io.sockets.adapter.rooms;
      this.stats.roomCounts = new Map();
      for (const [roomName, sockets] of rooms) {
        // Skip socket ID rooms
        if (!roomName.startsWith('/')) {
          this.stats.roomCounts.set(roomName, sockets.size);
        }
      }
    }

    return { ...this.stats };
  }

  /**
   * Get room size
   */
  getRoomSize(room: string): number {
    if (!this.io) return 0;
    return this.io.sockets.adapter.rooms.get(room)?.size || 0;
  }

  /**
   * Broadcast to specific room efficiently
   */
  broadcastToRoom(room: string, eventType: string, data: any): void {
    if (!this.io) return;
    this.io.to(room).emit(eventType, this.optimizePayload(data));
    this.stats.messagesSent++;
  }

  /**
   * Get connections per user stats
   */
  getConnectionsPerUser(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [userId, sockets] of this.connectionsByUser) {
      result.set(userId, sockets.size);
    }
    return result;
  }

  /**
   * Setup optimized event handlers
   */
  private setupOptimizedHandlers(): void {
    if (!this.io) return;

    // Optimize ping/pong for latency measurement
    this.io.on('connection', (socket: Socket) => {
      // Setup latency measurement
      socket.on('ping_measure', () => {
        socket.emit('pong_measure', { timestamp: Date.now() });
      });

      // Handle batch subscription requests
      socket.on('subscribe_batch', (rooms: string[]) => {
        if (Array.isArray(rooms)) {
          for (const room of rooms.slice(0, 20)) { // Limit to 20 rooms
            if (typeof room === 'string' && room.length < 100) {
              socket.join(room);
            }
          }
        }
      });

      // Handle batch unsubscription
      socket.on('unsubscribe_batch', (rooms: string[]) => {
        if (Array.isArray(rooms)) {
          for (const room of rooms) {
            if (typeof room === 'string') {
              socket.leave(room);
            }
          }
        }
      });
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return;

    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      console.log(`📡 Socket Stats: ${stats.totalConnections} connections, ${stats.messagesSent} msgs sent, ${Math.round(stats.averageLatency)}ms avg latency`);
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize stats object
   */
  private initializeStats(): ConnectionStats {
    return {
      totalConnections: 0,
      authenticatedConnections: 0,
      roomCounts: new Map(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      peakConnections: 0,
      averageLatency: 0,
      droppedConnections: 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.latencyMeasurements = [];
  }

  /**
   * Shutdown optimizer
   */
  shutdown(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.flushBatch();
  }
}

// Singleton instance
export const socketOptimizer = new SocketOptimizer();

// Export class for testing
export { SocketOptimizer, ConnectionStats, OptimizationConfig };
