import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContentRenderer, fmtDate, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Target, GraduationCap, User, Calendar,
  Printer, FileText,
} from 'lucide-react';

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
          <p className="text-lg font-semibold">Note Not Found</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            This lesson note could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 print:max-w-none">

      {/* ── Header card ── */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex gap-0">
          <div className="w-1 shrink-0" style={{ backgroundColor: brandColor }} />

          <div className="flex-1 px-4 pt-4 pb-3">
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

            <h1 className="text-xl sm:text-2xl font-bold leading-snug text-foreground">
              {note.title}
            </h1>

            {note.topicName && note.topicName.toLowerCase() !== note.title.toLowerCase() && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3 shrink-0" />Topic: {note.topicName}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2 bg-muted/30 border-t">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {note.creatorName && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3 shrink-0" />
                <span className="font-medium text-foreground">{note.creatorName}</span>
              </span>
            )}
            {(note.publishedAt || note.createdAt) && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 shrink-0" />
                <span className="font-medium text-foreground">{fmtDate(note.publishedAt || note.createdAt)}</span>
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 h-7 text-xs px-2 print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* ── Learning Objectives ── */}
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

      {/* ── Note body ── */}
      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={false}
      />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
