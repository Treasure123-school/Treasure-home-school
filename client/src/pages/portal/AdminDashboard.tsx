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
} from 'lucide-react';
import { Link } from 'wouter';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useLoginSuccess } from '@/hooks/use-login-success';

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
        className="mb-6 bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl"
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
              <p className="text-red-100 text-sm mt-1" data-testid="text-admin-subtitle">
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Students</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter
                    value={isLoading ? 0 : (analyticsData?.totalStudents || 0)}
                    className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"
                  />
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Enrolled students</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
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
        {/* User Distribution Chart */}
        <Card className="lg:col-span-2 shadow-sm border border-border" data-testid="card-user-distribution">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              User Distribution
            </CardTitle>
            <Badge variant="secondary" data-testid="badge-total-users">
              Total: {allUsers.length}
            </Badge>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Live Overview + Quick Stats */}
        <div className="space-y-6">
          <Card
            className="shadow-sm border border-border bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-card"
            data-testid="card-live-overview"
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-500" />
                Live Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold" data-testid="text-pending-grading">
                    {gradingStats?.pendingCount || 0}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">Pending Grading</p>
                </div>
                <FileText className="h-8 w-8 text-indigo-200" />
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-1">
                  <p className="text-2xl font-bold" data-testid="text-active-users">
                    {allUsers.filter(u => u.status === 'active').length}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">Active Users</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border border-border" data-testid="card-quick-stats">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Term Week</span>
                  <span className="text-sm font-medium">Week 4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Exams</span>
                  <span className="text-sm font-medium" data-testid="text-active-exams">
                    {allExams.filter((e: any) => e.status === 'published').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
