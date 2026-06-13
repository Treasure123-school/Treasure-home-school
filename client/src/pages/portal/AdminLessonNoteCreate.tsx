import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/lesson-notes/lessonNoteShared';
import type { EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Layers, CheckCircle2, ChevronRight, Info,
  Plus, ArrowRight, BookMarked, Filter, Eye, AlertCircle, Hash,
} from 'lucide-react';

type Topic = { id: number; name: string; description: string | null; orderNumber: number | null; isPublished: boolean };

function useClasses() {
  return useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),
    staleTime: 5 * 60 * 1000,
  });
}

function useSubjectMappings(classId: string) {
  return useQuery<any[]>({
    queryKey: ['/api/class-subject-mappings', classId],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/class-subject-mappings/${classId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!classId,
    staleTime: 5 * 60 * 1000,
  });
}

function useAllSubjects() {
  return useQuery<any[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
    staleTime: 5 * 60 * 1000,
  });
}

function useAllTopics(classId: string, subjectId: string, termId: string) {
  return useQuery<Topic[]>({
    queryKey: ['/api/syllabus-topics', classId, subjectId, termId, 'admin-all'],
    queryFn: async () => {
      const p = new URLSearchParams({ classId, subjectId, termId });
      return (await apiRequest('GET', `/api/syllabus-topics?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 2 * 60 * 1000,
  });
}

function useExistingNotes(classId: string, subjectId: string, termId: string) {
  return useQuery<EnrichedNote[]>({
    queryKey: ['/api/lesson-notes', 'admin-create', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams({ classId, subjectId, termId });
      return (await apiRequest('GET', `/api/lesson-notes?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 60 * 1000,
  });
}

function TopicsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );
}

export default function AdminLessonNoteCreate() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [classId,   setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId,    setTermId]    = useState('');

  const { data: classes    = [], isLoading: loadingClasses   } = useClasses();
  const { data: allSubjects = [] }                              = useAllSubjects();
  const { data: mappings   = [] }                              = useSubjectMappings(classId);
  const { currentTerm, allTerms: terms, isLoading: loadingTerms } = useAcademicCalendar();

  useEffect(() => {
    if (currentTerm && !termId) setTermId(String(currentTerm.id));
  }, [currentTerm, termId]);

  const { data: topics = [], isLoading: loadingTopics } = useAllTopics(classId, subjectId, termId);
  const { data: notes  = [], isLoading: loadingNotes  } = useExistingNotes(classId, subjectId, termId);

  const availableSubjects = useMemo(() => {
    if (!classId) return allSubjects;
    return allSubjects.filter((s: any) => mappings.some((m: any) => m.subjectId === s.id));
  }, [allSubjects, mappings, classId]);

  const selectedClass   = (classes       as any[]).find((c: any) => String(c.id) === classId);
  const selectedSubject = (availableSubjects as any[]).find((s: any) => String(s.id) === subjectId);
  const selectedTerm    = (terms         as any[]).find((t: any) => String(t.id) === termId);
  const sortedTopics    = useMemo(() => [...topics].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0)), [topics]);
  const noteByTopicId   = useMemo(() => new Map(notes.map(n => [n.topicId, n])), [notes]);

  const filtersComplete = !!(classId && subjectId && termId);

  const handleClassChange = (v: string) => { setClassId(v); setSubjectId(''); };

  const buildEditorParams = (topic: Topic) => new URLSearchParams({
    topicId:     String(topic.id),
    classId,
    subjectId,
    termId,
    topicName:   encodeURIComponent(topic.name),
    className:   encodeURIComponent(selectedClass?.name   ?? ''),
    subjectName: encodeURIComponent(selectedSubject?.name ?? ''),
    termName:    encodeURIComponent(selectedTerm?.name    ?? ''),
  });

  const handleTopicClick = (topic: Topic) => {
    const existing = noteByTopicId.get(topic.id);
    if (existing) {
      navigate(`/portal/admin/lesson-notes/view/${existing.id}`);
    } else {
      navigate(`/portal/admin/lesson-notes/editor/new?${buildEditorParams(topic)}`);
    }
  };

  return (
    <div data-testid="admin-lesson-note-create">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-primary" />
            Create Lesson Note
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a class, subject, and term to browse topics and create notes
          </p>
        </div>

        {/* Filter Card */}
        <SectionCard icon={Filter} title="Select Context" subtitle="— choose class, subject, then term">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Class */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Class <span className="text-destructive">*</span>
                </Label>
                {loadingClasses ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : (
                  <Select value={classId} onValueChange={handleClassChange}>
                    <SelectTrigger data-testid="select-class">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classes as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={subjectId}
                  onValueChange={setSubjectId}
                  disabled={!classId}
                >
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder={!classId ? 'Select class first' : availableSubjects.length === 0 ? 'No subjects mapped' : 'Select subject…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.length === 0 && classId ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Info className="w-3.5 h-3.5 shrink-0" />No subjects mapped to this class
                      </div>
                    ) : (
                      (availableSubjects as any[]).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Term */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Term <span className="text-destructive">*</span>
                </Label>
                {loadingTerms ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : (
                  <Select value={termId} onValueChange={setTermId} disabled={!subjectId}>
                    <SelectTrigger data-testid="select-term">
                      <SelectValue placeholder={!subjectId ? 'Select subject first' : 'Select term…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(terms as any[]).map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}{t.year ? ` — ${t.year}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Progress hint */}
            {!filtersComplete && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${classId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${subjectId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${termId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                <span className="ml-1">
                  {!classId ? 'Select a class to start' : !subjectId ? 'Now select a subject' : 'Now select a term to view topics'}
                </span>
              </div>
            )}

            {/* Active context breadcrumb */}
            {filtersComplete && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Showing:</span>
                <Badge variant="secondary" className="text-xs">{selectedClass?.name}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary" className="text-xs">{selectedSubject?.name}</Badge>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <Badge variant="secondary" className="text-xs">{selectedTerm?.name}</Badge>
              </div>
            )}
        </SectionCard>

        {/* Topics Results */}
        {filtersComplete && (
          <SectionCard
            icon={Layers}
            title={selectedSubject?.name ?? ''}
            subtitle={selectedTerm ? `· ${selectedTerm.name}` : undefined}
            rightContent={!loadingTopics && sortedTopics.length > 0 ? (
              <div className="flex items-center gap-1.5">
                {sortedTopics.filter(t => noteByTopicId.has(t.id)).length > 0 && (
                  <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500">
                    {sortedTopics.filter(t => noteByTopicId.has(t.id)).length} noted
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            ) : undefined}
            headerPadding="compact"
            contentClassName="px-5 pb-5"
            data-testid="topics-results-card"
          >

              {(loadingTopics || loadingNotes) && <TopicsLoadingSkeleton />}

              {!loadingTopics && !loadingNotes && sortedTopics.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No Topics Found</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">
                    No topics exist for <strong>{selectedSubject?.name}</strong> in <strong>{selectedTerm?.name}</strong>.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/portal/admin/syllabus-topics')}>
                    Go to Scheme of Work to add topics
                  </Button>
                </div>
              )}

              {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Plus className="w-3 h-3 text-primary" />
                    Click a topic to create a note, or <Eye className="w-3 h-3 mx-0.5 inline" /> view an existing one
                  </p>
                  <div className="space-y-2">
                    {sortedTopics.map((topic, idx) => {
                      const note    = noteByTopicId.get(topic.id);
                      const hasNote = !!note;

                      return (
                        <div
                          key={topic.id}
                          className={`flex items-center gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer group ${
                            hasNote
                              ? 'bg-muted/20 hover:bg-muted/40'
                              : 'bg-muted/10 hover:bg-primary/5 hover:border-primary/30'
                          }`}
                          onClick={() => handleTopicClick(topic)}
                          data-testid={`topic-row-${topic.id}`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleTopicClick(topic)}
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                            {topic.orderNumber || idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">{topic.name}</p>
                              {!topic.isPublished && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 py-0">Draft</Badge>
                              )}
                              {note && <StatusBadge status={note.status} />}
                            </div>
                            {topic.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{topic.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                            {hasNote ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground hidden sm:inline">View Note</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs text-primary hidden sm:inline">Create Note</span>
                                <ArrowRight className="w-3.5 h-3.5 text-primary" />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
          </SectionCard>
        )}

        {/* Prompt when filters not complete */}
        {!filtersComplete && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Hash className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">Select Class, Subject & Term</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Choose a class, subject, and term above to browse topics and create lesson notes.
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
