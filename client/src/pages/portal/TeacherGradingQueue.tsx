import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  CheckSquare, 
  Clock, 
  User, 
  FileText, 
  Award,
  AlertCircle,
  CheckCircle,
  BookOpen,
  Filter,
  Search,
  Eye,
  Save,
  Loader
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GradingTask {
  id: number;
  studentId: string;
  studentName: string;
  examId: number;
  examTitle: string;
  questionId: number;
  questionText: string;
  questionType: string;
  maxMarks: number;
  studentAnswer: string;
  submittedAt: string;
  status: 'pending' | 'graded';
  currentScore?: number;
  graderComment?: string;
}
export default function TeacherGradingQueue() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<GradingTask | null>(null);
  const [score, setScore] = useState<string>('');
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded' | 'ai-suggested'>('ai-suggested');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  // Fetch grading tasks
  const { data: tasks = [], isLoading, refetch } = useQuery<GradingTask[]>({
    queryKey: ['/api/grading/tasks', user?.id, filter],
    queryFn: async () => {
      const endpoint = filter === 'ai-suggested' 
        ? `/api/grading/tasks/ai-suggested?status=pending`
        : `/api/grading/tasks?teacher_id=${user?.id}&status=${filter === 'all' ? '' : filter}`;
      
      const response = await apiRequest('GET', endpoint);
      if (!response.ok) throw new Error('Failed to fetch grading tasks');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Submit grade mutation
  const gradeTaskMutation = useMutation({
    mutationFn: async ({ taskId, score, comment }: { taskId: number; score: number; comment: string }) => {
      const response = await apiRequest('POST', `/api/grading/tasks/${taskId}/grade`, {
        score,
        comment,
        graderId: user?.id
      });
      if (!response.ok) throw new Error('Failed to submit grade');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Grade Submitted",
        description: "The grade has been submitted successfully.",
      });
      setSelectedTask(null);
      setScore('');
      setComment('');
      setIsGrading(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit grade",
        variant: "destructive",
      });
      setIsGrading(false);
    },
  });

  const handleGradeSubmit = () => {
    if (!selectedTask) return;

    const numericScore = parseFloat(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > selectedTask.maxMarks) {
      toast({
        title: "Invalid Score",
        description: `Score must be between 0 and ${selectedTask.maxMarks}`,
        variant: "destructive",
      });
      return;
    }
    if (comment.trim().length < 5) {
      toast({
        title: "Comment Required",
        description: "Please provide a meaningful comment (at least 5 characters)",
        variant: "destructive",
      });
      return;
    }
    setIsGrading(true);
    gradeTaskMutation.mutate({
      taskId: selectedTask.id,
      score: numericScore,
      comment: comment.trim()
    });
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = searchTerm === '' || 
      task.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.examTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const gradedCount = tasks.filter(t => t.status === 'graded').length;

  if (!user) {
    return <div>Please log in to access the grading queue.</div>;
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Grading Queue</h1>
            <p className="text-muted-foreground">Review and grade student exam responses</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="text-sm">
              <Clock className="w-4 h-4 mr-1" />
              {pendingCount} Pending
            </Badge>
            <Badge variant="default" className="text-sm">
              <CheckCircle className="w-4 h-4 mr-1" />
              {gradedCount} Graded
            </Badge>
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai-suggested">AI Suggested</SelectItem>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="pending">Pending Manual</SelectItem>
                    <SelectItem value="graded">Graded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or exam title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks List */}
          <Card className="lg:h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckSquare className="w-5 h-5 mr-2" />
                Grading Tasks ({filteredTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto max-h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin mr-2" />
                  Loading tasks...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No grading tasks found.</p>
                  {filter === 'pending' && <p className="text-sm">Great! All tasks are completed.</p>}
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <Card 
                    key={task.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTask?.id === task.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedTask(task);
                      setScore(task.currentScore?.toString() || '');
                      setComment(task.graderComment || '');
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{task.studentName}</span>
                            <Badge 
                              variant={task.status === 'pending' ? 'destructive' : 'default'}
                              className="text-xs"
                            >
                              {task.status === 'pending' ? 'Pending' : 'Graded'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <BookOpen className="w-3 h-3" />
                            <span>{task.examTitle}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Award className="w-3 h-3" />
                            <span>Max: {task.maxMarks} marks</span>
                            {task.currentScore !== undefined && (
                              <span className="text-primary font-medium">
                                | Score: {task.currentScore}/{task.maxMarks}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Submitted {new Date(task.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Grading Panel */}
          <Card className="lg:h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="w-5 h-5 mr-2" />
                {selectedTask ? 'Grade Response' : 'Select a Task'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTask ? (
                <div className="space-y-4">
                  {/* Student Info */}
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Student</Label>
                        <p className="font-medium">{selectedTask.studentName}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Exam</Label>
                        <p className="font-medium">{selectedTask.examTitle}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Question Type</Label>
                        <p className="font-medium capitalize">{selectedTask.questionType}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Max Marks</Label>
                        <p className="font-medium">{selectedTask.maxMarks}</p>
                      </div>
                    </div>
                  </div>

                  {/* Question */}
                  <div>
                    <Label className="text-sm font-medium">Question</Label>
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border">
                      <p className="text-sm">{selectedTask.questionText}</p>
                    </div>
                  </div>

                  {/* Student Answer */}
                  <div>
                    <Label className="text-sm font-medium">Student Answer</Label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border min-h-[100px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedTask.studentAnswer || 'No answer provided'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Grading Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="score">Score (out of {selectedTask.maxMarks})</Label>
                        <Input
                          id="score"
                          type="number"
                          min="0"
                          max={selectedTask.maxMarks}
                          step="0.5"
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          placeholder="Enter score"
                        />
                      </div>
                      <div className="flex items-end">
                        <Badge variant="outline" className="text-sm">
                          {score ? `${((parseFloat(score) / selectedTask.maxMarks) * 100).toFixed(1)}%` : '0%'}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="comment">Comments & Feedback</Label>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Provide feedback to help the student understand their performance..."
                        className="min-h-[100px]"
                      />
                    </div>

                    {/* AI Suggestion Info */}
                    {(selectedTask as any).aiSuggested && (selectedTask as any).pointsEarned > 0 && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-900">AI Suggested Score</span>
                        </div>
                        <p className="text-sm text-blue-800 mb-2">
                          The system suggests <strong>{(selectedTask as any).pointsEarned}/{selectedTask.maxMarks} marks</strong>
                          {(selectedTask as any).confidence && 
                            ` (${Math.round((selectedTask as any).confidence * 100)}% confidence)`
                          }
                        </p>
                        <p className="text-xs text-blue-700">
                          Review the answer and either approve the AI score or provide your own assessment.
                        </p>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      {(selectedTask as any).aiSuggested && (selectedTask as any).pointsEarned > 0 ? (
                        <>
                          <Button
                            onClick={() => {
                              // Approve AI score
                              apiRequest('POST', `/api/grading/ai-suggested/${(selectedTask as any).id}/review`, {
                                approved: true,
                                comment: comment.trim() || (selectedTask as any).feedbackText
                              }).then(() => {
                                toast({
                                  title: "AI Score Approved",
                                  description: "The AI-suggested score has been approved.",
                                });
                                refetch();
                                setSelectedTask(null);
                              }).catch(() => {
                                toast({
                                  title: "Error",
                                  description: "Failed to approve AI score",
                                  variant: "destructive",
                                });
                              });
                            }}
                            disabled={isGrading}
                            variant="default"
                            className="flex-1"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve AI Score
                          </Button>
                          <Button
                            onClick={handleGradeSubmit}
                            disabled={isGrading || !score || !comment.trim()}
                            variant="outline"
                            className="flex-1"
                          >
                            {isGrading ? (
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Override with Custom Score
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={handleGradeSubmit}
                            disabled={isGrading || !score || !comment.trim()}
                            className="flex-1"
                          >
                            {isGrading ? (
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            {selectedTask.status === 'graded' ? 'Update Grade' : 'Submit Grade'}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedTask(null);
                          setScore('');
                          setComment('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a task from the list to start grading</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}