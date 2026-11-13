import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { examFormSchema, questionFormSchema, type ExamForm, type QuestionForm } from './schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearch } from 'wouter';
import { useAuth } from '@/lib/auth';
import type { Exam, ExamQuestion } from '@shared/schema.pg';

/** All UI state + react-hook-form instances for exam/question management. */
export function useExamState() {
    const { user } = useAuth();
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isQuestionAdderOpen, setIsQuestionAdderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [termFilter, setTermFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
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

  const { register: registerQuestion, handleSubmit: handleQuestionSubmit, formState: { errors: questionErrors }, control: questionControl, setValue: setQuestionValue, reset: resetQuestion, watch: watchQuestion, trigger: triggerQuestion } = useForm<QuestionForm>({
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

  return { user, isExamDialogOpen, setIsExamDialogOpen, isQuestionDialogOpen, setIsQuestionDialogOpen, isQuestionAdderOpen, setIsQuestionAdderOpen, searchTerm, setSearchTerm, classFilter, setClassFilter, termFilter, setTermFilter, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, sortBy, setSortBy, selectedExam, setSelectedExam, editingExam, setEditingExam, editingQuestion, setEditingQuestion, editingImageUrl, setEditingImageUrl, previewExam, setPreviewExam, deletingExam, setDeletingExam, deletingExamIds, setDeletingExamIds, questionToDelete, setQuestionToDelete, currentStep, setCurrentStep, togglingExams, pendingDeletionsRef, pendingQuestionDeletionsRef, togglingExamsRef, setExamToggling, watchDuration, watchGlobalStartTime, watchAssessmentCategory, isStandalone, watchTimerMode, questionType, options, registerExam, handleExamSubmit, examErrors, examControl, setExamValue, resetExam, watchExam, triggerExam, registerQuestion, handleQuestionSubmit, questionErrors, questionControl, setQuestionValue, resetQuestion, watchQuestion, triggerQuestion };
}
