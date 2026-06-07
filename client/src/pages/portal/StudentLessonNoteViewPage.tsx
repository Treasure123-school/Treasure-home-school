import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaChip, NoteContentRenderer } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Calendar, User, FileText, Target, Printer, GraduationCap,
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
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
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
          Back to Scheme of Work
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8 print:max-w-none">

      {/* Header row */}
      <div className="space-y-4">
        <div className="flex items-center justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {note.className   && <MetaChip icon={GraduationCap} label="Class"     value={note.className} />}
          {note.subjectName && <MetaChip icon={BookOpen}      label="Subject"   value={note.subjectName} />}
          {note.topicName   && <MetaChip icon={FileText}      label="Topic"     value={note.topicName} />}
          {note.termName    && <MetaChip icon={Calendar}      label="Term"      value={note.termName} />}
          {note.creatorName && <MetaChip icon={User}          label="Teacher"   value={note.creatorName} />}
          {note.publishedAt && (
            <MetaChip
              icon={Calendar}
              label="Published"
              value={new Date(note.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            />
          )}
        </div>
      </div>

      {/* Learning Objectives (standalone, from old-format notes) */}
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

      {/* Shared note body — handles both v2 structured sections and v3/legacy HTML */}
      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={false}
      />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
