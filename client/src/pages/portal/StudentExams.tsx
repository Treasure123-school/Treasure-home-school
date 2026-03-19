import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Clock, BookOpen, Trophy, Play, Eye, CheckCircle, XCircle, Timer, Save, RotateCcw, AlertCircle, Loader, FileText, Circle, CheckCircle2, HelpCircle, ClipboardCheck, GraduationCap, Award, Calendar, Calculator, X, Lock, CreditCard } from 'lucide-react';
import type { Exam as BaseExam, ExamSession, ExamQuestion, QuestionOption, StudentAnswer } from '@shared/schema';

// Extend Exam with payment fields injected by the server at runtime
type Exam = BaseExam & {
  paymentRequired?: boolean;
  hasPaid?: boolean;
  feeAmount?: number;
};
import schoolLogo from '@assets/1000025432-removebg-preview (1)_1757796555126.png';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { ExamHeader } from '@/components/ExamHeader';
import RequireCompleteProfile from '@/components/RequireCompleteProfile';

// ENHANCED EXAM SECURITY CONSTANTS
// Students receive 3 numbered warnings (Warning 1/3, 2/3, 3/3).
// On the 3rd violation the warning is shown AND the exam is auto-submitted immediately.
const MAX_WARNINGS_ALLOWED = 3; // Total warnings shown (1 of 3, 2 of 3, 3 of 3)
const MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT = 3; // Auto-submit triggers ON the 3rd violation
const PENALTY_PER_VIOLATION = 5;
const MAX_PENALTY = 20;
const VIOLATION_DETECTION_DELAY = 500; // ms delay to avoid false positives
const DEVTOOLS_CHECK_INTERVAL = 1000; // Check for DevTools every second

// Violation types for comprehensive tracking
type ViolationType = 
  | 'tab_switch'      // Tab switching/visibility change
  | 'browser_minimize' // Browser window minimized/backgrounded
  | 'devtools'        // DevTools/Inspect Element opened
  | 'refresh_attempt' // Refresh or back button detected
  | 'page_reload'     // Actual page reload detected via sessionStorage
  | 'duplicate_session' // Same exam accessed from another device
  | 'screenshot'      // Screenshot/screen recording attempt (if detectable)
  | 'copy_paste';     // Copy/paste attempt

interface ViolationRecord {
  type: ViolationType;
  timestamp: Date;
  details?: string;
}

// Question save status type
type QuestionSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

// ─── LocalStorage helpers for offline answer backup ───────────────────────────
const LS_PREFIX = 'ths_exam_answers_';

// ─── LocalStorage helpers for violation count backup ──────────────────────────
// This is written synchronously on every violation AND in beforeunload so that
// even if the server PATCH is in-flight or fails, the count survives a tab close.
const LS_VIOLATIONS_PREFIX = 'ths_exam_violations_';

function lsViolationKey(sessionId: number) { return `${LS_VIOLATIONS_PREFIX}${sessionId}`; }

function lsViolationSave(sessionId: number, count: number, penalty: number, history: ViolationRecord[]) {
  try {
    localStorage.setItem(lsViolationKey(sessionId), JSON.stringify({
      violationCount: count,
      violationPenalty: penalty,
      violationHistory: history.slice(-10),
      ts: Date.now(),
    }));
  } catch (_) {}
}

function lsViolationGet(sessionId: number): { violationCount: number; violationPenalty: number; violationHistory: ViolationRecord[] } | null {
  try {
    const raw = localStorage.getItem(lsViolationKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.violationCount === 'number') return parsed;
    return null;
  } catch (_) { return null; }
}

function lsViolationClear(sessionId: number) {
  try { localStorage.removeItem(lsViolationKey(sessionId)); } catch (_) {}
}

function lsKey(sessionId: number) { return `${LS_PREFIX}${sessionId}`; }

function lsSave(sessionId: number, questionId: number, answer: any, questionType: string) {
  try {
    const raw = localStorage.getItem(lsKey(sessionId));
    const store = raw ? JSON.parse(raw) : {};
    store[questionId] = { answer, questionType, synced: false, ts: Date.now() };
    localStorage.setItem(lsKey(sessionId), JSON.stringify(store));
  } catch (_) {}
}

function lsMarkSynced(sessionId: number, questionId: number) {
  try {
    const raw = localStorage.getItem(lsKey(sessionId));
    if (!raw) return;
    const store = JSON.parse(raw);
    if (store[questionId]) { store[questionId].synced = true; localStorage.setItem(lsKey(sessionId), JSON.stringify(store)); }
  } catch (_) {}
}

function lsGetAll(sessionId: number): Record<string, { answer: any; questionType: string; synced: boolean; ts: number }> {
  try { return JSON.parse(localStorage.getItem(lsKey(sessionId)) || '{}'); } catch (_) { return {}; }
}

function lsClear(sessionId: number) {
  try { localStorage.removeItem(lsKey(sessionId)); } catch (_) {}
}
// ──────────────────────────────────────────────────────────────────────────────

