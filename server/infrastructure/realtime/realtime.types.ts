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

export interface SubscriptionData {
  table?: string;
  channel?: string;
  userId?: string;
  classId?: string;
  examId?: string | number;
  reportCardId?: string | number;
}

// Track active exam sessions for duplicate detection
export interface ActiveExamSession {
  socketId: string;
  sessionId: number;
  userId: string;
  examId: number;
  registeredAt: Date;
  lastPing: Date;
}

// Track per-user activity for admin visibility
export interface UserActivityRecord {
  userId: string;
  role: string;
  socketIds: Set<string>;
  firstConnectedAt: Date;
  lastActive: Date;
  wasIdle: boolean; // for idle-transition detection
  // Enriched at API layer from DB
  displayName?: string;
  username?: string;
  email?: string;
  className?: string;
  classId?: number;
}

export interface OnlineUserInfo {
  userId: string;
  role: string;
  displayName: string;
  username: string;
  firstConnectedAt: string;
  lastActive: string;
  status: 'online' | 'idle';
  socketCount: number;
  className?: string;
  classId?: number;
}

export interface ActivityFeedEvent {
  id: string;
  type: 'login' | 'logout' | 'idle' | 'active';
  userId: string;
  displayName: string;
  role: string;
  timestamp: string;
}

export type UserInfoProvider = (userId: string) => Promise<{ displayName: string; username: string } | null>;
