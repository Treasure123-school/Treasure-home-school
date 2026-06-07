import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminDashboardSkeleton } from '@/components/ui/page-skeletons';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { ROLE_IDS } from '@/lib/roles';
import {
  Users, GraduationCap, School, TrendingUp, BarChart3, FileText,
  UserCheck, Shield, BookOpen, MessageSquare, Activity, Clock,
  Circle, Wifi, WifiOff, ArrowRight,
} from 'lucide-react';
import { Link } from 'wouter';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useLoginSuccess } from '@/hooks/use-login-success';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSharedSocket } from '@/hooks/useSocketIORealtime';
import { formatDistanceToNow } from 'date-fns';

interface OnlineUser {
  userId: string;
  role: string;
  displayName: string;
  username: string;
  lastActive: string;
  status: 'online' | 'idle';
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  teacher:    'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60',
  student:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  parent:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin', admin: 'Admin', teacher: 'Teacher',
  student: 'Student', parent: 'Parent',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  useLoginSuccess();

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ['/api/analytics/overview'],
    enabled: !!user,
    refetchInterval: 60000,
  });

  const { data: gradingStats } = useQuery<any>({
    queryKey: ['/api/grading/stats/system'],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: !!user && (user.roleId === ROLE_IDS.ADMIN || user.roleId === ROLE_IDS.SUPER_ADMIN),
  });

  const { data: allExams = [] } = useQuery<any[]>({
    queryKey: ['/api/exams'],
    enabled: !!user,
  });

  // --- Live online users ---
  const { data: initialOnline } = useQuery<OnlineUser[]>({
    queryKey: ['/api/admin/online-users'],
    enabled: !!user,
    refetchInterval: false,
  });
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const socketReadyRef = useRef(false);

  useEffect(() => {
    if (initialOnline) setOnlineUsers(initialOnline);
  }, [initialOnline]);

  const handleOnlineUsers = useCallback((data: OnlineUser[]) => setOnlineUsers(data), []);

  useEffect(() => {
    if (!user) return;
    const socket = getSharedSocket();
    const onConnect = () => setLiveConnected(true);
    const onDisconnect = () => setLiveConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:online_users', handleOnlineUsers);
    if (socket.connected) { setLiveConnected(true); socketReadyRef.current = true; }
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:online_users', handleOnlineUsers);
    };
  }, [user, handleOnlineUsers]);

  const roleDistribution = [
    { name: 'Students', value: allUsers.filter(u => u.roleId === ROLE_IDS.STUDENT).length, color: '#3b82f6' },
    { name: 'Teachers', value: allUsers.filter(u => u.roleId === ROLE_IDS.TEACHER).length, color: '#10b981' },
    { name: 'Parents', value: allUsers.filter(u => u.roleId === ROLE_IDS.PARENT).length, color: '#f59e0b' },
    { name: 'Admins', value: allUsers.filter(u => u.roleId === ROLE_IDS.ADMIN).length, color: '#ef4444' },
  ].filter(item => item.value > 0);

  const quickActions = [
    { title: 'User Management', icon: Users, href: '/portal/admin/users' },
    { title: 'Manage Students', icon: GraduationCap, href: '/portal/admin/students' },
    { title: 'Manage Exams', icon: FileText, href: '/portal/admin/exams' },
    { title: 'Create Class', icon: School, href: '/portal/admin/classes/add' },
    { title: 'Send Announcement', icon: MessageSquare, href: '/portal/admin/announcements/add' },
    { title: 'Generate Report', icon: BarChart3, href: '/portal/admin/reports' },
  ];

  if (!user) return <div className="p-8 text-center">Please log in to access the admin portal.</div>;

  if (analyticsLoading) {
    return <AdminDashboardSkeleton />;
  }

  const isLoading = analyticsLoading;

  return (
    <>
      {/* Admin Role Header */}
      <div
        className="mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-6 text-white shadow-xl"
        data-testid="admin-role-header"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold tracking-tight" data-testid="text-admin-greeting">
                Welcome back, {user.lastName}!
              </h2>
              <p className="text-white/70 text-sm mt-1" data-testid="text-admin-subtitle">
                School Administration Portal
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
        <Card
          className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
          data-testid="stat-total-students"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/85/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Students</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={isLoading ? 0 : (analyticsData?.totalStudents || 0)}
                    className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/90 bg-clip-text text-transparent"
                  />
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Enrolled students</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/85 to-primary text-white shadow-lg">
                <GraduationCap className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
          data-testid="stat-total-teachers"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Teachers</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={isLoading ? 0 : (analyticsData?.totalTeachers || 0)}
                    className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"
                  />
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Active teachers</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
          data-testid="stat-total-classes"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Classes</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={isLoading ? 0 : (analyticsData?.totalClasses || 0)}
                    className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent"
                  />
                  <School className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Active classes</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg">
                <School className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
          data-testid="stat-attendance"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Attendance</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={isLoading ? 0 : (analyticsData?.averageAttendance || 0)}
                    className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent"
                    suffix="%"
                  />
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Average attendance</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 mb-6">
        <Card>
          <CardHeader className="p-4 sm:p-5 md:p-6">
            <CardTitle className="flex items-center text-sm sm:text-base">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Quick Administration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link key={action.title} to={action.href}>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary bg-gradient-to-r hover:from-primary/5 hover:to-transparent group"
                    data-testid={`button-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <action.icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                        {action.title}
                      </span>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Distribution + Live Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Distribution Chart — Redesigned */}
        <Card className="lg:col-span-2 shadow-md border border-border overflow-hidden" data-testid="card-user-distribution">
          {/* Card header with gradient accent */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <BarChart3 className="h-5 w-5" />
              <h3 className="font-semibold text-base">User Distribution</h3>
              <span className="text-indigo-200 text-sm">— by role</span>
            </div>
            <span
              className="bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full border border-white/30"
              data-testid="badge-total-users"
            >
              {allUsers.length} total
            </span>
          </div>

          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut chart with center label */}
              <div className="relative shrink-0 w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistribution.length > 0 ? roleDistribution : [{ name: 'No data', value: 1, color: '#e5e7eb' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={80}
                      paddingAngle={roleDistribution.length > 1 ? 4 : 0}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {(roleDistribution.length > 0 ? roleDistribution : [{ name: 'No data', value: 1, color: '#e5e7eb' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: any, name: any) => [
                        `${value} (${allUsers.length > 0 ? Math.round((value / allUsers.length) * 100) : 0}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-foreground leading-none">{allUsers.length}</span>
                  <span className="text-[11px] text-muted-foreground mt-1 font-medium">Users</span>
                </div>
              </div>

              {/* Per-role breakdown rows */}
              <div className="flex-1 w-full space-y-3">
                {roleDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No users registered yet.</p>
                ) : (
                  roleDistribution.map((role) => {
                    const pct = allUsers.length > 0 ? Math.round((role.value / allUsers.length) * 100) : 0;
                    return (
                      <div key={role.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                            <span className="font-medium text-foreground">{role.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">{pct}%</span>
                            <span className="font-bold text-foreground w-7 text-right">{role.value}</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: role.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Activity Panel + Quick Stats */}
        <div className="space-y-6">
          {/* Who's Online Now */}
          <Card
            className="shadow-sm border border-border bg-gradient-to-br from-green-50 to-white dark:from-green-950/10 dark:to-card"
            data-testid="card-who-is-online"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  Who's Online Now
                </CardTitle>
                <div className="flex items-center gap-2">
                  {liveConnected ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-1 px-1.5 py-0.5 dark:bg-green-900/30 dark:text-green-400">
                      <Wifi className="h-2.5 w-2.5" />
                      Live
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px] gap-1 px-1.5 py-0.5">
                      <WifiOff className="h-2.5 w-2.5" />
                      Off
                    </Badge>
                  )}
                  <span className="text-xl font-bold text-green-600" data-testid="text-online-count-dashboard">
                    {onlineUsers.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {onlineUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No users currently online</p>
              ) : (
                <ul className="space-y-2 mt-1">
                  {onlineUsers.slice(0, 5).map((u) => (
                    <li key={u.userId} className="flex items-center gap-2" data-testid={`dashboard-user-${u.userId}`}>
                      <Circle
                        className={`h-2 w-2 shrink-0 ${u.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-yellow-400 text-yellow-400'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{u.displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(u.lastActive), { addSuffix: true })}
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {onlineUsers.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  +{onlineUsers.length - 5} more user{onlineUsers.length - 5 !== 1 ? 's' : ''}
                </p>
              )}
              <Link to="/portal/admin/online-users">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                  data-testid="button-view-all-online"
                >
                  View full activity
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Stats — enriched */}
          <Card className="shadow-sm border border-border" data-testid="card-quick-stats">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Quick Stats</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              {[
                {
                  label: 'Total Parents',
                  value: allUsers.filter(u => u.roleId === ROLE_IDS.PARENT).length,
                  testId: 'text-total-parents',
                  color: 'text-orange-600',
                },
                {
                  label: 'Student-Teacher Ratio',
                  value: (() => {
                    const t = allUsers.filter(u => u.roleId === ROLE_IDS.TEACHER).length;
                    const s = allUsers.filter(u => u.roleId === ROLE_IDS.STUDENT).length;
                    return t > 0 ? `${Math.round(s / t)}:1` : '—';
                  })(),
                  testId: 'text-student-teacher-ratio',
                  color: 'text-primary',
                },
                {
                  label: 'Pending Grading',
                  value: gradingStats?.pendingCount || 0,
                  testId: 'text-pending-grading',
                  color: gradingStats?.pendingCount > 0 ? 'text-amber-600' : 'text-foreground',
                },
                {
                  label: 'Active Exams',
                  value: allExams.filter((e: any) => e.status === 'published').length,
                  testId: 'text-active-exams',
                  color: allExams.filter((e: any) => e.status === 'published').length > 0 ? 'text-red-600' : 'text-foreground',
                },
                {
                  label: 'Total Exams',
                  value: allExams.length,
                  testId: 'text-total-exams',
                  color: 'text-foreground',
                },
              ].map(({ label, value, testId, color }) => (
                <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={`text-sm font-semibold ${color}`} data-testid={testId}>
                    {value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
