import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearch } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Users, Download,
  ChevronDown, ChevronUp, Save, RotateCcw, Calendar, Search,
  AlertCircle, Check,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, parseISO } from 'date-fns';

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

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  Absent: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  Late: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  Excused: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

const STATUS_ICONS: Record<AttendanceStatus, JSX.Element> = {
  Present: <CheckCircle2 className="h-3.5 w-3.5" />,
  Absent: <XCircle className="h-3.5 w-3.5" />,
  Late: <Clock className="h-3.5 w-3.5" />,
  Excused: <AlertCircle className="h-3.5 w-3.5" />,
};

const STATUS_SELECTED: Record<AttendanceStatus, string> = {
  Present: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700',
  Absent: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700',
  Late: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700',
  Excused: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700',
};

function StatusButton({
  status,
  selected,
  onClick,
}: {
  status: AttendanceStatus;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={status}
      className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium transition-all rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40 ${
        selected
          ? STATUS_SELECTED[status]
          : 'border-border text-muted-foreground hover:bg-muted/60 bg-background'
      }`}
      data-testid={`button-status-${status.toLowerCase()}`}
    >
      {STATUS_ICONS[status]}
      <span className="hidden sm:inline">{status}</span>
    </button>
  );
}

function SummaryBar({ statuses }: { statuses: Record<string, AttendanceStatus> }) {
  const total = Object.keys(statuses).length;
  const present = Object.values(statuses).filter(s => s === 'Present').length;
  const absent = Object.values(statuses).filter(s => s === 'Absent').length;
  const late = Object.values(statuses).filter(s => s === 'Late').length;
  const excused = Object.values(statuses).filter(s => s === 'Excused').length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Present', value: present, pct: `${pct}%`, color: 'text-green-600', icon: CheckCircle2 },
        { label: 'Absent', value: absent, color: 'text-red-500', icon: XCircle },
        { label: 'Late', value: late, color: 'text-orange-500', icon: Clock },
        { label: 'Excused', value: excused, color: 'text-blue-500', icon: AlertCircle },
      ].map((item, i) => (
        <Card key={i} data-testid={`card-summary-${item.label.toLowerCase()}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className={`text-xl font-bold ${item.color}`} data-testid={`text-summary-${item.label.toLowerCase()}`}>
              {item.value}
            </p>
            {item.pct && <p className="text-xs text-muted-foreground">{item.pct} attendance</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function deduplicateByStudentDate(records: AttendanceRecord[]): AttendanceRecord[] {
  const latest = new Map<string, AttendanceRecord>();
  for (const r of records) {
    const key = `${r.studentId}::${r.date}`;
    const existing = latest.get(key);
    if (!existing || r.id > existing.id) {
      latest.set(key, r);
    }
  }
  return Array.from(latest.values());
}

function HistorySection({ classId }: { classId: number }) {
  const [showHistory, setShowHistory] = useState(true);
  const [search, setSearch] = useState('');

  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 29), 'yyyy-MM-dd');

  const { data: historyData = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${classId}/history`, startDate, endDate],
    queryFn: () => {
      const token = localStorage.getItem('token');
      return fetch(`/api/attendance/class/${classId}/history?startDate=${startDate}&endDate=${endDate}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      }).then(r => {
        if (!r.ok) return [];
        return r.json().then((d: unknown) => (Array.isArray(d) ? d : []));
      });
    },
    enabled: !!classId,
  });

  const safeHistory = Array.isArray(historyData) ? historyData : [];
  const deduped = deduplicateByStudentDate(safeHistory);
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
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CardHeader>
      {showHistory && (
        <CardContent className="space-y-3">
          <Input
            placeholder="Filter by date (e.g. 2025-01)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm"
            data-testid="input-search-history"
          />
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filteredDates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No attendance records found</p>
          ) : (
            filteredDates.map(date => {
              const records = byDate[date];
              const present = records.filter(r => r.status === 'Present').length;
              const absent = records.filter(r => r.status === 'Absent').length;
              const late = records.filter(r => r.status === 'Late').length;
              const excused = records.filter(r => r.status === 'Excused').length;
              const total = records.length;
              const pct = total > 0 ? Math.round((present / total) * 100) : 0;

              return (
                <div key={date} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border" data-testid={`row-history-${date}`}>
                  <div>
                    <p className="text-sm font-medium">{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</p>
                    <div className="flex gap-3 text-xs mt-0.5">
                      <span className="text-green-600">{present} present</span>
                      <span className="text-red-500">{absent} absent</span>
                      {late > 0 && <span className="text-orange-500">{late} late</span>}
                      {excused > 0 && <span className="text-blue-500">{excused} excused</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                    {pct}%
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function TeacherAttendancePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedClassId = params.get('classId');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState<string>(preselectedClassId || '');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: classes = [] } = useQuery<TeacherClass[]>({
    queryKey: ['/api/teacher/classes-with-stats'],
  });

  const { data: classDetail, isLoading: loadingDetail } = useQuery<ClassDetail>({
    queryKey: [`/api/teacher/classes/${selectedClassId}/detail`],
    enabled: !!selectedClassId,
  });

  const { data: existingRecordsRaw = [] } = useQuery<AttendanceRecord[]>({
    queryKey: [`/api/attendance/class/${selectedClassId}`, selectedDate],
    queryFn: () => {
      const token = localStorage.getItem('token');
      return fetch(`/api/attendance/class/${selectedClassId}?date=${selectedDate}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      }).then(r => {
        if (!r.ok) return [];
        return r.json().then((d: unknown) => (Array.isArray(d) ? d : []));
      });
    },
    enabled: !!selectedClassId,
  });
  const existingRecords: AttendanceRecord[] = Array.isArray(existingRecordsRaw) ? existingRecordsRaw : [];

  useEffect(() => {
    if (!classDetail) return;
    const initial: Record<string, AttendanceStatus> = {};
    classDetail.students.forEach(s => {
      const existing = (existingRecords as AttendanceRecord[]).find(r => r.studentId === s.id);
      initial[s.id] = (existing?.status as AttendanceStatus) || 'Present';
    });
    setStatuses(initial);
    setSaved(false);
  }, [classDetail, existingRecords, selectedDate, selectedClassId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClassId || !classDetail) throw new Error('No class selected');
      // Always bulk-upsert every student — server handles insert-or-update per student+date.
      // This avoids the old split update/create logic that left stale duplicate rows behind.
      const records = classDetail.students.map(s => ({
        studentId: s.id,
        status: statuses[s.id] || 'Present',
      }));
      await apiRequest('POST', '/api/attendance/bulk', {
        classId: parseInt(selectedClassId),
        date: selectedDate,
        records,
      });
    },
    onSuccess: async () => {
      setSaved(true);
      toast({ title: 'Attendance saved', description: `Attendance for ${selectedDate} has been recorded.` });
      // Invalidate the current-date query so existing records reload fresh
      await queryClient.invalidateQueries({ queryKey: [`/api/attendance/class/${selectedClassId}`] });
      // Immediately refetch history — prefix match covers [url, startDate, endDate]
      await queryClient.refetchQueries({ queryKey: [`/api/attendance/class/${selectedClassId}/history`] });
    },
    onError: () => {
      toast({ title: 'Failed to save', description: 'Please try again.', variant: 'destructive' });
    },
  });

  const markAll = (status: AttendanceStatus) => {
    if (!classDetail) return;
    const updated: Record<string, AttendanceStatus> = {};
    classDetail.students.forEach(s => { updated[s.id] = status; });
    setStatuses(updated);
    setSaved(false);
  };

  const filteredStudents = classDetail?.students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase())
  ) || [];

  const exportCSV = () => {
    if (!classDetail) return;
    const rows = [
      ['Student Name', 'Admission Number', 'Status', 'Date'],
      ...classDetail.students.map(s => [
        `${s.firstName} ${s.lastName}`,
        s.admissionNumber,
        statuses[s.id] || 'Present',
        selectedDate,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${classDetail.class.name}-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="heading-attendance">Attendance Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Record and manage student attendance for your classes</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="class-select" className="text-sm font-medium">Class</Label>
              <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSaved(false); }}>
                <SelectTrigger id="class-select" data-testid="select-class">
                  <SelectValue placeholder="Select a class..." />
                </SelectTrigger>
                <SelectContent>
                  {(classes as TeacherClass[]).map(c => (
                    <SelectItem key={c.id} value={String(c.id)} data-testid={`option-class-${c.id}`}>
                      {c.name} {c.level ? `(${c.level})` : ''} — {c.studentCount} students
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-input" className="text-sm font-medium">Date</Label>
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

      {!selectedClassId ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
            <p className="font-semibold text-muted-foreground">Select a class to begin</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a class and date above to manage attendance.</p>
          </CardContent>
        </Card>
      ) : loadingDetail ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : classDetail ? (
        <>
          <SummaryBar statuses={statuses} />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {classDetail.class.name} — {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                  {(existingRecords as AttendanceRecord[]).length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">Editing</Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => markAll('Present')} data-testid="button-mark-all-present" className="text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                    All Present
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markAll('Absent')} data-testid="button-mark-all-absent" className="text-xs">
                    <XCircle className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                    All Absent
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCSV} data-testid="button-export-csv" className="text-xs">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-students"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No students found</p>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
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
                        <p className="text-sm font-medium text-foreground leading-tight truncate" data-testid={`text-name-${student.id}`}>
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{student.admissionNumber}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        {(['Present', 'Absent', 'Late', 'Excused'] as AttendanceStatus[]).map(s => (
                          <StatusButton
                            key={s}
                            status={s}
                            selected={statuses[student.id] === s}
                            onClick={() => {
                              setStatuses(prev => ({ ...prev, [student.id]: s }));
                              setSaved(false);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end pt-3 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const initial: Record<string, AttendanceStatus> = {};
                      classDetail.students.forEach(s => {
                        const existing = (existingRecords as AttendanceRecord[]).find(r => r.studentId === s.id);
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
                    className="min-w-24"
                    data-testid="button-save-attendance"
                  >
                    {submitMutation.isPending ? (
                      <span className="flex items-center gap-1.5">
                        <Save className="h-4 w-4 animate-pulse" />
                        Saving...
                      </span>
                    ) : saved ? (
                      <span className="flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        Saved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Save className="h-4 w-4" />
                        Save Attendance
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <HistorySection classId={parseInt(selectedClassId)} />
        </>
      ) : null}
    </div>
  );
}
