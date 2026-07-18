import { useEffect, useRef } from 'react';
import { getSharedSocket } from '@/hooks/useSocketIORealtime';
import { getApiUrl } from '@/config/api';

const HEARTBEAT_INTERVAL_MS = 25000;      // socket heartbeat every 25 s
const REST_HEARTBEAT_INTERVAL_MS = 60000; // REST fallback every 60 s
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];

function getToken(): string | null {
  try { return localStorage.getItem('token'); } catch { return null; }
}

async function pingRestHeartbeat() {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(getApiUrl('/api/user/heartbeat'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // non-critical: ignore network failures
  }
}

/**
 * Global hook that every authenticated user mounts.
 *
 * Primary   → REST heartbeat (POST /api/user/heartbeat every 60 s).
 *             Every authenticated API request already counts too, because
 *             the auth middleware calls touchUserActivity on each one.
 * Secondary → Socket heartbeat (user:heartbeat every 25 s) for real-time
 *             presence updates to the admin live page.
 * Bonus     → Activity-event debounce: any mouse/keyboard event sends an
 *             extra socket heartbeat to reset the "idle" threshold faster.
 */
export function useUserActivityTracker(enabled = true) {
  const socketHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const restHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const activityDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getSharedSocket();

    const sendSocketHeartbeat = () => {
      if (socket.connected) {
        socket.emit('user:heartbeat');
      }
    };

    // Immediate socket heartbeat on mount
    if (socket.connected) {
      sendSocketHeartbeat();
    } else {
      socket.once('connect', sendSocketHeartbeat);
    }

    // Immediate REST heartbeat on mount so the server knows this user is
    // present even before any page-specific API calls are made.
    pingRestHeartbeat();

    // Periodic socket heartbeat
    socketHeartbeatRef.current = setInterval(sendSocketHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Periodic REST heartbeat — primary tracking signal.
    // Ensures the user stays visible even on fully static pages (e.g. a
    // student mid-exam who isn't making any page-specific API calls).
    restHeartbeatRef.current = setInterval(pingRestHeartbeat, REST_HEARTBEAT_INTERVAL_MS);

    // Debounced activity-based socket heartbeat: resets "idle" status on
    // any user interaction without flooding the server.
    const handleActivity = () => {
      if (activityDebounceRef.current) return;
      activityDebounceRef.current = setTimeout(() => {
        sendSocketHeartbeat();
        activityDebounceRef.current = null;
      }, 1000);
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      if (socketHeartbeatRef.current) clearInterval(socketHeartbeatRef.current);
      if (restHeartbeatRef.current) clearInterval(restHeartbeatRef.current);
      if (activityDebounceRef.current) clearTimeout(activityDebounceRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      socket.off('connect', sendSocketHeartbeat);
    };
  }, [enabled]);
}
