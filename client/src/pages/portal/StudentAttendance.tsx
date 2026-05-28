import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, BookOpen, TrendingUp, CircleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  STATUS_CONFIG, pctColor, pctRatingLabel, formatDateShort,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

const ALERT_THRESHOLD = 75;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getStatusDisplay(status: string) {
  const key = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() as AttendanceStatus;
  const cfg = STATUS_CONFIG[key];
  if (cfg) return { icon: cfg.icon, color: cfg.color, bg: cfg.bgColor, border: cfg.borderClass, badge: cfg.badgeClass, label: cfg.label, dot: cfg.dotColor };
  return { icon: Calendar, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/40', border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-100 text-gray-500', label: 'No Record', dot: 'bg-gray-300' };
}

export default function StudentAttendance() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterPeriod, setFilterPeriod] = useState('month');

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['/api/student/attendance', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/student/attendance?month=${selectedMonth}&year=${selectedYear}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch attendance');
      return res.json();
    },
    enabled: !!user,
  });

  const dedupedAttendance = useMemo(() => {
    const latest = new Map<string, any>();
    for (const r of attendance as any[]) {
      const key = String(r.date).slice(0, 10);
      const existing = latest.get(key);
      if (!existing || (r.id ?? 0) > (existing.id ?? 0)) latest.set(key, r);
    }
    return Array.from(latest.values());
  }, [attendance]);

  const filteredRecords = useMemo(() => {
    let records = [...dedupedAttendance];
    if (filterPeriod === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      records = records.filter((r: any) => new Date(r.date) >= weekAgo);
    }
    return records.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dedupedAttendance, filterPeriod]);

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

  const attendancePct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
  const isLowAttendance = stats.total > 0 && attendancePct < ALERT_THRESHOLD;
  const rating = pctRatingLabel(attendancePct);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = new Date();
    const cells: { day: number | null; record?: any; isToday?: boolean; isFuture?: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const dateStr = date.toISOString().split('T')[0];
      const record = attendance.find((r: any) => String(r.date).slice(0, 10) === dateStr);
      cells.push({ day: d, record, isToday: date.toDateString() === today.toDateString(), isFuture: date > today });
    }
    return cells;
  }, [selectedYear, selectedMonth, attendance]);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in to view your attendance.</div>;

  return (
    <div className="space-y-5 pb-6" data-testid="attendance-page">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">My Attendance</h1>
            <p className="text-blue-200 text-xs mt-0.5">Track your school attendance history by month</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/20 h-9 w-9 rounded-xl" data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center bg-white/20 px-3 py-1.5 rounded-xl">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/20 h-9 w-9 rounded-xl" data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Low Attendance Alert */}
      {isLowAttendance && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800" data-testid="attendance-alert">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Low Attendance Warning</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
              Your attendance is at <strong>{attendancePct}%</strong>, below the required <strong>{ALERT_THRESHOLD}%</strong>. Please speak with your class teacher.
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Days', value: stats.total, icon: BookOpen, colorClass: 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' },
            { label: 'Present', value: stats.present, icon: CheckCircle, colorClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' },
            { label: 'Absent', value: stats.absent, icon: XCircle, colorClass: 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' },
            { label: 'Late', value: stats.late, icon: Clock, colorClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' },
          ].map(({ label, value, icon: Icon, colorClass }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
              <div className={`p-2 rounded-xl flex-shrink-0 ${colorClass}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid={`stat-${label.toLowerCase().replace(' ', '-')}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Rate Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-sm">Attendance Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${pctColor(attendancePct)}`}
              data-testid="stat-attendance-rate"
            >
              {attendancePct}%
            </span>
            <Badge className={`text-xs ${rating.className}`}>{rating.label}</Badge>
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
              attendancePct >= 75 ? 'bg-emerald-500' : attendancePct >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(attendancePct, 100)}%` }}
            data-testid="attendance-progress-bar"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>0%</span>
          <span className="text-amber-600 font-medium">Required: {ALERT_THRESHOLD}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex justify-end">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-44 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl" data-testid="select-period-filter">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-blue-600" />
          Attendance Calendar — {MONTH_NAMES[selectedMonth]} {selectedYear}
        </h3>
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 animate-pulse">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d.slice(0, 1)}</div>
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
      </div>

      {/* Records table / list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Attendance Records</h3>
          <span className="text-xs text-muted-foreground">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</span>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state-attendance">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No attendance records</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {filterPeriod === 'week'
                ? 'No records found for this week. Try switching to "This Month".'
                : `Attendance records for ${MONTH_NAMES[selectedMonth]} ${selectedYear} will appear here.`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {['Date', 'Status', 'Teacher', 'Remarks'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {filteredRecords.map((record: any, i: number) => {
                    const s = getStatusDisplay(record.status);
                    const Icon = s.icon;
                    return (
                      <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors" data-testid={`attendance-row-${i}`}>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDateShort(String(record.date).slice(0, 10))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.badge}`}>
                            <Icon className="h-3 w-3" />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                          {record.teacher ?? <span className="italic text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs">
                          {record.remarks ?? <span className="italic">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
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
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {formatDateShort(String(record.date).slice(0, 10))}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>
                      {record.teacher && (
                        <p className="text-xs text-muted-foreground mt-0.5">{record.teacher}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
