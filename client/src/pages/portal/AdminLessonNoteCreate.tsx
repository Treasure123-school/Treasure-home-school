import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/lesson-notes/lessonNoteShared';
import type { EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Layers, CheckCircle2, ChevronRight, X, Info, ListChecks,
  Plus, ArrowRight, GraduationCap, BookMarked, Calendar, Hash,
  Eye, Edit, AlertCircle,
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

function useTerms() {
  return useQuery<any[]>({
    queryKey: ['/api/terms'],
    queryFn: async () => (await apiRequest('GET', '/api/terms')).json(),
    staleTime: 10 * 60 * 1000,
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

function StepChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span className="text-muted-foreground text-xs mr-0.5">{label}:</span>
      {value}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors"
        aria-label={`Clear ${label}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function SelectStep({ stepNum, label, hint, children }: {
  stepNum: number; label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 items-start py-4 border-b last:border-b-0">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {stepNum}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

export default function AdminLessonNoteCreate() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [classId,         setClassId]         = useState('');
  const [subjectId,       setSubjectId]       = useState('');
  const [termId,          setTermId]          = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const { data: classes  = [],         isLoading: loadingClasses  } = useClasses();
  const { data: allSubjects = [] }                                   = useAllSubjects();
  const { data: mappings = [] }                                      = useSubjectMappings(classId);
  const { data: terms    = [] }                                      = useTerms();
  const { data: topics   = [], isLoading: loadingTopics }           = useAllTopics(classId, subjectId, termId);
  const { data: notes    = [], isLoading: loadingNotes  }           = useExistingNotes(classId, subjectId, termId);

  const availableSubjects = useMemo(() => {
    if (!classId) return allSubjects;
    return allSubjects.filter((s: any) => mappings.some((m: any) => m.subjectId === s.id));
  }, [allSubjects, mappings, classId]);

  const selectedClass   = (classes  as any[]).find((c: any) => String(c.id) === classId);
  const selectedSubject = (availableSubjects as any[]).find((s: any) => String(s.id) === subjectId);
  const selectedTerm    = (terms    as any[]).find((t: any) => String(t.id) === termId);
  const sortedTopics    = useMemo(() => [...topics].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0)), [topics]);
  const selectedTopic   = topics.find(t => t.id === selectedTopicId) ?? null;

  const noteByTopicId   = useMemo(() => new Map(notes.map(n => [n.topicId, n])), [notes]);

  const allFiltered   = !!(classId && subjectId && termId);
  const topicSelected = allFiltered && selectedTopicId !== null;

  const clearClass   = () => { setClassId(''); setSubjectId(''); setTermId(''); setSelectedTopicId(null); };
  const clearSubject = () => { setSubjectId(''); setTermId(''); setSelectedTopicId(null); };
  const clearTerm    = () => { setTermId(''); setSelectedTopicId(null); };
  const clearTopic   = () => setSelectedTopicId(null);

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
      setSelectedTopicId(topic.id);
    }
  };

  const handleCreateNote = () => {
    if (!selectedTopic) return;
    const params = buildEditorParams(selectedTopic);
    navigate(`/portal/admin/lesson-notes/editor/new?${params}`);
  };

  const handleGoBack = () => navigate('/portal/admin/lesson-notes');

  return (
    <div className="min-h-screen bg-background" data-testid="admin-lesson-note-create">

      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground">Create Lesson Note</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Select Class → Subject → Term → Topic, then create the note</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGoBack} className="shrink-0">
              ← Back
            </Button>
          </div>

          {/* Selection breadcrumb */}
          {classId && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StepChip label="Class" value={selectedClass?.name ?? classId} onClear={clearClass} />
              {subjectId && selectedSubject && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <StepChip label="Subject" value={selectedSubject.name} onClear={clearSubject} />
                </>
              )}
              {termId && selectedTerm && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <StepChip label="Term" value={selectedTerm.name} onClear={clearTerm} />
                </>
              )}
              {topicSelected && selectedTopic && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <StepChip label="Topic" value={selectedTopic.name} onClear={clearTopic} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Steps 1-3 wizard ── */}
        {!allFiltered && (
          <Card className="shadow-sm">
            <CardContent className="px-5 py-1 divide-y">

              {/* Step 1: Class */}
              <SelectStep stepNum={1} label="Select Class" hint={!classId ? 'Choose the class this lesson note is for' : undefined}>
                {loadingClasses ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : !classId ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(classes as any[]).map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClassId(String(c.id))}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-colors text-sm font-medium text-left"
                        data-testid={`class-btn-${c.id}`}
                      >
                        <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.name.charAt(0)}
                        </span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 opacity-60">
                    <CheckCircle2 className="w-4 h-4 text-primary" />{selectedClass?.name}
                  </div>
                )}
              </SelectStep>

              {/* Step 2: Subject */}
              {classId && (
                <SelectStep stepNum={2} label="Select Subject"
                  hint={!subjectId ? `Subjects available for ${selectedClass?.name}` : undefined}>
                  {!subjectId ? (
                    availableSubjects.length === 0 ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                        <Info className="w-3.5 h-3.5 shrink-0" />No subjects mapped to this class yet
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(availableSubjects as any[]).map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSubjectId(String(s.id))}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-colors text-sm font-medium text-left"
                            data-testid={`subject-btn-${s.id}`}
                          >
                            <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {s.name.charAt(0)}
                            </span>
                            <span className="truncate">{s.name}</span>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 opacity-60">
                      <CheckCircle2 className="w-4 h-4 text-primary" />{selectedSubject?.name}
                    </div>
                  )}
                </SelectStep>
              )}

              {/* Step 3: Term */}
              {classId && subjectId && (
                <SelectStep stepNum={3} label="Select Term" hint="Choose the academic term">
                  <Select value={termId} onValueChange={setTermId}>
                    <SelectTrigger className="w-full sm:w-72" data-testid="select-term">
                      <SelectValue placeholder="Select term…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(terms as any[]).map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}{t.year ? ` — ${t.year}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SelectStep>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Topic list ── */}
        {allFiltered && !topicSelected && (
          <>
            {/* Compact context bar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/30 border text-xs">
              <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">Context:</span>
              <Badge variant="secondary">{selectedClass?.name}</Badge>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              <Badge variant="secondary">{selectedSubject?.name}</Badge>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              <Badge variant="secondary">{selectedTerm?.name}</Badge>
              <button
                type="button"
                onClick={clearClass}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Change
              </button>
            </div>

            {/* Step 4 instruction */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
              <div>
                <p className="text-sm font-semibold">Select a Topic</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All topics for this context are shown below. Topics without an existing note can be selected to create one. Topics with existing notes will open the view page.
                </p>
              </div>
            </div>

            <Card className="shadow-sm">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm">Topics</h2>
                  {!loadingTopics && sortedTopics.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{sortedTopics.length}</Badge>
                  )}
                  {!loadingTopics && (
                    <div className="ml-auto flex gap-1.5">
                      {sortedTopics.filter(t => t.isPublished).length > 0 && (
                        <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500">
                          {sortedTopics.filter(t => t.isPublished).length} published
                        </Badge>
                      )}
                      {sortedTopics.filter(t => !t.isPublished).length > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          {sortedTopics.filter(t => !t.isPublished).length} draft
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {(loadingTopics || loadingNotes) && (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                )}

                {!loadingTopics && !loadingNotes && sortedTopics.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <BookOpen className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                    <p className="font-medium text-sm">No Topics Found</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">No topics exist for this class/subject/term combination.</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/portal/admin/syllabus-topics')}>
                      Go to Scheme of Work to add topics
                    </Button>
                  </div>
                )}

                {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
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
                              <><Eye className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">View Note</span></>
                            ) : (
                              <><Plus className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-primary hidden sm:inline">Select</span></>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Phase 5: Summary + Create CTA ── */}
        {topicSelected && selectedTopic && (
          <Card className="shadow-sm border-primary/30">
            <CardContent className="px-5 py-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h2 className="font-semibold text-sm">Selection Summary</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border">
                  <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Class</p>
                    <p className="text-sm font-semibold truncate">{selectedClass?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border">
                  <BookMarked className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="text-sm font-semibold truncate">{selectedSubject?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Term</p>
                    <p className="text-sm font-semibold truncate">{selectedTerm?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Hash className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Topic</p>
                    <p className="text-sm font-semibold truncate text-primary">{selectedTopic.name}</p>
                  </div>
                </div>
              </div>

              {selectedTopic.description && (
                <p className="text-xs text-muted-foreground mb-4 px-1 italic">{selectedTopic.description}</p>
              )}

              {!selectedTopic.isPublished && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    This topic is still in <strong>draft</strong> (not published to teachers). You can create a note for it, but teachers won't see it until you publish the topic.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleCreateNote}
                  data-testid="button-create-lesson-note"
                >
                  <Plus className="w-4 h-4" />
                  Create Lesson Note
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  onClick={clearTopic}
                  data-testid="button-back-to-topics"
                >
                  ← Back to Topics
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
