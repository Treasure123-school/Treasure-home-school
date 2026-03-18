import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users, Wifi, WifiOff, Clock, RefreshCw, Search,
  Circle, Activity, Shield, GraduationCap, BookOpen, UserCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getSharedSocket } from '@/hooks/useSocketIORealtime';
import { formatDistanceToNow } from 'date-fns';

interface OnlineUser {
  userId: string;
  role: string;
  displayName: string;
  username: string;
  email?: string;
  roleId?: number;
  firstConnectedAt: string;
  lastActive: string;
  status: 'online' | 'idle';
  socketCount: number;
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  superadmin:    { label: 'Super Admin', icon: Shield, color: 'text-purple-600' },
  super_admin:   { label: 'Super Admin', icon: Shield, color: 'text-purple-600' },
  'super admin': { label: 'Super Admin', icon: Shield, color: 'text-purple-600' },
  admin:         { label: 'Admin',       icon: Shield, color: 'text-red-600' },
  teacher:       { label: 'Teacher',     icon: BookOpen, color: 'text-blue-600' },
  student:       { label: 'Student',     icon: GraduationCap, color: 'text-green-600' },
  parent:        { label: 'Parent',      icon: UserCheck, color: 'text-orange-600' },
};

function normalizeRoleKey(role: string): string {
  return role.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function RoleBadge({ role }: { role: string }) {
  const key = role.toLowerCase();
  const cfg = ROLE_CONFIG[key] ?? ROLE_CONFIG[normalizeRoleKey(role)] ?? { label: role, icon: Users, color: 'text-gray-600' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: 'online' | 'idle' }) {
  if (status === 'online') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 gap-1">
        <Circle className="h-2 w-2 fill-green-500 text-green-500" />
        Online
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
      <Circle className="h-2 w-2 fill-yellow-400 text-yellow-400" />
      Idle
    </Badge>
  );
}

export default function OnlineUsers() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [search, setSearch] = useState('');
  const enrichedCacheRef = useRef<Map<string, OnlineUser>>(new Map());

  // Periodically refresh from REST API for enriched display names
  const { data: initialData, isLoading, refetch } = useQuery<OnlineUser[]>({
    queryKey: ['/api/admin/online-users'],
    enabled: !!user,
    refetchInterval: 15000, // refresh every 15 seconds
  });

  // Keep enriched cache up to date from REST responses
  useEffect(() => {
    if (!initialData) return;
    initialData.forEach((u) => enrichedCacheRef.current.set(u.userId, u));
    setOnlineUsers(initialData);
  }, [initialData]);

  // Merge live socket update with cached enriched data (display names)
  const handleOnlineUsers = useCallback((data: OnlineUser[]) => {
    const merged = data.map((u) => {
      const cached = enrichedCacheRef.current.get(u.userId);
      return {
        ...u,
        displayName: u.displayName && u.displayName !== u.userId ? u.displayName : (cached?.displayName || u.displayName),
        username: u.username && u.username !== u.userId ? u.username : (cached?.username || u.username),
        email: u.email ?? cached?.email,
        roleId: u.roleId ?? cached?.roleId,
      };
    });
    // Update cache with latest activity data
    merged.forEach((u) => enrichedCacheRef.current.set(u.userId, u));
    setOnlineUsers(merged);
  }, []);

  useEffect(() => {
    const socket = getSharedSocket();

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit('user:heartbeat');
    };
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:online_users', handleOnlineUsers);

    if (socket.connected) {
      setSocketConnected(true);
      socket.emit('user:heartbeat');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:online_users', handleOnlineUsers);
    };
  }, [handleOnlineUsers]);

  if (!user) return <div className="p-8 text-center">Please log in to access this page.</div>;

  const filtered = onlineUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const onlineCount = onlineUsers.filter((u) => u.status === 'online').length;
  const idleCount = onlineUsers.filter((u) => u.status === 'idle').length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="online-users-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-6 w-6 text-red-600" />
            Live User Activity
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time view of currently connected users across all portals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {socketConnected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 dark:bg-green-900/30 dark:text-green-400">
              <Wifi className="h-3.5 w-3.5" />
              Live
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 dark:bg-red-900/30 dark:text-red-400">
              <WifiOff className="h-3.5 w-3.5" />
              Disconnected
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="stat-total-online">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-2.5">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-count">{onlineUsers.length}</p>
                <p className="text-xs text-muted-foreground">Total Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-online">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-2.5">
                <Circle className="h-5 w-5 fill-green-500 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600" data-testid="text-online-count">{onlineCount}</p>
                <p className="text-xs text-muted-foreground">Active Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-idle-online">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-xl p-2.5">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600" data-testid="text-idle-count">{idleCount}</p>
                <p className="text-xs text-muted-foreground">Idle (&gt;3 min)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold">Connected Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, username, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search ? 'No users match your search.' : 'No users are currently online.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Active</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session Start</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tabs</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => (
                    <tr
                      key={u.userId}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`row-user-${u.userId}`}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium leading-tight" data-testid={`text-name-${u.userId}`}>
                              {u.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid={`text-username-${u.userId}`}>
                              @{u.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap" data-testid={`text-last-active-${u.userId}`}>
                        {formatDistanceToNow(new Date(u.lastActive), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap" data-testid={`text-connected-at-${u.userId}`}>
                        {formatDistanceToNow(new Date(u.firstConnectedAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3.5 text-center" data-testid={`text-tabs-${u.userId}`}>
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-semibold">
                          {u.socketCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
          <strong>Online</strong> – active in last 3 minutes
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
          <strong>Idle</strong> – connected but quiet for &gt;3 min
        </span>
        <span className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3" />
          <strong>Tabs</strong> – number of open browser tabs/windows
        </span>
      </div>
    </div>
  );
}
