import { useState, useRef, useEffect } from 'react';
import { useSearch } from 'wouter';
import ExamQuestionAdder from './ExamQuestionAdder';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { optimisticToggle, optimisticDelete, optimisticCreate, optimisticUpdateItem, rollbackOnError } from '@/lib/optimisticUpdates';
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
import { Plus, Edit, Search, BookOpen, Trash2, Clock, Users, FileText, Eye, Play, Upload, Save, Shield, MoreVertical, ChevronDown, ChevronUp, Settings, ChevronLeft, ChevronRight, Check, Calendar } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

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
            <span className="text-xs bg-green-100 text-green-800 px-1 rounded">✓ Correct</span>
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

  // Track which specific exam is currently being toggled (for button loading state)
  const [togglingExamId, setTogglingExamId] = useState<number | null>(null);
  // Keep a ref in sync for use in real-time event handlers (avoids stale closure)
  const togglingExamIdRef = useRef<number | null>(null);
  useEffect(() => {
    togglingExamIdRef.current = togglingExamId;
  }, [togglingExamId]);

  const { register: registerExam, handleSubmit: handleExamSubmit, formState: { errors: examErrors }, control: examControl, setValue: setExamValue, reset: resetExam, watch: watchExam, trigger: triggerExam } = useForm<ExamForm>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      examType: 'exam',
      timerMode: 'individual',
      timeLimit: 60,
      isPublished: false,
      shuffleQuestions: false,
      autoGradingEnabled: true,
      instantFeedback: false,
      showCorrectAnswers: true,
      passingScore: 60,
      gradingScale: 'active',
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

  // Fetch exams with pending deletion filter
  const { data: rawExams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['/api/exams'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exams');
      return await response.json();
    },
  });

  // Filter out exams that are pending deletion to prevent race conditions
  const exams = rawExams.filter((exam: Exam) => !pendingDeletionsRef.current.has(exam.id));

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
          if (togglingExamIdRef.current === updatedExam.id) {
            setTogglingExamId(null);
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
          if (togglingExamIdRef.current === updatedExam.id) {
            setTogglingExamId(null);
          }
        }
      }
    }
  });

  // Enable real-time updates for exam questions when viewing/editing an exam
  // Note: queryKey must match exactly with the useQuery queryKey for cache invalidation to work
  useSocketIORealtime({
    table: 'exam_questions',
    queryKey: ['/api/exam-questions', selectedExam?.id],
    examId: selectedExam?.id,
    enabled: !!selectedExam?.id,
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

  // Fetch class-subject mappings for the selected class (used for admins to filter subjects - CURRENTLY DISABLED per new requirement)
  // We still fetch it for other potential uses, but we don't block admin subject selection on it.
  const { data: classSubjectMappings = [], isLoading: mappingsLoading } = useQuery<Array<{
    id: number;
    classId: number;
    subjectId: number;
    department: string | null;
    isCompulsory: boolean;
    subjectName: string;
    subjectCode: string;
    category: string;
  }>>({
    queryKey: ['/api/class-subject-mappings', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const response = await apiRequest('GET', `/api/class-subject-mappings/${selectedClassId}`);
      return await response.json();
    },
    // Only fetch mappings if not admin, or if we specifically need them for admins later.
    // Right now, admins can select ANY subject, so we don't strictly need it for the dropdown.
    enabled: !!selectedClassId && !myAssignments?.isAdmin,
    staleTime: 30000,
  });

  // Filter subjects based on selected class
  const availableSubjects = (() => {
    if (!myAssignments || !selectedClassId) return [];

    // For admins, allow them to create an exam for ANY subject in the system
    if (myAssignments.isAdmin) {
      return allSubjects;
    }

    // For teachers, only show subjects they are assigned to for the selected class
    return myAssignments.subjects.filter((s: any) =>
      myAssignments.assignments.some(a => a.classId === selectedClassId && a.subjectId === s.id && a.isActive)
    );
  })();

  const subjectsLoading = myAssignments?.isAdmin ? (assignmentsLoading || !allSubjects.length) : (assignmentsLoading || mappingsLoading);

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

  // Fetch question counts for all exams
  const { data: questionCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/exams/question-counts', exams.map((exam: Exam) => exam.id)],
    enabled: exams.length > 0,
    queryFn: async () => {
      const examIds = exams.map((exam: Exam) => exam.id);
      if (examIds.length === 0) return {};

      const queryString = examIds.map((id: number) => `examIds=${id}`).join('&');
      const response = await apiRequest('GET', `/api/exams/question-counts?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch question counts');
      return response.json();
    },
  });

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
      // Track which exam is being toggled for button loading state
      setTogglingExamId(examId);

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
      // Update cache with confirmed backend data
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

      // Clear the toggling state
      setTogglingExamId(null);
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

      // Clear the toggling state on error
      setTogglingExamId(null);
    },
  });

  // Delete exam mutation with optimistic update - instant deletion
  // Uses smart deletion system that cascade deletes all related data
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      const response = await apiRequest('DELETE', `/api/exams/${examId}`);
      if (!response.ok) throw new Error('Failed to delete exam');
      // Handle both 204 (legacy) and 200 with deletion stats
      if (response.status === 204) return null;
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        return response.json();
      }
      return null;
    },
    onMutate: async (examId) => {
      // Mark this deletion as pending to prevent Realtime from overriding
      pendingDeletionsRef.current.add(examId);

      const queryKey = ['/api/exams'];
      const context = await optimisticDelete<Exam[]>({ queryKey, idToDelete: examId });

      if (selectedExam?.id === examId) {
        setSelectedExam(null);
        setEditingExam(null);
        setEditingQuestion(null);
      }

      return context;
    },
    onSuccess: (data, examId) => {
      // Clear pending flag immediately
      pendingDeletionsRef.current.delete(examId);

      // Build detailed success message with deletion stats
      let description = "Exam deleted successfully";
      if (data?.deletedCounts) {
        const { questions, studentAnswers, results, sessions } = data.deletedCounts;
        const parts = [];
        if (questions > 0) parts.push(`${questions} questions`);
        if (studentAnswers > 0) parts.push(`${studentAnswers} student answers`);
        if (results > 0) parts.push(`${results} results`);
        if (sessions > 0) parts.push(`${sessions} sessions`);
        if (parts.length > 0) {
          description = `Exam and ${parts.join(', ')} permanently deleted`;
        }
      }

      toast({
        title: "Success",
        description,
      });

      // Invalidate related caches since exam and its data were deleted
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
    },
    onError: (error: any, examId, context) => {
      // Remove from pending deletions on error
      pendingDeletionsRef.current.delete(examId);

      if (context?.previousData) {
        rollbackOnError(['/api/exams'], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete exam",
        variant: "destructive",
      });
    },
  });

  // Delete question mutation with optimistic update - instant deletion
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest('DELETE', `/api/exam-questions/${questionId}`);
      if (!response.ok) throw new Error('Failed to delete question');
      if (response.status === 204) return;
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        return response.json();
      }
      return;
    },
    onMutate: async (questionId) => {
      // Capture the current exam ID before any state changes
      const currentExamId = selectedExam?.id;
      const queryKey = ['/api/exam-questions', currentExamId];
      const context = await optimisticDelete<ExamQuestion[]>({ queryKey, idToDelete: questionId });

      // Mark question as pending deletion to prevent race conditions with Realtime
      pendingQuestionDeletionsRef.current.add(questionId);

      // Return context with captured examId for use in onSuccess/onError
      return { ...context, examId: currentExamId };
    },
    onSuccess: (_, questionId, context) => {
      // Clear pending flag immediately
      pendingQuestionDeletionsRef.current.delete(questionId);

      toast({
        title: "Success",
        description: "Question deleted successfully",
      });

      // Invalidate question counts and options caches
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/question-options', questionId] });
    },
    onError: (error: any, questionId, context) => {
      // Remove from pending deletions on error
      pendingQuestionDeletionsRef.current.delete(questionId);

      // Use examId from context to ensure we target the correct cache
      const examId = context?.examId;

      if (context?.previousData && examId) {
        rollbackOnError(['/api/exam-questions', examId], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete question",
        variant: "destructive",
      });
    },
  });

  // Create question mutation with no retries to prevent circuit breaker amplification
  const createQuestionMutation = useMutation({
    retry: false, // Disable retries for question creation to prevent circuit breaker amplification
    mutationFn: async (questionData: QuestionForm & { examId: number }) => {
      const response = await apiRequest('POST', '/api/exam-questions', questionData);

      // apiRequest already handles error classification for non-OK responses
      const result = await response.json();
      return result;
    },
    onSuccess: (createdQuestion) => {
      toast({
        title: "Success",
        description: "Question added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', selectedExam?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts', exams.map((exam: Exam) => exam.id)] });
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
    onError: (error: any) => {

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
      name: exam.name || '',
      date: formatDate(exam.date),
      classId: exam.classId,
      subjectId: exam.subjectId,
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
    { id: 1, title: 'Exam Details', icon: FileText },
    { id: 2, title: 'Academic & Timing', icon: Calendar },
    { id: 3, title: 'Options & Grading', icon: Settings },
    { id: 4, title: 'Review & Create', icon: Check },
  ];

  const handleNext = async () => {
    let fieldsToValidate: (keyof ExamForm)[] = [];
    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 1) fieldsToValidate = ['name', 'date', 'classId', 'subjectId', 'examType'];
    if (currentStep === 2) fieldsToValidate = ['termId', 'totalMarks', 'timeLimit'];
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


      return { previousQuestions, queryKey };
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
      // Invalidate question counts
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
"Define Partnership Deed and explain its importance.",essay,"","","","","",10,"Provide definition and explain why it's important in partnerships","A Partnership Deed is a legal document that outlines the terms and conditions of a partnership business..."
"What is Depreciation? Distinguish between Straight Line and Reducing Balance methods.",text,"","","","","",8,"Define depreciation and compare the two methods with examples","Depreciation is the systematic allocation of an asset's cost over its useful life. Straight line method allocates equal amounts annually while reducing balance applies a fixed percentage to the reducing book value"
"Calculate compound interest: Principal ₦50,000, Rate 10% per annum, Time 3 years.",text,"","","","","",5,"Show your working step by step","Using A = P(1 + r)^n: A = 50,000(1 + 0.1)^3 = 50,000 × 1.331 = ₦66,550. Compound Interest = ₦66,550 - ₦50,000 = ₦16,550"`;

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
      description: "CSV template with support for multiple choice, text, and essay questions has been downloaded.",
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
        if (!['multiple_choice', 'text', 'essay'].includes(questionType)) {
          errors.push(`Row ${i + 1}: Invalid question type "${questionType}". Must be: multiple_choice, text, or essay`);
          continue;
        }
        const points = parseInt(pointsText) || 1;
        if (points < 1 || points > 100) {
          errors.push(`Row ${i + 1}: Points must be between 1 and 100 (found: ${pointsText})`);
          continue;
        }
        // Enhanced validation for theory questions
        if (questionType === 'essay') {
          if (questionText.length < 20) {
            errors.push(`Row ${i + 1}: Essay questions should have detailed question text (at least 20 characters)`);
            continue;
          }
          if (points < 5) {
          }
        }

        if (questionType === 'text') {
          if (points > 10) {
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

  const filteredExams = exams.filter((exam: Exam) =>
    exam.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Exam Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create and manage exams for your classes</p>
        </div>
        <Dialog open={isExamDialogOpen} onOpenChange={handleExamDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exam" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create New Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
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

              {/* ── Step 1: Exam Details ── */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Exam Name *</Label>
                      <Input id="name" {...registerExam('name')} data-testid="input-exam-name" placeholder="e.g., Mid-term Mathematics Test" />
                      {examErrors.name && <p className="text-sm text-red-500 mt-1">{examErrors.name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="date">Exam Date *</Label>
                      <Input id="date" type="date" {...registerExam('date')} data-testid="input-exam-date" />
                      {examErrors.date && <p className="text-sm text-red-500 mt-1">{examErrors.date.message}</p>}
                    </div>
                  </div>

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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Assessment Type *</Label>
                      <Controller name="examType" control={examControl} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-exam-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Test (40% weight)</SelectItem>
                            <SelectItem value="exam">Exam (60% weight)</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                      {examErrors.examType && <p className="text-sm text-red-500 mt-1">{examErrors.examType.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Test (40%) + Exam (60%) = Total (100%)</p>
                    </div>
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
                      placeholder="Enter exam instructions for students..." rows={3} />
                    <p className="text-xs text-muted-foreground mt-1">Shown to students before they start</p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Academic & Timing ── */}
              {currentStep === 2 && (
                <div className="space-y-4">
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

                  <div className="space-y-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Timer Mode</h4>
                    <Controller name="timerMode" control={examControl} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || 'individual'}>
                        <SelectTrigger data-testid="select-timer-mode"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual Timer — each student starts their own</SelectItem>
                          <SelectItem value="global">Global Timer — all students start/end together</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                    {watchTimerMode === 'individual' && (
                      <p className="text-xs text-muted-foreground">Students can start at any time; each gets the full duration from when they click Start.</p>
                    )}
                    {watchTimerMode === 'global' && (
                      <p className="text-xs text-muted-foreground">All students must complete within the scheduled window. Exam auto-submits at end time.</p>
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
                      <Label htmlFor="timeLimit">{watchTimerMode === 'individual' ? 'Duration/Student' : 'Total Duration'} (min) *</Label>
                      <Input id="timeLimit" type="number" {...registerExam('timeLimit', { valueAsNumber: true })}
                        data-testid="input-exam-time-limit" placeholder="60" />
                      {examErrors.timeLimit && <p className="text-sm text-red-500 mt-1">{examErrors.timeLimit.message}</p>}
                    </div>
                  </div>

                  {watchTimerMode === 'global' && (
                    <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20 space-y-3">
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
                  <p className="text-sm text-muted-foreground">Review your exam before {editingExam ? 'updating' : 'creating'}.</p>
                  {[
                    { label: 'Exam Name', value: watchExam('name') },
                    { label: 'Date', value: watchExam('date') },
                    { label: 'Class', value: classes.find((c: any) => c.id === watchExam('classId'))?.name || '—' },
                    { label: 'Subject', value: subjects.find((s: any) => s.id === watchExam('subjectId'))?.name || '—' },
                    { label: 'Type', value: watchExam('examType') === 'exam' ? 'Exam (60%)' : 'Test (40%)' },
                    { label: 'Term', value: (() => { const t = (terms as any[]).find((t: any) => t.id === watchExam('termId')); return t ? `${t.name} - ${t.year}` : '—'; })() },
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
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search exams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-exams"
        />
      </div>

      {/* Exams Table/Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {loadingExams ? (
            <div className="text-center py-8">Loading exams...</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {filteredExams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="border border-border rounded-lg p-3 bg-muted/30"
                    data-testid={`card-exam-${exam.id}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{exam.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getClassNameById(exam.classId)} • {getSubjectNameById(exam.subjectId)}
                          </p>
                        </div>
                        <Badge variant={exam.isPublished ? 'default' : 'secondary'} className="ml-2 flex-shrink-0">
                          {exam.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-3">
                          <span>{new Date(exam.date).toLocaleDateString()}</span>
                          {exam.timeLimit && (
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {exam.timeLimit}m
                            </div>
                          )}
                        </div>
                        <div className="flex items-center">
                          <FileText className="w-3 h-3 mr-1" />
                          {questionCounts[exam.id] || 0}
                        </div>
                      </div>

                      {(() => {
                        const now = new Date();
                        const startTime = exam.startTime ? new Date(exam.startTime) : null;
                        const endTime = exam.endTime ? new Date(exam.endTime) : null;

                        if (exam.timerMode === 'global' && startTime && endTime) {
                          if (now < startTime) {
                            return (
                              <Badge variant="outline" className="bg-yellow-50 w-fit">
                                <Clock className="w-3 h-3 mr-1" />
                                Scheduled
                              </Badge>
                            );
                          } else if (now >= startTime && now <= endTime) {
                            return (
                              <Badge variant="default" className="bg-green-600 w-fit">
                                <Play className="w-3 h-3 mr-1" />
                                Live Now
                              </Badge>
                            );
                          } else {
                            return (
                              <Badge variant="secondary" className="w-fit">
                                Ended
                              </Badge>
                            );
                          }
                        }
                        return null;
                      })()}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedExam(exam)}
                          data-testid={`button-manage-questions-${exam.id}`}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Questions
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              data-testid={`button-exam-actions-${exam.id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => togglePublishMutation.mutate({
                                examId: exam.id,
                                isPublished: !exam.isPublished
                              })}
                              disabled={togglingExamId === exam.id}
                              data-testid={`dropdown-toggle-publish-${exam.id}`}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {togglingExamId === exam.id
                                ? (exam.isPublished ? 'Unpublishing...' : 'Publishing...')
                                : (exam.isPublished ? 'Unpublish' : 'Publish')
                              }
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setPreviewExam(exam)}
                              data-testid={`dropdown-preview-exam-${exam.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditExam(exam)}
                              data-testid={`dropdown-edit-exam-${exam.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Exam
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`dropdown-delete-exam-${exam.id}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Exam
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Exam</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the exam "{exam.name}"? This action cannot be undone and will permanently remove all exam questions and student results.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteExamMutation.mutate(exam.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete Exam
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredExams.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No exams found. Create your first exam to get started.
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExams.map((exam: any) => (
                      <TableRow key={exam.id} data-testid={`row-exam-${exam.id}`}>
                        <TableCell className="font-medium">{exam.name}</TableCell>
                        <TableCell>{getClassNameById(exam.classId)}</TableCell>
                        <TableCell>{getSubjectNameById(exam.subjectId)}</TableCell>
                        <TableCell>{new Date(exam.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {exam.timeLimit ? (
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {exam.timeLimit}m
                            </div>
                          ) : 'No limit'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={exam.isPublished ? 'default' : 'secondary'}>
                            {exam.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const now = new Date();
                            const startTime = exam.startTime ? new Date(exam.startTime) : null;
                            const endTime = exam.endTime ? new Date(exam.endTime) : null;

                            if (exam.timerMode === 'global' && startTime && endTime) {
                              if (now < startTime) {
                                return (
                                  <Badge variant="outline" className="bg-yellow-50">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Scheduled
                                  </Badge>
                                );
                              } else if (now >= startTime && now <= endTime) {
                                return (
                                  <Badge variant="default" className="bg-green-600">
                                    <Play className="w-3 h-3 mr-1" />
                                    Live Now
                                  </Badge>
                                );
                              } else {
                                return (
                                  <Badge variant="secondary">
                                    Ended
                                  </Badge>
                                );
                              }
                            }
                            return (
                              <span className="text-sm text-muted-foreground">
                                Individual Timer
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            {questionCounts[exam.id] || 0} question{(questionCounts[exam.id] || 0) !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-exam-actions-${exam.id}`}>
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => setSelectedExam(exam)}
                                className="cursor-pointer"
                                data-testid={`menu-manage-questions-${exam.id}`}
                              >
                                <Edit className="w-4 h-4 mr-2 text-blue-500" />
                                Manage Questions
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={() => togglePublishMutation.mutate({
                                  examId: exam.id,
                                  isPublished: !exam.isPublished
                                })}
                                disabled={togglingExamId === exam.id}
                                className="cursor-pointer"
                                data-testid={`menu-toggle-publish-${exam.id}`}
                              >
                                <Play className={`w-4 h-4 mr-2 ${exam.isPublished ? "text-amber-500" : "text-green-500"}`} />
                                {togglingExamId === exam.id
                                  ? (exam.isPublished ? 'Unpublishing...' : 'Publishing...')
                                  : (exam.isPublished ? 'Unpublish' : 'Publish')
                                }
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => setPreviewExam(exam)}
                                className="cursor-pointer"
                                data-testid={`menu-preview-exam-${exam.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2 text-purple-500" />
                                Preview Exam
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => handleEditExam(exam)}
                                className="cursor-pointer"
                                data-testid={`menu-edit-exam-${exam.id}`}
                              >
                                <Settings className="w-4 h-4 mr-2 text-gray-500" />
                                Exam Settings
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive cursor-pointer"
                                data-testid={`menu-delete-exam-${exam.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setDeletingExam(exam);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Exam
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredExams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No exams found. Create your first exam to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Empty state guidance when no exam is selected */}
      {!selectedExam && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Select an Exam to Manage Questions</h3>
              <p className="text-sm">
                To add questions or upload CSV files, please select an exam from the list above by clicking the "Manage Questions" button.
              </p>
            </div>
          </CardContent>
        </Card>
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

                        {(questionType === 'text' || questionType === 'essay') && (
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
                                    <SelectItem value="text">Short Answer</SelectItem>
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
                              <div className="mb-2 p-2 bg-blue-50 rounded text-sm">
                                <span className="font-medium text-blue-800">Instructions: </span>
                                <span className="text-blue-700">{question.instructions}</span>
                              </div>
                            )}

                            {question.questionType === 'multiple_choice' && (
                              <div className="ml-4 space-y-1">
                                <QuestionOptions questionId={question.id} />
                              </div>
                            )}

                            {(question.questionType === 'text' || question.questionType === 'essay') && (
                              <div className="ml-4 text-sm text-muted-foreground">
                                <div className="flex items-center space-x-4">
                                  <span>
                                    {question.questionType === 'essay' ? '📝 Essay question' : '📝 Short answer question'}
                                  </span>
                                  {question.sampleAnswer && (
                                    <span className="text-green-600">✓ Sample answer provided</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditQuestion(question)}
                              disabled={updateQuestionMutation.isPending}
                              data-testid={`button-edit-question-${question.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={deleteQuestionMutation.isPending}
                                  data-testid={`button-delete-question-${question.id}`}
                                  aria-label={`Delete question ${index + 1}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this question? This action cannot be undone and will permanently remove the question and all associated answer options.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deleteQuestionMutation.isPending}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteQuestionMutation.mutate(question.id)}
                                    disabled={deleteQuestionMutation.isPending}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {deleteQuestionMutation.isPending ? 'Deleting...' : 'Delete Question'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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
              <Card className="bg-blue-50 dark:bg-blue-950/20">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Class:</span> {getClassNameById(previewExam.classId)}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> {getSubjectNameById(previewExam.subjectId)}
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
                            {question.questionType === 'text' && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm text-muted-foreground">
                                Short answer text box would appear here
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
          examClassId={selectedExam.classId}
          examSubjectId={selectedExam.subjectId}
          onQuestionsAdded={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', selectedExam.id] });
            queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
          }}
        />
      )}

      {/* Delete Exam Confirmation Modal */}
      <AlertDialog 
        open={!!deletingExam} 
        onOpenChange={(open) => {
          if (!open) setDeletingExam(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the exam "{deletingExam?.name}"? This action cannot be undone and will permanently remove all exam questions and student results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const examId = deletingExam?.id;
                setDeletingExam(null);
                if (examId) deleteExamMutation.mutate(examId);
              }}
            >
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}