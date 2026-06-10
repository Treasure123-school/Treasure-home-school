import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContentRenderer, fmtDate, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import { BookOpen, Target, Printer } from 'lucide-react';

export default function LessonNotePreviewPage() {
  const { id } = useParams<{ id: string }>();

  const { data: note, isLoading } = useQuery<EnrichedNote | null>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/lesson-notes/${id}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: !!id,
    retry: false,
  });

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ['/api/public/settings'],
  });
  const brandColor = settings?.primaryColor || '#3b82f6';

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-10 rounded-lg" />
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
          <p className="text-lg font-semibold">Note Not Found</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            This lesson note could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const contextParts = [note.subjectName, note.className, note.termName].filter(Boolean);
  const date = note.publishedAt || note.createdAt;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4 print:max-w-none print:px-0">

      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          {contextParts.length > 0 && (
            <p className="text-base font-bold leading-snug" style={{ color: brandColor }}>
              {[note.subjectName, note.className].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            By <span className="font-medium text-foreground">School Admin</span>
            {note.termName && <span> · {note.termName}</span>}
            {date && <span> / {fmtDate(date)}</span>}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.print()}
          className="shrink-0 gap-1.5 h-8 text-xs px-2 text-muted-foreground hover:text-foreground mt-0.5"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Print</span>
        </Button>
      </div>

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

      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={false}
      />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
