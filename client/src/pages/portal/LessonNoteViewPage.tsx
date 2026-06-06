import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import RichTextViewer from '@/components/lesson-notes/RichTextViewer';
import { StatusBadge, fmtDate, EnrichedNote, parseNoteContent, isV2Sections } from '@/components/lesson-notes/lessonNoteShared';
import {
  Edit, Send, Eye, EyeOff, CheckCircle, XCircle, BookOpen, Calendar,
  User, FileText, AlertCircle, Printer, GraduationCap, MoreHorizontal,
  Target, Package, Brain, Rocket, BookText, UserCog, Users, ClipboardCheck,
  FileCheck, ExternalLink,
} from 'lucide-react';

// ── Structured content renderer ──────────────────────────────────────────────

const SECTION_VIEW_DEFS = [
  { key: 'objectives',        label: 'Learning Objectives',    icon: Target,        iconBg: 'bg-blue-100',   iconColor: 'text-blue-700',   borderColor: 'border-blue-200',   headerBg: 'bg-blue-50'   },
  { key: 'materials',         label: 'Instructional Materials',icon: Package,       iconBg: 'bg-purple-100', iconColor: 'text-purple-700', borderColor: 'border-purple-200', headerBg: 'bg-purple-50' },
  { key: 'previousKnowledge', label: 'Previous Knowledge',     icon: Brain,         iconBg: 'bg-cyan-100',   iconColor: 'text-cyan-700',   borderColor: 'border-cyan-200',   headerBg: 'bg-cyan-50'   },
  { key: 'introduction',      label: 'Introduction',           icon: Rocket,        iconBg: 'bg-green-100',  iconColor: 'text-green-700',  borderColor: 'border-green-200',  headerBg: 'bg-green-50'  },
  { key: 'content',           label: 'Lesson Content',         icon: BookText,      iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700', borderColor: 'border-indigo-200', headerBg: 'bg-indigo-50' },
  { key: 'teacherActivities', label: "Teacher's Activities",   icon: UserCog,       iconBg: 'bg-orange-100', iconColor: 'text-orange-700', borderColor: 'border-orange-200', headerBg: 'bg-orange-50' },
  { key: 'studentActivities', label: "Students' Activities",   icon: Users,         iconBg: 'bg-emerald-100',iconColor: 'text-emerald-700',borderColor: 'border-emerald-200',headerBg: 'bg-emerald-50'},
  { key: 'evaluation',        label: 'Evaluation',             icon: ClipboardCheck,iconBg: 'bg-rose-100',   iconColor: 'text-rose-700',   borderColor: 'border-rose-200',   headerBg: 'bg-rose-50'   },
  { key: 'assignment',        label: 'Assignment / Homework',  icon: FileCheck,     iconBg: 'bg-amber-100',  iconColor: 'text-amber-700',  borderColor: 'border-amber-200',  headerBg: 'bg-amber-50'  },
  { key: 'references',        label: 'References',             icon: ExternalLink,  iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',   borderColor: 'border-gray-200',   headerBg: 'bg-gray-50'   },
] as const;

function NoteContentRenderer({ note }: { note: EnrichedNote }) {
  // Check for v2 structured sections (uses the fancy section-card UI)
  const sections = isV2Sections(note.content);

  if (sections) {
    const hasAny = SECTION_VIEW_DEFS.some(d => sections[d.key]?.trim());
    if (!hasAny) {
      return (
        <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
          <FileText className="w-5 h-5 shrink-0" />
          <p className="text-sm">No content has been added yet.</p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
        {SECTION_VIEW_DEFS.map((def) => {
          const html = sections[def.key];
          if (!html?.trim()) return null;
          const Icon = def.icon;
          return (
            <div key={def.key}>
              <div className={`flex items-center gap-2.5 px-5 py-3 border-b ${def.borderColor} dark:border-gray-700 ${def.headerBg} dark:bg-transparent`}>
                <div className={`flex items-center justify-center w-7 h-7 ${def.iconBg} dark:bg-gray-700 rounded-lg shrink-0`}>
                  <Icon className={`h-4 w-4 ${def.iconColor} dark:text-gray-300`} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${def.iconColor} dark:text-gray-300`}>
                  {def.label}
                </span>
              </div>
              <div className="px-5 py-4 bg-white dark:bg-gray-900/40">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // v3 (current format) or legacy plain-HTML format:
  // parseNoteContent handles all cases — extracts .html from JSON wrapper or returns raw HTML
  const parsedHtml = parseNoteContent(note.content, note.objectives);

  if (!parsedHtml) {
    return (
      <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
        <FileText className="w-5 h-5 shrink-0" />
        <p className="text-sm">No content has been added yet.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lesson Content</h2>
      </div>
      <RichTextViewer html={parsedHtml} className="min-h-[200px]" />
    </section>
  );
}

function MetaChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
  const [showReject,   setShowReject]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin   = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';
  const listUrl    = `${basePortal}/lesson-notes`;

  const { data: note, isLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
  });

  const act = async (action: string, extra?: any) => {
    if (!note) return;
    setBusy(true);
    try {
      await apiRequest('POST', `/api/lesson-notes/${note.id}/${action}`, extra ?? {});
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      const labels: Record<string, string> = {
        approve: 'Approved', reject: 'Rejected', publish: 'Published',
        unpublish: 'Unpublished', 'approve-publish': 'Approved & Published', submit: 'Submitted',
      };
      toast({ title: labels[action] || 'Done' });
      navigate(listUrl);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const canEdit  = note ? (['draft', 'rejected'].includes(note.status) || isAdmin) : false;
  const isMyNote = note?.createdBy === user?.id;
  const editUrl  = `${basePortal}/lesson-notes/edit/${id}`;

  const adminPrimaryAction = () => {
    if (!note) return null;
    if (['draft', 'submitted', 'rejected'].includes(note.status)) {
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
    <div className="max-w-4xl space-y-8 print:max-w-none">

      {/* ── Sticky actions bar (no breadcrumb) ── */}
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

            {isAdmin && !showReject && adminPrimaryAction()}

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
                  {['draft', 'submitted', 'rejected'].includes(note.status) && (
                    <DropdownMenuItem onClick={() => act('approve')}>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Approve only
                    </DropdownMenuItem>
                  )}
                  {['submitted', 'approved'].includes(note.status) && (
                    <DropdownMenuItem onClick={() => setShowReject(true)} className="text-destructive focus:text-destructive">
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

            {isTeacher && isMyNote && ['draft', 'rejected'].includes(note.status) && (
              <Button size="sm" onClick={() => act('submit')} disabled={busy} className="gap-1.5" data-testid="button-submit">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Submit for Review</span>
                <span className="sm:hidden">Submit</span>
              </Button>
            )}
          </div>
        </div>
      </div>

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

      {/* Note header */}
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground break-words">{note.title}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {note.className   && <MetaChip icon={GraduationCap} label="Class"   value={note.className} />}
          {note.subjectName && <MetaChip icon={BookOpen}      label="Subject" value={note.subjectName} />}
          {note.termName    && <MetaChip icon={Calendar}      label="Term"    value={note.termName} />}
          {note.topicName   && <MetaChip icon={FileText}      label="Topic"   value={note.topicName} />}
          {note.creatorName && <MetaChip icon={User}          label="Teacher" value={note.creatorName} />}
        </div>
      </div>

      {note.rejectionReason && (
        <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Rejection reason:</strong> {note.rejectionReason}</div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/30 border text-xs overflow-hidden">
        <div><span className="text-muted-foreground">Created:</span> <strong>{fmtDate(note.createdAt)}</strong></div>
        {note.submittedAt && <div><span className="text-muted-foreground">Submitted:</span> <strong>{fmtDate(note.submittedAt)}</strong></div>}
        {note.approvedAt  && <div><span className="text-muted-foreground">Approved:</span>  <strong>{fmtDate(note.approvedAt)}</strong></div>}
        {note.rejectedAt  && <div><span className="text-muted-foreground">Rejected:</span>  <strong>{fmtDate(note.rejectedAt)}</strong></div>}
        {note.publishedAt && <div><span className="text-muted-foreground">Published:</span> <strong>{fmtDate(note.publishedAt)}</strong></div>}
        <div><span className="text-muted-foreground">Updated:</span> <strong>{fmtDate(note.updatedAt)}</strong></div>
      </div>

      <NoteContentRenderer note={note} />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
