import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Users, TrendingUp, Award } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import type { Class, ExamResult, Exam, Subject, User } from '@shared/schema';

export default function TeacherClassResults() {
  const { user } = useAuth();
  const [, params] = useRoute('/portal/teacher/results/class/:classId');
  const classId = params?.classId ? parseInt(params.classId) : null;

  if (!user) {
    return <div>Loading...</div>;
  }
  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;
  const userRole = (user.role?.toLowerCase() || 'teacher') as 'admin' | 'teacher' | 'student' | 'parent';

  // Fetch class details
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
  });

  const currentClass = classes.find((c) => c.id === classId);

  // Fetch all exam results for this class
  const { data: examResults = [], isLoading } = useQuery<ExamResult[]>({
    queryKey: [`/api/exam-results/class/${classId}`],
    enabled: !!classId,
  });

  // Fetch all exams to get exam details
  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
  });

  // Fetch all users to get student details
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch subjects for subject names
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  // Group results by exam
  const resultsByExam = examResults.reduce((acc: Record<number, ExamResult[]>, result) => {
    const examId = result.examId;
    if (!acc[examId]) {
      acc[examId] = [];
    }
    acc[examId].push(result);
    return acc;
  }, {} as Record<number, ExamResult[]>);

  // Calculate statistics
  const totalStudents = new Set(examResults.map((r) => r.studentId)).size;
  const totalExams = Object.keys(resultsByExam).length;
  const averageScore = examResults.length > 0
    ? examResults.reduce((sum: number, r) => sum + (r.score ?? 0), 0) / examResults.length
    : 0;
  const averagePercentage = examResults.length > 0
    ? examResults.reduce((sum: number, r) => {
        const percentage = (r.maxScore ?? 0) > 0 ? ((r.score ?? 0) / (r.maxScore ?? 0)) * 100 : 0;
        return sum + percentage;
      }, 0) / examResults.length
    : 0;

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button variant="outline" size="sm" asChild data-testid="button-back" className="w-fit">
              <Link href="/portal/teacher">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-page-title">
                {currentClass?.name || 'Class'} - All Results
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                View all exam results for this class
              </p>
            </div>
          </div>
          <Button variant="outline" data-testid="button-export" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
        </div>

        {/* Statistics Cards - Mobile Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card data-testid="card-total-students">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-students">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-exams">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-500" />
                Total Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-exams">{totalExams}</div>
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
                {averageScore.toFixed(1)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-average-percentage">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Average %
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-average-percentage">
                {averagePercentage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results by Exam - Mobile Responsive */}
        <div className="space-y-4 sm:space-y-6">
          {Object.entries(resultsByExam).map(([examId, results]) => {
            const exam = exams.find((e) => e.id === parseInt(examId));
            const subject = subjects.find((s) => s.id === exam?.subjectId);
            const examResultsList = results;

            return (
              <Card key={examId} data-testid={`card-exam-${examId}`}>
                <CardHeader className="p-3 sm:p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-base sm:text-lg" data-testid={`text-exam-name-${examId}`}>
                        {exam?.name || `Exam ${examId}`}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {subject?.name} • {exam?.date ? new Date(exam.date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={exam?.isPublished ? 'default' : 'secondary'} className="w-fit">
                      {examResultsList.length} submissions
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  {isLoading ? (
                    <div className="text-center py-6 sm:py-8 text-sm">Loading results...</div>
                  ) : examResultsList.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                      No results yet for this exam
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card View */}
                      <div className="block sm:hidden space-y-3">
                        {examResultsList.map((result, index) => {
                          const student = users.find((u) => u.id === result.studentId);
                          const percentage = (result.maxScore ?? 0) > 0 
                            ? (((result.score ?? 0) / (result.maxScore ?? 0)) * 100).toFixed(1)
                            : '0';
                          
                          return (
                            <div 
                              key={result.id}
                              className="border rounded-lg p-3 bg-muted/30"
                              data-testid={`card-result-mobile-${result.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm" data-testid={`text-student-mobile-${index}`}>
                                  {student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}
                                </span>
                                <Badge 
                                  variant={result.autoScored ? 'secondary' : 'default'}
                                  className="text-xs"
                                >
                                  {result.autoScored ? 'Auto' : 'Manual'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Score</span>
                                  <p className="font-medium">{result.score || 0}/{result.maxScore || 0}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Percentage</span>
                                  <p className="font-medium">{percentage}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Grade</span>
                                  <p className="font-medium">{result.grade || '-'}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Student</TableHead>
                              <TableHead className="text-xs">Score</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Percentage</TableHead>
                              <TableHead className="text-xs">Grade</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs hidden lg:table-cell">Recorded By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {examResultsList.map((result, index) => {
                              const student = users.find((u) => u.id === result.studentId);
                              const percentage = (result.maxScore ?? 0) > 0 
                                ? (((result.score ?? 0) / (result.maxScore ?? 0)) * 100).toFixed(1)
                                : '0';
                              
                              return (
                                <TableRow key={result.id} data-testid={`row-result-${result.id}`}>
                                  <TableCell className="text-xs sm:text-sm py-2" data-testid={`text-student-${index}`}>
                                    {student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm py-2" data-testid={`text-score-${index}`}>
                                    {result.score || 0} / {result.maxScore || 0}
                                  </TableCell>
                                  <TableCell className="text-xs hidden md:table-cell py-2" data-testid={`text-percentage-${index}`}>
                                    {percentage}%
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm py-2" data-testid={`text-grade-${index}`}>
                                    {result.grade || '-'}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Badge 
                                      variant={result.autoScored ? 'secondary' : 'default'}
                                      className="text-xs"
                                      data-testid={`badge-status-${index}`}
                                    >
                                      {result.autoScored ? 'Auto' : 'Manual'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell py-2">
                                    {result.recordedBy ? users.find((u) => u.id === result.recordedBy)?.firstName || 'System' : 'System'}
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
            );
          })}

          {!isLoading && Object.keys(resultsByExam).length === 0 && (
            <Card>
              <CardContent className="py-8 sm:py-12">
                <div className="text-center space-y-3 sm:space-y-4">
                  <Award className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">No Results Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      No exam results have been recorded for this class yet.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </div>
  );
}
