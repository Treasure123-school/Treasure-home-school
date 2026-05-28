import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearch } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Users, Download,
  ChevronDown, ChevronUp, Save, RotateCcw, Calendar, Search,
  AlertCircle, Check, GraduationCap,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, parseISO } from 'date-fns';
import {
  STATUS_CONFIG, ATTENDANCE_STATUSES,
  pctColor, exportToCSV, deduplicateByStudentDate,
  type AttendanceStatus,
} from '@/lib/attendance-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherClass {
  id: number;
  name: string;
  level: string;
  studentCount: number;
  subjects: { id: number; name: string }[];
}

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  profileImageUrl: string | null;
}

interface ClassDetail {
  class: { id: number; name: string; level: string; classTeacherName: string | null };
  students: Student[];
  subjects: { subjectId: number; subjectName: string }[];
}

interface AttendanceRecord {
  id: number;
  studentId: string;
  classId: number;
  date: string;
  status: string;
  notes: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusButton({ status, selected, onClick }: {
  status: AttendanceStatus; selected: boolean; onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      title={status}
      className={`flex items-center justify-center gap-1 py-1.5 px-2.5 text-xs font-semibold transition-all rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40 ${
        selected
          ? `${cfg.badgeClass} ${cfg.borderClass} border`
          : 'border-border text-muted-foreground hover:bg-muted/60 bg-background'
      }`}
      data-testid={`button-status-${status.toLowerCase()}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{status}</span>
    </button>
  );
}

function ProgressBar({ statuses, total }: { statuses: Record<string, AttendanceStatus>; total: number }) {
  const marked = Object.keys(statuses).length;
  const present = Object.values(statuses).filter(s => s === 'Present').length;
  const absent = Object.values(statuses).filter(s => s === 'Absent').length;
  const late = Object.values(statuses).filter(s => s === 'Late').length;
  const excused = Object.values(statuses).filter(s => s === 'Excused').length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{marked} / {total} students marked</span>
        <span className={`font-bold text-sm ${pctColor(pct)}`}>{pct}% attendance rate</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
        {total > 0 && (
          <>
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(present / total) * 100}%` }} />
            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(late / total) * 100}%` }} />
            <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(absent / total) * 100}%` }} />
            <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${(excused / total) * 100}%` }} />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Present', value: present, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/40', icon: CheckCircle2 },
          { label: 'Absent', value: absent, colorClass: 'text-red-500 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-950/40', icon: XCircle },
          { label: 'Late', value: late, colorClass: 'text-amber-500 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-950/40', icon: Clock },
          { label: 'Excused', value: excused, colorClass: 'text-blue-500 dark:text-blue-400', bgClass: 'bg-blue-50 dark:bg-blue-950/40', icon: AlertCircle },
        ].map(({ label, value, colorClass, bgClass, icon: Icon }) => (
          <div key={label} className={`${bgClass} rounded-xl p-3 flex items-center gap-2`} data-testid={`card-summary-${label.toLowerCase()}`}>
            <Icon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
            <div>
              <p className={`text-lg font-bold leading-none ${colorClass}`} data-testid={`text-summary-${label.toLowerCase()}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistorySection({ classId }: { classId: number }) {
  const [showHistory, setShowHistory] = useState(true);
  const [search, setSearch] = useState('');

  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 29), 'yyyy-MM-dd');

  const { data: historyData = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${classId}/history`, startDate, endDate],
    queryFn: () =>
      fetch(`/api/attendance/class/${classId}/history?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' })
        .then(r => (r.ok ? r.json().then((d: unknown) => (Array.isArray(d) ? d : [])) : [])),
    enabled: !!classId,
  });

  const safeHistory = Array.isArray(historyData) ? historyData : [];
  const deduped = deduplicateByStudentDate(safeHistory as any[]);
  const byDate = deduped.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    acc[r.date] = acc[r.date] || [];
    acc[r.date].push(r);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const filteredDates = search ? dates.filter(d => d.includes(search)) : dates;

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowHistory(!showHistory)}
          data-testid="button-toggle-history"
        >
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Attendance History (Last 30 Days)
          </CardTitle>
          {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {showHistory && (
        <CardContent className="space-y-3 pt-0">
          <Input
            placeholder="Filter by date (e.g. 2025-05)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm"
            data-testid="input-search-history"
          />
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filteredDates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No attendance records found</p>
          ) : (
            <div className="space-y-1.5">
              {filteredDates.map(date => {
                const records = byDate[date];
                const present = records.filter(r => r.status === 'Present').length;
                const absent = records.filter(r => r.status === 'Absent').length;
                const late = records.filter(r => r.status === 'Late').length;
                const excused = records.filter(r => r.status === 'Excused').length;
                const total = records.length;
                const pct = total > 0 ? Math.round((present / total) * 100) : 0;

                return (
                  <div key={date} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border hover:bg-muted/60 transition-colors" data-testid={`row-history-${date}`}>
                    <div>
                      <p className="text-sm font-medium">{format(parseISO(date), 'EEE, MMM d, yyyy')}</p>
                      <div className="flex gap-3 text-xs mt-0.5 text-muted-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400">{present} present</span>
                        <span className="text-red-500">{absent} absent</span>
                        {late > 0 && <span className="text-amber-500">{late} late</span>}
                        {excused > 0 && <span className="text-blue-500">{excused} excused</span>}
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${pctColor(pct)}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeacherAttendancePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedClassId = params.get('classId');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState(preselectedClassId || '');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const skipNextReinitRef = useRef(false);

  const { data: classes = [] } = useQuery<TeacherClass[]>({
    queryKey: ['/api/teacher/classes-with-stats'],
  });

  const { data: classDetail, isLoading: loadingDetail } = useQuery<ClassDetail>({
    queryKey: [`/api/teacher/classes/${selectedClassId}/detail`],
    enabled: !!selectedClassId,
  });

  const { data: existingRecordsRaw = [] } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${selectedClassId}`, selectedDate],
    queryFn: () =>
      fetch(`/api/attendance/class/${selectedClassId}?date=${selectedDate}`, { credentials: 'include' })
        .then(r => (r.ok ? r.json().then((d: unknown) => (Array.isArray(d) ? d : [])) : [])),
    enabled: !!selectedClassId,
  });

  const existingRecords: AttendanceRecord[] = Array.isArray(existingRecordsRaw) ? existingRecordsRaw : [];

  useEffect(() => {
    if (!classDetail) return;
    if (skipNextReinitRef.current) { skipNextReinitRef.current = false; return; }
    const initial: Record<string, AttendanceStatus> = {};
    classDetail.students.forEach(s => {
      const existing = existingRecords.find(r => r.studentId === s.id);
      initial[s.id] = (existing?.status as AttendanceStatus) || 'Present';
    });
    setStatuses(initial);
    setSaved(false);
  }, [classDetail, existingRecords, selectedDate, selectedClassId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClassId || !classDetail) throw new Error('No class selected');
      await apiRequest('POST', '/api/attendance/bulk', {
        classId: parseInt(selectedClassId),
        date: selectedDate,
        records: classDetail.students.map(s => ({ studentId: s.id, status: statuses[s.id] || 'Present' })),
      });
    },
    onSuccess: async () => {
      skipNextReinitRef.current = true;
      setSaved(true);
      toast({ title: 'Attendance saved', description: `Attendance for ${selectedDate} has been recorded successfully.` });
      await queryClient.invalidateQueries({ queryKey: [`/api/attendance/class/${selectedClassId}`, selectedDate], exact: true });
      await queryClient.refetchQueries({ queryKey: [`/api/attendance/class/${selectedClassId}/history`] });
    },
    onError: () => toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' }),
  });

  const markAll = (status: AttendanceStatus) => {
    if (!classDetail) return;
    const updated: Record<string, AttendanceStatus> = {};
    classDetail.students.forEach(s => { updated[s.id] = status; });
    setStatuses(updated);
    setSaved(false);
  };

  const handleExport = () => {
    if (!classDetail) return;
    exportToCSV(
      classDetail.students.map(s => ({
        'Student Name': `${s.firstName} ${s.lastName}`,
        'Admission Number': s.admissionNumber,
        Status: statuses[s.id] || 'Present',
        Date: selectedDate,
      })),
      `attendance-${classDetail.class.name}-${selectedDate}.csv`
    );
  };

  const filteredStudents = classDetail?.students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase())
  ) ?? [];

  const isEditing = existingRecords.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-attendance">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record daily student attendance for your classes</p>
        </div>
        {selectedClassId && classDetail && (
          <Badge variant={isEditing ? 'secondary' : 'outline'} className="self-start sm:self-auto">
            {isEditing ? 'Editing existing record' : 'New record'}
          </Badge>
        )}
      </div>

      {/* Class & date selector */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="class-select" className="text-sm font-medium flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                Class
              </Label>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSaved(false); }}>
                <SelectTrigger id="class-select" data-testid="select-class">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {(classes as TeacherClass[]).map(c => (
                    <SelectItem key={c.id} value={String(c.id)} data-testid={`option-class-${c.id}`}>
                      {c.name}{c.level ? ` (${c.level})` : ''} — {c.studentCount} students
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-input" className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Date
              </Label>
              <Input
                id="date-input"
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setSaved(false); }}
                max={format(new Date(), 'yyyy-MM-dd')}
                data-testid="input-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedClassId && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground opacity-40" />
            </div>
            <p className="font-semibold text-muted-foreground">Select a class to begin</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a class and date above to mark attendance.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {selectedClassId && loadingDetail && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      )}

      {/* Main attendance form */}
      {selectedClassId && !loadingDetail && classDetail && (
        <>
          {/* Progress / summary bar */}
          <Card>
            <CardContent className="p-4">
              <ProgressBar statuses={statuses} total={classDetail.students.length} />
            </CardContent>
          </Card>

          {/* Student list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {classDetail.class.name} — {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => markAll('Present')} data-testid="button-mark-all-present" className="text-xs h-8">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    All Present
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markAll('Absent')} data-testid="button-mark-all-absent" className="text-xs h-8">
                    <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />
                    All Absent
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExport} data-testid="button-export-csv" className="text-xs h-8">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Student search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or admission number..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-students"
                />
              </div>

              {/* Student rows */}
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No students found</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredStudents.map((student, idx) => {
                    const currentStatus = statuses[student.id] as AttendanceStatus | undefined;
                    return (
                      <div
                        key={student.id}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                          currentStatus
                            ? `${STATUS_CONFIG[currentStatus].bgColor} ${STATUS_CONFIG[currentStatus].borderClass}`
                            : 'bg-muted/20 border-border/50'
                        }`}
                        data-testid={`row-student-${student.id}`}
                      >
                        <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{idx + 1}</span>
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          {student.profileImageUrl && <AvatarImage src={student.profileImageUrl} />}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {student.firstName[0]}{student.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate" data-testid={`text-name-${student.id}`}>
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{student.admissionNumber}</p>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          {ATTENDANCE_STATUSES.map(s => (
                            <StatusButton
                              key={s}
                              status={s}
                              selected={statuses[student.id] === s}
                              onClick={() => { setStatuses(prev => ({ ...prev, [student.id]: s })); setSaved(false); }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {filteredStudents.length} of {classDetail.students.length} students shown
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const initial: Record<string, AttendanceStatus> = {};
                      classDetail.students.forEach(s => {
                        const existing = existingRecords.find(r => r.studentId === s.id);
                        initial[s.id] = (existing?.status as AttendanceStatus) || 'Present';
                      });
                      setStatuses(initial);
                      setSaved(false);
                    }}
                    data-testid="button-reset"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    className="min-w-28"
                    data-testid="button-save-attendance"
                  >
                    {submitMutation.isPending ? (
                      <span className="flex items-center gap-1.5"><Save className="h-4 w-4 animate-pulse" />Saving...</span>
                    ) : saved ? (
                      <span className="flex items-center gap-1.5"><Check className="h-4 w-4" />Saved</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><Save className="h-4 w-4" />Save Attendance</span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <HistorySection classId={parseInt(selectedClassId)} />
        </>
      )}
    </div>
  );
}
