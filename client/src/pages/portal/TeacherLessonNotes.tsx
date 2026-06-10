import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, STATUS_CFG, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import {
  BookOpen, Layers, Edit, Trash2, Send, AlertCircle,
  ChevronRight, Eye, FileText, Info, Plus, ArrowRight, Filter, Lock,
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

function TopicsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  );
}

export default function TeacherLessonNotes() {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [, navigate] = useLocation();
  const { user }  = useAuth();

  const [classId,   setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId,    setTermId]    = useState('');

  const { data: assignments = [], isLoading: loadingAssign } = useTeacherAssignments();
  const { currentTerm, allTerms: terms, isLoading: loadingTerms } = useAcademicCalendar();

  useEffect(() => {
    if (currentTerm && !termId) setTermId(String(currentTerm.id));
  }, [currentTerm, termId]);

  const { data: topics = [], isLoading: loadingTopics } = useSyllabusTopics(classId, subjectId, termId);
  const { data: notes  = [], isLoading: loadingNotes  } = useMyLessonNotes(classId, subjectId, termId);

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

  const filtersComplete = !!(classId && subjectId && termId);

  const statusCounts = useMemo(() => {
    const out: Record<string, number> = {};
    // Only count teacher's own notes in the status summary
    notes.filter(n => n.createdBy === user?.id).forEach(n => { out[n.status] = (out[n.status] ?? 0) + 1; });
    return out;
  }, [notes, user?.id]);

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

  const buildEditorParams = (topic: Topic) => new URLSearchParams({
    topicId:     String(topic.id),
    classId,
    subjectId,
    termId,
    topicName:   encodeURIComponent(topic.name),
    className:   encodeURIComponent(selectedClass?.className   ?? ''),
    subjectName: encodeURIComponent(selectedSubject?.subjectName ?? ''),
    termName:    encodeURIComponent(selectedTerm?.name ?? ''),
  });

  const handleTopicClick = (topic: Topic) => {
    const existing = noteByTopicId.get(topic.id) ?? null;
    if (existing) {
      const params = buildEditorParams(topic);
      const isOwnNote = existing.createdBy === user?.id;
      const cfg = STATUS_CFG[existing.status as keyof typeof STATUS_CFG];
      // Only allow editing if teacher owns the note AND status allows editing
      if (isOwnNote && cfg?.canEdit) {
        navigate(`/portal/teacher/lesson-notes/edit/${existing.id}?${params}`);
      } else {
        // Read-only: either not their note, or status locks editing
        navigate(`/portal/teacher/lesson-notes/view/${existing.id}`);
      }
    } else {
      const params = buildEditorParams(topic);
      navigate(`/portal/teacher/lesson-notes/create?${params}`);
    }
  };

  const handleClassChange = (v: string) => { setClassId(v); setSubjectId(''); };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5" data-testid="teacher-lesson-notes">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            My Lesson Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create lesson notes for your topics — submit for admin approval
          </p>
        </div>

        {/* Filter Card */}
        <SectionCard icon={Filter} title="Browse Topics" subtitle="— choose class, subject, then term">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Class */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Class <span className="text-destructive">*</span>
                </Label>
                {loadingAssign ? (
                  <Skeleton className="h-10 rounded-md" />
                ) : uniqueClasses.length === 0 ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 shrink-0" />No classes assigned
                  </div>
                ) : (
                  <Select value={classId} onValueChange={handleClassChange}>
                    <SelectTrigger data-testid="select-class">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueClasses.map(c => (
                        <SelectItem key={c.classId} value={String(c.classId)}>{c.className}</SelectItem>
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
                <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder={!classId ? 'Select class first' : availableSubjects.length === 0 ? 'No subjects' : 'Select subject…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.length === 0 && classId ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Info className="w-3.5 h-3.5 shrink-0" />No subjects for this class
                      </div>
                    ) : (
                      availableSubjects.map(s => (
                        <SelectItem key={s.subjectId} value={String(s.subjectId)}>{s.subjectName}</SelectItem>
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

            {/* Active context breadcrumb + note status summary */}
            {filtersComplete && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Showing:</span>
                  <Badge variant="secondary" className="text-xs">{selectedClass?.className}</Badge>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <Badge variant="secondary" className="text-xs">{selectedSubject?.subjectName}</Badge>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  <Badge variant="secondary" className="text-xs">{selectedTerm?.name}</Badge>
                </div>
                {Object.keys(statusCounts).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(statusCounts).map(([status, count]) => {
                      const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                          <Icon className="w-3 h-3" />{count} {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        </SectionCard>

        {/* Topics Results */}
        {filtersComplete && (
          <SectionCard
            icon={Layers}
            title={selectedSubject?.subjectName ?? ''}
            subtitle={selectedTerm ? `· ${selectedTerm.name}` : undefined}
            rightContent={!loadingTopics && sortedTopics.length > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {sortedTopics.length} topic{sortedTopics.length !== 1 ? 's' : ''}
              </Badge>
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
                  <p className="font-medium text-sm">No Published Topics</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    No topics have been published by admin for <strong>{selectedSubject?.subjectName}</strong> in <strong>{selectedTerm?.name}</strong> yet.
                  </p>
                </div>
              )}

              {!loadingTopics && !loadingNotes && sortedTopics.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    Click a topic to create or view its lesson note
                  </p>
                  <div className="space-y-2">
                    {sortedTopics.map((topic, idx) => {
                      const note      = noteByTopicId.get(topic.id);
                      const cfg       = note ? STATUS_CFG[note.status as keyof typeof STATUS_CFG] : null;
                      const hasNote   = !!note;
                      // Is this note owned by the current teacher, or is it a reference note from admin/another teacher?
                      const isOwnNote = hasNote && note.createdBy === user?.id;
                      const isRef     = hasNote && !isOwnNote; // approved/published note from admin or another teacher

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
                              {note && <StatusBadge status={note.status} />}
                              {isRef && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
                                  <Lock className="w-2.5 h-2.5" />Reference
                                </span>
                              )}
                            </div>
                            {topic.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{topic.description}</p>
                            )}
                            {isOwnNote && note?.rejectionReason && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span className="truncate">{note.rejectionReason}</span>
                              </div>
                            )}
                          </div>

                          {/* Hover action hint */}
                          <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasNote ? (
                              isOwnNote && cfg?.canEdit
                                ? <><Edit className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">Edit</span></>
                                : <><Eye className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">View</span></>
                            ) : (
                              <><Plus className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-primary hidden sm:inline">Create Note</span><ArrowRight className="w-3.5 h-3.5 text-primary" /></>
                            )}
                          </div>

                          {/* Quick action: delete (own draft only) */}
                          {isOwnNote && cfg?.canDelete && (
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
                          {/* Quick action: submit (own note, submittable but not editable inline) */}
                          {isOwnNote && cfg?.canSubmit && !cfg?.canEdit && (
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
                </>
              )}
          </SectionCard>
        )}

        {/* Prompt when filters not complete */}
        {!filtersComplete && !loadingAssign && (
          <Card className="shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="font-medium text-sm">
                {uniqueClasses.length === 0 ? 'No Classes Assigned' : 'Select Class, Subject & Term'}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                {uniqueClasses.length === 0
                  ? 'You have not been assigned to any classes yet. Contact your administrator.'
                  : 'Choose a class, subject, and term above to browse published topics and manage your lesson notes.'}
              </p>
            </CardContent>
          </Card>
        )}

    </div>
  );
}
