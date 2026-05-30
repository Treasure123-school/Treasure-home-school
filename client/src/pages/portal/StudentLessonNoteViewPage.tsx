import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import RichTextViewer from '@/components/lesson-notes/RichTextViewer';
import {
  ArrowLeft, BookOpen, Calendar, User, FileText, AlertCircle,
  GraduationCap, Target, Printer,
} from 'lucide-react';

type LessonNote = {
  id: number; topicId: number;
  title: string; content: string | null; objectives: string | null;
  status: string;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
  publishedAt: string | null; createdAt: string;
};

function MetaChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function StudentLessonNoteViewPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [, navigate] = useLocation();

  const { data: note, isLoading, error } = useQuery<LessonNote | null>({
    queryKey: ['/api/lesson-notes/by-topic', topicId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/lesson-notes/by-topic/${topicId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!topicId,
    retry: false,
  });

  const backUrl = '/portal/student/scheme-of-work';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)} className="mb-6 gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Scheme of Work
          </Button>
          <div className="flex flex-col items-center justify-center text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-lg font-semibold">Lesson Note Not Available</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Your teacher hasn't published a lesson note for this topic yet. Check back later.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate(backUrl)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Scheme of Work
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Scheme of Work
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {note.className   && <><span>{note.className}</span><span>›</span></>}
            {note.subjectName && <><span>{note.subjectName}</span><span>›</span></>}
            {note.termName    && <><span>{note.termName}</span><span>›</span></>}
            {note.topicName   && <span className="font-medium text-foreground">{note.topicName}</span>}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">
            {note.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {note.className   && <MetaChip icon={GraduationCap} label="Class"   value={note.className} />}
            {note.subjectName && <MetaChip icon={BookOpen}      label="Subject" value={note.subjectName} />}
            {note.termName    && <MetaChip icon={Calendar}      label="Term"    value={note.termName} />}
            {note.topicName   && <MetaChip icon={FileText}      label="Topic"   value={note.topicName} />}
            {note.creatorName && <MetaChip icon={User}          label="Teacher" value={note.creatorName} />}
            {note.publishedAt && (
              <MetaChip icon={Calendar} label="Published"
                value={new Date(note.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} />
            )}
          </div>
        </div>

        {/* Learning Objectives */}
        {note.objectives && (
          <section className="rounded-xl border bg-primary/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary shrink-0" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Learning Objectives</h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.objectives}</p>
          </section>
        )}

        {/* Lesson Content */}
        {note.content ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lesson Content</h2>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <RichTextViewer html={note.content} />
            </div>
          </section>
        ) : (
          <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">No lesson content has been added yet.</p>
          </div>
        )}

        <div className="pb-12 print:hidden" />
      </div>

      <style>{`
        @media print {
          body { background: white; }
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
