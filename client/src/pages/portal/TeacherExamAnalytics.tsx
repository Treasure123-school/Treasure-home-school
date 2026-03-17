import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BookOpen, Users, CheckCircle, XCircle, TrendingUp, Award } from 'lucide-react';
import type { Exam, ExamSession } from '@shared/schema';

export default function TeacherExamAnalytics() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }
  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;

  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
  });

  const { data: submissions = [] } = useQuery<ExamSession[]>({
    queryKey: ['/api/exam-sessions'],
  });

  const teacherExams = exams.filter(exam => exam.createdBy === user.id);
  const totalExams = teacherExams.length;
  const publishedExams = teacherExams.filter(e => e.isPublished).length;
  
  const examSubmissionsMap = submissions.reduce((acc, sub) => {
    if (!acc[sub.examId]) {
      acc[sub.examId] = [];
    }
    acc[sub.examId].push(sub);
    return acc;
  }, {} as Record<number, ExamSession[]>);

  const totalSubmissions = submissions.length;
  const gradedSubmissions = submissions.filter((s: ExamSession) => s.status === 'graded' || s.status === 'submitted').length;

  const passFailData = teacherExams.map(exam => {
    const examSubs = examSubmissionsMap[exam.id] || [];
    const graded = examSubs.filter((s: ExamSession) => s.status === 'graded' || s.status === 'submitted');
    const passed = graded.filter((s: ExamSession) => (s.score || 0) >= (exam.passingScore || 60));
    const failed = graded.filter((s: ExamSession) => (s.score || 0) < (exam.passingScore || 60));
    
    return {
      examName: exam.name.length > 20 ? exam.name.substring(0, 20) + '...' : exam.name,
      passed: passed.length,
      failed: failed.length,
    };
  }).slice(0, 5);

  const averageScores = teacherExams.map(exam => {
    const examSubs = examSubmissionsMap[exam.id] || [];
    const graded = examSubs.filter((s: ExamSession) => s.status === 'graded' || s.status === 'submitted' && s.score !== null);
    const avgScore = graded.length > 0 
      ? graded.reduce((sum: number, s: ExamSession) => sum + (s.score || 0), 0) / graded.length 
      : 0;
    
    return {
      examName: exam.name.length > 20 ? exam.name.substring(0, 20) + '...' : exam.name,
      averageScore: Math.round(avgScore),
    };
  }).slice(0, 5);

  const statusData = [
    { name: 'Completed', value: submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length, color: '#10b981' },
    { name: 'In Progress', value: submissions.filter(s => s.status === 'in_progress').length, color: '#f59e0b' },
    { name: 'Not Started', value: submissions.filter(s => s.status === 'not_started').length, color: '#6b7280' },
  ];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-exam-analytics">Exam Analytics</h1>
          <p className="text-muted-foreground">Insights and performance metrics for your exams</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-total-exams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-exams">{totalExams}</div>
              <p className="text-xs text-muted-foreground">{publishedExams} published</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-submissions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-submissions">{totalSubmissions}</div>
              <p className="text-xs text-muted-foreground">{gradedSubmissions} graded</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pass-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Pass Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-pass-rate">
                {gradedSubmissions > 0 
                  ? Math.round((submissions.filter(s => (s.score || 0) >= 60).length / gradedSubmissions) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-score">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-avg-score">
                {gradedSubmissions > 0
                  ? Math.round(submissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions)
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pass/Fail by Exam</CardTitle>
            </CardHeader>
            <CardContent>
              {passFailData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={passFailData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="examName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="passed" fill="#10b981" name="Passed" />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No exam data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Scores by Exam</CardTitle>
            </CardHeader>
            <CardContent>
              {averageScores.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={averageScores}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="examName" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="averageScore" fill="#3b82f6" name="Average Score %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No exam data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submission Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No submission data available
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
