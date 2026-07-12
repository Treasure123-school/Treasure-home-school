import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearch } from 'wouter';
import ExamQuestionAdder from './ExamQuestionAdder';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useClassSubjects } from '@/hooks/useClassSubjects';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AssessmentList } from './assessments/AssessmentList';
import { DeleteAssessmentDialog } from './assessments/DeleteAssessmentDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertExamSchema, insertExamQuestionSchema, insertQuestionOptionSchema, type Exam, type ExamQuestion, type QuestionOption, type Class, type Subject } from '@shared/schema';
import { z } from 'zod';
import { Plus, Edit, BookOpen, Trash2, Clock, Users, FileText, Eye, Play, Upload, Save, Shield, MoreVertical, ChevronDown, ChevronUp, Settings, ChevronLeft, ChevronRight, Check, Calendar, Layers, Target, MapPin, DollarSign, UserCheck, Ticket, Trophy as TrophyIcon, Award as AwardIcon, Clipboard } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { PageHeader, SearchInput, EmptyState, MiniStatCard, MiniStatGrid } from "@/components/shared";

// Form schemas - Use the shared insertExamSchema which has proper preprocessing
const examFormSchema = insertExamSchema.omit({ 
  createdBy: true,
  allowRetakes: true,
  shuffleOptions: true,
  enableProctoring: true,
  lockdownMode: true,
  requireWebcam: true,
  requireFullscreen: true,
  maxTabSwitches: true
});

const questionFormSchema = insertExamQuestionSchema
  .omit({ examId: true, orderNumber: true }) // These are added later in onSubmitQuestion
  .extend({
    // Handle NaN values from frontend forms with valueAsNumber: true
    points: z.preprocess((val) => {
      if (val === '' || val === null || val === undefined || Number.isNaN(val)) return 1;
      return val;
    }, z.coerce.number().int().min(1, "Points must be at least 1").default(1)),

    // Enhanced fields for theory questions
    instructions: z.string().optional(),
    sampleAnswer: z.string().optional(),

    options: z.array(z.object({
      optionText: z.string().min(1, 'Option text is required'),
      isCorrect: z.boolean(),
      // Enhanced option fields
      partialCreditValue: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined || Number.isNaN(val)) return 0;
        return val;
      }, z.coerce.number().min(0).default(0)).optional(),
      explanationText: z.string().optional(),
    })).optional(),
  }).refine((data) => {
    if (data.questionType === 'multiple_choice') {
      if (!data.options || data.options.length < 2) {
        return false;
      }
      const nonEmptyOptions = data.options.filter(opt => opt.optionText.trim() !== '');
      if (nonEmptyOptions.length < 2) {
        return false;
      }
      const hasCorrectAnswer = nonEmptyOptions.some(opt => opt.isCorrect);
      return hasCorrectAnswer;
    }
    // Enhanced validation for theory questions
    if (data.questionType === 'essay' && data.questionText && data.questionText.length < 20) {
      return false;
    }
    return true;
  }, {
    message: "Multiple choice questions require at least 2 non-empty options with one marked as correct. Essay questions need detailed question text (20+ characters).",
    path: ["options"]
  });

type ExamForm = z.infer<typeof examFormSchema>;
type QuestionForm = z.infer<typeof questionFormSchema>;

