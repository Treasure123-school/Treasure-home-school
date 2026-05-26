import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, BookOpen, Search, UserCheck, MessageSquare,
  ClipboardCheck, Bell, PenTool, TrendingUp, Calendar, Eye,
  GraduationCap, CheckCircle2, XCircle, Clock, Filter,
} from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  profileImageUrl: string | null;
  department: string | null;
}

interface ClassDetail {
  class: {
    id: number;
    name: string;
    level: string;
    capacity?: number;
    classTeacherName: string | null;
  };
  students: Student[];
  subjects: { subjectId: number; subjectName: string }[];
}

interface AttendanceRecord {
  id: number;
  studentId: string;
  date: string;
  status: string;
  notes: string | null;
}

interface Exam {
  id: number;
  name: string;
  date: string;
  totalMarks: number;
  isPublished: boolean;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  publishedAt: string | null;
  priority: string;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant={isActive ? 'default' : 'secondary'}
      className={`text-xs ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
      data-testid={`badge-status-${isActive ? 'active' : 'inactive'}`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function OverviewTab({ classDetail }: { classDetail: ClassDetail }) {
  const [, navigate] = useLocation();
  const cls = classDetail.class;
  const activeStudents = classDetail.students.filter(s => s.isActive).length;
  const totalStudents = classDetail.students.length;

  const quickActions = [
    { label: 'Take Attendance', icon: ClipboardCheck, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800', href: `/portal/teacher/attendance?classId=${cls.id}` },
    { label: 'Create Exam', icon: PenTool, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800', href: `/portal/teacher/exams?openCreate=true&classId=${cls.id}` },
    { label: 'Send Message', icon: MessageSquare, color: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800', href: '/portal/teacher/messages' },
    { label: 'Post Announcement', icon: Bell, color: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800', href: '/portal/teacher/announcements' },
  ];

  const { data: recentExams = [] } = useQuery<Exam[]>({
    queryKey: [`/api/exams?classId=${cls.id}`],
  });
  const { data: recentAnnouncements = [] } = useQuery<Announcement[]>({
    queryKey: ['/api/admin/announcements'],
  });

  const attendanceDate = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${cls.id}`, attendanceDate],
    queryFn: () =>
      fetch(`/api/attendance/class/${cls.id}?date=${attendanceDate}`, {
        credentials: 'include',
      }).then(r => {
        if (!r.ok) return [];
        return r.json().then((d: unknown) => (Array.isArray(d) ? d : []));
      }),
  });

  const presentToday = Array.isArray(todayAttendance)
    ? (todayAttendance as AttendanceRecord[]).filter(a => a.status === 'Present').length
    : 0;
  const attendancePct = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-blue-600' },
          { label: 'Active', value: activeStudents, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Subjects', value: classDetail.subjects.length, icon: BookOpen, color: 'text-purple-600' },
          { label: "Today's Attendance", value: `${attendancePct}%`, icon: ClipboardCheck, color: 'text-orange-600' },
        ].map((stat, i) => (
          <Card key={i} data-testid={`card-stat-${i}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground" data-testid={`text-stat-value-${i}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => navigate(action.href)}
            className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium transition-all ${action.color}`}
            data-testid={`button-quick-action-${i}`}
          >
            <action.icon className="h-5 w-5 flex-shrink-0" />
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PenTool className="h-4 w-4 text-primary" />
              Recent Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentExams as Exam[]).slice(0, 5).length > 0 ? (
              (recentExams as Exam[]).slice(0, 5).map((exam, i) => (
                <div key={exam.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`row-exam-${i}`}>
                  <div>
                    <p className="text-sm font-medium">{exam.name}</p>
                    <p className="text-xs text-muted-foreground">{exam.date} · {exam.totalMarks} marks</p>
                  </div>
                  <Badge variant={exam.isPublished ? 'default' : 'outline'} className="text-xs">
                    {exam.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No exams yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Recent Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentAnnouncements as Announcement[]).slice(0, 5).length > 0 ? (
              (recentAnnouncements as Announcement[]).slice(0, 5).map((ann, i) => (
                <div key={ann.id} className="py-2 border-b last:border-0" data-testid={`row-announcement-${i}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{ann.title}</p>
                    {ann.priority !== 'normal' && (
                      <Badge variant="destructive" className="text-xs flex-shrink-0">{ann.priority}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ann.publishedAt ? format(new Date(ann.publishedAt), 'MMM d, yyyy') : 'Draft'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No announcements yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentsTab({ students }: { students: Student[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [, navigate] = useLocation();

  const filtered = students.filter(s => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && s.isActive) ||
      (statusFilter === 'inactive' && !s.isActive);
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {students.length} students
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No students found</p>
          </div>
        ) : (
          filtered.map((student) => (
            <Card key={student.id} className="overflow-hidden" data-testid={`card-student-${student.id}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {student.profileImageUrl && <AvatarImage src={student.profileImageUrl} />}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {student.firstName[0]}{student.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground" data-testid={`text-student-name-${student.id}`}>
                        {student.firstName} {student.lastName}
                      </span>
                      <StatusBadge isActive={student.isActive} />
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid={`text-admission-${student.id}`}>
                      ID: {student.admissionNumber}
                      {student.department ? ` · ${student.department}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="View Profile"
                      data-testid={`button-view-profile-${student.id}`}
                      onClick={() => navigate(`/portal/teacher/profile-assignments`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Send Message"
                      data-testid={`button-message-${student.id}`}
                      onClick={() => navigate('/portal/teacher/messages')}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function AttendanceTab({ classId }: { classId: number }) {
  const [, navigate] = useLocation();

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

  const { data: history = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${classId}/history`, weekAgo, today],
    queryFn: () =>
      fetch(`/api/attendance/class/${classId}/history?startDate=${weekAgo}&endDate=${today}`, {
        credentials: 'include',
      }).then(r => {
        if (!r.ok) return [];
        return r.json().then((d: unknown) => (Array.isArray(d) ? d : []));
      }),
  });

  const safeHistory = Array.isArray(history) ? history : [];
  const byDate = safeHistory.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    acc[r.date] = acc[r.date] || [];
    acc[r.date].push(r);
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Attendance records for the last 7 days</p>
        <Button
          size="sm"
          onClick={() => navigate(`/portal/teacher/attendance?classId=${classId}`)}
          data-testid="button-take-attendance"
        >
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Take Attendance
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : dates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No attendance records in the last 7 days</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map(date => {
            const records = byDate[date];
            const present = records.filter(r => r.status === 'Present').length;
            const absent = records.filter(r => r.status === 'Absent').length;
            const late = records.filter(r => r.status === 'Late').length;
            const total = records.length;
            const pct = total > 0 ? Math.round((present / total) * 100) : 0;

            return (
              <Card key={date} data-testid={`card-attendance-date-${date}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d')}</p>
                      <p className="text-xs text-muted-foreground">{total} records</p>
                    </div>
                    <div className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                      {pct}%
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{present} present</span>
                    <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3.5 w-3.5" />{absent} absent</span>
                    {late > 0 && <span className="flex items-center gap-1 text-orange-500"><Clock className="h-3.5 w-3.5" />{late} late</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignmentsTab({ classId }: { classId: number }) {
  const [, navigate] = useLocation();

  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: [`/api/exams?classId=${classId}`],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(exams as Exam[]).length} exam{(exams as Exam[]).length !== 1 ? 's' : ''} for this class</p>
        <Button size="sm" onClick={() => navigate(`/portal/teacher/exams?openCreate=true&classId=${classId}`)} data-testid="button-create-exam">
          <PenTool className="h-4 w-4 mr-2" />
          Create Exam
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (exams as Exam[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PenTool className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No exams created yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(exams as Exam[]).map((exam, i) => (
            <Card key={exam.id} data-testid={`card-exam-${exam.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{exam.name}</p>
                  <p className="text-xs text-muted-foreground">{exam.date} · {exam.totalMarks} marks total</p>
                </div>
                <Badge variant={exam.isPublished ? 'default' : 'outline'} className="text-xs flex-shrink-0">
                  {exam.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsTab({ classId }: { classId: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">View detailed results and performance analytics</p>
        <Button size="sm" onClick={() => navigate(`/portal/teacher/results/class/${classId}`)} data-testid="button-view-results">
          <TrendingUp className="h-4 w-4 mr-2" />
          View Full Results
        </Button>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-10 w-10 text-primary mb-3 opacity-60" />
          <h3 className="text-sm font-semibold mb-1">Class Performance</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Access complete exam results, grade distributions, and individual student performance for this class.
          </p>
          <Button onClick={() => navigate(`/portal/teacher/results/class/${classId}`)} data-testid="button-go-to-results">
            Open Results Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeacherClassDetail() {
  const [match, params] = useRoute('/portal/teacher/classes/:classId');
  const classId = parseInt(params?.classId || '0');
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, error } = useQuery<ClassDetail>({
    queryKey: [`/api/teacher/classes/${classId}/detail`],
    enabled: !!classId,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <XCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="font-semibold">Failed to load class</p>
            <p className="text-sm text-muted-foreground mt-1">Could not fetch class details.</p>
            <Link href="/portal/teacher/classes">
              <Button className="mt-4" variant="outline">Back to My Classes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cls = data.class;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground leading-tight" data-testid="heading-class-name">{cls.name}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            {cls.level && <span className="text-xs text-muted-foreground">{cls.level}</span>}
            {cls.classTeacherName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <UserCheck className="h-3 w-3" />
                {cls.classTeacherName}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {data.students.length} students
            </span>
            {data.subjects.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                {data.subjects.map(s => s.subjectName).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full h-auto">
          {[
            { value: 'overview', label: 'Overview', icon: GraduationCap },
            { value: 'students', label: 'Students', icon: Users },
            { value: 'attendance', label: 'Attendance', icon: ClipboardCheck },
            { value: 'assignments', label: 'Exams', icon: PenTool },
            { value: 'results', label: 'Results', icon: TrendingUp },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex flex-col sm:flex-row items-center gap-1 text-xs py-2 px-1"
              data-testid={`tab-${tab.value}`}
            >
              <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-[10px]">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab classDetail={data} />
        </TabsContent>

        <TabsContent value="students">
          <StudentsTab students={data.students} />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab classId={cls.id} />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsTab classId={cls.id} />
        </TabsContent>

        <TabsContent value="results">
          <ResultsTab classId={cls.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
