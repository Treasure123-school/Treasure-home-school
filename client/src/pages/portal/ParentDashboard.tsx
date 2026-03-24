import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Calendar, BookOpen, MessageSquare, Heart, FileText,
  GraduationCap, Bell, TrendingUp, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { Link } from 'wouter';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { ParentDashboardSkeleton } from '@/components/ui/page-skeletons';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useLoginSuccess } from '@/hooks/use-login-success';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isValid } from 'date-fns';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: number | null;
  className: string | null;
}

interface GradeResult {
  id: number;
  examName: string;
  subjectName: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string | null;
  examDate: string | null;
}

interface AttendanceData {
  records: any[];
  summary: { total: number; present: number; absent: number; late: number; excused: number; rate: number };
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  publishedAt: string;
  targetAudience?: string;
}

function gradeColor(percentage: number) {
  if (percentage >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (percentage >= 65) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (percentage >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

function formatDate(str: string | null) {
  if (!str) return '';
  try {
    const d = parseISO(str);
    if (isValid(d)) return format(d, 'MMM d, yyyy');
  } catch {}
  return str;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  useLoginSuccess();

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  const { data: gradesData = [], isLoading: loadingGrades } = useQuery<GradeResult[]>({
    queryKey: ['/api/parent/grades', selectedChildId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/grades/${selectedChildId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedChildId,
  });

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery<AttendanceData>({
    queryKey: ['/api/parent/attendance', selectedChildId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/attendance/${selectedChildId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!selectedChildId,
  });

  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
    enabled: !!user,
  });

  // Real-time subscriptions
  useSocketIORealtime({
    table: 'parent_student_links',
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });
  useSocketIORealtime({
    table: 'exam_results',
    queryKey: ['/api/parent/grades', selectedChildId],
    enabled: !!selectedChildId,
  });
  useSocketIORealtime({
    table: 'attendance',
    queryKey: ['/api/parent/attendance', selectedChildId],
    enabled: !!selectedChildId,
  });
  useSocketIORealtime({
    table: 'announcements',
    queryKey: ['/api/announcements'],
    enabled: !!user,
  });

  if (!user) {
    return <div className="text-center py-12">Please log in to access the parent portal.</div>;
  }

  if (loadingChildren) {
    return <ParentDashboardSkeleton />;
  }

  const avgGPA = gradesData.length > 0
    ? Math.round(gradesData.reduce((s, g) => s + g.percentage, 0) / gradesData.length)
    : 0;
  const attendanceRate = attendanceData?.summary?.rate ?? 0;
  const recentGrades = gradesData.slice(0, 5);

  const quickActions = [
    {
      title: 'My Children',
      description: 'View student profiles',
      icon: Users,
      href: '/portal/parent/children',
      gradient: 'from-blue-500 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20',
    },
    {
      title: 'Report Cards',
      description: 'Download academic reports',
      icon: FileText,
      href: '/portal/parent/reports',
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20',
    },
    {
      title: 'Attendance',
      description: 'Track daily attendance',
      icon: Calendar,
      href: '/portal/parent/attendance',
      gradient: 'from-orange-500 to-amber-600',
      bgGradient: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20',
    },
    {
      title: 'Grades',
      description: 'View exam results',
      icon: BookOpen,
      href: '/portal/parent/grades',
      gradient: 'from-purple-500 to-violet-600',
      bgGradient: 'from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/20',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="page-parent-dashboard">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 rounded-2xl p-6 text-white shadow-xl" data-testid="parent-role-header">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
            <Heart className="h-10 w-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user.firstName}!</h2>
            <p className="text-amber-100 text-sm mt-0.5">Stay connected with your child's education</p>
          </div>
        </div>
      </div>

      {/* Child Selector */}
      {children.length > 0 && (
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="bg-blue-600 p-3 rounded-xl flex-shrink-0">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">
                    {children.length === 1 ? 'Viewing records for your child' : `Viewing ${children.length} children`}
                  </h3>
                  <p className="text-sm text-muted-foreground">Select a child to see their specific details below</p>
                </div>
              </div>
              {children.length > 1 && (
                <Select value={selectedChildId} onValueChange={setSelectedChildId} data-testid="select-child">
                  <SelectTrigger className="w-full sm:w-[260px] bg-white dark:bg-gray-900 border-2 border-blue-300 dark:border-blue-700">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.firstName} {c.lastName}</span>
                          <span className="text-xs text-muted-foreground">({c.admissionNumber})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!loadingChildren && children.length === 0 && (
        <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-6 text-center">
            <Bell className="h-12 w-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-orange-900 dark:text-orange-200 mb-2">No Children Linked</h3>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Your account has not been linked to any student records yet.
              Please contact the school administrator.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border-none shadow-lg" data-testid="stat-children">
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs font-medium">Children</p>
                <AnimatedCounter value={children.length} className="text-3xl font-bold mt-1" />
                <p className="text-blue-100 text-xs mt-1">Enrolled</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl"><Users className="h-7 w-7 text-white" /></div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-none shadow-lg" data-testid="stat-attendance">
          <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">Attendance</p>
                {loadingAttendance ? (
                  <div className="h-8 w-16 bg-white/20 rounded mt-1 animate-pulse" />
                ) : (
                  <AnimatedCounter value={attendanceRate} suffix="%" className="text-3xl font-bold mt-1" />
                )}
                <p className="text-emerald-100 text-xs mt-1">{selectedChild?.firstName ?? 'Selected child'}</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl"><Calendar className="h-7 w-7 text-white" /></div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-none shadow-lg" data-testid="stat-avg-score">
          <div className="bg-gradient-to-br from-purple-500 via-violet-600 to-purple-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs font-medium">Avg. Score</p>
                {loadingGrades ? (
                  <div className="h-8 w-16 bg-white/20 rounded mt-1 animate-pulse" />
                ) : (
                  <AnimatedCounter value={avgGPA} suffix="%" className="text-3xl font-bold mt-1" />
                )}
                <p className="text-purple-100 text-xs mt-1">{gradesData.length} results</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl"><TrendingUp className="h-7 w-7 text-white" /></div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-none shadow-lg" data-testid="stat-announcements">
          <div className="bg-gradient-to-br from-amber-500 via-orange-600 to-red-500 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs font-medium">Announcements</p>
                <AnimatedCounter value={announcements.length} className="text-3xl font-bold mt-1" />
                <p className="text-amber-100 text-xs mt-1">School updates</p>
              </div>
              <div className="p-2.5 bg-white/20 rounded-xl"><Bell className="h-7 w-7 text-white" /></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.title} href={action.href}>
              <Card className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 border-0 overflow-hidden h-full bg-gradient-to-br ${action.bgGradient}`}>
                <CardContent className="p-5">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg mb-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">{action.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades */}
        <Card className="shadow-sm" data-testid="card-recent-grades">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recent Grades
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/parent/grades">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingGrades ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : recentGrades.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No exam results yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentGrades.map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30" data-testid={`grade-item-${g.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.subjectName}</p>
                      <p className="text-xs text-muted-foreground truncate">{g.examName}</p>
                      {g.examDate && <p className="text-xs text-muted-foreground">{formatDate(g.examDate)}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm font-bold text-muted-foreground">{g.score}/{g.maxScore}</span>
                      <Badge className={`${gradeColor(g.percentage)} border-0 text-xs`}>
                        {g.grade ?? `${g.percentage}%`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card className="shadow-sm" data-testid="card-attendance-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance Summary
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/parent/attendance">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : !attendanceData ? (
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No attendance data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Present', value: attendanceData.summary.present, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
                  { label: 'Absent', value: attendanceData.summary.absent, icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
                  { label: 'Late', value: attendanceData.summary.late, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${bg}`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${color}`}>{value}</span>
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                ))}
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Attendance Rate</span>
                    <span className="font-bold text-primary">{attendanceData.summary.rate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700"
                      style={{ width: `${attendanceData.summary.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card className="shadow-sm" data-testid="card-announcements">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" />
            School Announcements
            <Badge variant="secondary" className="ml-auto">{announcements.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAnnouncements ? (
            <div className="p-4 space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements at this time</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {announcements.slice(0, 5).map((a, i) => (
                <div key={a.id} className={`px-5 py-4 hover:bg-muted/30 border-l-4 ${i % 2 === 0 ? 'border-l-primary' : 'border-l-orange-400'}`} data-testid={`announcement-${a.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                    </div>
                    {a.publishedAt && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatDate(a.publishedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
