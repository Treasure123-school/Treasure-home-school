import { useEffect, useRef } from 'react';
import { getSharedSocket } from '@/hooks/useSocketIORealtime';

const HEARTBEAT_INTERVAL_MS = 25000; // every 25s
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];

/**
 * Global hook that every authenticated user mounts.
 * - Ensures the Socket.IO connection is established so the server can track them
 * - Sends periodic heartbeats so the server keeps their status as "online"
 * - Sends a heartbeat on user activity (mouse/keyboard) events
 */
export function useUserActivityTracker(enabled = true) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const activityDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getSharedSocket();

    const sendHeartbeat = () => {
      if (socket.connected) {
        socket.emit('user:heartbeat');
      }
    };

    // Send immediate heartbeat on mount
    if (socket.connected) {
      sendHeartbeat();
    } else {
      socket.once('connect', sendHeartbeat);
    }

    // Periodic heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Debounced activity-based heartbeat: reset "idle" status on any user interaction
    const handleActivity = () => {
      if (activityDebounceRef.current) return;
      activityDebounceRef.current = setTimeout(() => {
        sendHeartbeat();
        activityDebounceRef.current = null;
      }, 1000);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (activityDebounceRef.current) clearTimeout(activityDebounceRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      socket.off('connect', sendHeartbeat);
    };
  }, [enabled]);
}
