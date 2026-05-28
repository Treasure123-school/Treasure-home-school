import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  GraduationCap, Users, ChevronLeft, ChevronRight, TrendingUp,
} from 'lucide-react';
import {
  STATUS_CONFIG, pctColor, pctRatingLabel, formatDateShort,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

interface AttendanceRecord {
  id: number;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  notes: string | null;
}

interface AttendanceData {
  records: AttendanceRecord[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
}

export default function ParentAttendance() {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChild) setSelectedChild(children[0].id);
  }, [children, selectedChild]);

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery<AttendanceData>({
    queryKey: ['/api/parent/attendance', selectedChild],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/parent/attendance/${selectedChild}`);
      if (!res.ok) throw new Error('Failed to fetch attendance');
      return res.json();
    },
    enabled: !!selectedChild,
  });

  const child = children.find(c => c.id === selectedChild);

  // Filter records by selected month/year
  const filteredRecords = useMemo(() => {
    if (!attendanceData?.records) return [];
    return attendanceData.records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceData, selectedMonth, selectedYear]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const today = new Date();
    const cells: { day: number | null; record?: AttendanceRecord; isToday?: boolean; isFuture?: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const dateStr = date.toISOString().split('T')[0];
      const record = filteredRecords.find(r => String(r.date).slice(0, 10) === dateStr);
      cells.push({ day: d, record, isToday: date.toDateString() === today.toDateString(), isFuture: date > today });
    }
    return cells;
  }, [selectedYear, selectedMonth, filteredRecords]);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const rating = pctRatingLabel(attendanceData?.summary.rate ?? 0);

  return (
    <div className="space-y-5 pb-6" data-testid="page-parent-attendance">

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Records
            </h1>
            <p className="text-teal-200 text-xs mt-0.5">Monitor your child's school attendance</p>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-white/20 h-9 w-9 rounded-xl">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center bg-white/20 px-3 py-1.5 rounded-xl">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-white/20 h-9 w-9 rounded-xl">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Child selector */}
        {children.length > 1 && (
          <div className="mt-4 w-full sm:w-64">
            <Select value={selectedChild} onValueChange={setSelectedChild} data-testid="select-child">
              <SelectTrigger className="bg-white/20 border-white/30 text-white [&>svg]:text-white">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{c.firstName} {c.lastName}</span>
                      {c.className && <span className="text-xs text-muted-foreground">({c.className})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Child selector (single child) */}
      {children.length === 1 && child && (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-sm font-bold text-teal-700 dark:text-teal-400 flex-shrink-0">
            {child.firstName[0]}{child.lastName[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{child.firstName} {child.lastName}</p>
            <p className="text-xs text-muted-foreground">{child.className ?? 'No class'} · {child.admissionNumber}</p>
          </div>
        </div>
      )}

      {/* No children */}
      {!loadingChildren && children.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold mb-2">No Children Linked</h3>
          <p className="text-sm text-muted-foreground">Please contact the school to link your children to your account.</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loadingChildren && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {selectedChild && loadingAttendance && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {/* Main content */}
      {selectedChild && !loadingAttendance && attendanceData && (
        <>
          {/* Overall stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'present', label: 'Present', value: attendanceData.summary.present, icon: CheckCircle, colorClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
              { key: 'absent', label: 'Absent', value: attendanceData.summary.absent, icon: XCircle, colorClass: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
              { key: 'late', label: 'Late', value: attendanceData.summary.late, icon: Clock, colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
              { key: 'excused', label: 'Excused', value: attendanceData.summary.excused, icon: AlertCircle, colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
            ].map(({ key, label, value, icon: Icon, colorClass }) => (
              <div key={key} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3" data-testid={`stat-${key}`}>
                <div className={`p-2 rounded-xl flex-shrink-0 ${colorClass}`}><Icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{attendanceData.summary.total} total</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attendance rate banner */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" />
                <span className="font-semibold text-sm">Overall Attendance Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${pctColor(attendanceData.summary.rate)}`} data-testid="text-attendance-rate">
                  {attendanceData.summary.rate}%
                </span>
                <Badge className={`text-xs ${rating.className}`}>{rating.label}</Badge>
              </div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
                style={{ width: `${Math.min(attendanceData.summary.rate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {child?.firstName} {child?.lastName} · {child?.className ?? 'N/A'}
            </p>
          </div>

          {/* Calendar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-teal-600" />
              {MONTH_NAMES[selectedMonth]} {selectedYear} — Calendar View
            </h3>
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, i) => {
                if (cell.day === null) return <div key={i} />;
                const cfg = cell.record ? STATUS_CONFIG[cell.record.status as AttendanceStatus] : null;
                return (
                  <div
                    key={i}
                    className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 border transition-all ${
                      cell.isToday ? 'ring-2 ring-teal-500 ring-offset-1' : ''
                    } ${
                      cell.isFuture
                        ? 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600'
                        : cfg
                        ? `${cfg.bgColor} ${cfg.borderClass}`
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{cell.day}</span>
                    {!cell.isFuture && cfg && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${cfg.dotColor}`} />
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
                { dot: 'bg-blue-400', label: 'Excused' },
              ].map(({ dot, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Records list */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {MONTH_NAMES[selectedMonth]} Records
              </h3>
              <span className="text-xs text-muted-foreground">{filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}</span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No attendance records for {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        {['Date', 'Status', 'Notes'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {filteredRecords.map(record => {
                        const cfg = STATUS_CONFIG[record.status];
                        const Icon = cfg.icon;
                        return (
                          <tr key={record.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors" data-testid={`attendance-row-${record.id}`}>
                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatDateShort(String(record.date).slice(0, 10))}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                                <Icon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {record.notes ?? <span className="italic">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800/50">
                  {filteredRecords.map(record => {
                    const cfg = STATUS_CONFIG[record.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={record.id} className="flex items-center gap-3 px-4 py-3" data-testid={`attendance-card-${record.id}`}>
                        <div className={`p-2 rounded-xl flex-shrink-0 ${cfg.bgColor}`}>
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{formatDateShort(String(record.date).slice(0, 10))}</p>
                          {record.notes && <p className="text-xs text-muted-foreground truncate">{record.notes}</p>}
                        </div>
                        <Badge className={`${cfg.badgeClass} border-0 text-xs flex-shrink-0`}>{cfg.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
