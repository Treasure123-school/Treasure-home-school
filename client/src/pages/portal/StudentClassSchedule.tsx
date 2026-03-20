import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Calendar,
  BookOpen,
  User,
  MapPin,
  ChevronRight,
  ExternalLink,
  Bell,
  Timer,
  Layers,
  CalendarDays,
  GraduationCap,
  Video,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

type ClassEntry = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string | null;
  subjectId: number;
  subjectName: string | null;
  subjectCode: string | null;
  teacherId: string;
  teacherFirstName: string | null;
  teacherLastName: string | null;
};

type TimetableData = {
  schedule: ClassEntry[];
  className: string | null;
  classInfo: any;
};

type ClassStatus = 'ongoing' | 'upcoming' | 'completed';

function normalizeDay(day: string): string {
  if (!day) return '';
  const d = day.toLowerCase();
  return DAYS.find(dd => dd.toLowerCase() === d || dd.toLowerCase().startsWith(d.slice(0, 3))) || day;
}

function parseTime(timeStr: string): { h: number; m: number } {
  const [hh, mm] = timeStr.split(':').map(Number);
  return { h: hh || 0, m: mm || 0 };
}

function timeToMinutes(timeStr: string): number {
  const { h, m } = parseTime(timeStr);
  return h * 60 + m;
}

