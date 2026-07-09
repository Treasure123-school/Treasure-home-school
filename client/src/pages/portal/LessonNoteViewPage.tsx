import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  StatusBadge, fmtDate, NoteContentRenderer, NotePageHeader, EnrichedNote, isV2Sections,
} from '@/components/lesson-notes/lessonNoteShared';
import {
  Edit, Send, Eye, EyeOff, CheckCircle, XCircle, BookOpen,
  FileText, AlertCircle, Printer, MoreHorizontal,
} from 'lucide-react';

export default function LessonNoteViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showReject,   setShowReject]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReturn,   setShowReturn]   = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin   = user?.roleId === ROLE_IDS.ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';
  const listUrl    = `${basePortal}/lesson-notes`;

  const { data: note, isLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
  });

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ['/api/public/settings'],
  });
  const brandColor = settings?.primaryColor || '#3b82f6';

  const toggleMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!note) return;
      const current = note.hiddenSections ?? [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      await apiRequest('PATCH', `/api/lesson-notes/${note.id}/hidden-sections`, { hiddenSections: next });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/lesson-notes', id] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const act = async (action: string, extra?: any) => {
    if (!note) return;
    setBusy(true);
    try {
      await apiRequest('POST', `/api/lesson-notes/${note.id}/${action}`, extra ?? {});
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      const labels: Record<string, string> = {
        approve: 'Approved', reject: 'Rejected', return: 'Returned for revision', publish: 'Published',
        unpublish: 'Unpublished', 'approve-publish': 'Approved & Published', submit: 'Submitted',
      };
      toast({ title: 'Success', description: labels[action] || 'Action completed.' });
      navigate(listUrl);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  // Teacher-editable statuses must match the backend TEACHER_EDITABLE_STATUSES constant
  const TEACHER_EDITABLE_STATUSES = ['draft', 'rejected', 'returned'] as const;
  const canEdit  = note ? ((TEACHER_EDITABLE_STATUSES as readonly string[]).includes(note.status) || isAdmin) : false;
  const isMyNote = note?.createdBy === user?.id;
  const editUrl  = `${basePortal}/lesson-notes/edit/${id}`;

  const canToggleSections = note ? (isAdmin || (isTeacher && isMyNote)) && isV2Sections(note.content) !== null : false;

  const adminPrimaryAction = () => {
    if (!note) return null;
    if (['draft', 'submitted', 'rejected', 'returned'].includes(note.status)) {
      return (
        <Button size="sm" disabled={busy} onClick={() => act('approve-publish')}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shrink-0" data-testid="button-approve-publish">
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Approve & Publish</span>
          <span className="sm:hidden">Publish</span>
        </Button>
      );
    }
    if (note.status === 'approved') {
      return (
        <Button size="sm" disabled={busy} onClick={() => act('publish')}
          className="gap-1.5 shrink-0" data-testid="button-publish">
          <Eye className="w-4 h-4" /> Publish
        </Button>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 space-y-3">
        <BookOpen className="w-12 h-12 text-muted-foreground/30" />
        <p className="font-medium">Note not found</p>
        <Button variant="outline" onClick={() => navigate(listUrl)}>Back to List</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl print:max-w-none">

      {/* ── Sticky actions bar ── */}
      <div className="sticky top-0 z-10 -mx-2 sm:-mx-4 md:-mx-6 px-2 sm:px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {note && <StatusBadge status={note.status} />}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => window.print()} className="hidden sm:inline-flex gap-1.5 print:hidden">
              <Printer className="w-4 h-4" /> Print
            </Button>
            {(isAdmin || (isTeacher && isMyNote && canEdit)) && (
              <Button variant="outline" size="sm" onClick={() => navigate(editUrl)} className="gap-1.5">
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}

            {isAdmin && !showReject && !showReturn && adminPrimaryAction()}

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-8 h-8 p-0" disabled={busy}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.print()} className="sm:hidden">
                    <Printer className="w-4 h-4 mr-2" /> Print
                  </DropdownMenuItem>
                  {['draft', 'submitted', 'rejected', 'returned'].includes(note.status) && (
                    <DropdownMenuItem onClick={() => act('approve')}>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Approve only
                    </DropdownMenuItem>
                  )}
                  {['submitted', 'approved'].includes(note.status) && (
                    <DropdownMenuItem
                      onClick={() => { setShowReturn(true); setShowReject(false); }}
                      className="text-amber-600 focus:text-amber-700"
                      data-testid="button-return-for-revision"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" /> Return for Revision
                    </DropdownMenuItem>
                  )}
                  {['submitted', 'approved', 'returned'].includes(note.status) && (
                    <DropdownMenuItem
                      onClick={() => { setShowReject(true); setShowReturn(false); }}
                      className="text-destructive focus:text-destructive"
                      data-testid="button-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </DropdownMenuItem>
                  )}
                  {note.status === 'published' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => act('unpublish')} className="text-destructive focus:text-destructive">
                        <EyeOff className="w-4 h-4 mr-2" /> Unpublish
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isTeacher && isMyNote && (TEACHER_EDITABLE_STATUSES as readonly string[]).includes(note.status) && (
              <Button size="sm" onClick={() => act('submit')} disabled={busy} className="gap-1.5" data-testid="button-submit">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Submit for Review</span>
                <span className="sm:hidden">Submit</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Padded reading area (below sticky bar) ── */}
      <div className="px-4 sm:px-6 pt-6 space-y-8 print:px-0">

      {/* Reject inline form */}
      {showReject && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 print:hidden">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Rejection reason <span className="text-destructive">*</span>
              </p>
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
                <Button size="sm" variant="destructive"
                  disabled={!rejectReason.trim() || busy}
                  onClick={() => act('reject', { reason: rejectReason }).then(() => { setShowReject(false); setRejectReason(''); })}>
                  {busy ? 'Rejecting…' : 'Confirm Reject'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return for Revision inline form */}
      {showReturn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 print:hidden">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Return reason / revision notes <span className="text-destructive">*</span>
              </p>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Describe what the teacher should revise before resubmitting…"
                rows={2}
                className="w-full rounded border border-amber-200 bg-white dark:bg-amber-950/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                data-testid="input-return-reason"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowReturn(false); setReturnReason(''); }}>Cancel</Button>
                <Button size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={!returnReason.trim() || busy}
                  onClick={() => act('return', { reason: returnReason }).then(() => { setShowReturn(false); setReturnReason(''); })}
                  data-testid="button-confirm-return"
                >
                  {busy ? 'Returning…' : 'Return for Revision'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <NotePageHeader note={note} brandColor={brandColor} date={note.createdAt} />
      </div>

      {note.rejectionReason && note.status === 'rejected' && (
        <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Rejection reason:</strong> {note.rejectionReason}</div>
        </div>
      )}

      {note.rejectionReason && note.status === 'returned' && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Revision notes from admin:</strong> {note.rejectionReason}</div>
        </div>
      )}

      {/* Shared content renderer */}
      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={canToggleSections}
        onToggleSection={(key) => toggleMutation.mutate(key)}
        toggling={toggleMutation.isPending}
      />

      <div className="pb-12 print:hidden" />
      </div>{/* end padded reading area */}
    </div>
  );
}
