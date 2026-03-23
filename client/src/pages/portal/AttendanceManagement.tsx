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
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Users, UserCheck, UserX, Clock, TrendingUp, TrendingDown,
  AlertTriangle, Download, Search, Calendar, Filter, ChevronRight,
  BarChart2, List, RefreshCw, Edit2, CheckCircle, XCircle, Info,
  ArrowUpRight, Bell, BookOpen
} from 'lucide-react';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Present: { label: 'Present', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle },
  Absent: { label: 'Absent', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  Late: { label: 'Late', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  Excused: { label: 'Excused', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Info },
};

function pctColor(pct: number) {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function pctBarColor(pct: number) {
  if (pct >= 90) return '#10b981';
  if (pct >= 75) return '#f59e0b';
  return '#ef4444';
}

function formatTs(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function exportCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'summary' | 'details' | 'trends' | 'alerts';

export default function AttendanceManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [trendView, setTrendView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [detailClassId, setDetailClassId] = useState<string>('');
  const [editRecord, setEditRecord] = useState<{ id: number; studentName: string; currentStatus: string; notes: string } | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────────

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
      toast({ title: 'Updated', description: 'Attendance record has been updated.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' }),
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredClasses = useMemo(() => {
    let list = overview?.classBreakdown ?? [];
    if (classFilter !== 'all') list = list.filter(c => c.classId === parseInt(classFilter));
    if (search) list = list.filter(c => c.className.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [overview, classFilter, search]);

  const alertClasses = useMemo(() =>
    (overview?.classBreakdown ?? []).filter(c => c.hasAttendance && c.attendancePercentage < 80),
    [overview]
  );

  const noRecordClasses = useMemo(() =>
    (overview?.classBreakdown ?? []).filter(c => !c.hasAttendance),
    [overview]
  );

  const attendanceMap = useMemo(() => {
    const m: Record<string, AttendanceRecord> = {};
    detailAttendance.forEach(a => { m[a.studentId] = a; });
    return m;
  }, [detailAttendance]);

  const trendPoints = trendsData?.data ?? [];
  const avgTrend = trendPoints.length
    ? Math.round(trendPoints.reduce((s, p) => s + p.percentage, 0) / trendPoints.length)
    : 0;

  // ── Export helpers ────────────────────────────────────────────────────────────

  const handleExportSummary = () => {
    const rows = (overview?.classBreakdown ?? []).map(c => ({
      Class: c.className, Level: c.level, 'Total Students': c.totalStudents,
      Present: c.present, Absent: c.absent, Late: c.late, Excused: c.excused,
      'Attendance %': c.attendancePercentage, 'Recorded By': c.recordedBy ?? '',
      'Recorded At': c.recordedAt ? new Date(c.recordedAt).toLocaleString() : '',
    }));
    exportCSV(rows, `attendance-summary-${date}.csv`);
  };

  const handleExportDetail = () => {
    const rows = detailStudents.map(s => {
      const rec = attendanceMap[s.id];
      return {
        Name: `${s.firstName} ${s.lastName}`, 'Admission No': s.admissionNumber,
        Status: rec?.status ?? 'Not Marked', Notes: rec?.notes ?? '',
      };
    });
    exportCSV(rows, `attendance-detail-${detailClassId}-${date}.csv`);
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in.</div>;

  // ── Tabs config ───────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Summary', icon: List },
    { id: 'details', label: 'Details', icon: BookOpen },
    { id: 'trends', label: 'Trends', icon: BarChart2 },
    { id: 'alerts', label: `Alerts${alertClasses.length ? ` (${alertClasses.length})` : ''}`, icon: Bell },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Attendance Management</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Monitor and manage school-wide attendance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-auto text-sm rounded-xl border-gray-200 dark:border-gray-700 h-9"
            data-testid="input-date-picker"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOverview()}
            className="rounded-xl h-9 border-gray-200 dark:border-gray-700"
            title="Refresh"
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSummary}
            className="rounded-xl h-9 border-gray-200 dark:border-gray-700 gap-1.5 hidden sm:flex"
            data-testid="button-export"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Overview stat cards ────────────────────────────────────────────── */}
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
            color="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            label="Present Today"
            value={overview?.totalPresent ?? 0}
            icon={UserCheck}
            color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            sub={overview?.totalLate ? `+ ${overview.totalLate} late` : undefined}
          />
          <StatCard
            label="Absent Today"
            value={overview?.totalAbsent ?? 0}
            icon={UserX}
            color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            sub={overview?.totalExcused ? `${overview.totalExcused} excused` : undefined}
          />
          <StatCard
            label="Attendance Rate"
            value={`${overview?.attendancePercentage ?? 0}%`}
            icon={TrendingUp}
            color={`${(overview?.attendancePercentage ?? 0) >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}
            sub={`${overview?.classBreakdown?.filter(c => c.hasAttendance).length ?? 0} of ${overview?.classBreakdown?.length ?? 0} classes recorded`}
          />
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SUMMARY
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search classes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
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

          {/* Table */}
          {overviewLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No class data available</p>
              <p className="text-xs text-gray-400 mt-1">Attendance hasn't been recorded yet for {date}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Class</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Students</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Present</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Absent</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Late</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rate</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Recorded By</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Time</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredClasses.map(cls => (
                    <tr
                      key={cls.classId}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!cls.hasAttendance ? 'opacity-60' : ''}`}
                      data-testid={`row-class-${cls.classId}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{cls.className}</div>
                        <div className="text-xs text-gray-400">{cls.level}</div>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{cls.totalStudents}</td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{cls.present}</span>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`font-medium ${cls.absent > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{cls.absent}</span>
                      </td>
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className={`font-medium ${cls.late > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>{cls.late}</span>
                      </td>
                      <td className="px-3 py-3">
                        {cls.hasAttendance ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${cls.attendancePercentage}%`, backgroundColor: pctBarColor(cls.attendancePercentage) }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${pctColor(cls.attendancePercentage)}`}>
                              {cls.attendancePercentage}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not recorded</span>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {cls.recordedBy ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-400">{formatTs(cls.recordedAt)}</span>
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
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DETAILS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={detailClassId} onValueChange={setDetailClassId}>
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
                className="w-auto sm:w-44 text-sm rounded-xl border-gray-200 dark:border-gray-700 h-9"
              />
              {detailClassId && detailStudents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDetail}
                  className="rounded-xl h-9 border-gray-200 dark:border-gray-700 gap-1.5"
                  data-testid="button-export-detail"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              )}
            </div>
          </div>

          {!detailClassId ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Select a class to view attendance</p>
            </div>
          ) : detailLoading || studentsLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : detailStudents.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-sm text-gray-500">No students found in this class.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header row */}
              <div className="flex items-center px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Student</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 text-center hidden sm:block">Status</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-32 hidden md:block">Notes</span>
                <span className="w-8"></span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {detailStudents.map((student, idx) => {
                  const rec = attendanceMap[student.id];
                  const status = rec?.status ?? null;
                  const cfg = status ? STATUS_CONFIG[status] : null;
                  const StatusIcon = cfg?.icon;
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      data-testid={`row-student-${student.id}`}
                    >
                      {/* Avatar */}
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {student.firstName[0]}{student.lastName[0]}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{student.admissionNumber}</p>
                      </div>
                      {/* Status badge */}
                      <div className="w-28 flex justify-center hidden sm:flex">
                        {cfg ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                            {StatusIcon && <StatusIcon className="h-3 w-3" />}
                            {cfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not marked</span>
                        )}
                      </div>
                      {/* Notes */}
                      <div className="w-32 hidden md:block">
                        <p className="text-xs text-gray-400 truncate">{rec?.notes ?? '—'}</p>
                      </div>
                      {/* Edit button */}
                      {rec && (
                        <button
                          onClick={() => {
                            setEditRecord({ id: rec.id, studentName: `${student.firstName} ${student.lastName}`, currentStatus: rec.status, notes: rec.notes ?? '' });
                            setEditStatus(rec.status);
                            setEditNotes(rec.notes ?? '');
                          }}
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
              {/* Summary footer */}
              {detailAttendance.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  {['Present', 'Absent', 'Late', 'Excused'].map(s => {
                    const count = detailAttendance.filter(a => a.status === s).length;
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <span key={s} className={`text-xs font-semibold ${cfg.color}`}>
                        {s}: {count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: TRENDS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
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
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-500">Avg:</span>
                <span className={`text-sm font-bold ${pctColor(avgTrend)}`}>{avgTrend}%</span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-pulse text-sm text-gray-400">Loading trends...</div>
              </div>
            ) : trendPoints.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <BarChart2 className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No attendance data available for the selected period.</p>
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
                      formatter={(value: any, name: string) => [`${value}%`, 'Attendance Rate']}
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
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3 justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" />≥ 90% Good</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" />75–89% Moderate</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2.5 w-2.5 rounded-sm bg-red-500 inline-block" />{'< 75% Low'}</span>
                </div>
              </>
            )}
          </div>

          {/* Breakdown table */}
          {trendPoints.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Period Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Present</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Absent</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Late</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
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
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold ${pctColor(p.percentage)}`}>{p.percentage}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ALERTS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Low-attendance classes */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Low Attendance Classes</p>
              <Badge variant="destructive" className="ml-auto text-xs">{alertClasses.length} class{alertClasses.length !== 1 ? 'es' : ''}</Badge>
            </div>
            {overviewLoading ? (
              <div className="p-4 space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
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
                      <p className="text-xs text-gray-400">{cls.absent} absent out of {cls.totalStudents} students</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-red-600 dark:text-red-400">{cls.attendancePercentage}%</p>
                      <p className="text-[10px] text-gray-400">attendance rate</p>
                    </div>
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

          {/* Classes with no attendance recorded */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Attendance Not Yet Recorded</p>
              <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700 dark:text-amber-400">{noRecordClasses.length} pending</Badge>
            </div>
            {overviewLoading ? (
              <div className="p-4 space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : noRecordClasses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm text-gray-500">All classes have submitted attendance for {date}.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {noRecordClasses.map(cls => (
                  <div key={cls.classId} className="flex items-center gap-3 px-4 py-2.5">
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

      {/* ── Edit Attendance Dialog ───────────────────────────────────────── */}
      <Dialog open={!!editRecord} onOpenChange={open => { if (!open) setEditRecord(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
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
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                        editStatus === s
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                      data-testid={`status-option-${s.toLowerCase()}`}
                    >
                      <cfg.icon className="h-4 w-4" />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Notes (optional)</Label>
                <Input
                  placeholder="Reason or note..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="rounded-xl"
                  data-testid="input-edit-notes"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditRecord(null)} className="flex-1 rounded-xl">Cancel</Button>
                <Button
                  onClick={() => updateMutation.mutate({ id: editRecord.id, status: editStatus, notes: editNotes })}
                  disabled={!editStatus || updateMutation.isPending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  data-testid="button-save-override"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Override'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
