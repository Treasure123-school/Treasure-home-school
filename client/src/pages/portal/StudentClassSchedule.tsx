import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock, Calendar, BookOpen, User, MapPin, ChevronRight,
  ExternalLink, Bell, Timer, CalendarDays, GraduationCap, Video,
  AlertCircle,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

// ── Types ──────────────────────────────────────────────────────────────────
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
type ViewMode = 'today' | 'weekly';

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeDay(day: string): string {
  if (!day) return '';
  const d = day.toLowerCase();
  return DAYS.find(dd => dd.toLowerCase() === d || dd.toLowerCase().startsWith(d.slice(0, 3))) || day;
}

function timeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function formatTime12(timeStr: string): string {
  const [hh, mm] = timeStr.split(':').map(Number);
  const h = hh || 0;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm || 0).padStart(2, '0')} ${ampm}`;
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

function getTeacherName(entry: ClassEntry): string {
  return (entry.teacherFirstName || entry.teacherLastName)
    ? `${entry.teacherFirstName ?? ''} ${entry.teacherLastName ?? ''}`.trim()
    : 'Unknown Teacher';
}

// ── Config ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ClassStatus, { label: string; color: string; bg: string; dot: string; border: string }> = {
  ongoing: {
    label: 'Live',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  upcoming: {
    label: 'Upcoming',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-800',
  },
  completed: {
    label: 'Done',
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    dot: 'bg-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
};

const SUBJECT_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600', 'from-indigo-500 to-blue-600',
  'from-teal-500 to-green-600', 'from-red-500 to-orange-600',
];
function subjectColor(id: number) { return SUBJECT_COLORS[id % SUBJECT_COLORS.length]; }

// ── Main Page ──────────────────────────────────────────────────────────────
export default function StudentClassSchedule() {
  const [view, setView] = useState<ViewMode>('today');
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

  const ongoingClass = todaySchedule.find(e => getStatus(e) === 'ongoing');
  const totalWeekClasses = Object.values(weeklySchedule).flat().length;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatClock = (d: Date) =>
    d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <div className="space-y-6 pb-8" data-testid="student-class-schedule">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span data-testid="text-current-date">{formatDate(now)}</span>
          </p>
          {isLoading ? (
            <Skeleton className="h-5 w-24 mt-1.5" />
          ) : data?.className ? (
            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <GraduationCap className="h-3 w-3" />
              {data.className}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2 self-start">
          <div
            className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2 tabular-nums font-mono text-base font-semibold"
            data-testid="text-live-clock"
          >
            <Clock className="h-4 w-4 text-primary" />
            {formatClock(now)}
          </div>
          {nextClass && countdownSeconds !== null && countdownSeconds > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Timer className="h-3.5 w-3.5" />
              Next in{' '}
              <span className="font-bold tabular-nums" data-testid="text-countdown">
                {formatCountdown(countdownSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            label="Today"
            value={`${todaySchedule.length} ${todaySchedule.length === 1 ? 'class' : 'classes'}`}
            accent="blue"
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4 text-violet-600" />}
            label="This Week"
            value={`${totalWeekClasses} ${totalWeekClasses === 1 ? 'class' : 'classes'}`}
            accent="violet"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-emerald-600" />}
            label="Ongoing"
            value={ongoingClass ? ongoingClass.subjectName ?? 'Now' : 'None'}
            accent={ongoingClass ? 'emerald' : 'gray'}
            pulse={!!ongoingClass}
          />
          <StatCard
            icon={<Timer className="h-4 w-4 text-amber-600" />}
            label="Next Class"
            value={nextClass ? nextClass.subjectName ?? 'Upcoming' : '—'}
            accent="amber"
          />
        </div>
      )}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {/* ── View Tabs ── */}
      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="today" data-testid="button-today-view" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Today
          </TabsTrigger>
          <TabsTrigger value="weekly" data-testid="button-weekly-view" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Weekly
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Content ── */}
      {isLoading ? (
        <ScheduleSkeleton />
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

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, accent, pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'blue' | 'violet' | 'emerald' | 'amber' | 'gray';
  pulse?: boolean;
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    violet: 'bg-violet-50 dark:bg-violet-900/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
    gray: 'bg-muted',
  };
  return (
    <Card className="border-0 shadow-none">
      <CardContent className={`p-3 rounded-xl ${bg[accent]} flex items-center gap-3`}>
        <div className="flex-shrink-0 relative">
          {icon}
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-0.5">{label}</p>
          <p className="text-sm font-bold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Today View ────────────────────────────────────────────────────────────
function TodayView({
  schedule, todayName, getStatus, onSelect,
}: {
  schedule: ClassEntry[];
  todayName: string;
  getStatus: (e: ClassEntry) => ClassStatus;
  onSelect: (e: ClassEntry) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          {todayName}'s Schedule
        </h2>
        <Badge variant="outline" className="text-xs">
          {schedule.length} {schedule.length === 1 ? 'class' : 'classes'}
        </Badge>
      </div>

      {schedule.length === 0 ? (
        <EmptyState message={`No classes scheduled for ${todayName}.`} sub="Enjoy your free day!" />
      ) : (
        schedule.map(entry => (
          <ClassCard key={entry.id} entry={entry} status={getStatus(entry)} onSelect={onSelect} />
        ))
      )}
    </div>
  );
}

// ── Weekly View ────────────────────────────────────────────────────────────
function WeeklyView({
  weeklySchedule, todayName, getStatus, onSelect,
}: {
  weeklySchedule: Record<string, ClassEntry[]>;
  todayName: string;
  getStatus: (e: ClassEntry) => ClassStatus;
  onSelect: (e: ClassEntry) => void;
}) {
  const [activeDay, setActiveDay] = useState(todayName);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <CalendarDays className="h-4 w-4" />
        Weekly Schedule
      </h2>

      {/* Day tabs */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <Tabs value={activeDay} onValueChange={setActiveDay}>
          <TabsList className="w-full sm:w-auto flex gap-1">
            {DAYS.map(day => {
              const isToday = day === todayName;
              const count = weeklySchedule[day]?.length ?? 0;
              return (
                <TabsTrigger
                  key={day}
                  value={day}
                  data-testid={`button-day-${day.toLowerCase()}`}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2 h-auto"
                >
                  <span className="font-semibold">{DAY_SHORT[day]}</span>
                  <span className="text-[10px] opacity-70">
                    {count} {count === 1 ? 'class' : 'cls'}
                  </span>
                  {isToday && <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Selected day classes */}
      <div className="space-y-3">
        {weeklySchedule[activeDay]?.length === 0 ? (
          <EmptyState message={`No classes on ${activeDay}.`} sub="Nothing scheduled for this day." />
        ) : (
          weeklySchedule[activeDay]?.map(entry => {
            const isToday = activeDay === todayName;
            const status: ClassStatus = isToday ? getStatus(entry) : 'upcoming';
            return (
              <ClassCard key={entry.id} entry={entry} status={status} onSelect={onSelect} dimCompleted={false} />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Class Card ─────────────────────────────────────────────────────────────
function ClassCard({
  entry, status, onSelect, dimCompleted = true,
}: {
  entry: ClassEntry;
  status: ClassStatus;
  onSelect: (e: ClassEntry) => void;
  dimCompleted?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const color = subjectColor(entry.subjectId);
  const teacherName = getTeacherName(entry);
  const isOngoing = status === 'ongoing';

  return (
    <div
      data-testid={`card-class-${entry.id}`}
      onClick={() => onSelect(entry)}
      className={`group relative flex items-stretch rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer bg-white dark:bg-gray-900 ${
        dimCompleted && status === 'completed' ? 'opacity-60' : ''
      } ${
        isOngoing
          ? 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Color strip */}
      <div className={`w-1.5 flex-shrink-0 bg-gradient-to-b ${color}`} />

      <div className="flex-1 px-4 py-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isOngoing && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              )}
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate" data-testid={`text-subject-${entry.id}`}>
                {entry.subjectName ?? 'Unknown Subject'}
              </h3>
              {entry.subjectCode && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{entry.subjectCode}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
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

            {isOngoing ? (
              <Button
                size="sm"
                data-testid={`button-join-${entry.id}`}
                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={ev => { ev.stopPropagation(); onSelect(entry); }}
              >
                <Video className="h-3 w-3 mr-1" />
                Join
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                data-testid={`button-details-${entry.id}`}
                className="h-7 px-3 text-xs text-gray-500 dark:text-gray-400"
                onClick={ev => { ev.stopPropagation(); onSelect(entry); }}
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

// ── Class Detail Dialog ────────────────────────────────────────────────────
function ClassDetailDialog({
  entry, status, onClose,
}: {
  entry: ClassEntry | null;
  status: ClassStatus;
  onClose: () => void;
}) {
  if (!entry) return null;
  const cfg = STATUS_CONFIG[status];
  const color = subjectColor(entry.subjectId);
  const teacherName = getTeacherName(entry);

  return (
    <Dialog open={!!entry} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="dialog-class-detail">
        <DialogHeader>
          <div className={`h-2 w-full rounded-full bg-gradient-to-r ${color} mb-3 -mt-1`} />
          <DialogTitle className="text-xl font-bold">
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
              <span className="text-xs font-mono text-gray-400 bg-muted px-2 py-1 rounded">
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
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" data-testid="button-dialog-join">
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

// ── Shared sub-components ──────────────────────────────────────────────────
function DetailRow({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-words" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-blue-400" />
        </div>
        <h3 className="text-base font-semibold mb-1" data-testid="empty-state-schedule">{message}</h3>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ErrorState() {
  return (
    <Card className="border-dashed border-red-200 dark:border-red-800">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="text-base font-semibold mb-1">Failed to load schedule</h3>
        <p className="text-sm text-muted-foreground">Please try again later.</p>
      </CardContent>
    </Card>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
