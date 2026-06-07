import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Calendar, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, BookOpen,
} from 'lucide-react';
import {
  STATUS_CONFIG, pctColor, pctRatingLabel, formatDateShort,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_THRESHOLD = 75;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Safe fetch ───────────────────────────────────────────────────────────────

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

// ─── Status helper ────────────────────────────────────────────────────────────

function getStatusCfg(status: string) {
  const key = (status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()) as AttendanceStatus;
  return STATUS_CONFIG[key] ?? null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCards({
  total, present, absent, late, excused, loading,
}: {
  total: number; present: number; absent: number; late: number; excused: number; loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Days', value: total, icon: BookOpen, color: 'text-primary' },
        { label: 'Present', value: present, icon: CheckCircle2, color: 'text-green-600' },
        { label: 'Absent', value: absent, icon: XCircle, color: 'text-red-500' },
        { label: 'Late / Excused', value: late + excused, icon: Clock, color: 'text-orange-500' },
      ].map(item => (
        <Card key={item.label} data-testid={`card-stat-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className={`text-xl font-bold ${item.color}`} data-testid={`stat-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentAttendance() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data: rawAttendance = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/student/attendance', selectedMonth, selectedYear],
    queryFn: () =>
      safeFetch<any[]>(`/api/student/attendance?month=${selectedMonth + 1}&year=${selectedYear}`, []),
    enabled: !!user,
  });

  // Deduplicate by date (keep highest id)
  const attendance = useMemo(() => {
    const latest = new Map<string, any>();
    for (const r of rawAttendance) {
      const key = String(r.date).slice(0, 10);
      const existing = latest.get(key);
      if (!existing || (r.id ?? 0) > (existing.id ?? 0)) latest.set(key, r);
    }
    return Array.from(latest.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [rawAttendance]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const s = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    attendance.forEach((r: any) => {
      s.total++;
      const st = (r.status ?? '').toLowerCase();
      if (st === 'present') s.present++;
      else if (st === 'absent') s.absent++;
      else if (st === 'late') s.late++;
      else if (st === 'excused') s.excused++;
    });
    return s;
  }, [attendance]);

  const attendancePct = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;
  const isLowAttendance = stats.total > 0 && attendancePct < ALERT_THRESHOLD;
  const rating = pctRatingLabel(attendancePct);

  // ── Calendar ──────────────────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = new Date();
    const cells: { day: number | null; record?: any; isToday?: boolean; isFuture?: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const dateStr = date.toISOString().split('T')[0];
      const record = rawAttendance.find((r: any) => String(r.date).slice(0, 10) === dateStr);
      cells.push({
        day: d,
        record,
        isToday: date.toDateString() === today.toDateString(),
        isFuture: date > today,
      });
    }
    return cells;
  }, [selectedYear, selectedMonth, rawAttendance]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const isCurrentMonth =
    selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

  if (!user) return (
    <div className="p-8 text-center text-muted-foreground">Please log in to view your attendance.</div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto" data-testid="attendance-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            My Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your school attendance history by month</p>
        </div>
        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-9 w-9" data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[150px] text-center border border-border rounded-lg px-3 py-2 bg-muted/40">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="h-9 w-9"
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Low Attendance Alert ─────────────────────────────────────────── */}
      {isLowAttendance && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800" data-testid="attendance-alert">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Low Attendance Warning</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
              Your attendance is at <strong>{attendancePct}%</strong>, below the required{' '}
              <strong>{ALERT_THRESHOLD}%</strong>. Please speak with your class teacher.
            </p>
          </div>
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <SummaryCards
        total={stats.total}
        present={stats.present}
        absent={stats.absent}
        late={stats.late}
        excused={stats.excused}
        loading={isLoading}
      />

      {/* ── Attendance Rate Card ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Attendance Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${pctColor(attendancePct)}`} data-testid="stat-attendance-rate">
                {attendancePct}%
              </span>
              <Badge className={`text-xs ${rating.className}`}>{rating.label}</Badge>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(attendancePct, 100)}%`,
                backgroundColor: attendancePct >= 90 ? '#22c55e' : attendancePct >= 75 ? '#f59e0b' : '#ef4444',
              }}
              data-testid="attendance-progress-bar"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>0%</span>
            <span className="text-orange-500 font-medium">Required: {ALERT_THRESHOLD}%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Calendar Card ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Attendance Calendar — {MONTH_NAMES[selectedMonth]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1 animate-pulse">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, i) => {
                  if (cell.day === null) return <div key={i} />;
                  const cfg = cell.record ? getStatusCfg(cell.record.status) : null;
                  return (
                    <div
                      key={i}
                      title={cfg ? cfg.label : cell.isFuture ? '' : 'No record'}
                      className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 border transition-all ${
                        cell.isToday ? 'ring-2 ring-primary ring-offset-1' : ''
                      } ${
                        cell.isFuture
                          ? 'bg-muted/30 border-border/30 text-muted-foreground/40'
                          : cfg
                          ? `${cfg.bgColor} ${cfg.borderClass}`
                          : 'bg-muted/20 border-border/40'
                      }`}
                    >
                      <span className="text-[11px] font-medium text-foreground/80">{cell.day}</span>
                      {!cell.isFuture && cfg && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${cfg.dotColor}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                {[
                  { dot: 'bg-green-500', label: 'Present' },
                  { dot: 'bg-red-500', label: 'Absent' },
                  { dot: 'bg-orange-500', label: 'Late' },
                  { dot: 'bg-primary/70', label: 'Excused' },
                  { dot: 'bg-muted-foreground/30', label: 'No Record' },
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

      {/* ── Records Card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Attendance Records
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {attendance.length} record{attendance.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
              <p className="font-semibold text-muted-foreground">No attendance records</p>
              <p className="text-sm text-muted-foreground mt-1">
                Records for {MONTH_NAMES[selectedMonth]} {selectedYear} will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Day', 'Status', 'Recorded By', 'Notes'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {attendance.map((record: any, i: number) => {
                      const cfg = getStatusCfg(record.status);
                      const Icon = cfg?.icon ?? AlertCircle;
                      const dateStr = String(record.date).slice(0, 10);
                      const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <tr
                          key={i}
                          className="hover:bg-muted/40 transition-colors"
                          data-testid={`attendance-row-${i}`}
                        >
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {formatDateShort(dateStr)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{dayName}</td>
                          <td className="px-4 py-3">
                            {cfg ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                                <Icon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {record.teacher ?? record.recordedBy ?? <span className="italic">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {record.notes ?? record.remarks ?? <span className="italic">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="sm:hidden divide-y divide-border/50">
                {attendance.map((record: any, i: number) => {
                  const cfg = getStatusCfg(record.status);
                  const Icon = cfg?.icon ?? AlertCircle;
                  const dateStr = String(record.date).slice(0, 10);
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`attendance-card-${i}`}>
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg?.bgColor ?? 'bg-muted'}`}>
                        <Icon className={`h-4 w-4 ${cfg?.color ?? 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{formatDateShort(dateStr)}</p>
                          {cfg ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${cfg.badgeClass}`}>
                              {cfg.label}
                            </span>
                          ) : null}
                        </div>
                        {(record.teacher ?? record.recordedBy) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {record.teacher ?? record.recordedBy}
                          </p>
                        )}
                        {(record.notes ?? record.remarks) && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
                            {record.notes ?? record.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer summary row */}
              <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-border bg-muted/30">
                {[
                  { label: 'Present', value: stats.present, color: 'text-green-600' },
                  { label: 'Absent', value: stats.absent, color: 'text-red-500' },
                  { label: 'Late', value: stats.late, color: 'text-orange-500' },
                  { label: 'Excused', value: stats.excused, color: 'text-primary' },
                ].map(s => (
                  <span key={s.label} className={`text-xs font-semibold ${s.color}`}>
                    {s.label}: {s.value}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">{attendance.length} total records</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
