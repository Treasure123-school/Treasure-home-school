import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, BookOpen, User, TrendingUp, CircleAlert
} from 'lucide-react';
import { Link } from 'wouter';
import { useState, useMemo } from 'react';

const ALERT_THRESHOLD = 75;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getStatusDisplay(status: string) {
  switch (status) {
    case 'present':
      return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', label: 'Present', dot: 'bg-emerald-500' };
    case 'absent':
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', label: 'Absent', dot: 'bg-red-500' };
    case 'late':
      return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'Late', dot: 'bg-amber-500' };
    default:
      return { icon: Calendar, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/40', border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-100 text-gray-500', label: 'No Record', dot: 'bg-gray-300' };
  }
}

export default function StudentAttendance() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('month');

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['/api/student/attendance', selectedMonth, selectedYear],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/student/attendance?month=${selectedMonth}&year=${selectedYear}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    },
    enabled: !!user,
  });

  const subjects = useMemo(() => {
    const s = new Set<string>();
    attendance.forEach((r: any) => { if (r.subject) s.add(r.subject); });
    return Array.from(s);
  }, [attendance]);

  const dedupedAttendance = useMemo(() => {
    const latest = new Map<string, any>();
    for (const r of attendance as any[]) {
      const key = String(r.date).slice(0, 10);
      const existing = latest.get(key);
      if (!existing || (r.id ?? 0) > (existing.id ?? 0)) {
        latest.set(key, r);
      }
    }
    return Array.from(latest.values());
  }, [attendance]);

  const filteredRecords = useMemo(() => {
    let records = [...dedupedAttendance];
    if (filterSubject !== 'all') records = records.filter((r: any) => r.subject === filterSubject);
    if (filterPeriod === 'week') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      records = records.filter((r: any) => new Date(r.date) >= weekAgo);
    }
    return records.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dedupedAttendance, filterSubject, filterPeriod]);

  const stats = useMemo(() => {
    const s = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    filteredRecords.forEach((r: any) => {
      s.total++;
      const st = (r.status ?? '').toLowerCase();
      if (st === 'present') s.present++;
      else if (st === 'absent') s.absent++;
      else if (st === 'late') s.late++;
      else if (st === 'excused') s.excused++;
    });
    return s;
  }, [filteredRecords]);

  const attendancePct = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  const isLowAttendance = stats.total > 0 && attendancePct < ALERT_THRESHOLD;

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = new Date();
    const cells: { day: number | null; record?: any; isToday?: boolean; isFuture?: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const dateStr = date.toISOString().split('T')[0];
      const record = attendance.find((r: any) => new Date(r.date).toISOString().split('T')[0] === dateStr);
      cells.push({ day: d, record, isToday: date.toDateString() === today.toDateString(), isFuture: date > today });
    }
    return cells;
  }, [selectedYear, selectedMonth, attendance]);

  if (!user) return <div>Please log in to access your attendance.</div>;

  return (
    <div className="space-y-6 pb-6" data-testid="attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">My Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your school attendance history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
              else setSelectedMonth(m => m - 1);
            }}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[130px] text-center text-gray-700 dark:text-gray-300">
            {monthNames[selectedMonth]} {selectedYear}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
              else setSelectedMonth(m => m + 1);
            }}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Low Attendance Alert */}
      {isLowAttendance && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800" data-testid="attendance-alert">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Low Attendance Warning</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
              Your attendance is at <strong>{attendancePct}%</strong>, which is below the required <strong>{ALERT_THRESHOLD}%</strong>. Please speak with your class teacher.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Classes', value: stats.total, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: 'Present', value: stats.present, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Absent', value: stats.absent, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40' },
          { label: 'Late', value: stats.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          ...(stats.excused > 0 ? [{ label: 'Excused', value: stats.excused, icon: CircleAlert, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' }] : []),
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid={`stat-${label.toLowerCase().replace(' ', '-')}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance Rate Card */}
      <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Attendance Rate</span>
            </div>
            <span
              className={`text-2xl font-bold ${attendancePct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
              data-testid="stat-attendance-rate"
            >
              {attendancePct}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ease-out ${attendancePct >= 75 ? 'bg-emerald-500' : attendancePct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(attendancePct, 100)}%` }}
              data-testid="attendance-progress-bar"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>0%</span>
            <span className="text-amber-600 font-medium">Required: {ALERT_THRESHOLD}%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger data-testid="select-subject-filter" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <BookOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger data-testid="select-period-filter" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar View */}
      <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-blue-600" />
            Attendance Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1.5 animate-pulse">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, i) => {
                  if (cell.day === null) return <div key={i} />;
                  const s = cell.record ? getStatusDisplay(cell.record.status) : null;
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 border transition-all ${
                        cell.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                      } ${
                        cell.isFuture
                          ? 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600'
                          : s
                          ? `${s.bg} ${s.border}`
                          : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                      }`}
                    >
                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{cell.day}</span>
                      {!cell.isFuture && s && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${s.dot}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                {[
                  { dot: 'bg-emerald-500', label: 'Present' },
                  { dot: 'bg-red-500', label: 'Absent' },
                  { dot: 'bg-amber-500', label: 'Late' },
                  { dot: 'bg-gray-300 dark:bg-gray-600', label: 'No Record' },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Attendance Records</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state-attendance">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No attendance records found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {filterSubject !== 'all' || filterPeriod === 'week'
                  ? 'Try changing your filters to see more records.'
                  : `Attendance records for ${monthNames[selectedMonth]} ${selectedYear} will appear here.`}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teacher</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {filteredRecords.map((record: any, i: number) => {
                      const s = getStatusDisplay(record.status);
                      const Icon = s.icon;
                      return (
                        <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors" data-testid={`attendance-row-${i}`}>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                            {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {record.subject || <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.badge}`}>
                              <Icon className="h-3 w-3" />
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {record.teacher || <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs">
                            {record.remarks || <span className="italic">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800/50">
                {filteredRecords.map((record: any, i: number) => {
                  const s = getStatusDisplay(record.status);
                  const Icon = s.icon;
                  return (
                    <div key={i} className="px-4 py-3 flex items-center gap-3" data-testid={`attendance-card-${i}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                        <Icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {record.subject || 'School Day'}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${s.badge}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {record.teacher && <> · {record.teacher}</>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
