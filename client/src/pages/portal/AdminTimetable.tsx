import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Plus, Edit2, Trash2, AlertTriangle, Filter,
  BookOpen, User, MapPin, Clock, CalendarDays, Printer,
  GraduationCap, RefreshCw, ChevronDown, X,
} from 'lucide-react';

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

type ClassData = { id: number; name: string; level: string };
type SubjectData = { id: number; name: string; code: string };
type TeacherData = { id: string; firstName: string | null; lastName: string | null; username: string };
type TermData = { id: number; name: string; isCurrent: boolean | number };

const SUBJECT_COLORS = [
  'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300',
  'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
  'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
  'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
  'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300',
  'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300',
  'bg-teal-100 border-teal-300 text-teal-800 dark:bg-teal-900/30 dark:border-teal-700 dark:text-teal-300',
  'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
];

function getSubjectColor(id: number) {
  return SUBJECT_COLORS[id % SUBJECT_COLORS.length];
}

function formatTime12(t: string) {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function teacherName(entry: TimetableEntry) {
  return entry.teacherFirstName || entry.teacherLastName
    ? `${entry.teacherFirstName ?? ''} ${entry.teacherLastName ?? ''}`.trim()
    : 'Unassigned';
}

const EMPTY_FORM = {
  classId: '', subjectId: '', teacherId: '', dayOfWeek: '',
  startTime: '', endTime: '', location: '', termId: '',
};

export default function AdminTimetable() {
  const { toast } = useToast();
  const [filterClass, setFilterClass] = useState('all');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterTerm, setFilterTerm] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<TimetableEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimetableEntry | null>(null);
  const [conflictMsg, setConflictMsg] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [activeDay, setActiveDay] = useState('Monday');

  const { data: entries = [], isLoading: loadingEntries, refetch } = useQuery<TimetableEntry[]>({
    queryKey: ['/api/admin/timetable', filterClass, filterTeacher, filterTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterClass !== 'all') params.set('classId', filterClass);
      if (filterTeacher !== 'all') params.set('teacherId', filterTeacher);
      if (filterTerm !== 'all') params.set('termId', filterTerm);
      const res = await apiRequest('GET', `/api/admin/timetable?${params}`);
      return res.json();
    },
  });

  const { data: classes = [] } = useQuery<ClassData[]>({ queryKey: ['/api/classes'] });
  const { data: subjects = [] } = useQuery<SubjectData[]>({ queryKey: ['/api/subjects'] });
  const { data: teachers = [] } = useQuery<TeacherData[]>({
    queryKey: ['/api/users/teachers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users?role=teacher');
      return res.json();
    },
  });
  const { data: terms = [] } = useQuery<TermData[]>({ queryKey: ['/api/academic-terms'] });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest('POST', '/api/admin/timetable', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timetable'] });
      toast({ title: 'Period added', description: 'Timetable entry created successfully.' });
      setShowDialog(false);
      setConflictMsg('');
      setForm({ ...EMPTY_FORM });
    },
    onError: async (err: any) => {
      const body = err?.response ? await err.response.json().catch(() => null) : null;
      if (body?.message) {
        setConflictMsg(body.message);
      } else {
        toast({ title: 'Error', description: 'Failed to create entry.', variant: 'destructive' });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest('PUT', `/api/admin/timetable/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timetable'] });
      toast({ title: 'Period updated', description: 'Timetable entry updated successfully.' });
      setShowDialog(false);
      setEditEntry(null);
      setConflictMsg('');
      setForm({ ...EMPTY_FORM });
    },
    onError: async (err: any) => {
      const res = err?.response;
      const body = res ? await res.json().catch(() => null) : null;
      if (body?.message) setConflictMsg(body.message);
      else toast({ title: 'Error', description: 'Failed to update entry.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/timetable/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timetable'] });
      toast({ title: 'Period removed', description: 'Timetable entry deleted.' });
      setDeleteEntry(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' }),
  });

  function openAdd() {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
    setConflictMsg('');
    setShowDialog(true);
  }

  function openEdit(entry: TimetableEntry) {
    setEditEntry(entry);
    setConflictMsg('');
    setForm({
      classId: String(entry.classId),
      subjectId: String(entry.subjectId),
      teacherId: entry.teacherId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      location: entry.location ?? '',
      termId: entry.termId ? String(entry.termId) : '',
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.classId || !form.subjectId || !form.teacherId || !form.dayOfWeek || !form.startTime || !form.endTime) {
      toast({ title: 'Validation', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setConflictMsg('');
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const byDay = useMemo(() => {
    const map: Record<string, TimetableEntry[]> = {};
    DAYS.forEach(d => { map[d] = []; });
    entries.forEach(e => {
      const day = DAYS.find(d => d.toLowerCase() === e.dayOfWeek?.toLowerCase()) ?? e.dayOfWeek;
      if (!map[day]) map[day] = [];
      map[day].push(e);
    });
    DAYS.forEach(d => map[d]?.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [entries]);

  const activeFilters = [filterClass !== 'all', filterTeacher !== 'all', filterTerm !== 'all'].filter(Boolean).length;

  const currentTerm = terms.find(t => t.isCurrent);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 pb-10" data-testid="admin-timetable-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Timetable Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage class schedules across all periods
          </p>
          {currentTerm && (
            <Badge variant="outline" className="mt-1.5 text-xs">
              {currentTerm.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAdd} data-testid="button-add-period">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Period
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-xs">{activeFilters}</Badge>
              )}
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-filter-class">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-teacher">
                <SelectValue placeholder="All Teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.firstName || t.lastName ? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() : t.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-term">
                <SelectValue placeholder="All Terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}{t.isCurrent ? ' (Current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeFilters > 0 && (
              <Button
                variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => { setFilterClass('all'); setFilterTeacher('all'); setFilterTerm('all'); }}
                data-testid="button-clear-filters"
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}

            <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                data-testid="button-grid-view"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                data-testid="button-list-view"
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                List
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Periods', value: entries.length, icon: <Calendar className="h-4 w-4" />, color: 'text-blue-600' },
          { label: 'Classes Covered', value: new Set(entries.map(e => e.classId)).size, icon: <GraduationCap className="h-4 w-4" />, color: 'text-emerald-600' },
          { label: 'Teachers Assigned', value: new Set(entries.map(e => e.teacherId)).size, icon: <User className="h-4 w-4" />, color: 'text-violet-600' },
          { label: 'Subjects', value: new Set(entries.map(e => e.subjectId)).size, icon: <BookOpen className="h-4 w-4" />, color: 'text-orange-600' },
        ].map(stat => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
                </div>
                <div className={`${stat.color} opacity-70`}>{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      {loadingEntries ? (
        <TimetableSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState onAdd={openAdd} hasFilters={activeFilters > 0} onClearFilters={() => { setFilterClass('all'); setFilterTeacher('all'); setFilterTerm('all'); }} />
      ) : viewMode === 'grid' ? (
        <GridView byDay={byDay} onEdit={openEdit} onDelete={setDeleteEntry} />
      ) : (
        <ListView byDay={byDay} activeDay={activeDay} setActiveDay={setActiveDay} onEdit={openEdit} onDelete={setDeleteEntry} />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); setConflictMsg(''); setEditEntry(null); } }}>
        <DialogContent className="max-w-lg" data-testid="dialog-period-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editEntry ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editEntry ? 'Edit Period' : 'Add New Period'}
            </DialogTitle>
          </DialogHeader>

          {conflictMsg && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300" data-testid="alert-conflict">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{conflictMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Class <span className="text-red-500">*</span></Label>
              <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v }))}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder="Select class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Subject <span className="text-red-500">*</span></Label>
              <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))}>
                <SelectTrigger data-testid="select-subject">
                  <SelectValue placeholder="Select subject..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Teacher <span className="text-red-500">*</span></Label>
              <Select value={form.teacherId} onValueChange={v => setForm(f => ({ ...f, teacherId: v }))}>
                <SelectTrigger data-testid="select-teacher">
                  <SelectValue placeholder="Select teacher..." />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName || t.lastName ? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() : t.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Day <span className="text-red-500">*</span></Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger data-testid="select-day">
                  <SelectValue placeholder="Select day..." />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Start Time <span className="text-red-500">*</span></Label>
              <Input
                type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                data-testid="input-start-time"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">End Time <span className="text-red-500">*</span></Label>
              <Input
                type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                data-testid="input-end-time"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Location / Venue</Label>
              <Input
                placeholder="e.g. Room 101, Science Lab..."
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                data-testid="input-location"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold mb-1.5 block">Academic Term</Label>
              <Select value={form.termId || 'none'} onValueChange={v => setForm(f => ({ ...f, termId: v === 'none' ? '' : v }))}>
                <SelectTrigger data-testid="select-term">
                  <SelectValue placeholder="Select term (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific term</SelectItem>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}{t.isCurrent ? ' (Current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDialog(false); setConflictMsg(''); setEditEntry(null); }} data-testid="button-cancel-form">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-form"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editEntry ? 'Save Changes' : 'Add Period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={open => { if (!open) setDeleteEntry(null); }}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Period</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteEntry?.subjectName}</strong> on <strong>{deleteEntry?.dayOfWeek}</strong> for <strong>{deleteEntry?.className}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              Remove Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GridView({
  byDay, onEdit, onDelete,
}: {
  byDay: Record<string, TimetableEntry[]>;
  onEdit: (e: TimetableEntry) => void;
  onDelete: (e: TimetableEntry) => void;
}) {
  return (
    <div className="print:block">
      {/* Desktop grid */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="grid grid-cols-5 gap-3 min-w-[900px]">
          {DAYS.map(day => (
            <div key={day} className="space-y-2">
              <div className="text-center">
                <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-sm w-full">
                  {day}
                </div>
              </div>
              {byDay[day]?.length === 0 ? (
                <div className="border-2 border-dashed border-border/40 rounded-xl p-4 text-center text-xs text-muted-foreground min-h-[80px] flex items-center justify-center">
                  No classes
                </div>
              ) : (
                byDay[day].map(entry => (
                  <PeriodCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile / tablet: stacked days */}
      <div className="lg:hidden space-y-4">
        {DAYS.map(day => (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-sm text-foreground">{day}</h3>
              <Badge variant="secondary" className="text-xs">{byDay[day]?.length ?? 0} periods</Badge>
            </div>
            {byDay[day]?.length === 0 ? (
              <div className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center text-xs text-muted-foreground">
                No classes scheduled
              </div>
            ) : (
              <div className="space-y-2">
                {byDay[day].map(entry => (
                  <PeriodCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({
  byDay, activeDay, setActiveDay, onEdit, onDelete,
}: {
  byDay: Record<string, TimetableEntry[]>;
  activeDay: string;
  setActiveDay: (d: string) => void;
  onEdit: (e: TimetableEntry) => void;
  onDelete: (e: TimetableEntry) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(day => {
          const count = byDay[day]?.length ?? 0;
          const isActive = day === activeDay;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              data-testid={`button-list-day-${day.toLowerCase()}`}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              {DAY_SHORT[day]}
              <Badge
                className={`text-xs px-1.5 py-0 ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* List for selected day */}
      {byDay[activeDay]?.length === 0 ? (
        <div className="border-2 border-dashed border-border/40 rounded-xl p-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No classes on {activeDay}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byDay[activeDay].map(entry => (
            <Card key={entry.id} className="border-border/60 hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${getSubjectColor(entry.subjectId).split(' ')[0].replace('bg-', 'bg-').replace('-100', '-400')}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="font-bold text-base" data-testid={`text-subject-${entry.id}`}>{entry.subjectName}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{entry.subjectCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onEdit(entry)} data-testid={`button-edit-${entry.id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(entry)} data-testid={`button-delete-${entry.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{entry.className}</span>
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{teacherName(entry)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime12(entry.startTime)} – {formatTime12(entry.endTime)}</span>
                      {entry.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{entry.location}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodCard({
  entry, onEdit, onDelete,
}: {
  entry: TimetableEntry;
  onEdit: (e: TimetableEntry) => void;
  onDelete: (e: TimetableEntry) => void;
}) {
  const color = getSubjectColor(entry.subjectId);
  return (
    <div
      className={`group relative rounded-xl border p-3 text-xs space-y-1.5 transition-all hover:shadow-md ${color}`}
      data-testid={`card-period-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold text-sm leading-tight line-clamp-2" data-testid={`text-period-subject-${entry.id}`}>
          {entry.subjectName}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
            onClick={() => onEdit(entry)}
            data-testid={`button-edit-period-${entry.id}`}
            title="Edit period"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
            onClick={() => onDelete(entry)}
            data-testid={`button-delete-period-${entry.id}`}
            title="Remove period"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-80">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="font-medium tabular-nums">{formatTime12(entry.startTime)} – {formatTime12(entry.endTime)}</span>
      </div>
      <div className="flex items-center gap-1 opacity-80">
        <GraduationCap className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{entry.className}</span>
      </div>
      <div className="flex items-center gap-1 opacity-80">
        <User className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{teacherName(entry)}</span>
      </div>
      {entry.location && (
        <div className="flex items-center gap-1 opacity-70">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{entry.location}</span>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd, hasFilters, onClearFilters }: { onAdd: () => void; hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="empty-state-timetable">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <CalendarDays className="h-10 w-10 text-primary/60" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1.5">
        {hasFilters ? 'No periods match your filters' : 'No timetable yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {hasFilters
          ? 'Try adjusting your filters to see more results.'
          : 'Start building the school timetable by adding periods for each class.'}
      </p>
      <div className="flex gap-2">
        {hasFilters && (
          <Button variant="outline" onClick={onClearFilters} data-testid="button-empty-clear-filters">
            Clear Filters
          </Button>
        )}
        <Button onClick={onAdd} data-testid="button-empty-add">
          <Plus className="h-4 w-4 mr-1.5" />
          Add First Period
        </Button>
      </div>
    </div>
  );
}

function TimetableSkeleton() {
  return (
    <div className="hidden lg:grid grid-cols-5 gap-3">
      {DAYS.map(day => (
        <div key={day} className="space-y-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ))}
    </div>
  );
}
