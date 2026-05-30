import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, STATUS_CFG, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Layers, Plus, Edit, Trash2, Send, AlertCircle, CheckCircle2,
  ChevronRight, X, Eye, FileText, Info, ListChecks,
} from 'lucide-react';

type Topic = { id: number; name: string; description: string | null; orderNumber: number | null };
type Assignment = { classId: number; className: string; subjectId: number; subjectName: string };

function useTeacherAssignments() {
  return useQuery<Assignment[]>({
    queryKey: ['/api/teacher-assignments'],
    queryFn: async () => (await apiRequest('GET', '/api/teacher-assignments')).json(),
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

function useSyllabusTopics(classId: string, subjectId: string, termId: string) {
  return useQuery<Topic[]>({
    queryKey: ['/api/syllabus-topics', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams({ classId, subjectId, termId, isPublished: 'true' });
      return (await apiRequest('GET', `/api/syllabus-topics?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 3 * 60 * 1000,
  });
}

function useMyLessonNotes(classId: string, subjectId: string, termId: string) {
  return useQuery<EnrichedNote[]>({
    queryKey: ['/api/lesson-notes', 'teacher', classId, subjectId, termId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (classId)   p.set('classId',   classId);
      if (subjectId) p.set('subjectId', subjectId);
      if (termId)    p.set('termId',    termId);
      return (await apiRequest('GET', `/api/lesson-notes?${p}`)).json();
    },
    enabled: !!(classId && subjectId && termId),
    staleTime: 60 * 1000,
  });
}

function StepChip({
  step, label, value, onClear,
}: { step: number; label: string; value: string; onClear: () => void }) {
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

function SelectStep({
  stepNum, label, hint, children,
}: { stepNum: number; label: string; hint?: string; children: React.ReactNode }) {
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

export default function TeacherLessonNotes() {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [, navigate] = useLocation();

  const [classId,   setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId,    setTermId]    = useState('');

  const { data: assignments = [], isLoading: loadingAssign } = useTeacherAssignments();
  const { data: terms = [] }                                 = useTerms();
  const { data: topics = [], isLoading: loadingTopics }      = useSyllabusTopics(classId, subjectId, termId);
  const { data: notes  = [], isLoading: loadingNotes  }      = useMyLessonNotes(classId, subjectId, termId);

  const uniqueClasses = useMemo(() => {
    const seen = new Set<number>();
    return (assignments as Assignment[]).filter(a => {
      if (seen.has(a.classId)) return false;
      seen.add(a.classId); return true;
    });
  }, [assignments]);

  const availableSubjects = useMemo(
    () => (assignments as Assignment[]).filter(a => String(a.classId) === classId),
    [assignments, classId],
  );

  const selectedClass   = uniqueClasses.find(c => String(c.classId) === classId);
  const selectedSubject = availableSubjects.find(s => String(s.subjectId) === subjectId);
  const selectedTerm    = (terms as any[]).find((t: any) => String(t.id) === termId);

  const noteByTopicId = useMemo(() => new Map(notes.map(n => [n.topicId, n])), [notes]);
  const sortedTopics  = useMemo(() => [...topics].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0)), [topics]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/lesson-notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Draft deleted' }); },
    onError:   (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/lesson-notes/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Submitted for review' }); },
    onError:   (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleTopicClick = (topic: Topic) => {
    const existing = noteByTopicId.get(topic.id) ?? null;
    const params = new URLSearchParams({
      topicId:     String(topic.id),
      classId,
      subjectId,
      termId,
      topicName:   encodeURIComponent(topic.name),
      className:   encodeURIComponent(selectedClass?.className   ?? ''),
      subjectName: encodeURIComponent(selectedSubject?.subjectName ?? ''),
      termName:    encodeURIComponent(selectedTerm?.name ?? ''),
    });
    if (existing) {
      const cfg = STATUS_CFG[existing.status as keyof typeof STATUS_CFG];
      if (cfg?.canEdit) {
        navigate(`/portal/teacher/lesson-notes/edit/${existing.id}?${params}`);
      } else {
        navigate(`/portal/teacher/lesson-notes/view/${existing.id}`);
      }
    } else {
      navigate(`/portal/teacher/lesson-notes/create?${params}`);
    }
  };

  const clearClass   = () => { setClassId(''); setSubjectId(''); setTermId(''); };
  const clearSubject = () => { setSubjectId(''); setTermId(''); };
  const clearTerm    = () => setTermId('');

  const phase = !classId ? 1 : !subjectId ? 2 : !termId ? 3 : 4;

  const statusCounts = useMemo(() => {
    const out: Record<string, number> = {};
    notes.forEach(n => { out[n.status] = (out[n.status] ?? 0) + 1; });
    return out;
  }, [notes]);

  return (
    <div className="min-h-screen bg-background" data-testid="teacher-lesson-notes">

      {/* Page header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">My Lesson Notes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Create lesson notes for your topics — submit for admin approval</p>
            </div>
          </div>

          {/* Selection path — shown when any filter is active */}
          {phase > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {classId && selectedClass && (
                <StepChip step={1} label="Class" value={selectedClass.className} onClear={clearClass} />
              )}
              {subjectId && selectedSubject && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <StepChip step={2} label="Subject" value={selectedSubject.subjectName} onClear={clearSubject} />
                </>
              )}
              {termId && selectedTerm && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <StepChip step={3} label="Term" value={selectedTerm.name} onClear={clearTerm} />
                </>
              )}
            </div>
          )}

          {/* Status summary when all filters active */}
          {phase === 4 && Object.keys(statusCounts).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG]; if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
                    <Icon className="w-3 h-3" />{count} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Step selector card */}
        {phase < 4 && (
          <Card className="shadow-sm">
            <CardContent className="px-5 py-1 divide-y">

              {/* Step 1: Class */}
              <SelectStep stepNum={1} label="Select Class" hint={phase === 1 ? 'Choose a class you are assigned to teach' : undefined}>
                {loadingAssign ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : uniqueClasses.length === 0 ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0" />No classes assigned yet
                  </div>
                ) : phase === 1 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {uniqueClasses.map(c => (
                      <button
                        key={c.classId}
                        type="button"
                        onClick={() => setClassId(String(c.classId))}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-colors text-sm font-medium text-left"
                        data-testid={`class-btn-${c.classId}`}
                      >
                        <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.className.charAt(0)}
                        </span>
                        {c.className}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 opacity-60">
                    <CheckCircle2 className="w-4 h-4 text-primary" />{selectedClass?.className}
                  </div>
                )}
              </SelectStep>

              {/* Step 2: Subject — only shown when class selected */}
              {phase >= 2 && (
                <SelectStep stepNum={2} label="Select Subject"
                  hint={phase === 2 ? `Subjects you teach in ${selectedClass?.className}` : undefined}>
                  {phase === 2 ? (
                    availableSubjects.length === 0 ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                        <Info className="w-3.5 h-3.5 shrink-0" />No subjects for this class
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSubjects.map(s => (
                          <button
                            key={s.subjectId}
                            type="button"
                            onClick={() => setSubjectId(String(s.subjectId))}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-colors text-sm font-medium text-left"
                            data-testid={`subject-btn-${s.subjectId}`}
                          >
                            <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {s.subjectName.charAt(0)}
                            </span>
                            <span className="truncate">{s.subjectName}</span>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 opacity-60">
                      <CheckCircle2 className="w-4 h-4 text-primary" />{selectedSubject?.subjectName}
                    </div>
                  )}
                </SelectStep>
              )}

              {/* Step 3: Term — only shown when subject selected */}
              {phase >= 3 && (
                <SelectStep stepNum={3} label="Select Term"
                  hint={phase === 3 ? 'Choose the academic term' : undefined}>
                  {phase === 3 ? (
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
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 opacity-60">
                      <CheckCircle2 className="w-4 h-4 text-primary" />{selectedTerm?.name}
                    </div>
                  )}
                </SelectStep>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step summary bar — compact, shown once all phases done */}
        {phase === 4 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/30 border text-xs">
            <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">Browsing:</span>
            <Badge variant="secondary">{selectedClass?.className}</Badge>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            <Badge variant="secondary">{selectedSubject?.subjectName}</Badge>
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
        )}

        {/* Topics list */}
        {phase === 4 && (
          <Card className="shadow-sm">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm">Topics</h2>
                  {!loadingTopics && sortedTopics.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{sortedTopics.length}</Badge>
                  )}
                </div>
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
                  <p className="font-medium text-sm">No Published Topics</p>
                  <p className="text-xs text-muted-foreground mt-1">No topics have been published for this selection yet.</p>
                </div>
              )}

              {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileText className="w-3 h-3 shrink-0" />
                    Tap a topic to create or edit its lesson note
                  </p>
                  {sortedTopics.map((topic, idx) => {
                    const note = noteByTopicId.get(topic.id);
                    const cfg  = note ? STATUS_CFG[note.status as keyof typeof STATUS_CFG] : null;
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-3 p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer group"
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
                            {note && <StatusBadge status={note.status} />}
                          </div>
                          {topic.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{topic.description}</p>
                          )}
                          {note?.rejectionReason && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span className="truncate">{note.rejectionReason}</span>
                            </div>
                          )}
                        </div>

                        {/* Hover hint */}
                        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                          {note ? (
                            cfg?.canEdit
                              ? <><Edit className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">Edit</span></>
                              : <><Eye className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">View</span></>
                          ) : (
                            <><Plus className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-primary hidden sm:inline">Create</span></>
                          )}
                        </div>

                        {/* Quick actions */}
                        {note && cfg?.canDelete && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(note.id); }}
                            className="shrink-0 w-7 h-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete draft"
                            data-testid={`button-delete-${note.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {note && cfg?.canSubmit && !cfg?.canEdit && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); submitMutation.mutate(note.id); }}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs transition-colors"
                            title="Submit for review"
                            data-testid={`button-submit-${note.id}`}
                          >
                            <Send className="w-3 h-3" />
                            <span className="hidden sm:inline">Submit</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state before any selection */}
        {phase === 1 && !loadingAssign && uniqueClasses.length > 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Select a class above to begin
          </div>
        )}
      </div>
    </div>
  );
}