export default function StudentExams() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResults, setExamResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Per-question save status tracking
  const [questionSaveStatus, setQuestionSaveStatus] = useState<Record<number, QuestionSaveStatus>>({});
  const [pendingSaves, setPendingSaves] = useState<Set<number>>(new Set());
  const saveTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcExpression, setCalcExpression] = useState('');
  const [calcPrevValue, setCalcPrevValue] = useState<number | null>(null);
  const [calcOperator, setCalcOperator] = useState<string | null>(null);
  const [calcWaitingForSecond, setCalcWaitingForSecond] = useState(false);
  const [calcLastOperator, setCalcLastOperator] = useState<string | null>(null);
  const [calcLastOperand, setCalcLastOperand] = useState<number | null>(null);
  const [calcJustEvaluated, setCalcJustEvaluated] = useState(false);

  // ENHANCED SECURITY: Comprehensive violation tracking state
  const [violationCount, setViolationCount] = useState(0); // Total violations (renamed from tabSwitchCount)
  const [tabSwitchCount, setTabSwitchCount] = useState(0); // Keep for backward compatibility
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false); // Keep for compatibility
  const [violationHistory, setViolationHistory] = useState<ViolationRecord[]>([]);
  const [lastViolationType, setLastViolationType] = useState<ViolationType | null>(null);
  const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tabSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [violationPenalty, setViolationPenalty] = useState(0);
  const devToolsCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSubmittingRef = useRef(false); // Prevent double auto-submit
  const detectedReloadSessionIdRef = useRef<number | null>(null); // Session ID from reload detection
  const reloadViolationFiredRef = useRef(false); // Ensure reload violation is only fired once
  
  // RELIABILITY: Use refs to ensure latest values are always accessible for auto-submit
  const violationCountRef = useRef(violationCount);
  const tabSwitchCountRef = useRef(tabSwitchCount);
  const violationPenaltyRef = useRef(violationPenalty);
  const violationHistoryRef = useRef<ViolationRecord[]>([]); // Avoids stale closure in handleSecurityViolation
  const timeRemainingRef = useRef(timeRemaining);
  const activeSessionRef = useRef(activeSession);
  // Grace period: ignore blur/visibilitychange for 2 s after the exam page loads
  // to avoid false positives during browser rendering / initial focus.
  const examLoadedAtRef = useRef<number | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => { violationCountRef.current = violationCount; }, [violationCount]);
  useEffect(() => { tabSwitchCountRef.current = tabSwitchCount; }, [tabSwitchCount]);
  useEffect(() => { violationPenaltyRef.current = violationPenalty; }, [violationPenalty]);
  useEffect(() => { violationHistoryRef.current = violationHistory; }, [violationHistory]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  // Mark the moment the active session becomes live (start of grace period)
  useEffect(() => {
    if (activeSession && !activeSession.isCompleted && examLoadedAtRef.current === null) {
      examLoadedAtRef.current = Date.now();
    }
  }, [activeSession]);

  // Deduplication: track the last processed exam-update by exam-id+JSON hash to avoid
  // firing multiple toasts when the same update arrives via both table_change and exam.updated
  const lastExamUpdateKeyRef = useRef<string | null>(null);

  // Network status monitoring
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkIssues, setNetworkIssues] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [localPendingCount, setLocalPendingCount] = useState(0);

  // Socket.IO realtime updates for exams list.
  // Subscribes to the CLASS channel (students are allowed) so that teacher edits
  // (name, time limit, instructions, etc.) arrive even when no specific exam is selected.
  // studentClassId is derived from the exams query cache synchronously here.
  // useQuery returns cached data immediately on every render, so this is safe before the hook below.
  const cachedExams = queryClient.getQueryData<Exam[]>(['/api/exams']) ?? [];
  const studentClassId = cachedExams.length > 0 ? cachedExams[0]?.classId?.toString() : undefined;
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams', 'student-list'],
    enabled: !!user?.id,
    examId: selectedExam?.id,
    classId: studentClassId,
    onEvent: (event) => {
      // Handle exam published/unpublished events
      if (event.eventType === 'exam.published' || event.eventType === 'exam.unpublished') {
        queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
      }
      // Handle exam deleted
      if (event.eventType === 'exam.deleted' && event.data?.id === selectedExam?.id) {
        toast({
          title: "Exam Removed",
          description: "This exam is no longer available.",
          variant: "destructive",
        });
        setSelectedExam(null);
        setActiveSession(null);
      }
      // Handle exam settings updated by teacher (live update while student is taking/viewing exam)
      const isExamUpdate =
        event.eventType === 'exam.updated' ||
        (event.operation === 'UPDATE' && event.table === 'exams');
      if (isExamUpdate && event.data?.id) {
        const updatedExam = event.data as Exam;
        // Deduplicate: the same update can arrive via table_change AND exam.updated simultaneously.
        // Use a key of examId + relevant fields so identical payloads only fire once.
        const dedupeKey = `${updatedExam.id}|${updatedExam.timeLimit}|${updatedExam.name}|${updatedExam.instructions}|${updatedExam.totalMarks}|${updatedExam.passingScore}`;
        if (lastExamUpdateKeyRef.current === dedupeKey) {
          return;
        }
        lastExamUpdateKeyRef.current = dedupeKey;
        // Directly patch the exam into the query cache for instant UI update across
        // the whole page (exam cards, detail view, etc.), then invalidate to ensure
        // the server copy is also fetched in the background.
        queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) =>
          old ? old.map(e => e.id === updatedExam.id ? updatedExam : e) : old
        );
        queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
        // Only apply live updates if this is the exam the student currently has open
        if (selectedExam && updatedExam.id === selectedExam.id) {
          const prevTimeLimit = selectedExam.timeLimit;
          const newTimeLimit = updatedExam.timeLimit;
          // Push updated exam data into React state so UI reflects changes instantly
          setSelectedExam(updatedExam);
          // --- Time limit changed while student is in an active session ---
          if (activeSession && !activeSession.isCompleted && prevTimeLimit !== newTimeLimit) {
            if (newTimeLimit) {
              // Recalculate remaining time: new total − time already elapsed
              const elapsedSeconds = activeSession.startedAt
                ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000)
                : 0;
              const newTotalSeconds = newTimeLimit * 60;
              const newRemaining = Math.max(0, newTotalSeconds - elapsedSeconds);
              setTimeRemaining(newRemaining);
              const minutesLeft = Math.ceil(newRemaining / 60);
              toast({
                title: "⏱ Exam Time Updated",
                description: `Your teacher has changed the exam duration. You now have ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} remaining.`,
              });
            } else {
              // Time limit removed — student now has unlimited time
              setTimeRemaining(null);
              toast({
                title: "⏱ Time Limit Removed",
                description: "Your teacher has removed the time limit. You now have unlimited time to complete this exam.",
              });
            }
          } else if (activeSession && !activeSession.isCompleted) {
            // Other settings changed while exam is active — determine what changed
            const changes: string[] = [];
            if (updatedExam.name !== selectedExam.name) changes.push('exam name');
            if (updatedExam.instructions !== selectedExam.instructions) changes.push('instructions');
            if (updatedExam.totalMarks !== selectedExam.totalMarks) changes.push('total marks');
            if (updatedExam.passingScore !== selectedExam.passingScore) changes.push('passing score');
            if (changes.length > 0) {
              toast({
                title: "Exam Settings Updated",
                description: `Your teacher has updated this exam's ${changes.join(' and ')}. Please continue your exam.`,
              });
            }
          }
        }
      }
    }
  });

  // Socket.IO for exam session updates (timer sync, auto-submit notifications)
  // Only enabled when there's an active session with both examId and sessionId
  const activeExamId = activeSession?.examId;
  const activeSessionId = activeSession?.id;
  useSocketIORealtime({
    table: 'exam_sessions',
    queryKey: ['/api/exam-sessions', 'student', user?.id || 'none', activeExamId || 0],
    enabled: !!activeSessionId && !!activeExamId && !!user?.id,
    examId: activeExamId,
    onEvent: (event) => {
      // Handle session completion by another client (e.g., teacher force-submit)
      if (event.eventType === 'examSession.completed' && event.data?.sessionId === activeSessionId) {
        toast({
          title: "Exam Submitted",
          description: "Your exam has been submitted.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
        setLocation('/portal/student/exam-results');
      }
      // Handle auto-submit notifications
      if (event.eventType === 'exam.auto_submitted' && event.data?.studentId === user?.id) {
        toast({
          title: "Exam Auto-Submitted",
          description: "Your exam was automatically submitted due to timeout or violations.",
          variant: "destructive",
        });
      }
    }
  });

  // PROTECTION: Prevent re-entry to an already submitted exam session
  // Uses isRedirecting flag to prevent multiple redirects and race conditions
  useEffect(() => {
    // Only check if we have an active session that's completed
    if (!activeSession?.id || !activeSession.isCompleted || isRedirecting) return;
    
    // Check if there's a fresh result in sessionStorage (indicates just-submitted)
    const storedResult = sessionStorage.getItem('lastExamResult');
    if (storedResult) {
      try {
        const result = JSON.parse(storedResult);
        // If the stored result matches this session, redirect to results
        if (result.sessionId === activeSession.id) {
          setIsRedirecting(true);
          setLocation('/portal/student/exam-results');
        }
      } catch (e) {
        // Parse error, ignore
      }
    }
  }, [activeSession?.id, activeSession?.isCompleted, isRedirecting, setLocation]);

  // Fetch available exams.
  // When a student has an active session, poll every 30 s as a safety net so that
  // teacher changes (time limit, instructions, etc.) are always picked up even if
  // a socket event is missed.
  const hasActiveSession = !!activeSession && !activeSession.isCompleted;
  const { data: exams = [], isLoading: loadingExams, error: examsError } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exams');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch exams: ${response.status}`);
      }
      const examsData = await response.json();

      return examsData;
    },
    retry: 3,
    retryDelay: 1000,
    refetchInterval: hasActiveSession ? 30000 : false,
  });

  // Fetch subjects for displaying subject name in exam results
  const { data: subjects = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/subjects'],
    enabled: !!user,
  });

  // Fetch all exam sessions for the student to track completed exams
  const { data: studentExamSessions = [] } = useQuery<Array<{
    id: number;
    examId: number;
    studentId: string;
    isCompleted: boolean;
    status: string;
    score?: number;
    maxScore?: number;
  }>>({
    queryKey: ['/api/exam-sessions/student', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/exam-sessions/student/${user?.id}`);
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Helper function to check if an exam has been completed by the student
  const getExamStatus = (examId: number) => {
    const session = studentExamSessions.find(s => s.examId === examId && s.isCompleted);
    if (session) {
      return {
        isCompleted: true,
        score: session.score,
        maxScore: session.maxScore,
        sessionId: session.id,
      };
    }
    // Check for in-progress session
    const inProgressSession = studentExamSessions.find(s => s.examId === examId && !s.isCompleted);
    if (inProgressSession) {
      return {
        isCompleted: false,
        isInProgress: true,
        sessionId: inProgressSession.id,
      };
    }
    return { isCompleted: false, isInProgress: false };
  };

  // Fetch exam questions for active session
  const { data: examQuestionsRaw = [], isLoading: loadingQuestions } = useQuery<ExamQuestion[]>({
    queryKey: ['/api/exam-questions', activeSession?.examId],
    enabled: !!activeSession?.examId,
  });

  // QUESTION RANDOMIZATION: Shuffle questions if exam has shuffleQuestions enabled
  const examQuestions = useMemo(() => {
    if (!examQuestionsRaw.length) return [];

    const exam = exams.find(e => e.id === activeSession?.examId);

    // If shuffleQuestions is enabled, shuffle the questions
    if (exam?.shuffleQuestions && !activeSession?.isCompleted && activeSession?.id) {
      // Seeded random function based on session ID for consistent shuffling
      const seed = activeSession.id;
      let seedValue = seed;
      const seededRandom = () => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
      };

      // Use Fisher-Yates shuffle algorithm with seeded random
      const shuffled = [...examQuestionsRaw];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    // Otherwise return in original order
    return examQuestionsRaw;
  }, [examQuestionsRaw, activeSession?.examId, activeSession?.isCompleted, activeSession?.id, exams]);

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/classes'],
    enabled: !!user,
  });

  // PERFORMANCE: Memoize current question to prevent unnecessary re-renders
  const currentQuestion = useMemo(() => examQuestions[currentQuestionIndex], [examQuestions, currentQuestionIndex]);

  // Find school class name for header
  const studentClassName = useMemo(() => {
    const classId = (user as any)?.classId;
    if (!classId) return "";
    const studentClass = classes.find((c: any) => c.id === classId);
    return studentClass?.name || "";
  }, [user, classes]);

  // Find subject name for header
  const subjectName = useMemo(() => {
    const exam = exams.find(e => e.id === activeSession?.examId);
    if (!exam) return "";
    const subject = subjects.find(s => s.id === exam.subjectId);
    return subject?.name || exam.name || "";
  }, [exams, activeSession?.examId, subjects]);

  const studentName = useMemo(() => {
    if (!user) return "";
    return `${user.firstName} ${user.lastName}`;
  }, [user]);

  const studentInitials = useMemo(() => {
    if (!user) return "";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }, [user]);

  // PERFORMANCE: Bulk-fetch ALL question options in one request when exam loads.
  // This data lives in React memory for the entire exam — works offline after first load.
  const { data: allQuestionOptions = [] } = useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options/bulk', examQuestions.map(q => q.id).join(',')],
    queryFn: async () => {
      if (!examQuestions.length) return [];
      const mcQuestions = examQuestions.filter(q => q.questionType === 'multiple_choice');
      if (mcQuestions.length === 0) return [];
      const questionIds = mcQuestions.map(q => q.id).join(',');
      const response = await apiRequest('GET', `/api/question-options/bulk?questionIds=${questionIds}`);
      if (response.ok) return await response.json();
      return [];
    },
    enabled: !!examQuestions.length && (showResults || examQuestions.some(q => q.questionType === 'multiple_choice')),
    staleTime: Infinity,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  // Per-question query kept only as a cache warm-up for the very first render.
  // Rendering always uses the bulk data (already in memory) so options show even offline.
  useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options', currentQuestion?.id],
    enabled: !!currentQuestion?.id && currentQuestion?.questionType === 'multiple_choice',
    staleTime: Infinity,
    networkMode: 'offlineFirst',
  });

  // OPTION RENDERING: derive current question's options from bulk-loaded data.
  // Since allQuestionOptions is fetched once at exam start and kept in memory (staleTime/gcTime
  // Infinity), options are always visible regardless of connection status.
  const questionOptions = useMemo(() => {
    if (!currentQuestion || currentQuestion.questionType !== 'multiple_choice') return [];

    // Primary source: bulk options already in memory (no network call needed)
    let base: QuestionOption[] = allQuestionOptions.filter(o => o.questionId === currentQuestion.id);

    // Fallback: per-question cache entry (covers the edge case where bulk hasn't loaded yet)
    if (base.length === 0) {
      const cached = queryClient.getQueryData<QuestionOption[]>(['/api/question-options', currentQuestion.id]);
      if (cached?.length) base = cached;
    }

    if (base.length === 0) return [];

    const exam = exams.find(e => e.id === activeSession?.examId);

    // Apply seeded shuffle if the exam has shuffleQuestions enabled
    if (exam?.shuffleQuestions && !activeSession?.isCompleted && activeSession?.id) {
      const seed = activeSession.id + currentQuestion.id;
      let seedValue = seed;
      const seededRandom = () => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
      };
      const shuffled = [...base];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    return base;
  }, [allQuestionOptions, currentQuestion, activeSession?.examId, activeSession?.isCompleted, activeSession?.id, exams]);

  // Fetch existing answers for active session
  const { data: existingAnswers = [] } = useQuery<StudentAnswer[]>({
    queryKey: ['/api/student-answers/session', activeSession?.id],
    enabled: !!activeSession?.id,
  });

  // PERFORMANCE: Memoize answer map calculation to prevent unnecessary computations
  const answerMap = useMemo(() => {
    const map: Record<number, any> = {};
    existingAnswers.forEach(answer => {
      if (answer.selectedOptionId) {
        // Store as string so RadioGroup value comparisons work correctly
        // (RadioGroupItem values are always strings)
        map[answer.questionId] = String(answer.selectedOptionId);
      } else if (answer.textAnswer) {
        map[answer.questionId] = answer.textAnswer;
      }
    });
    return map;
  }, [existingAnswers]);

  // Load existing answers into state
  useEffect(() => {
    if (Object.keys(answerMap).length > 0) {
      setAnswers(answerMap);
    }
  }, [answerMap]);

  // Restore locally-stored answers when a session is active (offline recovery)
  useEffect(() => {
    if (!activeSession?.id) return;
    const local = lsGetAll(activeSession.id);
    const entries = Object.entries(local);
    if (entries.length === 0) return;

    // Merge local answers into state — only fill gaps the server doesn't already have
    setAnswers(prev => {
      const merged = { ...prev };
      entries.forEach(([qIdStr, { answer }]) => {
        const qId = parseInt(qIdStr);
        if (merged[qId] === undefined) merged[qId] = answer;
      });
      return merged;
    });

    // Count how many haven't synced to server yet
    const unsynced = entries.filter(([, v]) => !v.synced);
    setLocalPendingCount(unsynced.length);

    // If we're online right now, kick off a sync for unsynced answers
    if (navigator.onLine && unsynced.length > 0) {
      unsynced.forEach(([qIdStr, { answer, questionType }]) => {
        const qId = parseInt(qIdStr);
        // Only push answers the server didn't already return
        if (answerMap[qId] === undefined) {
          submitAnswerMutation.mutate({ questionId: qId, answer, questionType });
        } else {
          lsMarkSynced(activeSession.id, qId);
        }
      });
      setLocalPendingCount(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  // LEFT-EXAM DETECTION: On mount, check if the student left the exam page
  // localStorage persists across tab closes, navigation away, AND page reloads,
  // so this catches all cases where a student abandons the exam page.
  useEffect(() => {
    try {
      const marker = localStorage.getItem('exam_left_marker');
      if (marker) {
        const parsed = JSON.parse(marker);
        if (parsed?.sessionId) {
          detectedReloadSessionIdRef.current = parsed.sessionId;
        }
        // Remove immediately so it doesn't fire twice
        localStorage.removeItem('exam_left_marker');
      }
    } catch (_) {}
    // Clean up any leftover sessionStorage marker from the old mechanism
    try { sessionStorage.removeItem('exam_session_active'); } catch (_) {}
  }, []);

  // Check for existing active session on component mount
  useEffect(() => {
    if (user?.id && !activeSession) {
      apiRequest('GET', `/api/exam-sessions/student/${user.id}/active`)
        .then(response => response.json())
        .then(session => {
          if (session) {
            setActiveSession(session);
            const exam = exams.find(e => e.id === session.examId);
            if (exam) {
              setSelectedExam(exam);
            }
            // Restore session state from metadata
            try {
              const metadata = session.metadata ? JSON.parse(session.metadata) : {};
              if (metadata.currentQuestionIndex) {
                setCurrentQuestionIndex(metadata.currentQuestionIndex);
              }
              // Restore violation count and penalty (persists across reloads).
              // Strategy: take the HIGHER of the server value and the localStorage
              // backup so that a failed server PATCH never causes us to lose count.
              let serverCount = 0;
              if (metadata.violationCount !== undefined) {
                serverCount = metadata.violationCount;
              } else if (metadata.tabSwitchCount !== undefined) {
                // Backward compatibility
                serverCount = metadata.tabSwitchCount;
              }

              const lsBackup = lsViolationGet(session.id);
              const restoredCount = lsBackup
                ? Math.max(serverCount, lsBackup.violationCount)
                : serverCount;

              if (restoredCount > 0) {
                setViolationCount(restoredCount);
                // Sync ref immediately — setViolationCount is async so the ref's
                // useEffect would lag behind. The reload violation fires 1.5 s from
                // now; without this the ref would still be 0 and newCount would be
                // wrong (e.g. 1 instead of the correct restored+1 value).
                violationCountRef.current = restoredCount;
                const restoredPenalty = calculateViolationPenalty(restoredCount);
                violationPenaltyRef.current = restoredPenalty;
                setViolationPenalty(restoredPenalty);

                // Restore violation history from localStorage backup if richer
                if (lsBackup?.violationHistory?.length) {
                  const hist: ViolationRecord[] = lsBackup.violationHistory.map((v: any) => ({
                    ...v,
                    timestamp: new Date(v.timestamp),
                  }));
                  setViolationHistory(hist);
                  violationHistoryRef.current = hist;
                }

                // If the count is already at (or somehow beyond) the threshold, the
                // exam should have been auto-submitted on the previous session but
                // forceSubmit may have failed. Block any more violations immediately
                // and trigger a silent auto-submit so the count never exceeds MAX.
                if (restoredCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
                  isAutoSubmittingRef.current = true;
                  // Small delay so the session state settles before submitting
                  setTimeout(() => forceSubmitExam(), 2000);
                }
              }
            } catch (e) {
            }
          }
        })
        .catch(error => {
        });
    }
  }, [user?.id, exams]);

  // SESSION RECOVERY: Resume active session with timer recovery (silent - no toast)
  useEffect(() => {
    if (activeSession && !activeSession.isCompleted) {
      const exam = exams.find(e => e.id === activeSession.examId);

      // ALWAYS calculate remaining time from startedAt for accuracy.
      // Using the stored timeRemaining can be up to 30s stale (save interval),
      // which makes the timer appear to reset to the beginning on reload.
      if (exam?.timeLimit && activeSession.startedAt) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);
        const totalSeconds = exam.timeLimit * 60;
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        setTimeRemaining(remaining);
      } else if (activeSession.timeRemaining !== null && activeSession.timeRemaining !== undefined) {
        // Fallback: use stored value only when startedAt or timeLimit is unavailable
        setTimeRemaining(activeSession.timeRemaining);
      }

      // Ensure the localStorage marker is always present while the exam is active.
      // beforeunload also sets it, but this covers the moment the session first loads.
      try {
        localStorage.setItem('exam_left_marker', JSON.stringify({ sessionId: activeSession.id, timestamp: Date.now() }));
      } catch (_) {}
    }
  }, [activeSession, exams]);

  // Timer countdown with race condition protection
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && activeSession && !activeSession.isCompleted) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            // Auto-submit when time runs out, but wait for pending saves
            handleAutoSubmitOnTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, activeSession]);

  // Network status monitoring and session health check
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkIssues(false);

      // Sync any locally-stored answers that haven't reached the server yet
      const session = activeSessionRef.current;
      if (session) {
        const local = lsGetAll(session.id);
        const unsynced = Object.entries(local).filter(([, v]) => !v.synced);
        unsynced.forEach(([qIdStr, { answer, questionType }]) => {
          const qId = parseInt(qIdStr);
          submitAnswerMutation.mutate({ questionId: qId, answer, questionType });
        });
        setLocalPendingCount(0);
      }

      // Also retry any answers that previously got a 'failed' status
      Object.keys(answers).forEach(questionId => {
        const qId = parseInt(questionId);
        if (questionSaveStatus[qId] === 'failed') {
          const question = examQuestions.find(q => q.id === qId);
          if (question) handleRetryAnswer(qId, question.questionType);
        }
      });

      toast({
        title: "Connection Restored",
        description: "Back online — syncing your answers now...",
        variant: "default",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkIssues(true);
      toast({
        title: "Connection Lost",
        description: "No internet — your answers are being saved on this device and will sync when you're back online.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [answers, questionSaveStatus, examQuestions]);

  // Session health monitoring - check every 5 minutes during active exam
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    const healthCheck = async () => {
      try {
        const response = await apiRequest('GET', `/api/exam-sessions/${activeSession.id}`);
        if (!response.ok && response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Your exam session has expired. Please refresh the page and log in again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        // Silent fail - network issues will be handled by other mechanisms
      }
    };

    const interval = setInterval(healthCheck, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [activeSession]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      Object.values(debounceTimersRef.current).forEach(timeout => clearTimeout(timeout));
      if (tabSwitchTimeoutRef.current) clearTimeout(tabSwitchTimeoutRef.current);
      if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
      if (devToolsCheckRef.current) clearTimeout(devToolsCheckRef.current);
    };
  }, []);

  // Function to calculate violation penalty
  const calculateViolationPenalty = (violations: number): number => {
    if (violations === 0) return 0;
    const penalty = violations * PENALTY_PER_VIOLATION;
    return Math.min(penalty, MAX_PENALTY);
  };

  // UNIFIED VIOLATION HANDLER: Centralizes all security violation processing
  // Handles: tab switches, browser minimize, DevTools, refresh attempts, duplicate sessions
  // NOTE: Uses violationCountRef / violationHistoryRef for reliable current values —
  // never relies on stale closures. violationHistory is intentionally NOT in the
  // dependency array so the callback is stable and does not cause every security
  // effect to re-subscribe on each violation.
  const handleSecurityViolation = useCallback((type: ViolationType, details?: string) => {
    if (!activeSession || activeSession.isCompleted || isAutoSubmittingRef.current) return;
    // Double-guard: if the violation count already reached the auto-submit threshold
    // (e.g. restored from a previous session where forceSubmit failed), lock out
    // any further violations immediately so the count can never exceed MAX.
    if (violationCountRef.current >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
      isAutoSubmittingRef.current = true;
      setTimeout(() => forceSubmitExam(), 1000);
      return;
    }

    // Derive new count from ref (always current, no stale closure risk)
    const newCount = violationCountRef.current + 1;

    // Sync ref and state immediately
    violationCountRef.current = newCount;
    setViolationCount(newCount);

    // Record violation in history — use ref for current history (no stale closure)
    const violationRecord: ViolationRecord = {
      type,
      timestamp: new Date(),
      details
    };
    const updatedHistory = [...violationHistoryRef.current, violationRecord].slice(-10);
    violationHistoryRef.current = updatedHistory;
    setViolationHistory(updatedHistory);
    setLastViolationType(type);

    // Update penalty
    const calculatedPenalty = calculateViolationPenalty(newCount);
    violationPenaltyRef.current = calculatedPenalty;
    setViolationPenalty(calculatedPenalty);

    // Backward compatibility counter
    if (type === 'tab_switch' || type === 'browser_minimize') {
      setTabSwitchCount(tc => tc + 1);
    }

    // Violation display names
    const violationNames: Record<ViolationType, string> = {
      'tab_switch': 'Tab Switch',
      'browser_minimize': 'Browser Minimized',
      'devtools': 'DevTools Detected',
      'refresh_attempt': 'Refresh/Back Attempt',
      'page_reload': 'Left Exam Page',
      'duplicate_session': 'Duplicate Session',
      'screenshot': 'Screenshot Attempt',
      'copy_paste': 'Copy/Paste Attempt'
    };

    // Save to localStorage backup IMMEDIATELY (synchronous, survives any network failure)
    if (activeSession?.id) {
      lsViolationSave(activeSession.id, newCount, calculatedPenalty, updatedHistory);
    }

    // Persist violation to server (fire-and-forget; localStorage is the fallback)
    if (activeSession?.id) {
      apiRequest('PATCH', `/api/exam-sessions/${activeSession.id}/metadata`, {
        metadata: JSON.stringify({
          violationCount: newCount,
          violationPenalty: calculatedPenalty,
          lastViolationType: type,
          violationHistory: updatedHistory
        })
      }).catch(() => {
        // Server PATCH failed — localStorage backup already saved above, so the
        // count will still be restored correctly when the student returns.
      });
    }

    // ── Show warning banner for every violation ─────────────────────────────
    setShowViolationWarning(true);
    setShowTabSwitchWarning(true);

    if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
    violationTimeoutRef.current = setTimeout(() => {
      setShowViolationWarning(false);
      setShowTabSwitchWarning(false);
    }, 8000);

    // Display count is always capped at MAX_WARNINGS_ALLOWED so we never show
    // "4 of 3" even if the raw count exceeded 3 due to a rare timing edge case.
    const displayCount = Math.min(newCount, MAX_WARNINGS_ALLOWED);

    // ── 3rd (or beyond) violation → WARNING 3 of 3 then AUTO-SUBMIT ─────────
    if (newCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
      isAutoSubmittingRef.current = true;
      toast({
        title: `🚨 WARNING ${displayCount} of ${MAX_WARNINGS_ALLOWED}: ${violationNames[type]}`,
        description: `This is your 3rd and final violation. Your exam is being automatically submitted now.`,
        variant: 'destructive',
        duration: 8000,
      });
      // Give 3 seconds so the student can read the final warning before submit
      setTimeout(() => forceSubmitExam(), 3000);
      return;
    }

    // ── 1st or 2nd violation → numbered warning ──────────────────────────────
    toast({
      title: `⚠️ WARNING ${displayCount} of ${MAX_WARNINGS_ALLOWED}: ${violationNames[type]}`,
      description: newCount === 1
        ? `This is Warning 1 of 3. You have 2 more violations allowed before your exam is auto-submitted. Stay on this page and do not switch tabs or reload.`
        : `This is Warning 2 of 3. ONE more violation will automatically submit your exam immediately. Stay on this page.`,
      variant: 'destructive',
      duration: 12000,
    });
  }, [activeSession, toast]);

  // RELOAD VIOLATION: Fire a violation when a page reload is detected for the active session.
  // Must be placed AFTER handleSecurityViolation is defined.
  //
  // IMPORTANT: reloadViolationFiredRef.current is set INSIDE the timeout callback, not before.
  // If it were set before, any React effect re-run (caused by activeSession or
  // handleSecurityViolation changing) would cancel the timeout AND leave the ref = true,
  // so the condition would fail on re-run and the violation would silently disappear.
  useEffect(() => {
    if (
      !activeSession ||
      activeSession.isCompleted ||
      detectedReloadSessionIdRef.current !== activeSession.id ||
      reloadViolationFiredRef.current
    ) return;

    const t = setTimeout(() => {
      // Double-check inside the timeout to handle the race where two timeouts
      // briefly overlap before the first one sets the flag.
      if (reloadViolationFiredRef.current) return;
      reloadViolationFiredRef.current = true;
      handleSecurityViolation('page_reload', 'Student left the exam page (tab closed, reloaded, or navigated away)');
    }, 1500);

    // Cancel the timeout if deps change — a fresh one will be rescheduled on
    // the next run (ref is still false, so the outer guard above still passes).
    return () => clearTimeout(t);
  }, [activeSession, handleSecurityViolation]);

  // =============================================================================
  // COMPREHENSIVE EXAM SECURITY SYSTEM
  // Detects: Tab switching, Browser minimize, DevTools, Refresh/Back, Duplicate sessions
  // =============================================================================

  // 1. TAB SWITCH & BROWSER MINIMIZE DETECTION
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    let visibilityTimer: NodeJS.Timeout | null = null;

    // Grace period: ignore events for the first 2 seconds after the exam loads
    // to prevent false positives from the browser rendering / initial focus.
    const GRACE_PERIOD_MS = 2000;
    const isWithinGracePeriod = () =>
      examLoadedAtRef.current !== null &&
      Date.now() - examLoadedAtRef.current < GRACE_PERIOD_MS;

    const handleVisibilityChange = () => {
      if (isWithinGracePeriod()) return;
      if (document.hidden) {
        visibilityTimer = setTimeout(() => {
          if (document.hidden) {
            handleSecurityViolation('tab_switch', 'Student left the exam tab');
          }
        }, VIOLATION_DETECTION_DELAY);
      } else {
        if (visibilityTimer) {
          clearTimeout(visibilityTimer);
          visibilityTimer = null;
        }
      }
    };

    const handleWindowBlur = () => {
      if (isWithinGracePeriod()) return;
      // Only fire for window-level blur (e.g. alt-tab / minimize), not tab switches
      // (those are already caught by visibilitychange above).
      if (!document.hidden) {
        visibilityTimer = setTimeout(() => {
          if (!document.hasFocus() && !document.hidden) {
            handleSecurityViolation('browser_minimize', 'Browser window lost focus');
          }
        }, VIOLATION_DETECTION_DELAY * 2);
      }
    };

    const handleWindowFocus = () => {
      if (visibilityTimer) {
        clearTimeout(visibilityTimer);
        visibilityTimer = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      if (visibilityTimer) clearTimeout(visibilityTimer);
    };
  }, [activeSession, handleSecurityViolation]);

  // 2. ENHANCED DEVTOOLS DETECTION - Non-blocking detection methods
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    let devToolsOpen = false;
    let consecutiveDetections = 0;
    const DETECTION_THRESHOLD = 2; // Require 2 consecutive detections to reduce false positives

    // Method 1: Window size difference detection (works for docked DevTools)
    const checkDevToolsBySize = (): boolean => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      return widthThreshold || heightThreshold;
    };

    // Method 2: Console timing trick using Image getter (non-blocking)
    // When DevTools console is open, accessing certain properties triggers inspection
    let consoleDetected = false;
    const checkDevToolsByConsole = (): boolean => {
      const result = consoleDetected;
      consoleDetected = false; // Reset for next check
      
      try {
        const element = new Image();
        Object.defineProperty(element, 'id', {
          get: function() {
            consoleDetected = true;
            return 'devtools-detector';
          }
        });
        
        // Using console.debug which is less intrusive than console.dir
        console.debug(element);
      } catch (e) {
        // Silently ignore if Object.defineProperty fails
      }
      
      return result;
    };

    // Method 3: Performance timing check (non-blocking, measures toString/valueOf overhead)
    const checkDevToolsByTiming = (): boolean => {
      const start = performance.now();
      
      // Create an object with a slow toString (only triggers when DevTools inspects it)
      const obj = {
        toString: function() {
          // This is called when DevTools tries to display the object
          return 'test';
        }
      };
      
      // Trigger potential inspection
      console.debug('%c', obj);
      
      const end = performance.now();
      
      // If DevTools is open and inspecting, there's usually a slight delay
      // Keep threshold low to avoid false positives
      return (end - start) > 50;
    };

    const checkDevTools = () => {
      const sizeCheck = checkDevToolsBySize();
      const consoleCheck = checkDevToolsByConsole();
      
      // Combine detection methods - size check is most reliable
      const detected = sizeCheck || consoleCheck;
      
      if (detected) {
        consecutiveDetections++;
        if (consecutiveDetections >= DETECTION_THRESHOLD && !devToolsOpen) {
          devToolsOpen = true;
          const method = sizeCheck ? 'window size analysis' : 'console inspection';
          handleSecurityViolation('devtools', `DevTools detected via ${method}`);
        }
      } else {
        consecutiveDetections = 0;
        devToolsOpen = false;
      }
    };

    const interval = setInterval(checkDevTools, DEVTOOLS_CHECK_INTERVAL);
    devToolsCheckRef.current = interval as unknown as NodeJS.Timeout;

    return () => {
      clearInterval(interval);
    };
  }, [activeSession, handleSecurityViolation]);

  // 3. REFRESH & BACK BUTTON DETECTION
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an exam in progress. Leaving will be recorded as a violation.';
      // Set a localStorage marker that survives tab closes, navigation, AND reloads.
      // This is the primary mechanism for detecting that the student left the exam.
      try {
        localStorage.setItem('exam_left_marker', JSON.stringify({
          sessionId: activeSession.id,
          timestamp: Date.now()
        }));
      } catch (_) {}
      // Also snapshot the latest violation count to localStorage backup so even
      // if the async PATCH is in-flight or fails, count survives the tab close.
      try {
        lsViolationSave(
          activeSession.id,
          violationCountRef.current,
          violationPenaltyRef.current,
          violationHistoryRef.current
        );
      } catch (_) {}
      return e.returnValue;
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      handleSecurityViolation('refresh_attempt', 'Attempted to use browser back/forward button');
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSession, handleSecurityViolation]);

  // 4. SCREENSHOT DETECTION (limited browser support)
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        handleSecurityViolation('screenshot', 'PrintScreen key detected');
      }
    };

    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeSession, handleSecurityViolation]);

  // 5. ANTI-CHEAT: Disable copy, paste, right-click, and DevTools shortcuts
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast({ title: "Copy Disabled", description: "Copying is not allowed during the exam.", variant: "destructive" });
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast({ title: "Paste Disabled", description: "Pasting is not allowed during the exam.", variant: "destructive" });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast({ title: "Right-Click Disabled", description: "Right-clicking is not allowed during the exam.", variant: "destructive" });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
      if (e.key === 'F12') {
        e.preventDefault();
        handleSecurityViolation('devtools', 'F12 key pressed');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleSecurityViolation('devtools', 'Ctrl+Shift+I pressed');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleSecurityViolation('devtools', 'Ctrl+Shift+J pressed');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSession, toast, handleSecurityViolation]);

  // 6. DUPLICATE SESSION DETECTION - Prevents opening exam in multiple tabs/devices
  // Uses BOTH localStorage (same browser) AND Socket.IO (cross-browser/device)
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    // Generate unique tab ID for this browser tab
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = `exam_session_${activeSession.id}`;
    
    // === PART A: LocalStorage for same-browser tab detection ===
    const existingSession = localStorage.getItem(sessionKey);
    if (existingSession) {
      try {
        const existing = JSON.parse(existingSession);
        const timeSinceLastPing = Date.now() - existing.lastPing;
        if (timeSinceLastPing < 5000 && existing.tabId !== tabId) {
          handleSecurityViolation('duplicate_session', 'Exam already open in another tab');
        }
      } catch (e) {
        localStorage.removeItem(sessionKey);
      }
    }
    
    const registerLocalSession = () => {
      localStorage.setItem(sessionKey, JSON.stringify({
        tabId,
        sessionId: activeSession.id,
        lastPing: Date.now()
      }));
    };
    
    registerLocalSession();
    const localHeartbeatInterval = setInterval(registerLocalSession, 2000);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === sessionKey && e.newValue) {
        try {
          const newSession = JSON.parse(e.newValue);
          if (newSession.tabId !== tabId && Date.now() - newSession.lastPing < 5000) {
            handleSecurityViolation('duplicate_session', 'Exam opened in another browser tab');
          }
        } catch (e) {}
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // === PART B: Socket.IO for cross-browser/device detection ===
    // Get the socket from the global socket manager
    const token = localStorage.getItem('token');
    if (token && typeof window !== 'undefined') {
      // Create a connection to register this exam session with the server
      const socketUrl = window.location.origin;
      
      // Use dynamic import to get socket.io-client
      import('socket.io-client').then(({ io }) => {
        const socket = io(socketUrl, {
          path: '/socket.io/',
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
        });
        
        // Register this exam session with the server
        socket.on('connect', () => {
          socket.emit('exam:register_session', {
            sessionId: activeSession.id,
            examId: activeSession.examId
          });
        });
        
        // Listen for duplicate session events from server
        socket.on('exam:duplicate_session', (data: { sessionId: number; message: string }) => {
          if (data.sessionId === activeSession.id) {
            handleSecurityViolation('duplicate_session', data.message || 'Exam opened on another device');
          }
        });
        
        // Send heartbeats to keep session active on server
        const serverHeartbeatInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit('exam:session_heartbeat', { sessionId: activeSession.id });
          }
        }, 5000);
        
        // Store socket for cleanup
        (window as any).__examSecuritySocket = socket;
        (window as any).__examSecurityHeartbeat = serverHeartbeatInterval;
      }).catch(() => {
        // Socket.IO import failed - rely on localStorage only
        console.warn('Socket.IO not available for cross-device duplicate detection');
      });
    }
    
    // Cleanup on unmount or session end
    return () => {
      clearInterval(localHeartbeatInterval);
      window.removeEventListener('storage', handleStorageChange);
      
      // Cleanup localStorage
      const currentSession = localStorage.getItem(sessionKey);
      if (currentSession) {
        try {
          const parsed = JSON.parse(currentSession);
          if (parsed.tabId === tabId) {
            localStorage.removeItem(sessionKey);
          }
        } catch (e) {
          localStorage.removeItem(sessionKey);
        }
      }
      
      // Cleanup Socket.IO
      const socket = (window as any).__examSecuritySocket;
      const heartbeat = (window as any).__examSecurityHeartbeat;
      if (heartbeat) clearInterval(heartbeat);
      if (socket) {
        socket.emit('exam:unregister_session', { sessionId: activeSession.id });
        socket.disconnect();
        delete (window as any).__examSecuritySocket;
        delete (window as any).__examSecurityHeartbeat;
      }
    };
  }, [activeSession, handleSecurityViolation]);

  // Client-side answer validation - relaxed for better UX
  const validateAnswer = (questionType: string, answer: any): { isValid: boolean; error?: string } => {
    if (questionType === 'multiple_choice') {
      // Allow any truthy value for MC questions
      if (answer === null || answer === undefined || answer === '') {
        return { isValid: false, error: 'Please select an option' };
      }
      return { isValid: true };
    }
    if (questionType === 'text' || questionType === 'essay') {
      // Only validate that answer exists and is a string
      if (answer === null || answer === undefined) {
        return { isValid: false, error: 'Please enter an answer' };
      }
      if (typeof answer !== 'string') {
        return { isValid: false, error: 'Invalid answer format' };
      }
      // Allow even single character answers for auto-save
      return { isValid: true };
    }
    return { isValid: false, error: 'Unknown question type' };
  };

  // Check if any answers are currently being saved
  const hasPendingSaves = (): boolean => {
    return pendingSaves.size > 0;
  };

  // Auto-submit with safe wait time for data integrity
  const handleAutoSubmitOnTimeout = async () => {
    const startTime = Date.now();


    if (hasPendingSaves()) {
      toast({
        title: "Time's Up",
        description: "Please wait while we save your final answers and submit your exam...",
      });

      const maxWaitTime = 3000;
      const checkInterval = 100;
      let waitTime = 0;

      const checkSaves = () => {
        if (!hasPendingSaves()) {
          const totalWaitTime = Date.now() - startTime;
          toast({
            title: "Submitting Your Exam",
            description: "All answers have been saved. Submitting your exam now...",
          });
          forceSubmitExam();
        } else if (waitTime >= maxWaitTime) {
          const totalWaitTime = Date.now() - startTime;
          toast({
            title: "Submitting Your Exam",
            description: "Your time has expired. Submitting your exam with all saved answers...",
            variant: "destructive",
          });
          forceSubmitExam();
        } else {
          waitTime += checkInterval;
          if (waitTime % 500 === 0) {
          }
          setTimeout(checkSaves, checkInterval);
        }
      };

      checkSaves();
    } else {
      toast({
        title: "Time's Up",
        description: "Your exam time has ended. Submitting your exam now...",
        variant: "destructive",
      });
      forceSubmitExam();
    }
  };

  // Start exam mutation
  const startExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const response = await apiRequest('POST', '/api/exam-sessions', {
        examId: examId,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start exam';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = 'Server error - please try again';
          }
        } catch (parseError) {
          errorMessage = 'Server error - please try again';
        }
        throw new Error(errorMessage);
      }
      const sessionData = await response.json();
      return sessionData;
    },
    onSuccess: (data: any) => {
      // Handle already completed exam - redirect to results page (server-side enforcement)
      if (data.alreadyCompleted && data.redirectToResults && data.result) {
        // Use the centralized redirect function to go to results page
        redirectToExamResults(data.result, data.message || "You have already completed this exam. Showing your results.");
        return;
      }

      // Normal session start flow
      const session = data as ExamSession;
      if (!session || !session.id) {
        toast({
          title: "Error",
          description: "Invalid session data received. Please try again.",
          variant: "destructive",
        });
        return;
      }
      setActiveSession(session);
      setCurrentQuestionIndex(0);
      setAnswers({}); // Clear any previous answers
      setTabSwitchCount(0); // Reset tab switch counter
      setViolationPenalty(0); // Reset penalty

      // Set timer if exam has time limit
      const exam = exams.find(e => e.id === session.examId);
      if (exam?.timeLimit) {
        const timeInSeconds = exam.timeLimit * 60;
        setTimeRemaining(timeInSeconds);
      } else {
        setTimeRemaining(null);
      }
      toast({
        title: "Welcome to Your Exam",
        description: `Best of luck! You have ${exam?.timeLimit ? `${exam.timeLimit} minutes` : 'unlimited time'} to complete this exam. Stay focused and do your best.`,
        variant: "default",
      });
    },
    onError: (error: Error) => {

      let errorMessage = error.message || "Unable to start exam. Please try again.";

      // Handle specific error cases
      if (error.message.includes('already has an active session')) {
        errorMessage = "You already have an active exam session. Please contact your instructor if you believe this is an error.";
      } else if (error.message.includes('not published')) {
        errorMessage = "This exam is not yet available. Please check with your instructor.";
      } else if (error.message.includes('not authenticated')) {
        errorMessage = "Please log in again to start the exam.";
      }
      toast({
        title: "Unable to Start Exam",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Enhanced submit answer mutation with robust error handling and automatic retries
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer, questionType }: { questionId: number; answer: any; questionType: string }) => {
      // Client-side validation before submission
      const validation = validateAnswer(questionType, answer);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid answer');
      }
      const answerData = questionType === 'multiple_choice'
        ? { sessionId: activeSession!.id, questionId, selectedOptionId: answer }
        : { sessionId: activeSession!.id, questionId, textAnswer: answer };


      // Enhanced retry logic with exponential backoff
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Add delay for retry attempts (exponential backoff)
          if (attempt > 0) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          const response = await apiRequest('POST', '/api/student-answers', answerData);

          if (!response.ok) {
            let errorMessage = `Failed to submit answer (${response.status})`;
            let shouldRetry = false;

            try {
              const errorData = await response.json();
              if (errorData?.message) {
                errorMessage = errorData.message;
              } else if (errorData?.errors) {
                // Handle Zod validation errors
                errorMessage = Array.isArray(errorData.errors) 
                  ? errorData.errors.map((e: any) => e.message).join(', ')
                  : 'Validation failed';
              }
            } catch (parseError) {

              // Provide more specific error messages based on status code
              if (response.status === 401) {
                errorMessage = 'Your session has expired. Please refresh the page and log in again.';
              } else if (response.status === 403) {
                errorMessage = 'Permission denied. Please contact your instructor.';
              } else if (response.status === 408 || response.status === 504) {
                errorMessage = 'Request timeout. Retrying...';
                shouldRetry = true;
              } else if (response.status >= 500) {
                errorMessage = 'Server error occurred. Retrying...';
                shouldRetry = true;
              } else if (response.status === 429) {
                errorMessage = 'Too many requests. Retrying...';
                shouldRetry = true;
              } else if (response.status === 0) {
                errorMessage = 'Unable to connect to server. Retrying...';
                shouldRetry = true;
              } else {
                errorMessage = `Server error (${response.status}). Please try again.`;
              }
            }

            const error = new Error(errorMessage);
            lastError = error;

            // Determine if we should retry based on error type
            if (response.status === 401 || response.status === 403 || response.status === 404) {
              // Don't retry auth errors or not found
              throw error;
            } else if ((response.status >= 500 || response.status === 429 || response.status === 408 || response.status === 504) && attempt < maxRetries) {
              // Retry server errors, rate limits, and timeouts
              shouldRetry = true;
              continue;
            } else {
              // Last attempt or non-retryable error
              throw error;
            }
          }

          try {
            const result = await response.json();
            return result;
          } catch (parseError) {
            const error = new Error('Invalid response from server. Please try again.');
            lastError = error;

            if (attempt < maxRetries) {
              continue; // Retry JSON parsing errors
            }
            throw error;
          }
        } catch (networkError: any) {
          lastError = networkError;

          // Check if it's a network/timeout error that should be retried
          if ((networkError.name === 'TypeError' || 
               networkError.name === 'AbortError' || 
               networkError.message?.includes('fetch') ||
               networkError.message?.includes('network') ||
               networkError.message?.includes('timeout')) && 
               attempt < maxRetries) {
            continue; // Retry network errors
          }
          // Last attempt or non-retryable error
          throw new Error('Network connection failed. Please check your internet connection and try again.');
        }
      }

      // If we get here, all retries failed
      throw lastError || new Error('Failed to submit answer after multiple attempts');
    },
    onMutate: (variables) => {
      // Set status to saving and track pending save
      setQuestionSaveStatus(prev => ({ ...prev, [variables.questionId]: 'saving' }));
      setPendingSaves(prev => new Set(prev).add(variables.questionId));

      // Clear any existing timeout for this question
      if (saveTimeoutsRef.current[variables.questionId]) {
        clearTimeout(saveTimeoutsRef.current[variables.questionId]);
      }
    },
    onSuccess: (data, variables) => {
      // Mark as saved and remove from pending
      setQuestionSaveStatus(prev => ({ ...prev, [variables.questionId]: 'saved' }));
      setPendingSaves(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.questionId);
        return newSet;
      });

      // Mark this answer as synced in localStorage so we won't re-push it
      if (activeSession) {
        lsMarkSynced(activeSession.id, variables.questionId);
        setLocalPendingCount(Object.values(lsGetAll(activeSession.id)).filter(v => !v.synced).length);
      }

      // Auto-clear saved status after 2 seconds
      saveTimeoutsRef.current[variables.questionId] = setTimeout(() => {
        setQuestionSaveStatus(prev => ({ ...prev, [variables.questionId]: 'idle' }));
      }, 2000);

      // Invalidate cache to ensure UI stays in sync
      queryClient.invalidateQueries({ 
        queryKey: ['/api/student-answers/session', activeSession?.id] 
      });

    },
    onError: (error: Error, variables) => {
      // Mark as failed and remove from pending
      setQuestionSaveStatus(prev => ({ ...prev, [variables.questionId]: 'failed' }));
      setPendingSaves(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.questionId);
        return newSet;
      });


      // Determine error category and response
      let shouldShowToast = false;
      let shouldAutoRetry = false;
      let userFriendlyMessage = error.message;

      // Network/Connection errors - auto-retry silently
      if (error.message.includes('fetch') || error.message.includes('Network') || 
          error.message.includes('timeout') || error.message.includes('500')) {
        shouldAutoRetry = true;
      }
      // Authentication errors - show to user
      else if (error.message.includes('401') || error.message.includes('session') || 
               error.message.includes('Authentication')) {
        shouldShowToast = true;
        userFriendlyMessage = "Session expired. Please refresh the page.";
      }
      // Permission errors - show to user
      else if (error.message.includes('403') || error.message.includes('Permission')) {
        shouldShowToast = true;
        userFriendlyMessage = "Permission denied. Contact your instructor.";
      }
      // Validation errors - silent (user sees status indicator)
      else if (error.message.includes('Please select') || error.message.includes('Please enter') ||
               error.message.includes('validation') || error.message.includes('Invalid')) {
      }
      // Unknown errors - show after multiple failures
      else {
        const failCount = Object.values(questionSaveStatus).filter(s => s === 'failed').length;
        if (failCount > 2) {
          shouldShowToast = true;
          userFriendlyMessage = "Having trouble saving. Please check your connection.";
        } else {
          shouldAutoRetry = true;
        }
      }

      if (shouldShowToast) {
        toast({
          title: "Save Error",
          description: userFriendlyMessage,
          variant: "destructive",
        });
      }
      // Auto-retry logic for recoverable errors
      if (shouldAutoRetry && answers[variables.questionId] && isOnline) {
        const retryDelay = 2000; // 2 second delay for retries

        setTimeout(() => {
          if (isOnline && answers[variables.questionId]) {
            handleRetryAnswer(variables.questionId, variables.questionType);
          }
        }, retryDelay);
      }
    },
  });

  // Shared submission helper - handles retry logic, response parsing, and error handling
  // Used by both regular submit and force submit (auto-submit on violations)
  const executeSubmission = async (isForceSubmit: boolean = false) => {
    // Use refs for force submit to ensure latest values, state for regular submit
    const session = isForceSubmit ? activeSessionRef.current : activeSession;
    const violations = isForceSubmit ? tabSwitchCountRef.current : tabSwitchCount;
    const penalty = isForceSubmit ? violationPenaltyRef.current : violationPenalty;
    const remaining = isForceSubmit ? timeRemainingRef.current : timeRemaining;
    
    if (!session) throw new Error('No active session');

    const startTime = Date.now();
    const maxRetries = 3;
    let lastError: Error | null = null;

    // Retry loop for network resilience
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Determine submission reason based on context
        const timeExpired = remaining !== null && remaining <= 0;
        let submissionReason: 'manual' | 'timeout' | 'violation' = 'manual';
        if (isForceSubmit) {
          if (violations && violations >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
            submissionReason = 'violation';
          } else if (timeExpired) {
            submissionReason = 'timeout';
          }
        }

        // Use the synchronous submit endpoint with violation info and submission reason
        // Ensure clientTimeRemaining is always numeric (fallback to 0)
        const response = await apiRequest('POST', `/api/exams/${session.examId}/submit`, {
          forceSubmit: isForceSubmit,
          violationCount: violations ?? 0,
          violationPenalty: penalty ?? 0,
          clientTimeRemaining: remaining ?? 0,
          submissionReason
        });

        // Handle response
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
          let errorMessage = 'Failed to submit exam';
          
          if (contentType?.includes('application/json')) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
              
              // If already submitted, treat as success
              if (response.status === 409 || errorMessage.includes('already submitted')) {
                return { 
                  submitted: true, 
                  alreadySubmitted: true,
                  message: 'Exam was previously submitted.',
                  result: errorData.result || null,
                  isForceSubmit
                };
              }
            } catch (parseError) {
              errorMessage = `Server error (${response.status})`;
            }
          } else {
            errorMessage = `Server error (${response.status}). Please try again.`;
          }
          
          // Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500 && response.status !== 408) {
            throw new Error(errorMessage);
          }
          
          lastError = new Error(errorMessage);
          
          // Wait before retry with exponential backoff
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Success - parse response
        let submissionData;
        try {
          submissionData = await response.json();
        } catch (parseError) {
          throw new Error('Invalid response from server. Your exam may have been submitted - please refresh to check.');
        }
        
        const totalTime = Date.now() - startTime;

        // Send performance metrics to server (fire and forget)
        apiRequest('POST', '/api/performance-events', {
          sessionId: session.id,
          eventType: 'submission',
          duration: totalTime,
          metadata: {
            examId: session.examId,
            clientSide: true,
            timestamp: new Date().toISOString(),
            attempts: attempt,
            isForceSubmit
          }
        }).catch(() => {});

        return { ...submissionData, clientPerformance: { totalTime, attempts: attempt }, isForceSubmit };
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a network error that warrants retry
        const isNetworkError = error.name === 'TypeError' || 
                                error.name === 'AbortError' ||
                                error.message?.includes('fetch') ||
                                error.message?.includes('network') ||
                                error.message?.includes('timeout');
        
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Non-retryable error or max retries reached
        throw error;
      }
    }
    
    // All retries exhausted
    throw lastError || new Error('Failed to submit exam after multiple attempts');
  };

  // MILESTONE 1: Synchronous Submit Exam Mutation - No Polling, Instant Feedback!
  // Uses shared executeSubmission helper for consistent behavior
  const submitExamMutation = useMutation({
    mutationFn: () => executeSubmission(false), // Regular submit
    onMutate: () => {
      setIsScoring(true);
    },
    onSuccess: (data) => {
      setIsScoring(false);

      // Clear locally-stored answers, violation backup, and the left-exam markers — exam is done
      if (activeSession) lsClear(activeSession.id);
      if (activeSession) lsViolationClear(activeSession.id);
      try { localStorage.removeItem('exam_left_marker'); } catch (_) {}
      try { sessionStorage.removeItem('exam_session_active'); } catch (_) {}
      setLocalPendingCount(0);

      // Enhanced cache invalidation for all related data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/student-answers/session', activeSession?.id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/exam-results', user?.id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/exam-sessions', activeSession?.id] 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });

      // Build redirect message based on result
      const score = data.result?.score ?? 0;
      const maxScore = data.result?.maxScore ?? 0;
      const percentage = data.result?.percentage ?? 0;
      
      let message: string;
      let variant: 'default' | 'destructive' = 'default';
      
      if (data.submitted && data.result) {
        if (data.alreadySubmitted) {
          message = `Your exam was already submitted. Score: ${score}/${maxScore} (${percentage}%). Viewing results...`;
        } else if (data.timedOut) {
          message = `Time expired. Your exam was auto-submitted. Score: ${score}/${maxScore} (${percentage}%). Redirecting...`;
          variant = 'destructive';
        } else {
          message = `Congratulations! You scored ${score}/${maxScore} (${percentage}%). Redirecting to results...`;
        }
      } else if (data.submitted && !data.result) {
        message = "Your exam has been submitted. Results will be available after manual grading.";
      } else {
        message = data.message || "Your exam has been submitted successfully. Viewing results...";
      }
      
      // Redirect to exam results page with result data
      redirectToExamResults(data.result || { submitted: true, submissionReason: 'manual' }, message, variant);
    },
    onError: (error: Error) => {
      setIsScoring(false);
      setIsSubmitting(false);

      // Handle specific error types for better user experience
      let errorTitle = "Submission Error";
      let errorDescription = error.message;
      let shouldResetSession = false;

      // Check if error is HTML response (server crash)
      if (error.message.includes('<!DOCTYPE') || error.message.includes('Unexpected token') || error.message.includes('JSON')) {
        errorTitle = "Server Error";
        errorDescription = "The server encountered an error while processing your submission. Your answers have been saved. Please try submitting again.";
      }
      // Check for specific error types that can happen with synchronous submission
      else if (error.message.includes('already submitted') || error.message.includes('Exam already submitted')) {
        errorTitle = "Already Submitted";
        errorDescription = "This exam has already been submitted. Redirecting to results...";
        shouldResetSession = true;

        // Try to get existing results
        setTimeout(() => {
          setActiveSession(null);
          setAnswers({});
          setTimeRemaining(null);
          setCurrentQuestionIndex(0);
          setSelectedExam(null);
        }, 2000);

      } else if (error.message.includes('No active exam session') || error.message.includes('Session not found')) {
        errorTitle = "Session Expired";
        errorDescription = "Your exam session has expired or could not be found. Please start the exam again.";
        shouldResetSession = true;

        setTimeout(() => {
          setActiveSession(null);
          setAnswers({});
          setTimeRemaining(null);
          setCurrentQuestionIndex(0);
          setSelectedExam(null);
        }, 2000);

      } else if (error.message.includes('Server error') || error.message.includes('Failed to submit exam') || error.message.includes('500')) {
        errorTitle = "Server Error";
        errorDescription = "A server error occurred. Your answers are saved. Please try submitting again in a moment.";
      } else if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        errorTitle = "Connection Error";
        errorDescription = "Network connection failed. Please check your internet connection and try again.";
      } else if (error.message.includes('timeout')) {
        errorTitle = "Request Timeout";
        errorDescription = "The submission request timed out. Your answers are saved. Please try again.";
      }
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: shouldResetSession ? "default" : "destructive",
        duration: 8000, // Show longer for critical errors
      });
    },
  });

  const handleStartExam = (exam: Exam) => {
    // Payment gate: block if fee required and not paid
    if (exam.paymentRequired && !exam.hasPaid) {
      toast({
        title: "Exam Fee Required",
        description: `Pay your exam fee (₦${(exam.feeAmount ?? 0).toLocaleString()}) to unlock this exam.`,
        variant: "destructive",
      });
      setLocation("/portal/student/exam-payment");
      return;
    }

    // Comprehensive validation checks
    if (!exam.id) {
      toast({
        title: "Error",
        description: "Invalid exam selected. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: "Authentication Required", 
        description: "Please log in again to start the exam.",
        variant: "destructive",
      });
      return;
    }
    if (!exam.isPublished) {
      toast({
        title: "Exam Not Available",
        description: "This exam is not yet published. Please check with your instructor.",
        variant: "destructive",
      });
      return;
    }
    // Check if already has an active session
    if (activeSession && !activeSession.isCompleted) {
      toast({
        title: "Active Session Detected",
        description: "You already have an active exam session. Complete it first before starting a new exam.",
        variant: "destructive",
      });
      return;
    }
    // Check if student already submitted this exam (via sessionStorage flag)
    const existingSubmissions = Object.keys(sessionStorage).filter(key => 
      key.startsWith('exam_submitted_') && sessionStorage.getItem(key) === 'true'
    );
    if (existingSubmissions.length > 0) {
      toast({
        title: "Exam Already Completed",
        description: "You have already submitted an exam. View your results instead.",
      });
      // Redirect to results page
      setLocation('/portal/student/exam-results');
      return;
    }
    // Pre-flight check: confirm exam has questions
    toast({
      title: "Preparing Your Exam",
      description: "Setting up your exam session. Please wait a moment...",
    });

    setSelectedExam(exam);

    // Reset all state for clean start
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTimeRemaining(null);
    setTabSwitchCount(0); // Reset tab switch counter
    setViolationPenalty(0); // Reset penalty
    setQuestionSaveStatus({});
    setPendingSaves(new Set());
    setShowTabSwitchWarning(false); // Hide any previous warnings

    startExamMutation.mutate(exam.id);
  };

  // Debounce timer ref for answer changes
  const debounceTimersRef = useRef<Record<number, NodeJS.Timeout>>({});

  const handleAnswerChange = (questionId: number, answer: any, questionType: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Always save to localStorage immediately as a device-level backup
    if (activeSession) {
      lsSave(activeSession.id, questionId, answer, questionType);
      if (!isOnline) {
        setLocalPendingCount(prev => {
          const local = lsGetAll(activeSession.id);
          return Object.values(local).filter(v => !v.synced).length;
        });
      }
    }

    // Clear existing debounce timer for this question
    if (debounceTimersRef.current[questionId]) {
      clearTimeout(debounceTimersRef.current[questionId]);
    }
    // Immediately mark as ready to save (visual feedback)
    setQuestionSaveStatus(prev => ({ ...prev, [questionId]: 'idle' }));

    // Debounce the actual save (500ms delay for typing)
    debounceTimersRef.current[questionId] = setTimeout(() => {
      const validation = validateAnswer(questionType, answer);
      if (validation.isValid) {
        // Check if this is actually a new/changed answer
        const existingAnswer = existingAnswers.find(a => a.questionId === questionId);
        const isNewAnswer = !existingAnswer || 
          (questionType === 'multiple_choice' ? existingAnswer.selectedOptionId !== answer : existingAnswer.textAnswer !== answer);

        if (isNewAnswer) {
          submitAnswerMutation.mutate({ questionId, answer, questionType });
        }
      }
    }, 500); // 500ms debounce for text input, instant for MC
  };

  // Save session progress periodically
  useEffect(() => {
    if (activeSession && timeRemaining !== null) {
      const interval = setInterval(() => {
        if (activeSession.id) {
          apiRequest('PATCH', `/api/exam-sessions/${activeSession.id}/progress`, {
            currentQuestionIndex,
            timeRemaining,
            tabSwitchCount, // Save tab switch count and penalty
            violationPenalty
          }).catch(error => {
          });
        }
      }, 30000); // Save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [activeSession, currentQuestionIndex, timeRemaining, tabSwitchCount, violationPenalty]);

  const handleRetryAnswer = (questionId: number, questionType: string) => {
    const answer = answers[questionId];
    if (answer) {
      submitAnswerMutation.mutate({ questionId, answer, questionType });
    }
  };

  // Centralized redirect to exam results page with result data handoff
  const redirectToExamResults = (resultData: any, message?: string, variant: 'default' | 'destructive' = 'default') => {
    // Prevent multiple redirects
    if (isRedirecting) return;
    setIsRedirecting(true);
    
    // STEP 1: Clear all timers and pending operations first
    Object.values(saveTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    Object.values(debounceTimersRef.current).forEach(timeout => clearTimeout(timeout));
    if (tabSwitchTimeoutRef.current) clearTimeout(tabSwitchTimeoutRef.current);
    saveTimeoutsRef.current = {};
    debounceTimersRef.current = {};
    tabSwitchTimeoutRef.current = null;
    
    // STEP 2: Store exam result in sessionStorage for the results page to consume
    if (resultData) {
      // Find the exam title and subject from the exams list
      const currentExam = exams.find(e => e.id === activeSession?.examId) || selectedExam;
      // Find the subject name using the exam's subjectId
      const examSubject = subjects.find(s => s.id === currentExam?.subjectId);
      const storedResult = {
        ...resultData,
        examTitle: currentExam?.name || resultData.examTitle || 'Exam',
        subjectName: examSubject?.name || resultData.subjectName || null,
        examId: activeSession?.examId || selectedExam?.id,
        sessionId: activeSession?.id,
        submittedAt: resultData.submittedAt || new Date().toISOString(),
        storedTimestamp: Date.now(),
      };
      sessionStorage.setItem('lastExamResult', JSON.stringify(storedResult));
    }
    
    // STEP 3: Invalidate cache (use user ID for proper cache isolation)
    queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
    queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/exam-results', user?.id] });
    
    // STEP 4: Reset exam state completely (prevent inline UI from showing)
    try { localStorage.removeItem('exam_left_marker'); } catch (_) {}
    if (activeSession?.id) lsViolationClear(activeSession.id);
    setShowResults(false);
    setExamResults(null);
    setActiveSession(null);
    setAnswers({});
    setTimeRemaining(null);
    setCurrentQuestionIndex(0);
    setSelectedExam(null);
    setTabSwitchCount(0);
    setViolationPenalty(0);
    setQuestionSaveStatus({});
    setPendingSaves(new Set());
    setShowTabSwitchWarning(false);
    setIsSubmitting(false);
    setIsScoring(false);
    
    // STEP 5: Show message
    if (message) {
      toast({
        title: variant === 'destructive' ? "Exam Auto-Submitted" : "Exam Submitted",
        description: message,
        variant,
      });
    }
    
    // STEP 6: Navigate to results page with exam ID for strict matching
    const examId = resultData?.examId || activeSessionRef.current?.examId;
    const url = examId ? `/portal/student/exam-results?examId=${examId}` : '/portal/student/exam-results';
    setLocation(url);
  };

  // Handle returning to exam list after viewing results
  const handleBackToExams = () => {
    // Reset all exam-related state
    setShowResults(false);
    setExamResults(null);
    setActiveSession(null);
    setAnswers({});
    setTimeRemaining(null);
    setCurrentQuestionIndex(0);
    setSelectedExam(null);
    setTabSwitchCount(0);
    setViolationPenalty(0);
    setQuestionSaveStatus({});
    setPendingSaves(new Set());
    setShowTabSwitchWarning(false);
    
    // Refresh exam list to show updated submission status (use user ID for proper cache isolation)
    queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
    queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/exam-results', user?.id] });
    
    // Show confirmation message
    toast({
      title: "Results Saved",
      description: "Your exam results have been recorded. You can view them anytime from your dashboard.",
    });
  };

  // Force submit without checking pending saves (used for auto-submit on timeout or violations)
  // Uses shared executeSubmission helper with retry logic and consistent behavior
  // CRITICAL: Includes retry mechanism to ensure exam is submitted on security violations
  const forceSubmitExam = async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds between retries
    
    if (isSubmitting || isScoring || isRedirecting) {
      return;
    }
    setIsSubmitting(true);
    setIsScoring(true);

    try {
      // Use shared submission helper with force flag for consistent behavior
      const data = await executeSubmission(true);
      
      // Verify submission was successful by checking the response
      if (!data || (!data.submitted && !data.result)) {
        throw new Error('Submission response invalid - server did not confirm submission');
      }
      
      setIsScoring(false);
      setIsSubmitting(false);
      isAutoSubmittingRef.current = false; // Reset the auto-submit flag
      
      // Enhanced cache invalidation
      queryClient.invalidateQueries({ queryKey: ['/api/student-answers/session', activeSessionRef.current?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
      
      // Determine the appropriate message based on the submission context
      const violations = violationCountRef.current;
      const timeExpired = timeRemainingRef.current !== null && timeRemainingRef.current <= 0;
      const score = data.result?.score ?? 0;
      const maxScore = data.result?.maxScore ?? 0;
      const percentage = data.result?.percentage ?? 0;
      
      // Build redirect message based on submission reason
      let message: string;
      let variant: 'default' | 'destructive' = 'default';
      
      // Prepare result data with submission reason
      const resultData = {
        ...data.result,
        submissionReason: violations >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT ? 'violation' : (timeExpired ? 'timeout' : 'manual'),
        violationCount: violations,
      };
      
      if (violations >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
        message = `Your exam was automatically submitted due to ${violations} security violation(s). Score: ${score}/${maxScore} (${percentage}%). Redirecting to results...`;
        variant = 'destructive';
      } else if (timeExpired) {
        message = `Your exam time has ended. Score: ${score}/${maxScore} (${percentage}%). Redirecting to results...`;
        variant = 'destructive';
      } else if (data.submitted && !data.result) {
        message = "Your exam was automatically submitted. Results will be available after manual grading.";
      } else {
        message = `Exam submitted successfully. Score: ${score}/${maxScore} (${percentage}%). Redirecting to results...`;
      }
      
      // Redirect to exam results page with result data
      redirectToExamResults(resultData, message, variant);
      
    } catch (error: any) {
      // RETRY LOGIC: Critical for security - must ensure exam is submitted
      if (retryCount < MAX_RETRIES) {
        console.warn(`Auto-submit attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms...`);
        setIsScoring(false);
        setIsSubmitting(false);
        
        toast({
          title: "Submission in Progress",
          description: `Attempting to submit your exam (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`,
          variant: "default",
        });
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return forceSubmitExam(retryCount + 1);
      }
      
      // All retries exhausted - notify user and try one final time with a direct API call
      setIsScoring(false);
      setIsSubmitting(false);
      
      // Final fallback: Try to submit via direct API call without the mutation
      try {
        if (activeSessionRef.current?.id) {
          const response = await apiRequest('POST', `/api/exam-sessions/${activeSessionRef.current.id}/submit`, {
            answers: Object.entries(answers).map(([qId, answer]) => ({
              questionId: parseInt(qId),
              answer
            })),
            forceSubmit: true,
            submittedAt: new Date().toISOString(),
            violationCount: violationCountRef.current
          });
          
          if (response.ok) {
            toast({
              title: "Exam Submitted",
              description: "Your exam has been submitted. Please check your results.",
              variant: "destructive",
            });
            setLocation('/portal/student/exam-results');
            return;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback submission also failed:', fallbackError);
      }
      
      toast({
        title: "Submission Error - Please Contact Instructor",
        description: `Failed to submit exam after ${MAX_RETRIES + 1} attempts. Your answers have been saved locally. Please contact your instructor immediately.`,
        variant: "destructive",
      });
      
      // Save answers to localStorage as emergency backup
      try {
        localStorage.setItem(`exam_backup_${activeSessionRef.current?.id}`, JSON.stringify({
          answers,
          timestamp: new Date().toISOString(),
          violationCount: violationCountRef.current,
          sessionId: activeSessionRef.current?.id
        }));
      } catch (e) {
        console.error('Failed to save local backup:', e);
      }
    }
  };

  // Regular submit with pending save protection
  const handleSubmitExam = async () => {
    if (hasPendingSaves()) {
      toast({
        title: "Please Wait",
        description: "Some answers are still being saved. Please wait a moment before submitting.",
        variant: "default",
      });
      return;
    }
    setIsSubmitting(true);
    
    try {
      await submitExamMutation.mutateAsync();
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get save status indicator for a question
  const getSaveStatusIndicator = (questionId: number) => {
    const status = questionSaveStatus[questionId] || 'idle';
    const hasAnswer = !!answers[questionId];

    switch (status) {
      case 'saving':
        return (
          <div className="flex items-center space-x-1 text-blue-500">
            <Loader className="w-3 h-3 animate-spin" />
            <span className="text-xs">Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center space-x-1 text-green-500">
            <CheckCircle className="w-3 h-3" />
            <span className="text-xs">Saved ✓</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-1 text-red-500 animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">Save Failed</span>
          </div>
        );
      default:
        return hasAnswer ? (
          <div className="flex items-center space-x-1 text-amber-600">
            <Circle className="w-3 h-3 fill-current" />
            <span className="text-xs">Ready to save</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-gray-400">
            <HelpCircle className="w-3 h-3" />
            <span className="text-xs">No answer</span>
          </div>
        );
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get timer color based on remaining time
  const getTimerColor = (seconds: number) => {
    if (seconds > 600) return 'text-green-600'; // > 10 minutes
    if (seconds > 300) return 'text-yellow-600'; // 5-10 minutes
    return 'text-red-600 animate-pulse'; // < 5 minutes
  };

  // Calculate timer progress percentage for visual indicator
  const getTimerProgress = () => {
    if (!timeRemaining || !selectedExam?.timeLimit) return 100;
    const totalSeconds = selectedExam.timeLimit * 60;
    return (timeRemaining / totalSeconds) * 100;
  };

  // PERFORMANCE: Memoize progress calculation to prevent unnecessary computations
  const progress = useMemo(() => {
    return examQuestions.length > 0 ? ((currentQuestionIndex + 1) / examQuestions.length) * 100 : 0;
  }, [examQuestions.length, currentQuestionIndex]);

  // Calculator helpers
  const calcCompute = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : NaN;
      default: return b;
    }
  };

  const calcFormat = (n: number): string => {
    if (isNaN(n)) return 'Error';
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    // Use toPrecision to avoid floating-point noise, then strip trailing zeros
    const precise = parseFloat(parseFloat(n.toPrecision(10)).toString());
    const str = precise.toString();
    // If too long for display, use exponential
    if (str.replace('-', '').replace('.', '').length > 12) {
      return parseFloat(n.toPrecision(6)).toExponential();
    }
    return str;
  };

  // Calculator logic — full-featured: chaining, repeat =, negate, percent, operator switching
  const handleCalcInput = useCallback((value: string) => {
    // ── Digit / Decimal ──────────────────────────────────────────────────────
    if ((!isNaN(Number(value)) && value.trim() !== '') || value === '.') {
      if (calcWaitingForSecond || calcJustEvaluated) {
        const next = value === '.' ? '0.' : value;
        setCalcDisplay(next);
        setCalcWaitingForSecond(false);
        setCalcJustEvaluated(false);
      } else {
        if (value === '.' && calcDisplay.includes('.')) return;
        setCalcDisplay(prev => {
          if (prev === '0' && value !== '.') return value;
          if (prev === '-0') return '-' + value;
          // Limit to 12 significant digits
          const digits = prev.replace(/[^0-9]/g, '');
          if (digits.length >= 12) return prev;
          return prev + value;
        });
      }
      return;
    }

    // ── Operators ────────────────────────────────────────────────────────────
    if (['+', '-', '×', '÷'].includes(value)) {
      const currentNum = parseFloat(calcDisplay);
      if (calcWaitingForSecond) {
        // Just switch the pending operator (no calculation yet)
        setCalcOperator(value);
        setCalcExpression(prev => prev.replace(/\s*[+\-×÷]\s*$/, '') + ` ${value} `);
        return;
      }
      if (calcPrevValue !== null && calcOperator && !calcJustEvaluated) {
        // Chain: compute the pending operation first
        const result = calcCompute(calcPrevValue, currentNum, calcOperator);
        const resultStr = calcFormat(result);
        setCalcDisplay(resultStr);
        setCalcPrevValue(isNaN(result) ? null : result);
        setCalcExpression(`${resultStr} ${value} `);
      } else {
        setCalcPrevValue(isNaN(currentNum) ? 0 : currentNum);
        setCalcExpression(`${calcDisplay} ${value} `);
      }
      setCalcOperator(value);
      setCalcWaitingForSecond(true);
      setCalcJustEvaluated(false);
      setCalcLastOperator(null);
      return;
    }

    // ── Equals ───────────────────────────────────────────────────────────────
    if (value === '=') {
      if (calcPrevValue !== null && calcOperator) {
        // Normal calculation
        const currentNum = parseFloat(calcDisplay);
        const result = calcCompute(calcPrevValue, currentNum, calcOperator);
        const resultStr = calcFormat(result);
        setCalcExpression(`${calcPrevValue} ${calcOperator} ${calcDisplay} =`);
        setCalcDisplay(resultStr);
        // Save for repeat-= feature
        setCalcLastOperator(calcOperator);
        setCalcLastOperand(currentNum);
        setCalcPrevValue(null);
        setCalcOperator(null);
        setCalcWaitingForSecond(false);
        setCalcJustEvaluated(true);
      } else if (calcJustEvaluated && calcLastOperator && calcLastOperand !== null) {
        // Repeat last operation (e.g. 5+3=8, =11, =14…)
        const currentNum = parseFloat(calcDisplay);
        const result = calcCompute(currentNum, calcLastOperand, calcLastOperator);
        const resultStr = calcFormat(result);
        setCalcExpression(`${calcDisplay} ${calcLastOperator} ${calcLastOperand} =`);
        setCalcDisplay(resultStr);
        setCalcJustEvaluated(true);
      }
      return;
    }

    // ── Clear ────────────────────────────────────────────────────────────────
    if (value === 'C') {
      setCalcDisplay('0');
      setCalcExpression('');
      setCalcPrevValue(null);
      setCalcOperator(null);
      setCalcWaitingForSecond(false);
      setCalcLastOperator(null);
      setCalcLastOperand(null);
      setCalcJustEvaluated(false);
      return;
    }

    // ── Negate (±) ───────────────────────────────────────────────────────────
    if (value === '±') {
      setCalcDisplay(prev => {
        if (prev === '0' || prev === 'Error') return prev;
        return prev.startsWith('-') ? prev.slice(1) : '-' + prev;
      });
      return;
    }

    // ── Percent ──────────────────────────────────────────────────────────────
    if (value === '%') {
      const num = parseFloat(calcDisplay);
      if (!isNaN(num)) {
        // If inside an operation, calculate as % of prevValue (e.g. 200 + 10% = 220)
        const pct = calcPrevValue !== null && (calcOperator === '+' || calcOperator === '-')
          ? calcPrevValue * (num / 100)
          : num / 100;
        setCalcDisplay(calcFormat(pct));
        setCalcJustEvaluated(false);
      }
      return;
    }

    // ── Backspace ────────────────────────────────────────────────────────────
    if (value === '⌫') {
      if (calcJustEvaluated) { setCalcDisplay('0'); setCalcJustEvaluated(false); return; }
      setCalcDisplay(prev => (prev.length <= 1 || (prev.startsWith('-') && prev.length <= 2)) ? '0' : prev.slice(0, -1));
      return;
    }
  }, [calcDisplay, calcExpression, calcPrevValue, calcOperator, calcWaitingForSecond,
      calcLastOperator, calcLastOperand, calcJustEvaluated]);

  if (!user) {
    return <div>Please log in to access the exam portal.</div>;
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
    return roleMap[roleId] || 'student';
  };

  // Render active exam without PortalLayout wrapper
  if (activeSession && examQuestions.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-[120px] sm:pt-[140px] select-none">
        <ExamHeader
          subjectName={subjectName}
          className={studentClassName}
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={examQuestions.length}
          timeRemaining={timeRemaining}
          studentName={studentName}
          studentInitials={studentInitials}
          profileImageUrl={user?.profileImageUrl}
        />

        <div className="container mx-auto px-4 pb-12 max-w-4xl">
          {/* Warning Banners */}
          {(showTabSwitchWarning || !isOnline) && (
            <div className="mb-6 space-y-2">
              {showTabSwitchWarning && (
                <div className={`border-l-4 rounded-r-lg p-3 flex items-center gap-3 shadow-sm ${
                  violationCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-600 text-red-800 dark:text-red-200'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-800 dark:text-yellow-200'
                }`}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {violationCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT
                        ? `🚨 WARNING ${Math.min(violationCount, MAX_WARNINGS_ALLOWED)} of ${MAX_WARNINGS_ALLOWED} — Exam is being auto-submitted!`
                        : `⚠️ WARNING ${Math.min(violationCount, MAX_WARNINGS_ALLOWED)} of ${MAX_WARNINGS_ALLOWED} — ${Math.max(0, MAX_WARNINGS_ALLOWED - violationCount)} more violation(s) before auto-submit`
                      }
                    </p>
                    <p className="text-xs mt-0.5">
                      {violationCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT
                        ? 'Your exam has been submitted automatically due to repeated violations.'
                        : 'Stay on this page. Switching tabs, reloading, or navigating away counts as a violation.'
                      }
                    </p>
                  </div>
                </div>
              )}
              {!isOnline && (
                <div className="bg-red-600 dark:bg-red-700 rounded-lg p-3 flex items-center gap-3 text-white shadow-md">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">You are offline</p>
                    <p className="text-xs opacity-90 mt-0.5">
                      {localPendingCount > 0
                        ? `${localPendingCount} answer${localPendingCount !== 1 ? 's' : ''} saved on this device — will auto-sync when reconnected`
                        : 'Your answers are saved on this device and will sync automatically when reconnected'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-semibold bg-white/20 rounded px-2 py-1">
                      {localPendingCount > 0 ? `${localPendingCount} pending` : 'All saved'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exam Content - Responsive */}
          <div className="max-w-5xl mx-auto py-4 sm:py-6 md:py-8">

            {/* Question Card - Responsive */}
            {currentQuestion && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-gray-700 shadow-md p-5 sm:p-7 md:p-9 mb-6">
                <div className="mb-5 sm:mb-7">
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                      Question {currentQuestionIndex + 1}
                    </h3>
                    <span className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">
                      {currentQuestion.points} points
                    </span>
                  </div>
                  <p className="text-base sm:text-lg md:text-xl text-gray-800 dark:text-gray-200 leading-relaxed">
                    {currentQuestion.questionText}
                  </p>
                </div>

                {/* Multiple Choice Options */}
                {currentQuestion.questionType === 'multiple_choice' && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value, 'multiple_choice')}
                    className="space-y-4"
                  >
                    {questionOptions.map((option: any, index: number) => (
                      <div
                        key={option.id}
                        className={`border rounded-lg p-4 sm:p-5 cursor-pointer transition-colors ${
                          answers[currentQuestion.id] === String(option.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem
                            value={String(option.id)}
                            id={`option-${option.id}`}
                            className="mt-1"
                            data-testid={`option-${index}`}
                          />
                          <Label
                            htmlFor={`option-${option.id}`}
                            className="cursor-pointer flex-1 text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed"
                          >
                            {String.fromCharCode(65 + index)}. {option.optionText}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* Text/Essay Answer */}
                {(currentQuestion.questionType === 'text' || currentQuestion.questionType === 'essay') && (
                  <Textarea
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value, currentQuestion.questionType)}
                    rows={currentQuestion.questionType === 'essay' ? 10 : 5}
                    className="text-base sm:text-lg md:text-xl"
                    data-testid="text-answer"
                  />
                )}

                {/* Save Status */}
                {questionSaveStatus[currentQuestion.id] === 'saving' && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </div>
                )}
                {questionSaveStatus[currentQuestion.id] === 'saved' && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    Saved
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  const currentAnswer = answers[currentQuestion.id];
                  if (currentAnswer && validateAnswer(currentQuestion.questionType, currentAnswer).isValid) {
                    const existingAnswer = existingAnswers.find(a => a.questionId === currentQuestion.id);
                    const isNewAnswer = !existingAnswer || 
                      (currentQuestion.questionType === 'multiple_choice' ? existingAnswer.selectedOptionId !== currentAnswer : existingAnswer.textAnswer !== currentAnswer);
                    if (isNewAnswer) {
                      submitAnswerMutation.mutate({ questionId: currentQuestion.id, answer: currentAnswer, questionType: currentQuestion.questionType });
                    }
                  }
                  setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
                }}
                disabled={currentQuestionIndex === 0}
                className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg md:text-xl border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950"
                data-testid="button-previous"
              >
                ← Previous
              </Button>

              {currentQuestionIndex === examQuestions.length - 1 ? (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting || hasPendingSaves() || isScoring}
                  className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg md:text-xl bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                  data-testid="button-submit-exam"
                >
                  {isScoring ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Submit Exam
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const currentAnswer = answers[currentQuestion.id];
                    if (currentAnswer && validateAnswer(currentQuestion.questionType, currentAnswer).isValid) {
                      const existingAnswer = existingAnswers.find(a => a.questionId === currentQuestion.id);
                      const isNewAnswer = !existingAnswer || 
                        (currentQuestion.questionType === 'multiple_choice' ? existingAnswer.selectedOptionId !== currentAnswer : existingAnswer.textAnswer !== currentAnswer);
                      if (isNewAnswer) {
                        submitAnswerMutation.mutate({ questionId: currentQuestion.id, answer: currentAnswer, questionType: currentQuestion.questionType });
                      }
                    }
                    setCurrentQuestionIndex(prev => Math.min(examQuestions.length - 1, prev + 1));
                  }}
                  disabled={currentQuestionIndex === examQuestions.length - 1}
                  className="px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg md:text-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                  data-testid="button-next"
                >
                  Next →
                </Button>
              )}
            </div>

            {/* Question Grid - Small and at bottom */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Quick Navigation</p>
              <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-2">
                {examQuestions.map((q, idx) => {
                  const isAnswered = answers[q.id];
                  const isCurrent = idx === currentQuestionIndex;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const currentAnswer = answers[currentQuestion.id];
                        if (currentAnswer && validateAnswer(currentQuestion.questionType, currentAnswer).isValid) {
                          const existingAnswer = existingAnswers.find(a => a.questionId === currentQuestion.id);
                          const isNewAnswer = !existingAnswer || 
                            (currentQuestion.questionType === 'multiple_choice' ? existingAnswer.selectedOptionId !== currentAnswer : existingAnswer.textAnswer !== currentAnswer);
                          if (isNewAnswer) {
                            submitAnswerMutation.mutate({ questionId: currentQuestion.id, answer: currentAnswer, questionType: currentQuestion.questionType });
                          }
                        }
                        setCurrentQuestionIndex(idx);
                      }}
                      className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                        isCurrent 
                          ? 'bg-blue-600 text-white' 
                          : isAnswered 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                      }`}
                      data-testid={`nav-question-${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Calculator */}
          {showCalculator && (
            <div
              className="fixed bottom-24 right-4 z-50 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden select-none"
              data-testid="calculator-panel"
            >
              {/* Calculator Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 dark:bg-blue-700">
                <div className="flex items-center gap-2 text-white">
                  <Calculator className="w-4 h-4" />
                  <span className="text-sm font-semibold">Calculator</span>
                </div>
                <button
                  onClick={() => setShowCalculator(false)}
                  className="text-white/80 hover:text-white transition-colors"
                  data-testid="button-close-calculator"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Display */}
              <div className="px-4 pt-3 pb-3 bg-gray-900 dark:bg-gray-950">
                <div className="text-right text-xs text-gray-400 h-5 mb-1 truncate">
                  {calcExpression || '\u00A0'}
                </div>
                <div
                  className={`text-right font-mono font-bold text-white truncate transition-all ${
                    calcDisplay.length > 10 ? 'text-xl' : calcDisplay.length > 7 ? 'text-2xl' : 'text-4xl'
                  }`}
                  data-testid="calc-display"
                >
                  {calcDisplay}
                </div>
              </div>

              {/* Buttons */}
              <div className="p-3 grid grid-cols-4 gap-1.5">
                {([
                  { label: calcDisplay === '0' && !calcPrevValue ? 'AC' : 'C', key: 'C',  type: 'fn' },
                  { label: '±',  key: '±',  type: 'fn' },
                  { label: '%',  key: '%',  type: 'fn' },
                  { label: '÷',  key: '÷',  type: 'op' },
                  { label: '7',  key: '7',  type: 'num' },
                  { label: '8',  key: '8',  type: 'num' },
                  { label: '9',  key: '9',  type: 'num' },
                  { label: '×',  key: '×',  type: 'op' },
                  { label: '4',  key: '4',  type: 'num' },
                  { label: '5',  key: '5',  type: 'num' },
                  { label: '6',  key: '6',  type: 'num' },
                  { label: '-',  key: '-',  type: 'op' },
                  { label: '1',  key: '1',  type: 'num' },
                  { label: '2',  key: '2',  type: 'num' },
                  { label: '3',  key: '3',  type: 'num' },
                  { label: '+',  key: '+',  type: 'op' },
                  { label: '0',  key: '0',  type: 'num', wide: true },
                  { label: '.',  key: '.',  type: 'num' },
                  { label: '=',  key: '=',  type: 'eq' },
                ] as { label: string; key: string; type: string; wide?: boolean }[]).map(({ label, key, type, wide }) => {
                  const isActiveOp = type === 'op' && calcOperator === key && calcWaitingForSecond;
                  const baseClass = wide ? 'col-span-2 text-left pl-5' : '';
                  const typeClass =
                    type === 'fn'  ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500' :
                    type === 'op'  ? isActiveOp
                      ? 'bg-white dark:bg-white text-blue-600 dark:text-blue-600 hover:bg-gray-100'
                      : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-400 dark:hover:bg-blue-500'
                    : type === 'eq' ? 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-500 dark:hover:bg-blue-600'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600';
                  return (
                    <button
                      key={key}
                      onClick={() => handleCalcInput(key)}
                      className={`${baseClass} ${typeClass} rounded-2xl py-3.5 text-base font-semibold transition-all duration-100 active:scale-95 shadow-sm`}
                      data-testid={`calc-btn-${key === '+' ? 'plus' : key === '-' ? 'minus' : key === '×' ? 'multiply' : key === '÷' ? 'divide' : key}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calculator Toggle Button */}
          <button
            onClick={() => setShowCalculator(prev => !prev)}
            className={`fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95 ${
              showCalculator
                ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-blue-300 dark:shadow-blue-900'
                : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
            }`}
            title={showCalculator ? 'Hide Calculator' : 'Open Calculator'}
            data-testid="button-toggle-calculator"
          >
            <Calculator className="w-6 h-6" />
          </button>

          {/* Custom Submit Confirmation Dialog */}
          <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  Submit Exam
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    You have answered <span className="font-bold text-blue-600 dark:text-blue-400">{Object.keys(answers).length}</span> out of <span className="font-bold text-blue-600 dark:text-blue-400">{examQuestions.length}</span> questions.
                  </p>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to submit your exam? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitDialog(false)}
                  className="border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  data-testid="button-cancel-submit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowSubmitDialog(false);
                    handleSubmitExam();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                  data-testid="button-confirm-submit"
                >
                  Yes, Submit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }
  // Render main portal view
  if (showResults && examResults) {
    const normalizedResults = {
      score: examResults.totalScore || examResults.score || 0,
      maxScore: examResults.maxScore || 0,
      percentage: 0,
      pendingCount: examResults.pendingReview?.count || 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalAnswered: 0,
      autoScoredQuestions: 0,
      submittedAt: examResults.submittedAt,
      timeTakenFormatted: examResults.timeTakenFormatted || null,
      timeTakenSeconds: examResults.timeTakenSeconds || 0,
      submissionReason: examResults.submissionReason || 'manual',
      violationCount: examResults.violationCount || 0,
      breakdown: examResults.breakdown || null,
      questionDetails: examResults.questionDetails || [],
      hasDetailedResults: false
    };

    if (examResults.breakdown) {
      const breakdown = examResults.breakdown;
      normalizedResults.correctAnswers = 'correct' in breakdown ? breakdown.correct : 
                                         ('correctAnswers' in breakdown ? breakdown.correctAnswers : 0);
      normalizedResults.wrongAnswers = 'incorrect' in breakdown ? breakdown.incorrect : 
                                        ('incorrectAnswers' in breakdown ? breakdown.incorrectAnswers : 0);
      normalizedResults.totalAnswered = 'totalQuestions' in breakdown ? breakdown.totalQuestions : 
                                         ('answered' in breakdown ? breakdown.answered : 0);
      normalizedResults.autoScoredQuestions = 'autoScored' in breakdown ? breakdown.autoScored : 
                                               ('autoScoredQuestions' in breakdown ? breakdown.autoScoredQuestions : 0);
      normalizedResults.hasDetailedResults = true;
      if (examResults.questionDetails && examResults.questionDetails.length > 0) {
        normalizedResults.questionDetails = examResults.questionDetails;
      }
    } else if (examResults.questionDetails && examResults.questionDetails.length > 0) {
      const questions = examResults.questionDetails;
      normalizedResults.correctAnswers = questions.filter((q: any) => q.isCorrect === true).length;
      normalizedResults.wrongAnswers = questions.filter((q: any) => q.isCorrect === false).length;
      normalizedResults.totalAnswered = questions.length;
      normalizedResults.autoScoredQuestions = questions.filter((q: any) => q.pointsAwarded > 0 || q.isCorrect === true).length;
      normalizedResults.hasDetailedResults = true;
    }

    if (normalizedResults.maxScore > 0) {
      normalizedResults.percentage = Math.round((normalizedResults.score / normalizedResults.maxScore) * 100);
      normalizedResults.percentage = Math.max(0, Math.min(100, normalizedResults.percentage));
    }
    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - normalizedResults.percentage / 100);

    return (
      <div className="p-6 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Exam Results</h1>
            <p className="text-slate-600 dark:text-slate-400">Review your performance details below.</p>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col items-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                      <circle cx="100" cy="100" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="text-blue-600 transition-all duration-1000" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold">{normalizedResults.percentage}%</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-lg font-semibold">{normalizedResults.score} / {normalizedResults.maxScore}</p>
                    <p className="text-sm text-slate-500">Total Score</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>Correct Answers</span>
                    </div>
                    <span className="font-bold">{normalizedResults.correctAnswers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span>Incorrect Answers</span>
                    </div>
                    <span className="font-bold">{normalizedResults.wrongAnswers}</span>
                  </div>
                  {normalizedResults.timeTakenFormatted && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <span>Time Taken</span>
                      </div>
                      <span className="font-bold">{normalizedResults.timeTakenFormatted}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={() => setShowResults(false)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Back to Exams
            </Button>
          </div>
        </div>
    );
  }

  if (isScoring) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold">Scoring Your Exam</h2>
        <p className="text-slate-500">Please wait while we calculate your results...</p>
      </div>
    );
  }

  // Main rendering of the student exams portal
  if (!selectedExam && !activeSession) {
    return (
      <RequireCompleteProfile feature="exams and assessments">
      <div className="p-2 sm:p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight">My Exams</h1>
          </div>
          <p className="text-muted-foreground text-xs">
            View and take your available examinations
          </p>
        </div>

        {loadingExams ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden border-none shadow-sm animate-pulse">
                <div className="h-48 bg-muted" />
              </Card>
            ))}
          </div>
        ) : exams.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Exams Available</h3>
              <p className="text-muted-foreground max-w-sm">
                There are currently no examinations published for your class. Check back later or contact your teacher.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 max-w-3xl">
            {exams.map((exam) => {
              const status = getExamStatus(exam.id);
              const subject = subjects.find(s => s.id === exam.subjectId);
              const isLocked = exam.paymentRequired && !exam.hasPaid && !status.isCompleted;
              
              return (
                <Card 
                  key={exam.id} 
                  className={`group overflow-hidden border shadow-none transition-all duration-300 bg-white dark:bg-card relative rounded-xl ${isLocked ? 'border-red-200 dark:border-red-800 hover:border-red-400/50 opacity-90' : 'border-slate-200 dark:border-slate-800 hover:border-green-400/50'}`}
                  data-testid={`card-exam-${exam.id}`}
                >
                  <div className={`absolute top-4 right-4 ${isLocked ? 'text-red-100 dark:text-red-900/20' : 'text-green-100 dark:text-green-900/20'}`}>
                    {isLocked ? <Lock className="h-8 w-8" /> : <GraduationCap className="h-8 w-8" />}
                  </div>

                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-4">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between">
                        {isLocked ? (
                          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            Fee Required
                          </div>
                        ) : (
                          <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {status.isCompleted ? "Done" : "Available"}
                          </div>
                        )}
                      </div>

                      {/* Exam Title & Date */}
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-black dark:text-white">
                          {exam.name}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {new Date(exam.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-900/30 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100/50 dark:bg-blue-900/30 p-2 rounded-lg">
                            <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Total Marks</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{exam.totalMarks}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="bg-orange-100/50 dark:bg-orange-900/30 p-2 rounded-lg">
                            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Duration</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{exam.timeLimit} min</p>
                          </div>
                        </div>
                      </div>

                      {/* Payment notice for locked exams */}
                      {isLocked && (
                        <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                            <CreditCard className="h-4 w-4 shrink-0" />
                            <span>Exam fee ₦{(exam.feeAmount ?? 0).toLocaleString()} required</span>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-3 text-xs shrink-0"
                            onClick={(e) => { e.stopPropagation(); setLocation("/portal/student/exam-payment"); }}
                            data-testid={`button-pay-fee-${exam.id}`}
                          >
                            Pay Now
                          </Button>
                        </div>
                      )}

                      {/* Action Button */}
                      <Button 
                        onClick={() => status.isCompleted ? setLocation(`/portal/student/exam-results?examId=${exam.id}`) : handleStartExam(exam)}
                        className={`w-full h-9 rounded-md font-medium shadow-none transition-all group/btn text-sm text-white ${isLocked ? 'bg-slate-400 hover:bg-slate-500 cursor-not-allowed' : 'bg-[#3b82f6] hover:bg-blue-700'}`}
                        data-testid={`button-action-${exam.id}`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {isLocked ? <Lock className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {status.isCompleted ? "View Score" : isLocked ? "Locked — Fee Unpaid" : "Start Exam"}
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </RequireCompleteProfile>
    );
  }
}