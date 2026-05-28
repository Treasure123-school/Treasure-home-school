import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, UserCheck, UserX, Clock, TrendingUp,
  AlertTriangle, Download, Search, Filter, ChevronRight,
  BarChart2, List, RefreshCw, Edit2, CheckCircle, XCircle, Info,
  Bell, BookOpen, ShieldCheck,
} from 'lucide-react';
import {
  STATUS_CONFIG, ATTENDANCE_STATUSES,
  pctColor, pctBarColor, formatTimestamp, todayISO, exportToCSV,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

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

function StatCard({ label, value, icon: Icon, colorClass, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  colorClass: string; sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as AttendanceStatus];
  if (!cfg) return <span className="text-xs text-gray-400 italic">Not marked</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, message }: { icon: React.ElementType; title: string; message?: string }) {
  return (
    <div className="p-12 text-center">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 w-14 h-14 mx-auto mb-3 flex items-center justify-center">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
      {message && <p className="text-xs text-gray-400 mt-1">{message}</p>}
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

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<Overview>({
    queryKey: ['/api/attendance/overview', date],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/overview?date=${date}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const res = await fetch('/api/classes', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch classes');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: detailAttendance = [], isLoading: detailLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['/api/attendance/class', detailClassId, date],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/class/${detailClassId}?date=${date}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch detail');
      return res.json();
    },
    enabled: !!detailClassId && !!date,
  });

  const { data: allStudentsRaw = [], isLoading: studentsLoading } = useQuery<any[]>({
    queryKey: ['/api/students'],
    queryFn: async () => {
      const res = await fetch('/api/students', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch students');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery<{ data: TrendPoint[] }>({
    queryKey: ['/api/attendance/trends', trendView, classFilter !== 'all' ? classFilter : ''],
    queryFn: async () => {
      const params = new URLSearchParams({ view: trendView });
      if (classFilter !== 'all') params.set('classId', classFilter);
      const res = await fetch(`/api/attendance/trends?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch trends');
      return res.json();
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  // ── Export helpers ────────────────────────────────────────────────────────

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
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Attendance Management</h1>
              <p className="text-indigo-200 text-xs mt-0.5">School-wide attendance overview and controls</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-auto text-sm rounded-xl h-9 bg-white/10 border-white/30 text-white placeholder-white/50 [color-scheme:dark]"
              data-testid="input-date-picker"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchOverview()}
              className="rounded-xl h-9 text-white hover:bg-white/20 border border-white/30"
              title="Refresh"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportSummary}
              className="rounded-xl h-9 text-white hover:bg-white/20 border border-white/30 gap-1.5 hidden sm:flex"
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      {overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Students"
            value={overview?.totalStudents ?? 0}
            icon={Users}
            colorClass="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            label="Present Today"
            value={overview?.totalPresent ?? 0}
            icon={UserCheck}
            colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            sub={overview?.totalLate ? `+ ${overview.totalLate} late` : undefined}
          />
          <StatCard
            label="Absent Today"
            value={overview?.totalAbsent ?? 0}
            icon={UserX}
            colorClass="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            sub={overview?.totalExcused ? `${overview.totalExcused} excused` : undefined}
          />
          <StatCard
            label="Attendance Rate"
            value={`${overview?.attendancePercentage ?? 0}%`}
            icon={TrendingUp}
            colorClass={(overview?.attendancePercentage ?? 0) >= 80
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}
            sub={`${overview?.classBreakdown?.filter(c => c.hasAttendance).length ?? 0}/${overview?.classBreakdown?.length ?? 0} classes recorded`}
          />
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            {tab.badge ? (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: SUMMARY ══════════ */}
      {activeTab === 'summary' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search classes..."
                value={summarySearch}
                onChange={e => setSummarySearch(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm h-9"
                data-testid="input-search-classes"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-auto sm:w-44 rounded-xl h-9 text-sm border-gray-200 dark:border-gray-700">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
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

          {overviewLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filteredSummaryClasses.length === 0 ? (
            <EmptyState icon={Users} title="No class data available" message={`Attendance hasn't been recorded yet for ${date}.`} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {['Class', 'Students', 'Present', 'Absent', 'Late', 'Rate', 'Recorded By', 'Time', ''].map((h, i) => (
                        <th key={i} className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${
                          i === 1 || i === 2 || i === 3 || i === 4 ? 'text-center' : ''
                        } ${i === 6 || i === 7 ? 'hidden lg:table-cell' : ''} ${i === 3 || i === 4 ? 'hidden sm:table-cell' : ''} ${i === 4 ? 'hidden md:table-cell' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredSummaryClasses.map(cls => (
                      <tr
                        key={cls.classId}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!cls.hasAttendance ? 'opacity-60' : ''}`}
                        data-testid={`row-class-${cls.classId}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{cls.className}</p>
                          <p className="text-xs text-gray-400">{cls.level}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400 text-sm">{cls.totalStudents}</td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{cls.present}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          <span className={`font-medium text-sm ${cls.absent > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{cls.absent}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <span className={`font-medium text-sm ${cls.late > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{cls.late}</span>
                        </td>
                        <td className="px-3 py-3">
                          {cls.hasAttendance ? (
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${cls.attendancePercentage}%`, backgroundColor: pctBarColor(cls.attendancePercentage) }} />
                              </div>
                              <span className={`text-xs font-bold ${pctColor(cls.attendancePercentage)}`}>{cls.attendancePercentage}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not recorded</span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{cls.recordedBy ?? '—'}</span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-400">{formatTimestamp(cls.recordedAt)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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
              <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800">
                {filteredSummaryClasses.map(cls => (
                  <div key={cls.classId} className={`p-4 ${!cls.hasAttendance ? 'opacity-60' : ''}`} data-testid={`card-class-${cls.classId}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{cls.className}</p>
                        <p className="text-xs text-gray-400">{cls.level} · {cls.totalStudents} students</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cls.hasAttendance ? (
                          <span className={`text-sm font-bold ${pctColor(cls.attendancePercentage)}`}>{cls.attendancePercentage}%</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No record</span>
                        )}
                        <button
                          onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {cls.hasAttendance && (
                      <div className="flex gap-3 text-xs mt-1">
                        <span className="text-emerald-600 dark:text-emerald-400">{cls.present} present</span>
                        <span className="text-red-600 dark:text-red-400">{cls.absent} absent</span>
                        {cls.late > 0 && <span className="text-amber-600 dark:text-amber-400">{cls.late} late</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ TAB: DETAILS ══════════ */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={detailClassId} onValueChange={v => { setDetailClassId(v); setDetailStudentSearch(''); setDetailStatusFilter('all'); }}>
                <SelectTrigger className="flex-1 rounded-xl text-sm border-gray-200 dark:border-gray-700" data-testid="select-detail-class">
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
                className="w-auto sm:w-40 text-sm rounded-xl border-gray-200 dark:border-gray-700 h-9"
              />
              {detailClassId && (
                <Button variant="outline" size="sm" onClick={handleExportDetail}
                  className="rounded-xl h-9 border-gray-200 dark:border-gray-700 gap-1.5" data-testid="button-export-detail">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              )}
            </div>
          </div>

          {!detailClassId ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
              <EmptyState icon={BookOpen} title="Select a class to view attendance" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Detail filters */}
              <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search students..."
                    value={detailStudentSearch}
                    onChange={e => setDetailStudentSearch(e.target.value)}
                    className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm h-9"
                    data-testid="input-search-students"
                  />
                </div>
                <Select value={detailStatusFilter} onValueChange={setDetailStatusFilter}>
                  <SelectTrigger className="w-auto sm:w-44 rounded-xl h-9 text-sm border-gray-200 dark:border-gray-700" data-testid="select-status-filter">
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

              {detailLoading || studentsLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : filteredDetailStudents.length === 0 ? (
                <EmptyState icon={Users} title="No students match your filters" message="Try adjusting the search or status filter." />
              ) : (
                <>
                  {/* Header row */}
                  <div className="flex items-center px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="flex-1">Student</span>
                    <span className="w-28 text-center hidden sm:block">Status</span>
                    <span className="w-36 hidden md:block">Notes</span>
                    <span className="w-8" />
                  </div>

                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredDetailStudents.map(student => {
                      const rec = attendanceMap[student.id];
                      return (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          data-testid={`row-student-${student.id}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-gray-400">{student.admissionNumber}</p>
                          </div>
                          <div className="w-28 flex justify-center hidden sm:flex">
                            <StatusBadge status={rec?.status ?? ''} />
                          </div>
                          <div className="w-36 hidden md:block">
                            <p className="text-xs text-gray-400 truncate">{rec?.notes ?? '—'}</p>
                          </div>
                          {rec && (
                            <button
                              onClick={() => { setEditRecord({ id: rec.id, studentName: `${student.firstName} ${student.lastName}`, currentStatus: rec.status, notes: rec.notes ?? '' }); setEditStatus(rec.status); setEditNotes(rec.notes ?? ''); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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

                  {/* Footer summary */}
                  {detailAttendance.length > 0 && (
                    <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {ATTENDANCE_STATUSES.map(s => {
                        const count = detailAttendance.filter(a => a.status === s).length;
                        return (
                          <span key={s} className={`text-xs font-semibold ${STATUS_CONFIG[s].color}`}>
                            {s}: {count}
                          </span>
                        );
                      })}
                      <span className="text-xs text-gray-400 ml-auto">
                        {filteredDetailStudents.length} of {detailStudents.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: TRENDS ══════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['daily', 'weekly', 'monthly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setTrendView(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    trendView === v ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                  data-testid={`button-trend-${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-auto sm:w-44 rounded-xl h-9 text-sm border-gray-200 dark:border-gray-700">
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
                <span className="text-xs text-gray-500">Average:</span>
                <span className={`text-sm font-bold ${pctColor(avgTrend)}`}>{avgTrend}%</span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse text-sm text-gray-400">Loading trends...</div>
              </div>
            ) : trendPoints.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <BarChart2 className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No attendance data for the selected period.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                  Attendance Rate — {trendView === 'daily' ? 'Last 14 Days' : trendView === 'weekly' ? 'Last 8 Weeks' : 'Last 6 Months'}
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trendPoints} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Attendance Rate']}
                      labelStyle={{ fontSize: 12, fontWeight: 600 }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {trendPoints.map((entry, i) => (
                        <Cell key={i} fill={pctBarColor(entry.percentage)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
                  {[
                    { color: 'bg-emerald-500', label: '≥ 90% Excellent' },
                    { color: 'bg-amber-500', label: '75–89% Good' },
                    { color: 'bg-red-500', label: '< 75% Low' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className={`h-2.5 w-2.5 rounded-sm ${color} inline-block`} />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {trendPoints.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Period Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {['Period', 'Present', 'Absent', 'Late', 'Total', 'Rate'].map((h, i) => (
                        <th key={i} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-center'} ${i === 3 ? 'hidden sm:table-cell' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {[...trendPoints].reverse().map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 font-medium">{p.label}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">{p.present}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-red-600 dark:text-red-400 font-medium">{p.absent}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-amber-600 dark:text-amber-400 font-medium hidden sm:table-cell">{p.late}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">{p.total}</td>
                        <td className="px-3 py-2.5 text-center"><span className={`text-xs font-bold ${pctColor(p.percentage)}`}>{p.percentage}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: ALERTS ══════════ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Low attendance */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Low Attendance Classes</p>
              <Badge variant="destructive" className="ml-auto text-xs">{alertClasses.length} class{alertClasses.length !== 1 ? 'es' : ''}</Badge>
            </div>
            {overviewLoading ? (
              <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : alertClasses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-500">All classes have good attendance today!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {alertClasses.map(cls => (
                  <div key={cls.classId} className="flex items-center gap-3 px-4 py-3">
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl flex-shrink-0">
                      <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cls.className}</p>
                      <p className="text-xs text-gray-400">{cls.absent} absent · {cls.totalStudents} total students</p>
                    </div>
                    <p className="text-base font-bold text-red-600 dark:text-red-400 flex-shrink-0">{cls.attendancePercentage}%</p>
                    <button
                      onClick={() => { setDetailClassId(String(cls.classId)); setActiveTab('details'); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Not recorded */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Attendance Not Yet Recorded</p>
              <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                {noRecordClasses.length} pending
              </Badge>
            </div>
            {overviewLoading ? (
              <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : noRecordClasses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-500">All classes have submitted attendance for {date}.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {noRecordClasses.map(cls => (
                  <div key={cls.classId} className="flex items-center px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{cls.className}</p>
                      <p className="text-xs text-gray-400">{cls.totalStudents} students</p>
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">No record</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editRecord} onOpenChange={open => { if (!open) setEditRecord(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-indigo-600" />
              Override Attendance
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Editing record for <span className="font-semibold text-gray-900 dark:text-gray-100">{editRecord.studentName}</span>
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
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          editStatus === s
                            ? `${cfg.badgeClass} ${cfg.borderClass} border`
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                  className="rounded-xl border-gray-200 dark:border-gray-700"
                  data-testid="input-edit-notes"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditRecord(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl"
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
