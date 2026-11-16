/** UserActivityTracker — per-user activity tracking, online users, admin feed.
 *  Extracted from realtime-service.ts (composition pattern). */
import crypto from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import { ROLE_NAMES } from '@shared/role-constants';
import type { SocketUser, UserActivityRecord, OnlineUserInfo, ActivityFeedEvent, UserInfoProvider } from './realtime.types';

const FEED_MAX = 100;
const IDLE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const ACTIVITY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_CHECK_INTERVAL_MS = 30000;

const ADMIN_ROOMS = ['role:admin', 'role:Admin', 'role:super_admin', 'role:Super Admin', 'role:superadmin'];

export class UserActivityTracker {
  // Real-time user activity tracking: Map<userId, UserActivityRecord>
  private userActivityMap = new Map<string, UserActivityRecord>();
  private activityCheckInterval: NodeJS.Timeout | null = null;

  // Activity feed: last 100 events (login / logout / idle / active)
  private activityFeed: ActivityFeedEvent[] = [];

  // Pluggable user info provider for enriching activity records
  private userInfoProvider: UserInfoProvider | null = null;

  constructor(private getIO: () => SocketIOServer | null) {}

  setUserInfoProvider(fn: UserInfoProvider) {
    this.userInfoProvider = fn;
  }

  private logActivityEvent(type: ActivityFeedEvent['type'], rec: Pick<UserActivityRecord, 'userId' | 'role' | 'displayName' | 'username'>) {
    const event: ActivityFeedEvent = {
      id: crypto.randomUUID(),
      type,
      userId: rec.userId,
      displayName: rec.displayName || rec.username || rec.userId,
      role: rec.role,
      timestamp: new Date().toISOString(),
    };
    this.activityFeed.unshift(event);
    if (this.activityFeed.length > FEED_MAX) {
      this.activityFeed.length = FEED_MAX;
    }
    // Broadcast updated feed to admins
    const io = this.getIO();
    if (io) {
      io
        .to('role:admin').to('role:Admin')
        .to('role:super_admin').to('role:Super Admin').to('role:superadmin')
        .emit('admin:activity_feed', this.activityFeed);
    }
  }

  getActivityFeed(): ActivityFeedEvent[] {
    return [...this.activityFeed];
  }

  async trackUserConnect(user: SocketUser, socketId: string) {
    const now = new Date();
    const existing = this.userActivityMap.get(user.userId);
    if (existing) {
      existing.socketIds.add(socketId);
      existing.lastActive = now;
    } else {
      const record: UserActivityRecord = {
        userId: user.userId,
        role: user.role,
        socketIds: new Set([socketId]),
        firstConnectedAt: now,
        lastActive: now,
        wasIdle: false,
      };
      this.userActivityMap.set(user.userId, record);
      // Log login event (async enrichment will update name later)
      this.logActivityEvent('login', record);

      // Async enrich display name without blocking connect; re-broadcast once
      // names are available so admins see real names immediately (not the UUID).
      if (this.userInfoProvider) {
        this.userInfoProvider(user.userId)
          .then((info) => {
            if (info) {
              const r = this.userActivityMap.get(user.userId);
              if (r) {
                r.displayName = info.displayName;
                r.username = info.username;
                // Update the login event's displayName in feed
                const loginEvent = this.activityFeed.find(e => e.userId === user.userId && e.type === 'login');
                if (loginEvent) loginEvent.displayName = info.displayName;
                this.broadcastOnlineUsersToAdmins();
              }
            }
          })
          .catch(() => {/* ignore enrichment failures */});
      }
    }
    this.broadcastOnlineUsersToAdmins();
  }

  trackUserDisconnect(userId: string, socketId: string) {
    const record = this.userActivityMap.get(userId);
    if (!record) return;
    record.socketIds.delete(socketId);
    // Do NOT remove user from map on socket disconnect — they may still be making
    // API calls. The activity-check interval will expire them after EXPIRY_MS of
    // complete inactivity (no API calls AND no socket heartbeats).
    this.broadcastOnlineUsersToAdmins();
  }

  updateUserActivity(userId: string) {
    const record = this.userActivityMap.get(userId);
    if (record) {
      record.lastActive = new Date();
    }
  }

  /** Socket heartbeat: refresh if tracked, recreate if pruned while socket still open. */
  heartbeatRefresh(userId: string, roleName?: string) {
    const existing = this.userActivityMap.get(userId);
    if (existing) {
      existing.lastActive = new Date();
    } else {
      this.touchUserActivity(userId, undefined, roleName);
    }
  }

