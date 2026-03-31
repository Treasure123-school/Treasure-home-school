import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  Clock, User, FileText, Award, CheckCircle2, XCircle, Search,
  Save, Loader2, ChevronLeft, ChevronRight, ArrowLeft, BookOpen,
  CheckSquare2, Filter, Bell, BarChart2, AlertCircle, HelpCircle,
  MessageSquare, ListChecks,
} from 'lucide-react';

interface Submission {
  resultId: number;
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  examId: number;
  examName: string;
  classId: number;
  className: string | null;
  subjectId: number;
  subjectName: string | null;
  score: number | null;
  maxScore: number;
  scorePercent: number | null;
  grade: string | null;
  remarks: string | null;
  autoScored: boolean;
  submittedAt: string | null;
  status: 'pending' | 'graded';
  passingScore: number;
  passed: boolean | null;
}

interface QuestionOption { id: number; optionText: string; isCorrect: boolean; orderNumber: number; }
interface QuestionWithAnswer {
  questionId: number;
  questionText: string;
  questionType: string;
  points: number;
  orderNumber: number;
  options: QuestionOption[];
  answer: { textAnswer: string | null; selectedOptionId: number | null; isCorrect: boolean | null; pointsEarned: number; feedbackText: string | null; } | null;
}
interface SubmissionDetail {
  resultId: number;
  examId: number;
  studentId: string;
  sessionId: number | null;
  score: number | null;
  maxScore: number | null;
  grade: string | null;
  remarks: string | null;
  submittedAt: string | null;
  questions: QuestionWithAnswer[];
}
interface Class { id: number; name: string; }
interface Subject { id: number; name: string; }
interface Exam { id: number; name: string; classId: number; subjectId: number; }

type Tab = 'all' | 'pending' | 'graded';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function StatusBadge({ status }: { status: 'pending' | 'graded' }) {
  return status === 'graded'
    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Reviewed</Badge>
    : <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">Pending</Badge>;
}

