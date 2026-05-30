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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen, CheckCircle, XCircle, Eye, Send, FileText, Clock, ClipboardCheck,
  AlertCircle, Filter, Search, Edit, Trash2, Plus, User, Calendar,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
type EnrichedNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; submittedBy: string | null; approvedBy: string | null;
  rejectedBy: string | null; publishedBy: string | null;
  submittedAt: string | null; approvedAt: string | null;
  rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
};

// ─── hooks ───────────────────────────────────────────────────────────────────
function useLessonNotes(filters: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== '_all'));
  const p     = new URLSearchParams(clean);
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
  return useQuery<any[]>({ queryKey: ['/api/subjects'], queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(), staleTime: 5 * 60 * 1000 });
}
function useClasses() {
  return useQuery<any[]>({ queryKey: ['/api/classes'],   queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),   staleTime: 5 * 60 * 1000 });
}
function useTerms() {
  return useQuery<any[]>({ queryKey: ['/api/terms'],     queryFn: async () => (await apiRequest('GET', '/api/terms')).json(),     staleTime: 10 * 60 * 1000 });
}
function useSyllabusTopics(classId: string, subjectId: string, termId: string) {
  return useQuery<any[]>({
    queryKey: ['/api/syllabus-topics', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams({ classId, subjectId, termId, isPublished: 'true' });
      return (await apiRequest('GET', `/api/syllabus-topics?${p}`)).json();
    },
    enabled: !!(classId && classId !== '_all' && subjectId && subjectId !== '_all' && termId && termId !== '_all'),
    staleTime: 3 * 60 * 1000,
  });
}

// ─── status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border border-border',                                         icon: FileText    },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',                            icon: Send        },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',                        icon: CheckCircle },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                                icon: XCircle     },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',                icon: Eye         },
  archived:  { label: 'Archived',  cls: 'bg-muted text-muted-foreground border border-border',                                         icon: Clock       },
};

