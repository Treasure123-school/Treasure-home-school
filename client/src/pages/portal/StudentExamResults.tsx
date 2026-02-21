import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trophy, 
  FileText, 
  Calendar, 
  AlertCircle, 
  ArrowLeft, 
  GraduationCap,
  Timer,
  Target,
  BarChart3,
  Loader,
  BookOpen
} from 'lucide-react';

interface ExamResult {
  id?: number;
  sessionId?: number;
  examId?: number;
  studentId?: number;
  score: number;
  totalScore?: number;
  maxScore: number;
  percentage?: number;
  submittedAt?: string;
  timeTakenSeconds?: number;
  timeTakenFormatted?: string;
  submissionReason?: 'manual' | 'timeout' | 'violation';
  violationCount?: number;
  examTitle?: string;
  subjectName?: string;
  correct_answers: number | null;
  incorrect_answers: number | null;
  total_questions: number | null;
  time_taken: number | null;
  submitted_at: string | null;
  breakdown?: {
    correct: number;
    incorrect: number;
    totalQuestions: number;
    autoScored: number;
  };
  questionDetails?: Array<{
    questionId: number;
    questionText: string;
    isCorrect: boolean | null;
    pointsAwarded: number;
    maxPoints: number;
    studentAnswer?: string;
    correctAnswer?: string;
  }>;
  exam?: {
    id: number;
    title: string;
    description?: string;
    subjectId?: number;
    classId?: number;
    timeLimit?: number;
  };
  reportCardSync?: {
    synced: boolean;
    message: string;
  };
}