function QuestionBreakdown({ questions }: { questions: QuestionWithAnswer[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <HelpCircle className="h-8 w-8 opacity-30" />
        <p className="text-sm">No question data available for this submission.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {questions.map((q, i) => {
        const isOpen = openIdx === i;
        const hasAnswer = !!q.answer;
        const correct = q.answer?.isCorrect;
        return (
          <div key={q.questionId} className={`rounded-lg border transition-colors ${isOpen ? 'border-primary/30' : 'border-border'}`}>
            <button
              className="w-full text-left px-3 py-2.5 flex items-center gap-2"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              data-testid={`btn-question-${i}`}
            >
              <span className="text-xs font-bold text-muted-foreground shrink-0">Q{q.orderNumber}</span>
              <span className="flex-1 text-sm font-medium line-clamp-1">{q.questionText}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-xs capitalize hidden sm:inline-flex">{q.questionType.replace('_', ' ')}</Badge>
                <span className="text-xs text-muted-foreground">{q.points}pt</span>
                {hasAnswer && correct === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {hasAnswer && correct === false && <XCircle className="h-4 w-4 text-red-400" />}
                {hasAnswer && correct === null && <AlertCircle className="h-4 w-4 text-amber-400" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                <Separator />
                {/* MCQ options */}
                {q.options && q.options.length > 0 && (
                  <div className="space-y-1">
                    {q.options.map(opt => {
                      const isSelected = q.answer?.selectedOptionId === opt.id;
                      const isCorrectOpt = opt.isCorrect;
                      return (
                        <div key={opt.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isSelected ? (isCorrectOpt ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200') : isCorrectOpt ? 'bg-emerald-50/40' : ''}`}>
                          <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                          <span className={isCorrectOpt ? 'font-medium' : ''}>{opt.optionText}</span>
                          {isCorrectOpt && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Text answer */}
                {q.answer?.textAnswer && (
                  <div className="rounded bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Student Answer:</p>
                    <p className="text-sm whitespace-pre-wrap">{q.answer.textAnswer}</p>
                  </div>
                )}
                {!hasAnswer && (
                  <p className="text-xs text-muted-foreground italic">No answer submitted for this question.</p>
                )}
                {q.answer?.feedbackText && (
                  <div className="rounded bg-blue-50 dark:bg-blue-950/20 p-2">
                    <p className="text-xs text-blue-600 font-medium mb-0.5">Feedback:</p>
                    <p className="text-xs">{q.answer.feedbackText}</p>
                  </div>
                )}
                {hasAnswer && (
                  <p className="text-xs text-muted-foreground">Points earned: <span className="font-semibold">{q.answer!.pointsEarned}/{q.points}</span></p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherGradingQueue() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Filters
  const [tab, setTab] = useState<Tab>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Selection & grading state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [notifyStudent, setNotifyStudent] = useState(false);
  const [selectedBulk, setSelectedBulk] = useState<Set<number>>(new Set());
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Filter lists
  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ['/api/classes'] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });
  const { data: exams = [] } = useQuery<Exam[]>({ queryKey: ['/api/exams'] });

  // Filter exams based on class/subject selection
  const filteredExams = useMemo(() => exams.filter(e => {
    if (classFilter !== 'all' && String(e.classId) !== classFilter) return false;
    if (subjectFilter !== 'all' && String(e.subjectId) !== subjectFilter) return false;
    return true;
  }), [exams, classFilter, subjectFilter]);

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (classFilter !== 'all') p.set('classId', classFilter);
    if (subjectFilter !== 'all') p.set('subjectId', subjectFilter);
    if (examFilter !== 'all') p.set('examId', examFilter);
    return p.toString();
  }, [classFilter, subjectFilter, examFilter]);

  const { data: allSubmissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['/api/teacher/submissions', classFilter, subjectFilter, examFilter],
    queryFn: async () => {
      const url = `/api/teacher/submissions${queryParams ? `?${queryParams}` : ''}`;
      const res = await apiRequest('GET', url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Submission detail
  const { data: detail, isLoading: detailLoading } = useQuery<SubmissionDetail>({
    queryKey: ['/api/teacher/submissions', selectedId, 'detail'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/teacher/submissions/${selectedId}/detail`);
      if (!res.ok) throw new Error('Failed to fetch detail');
      return res.json();
    },
    enabled: selectedId !== null,
  });

  // Filtered & searched submissions
  const displayedSubmissions = useMemo(() => {
    let list = allSubmissions;
    if (tab !== 'all') list = list.filter(s => s.status === (tab === 'graded' ? 'graded' : 'pending'));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.examName.toLowerCase().includes(q) ||
        (s.admissionNumber?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [allSubmissions, tab, search]);

  const pendingCount = allSubmissions.filter(s => s.status === 'pending').length;
  const gradedCount = allSubmissions.filter(s => s.status === 'graded').length;

  // Sync grading form when a submission is selected
  const selectedSub = allSubmissions.find(s => s.resultId === selectedId) ?? null;
  useEffect(() => {
    if (selectedSub) {
      setScore(selectedSub.score !== null ? String(selectedSub.score) : '');
      setFeedback(selectedSub.remarks ?? '');
    }
  }, [selectedId]);

  // Current index in displayed list for prev/next navigation
  const currentIdx = displayedSubmissions.findIndex(s => s.resultId === selectedId);

  const selectSubmission = useCallback((id: number) => {
    setSelectedId(id);
    setShowMobileDetail(true);
  }, []);

  const navigate = useCallback((dir: -1 | 1) => {
    const next = currentIdx + dir;
    if (next >= 0 && next < displayedSubmissions.length) {
      selectSubmission(displayedSubmissions[next].resultId);
    }
  }, [currentIdx, displayedSubmissions, selectSubmission]);

  // Save grade mutation
  const gradeMutation = useMutation({
    mutationFn: async ({ resultId, testScore, remarks }: { resultId: number; testScore: number; remarks: string }) => {
      const res = await apiRequest('PATCH', `/api/teacher/exam-results/${resultId}`, { testScore, remarks });
      if (!res.ok) throw new Error('Failed to save grade');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Grade saved', description: 'The grade has been recorded successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/submissions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to save grade', variant: 'destructive' });
    },
  });

  const handleSaveGrade = () => {
    if (!selectedId || !selectedSub) return;
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > selectedSub.maxScore) {
      toast({ title: 'Invalid score', description: `Score must be between 0 and ${selectedSub.maxScore}`, variant: 'destructive' });
      return;
    }
    if (!feedback.trim()) {
      toast({ title: 'Feedback required', description: 'Please add feedback before saving', variant: 'destructive' });
      return;
    }
    gradeMutation.mutate({ resultId: selectedId, testScore: numScore, remarks: feedback.trim() });
  };

  const scoreNum = parseFloat(score);
  const scorePct = !isNaN(scoreNum) && selectedSub ? Math.round((scoreNum / selectedSub.maxScore) * 100) : null;

  // Bulk mark as reviewed (set score = existing score, remarks = "Reviewed")
  const bulkMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => {
        const sub = allSubmissions.find(s => s.resultId === id);
        return apiRequest('PATCH', `/api/teacher/exam-results/${id}`, {
          testScore: sub?.score ?? 0,
          remarks: 'Reviewed',
        });
      }));
    },
    onSuccess: () => {
      toast({ title: 'Bulk update complete', description: `${selectedBulk.size} submissions marked as reviewed.` });
      setSelectedBulk(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/submissions'] });
    },
    onError: () => toast({ title: 'Error', description: 'Bulk update failed', variant: 'destructive' }),
  });

  const toggleBulk = (id: number) => {
    setSelectedBulk(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!user) return <div className="p-6 text-muted-foreground">Please log in to access this page.</div>;

  // ─── Review Panel ─────────────────────────────────────────────────────────
  const ReviewPanel = () => {
    if (!selectedSub) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
          <ListChecks className="h-12 w-12 opacity-25" />
          <p className="text-sm font-medium">Select a submission to review and grade</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        {/* Panel header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="lg:hidden p-1 rounded hover:bg-muted"
              onClick={() => setShowMobileDetail(false)}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{selectedSub.studentName}</h3>
              {selectedSub.admissionNumber && (
                <p className="text-xs text-muted-foreground font-mono" data-testid="text-admission-review-panel">{selectedSub.admissionNumber}</p>
              )}
              <p className="text-xs text-muted-foreground truncate">{selectedSub.examName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(-1)} disabled={currentIdx <= 0} data-testid="button-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">{currentIdx + 1}/{displayedSubmissions.length}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(1)} disabled={currentIdx >= displayedSubmissions.length - 1} data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b shrink-0">
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs text-muted-foreground">Class</p>
            <p className="text-sm font-medium truncate">{selectedSub.className ?? '—'}</p>
          </div>
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-medium truncate">{selectedSub.subjectName ?? '—'}</p>
          </div>
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs text-muted-foreground">Max Score</p>
            <p className="text-sm font-medium">{selectedSub.maxScore}</p>
          </div>
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-sm font-medium">{formatRelativeTime(selectedSub.submittedAt)}</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Question breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Question Breakdown
              {detailLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h4>
            {detailLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : detail ? (
              <QuestionBreakdown questions={detail.questions} />
            ) : null}
          </div>

          <Separator />

          {/* Grading form */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Award className="h-4 w-4" /> Grade This Submission
            </h4>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="score-input" className="text-xs">Score <span className="text-muted-foreground">(out of {selectedSub.maxScore})</span></Label>
                <Input
                  id="score-input"
                  data-testid="input-score"
                  type="number"
                  min="0"
                  max={selectedSub.maxScore}
                  step="1"
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  placeholder="0"
                  className="h-9 mt-1"
                />
              </div>
              <div className="shrink-0 pb-0.5">
                {scorePct !== null ? (
                  <Badge variant="outline" className={`text-sm px-3 py-1 ${scorePct >= 70 ? 'border-emerald-300 text-emerald-700' : scorePct >= 50 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-600'}`}>
                    {scorePct}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">—%</Badge>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="feedback-input" className="text-xs">Feedback / Comments</Label>
              <Textarea
                id="feedback-input"
                data-testid="textarea-feedback"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Provide constructive feedback to help the student improve…"
                className="mt-1 min-h-[90px] text-sm"
              />
            </div>

            {/* Notify student toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notify-toggle" className="text-sm cursor-pointer">Notify student after grading</Label>
              </div>
              <Switch id="notify-toggle" checked={notifyStudent} onCheckedChange={setNotifyStudent} data-testid="switch-notify" />
            </div>

            <Button
              className="w-full"
              onClick={handleSaveGrade}
              disabled={gradeMutation.isPending || !score}
              data-testid="button-save-grade"
            >
              {gradeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />{selectedSub.status === 'graded' ? 'Update Grade' : 'Save Grade'}</>
              )}
            </Button>

            {/* Grading history */}
            {selectedSub.status === 'graded' && (
              <div className="rounded-lg border border-dashed p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Previous Grade
                </p>
                <p className="text-sm">Score: <span className="font-semibold">{selectedSub.score}/{selectedSub.maxScore}</span></p>
                {selectedSub.grade && <p className="text-sm">Grade: <Badge variant="outline">{selectedSub.grade}</Badge></p>}
                {selectedSub.remarks && <p className="text-xs text-muted-foreground mt-1">{selectedSub.remarks}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="heading-submissions">
            Assessment Review
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Review student exam submissions and assign grades</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-sm border-amber-300 text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {pendingCount} Pending
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-sm border-emerald-300 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {gradedCount} Reviewed
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={classFilter} onValueChange={v => { setClassFilter(v); setExamFilter('all'); }} data-testid="select-class">
              <SelectTrigger className="h-8 text-sm" data-testid="trigger-class"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={v => { setSubjectFilter(v); setExamFilter('all'); }} data-testid="select-subject">
              <SelectTrigger className="h-8 text-sm" data-testid="trigger-subject"><SelectValue placeholder="All Subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={examFilter} onValueChange={setExamFilter} data-testid="select-exam">
              <SelectTrigger className="h-8 text-sm" data-testid="trigger-exam"><SelectValue placeholder="All Exams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {filteredExams.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                data-testid="input-search"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      {selectedBulk.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <CheckSquare2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedBulk.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => bulkMutation.mutate(Array.from(selectedBulk))} disabled={bulkMutation.isPending} data-testid="button-bulk-review">
            {bulkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            Mark Reviewed
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedBulk(new Set())} data-testid="button-bulk-clear">Clear</Button>
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="flex gap-4 min-h-0 flex-1">
        {/* LEFT: Submission list */}
        <div className={`flex flex-col w-full lg:w-[42%] shrink-0 ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-3">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs sm:text-sm" data-testid="tab-all">
                All <Badge variant="secondary" className="ml-1.5 text-xs">{allSubmissions.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 text-xs sm:text-sm" data-testid="tab-pending">
                Pending <Badge variant="secondary" className="ml-1.5 text-xs">{pendingCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="graded" className="flex-1 text-xs sm:text-sm" data-testid="tab-graded">
                Reviewed <Badge variant="secondary" className="ml-1.5 text-xs">{gradedCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-2.5 px-3 border-b shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {displayedSubmissions.length} submission{displayedSubmissions.length !== 1 ? 's' : ''}
                </CardTitle>
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : displayedSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                  <FileText className="h-8 w-8 opacity-25" />
                  <p className="text-sm">No submissions found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {displayedSubmissions.map((sub) => (
                    <div
                      key={sub.resultId}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors border ${selectedId === sub.resultId ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
                      onClick={() => selectSubmission(sub.resultId)}
                      data-testid={`row-submission-${sub.resultId}`}
                    >
                      {/* Bulk checkbox */}
                      <div onClick={e => { e.stopPropagation(); toggleBulk(sub.resultId); }} className="pt-0.5">
                        <Checkbox checked={selectedBulk.has(sub.resultId)} data-testid={`checkbox-bulk-${sub.resultId}`} />
                      </div>
                      {/* Avatar */}
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(sub.studentName)}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{sub.studentName}</span>
                          <StatusBadge status={sub.status} />
                        </div>
                        {sub.admissionNumber && (
                          <p className="text-xs text-muted-foreground font-mono" data-testid={`text-admission-grading-${sub.resultId}`}>{sub.admissionNumber}</p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{sub.examName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(sub.submittedAt)}</span>
                          {sub.score !== null && (
                            <span className="ml-auto font-semibold text-foreground">{sub.score}/{sub.maxScore}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT: Review panel */}
        <Card className={`flex-1 flex flex-col overflow-hidden min-h-[520px] lg:min-h-0 ${showMobileDetail ? 'flex' : 'hidden lg:flex'}`}>
          <ReviewPanel />
        </Card>
      </div>
    </div>
  );
}
