import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Clock, Calendar, BookOpen, User, MapPin, CalendarDays,
  GraduationCap, Layers, Printer, Timer, Bell,
} from 'lucide-react';
import { Link } from 'wouter';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

type TimetableEntry = {
  id: number;
  teacherId: string;
  classId: number;
  subjectId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string | null;
  termId: number | null;
  isActive: boolean;
  teacherFirstName: string | null;
  teacherLastName: string | null;
  className: string;
  subjectName: string;
  subjectCode: string;
};

type ClassStatus = 'ongoing' | 'upcoming' | 'completed';

const STATUS_CONFIG: Record<ClassStatus, { label: string; color: string; bg: string; dot: string }> = {
  ongoing: {
    label: 'Ongoing',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  upcoming: {
    label: 'Upcoming',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

const SUBJECT_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-teal-500 to-green-600',
  'from-red-500 to-orange-600',
];

function getSubjectColor(id: number) { return SUBJECT_COLORS[id % SUBJECT_COLORS.length]; }

function normalizeDay(day: string): string {
  if (!day) return '';
  return DAYS.find(d => d.toLowerCase() === day.toLowerCase() || d.toLowerCase().startsWith(day.toLowerCase().slice(0, 3))) ?? day;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function getStatus(entry: TimetableEntry, nowMinutes: number, todayName: string): ClassStatus {
  const norm = normalizeDay(entry.dayOfWeek);
  if (norm !== todayName) return 'upcoming';
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  if (nowMinutes >= start && nowMinutes < end) return 'ongoing';
  if (nowMinutes >= end) return 'completed';
  return 'upcoming';
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export default function TeacherTimetable() {
  const { user } = useAuth();
  const [view, setView] = useState<'today' | 'weekly'>('today');
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<TimetableEntry | null>(null);
  const [activeDay, setActiveDay] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayName = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1] ?? 'Monday';
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (!activeDay) setActiveDay(todayName);
  }, [todayName, activeDay]);

  const { data: rawEntries, isLoading, error } = useQuery<TimetableEntry[]>({
    queryKey: ['/api/teacher/timetable'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/teacher/timetable');
      if (!res.ok) throw new Error('Failed to fetch timetable');
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const entries: TimetableEntry[] = Array.isArray(rawEntries) ? rawEntries : [];

  const getEntryStatus = useCallback(
    (e: TimetableEntry) => getStatus(e, nowMinutes, todayName),
    [nowMinutes, todayName]
  );

  const byDay: Record<string, TimetableEntry[]> = {};
  DAYS.forEach(d => { byDay[d] = []; });
  entries.forEach(e => {
    const day = normalizeDay(e.dayOfWeek);
    if (byDay[day]) byDay[day].push(e);
  });
  DAYS.forEach(d => byDay[d].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));

  const todaySchedule = byDay[todayName] ?? [];
  const nextClass = todaySchedule.find(e => getEntryStatus(e) === 'upcoming');
  const countdownSeconds = nextClass
    ? Math.max(0, timeToMinutes(nextClass.startTime) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()))
    : null;

  const totalPeriods = entries.length;
  const classesToday = todaySchedule.length;
  const uniqueClasses = new Set(entries.map(e => e.classId)).size;

  const formatDate = (d: Date) => d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatClock = (d: Date) => d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <div className="space-y-6 pb-10" data-testid="teacher-timetable-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Timetable</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span data-testid="text-today-date">{formatDate(now)}</span>
          </p>
          {user && (
            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <User className="h-3 w-3" />
              {user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : user.username}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2 self-start">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2 tabular-nums font-mono text-base font-semibold" data-testid="text-live-clock">
            <Clock className="h-4 w-4 text-primary" />
            {formatClock(now)}
          </div>
          {nextClass && countdownSeconds !== null && countdownSeconds > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Timer className="h-3.5 w-3.5" />
              Next class in <span className="font-bold tabular-nums ml-1" data-testid="text-countdown">{formatCountdown(countdownSeconds)}</span>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden" data-testid="button-print">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Periods', value: totalPeriods, icon: <CalendarDays className="h-4 w-4" />, color: 'text-blue-600' },
            { label: "Today's Classes", value: classesToday, icon: <Layers className="h-4 w-4" />, color: 'text-emerald-600' },
            { label: 'Classes Assigned', value: uniqueClasses, icon: <GraduationCap className="h-4 w-4" />, color: 'text-violet-600' },
          ].map(s => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                  <div className={`${s.color} opacity-60`}>{s.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
        {(['today', 'weekly'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            data-testid={`button-${v}-view`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              view === v
                ? 'bg-white dark:bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'today' ? <Layers className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
            {v === 'today' ? 'Today' : 'Weekly'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <ScheduleSkeleton />
      ) : error ? (
        <ErrorState />
      ) : view === 'today' ? (
        <TodayView
          schedule={todaySchedule}
          todayName={todayName}
          getStatus={getEntryStatus}
          onSelect={setSelected}
        />
      ) : (
        <WeeklyView
          byDay={byDay}
          todayName={todayName}
          activeDay={activeDay || todayName}
          setActiveDay={setActiveDay}
          getStatus={getEntryStatus}
          onSelect={setSelected}
        />
      )}

      {/* Detail Dialog */}
      {selected && (
        <PeriodDetailDialog
          entry={selected}
          status={getEntryStatus(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TodayView({
  schedule, todayName, getStatus, onSelect,
}: {
  schedule: TimetableEntry[];
  todayName: string;
  getStatus: (e: TimetableEntry) => ClassStatus;
  onSelect: (e: TimetableEntry) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          Today's Classes
          <span className="text-sm font-normal text-muted-foreground">— {todayName}</span>
        </h2>
        <Badge variant="outline" className="text-xs">
          {schedule.length} {schedule.length === 1 ? 'class' : 'classes'}
        </Badge>
      </div>

      {schedule.length === 0 ? (
        <EmptyDay message={`No classes today (${todayName}).`} sub="Enjoy your free day!" />
      ) : (
        <div className="space-y-3">
          {schedule.map(e => (
            <PeriodCard
              key={e.id}
              entry={e}
              status={getStatus(e)}
              onSelect={onSelect}
              showClass
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyView({
  byDay, todayName, activeDay, setActiveDay, getStatus, onSelect,
}: {
  byDay: Record<string, TimetableEntry[]>;
  todayName: string;
  activeDay: string;
  setActiveDay: (d: string) => void;
  getStatus: (e: TimetableEntry) => ClassStatus;
  onSelect: (e: TimetableEntry) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        Weekly Schedule
      </h2>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map(day => {
          const isToday = day === todayName;
          const isActive = day === activeDay;
          const count = byDay[day]?.length ?? 0;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              data-testid={`button-day-${day.toLowerCase()}`}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : isToday
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              <span>{DAY_SHORT[day]}</span>
              <span className={`text-xs ${isActive ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                {count} {count === 1 ? 'period' : 'periods'}
              </span>
            </button>
          );
        })}
      </div>

      {byDay[activeDay]?.length === 0 ? (
        <EmptyDay message={`No classes on ${activeDay}.`} sub="Nothing scheduled for this day." />
      ) : (
        <div className="space-y-3">
          {byDay[activeDay].map(e => {
            const isToday = activeDay === todayName;
            const status: ClassStatus = isToday ? getStatus(e) : 'upcoming';
            return (
              <PeriodCard key={e.id} entry={e} status={status} onSelect={onSelect} showClass dimCompleted={false} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodCard({
  entry, status, onSelect, showClass = false, dimCompleted = true,
}: {
  entry: TimetableEntry;
  status: ClassStatus;
  onSelect: (e: TimetableEntry) => void;
  showClass?: boolean;
  dimCompleted?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const color = getSubjectColor(entry.subjectId);

  return (
    <div
      data-testid={`card-period-${entry.id}`}
      className={`group relative flex items-stretch rounded-2xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${cfg.bg} ${
        dimCompleted && status === 'completed' ? 'opacity-60' : ''
      } ${status === 'ongoing' ? 'shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-300/50 dark:ring-emerald-700/50' : ''}`}
      onClick={() => onSelect(entry)}
    >
      <div className={`w-1.5 flex-shrink-0 bg-gradient-to-b ${color}`} />
      <div className="flex-1 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {status === 'ongoing' && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              )}
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate" data-testid={`text-subject-${entry.id}`}>
                {entry.subjectName}
              </h3>
              {entry.subjectCode && (
                <span className="text-xs text-gray-400 font-mono">{entry.subjectCode}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
              {showClass && (
                <span className="flex items-center gap-1.5" data-testid={`text-class-${entry.id}`}>
                  <GraduationCap className="h-3.5 w-3.5" />
                  {entry.className}
                </span>
              )}
              <span className="flex items-center gap-1.5" data-testid={`text-time-${entry.id}`}>
                <Clock className="h-3.5 w-3.5" />
                {formatTime12(entry.startTime)} – {formatTime12(entry.endTime)}
              </span>
              {entry.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {entry.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge className={`text-xs font-semibold border ${cfg.color} bg-transparent border-current`} data-testid={`status-period-${entry.id}`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${cfg.dot} inline-block`} />
              {cfg.label}
            </Badge>
            {status === 'ongoing' && (
              <Link href="/portal/teacher/attendance">
                <Button size="sm" className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" data-testid={`button-attendance-${entry.id}`} onClick={e => e.stopPropagation()}>
                  Take Attendance
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodDetailDialog({
  entry, status, onClose,
}: {
  entry: TimetableEntry;
  status: ClassStatus;
  onClose: () => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const color = getSubjectColor(entry.subjectId);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="dialog-period-detail">
        <DialogHeader>
          <div className={`h-2 w-full rounded-full bg-gradient-to-r ${color} mb-3 -mt-1`} />
          <DialogTitle className="text-xl font-bold">{entry.subjectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <Badge className={`text-sm font-semibold border ${cfg.color} bg-transparent border-current px-3 py-1`}>
              <span className={`h-2 w-2 rounded-full mr-2 ${cfg.dot} inline-block`} />
              {cfg.label}
            </Badge>
            {entry.subjectCode && (
              <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {entry.subjectCode}
              </span>
            )}
          </div>
          <div className="grid gap-3">
            <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Class" value={entry.className} testId="text-detail-class" />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Time" value={`${formatTime12(entry.startTime)} – ${formatTime12(entry.endTime)}`} testId="text-detail-time" />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Day" value={normalizeDay(entry.dayOfWeek)} testId="text-detail-day" />
            {entry.location && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={entry.location} testId="text-detail-location" />}
          </div>
          {status === 'ongoing' && (
            <Link href="/portal/teacher/attendance">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" data-testid="button-dialog-attendance">
                Take Attendance for this Class
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-800 dark:text-blue-300">
            <Bell className="h-4 w-4 flex-shrink-0" />
            <span>Set a reminder so you never miss a class.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function EmptyDay({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state-day">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
        <CalendarDays className="h-7 w-7 text-blue-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">{message}</h3>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <Bell className="h-7 w-7 text-red-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">Failed to load timetable</h3>
      <p className="text-sm text-muted-foreground">Please try again later.</p>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
    </div>
  );
}
