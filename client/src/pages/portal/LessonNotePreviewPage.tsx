import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SystemSettings } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContentRenderer, NotePageHeader, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import { BookOpen } from 'lucide-react';

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

  const date = note.publishedAt || note.createdAt;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4 print:max-w-none print:px-0">

      <NotePageHeader note={note} brandColor={brandColor} date={date} printButton />

      <NoteContentRenderer
        note={note}
        brandColor={brandColor}
        canToggle={false}
      />

      <div className="pb-12 print:hidden" />
    </div>
  );
}
