import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Layers, GraduationCap, BookMarked, Palette, Briefcase } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { icon: any; color: string }> = {
  general:    { icon: BookMarked,    color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' },
  science:    { icon: GraduationCap, color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' },
  art:        { icon: Palette,       color: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600' },
  commercial: { icon: Briefcase,     color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' },
};

export default function StudentSchemeOfWork() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/my-subjects')).json(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['/api/my-syllabus-topics', selectedSubjectId],
    queryFn: async () => {
      const url = selectedSubjectId !== 'all'
        ? `/api/my-syllabus-topics?subjectId=${selectedSubjectId}`
        : '/api/my-syllabus-topics';
      return (await apiRequest('GET', url)).json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: studentInfo } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => (await apiRequest('GET', '/api/students/me')).json(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = subjectsLoading || topicsLoading;

  const grouped: Record<number, { subject: any; topics: any[] }> = {};
  (topics as any[]).forEach((topic: any) => {
    if (!grouped[topic.subjectId]) {
      const subject = (subjects as any[]).find((s: any) => (s.id || s.subjectId) === topic.subjectId);
      grouped[topic.subjectId] = { subject, topics: [] };
    }
    grouped[topic.subjectId].topics.push(topic);
  });

  const totalTopics = (topics as any[]).length;
  const subjectCount = Object.keys(grouped).length;

  return (
    <div className="min-h-screen bg-background" data-testid="student-scheme-of-work">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Scheme of Work</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(studentInfo as any)?.className
                    ? `Published topics for ${(studentInfo as any).className}`
                    : 'Your class curriculum topics this term'}
                </p>
              </div>
            </div>
            {(subjects as any[]).length > 0 && (
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="w-full sm:w-52" data-testid="select-subject-filter">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {(subjects as any[]).map((s: any) => (
                    <SelectItem key={s.id || s.subjectId} value={String(s.id || s.subjectId)}>
                      {s.subjectName || s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Stats */}
          {!isLoading && (
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border text-sm">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Topics:</span>
                <span className="font-semibold">{totalTopics}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border text-sm">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Subjects:</span>
                <span className="font-semibold">{subjectCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-5">
            {[1, 2].map(i => (
              <Card key={i} className="shadow-sm">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-36" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(j => <Skeleton key={j} className="h-16 rounded-lg" />)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && totalTopics === 0 && (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">No Topics Available</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                {selectedSubjectId !== 'all'
                  ? 'No topics have been published for this subject yet.'
                  : 'Your class scheme of work has not been published yet. Check back later.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Topics grouped by subject */}
        {!isLoading && totalTopics > 0 && (
          <div className="space-y-5">
            {Object.values(grouped).map(({ subject, topics: subjectTopics }) => {
              const category = (subject?.category || subject?.subjectCategory || 'general').toLowerCase();
              const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
              const Icon = cfg.icon;

              return (
                <Card
                  key={subject?.id || subject?.subjectId}
                  className="shadow-sm"
                  data-testid={`scheme-subject-${subject?.id || subject?.subjectId}`}
                >
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h2 className="font-semibold text-sm truncate">
                          {subject?.subjectName || subject?.name || 'Unknown Subject'}
                        </h2>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {subjectTopics.length} topic{subjectTopics.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[...subjectTopics]
                        .sort((a: any, b: any) => (a.orderNumber || 0) - (b.orderNumber || 0))
                        .map((topic: any, index: number) => (
                          <div
                            key={topic.id}
                            className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            data-testid={`topic-card-${topic.id}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {topic.orderNumber || index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm leading-snug">{topic.name}</p>
                              {topic.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{topic.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
