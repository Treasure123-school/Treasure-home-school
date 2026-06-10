import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContentRenderer, fmtDate } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Target, GraduationCap, Calendar,
  Printer, FileText, ArrowLeft,
} from 'lucide-react';

type LessonNote = {
  id: number; topicId: number;
  title: string; content: string | null; objectives: string | null;
  status: string;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
  publishedAt: string | null; createdAt: string;
  hiddenSections?: string[] | null;
};

export default function StudentLessonNoteViewPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [, navigate] = useLocation();

  const backUrl = '/portal/student/scheme-of-work';

  const { data: note, isLoading } = useQuery<LessonNote | null>({
    queryKey: ['/api/lesson-notes/by-topic', topicId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/lesson-notes/by-topic/${topicId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!topicId,
    retry: false,
  });

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ['/api/public/settings'],
  });
  const brandColor = settings?.primaryColor || '#3b82f6';

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!note) {
    return (
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
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Scheme of Work
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 print:max-w-none">

      {/* ── Header ── */}
      <div className="rounded-xl border overflow-hidden">
        {/* Coloured left-accent bar + title area — no background fill */}
        <div className="flex gap-0">
          {/* Brand-colour left stripe */}
          <div className="w-1 shrink-0" style={{ backgroundColor: brandColor }} />

          <div className="flex-1 px-4 pt-4 pb-3">
            {/* Subject + class + term chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {note.subjectName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{ color: brandColor, borderColor: `${brandColor}40`, backgroundColor: `${brandColor}0d` }}>
                  <BookOpen className="w-3 h-3" />{note.subjectName}
                </span>
              )}
              {note.className && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{ color: brandColor, borderColor: `${brandColor}40`, backgroundColor: `${brandColor}0d` }}>
                  <GraduationCap className="w-3 h-3" />{note.className}
                </span>
              )}
              {note.termName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{ color: brandColor, borderColor: `${brandColor}40`, backgroundColor: `${brandColor}0d` }}>
                  <Calendar className="w-3 h-3" />{note.termName}
                </span>
              )}
            </div>

            {/* Note title */}
            <h1 className="text-xl sm:text-2xl font-bold leading-snug text-foreground">
              {note.title}
            </h1>

            {/* Topic subtitle if different from title */}
            {note.topicName && note.topicName.toLowerCase() !== note.title.toLowerCase() && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3 shrink-0" />Topic: {note.topicName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/30 border-t min-w-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            {(note.subjectName || note.className || note.termName) && (
              <p className="text-xs text-muted-foreground leading-snug">
                {[note.subjectName, note.className, note.termName].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground leading-snug">
              By <span className="font-medium text-foreground">School Admin</span>
              {note.publishedAt && (
                <span> / {fmtDate(note.publishedAt)}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="shrink-0 gap-1.5 h-7 text-xs px-2 text-muted-foreground hover:text-foreground print:hidden"
            data-testid="button-print"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* Learning Objectives — for legacy notes that store objectives separately */}
      {note.objectives && (
        <section className="rounded-xl border bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Learning Objectives
            </h2>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.objectives}</p>
        </section>
      )}

      {/* Note body — handles v2 structured sections and v3/legacy HTML */}
      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={false}
      />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
