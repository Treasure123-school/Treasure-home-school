import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { BookOpen, Layers, ChevronRight, Filter, Eye } from 'lucide-react';

function useStudentInfo() {
  return useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => (await apiRequest('GET', '/api/students/me')).json(),
    staleTime: 10 * 60 * 1000,
  });
}

function useMySubjects(enabled: boolean) {
  return useQuery<any[]>({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/my-subjects')).json(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

function useSchemeTopics(subjectId: string, termId: string, enabled: boolean) {
  return useQuery<any[]>({
    queryKey: ['/api/my-syllabus-topics', subjectId, termId],
    queryFn: async () => {
      const params = new URLSearchParams({ subjectId, termId });
      return (await apiRequest('GET', `/api/my-syllabus-topics?${params}`)).json();
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

function getSubjectName(subjects: any[], id: string) {
  const s = subjects.find((s: any) => String(s.subjectId) === id);
  return s?.subjectName || s?.name || 'Unknown Subject';
}

function getTermName(terms: any[], id: string) {
  const t = terms.find((t: any) => String(t.id) === id);
  return t?.name || 'Unknown Term';
}

function TopicsLoadingSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );
}

export default function StudentSchemeOfWork() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTermId, setSelectedTermId]       = useState('');
  const [, navigate] = useLocation();

  const { data: studentInfo, isLoading: loadingStudent } = useStudentInfo();
  const { data: subjects = [], isLoading: loadingSubjects } = useMySubjects(!!studentInfo);
  const { currentTerm, allTerms: terms, isLoading: loadingTerms } = useAcademicCalendar();

  // Auto-select current term when it loads
  useEffect(() => {
    if (currentTerm && !selectedTermId) {
      setSelectedTermId(String(currentTerm.id));
    }
  }, [currentTerm, selectedTermId]);

  const filtersComplete = !!(selectedSubjectId && selectedTermId);

  const { data: topics = [], isLoading: loadingTopics } = useSchemeTopics(
    selectedSubjectId,
    selectedTermId,
    filtersComplete,
  );

  const handleSubjectChange = (v: string) => {
    setSelectedSubjectId(v);
    setSelectedTermId('');
  };

  const subjectName  = selectedSubjectId ? getSubjectName(subjects, selectedSubjectId) : '';
  const termName     = selectedTermId    ? getTermName(terms, selectedTermId)           : '';
  const className    = (studentInfo as any)?.className || '';
  const sortedTopics = [...topics].sort((a: any, b: any) => (a.orderNumber || 0) - (b.orderNumber || 0));

  const handleTopicClick = (topic: any) => {
    navigate(`/portal/student/lesson-notes/${topic.id}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="student-scheme-of-work">

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Scheme of Work
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loadingStudent ? (
                <Skeleton className="h-4 w-32 inline-block" />
              ) : className ? (
                <>Published curriculum topics for <span className="font-medium text-foreground">{className}</span></>
              ) : (
                'Your class curriculum topics'
              )}
            </p>
          </div>
        </div>

        {/* Filter Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-primary" />
              </div>
              Browse Topics
              <span className="text-xs font-normal text-muted-foreground ml-0.5">— choose subject then term</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Subject <span className="text-destructive">*</span>
                </Label>
                {loadingSubjects ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : (
                  <Select value={selectedSubjectId} onValueChange={handleSubjectChange}>
                    <SelectTrigger data-testid="select-subject">
                      <SelectValue placeholder={subjects.length === 0 ? 'No subjects assigned' : 'Select subject…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s: any) => (
                        <SelectItem key={s.subjectId} value={String(s.subjectId)}>
                          {s.subjectName || s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Term <span className="text-destructive">*</span>
                </Label>
                {loadingTerms ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : (
                  <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSubjectId}>
                    <SelectTrigger data-testid="select-term">
                      <SelectValue placeholder={!selectedSubjectId ? 'Select subject first' : 'Select term…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {terms.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}{t.year ? ` — ${t.year}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {!filtersComplete && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${selectedSubjectId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${selectedTermId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                <span className="ml-1">
                  {!selectedSubjectId ? 'Select a subject to start' : 'Now select a term to view topics'}
                </span>
              </div>
            )}

            {filtersComplete && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Showing:</span>
                <Badge variant="secondary" className="text-xs">{className}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary" className="text-xs">{subjectName}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary" className="text-xs">{termName}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topics Results */}
        {filtersComplete && (
          <Card className="shadow-sm" data-testid="topics-results-card">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm truncate">{subjectName}</h2>
                  <span className="text-xs text-muted-foreground shrink-0">· {termName}</span>
                </div>
                {!loadingTopics && sortedTopics.length > 0 && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {loadingTopics && <TopicsLoadingSkeleton />}

              {!loadingTopics && sortedTopics.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No Topics Published Yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Topics for <strong>{subjectName}</strong> in <strong>{termName}</strong> haven't been published yet.
                  </p>
                </div>
              )}

              {!loadingTopics && sortedTopics.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Click any topic to read its lesson note
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sortedTopics.map((topic: any, index: number) => (
                      <div
                        key={topic.id}
                        className="flex items-start gap-3 p-3.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => handleTopicClick(topic)}
                        data-testid={`topic-card-${topic.id}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {topic.orderNumber || index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-snug">{topic.name}</p>
                          {topic.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{topic.description}</p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">View note</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prompt */}
        {!filtersComplete && !loadingStudent && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">Select Subject & Term</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Choose a subject and term above to view published topics and their lesson notes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