export default function StudentExamResults() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [latestResult, setLatestResult] = useState<ExamResult | null>(null);
  
  // STRICT MATCHING: Get examId from URL query parameter
  // When student clicks "View Score" on a specific exam, we pass the examId
  // This ensures we show ONLY the score for that exact exam - no cross-pollination
  const urlParams = new URLSearchParams(window.location.search);
  const specificExamId = urlParams.get('examId') ? parseInt(urlParams.get('examId')!) : null;
  
  // Check sessionStorage for the most recent exam result - ONLY in fallback mode
  // STRICT MODE completely bypasses sessionStorage to prevent cross-pollination
  useEffect(() => {
    // STRICT MODE: Never use sessionStorage when a specific examId is requested
    // This ensures we only show the exact exam result the student clicked on
    if (specificExamId) {
      setLatestResult(null); // Clear any stale data
      return;
    }
    
    const storedResult = sessionStorage.getItem('lastExamResult');
    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult);
        setLatestResult(parsed);
      } catch (e) {
        console.error('Failed to parse stored exam result:', e);
      }
    }
  }, [specificExamId]);

  // STRICT ENDPOINT: Fetch a SINGLE exam result for the specific exam
  // Uses /api/exam-results/student/:examId which does strict matching:
  // WHERE exam_id = :examId AND student_id = :currentStudentId
  const { 
    data: specificResult, 
    isLoading: isLoadingSpecific, 
    error: specificError 
  } = useQuery<ExamResult>({
    queryKey: ['/api/exam-results/student', specificExamId],
    queryFn: async () => {
      if (!user?.id || !specificExamId) throw new Error('Missing parameters');
      const response = await apiRequest('GET', `/api/exam-results/student/${specificExamId}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[StudentExamResults] Strict API error:', response.status, errorText);
        throw new Error('Failed to fetch exam result');
      }
      return await response.json();
    },
    enabled: !!user?.id && !!specificExamId,
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0,
    retry: 2,
  });

  // FALLBACK: Fetch ALL exam results only when no specific examId is provided
  // This is used for the general "Exam History" view
  const { data: examResults = [], isLoading: isLoadingAll, error: allError, refetch } = useQuery<ExamResult[]>({
    queryKey: ['/api/exam-results', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await apiRequest('GET', '/api/exam-results');
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[StudentExamResults] API error:', response.status, errorText);
        throw new Error('Failed to fetch exam results');
      }
      const results = await response.json();
      return results;
    },
    enabled: !!user?.id && !specificExamId, // Only fetch all if no specific examId
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Determine loading state based on which mode we're in
  const isLoading = specificExamId ? isLoadingSpecific : isLoadingAll;
  const error = specificExamId ? specificError : allError;

  // Clear sessionStorage when API confirms the result is saved (prevents duplicate on refresh)
  useEffect(() => {
    if (latestResult && examResults.length > 0) {
      const apiHasLatest = examResults.some(r => 
        r.sessionId === latestResult.sessionId || 
        (r.examId === latestResult.examId && r.submittedAt)
      );
      if (apiHasLatest) {
        // Clear the result data - API has confirmed persistence
        sessionStorage.removeItem('lastExamResult');
      }
    }
  }, [latestResult, examResults]);

  // STRICT MODE: When specificExamId is provided, we ONLY show that exact result
  // This prevents any cross-pollination of scores between different exams/subjects
  // NO FALLBACK TO ANY OTHER DATA SOURCE - only specificResult or empty
  const allResults = useMemo(() => {
    // STRICT MODE: Only show the specific exam result, NO fallbacks allowed
    if (specificExamId) {
      // If we have the result, show it. If not (loading/error), show nothing
      return specificResult ? [specificResult] : [];
    }
    
    // FALLBACK MODE (no examId in URL): Show all results with latestResult priority
    if (!latestResult) return examResults;
    
    // Check if latestResult is already in API results (by sessionId or matching timestamp)
    const isDuplicate = examResults.some(r => 
      r.sessionId === latestResult.sessionId ||
      (r.examId === latestResult.examId && 
       Math.abs(new Date(r.submittedAt || 0).getTime() - new Date(latestResult.submittedAt || 0).getTime()) < 60000)
    );
    
    if (isDuplicate) {
      // API has this result, use API version but keep order
      return examResults;
    }
    
    // Add latestResult at the beginning
    return [latestResult, ...examResults];
  }, [latestResult, examResults, specificExamId, specificResult]);

  const selectedResult = useMemo(() => {
    // STRICT MODE: Only use specificResult, NO fallbacks to other data sources
    if (specificExamId) {
      return specificResult || null; // Return null if no result (loading/error)
    }
    
    // FALLBACK MODE (no examId in URL): Prioritize latestResult for immediate display
    if (latestResult && !selectedResultId) return latestResult;
    if (!selectedResultId) return allResults[0] || null;
    return allResults.find(r => r.id === selectedResultId) || allResults[0] || null;
  }, [selectedResultId, allResults, latestResult, specificExamId, specificResult]);

  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 90) return { label: 'Outstanding', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
    if (percentage >= 80) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    if (percentage >= 70) return { label: 'Very Good', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
    if (percentage >= 60) return { label: 'Good', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
    if (percentage >= 50) return { label: 'Fair', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
    return { label: 'Needs Improvement', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  };

  const getSubmissionTypeInfo = (reason?: string, violations?: number) => {
    if (reason === 'violation') {
      return { 
        label: `Auto-Submitted (${violations || 0} Violations)`, 
        color: 'text-red-600', 
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: AlertCircle 
      };
    }
    if (reason === 'timeout') {
      return { 
        label: 'Auto-Submitted (Time Expired)', 
        color: 'text-orange-600', 
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        icon: Timer 
      };
    }
    return { 
      label: 'Submitted Manually', 
      color: 'text-green-600', 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      icon: CheckCircle 
    };
  };

  // STRICT MODE: Show loading when fetching specific exam result
  // FALLBACK MODE: Show loading only if we don't have latestResult from sessionStorage
  if (isLoading && (specificExamId || !latestResult)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="w-12 h-12 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">
            {specificExamId ? 'Loading exam score...' : 'Loading your exam results...'}
          </p>
        </div>
      </div>
    );
  }

  // STRICT MODE: Error or no result for specific exam - show specific message
  // FALLBACK MODE: Show no results if we don't have latestResult AND API returned empty
  if ((error || allResults.length === 0) && (specificExamId || !latestResult)) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Exam Results</h1>
            <p className="text-sm text-muted-foreground">View your exam scores and performance</p>
          </div>
        </div>
        
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {specificExamId ? 'No Result Found for This Exam' : 'No Exam Results Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {specificExamId 
                ? 'You have not completed this specific exam yet, or no result was recorded.'
                : "You haven't completed any exams yet."
              }
            </p>
            <Button onClick={() => setLocation('/portal/student/exams')} data-testid="button-go-to-exams">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Exams
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = selectedResult;
  if (!result) return null;

  const percentage = result.percentage || Math.round((result.score / result.maxScore) * 100) || 0;
  const performance = getPerformanceLevel(percentage);
  const submissionInfo = getSubmissionTypeInfo(result.submissionReason, result.violationCount);
  const SubmissionIcon = submissionInfo.icon;

  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Exam Results</h1>
          <p className="text-sm text-muted-foreground">View your exam scores and performance</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="text-center mb-6" data-testid="banner-result-success">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 ${performance.bgColor} rounded-full flex items-center justify-center`}>
              <Trophy className={`w-10 h-10 ${performance.color}`} />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {result.examTitle || result.exam?.title || 'Exam'} - Results
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Your exam has been successfully submitted and scored.
          </p>
          {result.reportCardSync && (
            <div className="mt-3 flex justify-center">
              <Badge 
                variant={result.reportCardSync.synced ? "default" : "outline"}
                className={`px-3 py-1 ${result.reportCardSync.synced ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300' : ''}`}
                data-testid="badge-report-card-sync"
              >
                <GraduationCap className="w-3 h-3 mr-1" />
                {result.reportCardSync.synced 
                  ? 'Score synced to report card' 
                  : result.reportCardSync.message || 'Report card sync pending'}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-gray-800 shadow-lg" data-testid="card-score-overview">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Score Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48">
                  <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 200 200">
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className={`${percentage >= 60 ? 'text-green-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white" data-testid="text-percentage">
                      {percentage}%
                    </div>
                    <div className={`text-sm font-medium ${performance.color}`} data-testid="text-performance">
                      {performance.label}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-score">
                    {result.score} / {result.maxScore}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Points Earned</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-lg" data-testid="card-detailed-stats">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Detailed Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.subjectName && (
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="font-medium text-amber-700 dark:text-amber-300">Exam Subject</span>
                  </div>
                  <span className="text-lg font-bold text-amber-600" data-testid="value-subject">
                    {result.subjectName}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-green-700 dark:text-green-300">Correct Answers</span>
                </div>
                <span className="text-xl font-bold text-green-600" data-testid="value-correct">
                  {result.correct_answers ?? result.breakdown?.correct ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Total Questions</span>
                </div>
                <span className="text-xl font-bold text-blue-600" data-testid="value-total">
                  {result.total_questions ?? result.breakdown?.totalQuestions ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="font-medium text-purple-700 dark:text-purple-300">Submitted At</span>
                </div>
                <span className="text-sm font-medium text-purple-600" data-testid="value-submitted">
                  {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'Just now'}
                </span>
              </div>

              <div className={`flex items-center justify-between p-3 ${submissionInfo.bgColor} rounded-lg`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${submissionInfo.bgColor}`}>
                    <SubmissionIcon className={`w-5 h-5 ${submissionInfo.color}`} />
                  </div>
                  <span className={`font-medium ${submissionInfo.color}`}>Submission Type</span>
                </div>
                <span className={`text-sm font-medium ${submissionInfo.color}`} data-testid="value-submission-type">
                  {submissionInfo.label}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {result.questionDetails && result.questionDetails.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 shadow-lg" data-testid="card-question-breakdown">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Question-by-Question Breakdown
                </div>
                <Badge variant="outline">
                  {result.questionDetails.filter(q => q.isCorrect === true).length} / {result.questionDetails.length} Correct
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {result.questionDetails.map((question, index) => (
                  <div
                    key={question.questionId || index}
                    className={`p-4 rounded-lg border-l-4 ${
                      question.isCorrect === true
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                        : question.isCorrect === false
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                    }`}
                    data-testid={`question-result-${index}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Question {index + 1}
                          </span>
                          {question.isCorrect === true && (
                            <Badge className="bg-green-600 text-white text-xs">Correct</Badge>
                          )}
                          {question.isCorrect === false && (
                            <Badge variant="destructive" className="text-xs">Incorrect</Badge>
                          )}
                          {question.isCorrect === null && (
                            <Badge variant="secondary" className="text-xs">Pending Review</Badge>
                          )}
                        </div>
                        {question.questionText && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-3">
                            {question.questionText}
                          </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div className={`p-2 rounded border ${
                            question.isCorrect === true
                              ? "bg-green-100/50 border-green-200 dark:bg-green-900/10 dark:border-green-800" 
                              : question.isCorrect === false && question.studentAnswer !== "No answer provided"
                              ? "bg-red-100/50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                              : "bg-gray-100/50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-800"
                          }`}>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 block">Your Answer</span>
                            <p className={`text-sm ${
                              question.isCorrect === true 
                                ? "text-green-700 dark:text-green-400" 
                                : question.isCorrect === false && question.studentAnswer !== "No answer provided"
                                ? "text-red-700 dark:text-red-400"
                                : "text-gray-500 dark:text-gray-400"
                            } font-semibold`}>
                              {question.studentAnswer || "No answer provided"}
                            </p>
                          </div>
                          
                          {question.isCorrect !== true && (
                            <div className="p-2 rounded border bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 block">Correct Answer</span>
                              <p className="text-sm text-blue-700 dark:text-blue-400 font-semibold">
                                {question.correctAnswer || "Not available"}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            Points: {question.pointsAwarded}/{question.maxPoints}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/portal/student/exams')}
            className="flex items-center gap-2"
            data-testid="button-view-more-exams"
          >
            <ArrowLeft className="w-4 h-4" />
            View Available Exams
          </Button>
          <Button 
            onClick={() => setLocation('/portal/student')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="button-go-to-dashboard"
          >
            <GraduationCap className="w-4 h-4" />
            Go to Dashboard
          </Button>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>Your results have been saved and will be available in your academic records.</p>
          <p>For any questions, please contact your teacher or school administration.</p>
        </div>
      </div>
    </div>
  );
}
