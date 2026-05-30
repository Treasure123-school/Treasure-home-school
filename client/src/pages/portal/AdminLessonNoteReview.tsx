import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen, CheckCircle, XCircle, Eye, Send, FileText, Clock, ClipboardCheck,
  Trash2, AlertCircle, ChevronRight, Filter, Search, Edit,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
type LessonNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; submittedAt: string | null;
  approvedAt: string | null; rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
};

// ─── hooks ───────────────────────────────────────────────────────────────────
function useLessonNotes(filters: Record<string, string>) {
  const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  return useQuery<LessonNote[]>({
    queryKey: ['/api/lesson-notes', filters],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes?${p}`)).json(),
    staleTime: 1 * 60 * 1000,
  });
}

function useLessonNotesStats() {
  return useQuery<{ total: number; draft: number; submitted: number; approved: number; rejected: number; published: number }>({
    queryKey: ['/api/lesson-notes/stats'],
    queryFn: async () => (await apiRequest('GET', '/api/lesson-notes/stats')).json(),
    staleTime: 1 * 60 * 1000,
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

function useTerms() {
  return useQuery<any[]>({
    queryKey: ['/api/terms'],
    queryFn: async () => (await apiRequest('GET', '/api/terms')).json(),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Draft',     color: 'bg-muted text-muted-foreground', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Send },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Eye },
  archived:  { label: 'Archived',  color: 'bg-muted text-muted-foreground', icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ─── NoteDetailDialog ─────────────────────────────────────────────────────────
function NoteDetailDialog({
  note, onClose, subjects, classes, terms, onAction,
}: {
  note: LessonNote | null; onClose: () => void;
  subjects: any[]; classes: any[]; terms: any[];
  onAction: (action: string, note: LessonNote, extra?: any) => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  if (!note) return null;

  const subject = subjects.find((s) => s.id === note.subjectId);
  const cls = classes.find((c) => c.id === note.classId);
  const term = terms.find((t) => t.id === note.termId);

  return (
    <Dialog open={!!note} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <span className="flex-1 min-w-0 truncate">{note.title}</span>
          </DialogTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={note.status} />
            {cls && <Badge variant="outline" className="text-xs">{cls.name}</Badge>}
            {subject && <Badge variant="outline" className="text-xs">{subject.name}</Badge>}
            {term && <Badge variant="outline" className="text-xs">{term.name}</Badge>}
          </div>
        </DialogHeader>

        {note.rejectionReason && (
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><strong>Rejection reason:</strong> {note.rejectionReason}</div>
          </div>
        )}

        {note.objectives && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Learning Objectives</p>
            <p className="text-sm whitespace-pre-wrap">{note.objectives}</p>
          </div>
        )}
        {note.content && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Content</p>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
        )}
        {!note.objectives && !note.content && (
          <p className="text-sm text-muted-foreground italic">No content added yet.</p>
        )}

        {note.submittedAt && (
          <p className="text-xs text-muted-foreground">
            Submitted: {new Date(note.submittedAt).toLocaleDateString()}
          </p>
        )}

        {/* Reject input */}
        {showRejectInput && (
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <Label className="text-sm">Rejection Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this note is being rejected…"
              rows={3}
              data-testid="input-rejection-reason"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={!rejectReason.trim()} onClick={() => {
                onAction('reject', note, { reason: rejectReason });
                setShowRejectInput(false); setRejectReason('');
              }}>Confirm Reject</Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {note.status === 'submitted' && !showRejectInput && (
            <>
              <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => setShowRejectInput(true)} data-testid="button-reject">
                <XCircle className="w-4 h-4 mr-1.5" />Reject
              </Button>
              <Button onClick={() => { onAction('approve', note); onClose(); }} data-testid="button-approve">
                <CheckCircle className="w-4 h-4 mr-1.5" />Approve
              </Button>
            </>
          )}
          {note.status === 'approved' && !showRejectInput && (
            <>
              <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => setShowRejectInput(true)}>
                <XCircle className="w-4 h-4 mr-1.5" />Reject
              </Button>
              <Button onClick={() => { onAction('publish', note); onClose(); }} data-testid="button-publish">
                <Eye className="w-4 h-4 mr-1.5" />Publish
              </Button>
            </>
          )}
          {note.status === 'published' && (
            <Button variant="outline" onClick={() => { onAction('unpublish', note); onClose(); }} data-testid="button-unpublish">
              Unpublish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NoteRow ──────────────────────────────────────────────────────────────────
function NoteRow({
  note, subjects, classes, terms, onView, onQuickAction,
}: {
  note: LessonNote; subjects: any[]; classes: any[]; terms: any[];
  onView: (n: LessonNote) => void;
  onQuickAction: (action: string, note: LessonNote, extra?: any) => void;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const subject = subjects.find((s) => s.id === note.subjectId);
  const cls = classes.find((c) => c.id === note.classId);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 hover:bg-muted/20 transition-colors" data-testid={`note-row-${note.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={note.status} />
            {cls && <span className="text-xs text-muted-foreground">{cls.name}</span>}
            {subject && <span className="text-xs text-muted-foreground">· {subject.name}</span>}
          </div>
          <p className="font-medium text-sm leading-snug">{note.title}</p>
          {note.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>}
          {note.submittedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Submitted {new Date(note.submittedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => onView(note)} data-testid={`button-view-${note.id}`}>
            <Eye className="w-3.5 h-3.5 mr-1" />View
          </Button>
          {note.status === 'submitted' && (
            <>
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-green-700 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                onClick={() => onQuickAction('approve', note)} data-testid={`button-approve-${note.id}`}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => setShowRejectInput(true)} data-testid={`button-reject-${note.id}`}>
                <XCircle className="w-3.5 h-3.5 mr-1" />Reject
              </Button>
            </>
          )}
          {note.status === 'approved' && (
            <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              onClick={() => onQuickAction('publish', note)} data-testid={`button-publish-${note.id}`}>
              <Eye className="w-3.5 h-3.5 mr-1" />Publish
            </Button>
          )}
          {note.status === 'published' && (
            <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs"
              onClick={() => onQuickAction('unpublish', note)} data-testid={`button-unpublish-${note.id}`}>
              Unpublish
            </Button>
          )}
        </div>
      </div>
      {showRejectInput && (
        <div className="mt-2 p-3 rounded-lg border bg-muted/30 space-y-2">
          <Textarea
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason…" rows={2}
            data-testid="input-inline-rejection-reason"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={!rejectReason.trim()}
              onClick={() => { onQuickAction('reject', note, { reason: rejectReason }); setShowRejectInput(false); setRejectReason(''); }}>
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AdminLessonNoteReview() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);

  const { data: stats } = useLessonNotesStats();
  const { data: subjects = [] } = useSubjects();
  const { data: classes = [] } = useClasses();
  const { data: terms = [] } = useTerms();

  const activeFilters: Record<string, string> = {};
  if (filterClass) activeFilters.classId = filterClass;
  if (filterSubject) activeFilters.subjectId = filterSubject;
  if (filterTerm) activeFilters.termId = filterTerm;
  if (filterStatus) activeFilters.status = filterStatus;

  const { data: notes = [], isLoading } = useLessonNotes(activeFilters);

  const mutate = (action: string) => async (noteOrId: LessonNote | number, extra?: any) => {
    const id = typeof noteOrId === 'number' ? noteOrId : noteOrId.id;
    const url = `/api/lesson-notes/${id}/${action}`;
    try {
      await apiRequest('POST', url, extra ?? {});
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes/stats'] });
      const labels: Record<string, string> = { approve: 'Approved', reject: 'Rejected', publish: 'Published', unpublish: 'Unpublished' };
      toast({ title: labels[action] ?? 'Done', description: 'Note status updated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleAction = async (action: string, note: LessonNote, extra?: any) => {
    await mutate(action)(note, extra);
    setSelectedNote(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/lesson-notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes/stats'] });
      toast({ title: 'Note deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const filtered = notes.filter((n) =>
    !search || n.title.toLowerCase().includes(search.toLowerCase())
  );

  const submitted = filtered.filter((n) => n.status === 'submitted');
  const approved = filtered.filter((n) => n.status === 'approved');
  const published = filtered.filter((n) => n.status === 'published');
  const allNotes = filtered;

  const STAT_CARDS = [
    { label: 'Total', value: stats?.total ?? 0, color: 'bg-muted', icon: BookOpen },
    { label: 'Pending Review', value: stats?.submitted ?? 0, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800', icon: Send, textColor: 'text-blue-700 dark:text-blue-400' },
    { label: 'Approved', value: stats?.approved ?? 0, color: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800', icon: CheckCircle, textColor: 'text-green-700 dark:text-green-400' },
    { label: 'Published', value: stats?.published ?? 0, color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800', icon: Eye, textColor: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Rejected', value: stats?.rejected ?? 0, color: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', icon: XCircle, textColor: 'text-red-700 dark:text-red-400' },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="admin-lesson-notes">

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Lesson Notes Review</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Review, approve, and publish teacher lesson notes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map(({ label, value, color, icon: Icon, textColor }) => (
            <Card key={label} className={`shadow-sm border ${color}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <Icon className={`w-4 h-4 ${textColor ?? 'text-muted-foreground'}`} />
                </div>
                <p className={`text-2xl font-bold ${textColor ?? 'text-foreground'}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="w-4 h-4 text-muted-foreground" />Filters
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Class</Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className="h-9" data-testid="filter-class"><SelectValue placeholder="All classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All classes</SelectItem>
                    {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="h-9" data-testid="filter-subject"><SelectValue placeholder="All subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All subjects</SelectItem>
                    {subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Term</Label>
                <Select value={filterTerm} onValueChange={setFilterTerm}>
                  <SelectTrigger className="h-9" data-testid="filter-term"><SelectValue placeholder="All terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All terms</SelectItem>
                    {terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9" data-testid="filter-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                      <SelectItem key={status} value={status}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="review">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="review" data-testid="tab-review">
              Review Queue
              {(stats?.submitted ?? 0) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {stats?.submitted}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" data-testid="tab-approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published">Published ({published.length})</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All ({allNotes.length})</TabsTrigger>
          </TabsList>

          {/* Review Queue */}
          <TabsContent value="review" className="mt-4">
            {isLoading ? <NoteListSkeleton /> : submitted.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="w-7 h-7 text-muted-foreground/30" />} title="No notes pending review" message="All submitted notes have been reviewed." />
            ) : (
              <div className="space-y-3">
                {submitted.map((note) => (
                  <NoteRow key={note.id} note={note} subjects={subjects} classes={classes} terms={terms}
                    onView={setSelectedNote} onQuickAction={handleAction} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Approved */}
          <TabsContent value="approved" className="mt-4">
            {isLoading ? <NoteListSkeleton /> : approved.length === 0 ? (
              <EmptyState icon={<CheckCircle className="w-7 h-7 text-muted-foreground/30" />} title="No approved notes" message="Approve submitted notes to see them here." />
            ) : (
              <div className="space-y-3">
                {approved.map((note) => (
                  <NoteRow key={note.id} note={note} subjects={subjects} classes={classes} terms={terms}
                    onView={setSelectedNote} onQuickAction={handleAction} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Published */}
          <TabsContent value="published" className="mt-4">
            {isLoading ? <NoteListSkeleton /> : published.length === 0 ? (
              <EmptyState icon={<Eye className="w-7 h-7 text-muted-foreground/30" />} title="No published notes" message="Publish approved notes to make them visible to students." />
            ) : (
              <div className="space-y-3">
                {published.map((note) => (
                  <NoteRow key={note.id} note={note} subjects={subjects} classes={classes} terms={terms}
                    onView={setSelectedNote} onQuickAction={handleAction} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* All */}
          <TabsContent value="all" className="mt-4">
            {isLoading ? <NoteListSkeleton /> : allNotes.length === 0 ? (
              <EmptyState icon={<BookOpen className="w-7 h-7 text-muted-foreground/30" />} title="No lesson notes" message="No notes match your current filters." />
            ) : (
              <div className="space-y-3">
                {allNotes.map((note) => (
                  <NoteRow key={note.id} note={note} subjects={subjects} classes={classes} terms={terms}
                    onView={setSelectedNote} onQuickAction={handleAction} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <NoteDetailDialog
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        subjects={subjects} classes={classes} terms={terms}
        onAction={handleAction}
      />
    </div>
  );
}

function NoteListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">{icon}</div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">{message}</p>
    </div>
  );
}
