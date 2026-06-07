import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Wifi, WifiOff, Clock, RefreshCw, Search,
  Circle, Activity, Shield, GraduationCap, BookOpen, UserCheck,
  LogIn, LogOut, AlertCircle, Zap, Filter,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getSharedSocket } from '@/hooks/useSocketIORealtime';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnlineUser {
  userId: string;
  role: string;
  displayName: string;
  username: string;
  email?: string;
  roleId?: number;
  firstConnectedAt: string;
  lastActive: string;
  loginAt?: string;
  status: 'online' | 'idle';
  socketCount: number;
  className?: string;
  classId?: number;
}

interface ActivityFeedEvent {
  id: string;
  type: 'login' | 'logout' | 'idle' | 'active';
  userId: string;
  displayName: string;
  role: string;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  superadmin:    { label: 'Super Admin', icon: Shield,        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  super_admin:   { label: 'Super Admin', icon: Shield,        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  'super admin': { label: 'Super Admin', icon: Shield,        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  admin:         { label: 'Admin',       icon: Shield,        color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/30' },
  teacher:       { label: 'Teacher',     icon: BookOpen,      color: 'text-primary dark:text-primary/70',  bg: 'bg-primary/10 dark:bg-primary/5' },
  student:       { label: 'Student',     icon: GraduationCap, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  parent:        { label: 'Parent',      icon: UserCheck,     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
};

function normalizeRole(role: string): string {
  return role.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function getRoleCfg(role: string) {
  const key = role.toLowerCase();
  return (
    ROLE_CONFIG[key] ??
    ROLE_CONFIG[normalizeRole(role)] ??
    { label: role, icon: Users, color: 'text-gray-600', bg: 'bg-gray-100' }
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try { return format(new Date(iso), 'h:mm a'); } catch { return '—'; }
}

function fmtRelative(iso: string): string {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function fmtDuration(isoStart: string): string {
  try {
    const ms = Date.now() - new Date(isoStart).getTime();
    if (ms < 0) return '0s';
    const secs = Math.floor(ms / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  } catch { return '—'; }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg = getRoleCfg(role);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status: 'online' | 'idle' }) {
  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
      <Circle className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
      Idle
    </span>
  );
}

function AvatarIcon({ name, role }: { name: string; role: string }) {
  const cfg = getRoleCfg(role);
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cfg.bg} ${cfg.color}`}>
      {initials}
    </div>
  );
}

// Live-ticking session duration cell
function SessionDuration({ startIso }: { startIso: string }) {
  const [dur, setDur] = useState(() => fmtDuration(startIso));
  useEffect(() => {
    const id = setInterval(() => setDur(fmtDuration(startIso)), 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return <span className="tabular-nums font-mono text-xs">{dur}</span>;
}

// Live-ticking relative time
function RelativeTime({ iso }: { iso: string }) {
  const [rel, setRel] = useState(() => fmtRelative(iso));
  useEffect(() => {
    const id = setInterval(() => setRel(fmtRelative(iso)), 10000);
    return () => clearInterval(id);
  }, [iso]);
  return <span>{rel}</span>;
}

// Activity feed event row
const FEED_ICONS: Record<ActivityFeedEvent['type'], { icon: typeof LogIn; color: string; label: string }> = {
  login:  { icon: LogIn,       color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',  label: 'signed in' },
  logout: { icon: LogOut,      color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',          label: 'signed out' },
  idle:   { icon: Clock,       color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'went idle' },
  active: { icon: Zap,         color: 'text-primary bg-primary/10 dark:bg-primary/5 dark:text-primary/70',      label: 'became active' },
};

function FeedRow({ event }: { event: ActivityFeedEvent }) {
  const cfg = FEED_ICONS[event.type];
  const Icon = cfg.icon;
  const roleCfg = getRoleCfg(event.role);
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0 border-border/50" data-testid={`feed-event-${event.id}`}>
      <div className={`mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center ${cfg.color}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-snug">
          <span className={`font-semibold ${roleCfg.color}`}>{event.displayName}</span>
          {' '}
          <span className="text-muted-foreground">{cfg.label}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {fmtTime(event.timestamp)} · <RelativeTime iso={event.timestamp} />
        </p>
      </div>
    </div>
  );
}

// ─── Role summary counts ──────────────────────────────────────────────────────

function countByRole(users: OnlineUser[], ...keys: string[]) {
  return users.filter(u => keys.includes(normalizeRole(u.role))).length;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OnlineUsers() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEvent[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [, tick] = useState(0); // forces re-render for live durations
  const enrichedCacheRef = useRef<Map<string, OnlineUser>>(new Map());

  // Force re-render every second for live session durations
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // REST polling: enriched data (display names, class, loginAt)
  const { data: initialData, isLoading, refetch } = useQuery<OnlineUser[]>({
    queryKey: ['/api/admin/online-users'],
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Initial activity feed from REST
  const { data: initialFeed } = useQuery<ActivityFeedEvent[]>({
    queryKey: ['/api/admin/activity-feed'],
    enabled: !!user,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!initialData) return;
    initialData.forEach(u => enrichedCacheRef.current.set(u.userId, u));
    setOnlineUsers(initialData);
  }, [initialData]);

  useEffect(() => {
    if (initialFeed && activityFeed.length === 0) setActivityFeed(initialFeed);
  }, [initialFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnlineUsers = useCallback((data: OnlineUser[]) => {
    const merged = data.map(u => {
      const cached = enrichedCacheRef.current.get(u.userId);
      return {
        ...u,
        displayName: (u.displayName && u.displayName !== u.userId) ? u.displayName : (cached?.displayName ?? u.displayName),
        username: (u.username && u.username !== u.userId) ? u.username : (cached?.username ?? u.username),
        email: u.email ?? cached?.email,
        roleId: u.roleId ?? cached?.roleId,
        loginAt: u.loginAt ?? cached?.loginAt ?? u.firstConnectedAt,
        className: u.className ?? cached?.className,
        classId: u.classId ?? cached?.classId,
      };
    });
    merged.forEach(u => enrichedCacheRef.current.set(u.userId, u));
    setOnlineUsers(merged);
  }, []);

  const handleActivityFeed = useCallback((feed: ActivityFeedEvent[]) => {
    setActivityFeed(feed);
  }, []);

  useEffect(() => {
    const socket = getSharedSocket();
    const onConnect = () => { setSocketConnected(true); socket.emit('user:heartbeat'); };
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:online_users', handleOnlineUsers);
    socket.on('admin:activity_feed', handleActivityFeed);

    if (socket.connected) { setSocketConnected(true); socket.emit('user:heartbeat'); }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:online_users', handleOnlineUsers);
      socket.off('admin:activity_feed', handleActivityFeed);
    };
  }, [handleOnlineUsers, handleActivityFeed]);

  if (!user) return <div className="p-8 text-center">Please log in to access this page.</div>;

  // ── Derived counts ──────────────────────────────────────────────────────────
  const totalOnline   = onlineUsers.length;
  const onlineCount   = onlineUsers.filter(u => u.status === 'online').length;
  const idleCount     = onlineUsers.filter(u => u.status === 'idle').length;
  const studentCount  = countByRole(onlineUsers, 'student', 'stu');
  const teacherCount  = countByRole(onlineUsers, 'teacher', 'tch');
  const adminCount    = countByRole(onlineUsers, 'admin', 'super_admin', 'superadmin', 'adm', 'sup');
  const parentCount   = countByRole(onlineUsers, 'parent', 'par');

  // ── Available classes for filter ────────────────────────────────────────────
  const availableClasses = Array.from(
    new Map(
      onlineUsers
        .filter(u => u.className && u.classId)
        .map(u => [u.classId!, u.className!])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = onlineUsers.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
    const matchRole   = filterRole === 'all' || normalizeRole(u.role) === filterRole || u.role.toLowerCase() === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    const matchClass  = filterClass === 'all' || String(u.classId) === filterClass;
    return matchSearch && matchRole && matchStatus && matchClass;
  });

  const hasFilters = search || filterRole !== 'all' || filterStatus !== 'all' || filterClass !== 'all';

  const clearFilters = () => { setSearch(''); setFilterRole('all'); setFilterStatus('all'); setFilterClass('all'); };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto" data-testid="online-users-page">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-6 w-6 text-red-600" />
            Live Activity Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time view of connected users — updates automatically every second
          </p>
        </div>
        <div className="flex items-center gap-3">
          {socketConnected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-live">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 dark:bg-red-900/30 dark:text-red-400" data-testid="badge-disconnected">
              <WifiOff className="h-3.5 w-3.5" />
              Disconnected
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="col-span-2 sm:col-span-1 lg:col-span-2" data-testid="stat-total">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 dark:bg-primary/5 rounded-xl p-2.5 shrink-0">
                <Users className="h-5 w-5 text-primary dark:text-primary/70" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums" data-testid="text-total-count">{totalOnline}</p>
                <p className="text-xs text-muted-foreground">Total Connected</p>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                {onlineCount} online
              </span>
              <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400 font-medium">
                <Circle className="h-2 w-2 fill-yellow-400 text-yellow-400" />
                {idleCount} idle
              </span>
            </div>
          </CardContent>
        </Card>

        {[
          { label: 'Students',  count: studentCount,  icon: GraduationCap, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', testId: 'stat-students' },
          { label: 'Teachers',  count: teacherCount,  icon: BookOpen,      color: 'text-primary dark:text-primary/70',   bg: 'bg-primary/10 dark:bg-primary/5',   testId: 'stat-teachers' },
          { label: 'Admins',    count: adminCount,    icon: Shield,        color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-900/30',     testId: 'stat-admins' },
          { label: 'Parents',   count: parentCount,   icon: UserCheck,     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', testId: 'stat-parents' },
        ].map(({ label, count, icon: Icon, color, bg, testId }) => (
          <Card key={label} data-testid={testId}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`${bg} rounded-lg p-2 shrink-0`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold tabular-nums ${color}`} data-testid={`text-count-${label.toLowerCase()}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main content: table + feed ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* Users table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold">
                Connected Users
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
              </CardTitle>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs" data-testid="button-clear-filters">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  Clear filters
                </Button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name or username…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="input-search-users"
                />
              </div>

              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-filter-role">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="super_admin">Super Admins</SelectItem>
                  <SelectItem value="parent">Parents</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[120px] text-sm" data-testid="select-filter-status">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                </SelectContent>
              </Select>

              {availableClasses.length > 0 && (
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className="h-8 w-[140px] text-sm" data-testid="select-filter-class">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {availableClasses.map(([id, name]) => (
                      <SelectItem key={id} value={String(id)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Users className="h-10 w-10 opacity-30" />
                <p className="text-sm">
                  {hasFilters ? 'No users match your filters.' : 'No users are currently online.'}
                </p>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">User</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Role</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Login Time</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Last Active</th>
                      <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Duration</th>
                      <th className="text-center px-3 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Sessions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(u => {
                      const loginIso = u.loginAt ?? u.firstConnectedAt;
                      return (
                        <tr
                          key={u.userId}
                          className="hover:bg-muted/30 transition-colors"
                          data-testid={`row-user-${u.userId}`}
                        >
                          {/* User cell */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <AvatarIcon name={u.displayName} role={u.role} />
                              <div className="min-w-0">
                                <p className="font-semibold leading-tight truncate" data-testid={`text-name-${u.userId}`}>
                                  {u.displayName}
                                </p>
                                <p className="text-xs text-muted-foreground" data-testid={`text-username-${u.userId}`}>
                                  @{u.username}
                                  {u.className && (
                                    <span className="ml-1.5 text-green-700 dark:text-green-400 font-medium">· {u.className}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-3 py-3">
                            <RoleBadge role={u.role} />
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <StatusDot status={u.status} />
                          </td>

                          {/* Login time */}
                          <td className="px-3 py-3 whitespace-nowrap" data-testid={`text-login-${u.userId}`}>
                            <p className="font-medium tabular-nums">{fmtTime(loginIso)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(loginIso), 'MMM d')}
                            </p>
                          </td>

                          {/* Last active */}
                          <td className="px-3 py-3 whitespace-nowrap" data-testid={`text-last-active-${u.userId}`}>
                            <p className="font-medium tabular-nums">{fmtTime(u.lastActive)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              <RelativeTime iso={u.lastActive} />
                            </p>
                          </td>

                          {/* Session duration */}
                          <td className="px-3 py-3 whitespace-nowrap" data-testid={`text-duration-${u.userId}`}>
                            <SessionDuration startIso={loginIso} />
                          </td>

                          {/* Tabs */}
                          <td className="px-3 py-3 text-center" data-testid={`text-tabs-${u.userId}`}>
                            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-muted text-xs font-semibold tabular-nums">
                              {u.socketCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Activity Feed ─────────────────────────────────────────────────── */}
        <Card className="flex flex-col max-h-[600px] xl:max-h-none">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Activity Feed
              {activityFeed.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">{activityFeed.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 px-4 pb-4 flex-1 overflow-y-auto" data-testid="activity-feed">
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30" />
                <p className="text-xs">No activity yet</p>
              </div>
            ) : (
              <div>
                {activityFeed.map(event => (
                  <FeedRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground px-1 pb-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
          <strong>Online</strong> — active in the last 3 minutes
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
          <strong>Idle</strong> — connected but quiet for &gt;3 min
        </span>
        <span className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3" />
          <strong>Sessions</strong> — active socket connections (approx. open tabs)
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <strong>Duration</strong> — time since login (live)
        </span>
      </div>
    </div>
  );
}
