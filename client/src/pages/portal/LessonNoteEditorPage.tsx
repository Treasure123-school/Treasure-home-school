import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/lesson-notes/RichTextEditor';
import { StatusBadge, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  Save, Send, Eye, AlertCircle, Info,
} from 'lucide-react';

function parseQuery(search: string) {
  const p = new URLSearchParams(search);
  return {
    topicId:     p.get('topicId')     || '',
    classId:     p.get('classId')     || '',
    subjectId:   p.get('subjectId')   || '',
    termId:      p.get('termId')      || '',
    topicName:   p.get('topicName')   ? decodeURIComponent(p.get('topicName')!)   : '',
    className:   p.get('className')   ? decodeURIComponent(p.get('className')!)   : '',
    subjectName: p.get('subjectName') ? decodeURIComponent(p.get('subjectName')!) : '',
    termName:    p.get('termName')    ? decodeURIComponent(p.get('termName')!)    : '',
  };
}

export default function LessonNoteEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit = !!id;
  const isAdmin   = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';
  const listUrl    = `${basePortal}/lesson-notes`;

  const query = parseQuery(window.location.search);

  const [title,       setTitle]       = useState('');
  const [objectives,  setObjectives]  = useState('');
  const [content,     setContent]     = useState('');
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), content, objectives: objectives.trim() };
      if (isEdit) return (await apiRequest('PUT', `/api/lesson-notes/${id}`, body)).json();
      return (await apiRequest('POST', '/api/lesson-notes', {
        ...body,
        topicId:   parseInt(query.topicId),
        classId:   parseInt(query.classId),
        subjectId: parseInt(query.subjectId),
        termId:    parseInt(query.termId),
      })).json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: isEdit ? 'Changes saved' : 'Note created', description: 'Saved as draft.' });
      if (!isEdit) navigate(`${basePortal}/lesson-notes/edit/${data.id}?${new URLSearchParams({ ...query }).toString()}`);
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      let noteId = id ? parseInt(id) : null;
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title: title.trim(), content, objectives: objectives.trim(),
          topicId: parseInt(query.topicId), classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId), termId: parseInt(query.termId),
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
      navigate(listUrl);
    },
    onError: (e: any) => toast({ title: 'Submit failed', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      let noteId = id ? parseInt(id) : null;
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          title: title.trim(), content, objectives: objectives.trim(),
          topicId: parseInt(query.topicId), classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId), termId: parseInt(query.termId),
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
      navigate(listUrl);
    },
    onError: (e: any) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  const busy = saveMutation.isPending || submitMutation.isPending || publishMutation.isPending;
  const canSave     = !!(title.trim());
  const currentStatus = note?.status;
  const canEdit     = !currentStatus || ['draft', 'rejected'].includes(currentStatus) || isAdmin;

  const primaryAction = isTeacher ? (
    <Button
      size="sm"
      disabled={!canSave || busy || !canEdit}
      onClick={() => submitMutation.mutate()}
      data-testid="button-submit-review"
      className="shrink-0"
    >
      <Send className="w-3.5 h-3.5 mr-1.5" />
      <span className="hidden sm:inline">{submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}</span>
      <span className="sm:hidden">{submitMutation.isPending ? '…' : 'Submit'}</span>
    </Button>
  ) : isAdmin ? (
    <Button
      size="sm"
      disabled={!canSave || busy}
      onClick={() => publishMutation.mutate()}
      className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
      data-testid="button-publish"
    >
      <Eye className="w-3.5 h-3.5 mr-1.5" />
      <span className="hidden sm:inline">{publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}</span>
      <span className="sm:hidden">{publishMutation.isPending ? '…' : 'Publish'}</span>
    </Button>
  ) : null;

  return (
    <div className="max-w-4xl pb-10">

      {/* ── Loading skeleton ── */}
      {isEdit && noteLoading && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* ── Editor form ── */}
      {(!isEdit || !noteLoading) && (
        <Card className="shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-6">

            {/* Status badge */}
            {note && (
              <div className="flex items-center gap-2">
                <StatusBadge status={note.status} />
              </div>
            )}

            {note?.rejectionReason && (
              <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div><strong>Rejected:</strong> {note.rejectionReason}</div>
              </div>
            )}

            {!canEdit && isTeacher && (
              <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>This note is <strong>{currentStatus}</strong> and cannot be edited.</div>
              </div>
            )}

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

            {canEdit && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  disabled={!canSave || busy}
                  onClick={() => saveMutation.mutate()}
                  data-testid="button-save-draft-bottom"
                  className="w-full sm:w-auto"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
                </Button>
                {isTeacher && (
                  <Button
                    disabled={!canSave || busy}
                    onClick={() => submitMutation.mutate()}
                    className="w-full sm:w-auto"
                    data-testid="button-submit-bottom"
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    disabled={!canSave || busy}
                    onClick={() => publishMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                    data-testid="button-publish-bottom"
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    {publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
