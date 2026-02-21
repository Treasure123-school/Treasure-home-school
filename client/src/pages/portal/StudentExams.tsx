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
import { Clock, BookOpen, Trophy, Play, Eye, CheckCircle, XCircle, Timer, Save, RotateCcw, AlertCircle, Loader, FileText, Circle, CheckCircle2, HelpCircle, ClipboardCheck, GraduationCap, Award, Calendar } from 'lucide-react';
import type { Exam, ExamSession, ExamQuestion, QuestionOption, StudentAnswer } from '@shared/schema';
import schoolLogo from '@assets/1000025432-removebg-preview (1)_1757796555126.png';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { ExamHeader } from '@/components/ExamHeader';

// ENHANCED EXAM SECURITY CONSTANTS
// Allow only 2 warnings per exam session. On the 3rd violation, auto-submit the exam instantly.
const MAX_WARNINGS_ALLOWED = 2; // Students get 2 warnings
const MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT = 3; // Auto-submit on 3rd violation
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
  
  // RELIABILITY: Use refs to ensure latest values are always accessible for auto-submit
  const violationCountRef = useRef(violationCount);
  const tabSwitchCountRef = useRef(tabSwitchCount);
  const violationPenaltyRef = useRef(violationPenalty);
  const timeRemainingRef = useRef(timeRemaining);
  const activeSessionRef = useRef(activeSession);
  
  // Keep refs in sync with state
  useEffect(() => { violationCountRef.current = violationCount; }, [violationCount]);
  useEffect(() => { tabSwitchCountRef.current = tabSwitchCount; }, [tabSwitchCount]);
  useEffect(() => { violationPenaltyRef.current = violationPenalty; }, [violationPenalty]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  // Network status monitoring
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkIssues, setNetworkIssues] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Socket.IO realtime updates for exams list
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams', 'student-list'],
    enabled: !!user?.id,
    examId: selectedExam?.id,
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

  // Fetch available exams
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

  // Fetch question options for current question
  const { data: questionOptionsRaw = [] } = useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options', currentQuestion?.id],
    enabled: !!currentQuestion?.id && currentQuestion?.questionType === 'multiple_choice',
  });

  // OPTION RANDOMIZATION: Shuffle options if exam has shuffleQuestions enabled
  const questionOptions = useMemo(() => {
    if (!questionOptionsRaw.length || !currentQuestion) return [];

    const exam = exams.find(e => e.id === activeSession?.examId);

    // If shuffleQuestions is enabled, shuffle the options
    if (exam?.shuffleQuestions && !activeSession?.isCompleted && activeSession?.id) {
      // Use seeded random based on session ID + question ID for consistent shuffling
      const seed = activeSession.id + currentQuestion.id;
      let seedValue = seed;
      const seededRandom = () => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
      };

      // Use Fisher-Yates shuffle algorithm with seeded random
      const shuffled = [...questionOptionsRaw];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
    // Otherwise return in original order
    return questionOptionsRaw;
  }, [questionOptionsRaw, currentQuestion, activeSession?.examId, activeSession?.isCompleted, activeSession?.id, exams]);

  // PERFORMANCE: Use bulk endpoint to fetch all question options in single request
  const { data: allQuestionOptions = [] } = useQuery<QuestionOption[]>({
    queryKey: ['/api/question-options/bulk', examQuestions.map(q => q.id).join(',')],
    queryFn: async () => {
      if (!examQuestions.length) return [];

      const mcQuestions = examQuestions.filter(q => q.questionType === 'multiple_choice');
      if (mcQuestions.length === 0) return [];

      const questionIds = mcQuestions.map(q => q.id).join(',');
      const response = await apiRequest('GET', `/api/question-options/bulk?questionIds=${questionIds}`);

      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    enabled: !!examQuestions.length && (showResults || examQuestions.some(q => q.questionType === 'multiple_choice')),
  });

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
        map[answer.questionId] = answer.selectedOptionId;
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
            // Restore session state
            try {
              const metadata = session.metadata ? JSON.parse(session.metadata) : {};
              if (metadata.currentQuestionIndex) {
                setCurrentQuestionIndex(metadata.currentQuestionIndex);
              }
              // Restore tab switch count and penalty if they were saved in metadata
              if (metadata.tabSwitchCount !== undefined) {
                setTabSwitchCount(metadata.tabSwitchCount);
                const calculatedPenalty = calculateViolationPenalty(metadata.tabSwitchCount);
                setViolationPenalty(calculatedPenalty);
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

      // Recover timer from session if available (silently)
      if (activeSession.timeRemaining !== null && activeSession.timeRemaining !== undefined) {
        setTimeRemaining(activeSession.timeRemaining);
      } else if (exam?.timeLimit && activeSession.startedAt) {
        // Calculate remaining time based on start time
        const elapsedSeconds = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);
        const totalSeconds = exam.timeLimit * 60;
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);
        setTimeRemaining(remaining);
      }
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
      toast({
        title: "Connection Restored",
        description: "Your internet connection has been restored. Retrying failed saves...",
        variant: "default",
      });

      // Retry any failed saves
      Object.keys(answers).forEach(questionId => {
        const qId = parseInt(questionId);
        if (questionSaveStatus[qId] === 'failed') {
          const question = examQuestions.find(q => q.id === qId);
          if (question) {
            handleRetryAnswer(qId, question.questionType);
          }
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkIssues(true);
      toast({
        title: "Connection Lost",
        description: "Your internet connection was lost. Answers will be saved when connection is restored.",
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
  const handleSecurityViolation = useCallback((type: ViolationType, details?: string) => {
    if (!activeSession || activeSession.isCompleted || isAutoSubmittingRef.current) return;
    
    // Update violation count and history
    setViolationCount(prev => {
      const newCount = prev + 1;
      
      // Record this violation
      const violationRecord: ViolationRecord = {
        type,
        timestamp: new Date(),
        details
      };
      setViolationHistory(history => [...history, violationRecord]);
      setLastViolationType(type);
      
      // Update penalty
      const calculatedPenalty = calculateViolationPenalty(newCount);
      setViolationPenalty(calculatedPenalty);
      
      // Also update tabSwitchCount for backward compatibility
      if (type === 'tab_switch' || type === 'browser_minimize') {
        setTabSwitchCount(tc => tc + 1);
      }
      
      // Save violation to session metadata
      if (activeSession?.id) {
        apiRequest('PATCH', `/api/exam-sessions/${activeSession.id}/metadata`, {
          metadata: JSON.stringify({
            violationCount: newCount,
            violationPenalty: calculatedPenalty,
            lastViolationType: type,
            violationHistory: [...violationHistory, violationRecord].slice(-10) // Keep last 10
          })
        }).catch(() => {});
      }
      
      // Get violation type display name
      const violationNames: Record<ViolationType, string> = {
        'tab_switch': 'Tab Switch',
        'browser_minimize': 'Browser Minimized',
        'devtools': 'DevTools Detected',
        'refresh_attempt': 'Refresh/Back Attempt',
        'duplicate_session': 'Duplicate Session',
        'screenshot': 'Screenshot Attempt',
        'copy_paste': 'Copy/Paste Attempt'
      };
      
      // CHECK IF AUTO-SUBMIT REQUIRED (3rd violation)
      if (newCount >= MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT) {
        isAutoSubmittingRef.current = true;
        
        toast({
          title: "EXAM AUTO-SUBMITTED",
          description: `Your exam has been automatically submitted due to ${newCount} security violations. This is to maintain exam integrity.`,
          variant: "destructive",
        });
        
        // Trigger auto-submit immediately
        setTimeout(() => {
          forceSubmitExam();
        }, 500);
        
        return newCount;
      }
      
      // Show warning for 1st and 2nd violations
      setShowViolationWarning(true);
      setShowTabSwitchWarning(true);
      
      // Auto-hide warning after 5 seconds
      if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
      violationTimeoutRef.current = setTimeout(() => {
        setShowViolationWarning(false);
        setShowTabSwitchWarning(false);
      }, 5000);
      
      const warningsRemaining = MAX_WARNINGS_ALLOWED - newCount + 1;
      
      if (newCount === 1) {
        toast({
          title: `WARNING 1 of ${MAX_WARNINGS_ALLOWED}: ${violationNames[type]}`,
          description: `This is your first warning. You have ${warningsRemaining - 1} more warning(s) before your exam is auto-submitted. Please stay focused on the exam.`,
          variant: "destructive",
        });
      } else if (newCount === 2) {
        toast({
          title: `FINAL WARNING: ${violationNames[type]}`,
          description: `This is your LAST warning! One more violation will automatically submit your exam. Stay on the exam page.`,
          variant: "destructive",
        });
      }
      
      return newCount;
    });
  }, [activeSession, violationHistory, toast]);

  // =============================================================================
  // COMPREHENSIVE EXAM SECURITY SYSTEM
  // Detects: Tab switching, Browser minimize, DevTools, Refresh/Back, Duplicate sessions
  // =============================================================================

  // 1. TAB SWITCH & BROWSER MINIMIZE DETECTION
  useEffect(() => {
    if (!activeSession || activeSession.isCompleted) return;

    let visibilityTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
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
      if (!document.hidden) {
        visibilityTimer = setTimeout(() => {
          if (!document.hasFocus()) {
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-[120px] sm:pt-[140px]">
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
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg p-3 flex items-center gap-3 text-yellow-800 dark:text-yellow-200 shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {violationCount < MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT 
                        ? `Security Warning ${violationCount}/${MAX_WARNINGS_ALLOWED} - ${MAX_VIOLATIONS_BEFORE_AUTO_SUBMIT - violationCount} violation(s) until auto-submit`
                        : `EXAM AUTO-SUBMITTED: ${violationCount} violations detected`
                      }
                    </p>
                    <p className="text-xs mt-0.5">Stay on this page. Any violation will be recorded and may auto-submit your exam.</p>
                  </div>
                </div>
              )}
              {!isOnline && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg p-3 flex items-center gap-3 text-red-800 dark:text-red-200 shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Connection Lost</p>
                    <p className="text-xs mt-0.5">Your answers are being saved locally and will sync when connection is restored</p>
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
              
              return (
                <Card 
                  key={exam.id} 
                  className="group overflow-hidden border border-slate-200 dark:border-slate-800 shadow-none hover:border-green-400/50 transition-all duration-300 bg-white dark:bg-card relative rounded-xl"
                  data-testid={`card-exam-${exam.id}`}
                >
                  <div className="absolute top-4 right-4 text-green-100 dark:text-green-900/20">
                    <GraduationCap className="h-8 w-8" />
                  </div>

                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-4">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between">
                        <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {status.isCompleted ? "Done" : "Available"}
                        </div>
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

                      {/* Action Button */}
                      <Button 
                        onClick={() => status.isCompleted ? setLocation(`/portal/student/exam-results?examId=${exam.id}`) : handleStartExam(exam)}
                        className="w-full h-9 bg-[#3b82f6] hover:bg-blue-700 text-white rounded-md font-medium shadow-none transition-all group/btn text-sm"
                        data-testid={`button-action-${exam.id}`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Eye className="h-4 w-4" />
                          {status.isCompleted ? "View Score" : "Start Exam"}
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
    );
  }
}