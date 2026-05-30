import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/lesson-notes/RichTextEditor';
import {
  ArrowLeft, Save, Send, Eye, BookOpen, AlertCircle, CheckCircle,
  FileText, Clock, XCircle, Info,
} from 'lucide-react';

type EnrichedNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; creatorName: string | null;
  subjectName: string | null; className: string | null;
  topicName: string | null; termName: string | null;
  submittedAt: string | null; approvedAt: string | null;
  rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border',                                              icon: FileText    },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',                  icon: Send        },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',              icon: CheckCircle },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                     icon: XCircle     },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',      icon: Eye         },
  archived:  { label: 'Archived',  cls: 'bg-muted text-muted-foreground border',                                              icon: Clock       },
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

function parseQuery(search: string) {
  const p = new URLSearchParams(search);
  return {
    topicId: p.get('topicId') || '',
    classId: p.get('classId') || '',
    subjectId: p.get('subjectId') || '',
    termId: p.get('termId') || '',
    topicName: p.get('topicName') || '',
    back: p.get('back') || '',
  };
}

export default function LessonNoteEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit = !!id;
  const isAdmin = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';

  const query = parseQuery(window.location.search);

  const [title, setTitle]           = useState('');
  const [objectives, setObjectives] = useState('');
  const [content, setContent]       = useState('');
  const [initialized, setInitialized] = useState(false);

  const { data: note, isLoading: noteLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
    enabled: isEdit,
  });

  useEffect(() => {
    if (note && !initialized) {
      setTitle(note.title);
      setObjectives(note.objectives ?? '');
      setContent(note.content ?? '');
      setInitialized(true);
    }
    if (!isEdit && !initialized) {
      setTitle(query.topicName || '');
      setInitialized(true);
    }
  }, [note, isEdit, initialized]);

  const backUrl = query.back || `${basePortal}/lesson-notes`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), content, objectives: objectives.trim() };
      if (isEdit) return (await apiRequest('PUT', `/api/lesson-notes/${id}`, body)).json();
      return (await apiRequest('POST', '/api/lesson-notes', {
        ...body,
        topicId: parseInt(query.topicId),
        classId: parseInt(query.classId),
        subjectId: parseInt(query.subjectId),
        termId: parseInt(query.termId),
      })).json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: isEdit ? 'Changes saved' : 'Note created', description: 'Saved as draft.' });
      if (!isEdit) navigate(`${basePortal}/lesson-notes/edit/${data.id}`);
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      let noteId = id ? parseInt(id) : null;
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title: title.trim(), content, objectives: objectives.trim(),
          topicId: parseInt(query.topicId),
          classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId),
          termId: parseInt(query.termId),
        })).json();
        noteId = created.id;
      } else {
        await apiRequest('PUT', `/api/lesson-notes/${noteId}`, { title: title.trim(), content, objectives: objectives.trim() });
      }
      return (await apiRequest('POST', `/api/lesson-notes/${noteId}/submit`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Submitted for review', description: 'Admin will review your note.' });
      navigate(backUrl);
    },
    onError: (e: any) => toast({ title: 'Submit failed', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      let noteId = id ? parseInt(id) : null;
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title: title.trim(), content, objectives: objectives.trim(),
          topicId: parseInt(query.topicId),
          classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId),
          termId: parseInt(query.termId),
        })).json();
        noteId = created.id;
      } else {
        await apiRequest('PUT', `/api/lesson-notes/${noteId}`, { title: title.trim(), content, objectives: objectives.trim() });
      }
      return (await apiRequest('POST', `/api/lesson-notes/${noteId}/approve-publish`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Published!', description: 'Note is now visible to students.' });
      navigate(backUrl);
    },
    onError: (e: any) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  const busy = saveMutation.isPending || submitMutation.isPending || publishMutation.isPending;
  const canSubmit = !!(title.trim());
  const currentStatus = note?.status;
  const canEdit = !currentStatus || ['draft', 'rejected'].includes(currentStatus) || isAdmin;

  if (isEdit && noteLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)} className="shrink-0 gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {isEdit ? 'Edit Lesson Note' : 'Create Lesson Note'}
              </span>
              {note && <StatusBadge status={note.status} />}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled={!canSubmit || busy} onClick={() => saveMutation.mutate()}
              data-testid="button-save-draft">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </Button>
            {isTeacher && canEdit && (
              <Button size="sm" disabled={!canSubmit || busy} onClick={() => submitMutation.mutate()}
                data-testid="button-submit-review">
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" disabled={!canSubmit || busy} onClick={() => publishMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-publish">
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                {publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Meta info */}
        {(note || query.topicName) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {(note?.topicName || query.topicName) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted border">
                <BookOpen className="w-3 h-3 text-primary" />
                <span className="text-muted-foreground">Topic:</span>
                <span className="font-medium">{note?.topicName || decodeURIComponent(query.topicName)}</span>
              </span>
            )}
            {note?.className && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted border">
                <span className="text-muted-foreground">Class:</span>
                <span className="font-medium">{note.className}</span>
              </span>
            )}
            {note?.subjectName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted border">
                <span className="text-muted-foreground">Subject:</span>
                <span className="font-medium">{note.subjectName}</span>
              </span>
            )}
            {note?.termName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted border">
                <span className="text-muted-foreground">Term:</span>
                <span className="font-medium">{note.termName}</span>
              </span>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {note?.rejectionReason && (
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><strong>Rejected:</strong> {note.rejectionReason}</div>
          </div>
        )}

        {/* Read-only notice for non-editable states */}
        {!canEdit && isTeacher && (
          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>This note is <strong>{currentStatus}</strong> and cannot be edited.</div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="note-title" className="text-sm font-semibold">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson note title…"
            disabled={!canEdit || busy}
            className="text-base h-11"
            data-testid="input-note-title"
          />
        </div>

        {/* Objectives */}
        <div className="space-y-2">
          <Label htmlFor="note-objectives" className="text-sm font-semibold">Learning Objectives</Label>
          <p className="text-xs text-muted-foreground -mt-1">What students will be able to do after this lesson</p>
          <textarea
            id="note-objectives"
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="By the end of this lesson, students will be able to…"
            disabled={!canEdit || busy}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            data-testid="input-note-objectives"
          />
        </div>

        {/* Rich text editor */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Lesson Content</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Use the toolbar to format text, add headings, lists, tables, images, and links
          </p>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your lesson content here…"
            minHeight="400px"
            disabled={!canEdit || busy}
          />
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-between pt-2 pb-8 border-t">
          <Button variant="ghost" onClick={() => navigate(backUrl)} disabled={busy}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to List
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!canSubmit || busy} onClick={() => saveMutation.mutate()}>
              <Save className="w-4 h-4 mr-1.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </Button>
            {isTeacher && canEdit && (
              <Button disabled={!canSubmit || busy} onClick={() => submitMutation.mutate()}>
                <Send className="w-4 h-4 mr-1.5" />
                {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
              </Button>
            )}
            {isAdmin && (
              <Button disabled={!canSubmit || busy} onClick={() => publishMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700">
                <Eye className="w-4 h-4 mr-1.5" />
                {publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