  broadcastOnlineUsersToAdmins() {
    const io = this.getIO();
    if (!io) return;
    const list = this.getOnlineUsersRaw();
    // Target both admin room name variants to be resilient to role name formats
    io.to(ADMIN_ROOMS[0]).to(ADMIN_ROOMS[1]).to(ADMIN_ROOMS[2]).to(ADMIN_ROOMS[3]).to(ADMIN_ROOMS[4])
      .emit('admin:online_users', list);
  }

  private getOnlineUsersRaw(): OnlineUserInfo[] {
    const now = Date.now();
    const result: OnlineUserInfo[] = [];
    this.userActivityMap.forEach((rec) => {
      const msSinceActive = now - rec.lastActive.getTime();
      result.push({
        userId: rec.userId,
        role: rec.role,
        displayName: rec.displayName || rec.username || rec.userId,
        username: rec.username || rec.userId,
        firstConnectedAt: rec.firstConnectedAt.toISOString(),
        lastActive: rec.lastActive.toISOString(),
        status: msSinceActive > IDLE_THRESHOLD_MS ? 'idle' : 'online',
        socketCount: rec.socketIds.size,
        className: rec.className,
        classId: rec.classId,
      });
    });
    return result;
  }

  getOnlineUsers(): OnlineUserInfo[] {
    return this.getOnlineUsersRaw();
  }

  /**
   * Called from the REST auth middleware on every authenticated request.
   *
   * - If the user is already tracked → refresh their lastActive timestamp.
   * - If the user is NOT yet tracked AND role info is provided → create a new
   *   "REST-tracked" entry so they appear in Live Activity even when their
   *   socket connection has not yet been established (or failed entirely).
   *
   * This makes API-call activity the primary tracking signal; socket heartbeats
   * are a supplementary real-time refresh on top of that.
   */
  touchUserActivity(userId: string, roleId?: number, roleName?: string) {
    const existing = this.userActivityMap.get(userId);
    if (existing) {
      existing.lastActive = new Date();
      return;
    }

    // Need at least one role identifier to create a meaningful record
    if (!roleId && !roleName) return;

    const role = roleName
      || (roleId ? (ROLE_NAMES[roleId as keyof typeof ROLE_NAMES] || 'unknown') : 'unknown');

    const record: UserActivityRecord = {
      userId,
      role,
      socketIds: new Set(), // no socket yet; that's fine
      firstConnectedAt: new Date(),
      lastActive: new Date(),
      wasIdle: false,
    };
    this.userActivityMap.set(userId, record);

    // Async-enrich with display name / username from DB; re-broadcast once
    // complete so admins see real names immediately via socket push.
    if (this.userInfoProvider) {
      this.userInfoProvider(userId)
        .then((info) => {
          if (info) {
            const r = this.userActivityMap.get(userId);
            if (r) {
              r.displayName = info.displayName;
              r.username = info.username;
              this.broadcastOnlineUsersToAdmins();
            }
          }
        })
        .catch(() => { /* enrichment is non-critical */ });
    }

    this.broadcastOnlineUsersToAdmins();
  }

  startActivityCheck() {
    // Every 30 s: prune stale socket IDs and expire users who have been
    // completely inactive (no API calls AND no socket heartbeats) for 10 minutes.
    // 10 minutes gives socket heartbeats (every 25 s) ample room to refresh
    // the record even after brief network blips or page navigations.
    this.activityCheckInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.userActivityMap.forEach((rec, userId) => {
        // Remove any socket IDs that are no longer connected
        rec.socketIds.forEach((sid) => {
          const sock = this.getIO()?.sockets.sockets.get(sid);
          if (!sock || sock.disconnected) {
            rec.socketIds.delete(sid);
            changed = true;
          }
        });

        // Expire the whole record if the user has been fully inactive
        const msSinceActive = now - rec.lastActive.getTime();
        if (msSinceActive > ACTIVITY_EXPIRY_MS) {
          this.logActivityEvent('logout', rec);
          this.userActivityMap.delete(userId);
          changed = true;
          return; // skip idle-check for expired record
        }

        // Detect online → idle transition
        const isNowIdle = msSinceActive > IDLE_THRESHOLD_MS;
        if (isNowIdle && !rec.wasIdle) {
          rec.wasIdle = true;
          this.logActivityEvent('idle', rec);
          changed = true;
        } else if (!isNowIdle && rec.wasIdle) {
          rec.wasIdle = false;
          this.logActivityEvent('active', rec);
          changed = true;
        }
      });

      if (changed) this.broadcastOnlineUsersToAdmins();
    }, ACTIVITY_CHECK_INTERVAL_MS);
  }

  shutdown() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
  }
}