function StatusBadge({ status }: { status: string }) {
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── NoteDetailDialog ─────────────────────────────────────────────────────────
function NoteDetailDialog({
  note, onClose, onAction,
}: {
  note: EnrichedNote | null; onClose: () => void;
  onAction: (action: string, note: EnrichedNote, extra?: any) => Promise<void>;
}) {
  const [rejectInput, setRejectInput] = useState('');
  const [showReject,  setShowReject]  = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editTitle,   setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [editObj,     setEditObj]     = useState('');
  const [busy,        setBusy]        = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  if (!note) return null;

  const startEdit = () => { setEditTitle(note.title); setEditContent(note.content ?? ''); setEditObj(note.objectives ?? ''); setEditing(true); };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await apiRequest('PUT', `/api/lesson-notes/${note.id}`, { title: editTitle, content: editContent, objectives: editObj });
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Note updated' });
      setEditing(false);
      onClose();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const act = async (action: string, extra?: any) => {
    setBusy(true);
    try { await onAction(action, note, extra); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!note} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <span className="flex-1 min-w-0">{editing ? 'Edit Lesson Note' : note.title}</span>
          </DialogTitle>
          {!editing && (
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <StatusBadge status={note.status} />
              {note.className   && <Badge variant="outline" className="text-xs">{note.className}</Badge>}
              {note.subjectName && <Badge variant="outline" className="text-xs">{note.subjectName}</Badge>}
              {note.termName    && <Badge variant="outline" className="text-xs">{note.termName}</Badge>}
            </div>
          )}
        </DialogHeader>

        {/* Edit form */}
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} data-testid="edit-title" />
            </div>
            <div className="space-y-1.5">
              <Label>Learning Objectives</Label>
              <Textarea value={editObj} onChange={e => setEditObj(e.target.value)} rows={2} data-testid="edit-objectives" />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={7} data-testid="edit-content" />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
              <Button onClick={saveEdit} disabled={!editTitle.trim() || busy} data-testid="button-save-edit">
                {busy ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* View mode */}
        {!editing && (
          <>
            {/* Audit trail */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/30 text-xs">
              <div><span className="text-muted-foreground">Teacher:</span> <strong>{note.creatorName ?? 'Unknown'}</strong></div>
              <div><span className="text-muted-foreground">Topic:</span> {note.topicName ?? '—'}</div>
              <div><span className="text-muted-foreground">Created:</span> {fmtDate(note.createdAt)}</div>
              {note.submittedAt && <div><span className="text-muted-foreground">Submitted:</span> {fmtDate(note.submittedAt)}</div>}
              {note.approvedAt  && <div><span className="text-muted-foreground">Approved:</span>  {fmtDate(note.approvedAt)}</div>}
              {note.rejectedAt  && <div><span className="text-muted-foreground">Rejected:</span>  {fmtDate(note.rejectedAt)}</div>}
              {note.publishedAt && <div><span className="text-muted-foreground">Published:</span> {fmtDate(note.publishedAt)}</div>}
              <div><span className="text-muted-foreground">Updated:</span> {fmtDate(note.updatedAt)}</div>
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

            {/* Inline reject input */}
            {showReject && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <Label className="text-sm">Rejection Reason <span className="text-destructive">*</span></Label>
                <Textarea value={rejectInput} onChange={e => setRejectInput(e.target.value)}
                  placeholder="Explain why this note is being rejected…" rows={3}
                  data-testid="input-rejection-reason" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectInput(''); }}>Cancel</Button>
                  <Button size="sm" variant="destructive" disabled={!rejectInput.trim() || busy}
                    onClick={() => act('reject', { reason: rejectInput }).then(() => { setShowReject(false); setRejectInput(''); })}>
                    {busy ? 'Rejecting…' : 'Confirm Reject'}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button variant="outline" onClick={startEdit} disabled={busy} data-testid="button-edit">
                <Edit className="w-4 h-4 mr-1.5" />Edit
              </Button>
              {['draft', 'rejected', 'submitted'].includes(note.status) && !showReject && (
                <Button onClick={() => act('approve')} disabled={busy} className="bg-green-600 hover:bg-green-700" data-testid="button-approve">
                  <CheckCircle className="w-4 h-4 mr-1.5" />Approve
                </Button>
              )}
              {['submitted', 'approved'].includes(note.status) && !showReject && (
                <Button variant="outline" className="text-destructive border-destructive/40"
                  onClick={() => setShowReject(true)} disabled={busy} data-testid="button-reject">
                  <XCircle className="w-4 h-4 mr-1.5" />Reject
                </Button>
              )}
              {note.status === 'approved' && !showReject && (
                <Button onClick={() => act('publish')} disabled={busy} data-testid="button-publish">
                  <Eye className="w-4 h-4 mr-1.5" />Publish
                </Button>
              )}
              {['draft', 'rejected', 'submitted'].includes(note.status) && !showReject && (
                <Button onClick={() => act('approve-publish')} disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-approve-publish">
                  <Eye className="w-4 h-4 mr-1.5" />Approve & Publish
                </Button>
              )}
              {note.status === 'published' && (
                <Button variant="outline" onClick={() => act('unpublish')} disabled={busy} data-testid="button-unpublish">
                  Unpublish
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CreateNoteDialog ─────────────────────────────────────────────────────────
function CreateNoteDialog({ open, onClose, classes, subjects, terms }: {
  open: boolean; onClose: () => void;
  classes: any[]; subjects: any[]; terms: any[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [classId,    setClassId]    = useState('');
  const [subjectId,  setSubjectId]  = useState('');
  const [termId,     setTermId]     = useState('');
  const [topicId,    setTopicId]    = useState('');
  const [title,      setTitle]      = useState('');
  const [content,    setContent]    = useState('');
  const [objectives, setObjectives] = useState('');
  const [busy,       setBusy]       = useState(false);

  const { data: topics = [] } = useSyllabusTopics(classId, subjectId, termId);

  const reset = () => {
    setClassId(''); setSubjectId(''); setTermId(''); setTopicId('');
    setTitle(''); setContent(''); setObjectives('');
  };

  const handleCreate = async (publish: boolean) => {
    setBusy(true);
    try {
      const created = await (await apiRequest('POST', '/api/lesson-notes', {
        topicId: parseInt(topicId), classId: parseInt(classId),
        subjectId: parseInt(subjectId), termId: parseInt(termId),
        title: title.trim(), content: content.trim(), objectives: objectives.trim(),
      })).json();
      if (publish) {
        await apiRequest('POST', `/api/lesson-notes/${created.id}/approve-publish`);
      }
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes/stats'] });
      toast({ title: publish ? 'Note created and published' : 'Note created as draft' });
      reset(); onClose();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />Create Lesson Note
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(''); setTopicId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subject</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setTopicId(''); }} disabled={!classId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Term</Label>
              <Select value={termId} onValueChange={(v) => { setTermId(v); setTopicId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Topic <span className="text-destructive">*</span></Label>
            <Select value={topicId} onValueChange={setTopicId} disabled={!classId || !subjectId || !termId}>
              <SelectTrigger><SelectValue placeholder={(!classId || !subjectId || !termId) ? 'Select class, subject & term first' : topics.length === 0 ? 'No published topics found' : 'Select topic…'} /></SelectTrigger>
              <SelectContent>
                {(topics as any[]).sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0)).map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.orderNumber ? `${t.orderNumber}. ` : ''}{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Lesson note title…" data-testid="create-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Learning Objectives</Label>
            <Textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={2} placeholder="What students will learn…" />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={7} placeholder="Lesson content…" />
          </div>
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</Button>
          <Button variant="outline" disabled={!topicId || !title.trim() || busy} onClick={() => handleCreate(false)}>
            {busy ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button disabled={!topicId || !title.trim() || busy} onClick={() => handleCreate(true)}
            className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-create-publish">
            {busy ? 'Publishing…' : <><Eye className="w-4 h-4 mr-1.5" />Create & Publish</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NoteRow ──────────────────────────────────────────────────────────────────
function NoteRow({ note, onView, onAction }: {
  note: EnrichedNote;
  onView: (n: EnrichedNote) => void;
  onAction: (action: string, n: EnrichedNote, extra?: any) => Promise<void>;
}) {
  const [showReject,  setShowReject]  = useState(false);
  const [rejectInput, setRejectInput] = useState('');
  const [expanded,    setExpanded]    = useState(false);
  const { toast } = useToast();

  const act = async (action: string, extra?: any) => {
    try { await onAction(action, note, extra); }
    catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`note-row-${note.id}`}>
      <div className="flex items-start gap-3 p-4">
        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={note.status} />
            {note.className   && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.className}</span>}
            {note.subjectName && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.subjectName}</span>}
            {note.termName    && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{note.termName}</span>}
          </div>
          <p className="font-semibold text-sm leading-snug">{note.title}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {note.topicName && (
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{note.topicName}</span>
            )}
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />{note.creatorName ?? 'Unknown teacher'}
            </span>
            {note.submittedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />Submitted {fmtDate(note.submittedAt)}
              </span>
            )}
            {!note.submittedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />Created {fmtDate(note.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs"
            onClick={() => setExpanded(e => !e)} data-testid={`button-expand-${note.id}`}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs"
            onClick={() => onView(note)} data-testid={`button-view-${note.id}`}>
            <Eye className="w-3.5 h-3.5 mr-1" />View
          </Button>
          {['draft', 'rejected', 'submitted'].includes(note.status) && (
            <Button size="sm" className="h-8 px-2.5 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => act('approve')} data-testid={`button-approve-${note.id}`}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
            </Button>
          )}
          {note.status === 'approved' && (
            <Button size="sm" className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => act('publish')} data-testid={`button-publish-${note.id}`}>
              <Eye className="w-3.5 h-3.5 mr-1" />Publish
            </Button>
          )}
          {['draft', 'rejected', 'submitted'].includes(note.status) && (
            <Button size="sm" className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => act('approve-publish')} data-testid={`button-approve-publish-${note.id}`}>
              <Eye className="w-3.5 h-3.5 mr-1" />Publish
            </Button>
          )}
          {['submitted', 'approved'].includes(note.status) && !showReject && (
            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={() => setShowReject(true)} data-testid={`button-reject-${note.id}`}>
              <XCircle className="w-3.5 h-3.5 mr-1" />Reject
            </Button>
          )}
          {note.status === 'published' && (
            <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs"
              onClick={() => act('unpublish')} data-testid={`button-unpublish-${note.id}`}>
              Unpublish
            </Button>
          )}
        </div>
      </div>

      {/* Rejection rejection input */}
      {showReject && (
        <div className="mx-4 mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
          <Textarea value={rejectInput} onChange={e => setRejectInput(e.target.value)}
            placeholder="Rejection reason (required)…" rows={2}
            data-testid="input-inline-reject-reason" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectInput(''); }}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={!rejectInput.trim()}
              onClick={() => act('reject', { reason: rejectInput }).then(() => { setShowReject(false); setRejectInput(''); })}>
              Confirm Reject
            </Button>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (note.objectives || note.content) && (
        <div className="border-t mx-4 mb-4 pt-3 space-y-3">
          {note.objectives && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Learning Objectives</p>
              <p className="text-sm whitespace-pre-wrap line-clamp-4">{note.objectives}</p>
            </div>
          )}
          {note.content && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Content</p>
              <p className="text-sm whitespace-pre-wrap line-clamp-6">{note.content}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AdminLessonNoteReview() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterClass,   setFilterClass]   = useState('_all');
  const [filterSubject, setFilterSubject] = useState('_all');
  const [filterTerm,    setFilterTerm]    = useState('_all');
  const [filterStatus,  setFilterStatus]  = useState('_all');
  const [search,        setSearch]        = useState('');
  const [selNote,       setSelNote]       = useState<EnrichedNote | null>(null);
  const [createOpen,    setCreateOpen]    = useState(false);

  const { data: stats }      = useLessonNotesStats();
  const { data: subjects = [] } = useSubjects();
  const { data: classes  = [] } = useClasses();
  const { data: terms    = [] } = useTerms();

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
    try {
      await apiRequest('POST', `/api/lesson-notes/${note.id}/${action}`, extra ?? {});
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes/stats'] });
      const labels: Record<string, string> = {
        approve: 'Approved', reject: 'Rejected',
        publish: 'Published', unpublish: 'Unpublished', 'approve-publish': 'Approved & Published',
      };
      toast({ title: labels[action] ?? 'Done', description: 'Note status updated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      throw e;
    }
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

  const STAT_CARDS = [
    { label: 'Total',          value: stats?.total     ?? 0, cls: '',                                                                                     Icon: BookOpen,    tc: '' },
    { label: 'Pending Review', value: stats?.submitted ?? 0, cls: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',                   Icon: Send,        tc: 'text-blue-700 dark:text-blue-400' },
    { label: 'Approved',       value: stats?.approved  ?? 0, cls: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',               Icon: CheckCircle, tc: 'text-green-700 dark:text-green-400' },
    { label: 'Published',      value: stats?.published ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',       Icon: Eye,         tc: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Rejected',       value: stats?.rejected  ?? 0, cls: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',                       Icon: XCircle,     tc: 'text-red-700 dark:text-red-400' },
  ];

  const renderList = (list: EnrichedNote[], emptyIcon: any, emptyTitle: string, emptyMsg: string) => {
    if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>;
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
          <NoteRow key={note.id} note={note} onView={setSelNote} onAction={handleAction} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="admin-lesson-notes">

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Lesson Notes Review</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage, approve, and publish teacher lesson notes</p>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-note">
              <Plus className="w-4 h-4 mr-1.5" />Create Note
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map(({ label, value, cls, Icon, tc }) => (
            <Card key={label} className={`shadow-sm border ${cls}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
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
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-9" data-testid="filter-class"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All classes</SelectItem>
                  {classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="h-9" data-testid="filter-subject"><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All subjects</SelectItem>
                  {subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTerm} onValueChange={setFilterTerm}>
                <SelectTrigger className="h-9" data-testid="filter-term"><SelectValue placeholder="All terms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All terms</SelectItem>
                  {terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9" data-testid="filter-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
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
              <Input className="pl-9 h-9" placeholder="Search by title, teacher, or topic…"
                value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="review">
          <TabsList>
            <TabsTrigger value="review" data-testid="tab-review">
              Review Queue
              {(stats?.submitted ?? 0) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {stats?.submitted}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved"  data-testid="tab-approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published">Published ({published.length})</TabsTrigger>
            <TabsTrigger value="all"       data-testid="tab-all">All ({filtered.length})</TabsTrigger>
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

      <NoteDetailDialog note={selNote} onClose={() => setSelNote(null)} onAction={handleAction} />
      <CreateNoteDialog open={createOpen} onClose={() => setCreateOpen(false)}
        classes={classes} subjects={subjects} terms={terms} />
    </div>
  );
}
