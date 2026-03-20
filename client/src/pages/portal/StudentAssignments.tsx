import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardPen, Clock, User, BookOpen, Calendar, CheckCircle2,
  AlertTriangle, Upload, FileText, Image as ImageIcon, Link2,
  ExternalLink, Star, MessageSquare, AlertCircle, ChevronRight,
  Download, X, Paperclip, Send, Edit3, Award, RotateCcw,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────
type AssignmentRow = {
  id: number;
  title: string;
  instructions: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  teacherFirstName: string | null;
  teacherLastName: string | null;
  dueDate: string;
  dueTime: string;
  maxScore: number;
  attachments: string;
  createdAt: string;
  submissionId: number | null;
  textAnswer: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  submittedAt: string | null;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
};

type Attachment = { name: string; url: string; type: 'pdf' | 'image' | 'doc' | 'link' | 'other' };
type SubmissionStatus = 'pending' | 'submitted' | 'late' | 'graded';
type FilterTab = 'all' | 'pending' | 'submitted' | 'late';

// ── Helpers ──────────────────────────────────────────────────────────────
function getDueDatetime(row: AssignmentRow): Date {
  return new Date(`${row.dueDate}T${row.dueTime || '23:59'}:00`);
}

function getStatus(row: AssignmentRow): SubmissionStatus {
  if (row.gradedAt) return 'graded';
  if (row.submittedAt) {
    const submitted = new Date(row.submittedAt);
    const due = getDueDatetime(row);
    return submitted > due ? 'late' : 'submitted';
  }
  const now = new Date();
  const due = getDueDatetime(row);
  return now > due ? 'late' : 'pending';
}

function isUrgent(row: AssignmentRow): boolean {
  if (row.submittedAt || row.gradedAt) return false;
  const now = new Date();
  const due = getDueDatetime(row);
  const diffMs = due.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 24 * 60 * 60 * 1000;
}

function isPastDue(row: AssignmentRow): boolean {
  return new Date() > getDueDatetime(row);
}

function canEdit(row: AssignmentRow): boolean {
  return !!row.submittedAt && !row.gradedAt && !isPastDue(row);
}

function formatDue(row: AssignmentRow): string {
  const d = new Date(`${row.dueDate}T${row.dueTime || '23:59'}:00`);
  return d.toLocaleDateString('en-NG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatSubmitted(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function parseAttachments(raw: string): Attachment[] {
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function attachmentIcon(type: Attachment['type']) {
  if (type === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (type === 'image') return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (type === 'link') return <Link2 className="h-4 w-4 text-purple-500" />;
  return <Paperclip className="h-4 w-4 text-gray-500" />;
}

function fileIcon(name: string | null) {
  if (!name) return <FileText className="h-5 w-5" />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
  return <FileText className="h-5 w-5 text-gray-500" />;
}

const STATUS_CFG: Record<SubmissionStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',   icon: <Clock className="h-3.5 w-3.5" /> },
  submitted: { label: 'Submitted', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  late:      { label: 'Late',      color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',           icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  graded:    { label: 'Graded',    color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',       icon: <Award className="h-3.5 w-3.5" /> },
};

const SUBJECT_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600', 'from-indigo-500 to-blue-600',
];
function subjectColor(id: number) { return SUBJECT_COLORS[id % SUBJECT_COLORS.length]; }

// ── Main page ─────────────────────────────────────────────────────────────
export default function StudentAssignments() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selected, setSelected] = useState<AssignmentRow | null>(null);

  const { data: assignments = [], isLoading } = useQuery<AssignmentRow[]>({
    queryKey: ['/api/student/assignments'],
  });

  const filtered = assignments.filter(a => {
    const s = getStatus(a);
    if (filter === 'all') return true;
    if (filter === 'submitted') return s === 'submitted' || s === 'graded';
    return s === filter;
  });

  const counts = {
    all: assignments.length,
    pending: assignments.filter(a => getStatus(a) === 'pending').length,
    submitted: assignments.filter(a => ['submitted', 'graded'].includes(getStatus(a))).length,
    late: assignments.filter(a => getStatus(a) === 'late').length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-5 sm:p-6 shadow-xl shadow-indigo-500/20">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
            <ClipboardPen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
            <p className="text-indigo-200 text-sm">Track, submit, and review your work</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', 'pending', 'submitted', 'late'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            data-testid={`button-filter-${tab}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 border ${
              filter === tab
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filter === tab ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <AssignmentSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AssignmentCard key={a.id} row={a} onClick={() => setSelected(a)} />
          ))}
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <AssignmentDetailDialog
          row={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => setSelected(updated)}
        />
      )}
    </div>
  );
}

