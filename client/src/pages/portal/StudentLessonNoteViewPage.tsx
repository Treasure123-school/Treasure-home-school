import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContentRenderer, fmtDate } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Target, GraduationCap, User, Calendar,
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

// Subtle decorative pattern used in the banner
function HexPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="hex" x="0" y="0" width="40" height="46" patternUnits="userSpaceOnUse">
          <path
            d="M20 2 L38 12 L38 34 L20 44 L2 34 L2 12 Z"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  );
}

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

  // Derive a slightly darker shade for gradient depth
  const gradientStyle = {
    background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 60%, ${brandColor}99 100%)`,
  };

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
    <div className="max-w-3xl space-y-6 print:max-w-none">

      {/* ── Rich header card ── */}
      <div className="rounded-2xl overflow-hidden border shadow-md print:shadow-none">

        {/* Gradient banner */}
        <div className="relative px-6 pt-5 pb-7 overflow-hidden" style={gradientStyle}>
          <HexPattern />

          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          {/* Subject + class badges */}
          <div className="relative flex flex-wrap gap-2 mb-4">
            {note.subjectName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold ring-1 ring-white/30">
                <BookOpen className="w-3.5 h-3.5" />
                {note.subjectName}
              </span>
            )}
            {note.className && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold ring-1 ring-white/30">
                <GraduationCap className="w-3.5 h-3.5" />
                {note.className}
              </span>
            )}
            {note.termName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold ring-1 ring-white/30">
                <Calendar className="w-3.5 h-3.5" />
                {note.termName}
              </span>
            )}
          </div>

          {/* Note title */}
          <h1 className="relative text-2xl sm:text-3xl font-bold text-white leading-snug drop-shadow-sm">
            {note.title}
          </h1>

          {/* Topic label if it differs from the note title */}
          {note.topicName && note.topicName.toLowerCase() !== note.title.toLowerCase() && (
            <p className="relative mt-1.5 text-sm text-white/75 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              Topic: {note.topicName}
            </p>
          )}
        </div>

        {/* Footer meta bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-muted/40 border-t">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {note.creatorName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium text-foreground">{note.creatorName}</span>
              </span>
            )}
            {note.publishedAt && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Published <span className="font-medium text-foreground">{fmtDate(note.publishedAt)}</span>
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 h-8 text-xs print:hidden"
            data-testid="button-print"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* Learning Objectives — for legacy notes that store objectives separately */}
      {note.objectives && (
        <section className="rounded-xl border bg-primary/5 p-5 space-y-3">
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
