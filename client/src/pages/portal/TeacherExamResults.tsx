import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Download, 
  Users, 
  TrendingUp, 
  Award, 
  FileText, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Loader2,
  RotateCcw,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'wouter';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Class, ExamResult, Exam, Subject } from '@shared/schema';

interface EnrichedExamResult extends ExamResult {
  studentName?: string;
  studentUsername?: string;
  admissionNumber?: string | null;
  testScore?: number | null;
}

interface SyncStatusData {
  byStudent: Record<string, { status: string; syncedAt: string | null; errorMessage: string | null; retryCount: number }>;
  summary: { synced: number; pending: number; failed: number; retrying: number; total: number };
}

interface EditableScore {
  resultId: number;
  testScore: number | null;
  remarks: string;
}

export default function TeacherExamResults() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute('/portal/teacher/results/exam/:examId');
  const examId = params?.examId ? parseInt(params.examId) : null;
  const [editingScores, setEditingScores] = useState<Map<number, EditableScore>>(new Map());
  const [syncingResults, setSyncingResults] = useState<Set<number>>(new Set());
  const [allowingRetake, setAllowingRetake] = useState<Set<number>>(new Set());
  const [retakeConfirmDialog, setRetakeConfirmDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    resultId: number;
  } | null>(null);

  if (!user) {
    return <div>Loading...</div>;
  }

  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
  });

  const currentExam = exams.find((e) => e.id === examId);

  const { data: rawExamResults = [], isLoading, refetch } = useQuery<EnrichedExamResult[]>({
    queryKey: ['/api/exam-results/exam', examId],
    enabled: !!examId,
  });
  
  // Normalize exam results to ensure consistent score/maxScore values
  // This fixes display issues with legacy data where maxScore might be null
  const examResults = rawExamResults.map(result => ({
    ...result,
    score: result.score ?? 0,
    maxScore: result.maxScore ?? currentExam?.totalMarks ?? 60 // Default to exam's total marks or 60
  }));

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
  });

  // Fetch sync status for this exam's results
  const { data: syncStatusData, refetch: refetchSyncStatus } = useQuery<SyncStatusData>({
    queryKey: ['/api/teacher/exams', examId, 'sync-status'],
    enabled: !!examId,
  });

  // Helper to get sync status for a student
  const getSyncStatus = (studentId: string): { status: string; syncedAt: string | null; errorMessage: string | null } | null => {
    return syncStatusData?.byStudent?.[studentId] ?? null;
  };

  useSocketIORealtime({
    table: 'exam_results',
    queryKey: ['/api/exam-results/exam', examId ?? 0],
    enabled: !!examId,
    onEvent: (event) => {
      console.log('[Exam Results] Result update received', event.eventType);
      refetch();
    }
  });

  const updateScoreMutation = useMutation({
    mutationFn: async ({ resultId, testScore, remarks }: { resultId: number; testScore: number | null; remarks?: string }) => {
      const response = await apiRequest('PATCH', `/api/teacher/exam-results/${resultId}`, {
        testScore,
        remarks
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update score');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Score Updated",
        description: "Test score has been saved successfully.",
      });
      setEditingScores((prev) => {
        const next = new Map(prev);
        next.delete(variables.resultId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results/exam', examId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncToReportCardMutation = useMutation({
    mutationFn: async ({ resultId }: { resultId: number }) => {
      setSyncingResults((prev) => new Set(prev).add(resultId));
      const response = await apiRequest('POST', `/api/teacher/exam-results/${resultId}/sync-reportcard`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync to report card');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Synced to Report Card",
        description: "Result has been synced to the student's report card.",
      });
      setSyncingResults((prev) => {
        const next = new Set(prev);
        next.delete(variables.resultId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results/exam', examId] });
      refetchSyncStatus();
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
      setSyncingResults((prev) => {
        const next = new Set(prev);
        next.delete(variables.resultId);
        return next;
      });
      refetchSyncStatus();
    },
  });

  // Bulk sync all results to report cards
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const syncAllToReportCardsMutation = useMutation({
    mutationFn: async () => {
      setIsSyncingAll(true);
      const response = await apiRequest('POST', `/api/teacher/exams/${examId}/sync-all-to-reportcards`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync all to report cards');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "All Results Synced",
        description: `Successfully synced ${data.synced} results to report cards.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
      setIsSyncingAll(false);
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results/exam', examId] });
      refetchSyncStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Sync Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsSyncingAll(false);
      refetchSyncStatus();
    },
  });

  const allowRetakeMutation = useMutation({
    mutationFn: async ({ studentId }: { studentId: string; resultId: number }) => {
      const response = await apiRequest('POST', `/api/teacher/exams/${examId}/allow-retake/${studentId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to allow retake');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Retake Allowed",
        description: "The student can now retake this exam. Their previous submission has been archived.",
      });
      setAllowingRetake((prev) => {
        const next = new Set(prev);
        next.delete(variables.resultId);
        return next;
      });
      setRetakeConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results/exam', examId] });
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Failed to Allow Retake",
        description: error.message,
        variant: "destructive",
      });
      setAllowingRetake((prev) => {
        const next = new Set(prev);
        next.delete(variables.resultId);
        return next;
      });
      setRetakeConfirmDialog(null);
    },
  });

  const subject = subjects.find((s) => s.id === currentExam?.subjectId);
  const examClass = classes.find((c) => c.id === currentExam?.classId);

  // Helper function to calculate combined scores - test score (max 40) + exam score (max 60) = 100 total
  const calculateCombinedScores = (result: EnrichedExamResult) => {
    const testMaxScore = 40;
    const examMaxScore = result.maxScore ?? 60;
    const totalMaxScore = testMaxScore + examMaxScore;
    const totalScore = (result.testScore ?? 0) + (result.score ?? 0);
    const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    return { testMaxScore, examMaxScore, totalMaxScore, totalScore, percentage };
  };

  const totalSubmissions = examResults.length;
  const averageScore = totalSubmissions > 0
    ? examResults.reduce((sum: number, r) => sum + calculateCombinedScores(r).totalScore, 0) / totalSubmissions
    : 0;
  
  const averagePercentage = totalSubmissions > 0
    ? examResults.reduce((sum: number, r) => sum + calculateCombinedScores(r).percentage, 0) / totalSubmissions
    : 0;

  // Show exam scores (out of 60) in the score range, not total scores
  const highestScore = totalSubmissions > 0
    ? Math.max(...examResults.map((r) => r.score ?? 0))
    : 0;

  const lowestScore = totalSubmissions > 0
    ? Math.min(...examResults.map((r) => r.score ?? 0))
    : 0;

  const passCount = examResults.filter((r) => calculateCombinedScores(r).percentage >= 50).length;

  const failCount = totalSubmissions - passCount;

  // Sort by combined total score instead of just exam score
  const sortedResults = [...examResults].sort((a, b) => calculateCombinedScores(b).totalScore - calculateCombinedScores(a).totalScore);

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-green-600' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-500' };
    if (percentage >= 70) return { grade: 'B', color: 'text-blue-500' };
    if (percentage >= 60) return { grade: 'C', color: 'text-yellow-500' };
    if (percentage >= 50) return { grade: 'D', color: 'text-orange-500' };
    return { grade: 'F', color: 'text-red-500' };
  };

  const handleTestScoreChange = (resultId: number, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    setEditingScores((prev) => {
      const next = new Map(prev);
      const existing = prev.get(resultId) || { resultId, testScore: null, remarks: '' };
      next.set(resultId, { ...existing, testScore: isNaN(numValue as number) ? null : numValue });
      return next;
    });
  };

  const handleSaveTestScore = (resultId: number) => {
    const editData = editingScores.get(resultId);
    if (editData) {
      updateScoreMutation.mutate({
        resultId,
        testScore: editData.testScore,
        remarks: editData.remarks
      });
    }
  };

  const handleSyncToReportCard = (resultId: number) => {
    syncToReportCardMutation.mutate({ resultId });
  };

  const handleAllowRetakeClick = (result: EnrichedExamResult) => {
    setRetakeConfirmDialog({
      isOpen: true,
      studentId: result.studentId,
      studentName: result.studentName || 'Unknown Student',
      resultId: result.id,
    });
  };

  const handleConfirmRetake = () => {
    if (retakeConfirmDialog) {
      setAllowingRetake((prev) => new Set(prev).add(retakeConfirmDialog.resultId));
      allowRetakeMutation.mutate({
        studentId: retakeConfirmDialog.studentId,
        resultId: retakeConfirmDialog.resultId,
      });
    }
  };

  const downloadResults = () => {
    if (!currentExam || examResults.length === 0) return;

    const csvContent = [
      ['Student Name', 'Username', 'Admission No.', 'Test Score', 'Exam Score', 'Total Score', 'Max Score', 'Percentage', 'Grade', 'Submitted At'].join(','),
      ...sortedResults.map((result) => {
        const { totalScore, totalMaxScore, percentage } = calculateCombinedScores(result);
        const { grade } = getGrade(percentage);
        return [
          `"${result.studentName || 'Unknown Student'}"`,
          result.studentUsername || result.studentId,
          result.admissionNumber || '-',
          result.testScore ?? 0,
          result.score ?? 0,
          totalScore,
          totalMaxScore,
          percentage.toFixed(1) + '%',
          grade,
          result.createdAt ? format(new Date(result.createdAt), 'PPpp') : 'N/A'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentExam.name}_results.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!currentExam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Exam Not Found</h2>
        <p className="text-muted-foreground mb-4">The exam you're looking for could not be found.</p>
        <Button variant="outline" asChild>
          <Link href="/portal/teacher/recent-exam-results">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" size="sm" asChild data-testid="button-back" className="w-fit">
            <Link href="/portal/teacher/recent-exam-results">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-exam-title">{currentExam.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-exam-info">
              {subject?.name || 'Subject'} • {examClass?.name || 'Class'} • {currentExam.date ? format(new Date(currentExam.date), 'MMMM do, yyyy') : 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => syncAllToReportCardsMutation.mutate()} 
            disabled={totalSubmissions === 0 || isSyncingAll} 
            data-testid="button-sync-all"
            variant="outline"
            className="w-full sm:w-auto"
          >
            {isSyncingAll ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isSyncingAll ? 'Syncing...' : 'Sync All to Report Cards'}
          </Button>
          <Button onClick={downloadResults} disabled={totalSubmissions === 0} data-testid="button-download" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Download Results
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card data-testid="card-total-submissions">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Total Submissions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-submissions">{totalSubmissions}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-average-score">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-average-score">
                {averageScore.toFixed(1)} / {currentExam.totalMarks || 100}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground" data-testid="text-average-percentage">
                {averagePercentage.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-pass-fail">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-500" />
                Pass/Fail Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="flex gap-4 sm:gap-6">
                <div>
                  <div className="text-lg sm:text-xl font-bold text-green-600" data-testid="text-pass-count">{passCount}</div>
                  <p className="text-xs text-muted-foreground">Passed</p>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-red-600" data-testid="text-fail-count">{failCount}</div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-score-range">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                Score Range
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="flex gap-4 sm:gap-6">
                <div>
                  <div className="text-lg sm:text-xl font-bold" data-testid="text-highest-score">{highestScore}</div>
                  <p className="text-xs text-muted-foreground">Highest</p>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold" data-testid="text-lowest-score">{lowestScore}</div>
                  <p className="text-xs text-muted-foreground">Lowest</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg">Student Results</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {isLoading ? (
              <div className="text-center py-6 sm:py-8">
                <p className="text-muted-foreground text-sm">Loading results...</p>
              </div>
            ) : totalSubmissions === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm">No submissions yet</p>
              </div>
            ) : (
              <>
                <div className="block sm:hidden space-y-3">
                  {sortedResults.map((result, index) => {
                    const { totalScore, totalMaxScore, percentage } = calculateCombinedScores(result);
                    const { grade, color } = getGrade(percentage);
                    const isPassed = percentage >= 50;
                    const isSyncing = syncingResults.has(result.id);

                    return (
                      <div 
                        key={result.id} 
                        className="border rounded-lg p-3 bg-muted/30"
                        data-testid={`card-result-mobile-${index}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={index < 3 ? "default" : "outline"} className="text-xs" data-testid={`badge-rank-mobile-${index}`}>
                                #{index + 1}
                              </Badge>
                              <span className="font-semibold text-sm" data-testid={`text-student-name-mobile-${index}`}>
                                {result.studentName || 'Unknown Student'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span data-testid={`text-student-username-mobile-${index}`}>
                                @{result.studentUsername || result.studentId}
                              </span>
                              {result.admissionNumber && (
                                <>
                                  <span>|</span>
                                  <span data-testid={`text-student-adm-mobile-${index}`}>
                                    Adm: {result.admissionNumber}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isPassed ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-muted-foreground">Exam Score</span>
                            <p className="font-medium" data-testid={`text-score-mobile-${index}`}>
                              {result.score ?? 0}/{result.maxScore ?? 60}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Percentage</span>
                            <p className="font-medium" data-testid={`text-percentage-mobile-${index}`}>
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Grade</span>
                            <p className={`font-bold ${color}`} data-testid={`text-grade-mobile-${index}`}>
                              {grade}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end pt-2 border-t">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                data-testid={`button-actions-mobile-${index}`}
                                disabled={isSyncing || allowingRetake.has(result.id)}
                              >
                                {(isSyncing || allowingRetake.has(result.id)) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleSyncToReportCard(result.id)}
                                disabled={isSyncing}
                                data-testid={`button-sync-mobile-${index}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sync to Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAllowRetakeClick(result)}
                                disabled={allowingRetake.has(result.id)}
                                data-testid={`button-retake-mobile-${index}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Allow Retake
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Rank</TableHead>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">Adm. No.</TableHead>
                        <TableHead className="text-xs hidden lg:table-cell">Test Score</TableHead>
                        <TableHead className="text-xs">Exam Score</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                        <TableHead className="text-xs hidden lg:table-cell">Percentage</TableHead>
                        <TableHead className="text-xs">Grade</TableHead>
                        <TableHead className="text-xs hidden xl:table-cell">Submitted At</TableHead>
                        <TableHead className="text-xs hidden xl:table-cell">Remarks</TableHead>
                        <TableHead className="text-xs">Sync Status</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResults.map((result, index) => {
                        const { totalScore, totalMaxScore, percentage } = calculateCombinedScores(result);
                        const { grade, color } = getGrade(percentage);
                        const isPassed = percentage >= 50;
                        const isSyncing = syncingResults.has(result.id);

                        return (
                          <TableRow key={result.id} data-testid={`row-result-${index}`}>
                            <TableCell className="py-2">
                              <Badge variant={index < 3 ? "default" : "outline"} className="text-xs" data-testid={`badge-rank-${index}`}>
                                #{index + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm py-2" data-testid={`text-student-name-${index}`}>
                              {result.studentName || 'Unknown Student'}
                            </TableCell>
                            <TableCell className="text-xs hidden md:table-cell py-2" data-testid={`text-student-adm-${index}`}>
                              {result.admissionNumber || '-'}
                            </TableCell>
                            <TableCell className="text-xs hidden lg:table-cell py-2" data-testid={`text-test-score-${index}`}>
                              {result.testScore ?? '-'}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm py-2" data-testid={`text-exam-score-${index}`}>
                              {result.score || 0}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm py-2 font-medium" data-testid={`text-total-${index}`}>
                              {totalScore} / {totalMaxScore}
                            </TableCell>
                            <TableCell className="text-xs hidden lg:table-cell py-2" data-testid={`text-percentage-${index}`}>
                              {percentage.toFixed(1)}%
                            </TableCell>
                            <TableCell className="py-2">
                              <span className={`font-bold text-xs sm:text-sm ${color}`} data-testid={`text-grade-${index}`}>
                                {grade}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs hidden xl:table-cell py-2" data-testid={`text-submitted-at-${index}`}>
                              {result.createdAt ? format(new Date(result.createdAt), 'PPp') : 'N/A'}
                            </TableCell>
                            <TableCell className="text-xs hidden xl:table-cell py-2 max-w-[150px] truncate" data-testid={`text-remarks-${index}`} title={result.remarks || '-'}>
                              {result.remarks || '-'}
                            </TableCell>
                            <TableCell className="py-2">
                              {(() => {
                                const syncStatus = getSyncStatus(result.studentId);
                                if (!syncStatus) {
                                  return (
                                    <Badge variant="outline" className="text-xs" data-testid={`badge-sync-${index}`}>
                                      Not Synced
                                    </Badge>
                                  );
                                }
                                if (syncStatus.status === 'success') {
                                  return (
                                    <Badge variant="default" className="text-xs bg-green-600" data-testid={`badge-sync-${index}`}>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Synced
                                    </Badge>
                                  );
                                }
                                if (syncStatus.status === 'pending' || syncStatus.status === 'retrying') {
                                  return (
                                    <Badge variant="secondary" className="text-xs" data-testid={`badge-sync-${index}`}>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      {syncStatus.status === 'retrying' ? 'Retrying' : 'Pending'}
                                    </Badge>
                                  );
                                }
                                if (syncStatus.status === 'failed') {
                                  return (
                                    <Badge variant="destructive" className="text-xs" data-testid={`badge-sync-${index}`} title={syncStatus.errorMessage || 'Sync failed'}>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Failed
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSyncToReportCard(result.id)}
                                  disabled={isSyncing}
                                  title="Sync to Report Card"
                                  data-testid={`button-sync-${index}`}
                                >
                                  {isSyncing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAllowRetakeClick(result)}
                                  disabled={allowingRetake.has(result.id)}
                                  title="Allow Retake"
                                  data-testid={`button-retake-${index}`}
                                >
                                  {allowingRetake.has(result.id) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog 
          open={retakeConfirmDialog?.isOpen ?? false} 
          onOpenChange={(open) => !open && setRetakeConfirmDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Allow Exam Retake</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to allow <strong>{retakeConfirmDialog?.studentName}</strong> to retake this exam?
                <br /><br />
                This will:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Archive their current submission for your records</li>
                  <li>Remove their current result from the exam</li>
                  <li>Allow them to start the exam fresh</li>
                </ul>
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-retake">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmRetake}
                data-testid="button-confirm-retake"
              >
                {allowRetakeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Allow Retake'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