// ── Assignment Card ───────────────────────────────────────────────────────
function AssignmentCard({ row, onClick }: { row: AssignmentRow; onClick: () => void }) {
  const status = getStatus(row);
  const urgent = isUrgent(row);
  const cfg = STATUS_CFG[status];
  const color = subjectColor(row.subjectName?.charCodeAt(0) ?? 0);
  const teacher = [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(' ') || 'Unknown Teacher';

  return (
    <div
      data-testid={`card-assignment-${row.id}`}
      onClick={onClick}
      className={`group relative flex items-stretch rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-gray-900 ${
        urgent ? 'border-orange-300 dark:border-orange-700 ring-1 ring-orange-200 dark:ring-orange-800' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Left color strip */}
      <div className={`w-1.5 flex-shrink-0 bg-gradient-to-b ${color}`} />

      <div className="flex-1 px-4 py-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Urgency banner */}
            {urgent && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Due soon — submit now!
              </div>
            )}

            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight truncate mb-1.5" data-testid={`text-title-${row.id}`}>
              {row.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {row.subjectName ?? 'Unknown Subject'}
              </span>
              <span className="flex items-center gap-1.5" data-testid={`text-teacher-${row.id}`}>
                <User className="h-3.5 w-3.5" />
                {teacher}
              </span>
              <span className="flex items-center gap-1.5" data-testid={`text-due-${row.id}`}>
                <Calendar className="h-3.5 w-3.5" />
                {formatDue(row)}
              </span>
            </div>

            {/* Score badge if graded */}
            {status === 'graded' && row.score !== null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                  <Star className="h-3.5 w-3.5" />
                  Score: {row.score} / {row.maxScore}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge className={`text-xs font-semibold border ${cfg.color} bg-transparent border-current`} data-testid={`status-assignment-${row.id}`}>
              <span className="mr-1">{cfg.icon}</span>
              {cfg.label}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-gray-600 dark:text-gray-400"
              data-testid={`button-open-${row.id}`}
            >
              {row.submittedAt ? 'View' : 'Submit'}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────────────
function AssignmentDetailDialog({
  row,
  onClose,
  onUpdated,
}: {
  row: AssignmentRow;
  onClose: () => void;
  onUpdated: (updated: AssignmentRow) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'details' | 'submit'>('details');
  const [textAnswer, setTextAnswer] = useState(row.textAnswer || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = getStatus(row);
  const past = isPastDue(row);
  const canSubmit = !past || status === 'pending';
  const editMode = canEdit(row);
  const attachments = parseAttachments(row.attachments);
  const teacher = [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(' ') || 'Unknown Teacher';

  const submitMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (textAnswer.trim()) form.append('textAnswer', textAnswer.trim());
      if (selectedFile) form.append('file', selectedFile);

      const res = await fetch(`/api/student/assignments/${row.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Submission failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/student/assignments'] });
      const updated: AssignmentRow = {
        ...row,
        submissionId: data.submission.id,
        textAnswer: data.submission.textAnswer,
        fileUrl: data.submission.fileUrl,
        fileName: data.submission.fileName,
        fileType: data.submission.fileType,
        submittedAt: data.submission.submittedAt,
      };
      onUpdated(updated);
      setSelectedFile(null);
      setTab('details');
      toast({
        title: data.isLate ? 'Submitted (Late)' : 'Submitted successfully!',
        description: data.isLate ? 'Your submission was received after the deadline.' : 'Your assignment has been submitted.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0" data-testid="dialog-assignment-detail">
        {/* Header strip */}
        <div className={`h-2 w-full rounded-t-2xl bg-gradient-to-r ${subjectColor(row.subjectName?.charCodeAt(0) ?? 0)}`} />

        <div className="p-6 space-y-5">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {row.title}
              </DialogTitle>
              <Badge className={`text-xs font-semibold border ${STATUS_CFG[status].color} bg-transparent border-current flex-shrink-0`}>
                {STATUS_CFG[status].icon}
                <span className="ml-1">{STATUS_CFG[status].label}</span>
              </Badge>
            </div>
          </DialogHeader>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetaChip icon={<BookOpen className="h-4 w-4" />} label="Subject" value={row.subjectName ?? '—'} />
            <MetaChip icon={<User className="h-4 w-4" />} label="Teacher" value={teacher} testId="text-detail-teacher" />
            <MetaChip icon={<Award className="h-4 w-4" />} label="Max Score" value={String(row.maxScore)} />
            <MetaChip
              icon={<Calendar className="h-4 w-4" />}
              label="Due"
              value={formatDue(row)}
              highlight={isUrgent(row)}
              testId="text-detail-due"
            />
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
            {(['details', 'submit'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                data-testid={`button-tab-${t}`}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t === 'details' ? 'Details' : row.submittedAt ? 'My Submission' : 'Submit'}
              </button>
            ))}
          </div>

          {tab === 'details' ? (
            <DetailsTab row={row} attachments={attachments} status={status} />
          ) : (
            <SubmitTab
              row={row}
              status={status}
              canSubmit={canSubmit}
              editMode={editMode}
              past={past}
              textAnswer={textAnswer}
              setTextAnswer={setTextAnswer}
              selectedFile={selectedFile}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onSubmit={() => submitMutation.mutate()}
              isPending={submitMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Details tab ───────────────────────────────────────────────────────────
function DetailsTab({ row, attachments, status }: { row: AssignmentRow; attachments: Attachment[]; status: SubmissionStatus }) {
  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Instructions
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" data-testid="text-instructions">
          {row.instructions || 'No instructions provided.'}
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments
          </h3>
          <div className="space-y-2">
            {attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-attachment-${i}`}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
              >
                {attachmentIcon(att.type)}
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{att.name}</span>
                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Score + Feedback (if graded) */}
      {status === 'graded' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <Star className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Your Score</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-score">
                {row.score ?? '—'} <span className="text-base font-normal text-blue-500">/ {row.maxScore}</span>
              </p>
            </div>
          </div>
          {row.feedback && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Teacher Feedback
              </h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap" data-testid="text-feedback">
                {row.feedback}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Graded on {formatSubmitted(row.gradedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Submit tab ────────────────────────────────────────────────────────────
function SubmitTab({
  row, status, canSubmit, editMode, past,
  textAnswer, setTextAnswer,
  selectedFile, fileInputRef, onFileChange, onRemoveFile,
  onSubmit, isPending,
}: {
  row: AssignmentRow;
  status: SubmissionStatus;
  canSubmit: boolean;
  editMode: boolean;
  past: boolean;
  textAnswer: string;
  setTextAnswer: (v: string) => void;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const alreadySubmitted = !!row.submittedAt;
  const graded = status === 'graded';

  if (graded) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <Award className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">Assignment Graded</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Switch to the Details tab to see your score and feedback.</p>
        </div>
        {row.submittedAt && (
          <div className="text-xs text-gray-400">
            Submitted: {formatSubmitted(row.submittedAt)}
          </div>
        )}
      </div>
    );
  }

  if (past && !alreadySubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">Deadline Passed</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">The due date for this assignment has passed and no submission was made.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing submission info */}
      {alreadySubmitted && !editMode && (
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Submitted</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5" data-testid="text-submitted-at">
              {formatSubmitted(row.submittedAt)}
            </p>
            {row.fileName && (
              <div className="mt-2 flex items-center gap-2">
                {fileIcon(row.fileName)}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{row.fileName}</span>
                {row.fileUrl && (
                  <a href={row.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1">
                    <Download className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
            {row.textAnswer && (
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-3 bg-white dark:bg-gray-900 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800">
                {row.textAnswer}
              </p>
            )}
            {past && !editMode && (
              <p className="text-xs text-gray-400 mt-2">Deadline passed — submission is locked.</p>
            )}
          </div>
        </div>
      )}

      {/* Edit note */}
      {editMode && (
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-3 text-sm text-indigo-700 dark:text-indigo-400">
          <Edit3 className="h-4 w-4 flex-shrink-0" />
          You can edit your submission before the deadline.
        </div>
      )}

      {/* Form (show if not yet submitted, or if editing) */}
      {(!alreadySubmitted || editMode) && (
        <>
          {/* Text answer */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Written Answer <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              data-testid="input-text-answer"
              placeholder="Type your answer here…"
              value={textAnswer}
              onChange={e => setTextAnswer(e.target.value)}
              rows={5}
              className="rounded-xl resize-y"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Attach File <span className="text-gray-400 font-normal">(PDF, DOC, DOCX, image — max 10 MB)</span>
            </label>
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl">
                {fileIcon(selectedFile.name)}
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate" data-testid="text-selected-file">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                <button onClick={onRemoveFile} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="button-attach-file"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">Click to upload a file</span>
                <span className="text-xs text-gray-400">PDF, DOC, DOCX, PNG, JPG</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={onFileChange}
              className="hidden"
              data-testid="input-file-upload"
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={isPending || (!textAnswer.trim() && !selectedFile)}
            data-testid="button-submit-assignment"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 font-semibold"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 animate-spin" />
                Submitting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {editMode ? 'Update Submission' : 'Submit Assignment'}
              </span>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────
function MetaChip({ icon, label, value, highlight = false, testId }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean; testId?: string }) {
  return (
    <div className={`flex flex-col gap-1 p-3 rounded-xl border ${highlight ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {icon}{label}
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug" data-testid={testId}>{value}</p>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; sub: string }> = {
    all:       { title: 'No assignments yet',     sub: 'Your teacher hasn\'t posted any assignments yet.' },
    pending:   { title: 'No pending assignments', sub: 'You\'re all caught up! Nothing due right now.' },
    submitted: { title: 'No submissions yet',     sub: 'Submit an assignment to see it here.' },
    late:      { title: 'No late assignments',    sub: 'Great job — you\'re on top of your work!' },
  };
  const { title, sub } = messages[filter];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-assignments">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
        <ClipboardPen className="h-8 w-8 text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{sub}</p>
    </div>
  );
}

function AssignmentSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border bg-white dark:bg-gray-900 p-4 flex gap-4 items-center">
          <Skeleton className="w-1.5 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
