import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { queryClient } from '@/lib/queryClient';

interface UseSocketIORealtimeOptions {
  table?: string;
  queryKey: (string | number | undefined)[] | string;
  enabled?: boolean;
  fallbackPollingInterval?: number;
  channel?: string;
  classId?: string;
  examId?: string | number;
  reportCardId?: string | number;
  onEvent?: (event: RealtimeEvent) => void;
  /**
   * If true, skip automatic cache invalidation for this subscription.
   * Use this when you handle cache updates manually via mutations with optimistic updates.
   * Default is false (normal cache invalidation behavior).
   */
  skipCacheInvalidation?: boolean;
}

interface RealtimeEvent {
  eventId: string;
  eventType: string;
  table?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  oldData?: any;
  timestamp: number;
  userId?: string;
}

let globalSocket: Socket | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const seenEventIds = new Set<string>();
const EVENT_ID_TTL = 60000;
let lastTokenHash: string | null = null;
let isAuthError = false;

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

function cleanupOldEventIds() {
  if (seenEventIds.size > 1000) {
    seenEventIds.clear();
  }
}

// Use hash comparison to detect token changes efficiently
function getTokenHash(token: string | null): string | null {
  if (!token) return null;
  // Simple hash using first and last 8 chars + length (avoids full comparison each call)
  return `${token.slice(0, 8)}:${token.length}:${token.slice(-8)}`;
}

function hasTokenChanged(): boolean {
  const currentHash = getTokenHash(getAuthToken());
  return currentHash !== lastTokenHash;
}

// Check if error is an authentication error (using structured codes or known patterns)
function isAuthenticationError(error: any): boolean {
  // Check structured error codes first
  if (error?.data?.code) {
    const code = error.data.code;
    return ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'AUTH_REQUIRED', 'UNAUTHORIZED'].includes(code);
  }
  // Fallback to message check for backward compatibility
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('token');
}

function getOrCreateSocket(): Socket {
  const currentToken = getAuthToken();
  const currentHash = getTokenHash(currentToken);
  
  // If socket exists, check if we need to reconnect with new token
  if (globalSocket) {
    // If connected with same token, return existing socket
    if (globalSocket.connected && currentHash === lastTokenHash && !isAuthError) {
      return globalSocket;
    }
    
    // Token changed or auth error occurred - force reconnect
    if (currentHash !== lastTokenHash || isAuthError) {
      console.log('🔄 Token changed or auth error, reconnecting with new credentials...');
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
      isAuthError = false;
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const socketUrl = apiUrl || window.location.origin;

  lastTokenHash = currentHash;

  globalSocket = io(socketUrl, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
    auth: currentToken ? { token: currentToken } : undefined,
    // Production optimizations
    forceNew: false,
    upgrade: true,
    rememberUpgrade: true,
  });

  globalSocket.on('connect', () => {
    console.log('✅ Socket.IO connected (ID:', globalSocket?.id, ')');
    connectionAttempts = 0;
    isAuthError = false;
  });

  globalSocket.on('disconnect', (reason: string) => {
    console.log('📡 Socket.IO disconnected:', reason);
    // Handle server-initiated disconnects that require manual reconnect
    if (reason === 'io server disconnect' || reason === 'transport close') {
      // Check if token changed while disconnected
      if (hasTokenChanged()) {
        console.log('🔄 Token changed during disconnect, forcing fresh connection...');
        globalSocket?.removeAllListeners();
        globalSocket = null;
        getOrCreateSocket();
      } else {
        console.log('🔄 Attempting to reconnect...');
        setTimeout(() => {
          if (globalSocket && !globalSocket.connected) {
            globalSocket.connect();
          }
        }, 1000);
      }
    }
  });

  globalSocket.on('connect_error', (error: any) => {
    connectionAttempts++;
    console.error(`❌ Socket.IO connection error (attempt ${connectionAttempts}):`, error?.message || error);
    
    // If authentication error, mark it and stop retrying
    if (isAuthenticationError(error)) {
      console.log('🔒 Authentication error detected - will reconnect when token changes');
      isAuthError = true;
      globalSocket?.disconnect();
    }
  });

  globalSocket.on('reconnect', (attemptNumber: number) => {
    console.log(`🔄 Socket.IO reconnected after ${attemptNumber} attempts`);
    isAuthError = false;
  });

  globalSocket.on('reconnect_attempt', (attemptNumber: number) => {
    console.log(`🔄 Socket.IO reconnection attempt ${attemptNumber}...`);
    // Refresh token on each reconnect attempt
    const newToken = getAuthToken();
    if (globalSocket && newToken) {
      globalSocket.auth = { token: newToken };
    }
  });

  globalSocket.on('reconnect_failed', () => {
    console.error('❌ Socket.IO reconnection failed after max attempts');
  });

  return globalSocket;
}

export function reconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
  return getOrCreateSocket();
}

