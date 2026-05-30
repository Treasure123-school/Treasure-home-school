import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Layers, ChevronRight, GraduationCap, Filter, FileText, Eye, AlertCircle } from 'lucide-react';

// ─── hooks ──────────────────────────────────────────────────────────────────

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

function useTerms() {
  return useQuery<any[]>({
    queryKey: ['/api/terms'],
    queryFn: async () => (await apiRequest('GET', '/api/terms')).json(),
    staleTime: 10 * 60 * 1000,
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

function useLessonNote(topicId: number, enabled: boolean) {
  return useQuery<any>({
    queryKey: ['/api/lesson-notes/by-topic', topicId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/lesson-notes/by-topic/${topicId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled,
    retry: false,
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getSubjectName(subjects: any[], id: string) {
  const s = subjects.find((s: any) => String(s.subjectId) === id);
  return s?.subjectName || s?.name || 'Unknown Subject';
}

function getTermName(terms: any[], id: string) {
  const t = terms.find((t: any) => String(t.id) === id);
  return t?.name || 'Unknown Term';
}

// ─── LessonNotePanel ──────────────────────────────────────────────────────────

function LessonNotePanel({ topicId, topicName }: { topicId: number; topicName: string }) {
  const { data: note, isLoading } = useLessonNote(topicId, true);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-dashed">
        <AlertCircle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Lesson Note Not Available</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Your teacher hasn't published a lesson note for this topic yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {note.objectives && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Learning Objectives
          </p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.objectives}</p>
        </div>
      )}
      {note.content && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Lesson Content
          </p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
        </div>
      )}
      {!note.objectives && !note.content && (
        <p className="text-sm text-muted-foreground italic">No content added for this lesson note yet.</p>
      )}
    </div>
  );
}

// ─── TopicNoteDialog ──────────────────────────────────────────────────────────

function TopicNoteDialog({
  topic, onClose,
}: {
  topic: { id: number; name: string; description?: string | null; orderNumber?: number } | null;
  onClose: () => void;
}) {
  if (!topic) return null;
  return (
    <Dialog open={!!topic} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <span className="leading-snug">{topic.name}</span>
          </DialogTitle>
          {topic.description && (
            <p className="text-sm text-muted-foreground">{topic.description}</p>
          )}
        </DialogHeader>
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Lesson Note</p>
          </div>
          <LessonNotePanel topicId={topic.id} topicName={topic.name} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TopicCard ────────────────────────────────────────────────────────────────

function TopicCard({ topic, index, onClick }: { topic: any; index: number; onClick: () => void }) {
  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onClick}
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
  );
}

function TopicsLoadingSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function StudentSchemeOfWork() {
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTermId, setSelectedTermId]       = useState('');
  const [selectedTopic, setSelectedTopic]         = useState<any | null>(null);

  const { data: studentInfo, isLoading: loadingStudent } = useStudentInfo();
  const { data: subjects = [], isLoading: loadingSubjects } = useMySubjects(!!studentInfo);
  const { data: terms = [],    isLoading: loadingTerms   } = useTerms();

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

  const subjectName = selectedSubjectId ? getSubjectName(subjects, selectedSubjectId) : '';
  const termName    = selectedTermId    ? getTermName(terms, selectedTermId)           : '';
  const className   = (studentInfo as any)?.className || '';
  const sortedTopics = [...topics].sort((a: any, b: any) => (a.orderNumber || 0) - (b.orderNumber || 0));

  return (
    <div className="min-h-screen bg-background" data-testid="student-scheme-of-work">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Scheme of Work</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
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

          {/* Class chip */}
          {className && (
            <div className="mt-4 flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border text-xs font-medium">
                <GraduationCap className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Class:</span>
                <span className="text-foreground">{className}</span>
                <span className="ml-0.5 text-[10px] text-emerald-600 font-semibold">AUTO</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

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

              {/* Subject selector */}
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

              {/* Term selector */}
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

            {/* Step indicator */}
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

            {/* Active filter breadcrumb */}
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
              {/* Loading */}
              {loadingTopics && <TopicsLoadingSkeleton />}

              {/* Empty — no topics for this combination */}
              {!loadingTopics && sortedTopics.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No Topics Published Yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Topics for <strong>{subjectName}</strong> in <strong>{termName}</strong> haven't been published yet. Check back later.
                  </p>
                </div>
              )}

              {/* Topics grid */}
              {!loadingTopics && sortedTopics.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Click any topic to view its lesson note
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sortedTopics.map((topic: any, index: number) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        index={index}
                        onClick={() => setSelectedTopic(topic)}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prompt — nothing selected yet */}
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

      {/* Topic note dialog */}
      <TopicNoteDialog topic={selectedTopic} onClose={() => setSelectedTopic(null)} />
    </div>
  );
}
