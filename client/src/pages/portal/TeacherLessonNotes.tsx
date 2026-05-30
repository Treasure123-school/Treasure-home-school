import { useState, useMemo } from 'react';
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
import {
  BookOpen, Layers, Plus, Edit, Trash2, Send, AlertCircle, CheckCircle,
  Clock, XCircle, Eye, FileText, ChevronRight, Filter, Info,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
type EnrichedNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null;
  submittedAt: string | null; approvedAt: string | null;
  rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
};
type Topic = { id: number; name: string; description: string | null; orderNumber: number | null };
type Assignment = { classId: number; className: string; subjectId: number; subjectName: string };

// ─── hooks ───────────────────────────────────────────────────────────────────
function useTeacherAssignments() {
  return useQuery<Assignment[]>({
    queryKey: ['/api/teacher-assignments'],
    queryFn: async () => (await apiRequest('GET', '/api/teacher-assignments')).json(),
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

function useSyllabusTopics(classId: string, subjectId: string, termId: string) {
  return useQuery<Topic[]>({
    queryKey: ['/api/syllabus-topics', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams({ classId, subjectId, termId, isPublished: 'true' });
      return (await apiRequest('GET', `/api/syllabus-topics?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 3 * 60 * 1000,
  });
}

function useMyLessonNotes(classId: string, subjectId: string, termId: string) {
  return useQuery<EnrichedNote[]>({
    queryKey: ['/api/lesson-notes', 'teacher', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (classId)   p.set('classId',   classId);
      if (subjectId) p.set('subjectId', subjectId);
      if (termId)    p.set('termId',    termId);
      return (await apiRequest('GET', `/api/lesson-notes?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 1 * 60 * 1000,
  });
}

// ─── status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; icon: any; canEdit: boolean; canDelete: boolean; canSubmit: boolean }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border border-border',                                            icon: FileText,    canEdit: true,  canDelete: true,  canSubmit: true  },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',                               icon: Send,        canEdit: false, canDelete: false, canSubmit: false },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',                           icon: CheckCircle, canEdit: false, canDelete: false, canSubmit: false },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                                   icon: XCircle,     canEdit: true,  canDelete: false, canSubmit: true  },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',                   icon: Eye,         canEdit: false, canDelete: false, canSubmit: false },
  archived:  { label: 'Archived',  cls: 'bg-muted text-muted-foreground border border-border',                                            icon: Clock,       canEdit: false, canDelete: false, canSubmit: false },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ─── NoteEditorDialog ──────────────────────────────────────────────────────
function NoteEditorDialog({
  open, onClose, note, topic, classId, subjectId, termId,
}: {
  open: boolean; onClose: () => void;
  note: EnrichedNote | null; topic: Topic | null;
  classId: number; subjectId: number; termId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle]           = useState(note?.title ?? topic?.name ?? '');
  const [content, setContent]       = useState(note?.content ?? '');
  const [objectives, setObjectives] = useState(note?.objectives ?? '');
  const isEdit = !!note;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), content: content.trim(), objectives: objectives.trim() };
      if (isEdit) return (await apiRequest('PUT', `/api/lesson-notes/${note!.id}`, body)).json();
      return (await apiRequest('POST', '/api/lesson-notes', {
        ...body, topicId: topic!.id, classId, subjectId, termId,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: isEdit ? 'Note updated' : 'Note created', description: 'Saved as draft.' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      let id = note?.id;
      if (!id) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title: title.trim(), content: content.trim(), objectives: objectives.trim(),
          topicId: topic!.id, classId, subjectId, termId,
        })).json();
        id = created.id;
      }
      return (await apiRequest('POST', `/api/lesson-notes/${id}/submit`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Submitted for review', description: 'Admin will review your note.' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const busy = saveMutation.isPending || submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {isEdit ? 'Edit Lesson Note' : 'Create Lesson Note'}
          </DialogTitle>
          {topic && <p className="text-sm text-muted-foreground mt-1">Topic: <strong>{topic.name}</strong></p>}
          {note && <div className="mt-1"><StatusBadge status={note.status} /></div>}
        </DialogHeader>

        {note?.rejectionReason && (
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><strong>Rejection reason:</strong> {note.rejectionReason}</div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ln-title">Title <span className="text-destructive">*</span></Label>
            <Input id="ln-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson note title…" data-testid="input-lesson-note-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-objectives">Learning Objectives</Label>
            <Textarea id="ln-objectives" value={objectives} onChange={(e) => setObjectives(e.target.value)}
              placeholder="What students will be able to do after this lesson…"
              rows={2} data-testid="input-lesson-note-objectives" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-content">Content</Label>
            <Textarea id="ln-content" value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Lesson content, explanation, activities…"
              rows={8} data-testid="input-lesson-note-content" />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="outline" disabled={!title.trim() || busy} onClick={() => saveMutation.mutate()}
            data-testid="button-save-draft">
            {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button disabled={!title.trim() || busy} onClick={() => submitMutation.mutate()}
            data-testid="button-submit-for-review">
            {submitMutation.isPending ? 'Submitting…' : <><Send className="w-4 h-4 mr-1.5" />Submit for Review</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NoteViewDialog ────────────────────────────────────────────────────────
function NoteViewDialog({ note, onClose, onEdit, onSubmit }: {
  note: EnrichedNote | null; onClose: () => void;
  onEdit: () => void; onSubmit: () => void;
}) {
  if (!note) return null;
  const cfg = STATUS_CFG[note.status] ?? STATUS_CFG.draft;
  return (
    <Dialog open={!!note} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />{note.title}
          </DialogTitle>
          <StatusBadge status={note.status} />
        </DialogHeader>

        {/* Audit info */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border text-xs">
          <div><span className="text-muted-foreground">Created:</span> {new Date(note.createdAt).toLocaleDateString()}</div>
          {note.submittedAt && <div><span className="text-muted-foreground">Submitted:</span> {new Date(note.submittedAt).toLocaleDateString()}</div>}
          {note.approvedAt  && <div><span className="text-muted-foreground">Approved:</span>  {new Date(note.approvedAt).toLocaleDateString()}</div>}
          {note.rejectedAt  && <div><span className="text-muted-foreground">Rejected:</span>  {new Date(note.rejectedAt).toLocaleDateString()}</div>}
          {note.publishedAt && <div><span className="text-muted-foreground">Published:</span> {new Date(note.publishedAt).toLocaleDateString()}</div>}
          <div><span className="text-muted-foreground">Last updated:</span> {new Date(note.updatedAt).toLocaleDateString()}</div>
        </div>

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

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {cfg.canEdit && (
            <Button variant="outline" onClick={onEdit}><Edit className="w-4 h-4 mr-1.5" />Edit</Button>
          )}
          {cfg.canSubmit && !cfg.canEdit && (
            <Button onClick={onSubmit}><Send className="w-4 h-4 mr-1.5" />Submit for Review</Button>
          )}
          {cfg.canEdit && cfg.canSubmit && (
            <Button onClick={onSubmit}><Send className="w-4 h-4 mr-1.5" />Submit for Review</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────
export default function TeacherLessonNotes() {
  const { toast } = useToast();
  const qc        = useQueryClient();

  const [classId,    setClassId]    = useState('');
  const [subjectId,  setSubjectId]  = useState('');
  const [termId,     setTermId]     = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [selNote,    setSelNote]    = useState<EnrichedNote | null>(null);
  const [selTopic,   setSelTopic]   = useState<Topic | null>(null);

  const { data: assignments = [], isLoading: loadingAssign } = useTeacherAssignments();
  const { data: terms = [] }                                 = useTerms();
  const { data: topics = [], isLoading: loadingTopics }      = useSyllabusTopics(classId, subjectId, termId);
  const { data: notes  = [], isLoading: loadingNotes  }      = useMyLessonNotes(classId, subjectId, termId);

  // Derive unique classes from assignments
  const uniqueClasses = useMemo(() => {
    const seen = new Set<number>();
    return (assignments as Assignment[]).filter(a => {
      if (seen.has(a.classId)) return false;
      seen.add(a.classId); return true;
    });
  }, [assignments]);

  // Derive subjects for selected class
  const availableSubjects = useMemo(
    () => (assignments as Assignment[]).filter(a => String(a.classId) === classId),
    [assignments, classId],
  );

  const noteByTopicId = useMemo(() => new Map(notes.map(n => [n.topicId, n])), [notes]);
  const sortedTopics  = useMemo(() => [...topics].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0)), [topics]);
  const filtersReady  = !!(classId && subjectId && termId);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/lesson-notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Draft deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/lesson-notes/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Submitted for review' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleTopicClick = (topic: Topic) => {
    const existing = noteByTopicId.get(topic.id) ?? null;
    setSelTopic(topic);
    setSelNote(existing);
    if (existing) setViewOpen(true);
    else setEditorOpen(true);
  };

  const handleEdit = () => { setViewOpen(false); setEditorOpen(true); };

  const handleSubmitFromView = () => {
    if (selNote) submitMutation.mutate(selNote.id);
    setViewOpen(false);
  };

  const handleClassChange = (v: string) => {
    setClassId(v);
    setSubjectId('');
  };

  const closeAll = () => {
    setEditorOpen(false); setViewOpen(false);
    setSelNote(null); setSelTopic(null);
  };

  // Summary counts
  const statusCounts = useMemo(() => {
    const out: Record<string, number> = {};
    notes.forEach(n => { out[n.status] = (out[n.status] ?? 0) + 1; });
    return out;
  }, [notes]);

  return (
    <div className="min-h-screen bg-background" data-testid="teacher-lesson-notes">

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">My Lesson Notes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Create lesson notes for your topics — submit for admin approval</p>
            </div>
          </div>
          {Object.keys(statusCounts).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const cfg = STATUS_CFG[status]; if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
                    <Icon className="w-3 h-3" />{count} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Filter card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-primary" />
              </div>
              Select Class, Subject & Term
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Class */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Class</Label>
                {loadingAssign ? <Skeleton className="h-10 rounded-md" /> : uniqueClasses.length === 0 ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0" />No classes assigned yet
                  </div>
                ) : (
                  <Select value={classId} onValueChange={handleClassChange}>
                    <SelectTrigger data-testid="select-class"><SelectValue placeholder="Select class…" /></SelectTrigger>
                    <SelectContent>
                      {uniqueClasses.map(c => (
                        <SelectItem key={c.classId} value={String(c.classId)}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder={!classId ? 'Select class first' : 'Select subject…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(s => (
                      <SelectItem key={s.subjectId} value={String(s.subjectId)}>{s.subjectName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {classId && availableSubjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">No subjects assigned for this class.</p>
                )}
              </div>

              {/* Term */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Term</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger data-testid="select-term"><SelectValue placeholder="Select term…" /></SelectTrigger>
                  <SelectContent>
                    {(terms as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.year ? ` — ${t.year}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtersReady && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                <span className="text-muted-foreground">Browsing:</span>
                <Badge variant="secondary">{uniqueClasses.find(c => String(c.classId) === classId)?.className}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary">{availableSubjects.find(s => String(s.subjectId) === subjectId)?.subjectName}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary">{(terms as any[]).find((t: any) => String(t.id) === termId)?.name}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topics */}
        {filtersReady && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm">Syllabus Topics</h2>
                </div>
                {!loadingTopics && sortedTopics.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {(loadingTopics || loadingNotes) && (
                <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
              )}
              {!loadingTopics && !loadingNotes && sortedTopics.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No Published Topics Found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    No published syllabus topics for this combination. Topics must be published before you can add notes.
                  </p>
                </div>
              )}
              {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
                <div className="space-y-2">
                  {sortedTopics.map((topic, idx) => {
                    const note = noteByTopicId.get(topic.id);
                    const cfg  = note ? STATUS_CFG[note.status] : null;
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-3 p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group"
                        onClick={() => handleTopicClick(topic)}
                        data-testid={`topic-row-${topic.id}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                          {topic.orderNumber ?? idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-snug truncate">{topic.name}</p>
                          {note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{note.title}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {note ? <StatusBadge status={note.status} /> : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3" />Add note
                            </span>
                          )}
                          {note && cfg?.canSubmit && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Submit for review"
                              onClick={(e) => { e.stopPropagation(); submitMutation.mutate(note.id); }}
                              data-testid={`button-submit-${note.id}`}>
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {note && cfg?.canDelete && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft?')) deleteMutation.mutate(note.id); }}
                              data-testid={`button-delete-${note.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Placeholder */}
        {!filtersReady && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">Select your Class, Subject & Term</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Your assigned classes and subjects will appear in the dropdowns above.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <NoteEditorDialog
        open={editorOpen} onClose={closeAll}
        note={selNote} topic={selTopic}
        classId={parseInt(classId) || 0}
        subjectId={parseInt(subjectId) || 0}
        termId={parseInt(termId) || 0}
      />
      <NoteViewDialog
        note={viewOpen ? selNote : null}
        onClose={closeAll} onEdit={handleEdit} onSubmit={handleSubmitFromView}
      />
    </div>
  );
}