function formatTime12(timeStr: string): string {
  const { h, m } = parseTime(timeStr);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getClassStatus(entry: ClassEntry, nowMinutes: number, todayName: string): ClassStatus {
  const normalized = normalizeDay(entry.dayOfWeek);
  if (normalized !== todayName) return 'upcoming';
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

function getSubjectColor(id: number): string {
  return SUBJECT_COLORS[id % SUBJECT_COLORS.length];
}

export default function StudentClassSchedule() {
  const { user } = useAuth();
  const [view, setView] = useState<'today' | 'weekly'>('today');
  const [now, setNow] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<ClassEntry | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayName = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1] ?? 'Monday';
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { data, isLoading, error } = useQuery<TimetableData>({
    queryKey: ['/api/student/timetable'],
  });

  const getStatus = useCallback(
    (entry: ClassEntry) => getClassStatus(entry, nowMinutes, todayName),
    [nowMinutes, todayName]
  );

  const todaySchedule = (data?.schedule ?? [])
    .filter(e => normalizeDay(e.dayOfWeek) === todayName)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const weeklySchedule: Record<string, ClassEntry[]> = {};
  DAYS.forEach(day => {
    weeklySchedule[day] = (data?.schedule ?? [])
      .filter(e => normalizeDay(e.dayOfWeek) === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  });

  const nextClass = todaySchedule.find(e => getStatus(e) === 'upcoming');
  const countdownSeconds = nextClass
    ? Math.max(0, timeToMinutes(nextClass.startTime) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()))
    : null;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatClock = (d: Date) =>
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-200 text-sm font-medium">
              <GraduationCap className="h-4 w-4" />
              {isLoading ? (
                <Skeleton className="h-4 w-28 bg-blue-500/40" />
              ) : (
                <span>{data?.className ?? 'My Schedule'}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Class Schedule</h1>
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <Calendar className="h-4 w-4" />
              <span data-testid="text-current-date">{formatDate(now)}</span>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <div
              className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 tabular-nums font-mono text-xl font-semibold"
              data-testid="text-live-clock"
            >
              <Clock className="h-5 w-5 text-blue-200" />
              {formatClock(now)}
            </div>

            {nextClass && countdownSeconds !== null && countdownSeconds > 0 && (
              <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-300/30 rounded-xl px-3 py-1.5 text-sm">
                <Timer className="h-4 w-4 text-amber-300" />
                <span className="text-amber-100 font-medium">
                  Next class in{' '}
                  <span className="font-bold tabular-nums" data-testid="text-countdown">
                    {formatCountdown(countdownSeconds)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── View Toggle ── */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('today')}
          data-testid="button-today-view"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
            view === 'today'
              ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          Today View
        </button>
        <button
          onClick={() => setView('weekly')}
          data-testid="button-weekly-view"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
            view === 'weekly'
              ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Weekly View
        </button>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <ScheduleSkeleton view={view} />
      ) : error ? (
        <ErrorState />
      ) : view === 'today' ? (
        <TodayView
          schedule={todaySchedule}
          todayName={todayName}
          getStatus={getStatus}
          onSelect={setSelectedClass}
        />
      ) : (
        <WeeklyView
          weeklySchedule={weeklySchedule}
          todayName={todayName}
          getStatus={getStatus}
          onSelect={setSelectedClass}
        />
      )}

      {/* ── Detail Dialog ── */}
      <ClassDetailDialog
        entry={selectedClass}
        status={selectedClass ? getStatus(selectedClass) : 'upcoming'}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
}

function TodayView({
  schedule,
  todayName,
  getStatus,
  onSelect,
}: {
  schedule: ClassEntry[];
  todayName: string;
  getStatus: (e: ClassEntry) => ClassStatus;
  onSelect: (e: ClassEntry) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          Today's Schedule
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">— {todayName}</span>
        </h2>
        <Badge variant="outline" className="text-xs">
          {schedule.length} {schedule.length === 1 ? 'class' : 'classes'}
        </Badge>
      </div>

      {schedule.length === 0 ? (
        <EmptyState message={`No classes scheduled for ${todayName}.`} sub="Enjoy your free day!" />
      ) : (
        <div className="space-y-3">
          {schedule.map((entry) => (
            <ClassCard
              key={entry.id}
              entry={entry}
              status={getStatus(entry)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyView({
  weeklySchedule,
  todayName,
  getStatus,
  onSelect,
}: {
  weeklySchedule: Record<string, ClassEntry[]>;
  todayName: string;
  getStatus: (e: ClassEntry) => ClassStatus;
  onSelect: (e: ClassEntry) => void;
}) {
  const [activeDay, setActiveDay] = useState(todayName);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        Weekly Schedule
      </h2>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map((day) => {
          const isToday = day === todayName;
          const isActive = day === activeDay;
          const count = weeklySchedule[day]?.length ?? 0;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              data-testid={`button-day-${day.toLowerCase()}`}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25'
                  : isToday
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <span>{DAY_SHORT[day]}</span>
              <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                {count} {count === 1 ? 'class' : 'classes'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected day schedule */}
      {weeklySchedule[activeDay]?.length === 0 ? (
        <EmptyState message={`No classes on ${activeDay}.`} sub="Nothing scheduled for this day." />
      ) : (
        <div className="space-y-3">
          {weeklySchedule[activeDay].map((entry) => {
            const isToday = activeDay === todayName;
            const status: ClassStatus = isToday ? getStatus(entry) : 'upcoming';
            return (
              <ClassCard key={entry.id} entry={entry} status={status} onSelect={onSelect} dimCompleted={false} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  entry,
  status,
  onSelect,
  dimCompleted = true,
}: {
  entry: ClassEntry;
  status: ClassStatus;
  onSelect: (e: ClassEntry) => void;
  dimCompleted?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const color = getSubjectColor(entry.subjectId);
  const teacherName =
    entry.teacherFirstName || entry.teacherLastName
      ? `${entry.teacherFirstName ?? ''} ${entry.teacherLastName ?? ''}`.trim()
      : 'Unknown Teacher';

  return (
    <div
      data-testid={`card-class-${entry.id}`}
      className={`group relative flex items-stretch rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${cfg.bg} ${
        dimCompleted && status === 'completed' ? 'opacity-60' : ''
      } ${status === 'ongoing' ? 'shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-300/50 dark:ring-emerald-700/50' : ''}`}
      onClick={() => onSelect(entry)}
    >
      {/* Color strip */}
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
              <h3
                className="font-bold text-gray-900 dark:text-gray-100 text-base truncate"
                data-testid={`text-subject-${entry.id}`}
              >
                {entry.subjectName ?? 'Unknown Subject'}
              </h3>
              {entry.subjectCode && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{entry.subjectCode}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5" data-testid={`text-teacher-${entry.id}`}>
                <User className="h-3.5 w-3.5" />
                {teacherName}
              </span>
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
            <Badge
              data-testid={`status-class-${entry.id}`}
              className={`text-xs font-semibold border ${cfg.color} bg-transparent border-current`}
            >
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${cfg.dot} inline-block`} />
              {cfg.label}
            </Badge>

            {status === 'ongoing' ? (
              <Button
                size="sm"
                data-testid={`button-join-${entry.id}`}
                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={(ev) => { ev.stopPropagation(); onSelect(entry); }}
              >
                <Video className="h-3 w-3 mr-1" />
                Join Class
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                data-testid={`button-details-${entry.id}`}
                className="h-7 px-3 text-xs text-gray-600 dark:text-gray-400"
                onClick={(ev) => { ev.stopPropagation(); onSelect(entry); }}
              >
                Details
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassDetailDialog({
  entry,
  status,
  onClose,
}: {
  entry: ClassEntry | null;
  status: ClassStatus;
  onClose: () => void;
}) {
  if (!entry) return null;

  const cfg = STATUS_CONFIG[status];
  const color = getSubjectColor(entry.subjectId);
  const teacherName =
    entry.teacherFirstName || entry.teacherLastName
      ? `${entry.teacherFirstName ?? ''} ${entry.teacherLastName ?? ''}`.trim()
      : 'Unknown Teacher';

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="dialog-class-detail">
        <DialogHeader>
          <div className={`h-2 w-full rounded-full bg-gradient-to-r ${color} mb-3 -mt-1`} />
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {entry.subjectName ?? 'Class Details'}
          </DialogTitle>
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

          <div className="grid grid-cols-1 gap-3">
            <DetailRow icon={<User className="h-4 w-4" />} label="Teacher" value={teacherName} testId="text-detail-teacher" />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Time"
              value={`${formatTime12(entry.startTime)} – ${formatTime12(entry.endTime)}`}
              testId="text-detail-time"
            />
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Day"
              value={normalizeDay(entry.dayOfWeek)}
              testId="text-detail-day"
            />
            {entry.location && (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location" value={entry.location} testId="text-detail-location" />
            )}
            <DetailRow icon={<BookOpen className="h-4 w-4" />} label="Topic" value="Not specified" testId="text-detail-topic" />
            <DetailRow icon={<ExternalLink className="h-4 w-4" />} label="Meeting Link" value="Not available" testId="text-detail-link" />
          </div>

          {status === 'ongoing' && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              data-testid="button-dialog-join"
            >
              <Video className="h-4 w-4 mr-2" />
              Join Live Class
            </Button>
          )}

          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
            <Bell className="h-4 w-4 flex-shrink-0" />
            <span>Set a reminder for this class to stay on track.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      <span className="text-gray-400 dark:text-gray-500 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words" data-testid={testId}>
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state-schedule"
    >
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
        <CalendarDays className="h-8 w-8 text-blue-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{message}</h3>
      {sub && <p className="text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <Bell className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Failed to load schedule</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try again later.</p>
    </div>
  );
}

function ScheduleSkeleton({ view }: { view: 'today' | 'weekly' }) {
  return (
    <div className="space-y-4">
      {view === 'weekly' && (
        <div className="flex gap-2">
          {DAYS.map(d => <Skeleton key={d} className="h-14 w-16 rounded-xl" />)}
        </div>
      )}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border bg-gray-50 dark:bg-gray-800/40 p-4 flex gap-4 items-center">
          <Skeleton className="w-1.5 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
