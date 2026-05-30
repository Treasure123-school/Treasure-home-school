import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
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
  Clock, XCircle, Eye, FileText, ChevronRight, Filter,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
type LessonNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; createdAt: string; updatedAt: string;
};

type Topic = { id: number; name: string; description: string | null; orderNumber: number; classId: number; subjectId: number; termId: number };

// ─── hooks ───────────────────────────────────────────────────────────────────
function useTeacherAssignedClasses() {
  return useQuery<any[]>({
    queryKey: ['/api/teacher/my-assigned-classes'],
    queryFn: async () => (await apiRequest('GET', '/api/teacher/my-assigned-classes')).json(),
    staleTime: 5 * 60 * 1000,
  });
}

function useSubjects() {
  return useQuery<any[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
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
  return useQuery<LessonNote[]>({
    queryKey: ['/api/lesson-notes', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (classId) p.set('classId', classId);
      if (subjectId) p.set('subjectId', subjectId);
      if (termId) p.set('termId', termId);
      return (await apiRequest('GET', `/api/lesson-notes?${p}`)).json();
    },
    enabled: !!(classId || subjectId || termId),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Draft',     color: 'bg-muted text-muted-foreground',        icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Send },
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Eye },
  archived:  { label: 'Archived',  color: 'bg-muted text-muted-foreground',        icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── NoteEditorDialog ─────────────────────────────────────────────────────────
function NoteEditorDialog({
  open, onClose, note, topic, classId, subjectId, termId,
}: {
  open: boolean; onClose: () => void; note: LessonNote | null; topic: Topic | null;
  classId: number; subjectId: number; termId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState(note?.title ?? topic?.name ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [objectives, setObjectives] = useState(note?.objectives ?? '');
  const isEdit = !!note;

  const isLocked = note && !['draft', 'rejected'].includes(note.status);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title, content, objectives };
      if (isEdit) {
        return (await apiRequest('PUT', `/api/lesson-notes/${note!.id}`, body)).json();
      }
      return (await apiRequest('POST', '/api/lesson-notes', {
        ...body, topicId: topic!.id, classId, subjectId, termId,
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: isEdit ? 'Note updated' : 'Note created', description: 'Changes saved as draft.' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!isEdit) {
        const created: LessonNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title, content, objectives, topicId: topic!.id, classId, subjectId, termId,
        })).json();
        return (await apiRequest('POST', `/api/lesson-notes/${created.id}/submit`)).json();
      }
      return (await apiRequest('POST', `/api/lesson-notes/${note!.id}/submit`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Submitted for review', description: 'Your note has been sent to admin.' });
      onClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {isEdit ? 'Edit Lesson Note' : 'Create Lesson Note'}
          </DialogTitle>
          {topic && <p className="text-sm text-muted-foreground">Topic: <strong>{topic.name}</strong></p>}
          {note && <StatusBadge status={note.status} />}
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
            <Input
              id="ln-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson note title…" disabled={isLocked ?? false}
              data-testid="input-lesson-note-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-objectives">Learning Objectives</Label>
            <Textarea
              id="ln-objectives" value={objectives} onChange={(e) => setObjectives(e.target.value)}
              placeholder="What students will be able to do after this lesson…"
              rows={2} disabled={isLocked ?? false}
              data-testid="input-lesson-note-objectives"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-content">Content</Label>
            <Textarea
              id="ln-content" value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Lesson content, explanation, activities…"
              rows={8} disabled={isLocked ?? false}
              data-testid="input-lesson-note-content"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {!isLocked && (
            <>
              <Button
                variant="outline" disabled={!title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-draft"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
              </Button>
              <Button
                disabled={!title.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                data-testid="button-submit-for-review"
              >
                {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NoteViewDialog ───────────────────────────────────────────────────────────
function NoteViewDialog({ note, onClose, onEdit }: { note: LessonNote | null; onClose: () => void; onEdit: () => void }) {
  if (!note) return null;
  return (
    <Dialog open={!!note} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {note.title}
          </DialogTitle>
          <StatusBadge status={note.status} />
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {['draft', 'rejected'].includes(note.status) && (
            <Button onClick={onEdit} data-testid="button-edit-note"><Edit className="w-4 h-4 mr-1.5" />Edit</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function TeacherLessonNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId, setTermId] = useState('');

  const { data: classes = [], isLoading: loadingClasses } = useTeacherAssignedClasses();
  const { data: subjects = [] } = useSubjects();
  const { data: terms = [] } = useTerms();
  const { data: topics = [], isLoading: loadingTopics } = useSyllabusTopics(classId, subjectId, termId);
  const { data: notes = [], isLoading: loadingNotes } = useMyLessonNotes(classId, subjectId, termId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const noteByTopicId = new Map(notes.map((n) => [n.topicId, n]));
  const filtersReady = !!(classId && subjectId && termId);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/lesson-notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Note deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitExistingMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/lesson-notes/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Submitted for review', description: 'Admin will review your note.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleTopicClick = (topic: Topic) => {
    const existingNote = noteByTopicId.get(topic.id) ?? null;
    setSelectedTopic(topic);
    setSelectedNote(existingNote);
    if (existingNote) setViewOpen(true);
    else setEditorOpen(true);
  };

  const handleEdit = () => {
    setViewOpen(false);
    setEditorOpen(true);
  };

  const getFilteredSubjects = () => {
    if (!classId) return subjects;
    const classAssignment = (classes as any[]).find((c: any) => String(c.classId || c.id) === classId);
    if (!classAssignment) return subjects;
    const assignedSubjectIds = classAssignment.subjects?.map((s: any) => s.subjectId || s.id) ?? [];
    if (assignedSubjectIds.length === 0) return subjects;
    return subjects.filter((s: any) => assignedSubjectIds.includes(s.id));
  };

  const getClassName = (id: string) => {
    const c = (classes as any[]).find((c: any) => String(c.classId || c.id) === id);
    return c?.className || c?.name || id;
  };
  const getSubjectName = (id: string) => {
    const s = (subjects as any[]).find((s: any) => String(s.id) === id);
    return s?.name || id;
  };
  const getTermName = (id: string) => {
    const t = (terms as any[]).find((t: any) => String(t.id) === id);
    return t?.name || id;
  };

  const sortedTopics = [...topics].sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0));

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
              <h1 className="text-xl font-bold text-foreground">Lesson Notes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Create and manage lesson notes for your topics</p>
            </div>
          </div>
          {/* Stats */}
          {notes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                const count = notes.filter((n) => n.status === status).length;
                if (!count) return null;
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                    <cfg.icon className="w-3 h-3" />{count} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Filters */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-primary" />
              </div>
              Filter Topics
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Class</Label>
                {loadingClasses ? <Skeleton className="h-10 rounded-md" /> : (
                  <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(''); }}>
                    <SelectTrigger data-testid="select-class">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classes as any[]).map((c: any) => (
                        <SelectItem key={c.classId || c.id} value={String(c.classId || c.id)}>
                          {c.className || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder={!classId ? 'Select class first' : 'Select subject…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredSubjects().map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Term</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger data-testid="select-term">
                    <SelectValue placeholder="Select term…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(terms as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.year ? ` — ${t.year}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filtersReady && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Showing:</span>
                <Badge variant="secondary">{getClassName(classId)}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary">{getSubjectName(subjectId)}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary">{getTermName(termId)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topics list */}
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
                  <Badge variant="secondary" className="text-xs">{sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {(loadingTopics || loadingNotes) && (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              )}
              {!loadingTopics && !loadingNotes && sortedTopics.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No Topics Found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    No published syllabus topics found for this combination. Topics must be published first.
                  </p>
                </div>
              )}
              {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
                <div className="space-y-2">
                  {sortedTopics.map((topic, index) => {
                    const note = noteByTopicId.get(topic.id);
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-3 p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => handleTopicClick(topic)}
                        data-testid={`topic-row-${topic.id}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                          {topic.orderNumber || index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-snug truncate">{topic.name}</p>
                          {note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{note.title}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {note ? <StatusBadge status={note.status} /> : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Add note
                            </span>
                          )}
                          {note && ['draft', 'rejected'].includes(note.status) && (
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); submitExistingMutation.mutate(note.id); }}
                              title="Submit for review"
                              data-testid={`button-submit-${note.id}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {note && note.status === 'draft' && (
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft note?')) deleteMutation.mutate(note.id); }}
                              data-testid={`button-delete-${note.id}`}
                            >
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

        {/* Prompt */}
        {!filtersReady && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">Select Class, Subject & Term</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Filter to see your syllabus topics and manage lesson notes for each one.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <NoteEditorDialog
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setSelectedNote(null); setSelectedTopic(null); }}
        note={selectedNote}
        topic={selectedTopic}
        classId={parseInt(classId) || 0}
        subjectId={parseInt(subjectId) || 0}
        termId={parseInt(termId) || 0}
      />
      <NoteViewDialog
        note={viewOpen ? selectedNote : null}
        onClose={() => { setViewOpen(false); setSelectedNote(null); setSelectedTopic(null); }}
        onEdit={handleEdit}
      />
    </div>
  );
}
