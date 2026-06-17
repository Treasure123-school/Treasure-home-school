import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, SearchInput, StatusBadge as SharedStatusBadge } from "@/components/shared";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, UserCheck, UserX, Clock, TrendingUp, AlertTriangle,
  Download, Filter, ChevronRight, BarChart2, List,
  RefreshCw, Edit2, CheckCircle, XCircle, AlertCircle, Bell,
  BookOpen, ShieldCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  STATUS_CONFIG, ATTENDANCE_STATUSES,
  pctColor, pctBarColor, formatTimestamp, todayISO, exportToCSV,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

// ─── Safe fetch helper (never throws — returns null on any error) ─────────────

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassBreakdown {
  classId: number;
  className: string;
  level: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
  hasAttendance: boolean;
  recordedBy: string | null;
  recordedAt: string | null;
}

interface Overview {
  date: string;
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  attendancePercentage: number;
  classBreakdown: ClassBreakdown[];
}

interface AttendanceRecord {
  id: number;
  studentId: string;
  classId: number;
  date: string;
  status: string;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

interface TrendPoint {
  period: string;
  label: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SummaryCards({ overview, loading }: { overview?: Overview; loading: boolean }) {
  const pct = overview?.attendancePercentage ?? 0;
  const items = [
    { label: 'Total Students', value: overview?.totalStudents ?? 0, icon: Users, color: 'text-primary' },
    { label: 'Present', value: overview?.totalPresent ?? 0, icon: UserCheck, color: 'text-green-600', sub: overview?.totalLate ? `+${overview.totalLate} late` : undefined },
    { label: 'Absent', value: overview?.totalAbsent ?? 0, icon: UserX, color: 'text-red-500', sub: overview?.totalExcused ? `${overview.totalExcused} excused` : undefined },
    { label: 'Rate', value: `${pct}%`, icon: TrendingUp, color: pct >= 80 ? 'text-green-600' : 'text-red-500', sub: `${overview?.classBreakdown?.filter(c => c.hasAttendance).length ?? 0}/${overview?.classBreakdown?.length ?? 0} classes recorded` },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <Card key={item.label} data-testid={`card-stat-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type Tab = 'summary' | 'details' | 'trends' | 'alerts';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendanceManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayISO);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [summarySearch, setSummarySearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [trendView, setTrendView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [detailClassId, setDetailClassId] = useState('');
  const [detailStudentSearch, setDetailStudentSearch] = useState('');
  const [detailStatusFilter, setDetailStatusFilter] = useState('all');
  const [editRecord, setEditRecord] = useState<{
    id: number; studentName: string; currentStatus: string; notes: string;
  } | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<Overview | null>({
    queryKey: ['/api/attendance/overview', date],
    queryFn: () => safeFetch<Overview | null>(`/api/attendance/overview?date=${date}`, null),
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: () => safeFetch<any[]>('/api/classes', []),
    enabled: !!user,
  });

  const { data: detailAttendance = [], isLoading: detailLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['/api/attendance/class', detailClassId, date],
    queryFn: () => safeFetch<AttendanceRecord[]>(`/api/attendance/class/${detailClassId}?date=${date}`, []),
    enabled: !!detailClassId && !!date,
  });

  const { data: allStudentsRaw = [], isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: ['/api/students'],
    queryFn: () => safeFetch<any[]>('/api/students', []),
    enabled: !!user,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<{ data: TrendPoint[] } | null>({
    queryKey: ['/api/attendance/trends', trendView, classFilter !== 'all' ? classFilter : ''],
    queryFn: () => {
      const params = new URLSearchParams({ view: trendView });
      if (classFilter !== 'all') params.set('classId', classFilter);
      return safeFetch<{ data: TrendPoint[] } | null>(`/api/attendance/trends?${params}`, null);
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/class', detailClassId, date] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/overview', date] });
      setEditRecord(null);
      toast({ title: 'Updated', description: 'Attendance record updated successfully.' });
    },
    onError: (err: any) =>
      toast({ title: 'Update Failed', description: err.message || 'Could not update record.', variant: 'destructive' }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const detailStudents = useMemo<Student[]>(() => {
    if (!detailClassId) return [];
    return allStudentsRaw
      .filter((s: any) => String(s.classId) === detailClassId)
      .map((s: any) => ({
        id: s.id,
        firstName: s.user?.firstName ?? s.firstName ?? '',
        lastName: s.user?.lastName ?? s.lastName ?? '',
        admissionNumber: s.admissionNumber ?? s.id,
      }));
  }, [allStudentsRaw, detailClassId]);

  const attendanceMap = useMemo(() => {
    const m: Record<string, AttendanceRecord> = {};
    detailAttendance.forEach(a => { m[a.studentId] = a; });
    return m;
  }, [detailAttendance]);

  const filteredSummaryClasses = useMemo(() => {
    let list = overview?.classBreakdown ?? [];
    if (classFilter !== 'all') list = list.filter(c => c.classId === parseInt(classFilter));
    if (summarySearch) list = list.filter(c => c.className.toLowerCase().includes(summarySearch.toLowerCase()));
    return list;
  }, [overview, classFilter, summarySearch]);

  const filteredDetailStudents = useMemo(() => {
    let list = detailStudents;
    if (detailStudentSearch) {
      const q = detailStudentSearch.toLowerCase();
      list = list.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q)
      );
    }
    if (detailStatusFilter !== 'all') {
      list = list.filter(s => {
        const rec = attendanceMap[s.id];
        if (detailStatusFilter === 'unmarked') return !rec;
        return rec?.status === detailStatusFilter;
      });
    }
    return list;
  }, [detailStudents, detailStudentSearch, detailStatusFilter, attendanceMap]);

  const alertClasses = useMemo(() =>
    (overview?.classBreakdown ?? []).filter(c => c.hasAttendance && c.attendancePercentage < 80),
    [overview]
  );

  const noRecordClasses = useMemo(() =>
    (overview?.classBreakdown ?? []).filter(c => !c.hasAttendance),
    [overview]
  );

  const trendPoints = trendsData?.data ?? [];
  const avgTrend = trendPoints.length
    ? Math.round(trendPoints.reduce((s, p) => s + p.percentage, 0) / trendPoints.length)
    : 0;

  const handleExportSummary = () =>
    exportToCSV(
      (overview?.classBreakdown ?? []).map(c => ({
        Class: c.className, Level: c.level,
        'Total Students': c.totalStudents, Present: c.present,
        Absent: c.absent, Late: c.late, Excused: c.excused,
        'Attendance %': c.attendancePercentage,
        'Recorded By': c.recordedBy ?? '', 'Recorded At': formatTimestamp(c.recordedAt),
      })),
      `attendance-summary-${date}.csv`
    );

  const handleExportDetail = () =>
    exportToCSV(
      detailStudents.map(s => {
        const rec = attendanceMap[s.id];
        return {
          Name: `${s.firstName} ${s.lastName}`, 'Admission No': s.admissionNumber,
          Status: rec?.status ?? 'Not Marked', Notes: rec?.notes ?? '',
        };
      }),
      `attendance-detail-${detailClassId}-${date}.csv`
    );

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in.</div>;

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'summary', label: 'Summary', icon: List },
    { id: 'details', label: 'Details', icon: BookOpen },
    { id: 'trends', label: 'Trends', icon: BarChart2 },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertClasses.length || undefined },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <PageHeader
        title="Attendance Management"
        description="School-wide attendance overview and controls"
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-auto text-sm h-9"
              data-testid="input-date-picker"
            />
            <Button variant="outline" size="sm" onClick={() => refetchOverview()} className="h-9" title="Refresh" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSummary} className="h-9 gap-1.5" data-testid="button-export">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        }
      />

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <SummaryCards overview={overview ?? undefined} loading={overviewLoading} />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList className="w-full">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} data-testid={`tab-${tab.id}`} className="flex-1 flex items-center justify-center gap-1">
              <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge ? (
                <span className="h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ══════════ TAB: SUMMARY ══════════ */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput
                  placeholder="Search classes..."
                  value={summarySearch}
                  onChange={setSummarySearch}
                  className="flex-1"
                  data-testid="input-search-classes"
                />
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-auto sm:w-44 h-9 text-sm" data-testid="select-class-filter">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {overviewLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : filteredSummaryClasses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
                <p className="font-semibold text-muted-foreground">No class data available</p>
                <p className="text-sm text-muted-foreground mt-1">Attendance hasn't been recorded for {date} yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  Class Overview — {date}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Students</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Present</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Absent</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Late</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Recorded By</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredSummaryClasses.map(cls => (
                        <tr
                          key={cls.classId}
                          className={`hover:bg-muted/40 transition-colors ${!cls.hasAttendance ? 'opacity-60' : ''}`}
                          data-testid={`row-class-${cls.classId}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{cls.className}</p>
                            <p className="text-xs text-muted-foreground">{cls.level}</p>
                          </td>
                          <td className="px-3 py-3 text-center text-muted-foreground text-sm">{cls.totalStudents}</td>
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            <span className="text-green-600 font-medium text-sm">{cls.present}</span>
                          </td>
                          <td className="px-3 py-3 text-center hidden sm:table-cell">
                            <span className={`font-medium text-sm ${cls.absent > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{cls.absent}</span>
                          </td>
                          <td className="px-3 py-3 text-center hidden md:table-cell">
                            <span className={`font-medium text-sm ${cls.late > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>{cls.late}</span>
                          </td>
                          <td className="px-3 py-3">
                            {cls.hasAttendance ? (
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${cls.attendancePercentage}%`, backgroundColor: pctBarColor(cls.attendancePercentage) }} />
                                </div>
                                <span className={`text-xs font-bold ${pctColor(cls.attendancePercentage)}`}>{cls.attendancePercentage}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not recorded</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">{cls.recordedBy ?? '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                              title="View details"
                              data-testid={`button-view-${cls.classId}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-border/50">
                  {filteredSummaryClasses.map(cls => (
                    <div key={cls.classId} className={`p-4 ${!cls.hasAttendance ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{cls.className}</p>
                          <p className="text-xs text-muted-foreground">{cls.level} · {cls.totalStudents} students</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cls.hasAttendance
                            ? <span className={`text-sm font-bold ${pctColor(cls.attendancePercentage)}`}>{cls.attendancePercentage}%</span>
                            : <span className="text-xs text-muted-foreground italic">No record</span>}
                          <button
                            onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {cls.hasAttendance && (
                        <div className="flex gap-3 text-xs mt-1.5">
                          <span className="text-green-600">{cls.present} present</span>
                          <span className="text-red-500">{cls.absent} absent</span>
                          {cls.late > 0 && <span className="text-orange-500">{cls.late} late</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ TAB: DETAILS ══════════ */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={detailClassId}
                  onValueChange={v => { setDetailClassId(v); setDetailStudentSearch(''); setDetailStatusFilter('all'); }}
                >
                  <SelectTrigger className="flex-1" data-testid="select-detail-class">
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-auto sm:w-40 h-9"
                />
                {detailClassId && (
                  <Button variant="outline" size="sm" onClick={handleExportDetail} className="h-9 gap-1.5" data-testid="button-export-detail">
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {!detailClassId ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
                <p className="font-semibold text-muted-foreground">Select a class to view attendance</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {classes.find((c: any) => String(c.id) === detailClassId)?.name ?? 'Class'} — {date}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <SearchInput
                      placeholder="Search students..."
                      value={detailStudentSearch}
                      onChange={setDetailStudentSearch}
                      className="w-full sm:w-48"
                      data-testid="input-search-students"
                    />
                    <Select value={detailStatusFilter} onValueChange={setDetailStatusFilter}>
                      <SelectTrigger className="w-full sm:w-36 h-9 text-sm" data-testid="select-status-filter">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {ATTENDANCE_STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                        <SelectItem value="unmarked">Not Marked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="p-0">
                {detailLoading || studentsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                  </div>
                ) : filteredDetailStudents.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                    <p className="text-sm text-muted-foreground">No students match your filters</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 px-4">
                    {filteredDetailStudents.map(student => {
                      const rec = attendanceMap[student.id];
                      return (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-4 px-4 transition-colors"
                          data-testid={`row-student-${student.id}`}
                        >
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                          </div>
                          <div className="hidden sm:block w-28 text-center">
                            <SharedStatusBadge status={rec?.status ?? ''} />
                          </div>
                          <div className="hidden md:block w-32">
                            <p className="text-xs text-muted-foreground truncate">{rec?.notes ?? '—'}</p>
                          </div>
                          {rec && (
                            <button
                              onClick={() => {
                                setEditRecord({ id: rec.id, studentName: `${student.firstName} ${student.lastName}`, currentStatus: rec.status, notes: rec.notes ?? '' });
                                setEditStatus(rec.status);
                                setEditNotes(rec.notes ?? '');
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                              title="Edit record"
                              data-testid={`button-edit-${student.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer summary */}
                {detailAttendance.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-border bg-muted/30">
                    {ATTENDANCE_STATUSES.map(s => {
                      const count = detailAttendance.filter(a => a.status === s).length;
                      return (
                        <span key={s} className={`text-xs font-semibold ${STATUS_CONFIG[s].color}`}>
                          {s}: {count}
                        </span>
                      );
                    })}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredDetailStudents.length} of {detailStudents.length} shown
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ TAB: TRENDS ══════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  {(['daily', 'weekly', 'monthly'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setTrendView(v)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                        trendView === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                      data-testid={`button-trend-${v}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-auto sm:w-44 h-9 text-sm">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {trendPoints.length > 0 && (
                  <div className="sm:ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Average:</span>
                    <span className={`text-sm font-bold ${pctColor(avgTrend)}`}>{avgTrend}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                Attendance Rate — {trendView === 'daily' ? 'Last 14 Days' : trendView === 'weekly' ? 'Last 8 Weeks' : 'Last 6 Months'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground animate-pulse">Loading trends...</p>
                </div>
              ) : trendPoints.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <BarChart2 className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No attendance data for the selected period.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={trendPoints} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        formatter={(value: any) => [`${value}%`, 'Attendance Rate']}
                        labelStyle={{ fontSize: 12, fontWeight: 600 }}
                        contentStyle={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                      />
                      <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {trendPoints.map((entry, i) => (
                          <Cell key={i} fill={pctBarColor(entry.percentage)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
                    {[
                      { color: 'bg-green-500', label: '≥ 90% Excellent' },
                      { color: 'bg-amber-500', label: '75–89% Good' },
                      { color: 'bg-red-500', label: '< 75% Low' },
                    ].map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-sm ${color} inline-block`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {trendPoints.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Period Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {['Period', 'Present', 'Absent', 'Late', 'Total', 'Rate'].map((h, i) => (
                          <th key={i} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-center'} ${i === 3 ? 'hidden sm:table-cell' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {[...trendPoints].reverse().map((p, i) => (
                        <tr key={i} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-foreground font-medium">{p.label}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-green-600 font-medium">{p.present}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-red-500 font-medium">{p.absent}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-orange-500 font-medium hidden sm:table-cell">{p.late}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{p.total}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs font-bold ${pctColor(p.percentage)}`}>{p.percentage}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ TAB: ALERTS ══════════ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Low attendance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Low Attendance Classes
                <Badge variant="destructive" className="ml-auto text-xs">{alertClasses.length} class{alertClasses.length !== 1 ? 'es' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {overviewLoading ? (
                <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
              ) : alertClasses.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-sm text-muted-foreground">All classes have good attendance today!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {alertClasses.map(cls => (
                    <div key={cls.classId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                        <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{cls.className}</p>
                        <p className="text-xs text-muted-foreground">{cls.absent} absent · {cls.totalStudents} total</p>
                      </div>
                      <p className="text-base font-bold text-red-500 flex-shrink-0">{cls.attendancePercentage}%</p>
                      <button
                        onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Not yet recorded */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Attendance Not Yet Recorded
                <Badge variant="outline" className="ml-auto text-xs border-orange-300 text-orange-600">{noRecordClasses.length} pending</Badge>
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {overviewLoading ? (
                <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : noRecordClasses.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-sm text-muted-foreground">All classes have submitted attendance for {date}.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {noRecordClasses.map(cls => (
                    <div key={cls.classId} className="flex items-center px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{cls.className}</p>
                        <p className="text-xs text-muted-foreground">{cls.totalStudents} students</p>
                      </div>
                      <span className="text-xs text-orange-600 font-semibold">No record</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editRecord} onOpenChange={open => { if (!open) setEditRecord(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Edit2 className="h-4 w-4 text-primary" />
              Override Attendance
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Editing record for <span className="font-semibold text-foreground">{editRecord.studentName}</span>
              </p>
              <div>
                <Label className="text-sm font-medium mb-2 block">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ATTENDANCE_STATUSES.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStatus(s)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          editStatus === s
                            ? `${cfg.badgeClass} ${cfg.borderClass} border`
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                        data-testid={`button-edit-status-${s.toLowerCase()}`}
                      >
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Notes (optional)</Label>
                <Input
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Add a note..."
                  data-testid="input-edit-notes"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditRecord(null)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => updateMutation.mutate({ id: editRecord.id, status: editStatus, notes: editNotes })}
                  disabled={updateMutation.isPending || !editStatus}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