// Component to display question options
function QuestionOptions({ questionId }: { questionId: number }) {
  const { data: options = [], isLoading } = useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options', questionId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/question-options/${questionId}`);
      if (!response.ok) throw new Error('Failed to fetch question options');
      return response.json();
    },
    enabled: !!questionId,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading options...</div>;
  }
  if (options.length === 0) {
    return <div className="text-sm text-muted-foreground">No options added yet</div>;
  }
  return (
    <div className="space-y-1">
      {options.map((option: any, index: number) => (
        <div key={option.id} className="flex items-center space-x-2">
          <span className="text-sm font-mono text-muted-foreground min-w-[20px]">
            {String.fromCharCode(65 + index)}.
          </span>
          <span className="text-sm">{option.optionText}</span>
          {option.isCorrect && (
            <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
export default function ExamManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isQuestionAdderOpen, setIsQuestionAdderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [deletingExamIds, setDeletingExamIds] = useState<Set<number>>(new Set());
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const searchParams = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get('openCreate') === 'true') {
      setCurrentStep(1);
      resetExam();
      const classIdParam = params.get('classId');
      if (classIdParam) {
        const cid = parseInt(classIdParam);
        if (!isNaN(cid)) setExamValue('classId', cid);
      }
      setIsExamDialogOpen(true);
    }
  }, [searchParams]);

  // Track pending deletions to prevent race conditions with Realtime
  const pendingDeletionsRef = useRef<Set<number>>(new Set());
  const pendingQuestionDeletionsRef = useRef<Set<number>>(new Set());

  // Track publish/unpublish state PER EXAM (not a single global id/action) so that
  // toggling two different exams close together can never stomp on each other's
  // pending label. Map value is the *intended* action ('publish' | 'unpublish'),
  // recorded up front in onMutate — never re-derived from exam.isPublished, which
  // is already flipped to the target value by the optimistic update, so reading it
  // back after the fact always yields the opposite word.
  const [togglingExams, setTogglingExams] = useState<Record<number, 'publish' | 'unpublish'>>({});
  // Keep a ref in sync for use in real-time event handlers (avoids stale closures)
  const togglingExamsRef = useRef<Record<number, 'publish' | 'unpublish'>>({});
  useEffect(() => {
    togglingExamsRef.current = togglingExams;
  }, [togglingExams]);

  const setExamToggling = useCallback((examId: number, action: 'publish' | 'unpublish' | null) => {
    setTogglingExams(prev => {
      if (action === null) {
        if (!(examId in prev)) return prev; // no-op, avoids extra renders
        const { [examId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [examId]: action };
    });
  }, []);

  const { register: registerExam, handleSubmit: handleExamSubmit, formState: { errors: examErrors }, control: examControl, setValue: setExamValue, reset: resetExam, watch: watchExam, trigger: triggerExam } = useForm<ExamForm>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      assessmentCategory: 'academic',
      examType: 'exam',
      timerMode: 'individual',
      totalMarks: 100,
      timeLimit: 60,
      isPublished: false,
      shuffleQuestions: false,
      autoGradingEnabled: true,
      instantFeedback: false,
      showCorrectAnswers: true,
      passingScore: 60,
      gradingScale: 'active',
      registrationOpen: false,
      generateAdmitCards: false,
      generateCandidateNumbers: false,
      certificateEnabled: false,
      leaderboardEnabled: false,
    }
  });

  const { register: registerQuestion, handleSubmit: handleQuestionSubmit, formState: { errors: questionErrors }, control: questionControl, setValue: setQuestionValue, reset: resetQuestion, watch: watchQuestion } = useForm<QuestionForm>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      questionType: 'multiple_choice',
      points: 1,
      options: [
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ]
    }
  });

  const questionType = watchQuestion('questionType');
  const options = watchQuestion('options');
  const watchTimerMode = watchExam('timerMode');
  const watchDuration = watchExam('timeLimit');
  const watchGlobalStartTime = watchExam('startTime');
  const watchAssessmentCategory = watchExam('assessmentCategory') || 'academic';
  const isStandalone = watchAssessmentCategory === 'standalone';

  // Fetch exams with pending deletion filter
  const { data: rawExams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['/api/exams'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exams');
      return await response.json();
    },
  });

  // Assessments stay visible until the backend actually confirms deletion —
  // see deleteExamMutation below. deletingExamIds only tracks in-flight
  // deletions for "Deleting..." button/menu labels, it no longer hides items.
  const exams = rawExams;

  // Enable real-time updates for exams with specific event handlers
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams'],
    onEvent: (event) => {
      // Handle exam.deleted event - immediately remove from cache
      if (event.eventType === 'exam.deleted' || (event.operation === 'DELETE' && event.table === 'exams')) {
        const deletedExamId = event.data?.id;
        if (deletedExamId) {
          // Clear pending deletion flag - the delete is now confirmed by backend
          pendingDeletionsRef.current.delete(deletedExamId);

          queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) =>
            old?.filter((e) => e.id !== deletedExamId) || []
          );
          // Clear selected exam if it was deleted
          if (selectedExam?.id === deletedExamId) {
            setSelectedExam(null);
            setEditingExam(null);
            setEditingQuestion(null);
          }
        }
      }
      // Handle exam.published / exam.unpublished events - update cache and clear toggle state
      if (event.eventType === 'exam.published' || event.eventType === 'exam.unpublished') {
        const updatedExam = event.data;
        if (updatedExam?.id) {
          // Use ref to get current toggling state (avoids stale closure)
          if (updatedExam.id in togglingExamsRef.current) {
            setExamToggling(updatedExam.id, null);
          }
          queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) =>
            old?.map((e) => e.id === updatedExam.id ? updatedExam : e) || []
          );
        }
      }
      // Handle table_change UPDATE events for exams (covers publish/unpublish via emitTableChange)
      if (event.operation === 'UPDATE' && event.table === 'exams') {
        const updatedExam = event.data;
        if (updatedExam?.id) {
          // Use ref to get current toggling state (avoids stale closure)
          if (updatedExam.id in togglingExamsRef.current) {
            setExamToggling(updatedExam.id, null);
          }
        }
      }
    }
  });

  // Enable real-time updates for exam questions when viewing/editing an exam
  // Note: queryKey must match exactly with the useQuery queryKey for cache invalidation to work
  // skipCacheInvalidation=true: we manage all cache updates manually in onEvent and via
  // optimistic mutations. Without this, the hook calls refetchQueries() on every socket
  // event which races with optimistic updates and can restore deleted questions.
  useSocketIORealtime({
    table: 'exam_questions',
    queryKey: ['/api/exam-questions', selectedExam?.id],
    examId: selectedExam?.id,
    enabled: !!selectedExam?.id,
    skipCacheInvalidation: true,
    onEvent: (event) => {
      // Handle question.deleted event - immediately remove from cache
      if (event.eventType === 'question.deleted' || (event.operation === 'DELETE' && event.table === 'exam_questions')) {
        const deletedQuestionId = event.data?.id;
        const eventExamId = event.data?.examId;
        if (deletedQuestionId) {
          // Clear pending deletion flag - the delete is now confirmed by backend
          pendingQuestionDeletionsRef.current.delete(deletedQuestionId);

          if (selectedExam?.id === eventExamId) {
            queryClient.setQueryData(['/api/exam-questions', selectedExam?.id], (old: ExamQuestion[] | undefined) =>
              old?.filter((q) => q.id !== deletedQuestionId) || []
            );
            // Clear editing question if it was deleted
            if (editingQuestion?.id === deletedQuestionId) {
              setEditingQuestion(null);
            }
          }
        }
      }
    }
  });

  // Fetch teacher's assigned classes and subjects (teachers only see their assignments)
  const { data: myAssignments, isLoading: assignmentsLoading } = useQuery<{
    isAdmin: boolean;
    classes: any[];
    subjects: any[];
    assignments: Array<{ classId: number; subjectId: number; isActive: boolean }>;
  }>({
    queryKey: ['/api/my-assignments'],
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch ALL subjects for display purposes (showing subject names for existing exams)
  const { data: allSubjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
    staleTime: 60000,
  });

  // Fetch ALL classes for display purposes (showing class names for existing exams)
  const { data: allClasses = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
    staleTime: 60000,
  });

  // Use teacher's assigned classes for dropdowns (teachers), or all classes (admins)
  const classes = myAssignments?.isAdmin ? allClasses : (myAssignments?.classes || []);
  const classesLoading = assignmentsLoading;

  // Filter subjects based on selected class - only show subjects the teacher is assigned to for that class
  const selectedClassId = watchExam('classId');

  // Filter subjects to only those assigned to the selected class (reusable hook)
  const {
    subjects: availableSubjects,
    isLoading: subjectsLoading,
  } = useClassSubjects(selectedClassId);

  // availableSubjects is for dropdown selections (filtered to teacher's assignments or class mappings)
  const subjects = availableSubjects;

  // Clear subject and teacher when class changes (to prevent stale selections)
  useEffect(() => {
    if (selectedClassId) {
      setExamValue('subjectId', undefined as any);
      setExamValue('teacherInChargeId', undefined);
    }
  }, [selectedClassId, setExamValue]);

  // Fetch teachers for teacher in-charge dropdown
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return await response.json();
    },
  });

  const { currentTerm, allTerms: terms } = useAcademicCalendar();

  // Auto-select current term when the Create Exam dialog opens (not for edits)
  useEffect(() => {
    if (currentTerm && !editingExam && isExamDialogOpen) {
      setExamValue('termId', currentTerm.id as any);
    }
  }, [currentTerm, editingExam, isExamDialogOpen, setExamValue]);

  // Fetch active grading config so the exam form can show real DB scale names
  const { data: gradingConfigData } = useQuery<{ availableScales: string[]; dbSettings: { defaultGradingScale: string } }>({
    queryKey: ['/api/grading-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/grading-config');
      if (!res.ok) return null;
      return res.json();
    },
  });
  const availableGradingScales: string[] = gradingConfigData?.availableScales ?? [];
  const activeGradingScaleName: string = gradingConfigData?.dbSettings?.defaultGradingScale ?? 'standard';

  const { data: rawExamQuestions = [], isLoading: loadingQuestions } = useQuery<ExamQuestion[]>({
    queryKey: ['/api/exam-questions', selectedExam?.id],
    enabled: !!selectedExam?.id,
  });

  // Filter out questions that are pending deletion to prevent race conditions
  const examQuestions = rawExamQuestions.filter((question: ExamQuestion) => !pendingQuestionDeletionsRef.current.has(question.id));

  const { data: rawPreviewQuestions = [], isLoading: loadingPreviewQuestions } = useQuery<ExamQuestion[]>({
    queryKey: ['/api/exam-questions', previewExam?.id],
    enabled: !!previewExam?.id,
  });

  // Filter out questions that are pending deletion to prevent race conditions in preview
  const previewQuestions = rawPreviewQuestions.filter((question: ExamQuestion) => !pendingQuestionDeletionsRef.current.has(question.id));

  // Stable, memoized exam ID list — prevents the question-counts query key from
  // changing on every render (which would trigger spurious refetches)
  const examIds = useMemo(() => exams.map((exam: Exam) => exam.id), [exams]);

  // Fetch question counts for all exams
  const { data: questionCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/exams/question-counts', examIds],
    enabled: examIds.length > 0,
    queryFn: async () => {
      const examIds = exams.map((exam: Exam) => exam.id);
      if (examIds.length === 0) return {};

      const queryString = examIds.map((id: number) => `examIds=${id}`).join('&');
      const response = await apiRequest('GET', `/api/exams/question-counts?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch question counts');
      return response.json();
    },
  });

  // Optimistically bump a single exam's question-count badge in every cached
  // copy of the question-counts map (the cache key includes the exam-id list,
  // so multiple variants of the query can be cached at once). This is what
  // makes the "X questions" badge on each exam card/row update the instant a
  // question is added/deleted, instead of waiting for the background
  // invalidation + refetch below to complete. Negative deltas are clamped at 0.
  const adjustQuestionCountCache = useCallback((examId: number | undefined, delta: number) => {
    if (!examId || !delta) return;
    queryClient.setQueriesData<Record<number, number>>(
      { queryKey: ['/api/exams/question-counts'], exact: false },
      (old) => {
        if (!old) return old;
        const current = old[examId] ?? 0;
        return { ...old, [examId]: Math.max(0, current + delta) };
      }
    );
  }, []);

  // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async (examData: ExamForm) => {
      const response = await apiRequest('POST', '/api/exams', examData);
      if (!response.ok) throw new Error('Failed to create exam');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Exam created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
      setIsExamDialogOpen(false);
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create exam",
        variant: "destructive",
      });
    },
  });

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async ({ examId, examData }: { examId: number; examData: Partial<ExamForm> }) => {
      const response = await apiRequest('PATCH', `/api/exams/${examId}`, examData);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update exam');
      }
      return response.json();
    },
    onMutate: async ({ examId, examData }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/exams'] });
      const previousExams = queryClient.getQueryData(['/api/exams']);

      queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) => {
        if (!old) return old;
        return old.map((exam) =>
          exam.id === examId ? { ...exam, ...examData } : exam
        );
      });

      return { previousExams };
    },
    onSuccess: (updatedExam) => {
      queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) => {
        if (!old) return old;
        return old.map((exam) =>
          exam.id === updatedExam.id ? updatedExam : exam
        );
      });

      toast({
        title: "Success",
        description: "Exam updated successfully",
      });
      setIsExamDialogOpen(false);
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousExams) {
        queryClient.setQueryData(['/api/exams'], context.previousExams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update exam",
        variant: "destructive",
      });
    },
  });

  // Publish/Unpublish exam mutation with optimistic update
  const togglePublishMutation = useMutation({
    mutationFn: async ({ examId, isPublished }: { examId: number; isPublished: boolean }) => {
      const response = await apiRequest('PATCH', `/api/exams/${examId}/publish`, { isPublished });
      if (!response.ok) throw new Error('Failed to update exam publish status');
      return response.json();
    },
    onMutate: async ({ examId, isPublished }) => {
      // Track this exam's in-flight action explicitly, keyed by its own id, so a
      // second toggle on a different exam can never clear or overwrite this one's
      // pending label. Recording it here (before the cache flips) is what lets the
      // button correctly say "Publishing..." vs "Unpublishing..." — reading it back
      // off exam.isPublished after the optimistic update would always show the
      // opposite word, since that field is already the new value.
      setExamToggling(examId, isPublished ? 'publish' : 'unpublish');

      await queryClient.cancelQueries({ queryKey: ['/api/exams'] });
      const previousExams = queryClient.getQueryData(['/api/exams']);

      // Optimistically update the exam's published status for instant feedback
      queryClient.setQueryData(['/api/exams'], (old: any) => {
        if (!old) return old;
        return old.map((exam: any) =>
          exam.id === examId ? { ...exam, isPublished } : exam
        );
      });

      return { previousExams };
    },
    onSuccess: (data, { isPublished }) => {
      // Reconcile with confirmed backend data (covers any other fields the
      // server may have changed alongside isPublished, e.g. publishedAt).
      queryClient.setQueryData(['/api/exams'], (old: any) => {
        if (!old) return old;
        return old.map((exam: any) =>
          exam.id === data.id ? data : exam
        );
      });

      toast({
        title: "Success",
        description: `Exam ${isPublished ? 'published' : 'unpublished'} successfully`,
      });
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousExams) {
        queryClient.setQueryData(['/api/exams'], context.previousExams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update exam publish status",
        variant: "destructive",
      });
    },
    onSettled: (_data, _error, variables) => {
      // Clear only THIS exam's toggling state once its own request finishes,
      // success or failure — guarantees the button never gets stuck reading
      // "Publishing..."/"Unpublishing..." forever, and never clears a different
      // exam's still-in-flight toggle if multiple are triggered concurrently.
      setExamToggling(variables.examId, null);
    },
  });

  // Delete exam mutation — confirm-first (not optimistic).
  // The frontend never touches the exams list until the backend has actually
  // returned a success status for the DELETE request. This guarantees the
  // item can never flicker back in: it simply never leaves until the server
  // confirms it's really gone. Uses the smart deletion system on the backend,
  // which cascade-deletes all related data.
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      try {
        const response = await apiRequest('DELETE', `/api/exams/${examId}`);
        // 404 means the exam is already gone from the database (stale cache).
        // Goal achieved — treat it as success.
        if (response.status === 404) return null;
        if (!response.ok) {
          // Read the actual server error so the toast shows a meaningful message
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message || `Failed to delete exam (${response.status})`);
        }
        // Handle both 204 (legacy) and 200 with deletion stats
        if (response.status === 204) return null;
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 0) {
          return response.json();
        }
        return null;
      } catch (error) {
        // Re-throw so react-query's onError handles the UI feedback consistently,
        // whether the failure was a thrown network error or a non-OK response above.
        throw error instanceof Error ? error : new Error('Failed to delete exam');
      }
    },
    onMutate: async (examId) => {
      // Mark this deletion as pending to prevent the Realtime socket from
      // re-adding it while the request is in flight. Intentionally does NOT
      // remove the item from the cache — it must stay visible until the
      // backend confirms success, so there is nothing to roll back on error.
      pendingDeletionsRef.current.add(examId);
      setDeletingExamIds(prev => new Set(prev).add(examId));
    },
    onSuccess: (_, examId) => {
      // Clear pending/in-flight flags
      pendingDeletionsRef.current.delete(examId);
      setDeletingExamIds(prev => { const next = new Set(prev); next.delete(examId); return next; });

      // Only now — after the backend confirmed the deletion — remove it from the UI.
      queryClient.setQueryData<Exam[]>(['/api/exams'], (old) =>
        old?.filter((e) => e.id !== examId) ?? []
      );

      if (selectedExam?.id === examId) {
        setSelectedExam(null);
        setEditingExam(null);
        setEditingQuestion(null);
      }

      toast({ title: "Success", description: "Exam deleted successfully" });

      // Silent background invalidations — these never block the UI
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
    },
    onError: (error: any, examId) => {
      // Remove from pending flags — the item was never hidden, so nothing to restore
      pendingDeletionsRef.current.delete(examId);
      setDeletingExamIds(prev => { const next = new Set(prev); next.delete(examId); return next; });

      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete exam. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete question mutation — optimistic update for instant UI feedback.
  // The item disappears immediately; restored automatically if the backend fails.
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest('DELETE', `/api/exam-questions/${questionId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete question');
      }
      return null;
    },
    onMutate: async (questionId) => {
      // Mark as pending to shield against race conditions with Realtime events
      pendingQuestionDeletionsRef.current.add(questionId);

      const examId = selectedExam?.id;

      if (examId) {
        // Cancel any in-flight refetches so they don't overwrite our optimistic removal
        await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', examId] });

        // Snapshot the current list so we can roll back on error
        const snapshot = queryClient.getQueryData<ExamQuestion[]>(['/api/exam-questions', examId]);

        // Immediately remove from cache — user sees it gone right now
        queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old) =>
          old?.filter((q) => q.id !== questionId) ?? []
        );

        // Immediately decrement the "X questions" badge for this exam — don't
        // wait for the background invalidation to refetch it.
        adjustQuestionCountCache(examId, -1);

        // Immediate success feedback — no waiting for the server
        toast({ title: "Question deleted", description: "Question removed successfully." });

        return { snapshot, examId };
      }

      toast({ title: "Question deleted", description: "Question removed successfully." });
      return { snapshot: undefined, examId: undefined };
    },
    onSuccess: (_, questionId) => {
      pendingQuestionDeletionsRef.current.delete(questionId);
      if (editingQuestion?.id === questionId) setEditingQuestion(null);

      // Defensive: ensure the question is gone even if a socket-triggered refetch
      // restored it between onMutate and now. This is a no-op when the optimistic
      // update already removed it correctly.
      const examId = selectedExam?.id;
      if (examId) {
        queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old) =>
          old?.filter((q) => q.id !== questionId) ?? []
        );
      }

      // Silent background sync — does not flicker the UI
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/question-options', questionId] });
    },
    onError: (error: any, questionId, context) => {
      pendingQuestionDeletionsRef.current.delete(questionId);

      // Roll back optimistic removal — restore exact previous list
      const ctx = context as { snapshot?: ExamQuestion[]; examId?: number } | undefined;
      if (ctx?.snapshot !== undefined && ctx?.examId) {
        queryClient.setQueryData(['/api/exam-questions', ctx.examId], ctx.snapshot);
      }
      // Roll back the optimistic question-count decrement too
      if (ctx?.examId) {
        adjustQuestionCountCache(ctx.examId, 1);
      }

      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete question. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handles confirm-delete: closes the modal immediately then fires the mutation
  // so the user gets instant feedback without waiting for the network.
  const handleConfirmDeleteQuestion = useCallback((questionId: number) => {
    setQuestionToDelete(null); // close confirmation dialog immediately
    deleteQuestionMutation.mutate(questionId);
  }, [deleteQuestionMutation]);

  // Create question mutation with no retries to prevent circuit breaker amplification
  const createQuestionMutation = useMutation({
    retry: false, // Disable retries for question creation to prevent circuit breaker amplification
    mutationFn: async (questionData: QuestionForm & { examId: number }) => {
      const response = await apiRequest('POST', '/api/exam-questions', questionData);

      // apiRequest already handles error classification for non-OK responses
      const result = await response.json();
      return result;
    },
    onMutate: async (questionData) => {
      // Immediately bump the "X questions" badge — don't wait for the
      // background invalidation below to refetch it.
      adjustQuestionCountCache(questionData.examId, 1);
      return { examId: questionData.examId };
    },
    onSuccess: (createdQuestion) => {
      toast({
        title: "Success",
        description: "Question added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', selectedExam?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'], exact: false });
      // Invalidate question options for the newly created question to ensure fresh data
      if (createdQuestion?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/question-options', createdQuestion.id] });
      }
      setIsQuestionDialogOpen(false);
      // Reset form with default values
      resetQuestion({
        questionType: 'multiple_choice',
        points: 1,
        questionText: '',
        instructions: '',
        sampleAnswer: '',
        options: [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ]
      });
    },
    onError: (error: any, _variables, context) => {
      // Roll back the optimistic question-count increment
      if (context?.examId) {
        adjustQuestionCountCache(context.examId, -1);
      }

      // Use classified error types for better error handling
      if (error?.message?.includes('Circuit breaker is OPEN')) {
        toast({
          title: "Connection Issue",
          description: "Connection temporarily unavailable. Please wait a moment and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else if (error?.errorType === 'auth') {
        toast({
          title: "Authentication Error",
          description: "Please log out and log back in to continue.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'timeout') {
        toast({
          title: "Request Timeout",
          description: "The request took too long. Please try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'network') {
        toast({
          title: "Network Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'client') {
        toast({
          title: "Invalid Question Data",
          description: (
            <div className="space-y-2">
              <p>{error.message || "Please check your question data and try again."}</p>
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <p className="text-xs font-medium">Quick Checklist:</p>
                <ul className="text-xs space-y-1 mt-1">
                  <li>• Question text is at least 5 characters</li>
                  <li>• Multiple choice has at least 2 options</li>
                  <li>• One option is marked as correct</li>
                  <li>• Point value is assigned</li>
                </ul>
              </div>
            </div>
          ),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to Create Question",
          description: (
            <div className="space-y-2">
              <p>{error.message || "Unable to save the question. Please review and try again."}</p>
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <p className="text-xs font-medium">Need help?</p>
                <p className="text-xs mt-1">
                  • Check all required fields are filled<br />
                  • Ensure proper question format<br />
                  • Contact admin if issue persists
                </p>
              </div>
            </div>
          ),
          variant: "destructive",
        });
      }
    },
  });

  // Update question mutation with optimistic update
  const updateQuestionMutation = useMutation({
    retry: false,
    mutationFn: async ({ questionId, questionData }: { questionId: number; questionData: Partial<QuestionForm> }) => {
      const response = await apiRequest('PATCH', `/api/exam-questions/${questionId}`, questionData);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update question');
      }
      return response.json();
    },
    onMutate: async ({ questionId, questionData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', selectedExam?.id] });

      // Snapshot previous value
      const previousQuestions = queryClient.getQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id]);

      // Optimistically update the question with only compatible fields
      const { options, ...safeData } = questionData as any;
      queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id], (old = []) =>
        old.map(q => q.id === questionId ? { ...q, ...safeData } : q)
      );

      return { previousQuestions };
    },
    onSuccess: (updatedQuestion) => {
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
      // Update cache with confirmed backend data
      queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id], (old = []) =>
        old.map(q => q.id === updatedQuestion.id ? updatedQuestion : q)
      );
      // Invalidate question options in case they changed
      if (updatedQuestion?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/question-options', updatedQuestion.id] });
      }
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      // Reset form with default values
      resetQuestion({
        questionType: 'multiple_choice',
        points: 1,
        questionText: '',
        instructions: '',
        sampleAnswer: '',
        options: [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ]
      });
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousQuestions) {
        queryClient.setQueryData(['/api/exam-questions', selectedExam?.id], context.previousQuestions);
      }
      toast({
        title: "Failed to Update Question",
        description: error.message || "Unable to save the question. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Function to open edit dialog with question data
  const handleEditQuestion = async (question: ExamQuestion) => {
    setEditingQuestion(question);

    // Fetch options if it's a multiple choice question
    let questionOptions: any[] = [];
    if (question.questionType === 'multiple_choice') {
      try {
        const response = await apiRequest('GET', `/api/question-options/${question.id}`);
        if (response.ok) {
          questionOptions = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch question options:', error);
      }
    }

    // Populate form with question data
    resetQuestion({
      questionText: question.questionText || '',
      questionType: question.questionType as any || 'multiple_choice',
      points: question.points || 1,
      instructions: (question as any).instructions || '',
      sampleAnswer: (question as any).sampleAnswer || '',
      options: questionOptions.length > 0
        ? questionOptions.map((opt: any) => ({
          optionText: opt.optionText || '',
          isCorrect: opt.isCorrect || false,
        }))
        : [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ],
    });

    setIsQuestionDialogOpen(true);
  };

  const onSubmitExam = (data: ExamForm) => {
    if (editingExam) {
      updateExamMutation.mutate({ examId: editingExam.id, examData: data });
    } else {
      createExamMutation.mutate(data);
    }
  };

  // Function to open edit dialog with exam data
  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);

    // Format date for the input field (YYYY-MM-DD format)
    const formatDate = (dateValue: string | Date | null | undefined): string => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    };

    // Format datetime-local for input fields (returns string for HTML input)
    const formatDateTime = (dateValue: string | Date | null | undefined): string => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().slice(0, 16);
    };

    // Parse date to Date object for schema validation
    const parseToDate = (dateValue: string | Date | null | undefined): Date | undefined => {
      if (!dateValue) return undefined;
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return undefined;
      return date;
    };

    // Populate form with exam data
    resetExam({
      assessmentCategory: (exam as any).assessmentCategory || 'academic',
      name: exam.name || '',
      date: formatDate(exam.date),
      classId: exam.classId ?? undefined,
      subjectId: exam.subjectId ?? undefined,
      termId: exam.termId || undefined,
      examType: (exam.examType as 'test' | 'exam') || 'exam',
      teacherInChargeId: exam.teacherInChargeId || undefined,
      instructions: exam.instructions || '',
      timerMode: (exam.timerMode as 'individual' | 'global') || 'individual',
      timeLimit: exam.timeLimit || 60,
      totalMarks: exam.totalMarks || 100,
      startTime: parseToDate(exam.startTime),
      endTime: parseToDate(exam.endTime),
      isPublished: exam.isPublished || false,
      shuffleQuestions: exam.shuffleQuestions || false,
      autoGradingEnabled: exam.autoGradingEnabled !== false,
      instantFeedback: exam.instantFeedback || false,
      showCorrectAnswers: exam.showCorrectAnswers ?? true,
      passingScore: exam.passingScore || 60,
      gradingScale: exam.gradingScale || 'active',
      purpose: (exam as any).purpose || undefined,
      venue: (exam as any).venue || undefined,
      targetType: (exam as any).targetType || undefined,
      registrationFee: (exam as any).registrationFee ?? undefined,
      registrationOpen: (exam as any).registrationOpen || false,
      registrationDeadline: (exam as any).registrationDeadline || undefined,
      candidateType: (exam as any).candidateType || undefined,
      generateAdmitCards: (exam as any).generateAdmitCards || false,
      generateCandidateNumbers: (exam as any).generateCandidateNumbers || false,
      certificateEnabled: (exam as any).certificateEnabled || false,
      leaderboardEnabled: (exam as any).leaderboardEnabled || false,
    });

    setCurrentStep(1);
    setIsExamDialogOpen(true);
  };

  // Handle dialog close to reset editingExam state
  const handleExamDialogClose = (open: boolean) => {
    setIsExamDialogOpen(open);
    if (!open) {
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    }
  };

  const EXAM_STEPS = [
    { id: 1, title: 'Assessment Details', icon: FileText },
    { id: 2, title: isStandalone ? 'Configuration' : 'Academic & Timing', icon: Calendar },
    { id: 3, title: 'Options & Grading', icon: Settings },
    { id: 4, title: 'Review & Create', icon: Check },
  ];

  const handleNext = async () => {
    let fieldsToValidate: (keyof ExamForm)[] = [];
    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 1) {
      fieldsToValidate = ['name', 'date', 'examType'];
      if (!isStandalone) fieldsToValidate.push('classId', 'subjectId');
    }
    if (currentStep === 2) {
      fieldsToValidate = ['totalMarks', 'timeLimit'];
      if (!isStandalone) fieldsToValidate.push('termId');
    }
    const valid = await triggerExam(fieldsToValidate);
    if (valid) setCurrentStep(s => s + 1);
  };

  const onInvalidExam = (errors: any) => {
    const errorFields = Object.keys(errors);
    const friendlyFieldNames = {
      classId: 'Class',
      subjectId: 'Subject',
      termId: 'Academic Term',
      totalMarks: 'Total Marks',
      date: 'Exam Date',
      name: 'Exam Name'
    };
    const errorMessages = errorFields.map(field => {
      const friendlyName = friendlyFieldNames[field as keyof typeof friendlyFieldNames] || field;
      return `${friendlyName}: ${errors[field].message}`;
    }).join(', ');
    toast({
      title: "Please Fix Required Fields",
      description: errorMessages || "Please check all required fields and try again",
      variant: "destructive",
    });
  };

  const onInvalidQuestion = (errors: any) => {
    const errorFields = Object.keys(errors);
    const errorMessages = errorFields.map(field => `${field}: ${errors[field].message}`).join(', ');
    toast({
      title: "Question Validation Error",
      description: errorMessages || "Please check all required fields",
      variant: "destructive",
    });
  };

  const onSubmitQuestion = (data: QuestionForm) => {

    if (!selectedExam) {
      toast({
        title: "No Exam Selected",
        description: "Please select an exam before adding questions",
        variant: "destructive",
      });
      return;
    }
    // Enhanced validation for question text
    if (!data.questionText || data.questionText.trim().length < 5) {
      toast({
        title: "Invalid Question",
        description: "Question text must be at least 5 characters long",
        variant: "destructive",
      });
      return;
    }

    // Prepare the question data
    const questionData: any = {
      ...data,
      questionText: data.questionText.trim(),
      points: data.points || 1,
    };

    // For multiple choice questions, filter out empty options and validate
    if (data.questionType === 'multiple_choice' && data.options) {
      const validOptions = data.options
        .filter(option => option.optionText && option.optionText.trim() !== '')
        .map((option, index) => ({
          optionText: option.optionText.trim(),
          isCorrect: option.isCorrect
          // orderNumber is automatically set by the backend
        }));

      // Validate multiple choice requirements
      if (validOptions.length < 2) {
        toast({
          title: "Invalid Options",
          description: "Multiple choice questions require at least 2 non-empty options",
          variant: "destructive",
        });
        return;
      }
      const hasCorrectAnswer = validOptions.some(opt => opt.isCorrect);
      if (!hasCorrectAnswer) {
        toast({
          title: "No Correct Answer",
          description: "Please mark at least one option as correct",
          variant: "destructive",
        });
        return;
      }
      questionData.options = validOptions;
    } else {
      // For non-multiple choice questions, don't send options
      delete questionData.options;
    }

    // Check if we're editing or creating
    if (editingQuestion) {
      updateQuestionMutation.mutate({
        questionId: editingQuestion.id,
        questionData,
      });
    } else {
      const nextOrderNumber = examQuestions.length + 1;
      createQuestionMutation.mutate({
        ...questionData,
        examId: selectedExam.id,
        orderNumber: nextOrderNumber,
      });
    }
  };

  const addOption = () => {
    const currentOptions = options || [];
    setQuestionValue('options', [...currentOptions, { optionText: '', isCorrect: false }]);
  };

  const removeOption = (index: number) => {
    const currentOptions = options || [];
    const newOptions = currentOptions.filter((_, i) => i !== index);
    setQuestionValue('options', newOptions);
  };

  const updateOption = (index: number, field: 'optionText' | 'isCorrect', value: string | boolean) => {
    const currentOptions = options || [];
    const newOptions = [...currentOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setQuestionValue('options', newOptions);
  };

  // CSV upload mutation with optimistic updates for instant UI feedback
  const csvUploadMutation = useMutation({
    retry: false,
    mutationFn: async (questions: any[]) => {
      const response = await apiRequest('POST', '/api/exam-questions/bulk', {
        examId: selectedExam?.id,
        questions
      });

      const result = await response.json();
      return result;
    },
    onMutate: async (newQuestions) => {
      // Show loading toast immediately when mutation starts
      toast({
        title: "Uploading Questions",
        description: `Processing ${newQuestions.length} question${newQuestions.length > 1 ? 's' : ''}... please wait.`,
      });

      const queryKey = ['/api/exam-questions', selectedExam?.id];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousQuestions = queryClient.getQueryData<ExamQuestion[]>(queryKey);

      // Optimistically add new questions with temporary IDs
      const optimisticQuestions = newQuestions.map((q, index) => ({
        id: -(Date.now() + index), // Negative temp ID
        examId: selectedExam!.id,
        questionText: q.questionText,
        questionType: q.questionType,
        points: q.points,
        orderNumber: (previousQuestions?.length || 0) + index + 1,
        imageUrl: null,
        expectedAnswers: null,
        explanationText: null,
        hintText: null,
        partialCreditRules: null,
        instructions: q.instructions,
        sampleAnswer: q.sampleAnswer,
        createdAt: new Date(),
        autoGradable: q.questionType === 'multiple_choice',
        caseSensitive: false,
        allowPartialCredit: false,
        options: q.options || []
      })) as any;

      // Immediately update UI with optimistic data
      queryClient.setQueryData<ExamQuestion[]>(queryKey, (old: ExamQuestion[] | undefined = []) => [...(old || []), ...optimisticQuestions]);

      // Immediately bump the "X questions" badge by the full batch size —
      // corrected down in onSuccess if some rows fail validation server-side.
      const examId = selectedExam?.id;
      adjustQuestionCountCache(examId, newQuestions.length);

      return { previousQuestions, queryKey, examId, optimisticDelta: newQuestions.length };
    },
    onSuccess: async (data, variables, context) => {
      const successMessage = data.errors && data.errors.length > 0
        ? `${data.created} question${data.created !== 1 ? 's' : ''} uploaded successfully. ${data.errors.length} failed.`
        : `${data.created} question${data.created !== 1 ? 's' : ''} uploaded successfully.`;

      toast({
        title: "✓ Upload Complete",
        description: successMessage,
        variant: data.errors && data.errors.length > 0 ? "default" : "default",
      });

      // Replace optimistic data with real data from backend response
      // This ensures instant update even if Socket.IO doesn't fire for bulk inserts
      if (data.questions && Array.isArray(data.questions)) {
        const queryKey = ['/api/exam-questions', selectedExam?.id];

        queryClient.setQueryData<ExamQuestion[]>(queryKey, (old = []) => {
          // Remove optimistic questions (negative IDs) and add real questions from backend
          const nonOptimistic = old.filter(q => q.id > 0);
          return [...nonOptimistic, ...data.questions];
        });

      }

      // Reconcile the optimistic badge count with what the server actually
      // created — if some rows failed validation, `data.created` is lower
      // than the batch size we optimistically added above.
      const actualCreated = typeof data.created === 'number' ? data.created : variables.length;
      const correction = actualCreated - variables.length;
      if (correction !== 0) {
        adjustQuestionCountCache(selectedExam?.id, correction);
      }
      // Background reconciliation with the server's authoritative count
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'], exact: false });

      if (data.errors && data.errors.length > 0) {
        setTimeout(() => {
          const errorSummary = data.errors.slice(0, 3).join('; ');
          const moreErrors = data.errors.length > 3 ? ` (and ${data.errors.length - 3} more)` : '';

          toast({
            title: `${data.errors.length} Questions Failed Validation`,
            description: `${errorSummary}${moreErrors}. Check browser console for all details.`,
            variant: "destructive",
            duration: 8000,
          });
        }, 2000);
      }
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousQuestions) {
        queryClient.setQueryData(context.queryKey, context.previousQuestions);
      }
      // Roll back the optimistic question-count bump for the whole batch
      if (context?.examId && context?.optimisticDelta) {
        adjustQuestionCountCache(context.examId, -context.optimisticDelta);
      }
      // Enhanced error handling for CSV uploads using classified error types
      if (error?.message?.includes('Circuit breaker is OPEN')) {
        toast({
          title: "Connection Issue - CSV Upload",
          description: "Connection temporarily unavailable. Please wait a moment and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else if (error?.errorType === 'auth') {
        toast({
          title: "Authentication Error",
          description: "Your session may have expired. Please log out and log back in.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'timeout') {
        toast({
          title: "Upload Timeout",
          description: "The CSV upload took too long. Try uploading fewer questions at once.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'network') {
        toast({
          title: "Network Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'client' || (error?.message?.includes('400') && error?.message?.includes('Validation'))) {
        // Extract validation errors from the response if available
        let errorDetails = "Please check your CSV format. Download the template and ensure all required fields are filled.";
        if (error?.errors && Array.isArray(error.errors)) {
          const firstFewErrors = error.errors.slice(0, 2).join('; ');
          errorDetails = `${firstFewErrors}${error.errors.length > 2 ? ' (and more)' : ''}`;
        }
        toast({
          title: "CSV Validation Errors",
          description: errorDetails,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: error.message || "Unable to upload questions. Please check your CSV format and try again.",
          variant: "destructive",
          duration: 6000,
        });
      }
    },
  });

  // Download CSV template
  const downloadCSVTemplate = () => {
    const csvContent = `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Instructions,SampleAnswer
"What is 2 + 2?",multiple_choice,"2","3","4","5","C",1,"Choose the correct answer","4"
"What is the capital of France?",multiple_choice,"London","Paris","Berlin","Madrid","B",1,"Select the correct capital city","Paris"
"Explain what a Control Account is and state five advantages.",essay,"","","","","",15,"Write a detailed explanation showing your understanding of control accounts and their benefits in accounting","A Control Account is a summary account that shows the total balance of a subsidiary ledger. Advantages include: 1) Error detection 2) Time saving 3) Fraud prevention 4) Quick trial balance 5) Management control"
"Define Partnership Deed and explain its importance.",essay,"","","","","",10,"Provide definition and explain why it's important in partnerships","A Partnership Deed is a legal document that outlines the terms and conditions of a partnership business..."`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam_questions_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Enhanced Template Downloaded",
      description: "CSV template with multiple_choice and essay question types has been downloaded.",
    });
  };

  // Handle CSV file upload
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedExam) {
      if (!selectedExam) {
        toast({
          title: "No Exam Selected",
          description: "Please select an exam first before uploading questions.",
          variant: "destructive",
        });
      }
      event.target.value = '';
      return;
    }
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file (.csv extension).",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }
    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "CSV file must be smaller than 1MB.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;

        if (!csv || csv.trim().length === 0) {
          throw new Error('CSV file is empty');
        }
        const questions = parseCSV(csv);

        csvUploadMutation.mutate(questions);
      } catch (error: any) {
        toast({
          title: "CSV Format Error",
          description: error.message || "Failed to parse CSV file. Please check the format and try again.",
          variant: "destructive",
          duration: 8000,
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the CSV file. Please try again.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
  };

  // Parse CSV content into questions array
  const parseCSV = (csvContent: string) => {

    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV file is empty. Please provide a valid CSV file with question data.');
    }
    const lines = csvContent.trim().split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error(`CSV must have at least a header row and one question row. Found only ${lines.length} line(s). Please download the template for the correct format.`);
    }
    // Parse headers more carefully to handle quoted content
    const headers = parseCSVLine(lines[0]);
    const requiredHeaders = ['QuestionText', 'Type', 'Points'];
    const optionalHeaders = ['OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer', 'Instructions', 'SampleAnswer'];


    // Validate required headers with case-insensitive matching
    const normalizedHeaders = headers.map(h => h.trim());
    const missingRequiredHeaders = requiredHeaders.filter(expected =>
      !normalizedHeaders.some(found => found.toLowerCase() === expected.toLowerCase())
    );

    if (missingRequiredHeaders.length > 0) {
      throw new Error(
        `Missing required CSV headers: ${missingRequiredHeaders.join(', ')}\n\n` +
        `Required headers: ${requiredHeaders.join(', ')}\n` +
        `Optional headers: ${optionalHeaders.join(', ')}\n` +
        `Found headers: ${headers.join(', ')}\n\n` +
        `Please download the template to see the correct format.`
      );
    }
    const questions = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);

        if (row.length < headers.length) {
          errors.push(`Row ${i + 1}: Incomplete row (expected ${headers.length} columns, found ${row.length})`);
          continue;
        }
        // Use case-insensitive header matching for robustness
        const getColumnValue = (expectedHeader: string) => {
          const headerIndex = normalizedHeaders.findIndex(h => h.toLowerCase() === expectedHeader.toLowerCase());
          return headerIndex >= 0 ? row[headerIndex]?.trim() : '';
        };

        const questionText = getColumnValue('QuestionText');
        const questionType = getColumnValue('Type')?.toLowerCase().replace(/[-\s]/g, '_');
        const pointsText = getColumnValue('Points');
        const instructions = getColumnValue('Instructions');
        const sampleAnswer = getColumnValue('SampleAnswer');

        // Validate required fields
        if (!questionText || questionText.length < 5) {
          errors.push(`Row ${i + 1}: Question text is required and must be at least 5 characters`);
          continue;
        }
        if (!['multiple_choice', 'essay'].includes(questionType)) {
          errors.push(`Row ${i + 1}: Invalid question type "${questionType}". Please use 'multiple_choice' or 'essay'.`);
          continue;
        }
        const points = parseInt(pointsText) || 1;
        if (points < 1 || points > 100) {
          errors.push(`Row ${i + 1}: Points must be between 1 and 100 (found: ${pointsText})`);
          continue;
        }
        // Validation for essay questions
        if (questionType === 'essay') {
          if (questionText.length < 20) {
            errors.push(`Row ${i + 1}: Essay questions should have detailed question text (at least 20 characters)`);
            continue;
          }
        }

        const question: any = {
          questionText: questionText.trim(),
          questionType,
          points,
          orderNumber: i,
          instructions: instructions?.trim() || null,
          sampleAnswer: sampleAnswer?.trim() || null
        };

        // Handle multiple choice questions
        if (questionType === 'multiple_choice') {
          const correctAnswer = getColumnValue('CorrectAnswer')?.toUpperCase();
          const optionLetters = ['A', 'B', 'C', 'D'];

          if (!optionLetters.includes(correctAnswer)) {
            errors.push(`Row ${i + 1}: Multiple choice questions require correct answer A, B, C, or D (found: "${correctAnswer}")`);
            continue;
          }
          const options = optionLetters.map(letter => ({
            optionText: getColumnValue(`Option${letter}`),
            isCorrect: letter === correctAnswer
          })).filter(opt => opt.optionText && opt.optionText.trim() !== '');

          if (options.length < 2) {
            errors.push(`Row ${i + 1}: Multiple choice questions need at least 2 non-empty options`);
            continue;
          }
          const hasCorrectOption = options.some(opt => opt.isCorrect);
          if (!hasCorrectOption) {
            errors.push(`Row ${i + 1}: The correct answer "${correctAnswer}" doesn't match any provided options`);
            continue;
          }
          question.options = options.map((opt, index) => ({
            ...opt,
            optionText: opt.optionText.trim()
            // orderNumber is automatically set by the backend
          }));
        } else {
          // For text and essay questions, validate that no multiple choice fields are filled
          const hasOptions = ['A', 'B', 'C', 'D'].some(letter => {
            const option = getColumnValue(`Option${letter}`);
            return option && option.trim() !== '';
          });

          if (hasOptions) {
          }
        }

        questions.push(question);
      } catch (rowError: any) {
        errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    // Report any errors found
    if (errors.length > 0) {
      throw new Error(`Found ${errors.length} error(s) in CSV:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n... and ' + (errors.length - 5) + ' more errors.' : ''}`);
    }
    if (questions.length === 0) {
      throw new Error('No valid questions found in CSV. Please check the format and content.');
    }
    return questions;
  };

  // Helper function to parse CSV line handling quoted content
  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    result.push(current.trim());
    return result;
  };

  const filteredExams = useMemo(
    () => exams.filter((exam: Exam) =>
      exam.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [exams, searchTerm]
  );

  const getClassNameById = (classId: number) => {
    // Use allClasses for display (contains all classes, not just assigned ones)
    const classItem = allClasses.find((c: Class) => c.id === classId);
    return classItem?.name || 'Unknown Class';
  };

  const getSubjectNameById = (subjectId: number) => {
    // Use allSubjects for display (contains all subjects, not just assigned ones)
    const subject = allSubjects.find((s: Subject) => s.id === subjectId);
    return subject?.name || 'Unknown Subject';
  };

  if (!user) {
    return <div>Please log in to access the exam management portal.</div>;
  }
  // Map roleId to role name - matches ROLE_IDS in lib/roles.ts
  const getRoleName = (roleId: number): 'admin' | 'teacher' | 'parent' | 'student' => {
    const roleMap: { [key: number]: 'admin' | 'teacher' | 'parent' | 'student' } = {
      1: 'admin',     // Super Admin
      2: 'admin',     // Admin
      3: 'teacher',   // Teacher
      4: 'student',   // Student
      5: 'parent'     // Parent
    };
    return roleMap[roleId] || 'teacher';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Management"
        description="Create and manage academic and standalone assessments"
        icon={Clipboard}
        actions={
          <Dialog open={isExamDialogOpen} onOpenChange={handleExamDialogClose}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-create-exam"
                className="w-full sm:w-auto"
                onClick={() => {
                  // Always start a fresh wizard when creating (not editing) a new assessment
                  setEditingExam(null);
                  resetExam();
                  setCurrentStep(1);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExam ? 'Edit Assessment' : 'Create New Assessment'}</DialogTitle>
              </DialogHeader>

              {/* Step Indicator */}
              <div className="flex items-center gap-0 mb-1">
                {EXAM_STEPS.map((step, i) => (
                  <div key={step.id} className={`flex items-center ${i < EXAM_STEPS.length - 1 ? 'flex-1' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors flex-shrink-0 ${
                      currentStep > step.id ? 'bg-primary border-primary text-primary-foreground' :
                      currentStep === step.id ? 'border-primary text-primary' :
                      'border-muted-foreground/30 text-muted-foreground'
                    }`}>
                      {currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}
                    </div>
                    {i < EXAM_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-primary mb-3">{EXAM_STEPS[currentStep - 1].title}</p>

              <div className="space-y-4">

                {/* ── Step 1: Assessment Details ── */}
                {currentStep === 1 && (
                  <div className="space-y-4">

                    {/* Assessment Category Picker */}
                    <div className="space-y-2">
                      <Label>Assessment Category *</Label>
                      <Controller name="assessmentCategory" control={examControl} render={({ field }) => (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange('academic')}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors ${field.value === 'academic' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-primary" />
                              <span className="text-sm font-semibold">Academic</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Updates report cards &amp; cumulative records</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange('standalone')}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors ${field.value === 'standalone' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-border hover:border-muted-foreground/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-semibold">Standalone</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Independent — no report card effect</p>
                          </button>
                        </div>
                      )} />
                      {isStandalone && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                          Standalone: results are stored independently and never affect report cards. Examples: Mock WAEC, Common Entrance, Quiz Competition.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Assessment Name *</Label>
                        <Input id="name" {...registerExam('name')} data-testid="input-exam-name" placeholder={isStandalone ? "e.g., Common Entrance Exam 2025" : "e.g., Mid-term Mathematics Test"} />
                        {examErrors.name && <p className="text-sm text-red-500 mt-1">{examErrors.name.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="date">Date *</Label>
                        <Input id="date" type="date" {...registerExam('date')} data-testid="input-exam-date" />
                        {examErrors.date && <p className="text-sm text-red-500 mt-1">{examErrors.date.message}</p>}
                      </div>
                    </div>

                    {/* Academic-only: Class and Subject */}
                    {!isStandalone && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Class *</Label>
                          <Controller name="classId" control={examControl} render={({ field }) => (
                            <Select onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) field.onChange(n); }}
                              value={field.value != null ? field.value.toString() : ''}>
                              <SelectTrigger data-testid="select-exam-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                              <SelectContent>
                                {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.classId && <p className="text-sm text-red-500 mt-1">{examErrors.classId.message}</p>}
                        </div>
                        <div>
                          <Label>Subject *</Label>
                          <Controller name="subjectId" control={examControl} render={({ field }) => (
                            <Select onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) field.onChange(n); }}
                              value={field.value != null ? field.value.toString() : ''} disabled={subjectsLoading || !selectedClassId}>
                              <SelectTrigger data-testid="select-exam-subject">
                                <SelectValue placeholder={subjectsLoading ? "Loading..." : !selectedClassId ? "Select class first" : subjects.length === 0 ? "No subjects" : "Select subject"} />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.subjectId && <p className="text-sm text-red-500 mt-1">{examErrors.subjectId.message}</p>}
                        </div>
                      </div>
                    )}

                    {/* Standalone-only: Purpose */}
                    {isStandalone && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Assessment Purpose</Label>
                          <Controller name="purpose" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger><SelectValue placeholder="Select purpose (optional)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="common_entrance">Common Entrance</SelectItem>
                                <SelectItem value="scholarship">Scholarship Exam</SelectItem>
                                <SelectItem value="mock_waec">Mock WAEC</SelectItem>
                                <SelectItem value="mock_jamb">Mock JAMB</SelectItem>
                                <SelectItem value="olympiad">Olympiad / Competition</SelectItem>
                                <SelectItem value="quiz">Quiz Competition</SelectItem>
                                <SelectItem value="practice_cbt">Practice CBT</SelectItem>
                                <SelectItem value="weekly_test">Weekly Test</SelectItem>
                                <SelectItem value="entrance_screening">Entrance Screening</SelectItem>
                                <SelectItem value="interview">Interview Assessment</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                        <div>
                          <Label>Candidate Type</Label>
                          <Controller name="candidateType" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger><SelectValue placeholder="Who can sit this?" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="internal">Internal (enrolled students)</SelectItem>
                                <SelectItem value="external">External candidates only</SelectItem>
                                <SelectItem value="both">Both internal &amp; external</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {!isStandalone && (
                        <div>
                          <Label>Exam Format *</Label>
                          <Controller name="examType" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger data-testid="select-exam-type"><SelectValue placeholder="Select format" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="test">Test (40% weight)</SelectItem>
                                <SelectItem value="exam">Exam (60% weight)</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.examType && <p className="text-sm text-red-500 mt-1">{examErrors.examType.message}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Test (40%) + Exam (60%) = Total (100%)</p>
                        </div>
                      )}
                      <div>
                        <Label>Teacher In-Charge</Label>
                        <Controller name="teacherInChargeId" control={examControl} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value?.toString()}>
                            <SelectTrigger data-testid="select-teacher-in-charge"><SelectValue placeholder="Select teacher (optional)" /></SelectTrigger>
                            <SelectContent>
                              {teachers && teachers.length > 0
                                ? teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)
                                : <SelectItem value="no-teachers" disabled>No teachers available</SelectItem>}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="instructions">Instructions</Label>
                      <Textarea id="instructions" {...registerExam('instructions')} data-testid="textarea-exam-instructions"
                        placeholder="Enter instructions shown to candidates before they start..." rows={3} />
                      <p className="text-xs text-muted-foreground mt-1">Shown to candidates before they start</p>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Academic & Timing / Standalone Configuration ── */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    {/* Academic-only: Term */}
                    {!isStandalone && (
                      <div>
                        <Label>Academic Term *</Label>
                        <Controller name="termId" control={examControl} render={({ field }) => (
                          <Select onValueChange={(v) => { const n = parseInt(v); if (!isNaN(n)) field.onChange(n); }}
                            value={field.value != null ? field.value.toString() : ''}>
                          <SelectTrigger data-testid="select-term"><SelectValue placeholder="Select term" /></SelectTrigger>
                          <SelectContent>
                            {terms && terms.length > 0
                              ? terms.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name} - {t.year}</SelectItem>)
                              : <SelectItem value="no-terms" disabled>No academic terms available</SelectItem>}
                          </SelectContent>
                        </Select>
                        )} />
                        {examErrors.termId && <p className="text-sm text-red-500 mt-1">{examErrors.termId.message}</p>}
                      </div>
                    )}

                    {/* Standalone-only: Venue, Target, Registration */}
                    {isStandalone && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Venue / Location</Label>
                            <Input {...registerExam('venue')} placeholder="e.g., School Hall, CBT Lab" />
                          </div>
                          <div>
                            <Label>Target Audience</Label>
                            <Controller name="targetType" control={examControl} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <SelectTrigger><SelectValue placeholder="Who is this for?" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="whole_school">Whole School</SelectItem>
                                  <SelectItem value="class">Specific Class</SelectItem>
                                  <SelectItem value="selected_students">Selected Students</SelectItem>
                                  <SelectItem value="external">External Candidates</SelectItem>
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-amber-600" />Registration
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Registration Fee (₦)</Label>
                              <Input type="number" min="0" {...registerExam('registrationFee', { valueAsNumber: true })} placeholder="0 = free" />
                              <p className="text-xs text-muted-foreground mt-1">Leave 0 or blank for free entry</p>
                            </div>
                            <div>
                              <Label>Registration Deadline</Label>
                              <Input type="date" {...registerExam('registrationDeadline')} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Controller name="registrationOpen" control={examControl} render={({ field }) => (
                              <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                            )} />
                            <div>
                              <Label>Open Registration Now</Label>
                              <p className="text-xs text-muted-foreground">Allow candidates to register for this assessment</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-muted/40">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Ticket className="w-4 h-4" />Candidate Features
                          </h4>
                          {[
                            { name: 'generateCandidateNumbers' as const, label: 'Generate Candidate Numbers', desc: 'Auto-assign unique exam numbers to each candidate' },
                            { name: 'generateAdmitCards' as const, label: 'Generate Admit Cards', desc: 'Produce printable admit cards for candidates' },
                            { name: 'certificateEnabled' as const, label: 'Generate Certificates', desc: 'Issue digital/printable certificates to candidates' },
                            { name: 'leaderboardEnabled' as const, label: 'Enable Leaderboard', desc: 'Show ranked results after the assessment ends' },
                          ].map(({ name, label, desc }) => (
                            <div key={name} className="flex items-center gap-3">
                              <Controller name={name} control={examControl} render={({ field }) => (
                                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                              )} />
                              <div>
                                <Label>{label}</Label>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 p-3 border rounded-lg bg-primary/5 dark:bg-primary/5">
                      <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Timer Mode</h4>
                      <Controller name="timerMode" control={examControl} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || 'individual'}>
                          <SelectTrigger data-testid="select-timer-mode"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">Individual Timer — each candidate starts their own</SelectItem>
                            <SelectItem value="global">Global Timer — all candidates start/end together</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                      {watchTimerMode === 'individual' && (
                        <p className="text-xs text-muted-foreground">Candidates can start at any time; each gets the full duration from when they click Start.</p>
                      )}
                      {watchTimerMode === 'global' && (
                        <p className="text-xs text-muted-foreground">All candidates must complete within the scheduled window. Auto-submits at end time.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="totalMarks">Total Marks *</Label>
                        <Input id="totalMarks" type="number" {...registerExam('totalMarks', { valueAsNumber: true })}
                          data-testid="input-exam-total-marks" placeholder="100" />
                        {examErrors.totalMarks && <p className="text-sm text-red-500 mt-1">{examErrors.totalMarks.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="timeLimit">{watchTimerMode === 'individual' ? 'Duration/Candidate' : 'Total Duration'} (min) *</Label>
                        <Input id="timeLimit" type="number" {...registerExam('timeLimit', { valueAsNumber: true })}
                          data-testid="input-exam-time-limit" placeholder="60" />
                        {examErrors.timeLimit && <p className="text-sm text-red-500 mt-1">{examErrors.timeLimit.message}</p>}
                      </div>
                    </div>

                    {watchTimerMode === 'global' && (
                      <div className="border rounded-lg p-3 bg-primary/5 dark:bg-primary/5 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Global Timer Window</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input id="startTime" type="datetime-local" {...registerExam('startTime')}
                              data-testid="input-exam-start-time" min={new Date().toISOString().slice(0, 16)} />
                            {examErrors.startTime && <p className="text-sm text-red-500 mt-1">{examErrors.startTime.message}</p>}
                          </div>
                          <div>
                            <Label htmlFor="endTime">End Time</Label>
                            <Input id="endTime" type="datetime-local" {...registerExam('endTime')}
                              data-testid="input-exam-end-time"
                              min={watchGlobalStartTime ? (typeof watchGlobalStartTime === 'string' ? watchGlobalStartTime : new Date(watchGlobalStartTime).toISOString().slice(0, 16)) : new Date().toISOString().slice(0, 16)} />
                            {examErrors.endTime && <p className="text-sm text-red-500 mt-1">{examErrors.endTime.message}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* ── Step 3: Options & Grading ── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-3 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Play className="w-4 h-4" />Publishing</h4>
                    <div className="flex items-center gap-3">
                      <Controller name="isPublished" control={examControl} render={({ field }) => (
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-exam-published" />
                      )} />
                      <div>
                        <Label>Publish Immediately</Label>
                        <p className="text-xs text-muted-foreground">{watchTimerMode === 'global' ? 'Will publish at scheduled start time' : 'Make visible to students now'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Controller name="shuffleQuestions" control={examControl} render={({ field }) => (
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-exam-shuffle" />
                      )} />
                      <div>
                        <Label>Shuffle Questions</Label>
                        <p className="text-xs text-muted-foreground">Randomize question order per student</p>
                      </div>
                    </div>
                    {!watchExam('isPublished') && (
                      <p className="text-xs text-muted-foreground bg-white dark:bg-gray-900 p-2 rounded border">
                        💾 Saved as draft — add questions and publish later.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <h4 className="font-medium text-sm">Auto-Grading</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { name: 'autoGradingEnabled' as keyof ExamForm, label: 'Enable Auto-Grading', testId: 'switch-auto-grading' },
                        { name: 'instantFeedback' as keyof ExamForm, label: 'Instant Feedback', testId: 'switch-instant-feedback' },
                        { name: 'showCorrectAnswers' as keyof ExamForm, label: 'Show Correct Answers After Submission', testId: 'switch-show-answers' },
                      ].map(({ name, label, testId }) => (
                        <div key={name} className="flex items-center gap-3">
                          <Controller name={name} control={examControl} render={({ field }) => (
                            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} data-testid={testId} />
                          )} />
                          <Label>{label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <Label htmlFor="passingScore">Passing Score (%)</Label>
                        <Input id="passingScore" type="number" min="0" max="100"
                          {...registerExam('passingScore', { valueAsNumber: true })}
                          data-testid="input-passing-score" placeholder="60" />
                        {examErrors.passingScore && <p className="text-sm text-red-500 mt-1">{examErrors.passingScore.message}</p>}
                      </div>
                      <div>
                        <Label>Grading Scale</Label>
                        <Controller name="gradingScale" control={examControl} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || 'active'} data-testid="select-grading-scale">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">
                                School Active Scale {activeGradingScaleName ? `(${activeGradingScaleName})` : ''}
                              </SelectItem>
                              {availableGradingScales.filter(s => s !== activeGradingScaleName).map(scaleName => (
                                <SelectItem key={scaleName} value={scaleName}>{scaleName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Review & Create ── */}
              {currentStep === 4 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    {isStandalone
                      ? <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"><Layers className="w-3 h-3 mr-1" />Standalone Assessment</Badge>
                      : <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300"><BookOpen className="w-3 h-3 mr-1" />Academic Assessment</Badge>
                    }
                  </div>
                  <p className="text-sm text-muted-foreground">Review your assessment before {editingExam ? 'updating' : 'creating'}.</p>
                  {[
                    { label: 'Name', value: watchExam('name') },
                    { label: 'Date', value: watchExam('date') },
                    ...(!isStandalone ? [
                      { label: 'Class', value: (allClasses as any[]).find((c: any) => c.id === watchExam('classId'))?.name || '—' },
                      { label: 'Subject', value: (allSubjects as any[]).find((s: any) => s.id === watchExam('subjectId'))?.name || '—' },
                      { label: 'Format', value: watchExam('examType') === 'exam' ? 'Exam (60% weight)' : 'Test (40% weight)' },
                      { label: 'Term', value: (() => { const t = (terms as any[]).find((t: any) => t.id === watchExam('termId')); return t ? `${t.name} - ${t.year}` : '—'; })() },
                    ] : [
                      { label: 'Purpose', value: watchExam('purpose' as any) || '—' },
                      { label: 'Venue', value: (watchExam as any)('venue') || '—' },
                      { label: 'Target', value: (watchExam as any)('targetType') || '—' },
                      { label: 'Registration Fee', value: (() => { const fee = (watchExam as any)('registrationFee'); return fee && fee > 0 ? `₦${Number(fee).toLocaleString()}` : 'Free'; })() },
                      { label: 'Candidate Numbers', value: (watchExam as any)('generateCandidateNumbers') ? 'Yes' : 'No' },
                      { label: 'Admit Cards', value: (watchExam as any)('generateAdmitCards') ? 'Yes' : 'No' },
                    ]),
                    { label: 'Total Marks', value: watchExam('totalMarks') },
                    { label: 'Duration', value: watchExam('timeLimit') ? `${watchExam('timeLimit')} min` : '—' },
                    { label: 'Timer Mode', value: watchExam('timerMode') === 'individual' ? 'Individual' : 'Global' },
                    { label: 'Status', value: watchExam('isPublished') ? 'Published' : 'Draft' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right">{String(value ?? '—')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : handleExamDialogClose(false)}>
                  {currentStep === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1" />Previous</>}
                </Button>
                {currentStep < 4 ? (
                  <Button type="button" onClick={handleNext}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="button"
                    onClick={() => handleExamSubmit(onSubmitExam, onInvalidExam)()}
                    disabled={editingExam ? updateExamMutation.isPending : createExamMutation.isPending}
                    data-testid="button-submit-exam">
                    {editingExam
                      ? (updateExamMutation.isPending ? 'Updating...' : 'Update Exam')
                      : (createExamMutation.isPending ? 'Creating...' : 'Create Exam')}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    />

    <MiniStatGrid cols={4}>
      <MiniStatCard
        label="Total Assessments"
        value={exams.length}
        icon={FileText}
        color="text-blue-600"
      />
      <MiniStatCard
        label="Published"
        value={exams.filter((e: any) => e.isPublished).length}
        icon={Check}
        color="text-green-600"
      />
      <MiniStatCard
        label="Drafts"
        value={exams.filter((e: any) => !e.isPublished).length}
        icon={Clock}
        color="text-amber-600"
      />
      <MiniStatCard
        label="Scheduled/Live"
        value={exams.filter((exam: any) => {
          if (exam.timerMode !== 'global' || !exam.startTime || !exam.endTime) return false;
          const now = new Date();
          const startTime = new Date(exam.startTime);
          const endTime = new Date(exam.endTime);
          return (now >= startTime && now <= endTime) || now < startTime;
        }).length}
        icon={Play}
        color="text-purple-600"
      />
    </MiniStatGrid>

    <div className="flex items-center space-x-2">
      <SearchInput
        placeholder="Search assessments..."
        value={searchTerm}
        onChange={setSearchTerm}
        className="max-w-sm"
        data-testid="input-search-exams"
      />
    </div>

      {/* Assessments Table/Cards */}
      <AssessmentList
        exams={filteredExams}
        isLoading={loadingExams}
        searchTerm={searchTerm}
        questionCounts={questionCounts}
        togglingExams={togglingExams}
        deletingExamIds={deletingExamIds}
        onManageQuestions={(exam) => setSelectedExam(exam)}
        onTogglePublish={(exam) => togglePublishMutation.mutate({ examId: exam.id, isPublished: !exam.isPublished })}
        onPreview={(exam) => setPreviewExam(exam)}
        onEditSettings={(exam) => handleEditExam(exam)}
        onRequestDelete={(exam) => setDeletingExam(exam)}
        onClearSearch={() => setSearchTerm('')}
        onCreateFirst={() => setIsExamDialogOpen(true)}
        getClassNameById={getClassNameById}
        getSubjectNameById={getSubjectNameById}
      />


      {/* Empty state guidance when no exam is selected */}
      {!selectedExam && (
        <EmptyState
          icon={BookOpen}
          title="Select an Exam to Manage Questions"
          description="To add questions or upload CSV files, please select an exam from the list above by clicking the Manage Questions button."
          className="mt-6 bg-card rounded-lg border border-border"
        />
      )}

      {/* Question Management Modal */}
      {selectedExam && (
        <Dialog open={!!selectedExam} onOpenChange={(open) => { if (!open) setSelectedExam(null); }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Questions - {selectedExam.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  {examQuestions.length} questions • {selectedExam.totalMarks} total marks
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* 3-Way Question Adder button */}
                  <Button
                    variant="default"
                    onClick={() => setIsQuestionAdderOpen(true)}
                    data-testid="button-add-questions"
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Questions
                  </Button>

                  {/* Edit Question Dialog (opened programmatically via edit pencil) */}
                  <Dialog
                    open={isQuestionDialogOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingQuestion(null);
                        resetQuestion({
                          questionType: 'multiple_choice',
                          points: 1,
                          questionText: '',
                          instructions: '',
                          sampleAnswer: '',
                          options: [
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                            { optionText: '', isCorrect: false },
                          ]
                        });
                      }
                      setIsQuestionDialogOpen(open);
                    }}
                  >
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleQuestionSubmit(onSubmitQuestion, onInvalidQuestion)} className="space-y-4">
                        <div>
                          <Label htmlFor="questionText">Question Text</Label>
                          <Textarea
                            id="questionText"
                            {...registerQuestion('questionText')}
                            data-testid="textarea-question-text"
                            placeholder="Enter your question here..."
                            rows={3}
                          />
                          {questionErrors.questionText && <p className="text-sm text-red-500">{questionErrors.questionText.message}</p>}
                        </div>

                        {questionType === 'essay' && (
                          <>
                            <div>
                              <Label htmlFor="instructions">Instructions (Optional)</Label>
                              <Textarea
                                id="instructions"
                                {...registerQuestion('instructions')}
                                data-testid="textarea-question-instructions"
                                placeholder="e.g., Write a detailed explanation (minimum 200 words), Show your working..."
                                rows={2}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Provide specific guidance for students on how to answer this question
                              </p>
                            </div>

                            <div>
                              <Label htmlFor="sampleAnswer">Sample Answer (Optional)</Label>
                              <Textarea
                                id="sampleAnswer"
                                {...registerQuestion('sampleAnswer')}
                                data-testid="textarea-question-sample"
                                placeholder="Provide a sample or model answer for grading reference..."
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                This will help with consistent grading and is not shown to students
                              </p>
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="questionType">Question Type</Label>
                            <Controller
                              name="questionType"
                              control={questionControl}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger data-testid="select-question-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                    <SelectItem value="essay">Essay</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <div>
                            <Label htmlFor="points">Points</Label>
                            <Input
                              id="points"
                              type="number"
                              {...registerQuestion('points', { valueAsNumber: true })}
                              data-testid="input-question-points"
                              min="1"
                            />
                          </div>
                        </div>

                        {questionType === 'multiple_choice' && (
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Label>Answer Options</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {options?.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name="correctOption"
                                    checked={option.isCorrect}
                                    onChange={() => {
                                      // Uncheck all other options
                                      const newOptions = options.map((opt, i) => ({
                                        ...opt,
                                        isCorrect: i === index
                                      }));
                                      setQuestionValue('options', newOptions);
                                    }}
                                    data-testid={`radio-option-${index}`}
                                  />
                                  <Input
                                    value={option.optionText}
                                    onChange={(e) => updateOption(index, 'optionText', e.target.value)}
                                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                    className="flex-1"
                                    data-testid={`input-option-${index}`}
                                  />
                                  {options.length > 2 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeOption(index)}
                                      data-testid={`button-remove-option-${index}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {questionErrors.options && (
                              <p className="text-sm text-red-500 mt-2">{questionErrors.options.message}</p>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                            data-testid="button-submit-question"
                          >
                            {editingQuestion
                              ? (updateQuestionMutation.isPending ? 'Saving...' : 'Save Changes')
                              : (createQuestionMutation.isPending ? 'Adding...' : 'Add Question')
                            }
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {loadingQuestions ? (
                  <div className="text-center py-8">Loading questions...</div>
                ) : examQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No questions added yet. Add your first question to get started.
                  </div>
                ) : (
                  examQuestions.map((question: any, index: number) => (
                    <Card key={question.id} data-testid={`card-question-${question.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline">Q{index + 1}</Badge>
                              <Badge variant={question.questionType === 'multiple_choice' ? 'secondary' : question.questionType === 'essay' ? 'default' : 'outline'}>
                                {question.questionType === 'multiple_choice' ? 'Multiple Choice' :
                                  question.questionType === 'essay' ? 'Essay' : 'Short Answer'}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{question.points} points</span>
                            </div>
                            <p className="mb-2 font-medium">{question.questionText}</p>

                            {question.instructions && (
                              <div className="mb-2 p-2 bg-primary/5 rounded text-sm">
                                <span className="font-medium text-primary">Instructions: </span>
                                <span className="text-primary">{question.instructions}</span>
                              </div>
                            )}

                            {question.questionType === 'multiple_choice' && (
                              <div className="ml-4 space-y-1">
                                <QuestionOptions questionId={question.id} />
                              </div>
                            )}

                            {question.questionType === 'essay' && (
                              <div className="ml-4 text-sm text-muted-foreground">
                                <div className="flex items-center space-x-4">
                                  <span>📝 Essay question</span>
                                  {question.sampleAnswer && (
                                    <span className="text-green-600">✓ Sample answer provided</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                data-testid={`button-actions-question-${question.id}`}
                                aria-label={`Actions for question ${index + 1}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditQuestion(question)}
                                disabled={updateQuestionMutation.isPending}
                                data-testid={`button-edit-question-${question.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setQuestionToDelete(question.id)}
                                disabled={deleteQuestionMutation.isPending}
                                data-testid={`button-delete-question-${question.id}`}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Controlled delete-question confirmation — lives outside the question map so
          the AlertDialog is never nested inside a DropdownMenu, which prevents portal
          conflicts and ensures clean focus management. */}
      <AlertDialog
        open={questionToDelete !== null}
        onOpenChange={(open) => { if (!open) setQuestionToDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone and will permanently remove the question and all associated answer options.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (questionToDelete !== null) handleConfirmDeleteQuestion(questionToDelete); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Exam Dialog */}
      {previewExam && (
        <Dialog open={!!previewExam} onOpenChange={(open) => { if (!open) setPreviewExam(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewExam.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">Student view of the exam</p>
            </DialogHeader>

            <div className="space-y-6">
              {/* Exam Info */}
              <Card className="bg-primary/5 dark:bg-primary/5">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Class:</span> {previewExam.classId ? getClassNameById(previewExam.classId) : '—'}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> {previewExam.subjectId ? getSubjectNameById(previewExam.subjectId) : '—'}
                    </div>
                    <div>
                      <span className="font-medium">Total Marks:</span> {previewExam.totalMarks}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {previewExam.timeLimit} minutes
                    </div>
                  </div>
                  {previewExam.instructions && (
                    <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded">
                      <p className="text-sm font-medium mb-1">Instructions:</p>
                      <p className="text-sm">{previewExam.instructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Questions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Questions ({previewQuestions.length})</h3>
                {loadingPreviewQuestions ? (
                  <div className="text-center py-8">Loading questions...</div>
                ) : previewQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No questions added to this exam yet.
                  </div>
                ) : (
                  previewQuestions.map((question: any, index: number) => (
                    <Card key={question.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-4">
                          <Badge variant="outline">Q{index + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-medium mb-2">{question.questionText}</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              {question.points} {question.points === 1 ? 'point' : 'points'}
                            </p>
                            {question.questionType === 'multiple_choice' && (
                              <div className="space-y-2">
                                <QuestionOptions questionId={question.id} />
                              </div>
                            )}
                            {question.questionType === 'essay' && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm text-muted-foreground">
                                Essay answer box would appear here
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setPreviewExam(null)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 3-Way Question Adder Dialog */}
      {selectedExam && (
        <ExamQuestionAdder
          open={isQuestionAdderOpen}
          onOpenChange={setIsQuestionAdderOpen}
          examId={selectedExam.id}
          examClassId={selectedExam.classId ?? undefined}
          examSubjectId={selectedExam.subjectId ?? undefined}
          onQuestionsAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', selectedExam.id] });
            queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
          }}
        />
      )}

      {/* Delete Exam Confirmation Modal — shared by both the mobile card and
          desktop table actions menu (see AssessmentActionsMenu). The mutation
          only fires on confirm, and the item only leaves the list once the
          backend responds with success (see deleteExamMutation above). */}
      <DeleteAssessmentDialog
        exam={deletingExam}
        isDeleting={deletingExam ? deletingExamIds.has(deletingExam.id) : false}
        onCancel={() => setDeletingExam(null)}
        onConfirm={(exam) => {
          setDeletingExam(null);
          if (!deletingExamIds.has(exam.id)) {
            deleteExamMutation.mutate(exam.id);
          }
        }}
      />
    </div>
  );
}