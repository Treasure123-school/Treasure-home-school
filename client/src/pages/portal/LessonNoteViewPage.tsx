import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import RichTextViewer from '@/components/lesson-notes/RichTextViewer';
import {
  ArrowLeft, Edit, Send, Eye, EyeOff, CheckCircle, XCircle, BookOpen, Calendar,
  User, FileText, Clock, AlertCircle, Printer, GraduationCap,
} from 'lucide-react';

type EnrichedNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; submittedBy: string | null; approvedBy: string | null;
  rejectedBy: string | null; publishedBy: string | null;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
  submittedAt: string | null; approvedAt: string | null;
  rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border',                                            icon: FileText    },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',                icon: Send        },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',            icon: CheckCircle },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                   icon: XCircle     },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',    icon: Eye         },
  archived:  { label: 'Archived',  cls: 'bg-muted text-muted-foreground border',                                           icon: Clock       },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5" />{cfg.label}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MetaChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function LessonNoteViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';

  const { data: note, isLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
  });

  const act = async (action: string, extra?: any) => {
    if (!note) return;
    setBusy(true);
    try {
      if (action === 'approve')         await apiRequest('POST', `/api/lesson-notes/${note.id}/approve`);
      else if (action === 'reject')     await apiRequest('POST', `/api/lesson-notes/${note.id}/reject`, { reason: extra?.reason });
      else if (action === 'publish')    await apiRequest('POST', `/api/lesson-notes/${note.id}/publish`);
      else if (action === 'unpublish')  await apiRequest('POST', `/api/lesson-notes/${note.id}/unpublish`);
      else if (action === 'approve-publish') await apiRequest('POST', `/api/lesson-notes/${note.id}/approve-publish`);
      else if (action === 'submit')     await apiRequest('POST', `/api/lesson-notes/${note.id}/submit`);
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: { approve: 'Approved', reject: 'Rejected', publish: 'Published', unpublish: 'Unpublished', 'approve-publish': 'Approved & Published', submit: 'Submitted' }[action] || 'Done' });
      navigate(`${basePortal}/lesson-notes`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const backUrl = `${basePortal}/lesson-notes`;
  const editUrl = `${basePortal}/lesson-notes/edit/${id}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-medium">Note not found</p>
          <Button variant="outline" onClick={() => navigate(backUrl)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const canEdit = ['draft', 'rejected'].includes(note.status) || isAdmin;
  const isMyNote = note.createdBy === user?.id;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)} className="shrink-0 gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <StatusBadge status={note.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="w-4 h-4" /> Print
            </Button>
            {(isAdmin || (isTeacher && isMyNote && canEdit)) && (
              <Button variant="outline" size="sm" onClick={() => navigate(editUrl)} className="gap-1.5">
                <Edit className="w-4 h-4" /> Edit
              </Button>
            )}
            {/* Admin action buttons */}
            {isAdmin && ['draft', 'submitted', 'rejected'].includes(note.status) && !showReject && (
              <Button size="sm" onClick={() => act('approve')} disabled={busy}
                className="bg-green-600 hover:bg-green-700 gap-1.5" data-testid="button-approve">
                <CheckCircle className="w-4 h-4" /> Approve
              </Button>
            )}
            {isAdmin && ['submitted', 'approved'].includes(note.status) && !showReject && (
              <Button variant="outline" size="sm" onClick={() => setShowReject(true)} disabled={busy}
                className="text-destructive border-destructive/40 gap-1.5" data-testid="button-reject">
                <XCircle className="w-4 h-4" /> Reject
              </Button>
            )}
            {isAdmin && note.status === 'approved' && !showReject && (
              <Button size="sm" onClick={() => act('publish')} disabled={busy} className="gap-1.5" data-testid="button-publish">
                <Eye className="w-4 h-4" /> Publish
              </Button>
            )}
            {isAdmin && ['draft', 'submitted', 'rejected'].includes(note.status) && !showReject && (
              <Button size="sm" onClick={() => act('approve-publish')} disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" data-testid="button-approve-publish">
                <Eye className="w-4 h-4" /> Approve & Publish
              </Button>
            )}
            {isAdmin && note.status === 'published' && (
              <Button variant="outline" size="sm" onClick={() => act('unpublish')} disabled={busy} data-testid="button-unpublish">
                <EyeOff className="w-4 h-4 mr-1.5" /> Unpublish
              </Button>
            )}
            {/* Teacher submit */}
            {isTeacher && isMyNote && ['draft', 'rejected'].includes(note.status) && (
              <Button size="sm" onClick={() => act('submit')} disabled={busy} className="gap-1.5" data-testid="button-submit">
                <Send className="w-4 h-4" /> Submit for Review
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reject inline form */}
      {showReject && (
        <div className="border-b bg-red-50 dark:bg-red-950/20 print:hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-2" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Rejection Reason <span className="text-destructive">*</span></p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this note is being rejected…"
                rows={2}
                className="w-full rounded border border-red-200 bg-white dark:bg-red-950/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                data-testid="input-rejection-reason"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                <Button size="sm" variant="destructive" disabled={!rejectReason.trim() || busy}
                  onClick={() => act('reject', { reason: rejectReason }).then(() => { setShowReject(false); setRejectReason(''); })}>
                  {busy ? 'Rejecting…' : 'Confirm Reject'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Note header */}
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">{note.title}</h1>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {note.className   && <MetaChip icon={GraduationCap} label="Class" value={note.className} />}
            {note.subjectName && <MetaChip icon={BookOpen} label="Subject" value={note.subjectName} />}
            {note.termName    && <MetaChip icon={Calendar} label="Term" value={note.termName} />}
            {note.topicName   && <MetaChip icon={FileText} label="Topic" value={note.topicName} />}
            {note.creatorName && <MetaChip icon={User} label="Teacher" value={note.creatorName} />}
          </div>
        </div>

        {/* Rejection reason */}
        {note.rejectionReason && (
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><strong>Rejection reason:</strong> {note.rejectionReason}</div>
          </div>
        )}

        {/* Audit trail */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/30 border text-xs">
          <div><span className="text-muted-foreground">Created:</span> <strong>{fmt(note.createdAt)}</strong></div>
          {note.submittedAt && <div><span className="text-muted-foreground">Submitted:</span> <strong>{fmt(note.submittedAt)}</strong></div>}
          {note.approvedAt  && <div><span className="text-muted-foreground">Approved:</span>  <strong>{fmt(note.approvedAt)}</strong></div>}
          {note.rejectedAt  && <div><span className="text-muted-foreground">Rejected:</span>  <strong>{fmt(note.rejectedAt)}</strong></div>}
          {note.publishedAt && <div><span className="text-muted-foreground">Published:</span> <strong>{fmt(note.publishedAt)}</strong></div>}
          <div><span className="text-muted-foreground">Last updated:</span> <strong>{fmt(note.updatedAt)}</strong></div>
        </div>

        {/* Learning Objectives */}
        {note.objectives && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Learning Objectives</h2>
            </div>
            <div className="pl-3 border-l-2 border-muted">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.objectives}</p>
            </div>
          </section>
        )}

        {/* Content */}
        {note.content ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lesson Content</h2>
            </div>
            <RichTextViewer html={note.content} className="min-h-[200px]" />
          </section>
        ) : (
          <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
            <FileText className="w-5 h-5 shrink-0" />
            <p className="text-sm">No content has been added yet.</p>
          </div>
        )}

        <div className="pb-12 print:hidden" />
      </div>

      <style>{`
        @media print {
          body { background: white; }
          .lesson-note-viewer { color: black; }
        }
        .lesson-note-viewer h1 { font-size: 1.75rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .lesson-note-viewer h2 { font-size: 1.375rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
        .lesson-note-viewer h3 { font-size: 1.125rem; font-weight: 600; margin: 0.75rem 0 0.35rem; }
        .lesson-note-viewer h4 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.35rem; }
        .lesson-note-viewer p { margin: 0.35rem 0; line-height: 1.65; }
        .lesson-note-viewer ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .lesson-note-viewer ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .lesson-note-viewer li { margin: 0.2rem 0; }
        .lesson-note-viewer table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        .lesson-note-viewer td, .lesson-note-viewer th { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; }
        .lesson-note-viewer th { background: hsl(var(--muted)); font-weight: 600; }
        .lesson-note-viewer a { color: hsl(var(--primary)); text-decoration: underline; }
        .lesson-note-viewer img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.75rem 0; }
        .lesson-note-viewer blockquote { border-left: 4px solid hsl(var(--primary)/0.4); padding-left: 1rem; margin: 0.75rem 0; font-style: italic; color: hsl(var(--muted-foreground)); }
        .lesson-note-viewer hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 1rem 0; }
        .lesson-note-viewer code { background: hsl(var(--muted)); padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; font-size: 0.875em; }
        .lesson-note-viewer pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
        .lesson-note-viewer pre code { background: none; padding: 0; }
        .lesson-note-viewer strong { font-weight: 600; }
        .lesson-note-viewer em { font-style: italic; }
        .lesson-note-viewer u { text-decoration: underline; }
        .lesson-note-viewer s { text-decoration: line-through; }
      `}</style>
    </div>
  );
}
