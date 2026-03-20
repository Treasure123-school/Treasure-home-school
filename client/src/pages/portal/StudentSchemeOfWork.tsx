import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen,
  Layers,
  CheckCircle2,
  Circle,
  GraduationCap,
  BookMarked,
  Palette,
  Briefcase,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { color: string; icon: any }> = {
  general:    { color: 'bg-slate-500',  icon: BookMarked },
  science:    { color: 'bg-blue-500',   icon: GraduationCap },
  art:        { color: 'bg-purple-500', icon: Palette },
  commercial: { color: 'bg-amber-500',  icon: Briefcase },
};

export default function StudentSchemeOfWork() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/my-subjects');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['/api/my-syllabus-topics', selectedSubjectId],
    queryFn: async () => {
      const url = selectedSubjectId !== 'all'
        ? `/api/my-syllabus-topics?subjectId=${selectedSubjectId}`
        : '/api/my-syllabus-topics';
      const res = await apiRequest('GET', url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: studentInfo } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/students/me');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = subjectsLoading || topicsLoading;

  const groupedBySubject: Record<number, { subject: any; topics: any[] }> = {};
  topics.forEach((topic: any) => {
    if (!groupedBySubject[topic.subjectId]) {
      const subject = subjects.find((s: any) => (s.id || s.subjectId) === topic.subjectId);
      groupedBySubject[topic.subjectId] = { subject, topics: [] };
    }
    groupedBySubject[topic.subjectId].topics.push(topic);
  });

  const totalTopics = topics.length;

  return (
    <div className="space-y-6 pb-8" data-testid="student-scheme-of-work">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheme of Work</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentInfo?.className
              ? `Topics covered this term in ${studentInfo.className}`
              : 'Topics planned for your subjects this term'}
          </p>
        </div>

        {/* Subject Filter */}
        {subjects.length > 0 && (
          <div className="self-start sm:self-auto">
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="w-52" data-testid="select-subject-filter">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id || s.subjectId} value={String(s.id || s.subjectId)}>
                    {s.subjectName || s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total Topics:</span>
            <span>{totalTopics}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Subjects:</span>
            <span>{Object.keys(groupedBySubject).length}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(j => <Skeleton key={j} className="h-24 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && totalTopics === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-muted-foreground opacity-60" />
          </div>
          <p className="text-base font-medium">No Topics Found</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {selectedSubjectId !== 'all'
              ? 'No topics have been added for this subject yet.'
              : 'Your class scheme of work has not been set up yet. Check back later.'}
          </p>
        </div>
      )}

      {/* Topics grouped by subject */}
      {!isLoading && totalTopics > 0 && (
        <div className="space-y-8">
          {Object.values(groupedBySubject).map(({ subject, topics: subjectTopics }) => {
            const category = (subject?.category || subject?.subjectCategory || 'general').toLowerCase();
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
            const CategoryIcon = config.icon;

            return (
              <section key={subject?.id || subject?.subjectId} data-testid={`scheme-subject-${subject?.id || subject?.subjectId}`}>
                {/* Subject Heading */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                    <CategoryIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base leading-tight">
                      {subject?.subjectName || subject?.name || 'Unknown Subject'}
                    </h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {subject?.subjectCode || subject?.code}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {subjectTopics.length} topic{subjectTopics.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Topics Grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {subjectTopics
                    .sort((a: any, b: any) => (a.orderNumber || 0) - (b.orderNumber || 0))
                    .map((topic: any, index: number) => (
                      <Card
                        key={topic.id}
                        className="border hover:shadow-sm transition-shadow duration-200"
                        data-testid={`topic-card-${topic.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <span className={`w-6 h-6 rounded-full ${config.color} text-white text-xs font-bold flex items-center justify-center`}>
                                {topic.orderNumber || index + 1}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm leading-snug">{topic.name}</p>
                              {topic.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {topic.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