export function useSocketIORealtime({ 
  table, 
  queryKey, 
  enabled = true,
  fallbackPollingInterval = 30000,
  channel,
  classId,
  examId,
  reportCardId,
  onEvent,
  skipCacheInvalidation = false,
}: UseSocketIORealtimeOptions) {
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number | null>(null);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.eventId && seenEventIds.has(event.eventId)) {
      console.log(`📥 Ignoring duplicate event: ${event.eventId.slice(0, 8)}...`);
      return;
    }

    if (event.eventId) {
      seenEventIds.add(event.eventId);
      cleanupOldEventIds();
    }

    setLastEventTimestamp(event.timestamp);

    if (onEvent) {
      onEvent(event);
    }
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const filteredQueryKey = Array.isArray(queryKey) 
      ? queryKey.filter(key => key !== undefined && key !== null)
      : [queryKey];

    if (filteredQueryKey.length === 0) {
      return;
    }

    try {
      const socket = getOrCreateSocket();
      socketRef.current = socket;

      const handleConnect = () => {
        setIsConnected(true);
        setIsFallbackMode(false);
        stopPolling();

        if (table) {
          socket.emit('subscribe:table', { table });
        }
        if (channel) {
          socket.emit('subscribe', { channel });
        }
        if (classId) {
          socket.emit('subscribe:class', { classId });
        }
        if (examId) {
          socket.emit('subscribe:exam', { examId });
        }
        if (reportCardId) {
          socket.emit('subscribe:reportcard', { reportCardId });
        }
      };

      const handleDisconnect = () => {
        setIsConnected(false);
        if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
          startPolling();
        }
      };

      const handleTableChange = (event: RealtimeEvent) => {
        if (table && event.table === table) {
          handleEvent(event);
          console.log(`📥 Received ${event.operation} event for table: ${table}`);
          
          // Only skip refetch if explicitly opted in (e.g., when using optimistic updates)
          if (!skipCacheInvalidation) {
            // CRITICAL: Use refetchQueries instead of invalidateQueries for INSTANT UI updates
            // invalidateQueries only marks queries as stale but doesn't immediately refetch
            // refetchQueries forces an immediate network request and UI update
            queryClient.refetchQueries({ queryKey: filteredQueryKey, type: 'active' });
          }
        }
      };

      const handleCustomEvent = (eventType: string) => (payload: any) => {
        handleEvent(payload);
        console.log(`📥 Received ${eventType} event`);
        
        // Only skip refetch if explicitly opted in (e.g., when using optimistic updates)
        if (!skipCacheInvalidation) {
          // CRITICAL: Use refetchQueries instead of invalidateQueries for INSTANT UI updates
          // invalidateQueries only marks queries as stale but doesn't immediately refetch
          // refetchQueries forces an immediate network request and UI update
          queryClient.refetchQueries({ queryKey: filteredQueryKey, type: 'active' });
        }
      };

      if (socket.connected) {
        handleConnect();
      } else {
        socket.on('connect', handleConnect);
      }

      socket.on('disconnect', handleDisconnect);
      socket.on('table_change', handleTableChange);

      const customEvents = [
        'exam.started', 'exam.submitted', 'exam.graded', 'exam.auto_submitted',
        'exam.published', 'exam.unpublished', 'exam.deleted',
        'question.deleted',
        'reportcard.updated', 'reportcard.published', 'reportcard.finalized', 'reportcard.reverted',
        'score-updated', 'score.updated',
        'user.created', 'user.updated', 'user.deleted',
        'attendance.marked', 'attendance.updated',
        'notification',
        'upload.progress',
        'subject-assignments-updated',
      ];

      // Store handler references for proper cleanup
      const eventHandlers: Record<string, (payload: any) => void> = {};
      customEvents.forEach(eventType => {
        eventHandlers[eventType] = handleCustomEvent(eventType);
        socket.on(eventType, eventHandlers[eventType]);
      });

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('table_change', handleTableChange);
        
        // Remove handlers with exact references to prevent memory leaks
        customEvents.forEach(eventType => {
          socket.off(eventType, eventHandlers[eventType]);
        });

        if (table) {
          socket.emit('unsubscribe', { table });
        }
        if (channel) {
          socket.emit('unsubscribe', { channel });
        }
        if (classId) {
          socket.emit('unsubscribe', { classId });
        }
        if (examId) {
          socket.emit('unsubscribe', { examId });
        }
        if (reportCardId) {
          socket.emit('unsubscribe', { reportCardId });
        }
        
        stopPolling();
      };
    } catch (error) {
      console.error('Failed to initialize Socket.IO, using polling fallback:', error);
      startPolling();
    }

    function startPolling() {
      if (pollingIntervalRef.current) return;

      setIsFallbackMode(true);
      console.log(`📊 Starting polling fallback (${fallbackPollingInterval}ms)`);

      pollingIntervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: filteredQueryKey });
      }, fallbackPollingInterval);
    }

    function stopPolling() {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsFallbackMode(false);
      }
    }
  }, [table, channel, classId, examId, reportCardId, enabled, fallbackPollingInterval, handleEvent, skipCacheInvalidation, JSON.stringify(Array.isArray(queryKey) ? queryKey : [queryKey])]);

  return { isFallbackMode, isConnected, lastEventTimestamp };
}

export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getOrCreateSocket();

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      setConnectionError(error.message);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
    };
  }, []);

  return { isConnected, connectionError, reconnect: reconnectSocket };
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const socket = getOrCreateSocket();

    socket.on('notification', (payload: any) => {
      setNotifications(prev => [payload.data, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('notification');
    };
  }, [userId]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, clearNotifications };
}

export function useUploadProgress() {
  const [uploads, setUploads] = useState<Map<string, { progress: number; status: string; url?: string }>>(new Map());

  useEffect(() => {
    const socket = getOrCreateSocket();

    socket.on('upload.progress', (payload: any) => {
      const { uploadId, progress, status, url } = payload.data;
      setUploads(prev => {
        const newMap = new Map(prev);
        newMap.set(uploadId, { progress, status, url });
        return newMap;
      });
    });

    return () => {
      socket.off('upload.progress');
    };
  }, []);

  return { uploads };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
    }
  });
}
