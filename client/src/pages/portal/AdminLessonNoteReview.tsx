import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge, STATUS_CFG, fmtDate, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, CheckCircle, XCircle, Eye, EyeOff, Send, FileText, ClipboardCheck,
  AlertCircle, Search, Edit, Plus, User, Calendar, MoreHorizontal,
} from 'lucide-react';

function useLessonNotes(filters: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== '_all'));
  const p = new URLSearchParams(clean);
  return useQuery<EnrichedNote[]>({
    queryKey: ['/api/lesson-notes', 'admin', filters],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes?${p}`)).json(),
    staleTime: 30 * 1000,
  });
}

function useLessonNotesStats() {
  return useQuery<{ total: number; draft: number; submitted: number; approved: number; rejected: number; published: number }>({
    queryKey: ['/api/lesson-notes/stats'],
    queryFn: async () => (await apiRequest('GET', '/api/lesson-notes/stats')).json(),
    staleTime: 30 * 1000,
  });
}

function useSubjects() {
  return useQuery<any[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
    staleTime: 5 * 60 * 1000,
  });
}

function useClasses() {
  return useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),
    staleTime: 5 * 60 * 1000,
  });
}

function NoteRow({ note, onView, onAction }: {
  note: EnrichedNote;
  onView: (n: EnrichedNote) => void;
  onAction: (action: string, n: EnrichedNote, extra?: any) => Promise<void>;
}) {
  const [showReject,  setShowReject]  = useState(false);
  const [rejectInput, setRejectInput] = useState('');
  const { toast } = useToast();

  const act = async (action: string, extra?: any) => {
    try { await onAction(action, note, extra); }
    catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const isPending    = ['draft', 'submitted', 'rejected'].includes(note.status);
  const isApproved   = note.status === 'approved';
  const isPublished  = note.status === 'published';

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`note-row-${note.id}`}>
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={note.status} />
            {note.className   && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.className}</span>}
            {note.subjectName && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.subjectName}</span>}
            {note.termName    && <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.termName}</span>}
          </div>
          <p className="font-semibold text-sm leading-snug">{note.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {note.topicName && (
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 shrink-0" />{note.topicName}</span>
            )}
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 shrink-0" />{note.creatorName ?? 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 shrink-0" />
              {note.submittedAt ? `Submitted ${fmtDate(note.submittedAt)}` : `Created ${fmtDate(note.createdAt)}`}
            </span>
          </div>
        </div>

        {/* Actions — single dropdown */}
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" data-testid={`button-more-${note.id}`}>
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(note)} data-testid={`button-view-${note.id}`}>
                <Eye className="w-4 h-4 mr-2" />View
              </DropdownMenuItem>
              {isPending && (
                <DropdownMenuItem onClick={() => act('approve-publish')} data-testid={`button-publish-${note.id}`}
                  className="text-emerald-600 focus:text-emerald-600">
                  <Eye className="w-4 h-4 mr-2" />Publish
                </DropdownMenuItem>
              )}
              {isApproved && (
                <DropdownMenuItem onClick={() => act('publish')} data-testid={`button-publish-approved-${note.id}`}
                  className="text-emerald-600 focus:text-emerald-600">
                  <Eye className="w-4 h-4 mr-2" />Publish
                </DropdownMenuItem>
              )}
              {isPending && (
                <DropdownMenuItem onClick={() => act('approve')} data-testid={`button-approve-${note.id}`}>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />Approve only
                </DropdownMenuItem>
              )}
              {['submitted', 'approved'].includes(note.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowReject(true)}
                    className="text-destructive focus:text-destructive"
                    data-testid={`button-reject-${note.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-2" />Reject
                  </DropdownMenuItem>
                </>
              )}
              {isPublished && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => act('unpublish')} className="text-destructive focus:text-destructive"
                    data-testid={`button-unpublish-${note.id}`}>
                    <EyeOff className="w-4 h-4 mr-2" />Unpublish
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rejection inline form */}
      {showReject && (
        <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
          <Textarea
            value={rejectInput}
            onChange={e => setRejectInput(e.target.value)}
            placeholder="Rejection reason (required)…"
            rows={2}
            className="resize-none"
            data-testid="input-inline-reject-reason"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectInput(''); }}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={!rejectInput.trim()}
              onClick={() => act('reject', { reason: rejectInput }).then(() => { setShowReject(false); setRejectInput(''); })}>
              Confirm Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLessonNoteReview() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [filterClass,   setFilterClass]   = useState('_all');
  const [filterSubject, setFilterSubject] = useState('_all');
  const [filterTerm,    setFilterTerm]    = useState('_all');
  const [filterStatus,  setFilterStatus]  = useState('_all');
  const [search,        setSearch]        = useState('');

  const { data: stats }         = useLessonNotesStats();
  const { data: subjects = [] } = useSubjects();
  const { data: classes  = [] } = useClasses();
  const { currentTerm, allTerms: terms } = useAcademicCalendar();

  // Auto-select current term in the filter when it loads
  useEffect(() => {
    if (currentTerm && filterTerm === '_all') {
      setFilterTerm(String(currentTerm.id));
    }
  }, [currentTerm]);

  const activeFilters = { classId: filterClass, subjectId: filterSubject, termId: filterTerm, status: filterStatus };
  const { data: notes = [], isLoading } = useLessonNotes(activeFilters);

  const filtered = useMemo(() =>
    !search ? notes : notes.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.creatorName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (n.topicName ?? '').toLowerCase().includes(search.toLowerCase())
    ), [notes, search]);

  const submitted = useMemo(() => filtered.filter(n => n.status === 'submitted'), [filtered]);
  const approved  = useMemo(() => filtered.filter(n => n.status === 'approved'),  [filtered]);
  const published = useMemo(() => filtered.filter(n => n.status === 'published'), [filtered]);

  const handleAction = async (action: string, note: EnrichedNote, extra?: any): Promise<void> => {
    await apiRequest('POST', `/api/lesson-notes/${note.id}/${action}`, extra ?? {});
    qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
    qc.invalidateQueries({ queryKey: ['/api/lesson-notes/stats'] });
    const labels: Record<string, string> = {
      approve: 'Approved', reject: 'Rejected',
      publish: 'Published', unpublish: 'Unpublished', 'approve-publish': 'Approved & Published',
    };
    toast({ title: labels[action] ?? 'Done', description: 'Note status updated.' });
  };

  const handleView   = (note: EnrichedNote) => navigate(`/portal/admin/lesson-notes/view/${note.id}`);
  const handleCreate = () => navigate('/portal/admin/lesson-notes/create');

  const STAT_CARDS = [
    { label: 'Total',    value: stats?.total     ?? 0, cls: '',                                                                               Icon: BookOpen,    tc: '' },
    { label: 'Pending',  value: stats?.submitted ?? 0, cls: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',           Icon: Send,        tc: 'text-blue-700 dark:text-blue-400' },
    { label: 'Approved', value: stats?.approved  ?? 0, cls: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',       Icon: CheckCircle, tc: 'text-green-700 dark:text-green-400' },
    { label: 'Published',value: stats?.published ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',Icon: Eye,         tc: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Rejected', value: stats?.rejected  ?? 0, cls: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',               Icon: XCircle,     tc: 'text-red-700 dark:text-red-400' },
  ];

  const renderList = (list: EnrichedNote[], emptyIcon: any, emptyTitle: string, emptyMsg: string) => {
    if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
    if (list.length === 0) {
      const Icon = emptyIcon;
      return (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <p className="font-medium text-sm">{emptyTitle}</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">{emptyMsg}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {list.map(note => (
          <NoteRow key={note.id} note={note} onView={handleView} onAction={handleAction} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="admin-lesson-notes">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              Lesson Notes Review
            </h1>
            <p className="text-muted-foreground mt-1">Manage, approve, and publish teacher lesson notes</p>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-note" className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Note
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map(({ label, value, cls, Icon, tc }) => (
            <Card key={label} className={`shadow-sm border ${cls}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <Icon className={`w-4 h-4 ${tc || 'text-muted-foreground'}`} />
                </div>
                <p className={`text-2xl font-bold ${tc || 'text-foreground'}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-9 text-xs sm:text-sm" data-testid="filter-class">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All classes</SelectItem>
                  {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="h-9 text-xs sm:text-sm" data-testid="filter-subject">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All subjects</SelectItem>
                  {subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTerm} onValueChange={setFilterTerm}>
                <SelectTrigger className="h-9 text-xs sm:text-sm" data-testid="filter-term">
                  <SelectValue placeholder="All terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All terms</SelectItem>
                  {terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs sm:text-sm" data-testid="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All statuses</SelectItem>
                  {Object.entries(STATUS_CFG).map(([s, cfg]) => (
                    <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-9 text-sm" placeholder="Search by title, teacher, or topic…"
                value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="review">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="review" className="flex-1 sm:flex-none" data-testid="tab-review">
              Pending
              {(stats?.submitted ?? 0) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {stats?.submitted}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved"  className="flex-1 sm:flex-none" data-testid="tab-approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="published" className="flex-1 sm:flex-none" data-testid="tab-published">Published ({published.length})</TabsTrigger>
            <TabsTrigger value="all"       className="flex-1 sm:flex-none" data-testid="tab-all">All ({filtered.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="mt-4">
            {renderList(submitted, ClipboardCheck, 'No notes pending review', 'All submitted notes have been reviewed.')}
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            {renderList(approved, CheckCircle, 'No approved notes', 'Approve submitted notes to see them here.')}
          </TabsContent>
          <TabsContent value="published" className="mt-4">
            {renderList(published, Eye, 'No published notes', 'Publish approved notes to make them visible to students.')}
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            {renderList(filtered, BookOpen, 'No lesson notes', 'No notes match your current filters.')}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
