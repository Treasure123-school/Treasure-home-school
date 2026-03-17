import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Download, Filter, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import { calculateGradeFromPercentage, getGradeColor as getGradeColorUtil, getGradeBgColor } from '@shared/grading-utils';
export default function StudentGrades() {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access your grades.</div>;
  }
  return <StudentGradesContent user={user} />;
}
function StudentGradesContent({ user }: { user: any }) {

  const { data: examResults, isLoading, error } = useQuery({
    queryKey: ['examResults', user.id],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/exam-results/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required');
          }
          throw new Error('Failed to fetch exam results');
        }
        return response.json();
      } catch (error) {
        throw error;
      }
    }
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = await fetch('/api/subjects', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch subjects');
      return response.json();
    }
  });

  const calculateGrade = (score: number) => {
    return calculateGradeFromPercentage(score, 'standard').grade;
  };

  const getGradeColor = (grade: string) => {
    return `${getGradeColorUtil(grade)} ${getGradeBgColor(grade)}`;
  };

  // Format exam results for display
  const formattedGrades = examResults?.map((result: any) => ({
    id: result.id,
    subject: result.subjectName || result.subject,
    examType: result.examType || 'Assessment',
    score: result.score || result.marks,
    maxScore: result.maxScore || result.totalMarks || 100,
    grade: result.grade || calculateGrade(result.score || result.marks),
    date: result.examDate || result.createdAt,
    term: result.term || 'Current Term'
  })) || [];

  // Calculate average score
  const averageScore = formattedGrades.length > 0 
    ? formattedGrades.reduce((sum: number, grade: any) => sum + grade.score, 0) / formattedGrades.length
    : 0;

  // Group grades by subject
  const gradesBySubject = formattedGrades.reduce((acc: any, grade: any) => {
    if (!acc[grade.subject]) {
      acc[grade.subject] = [];
    }
    acc[grade.subject].push(grade);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
            <p className="text-muted-foreground">
              View your academic performance and progress
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">{averageScore.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Assessments</p>
                  <p className="text-2xl font-bold">{formattedGrades.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Highest Score</p>
                <p className="text-2xl font-bold">
                  {formattedGrades.length > 0 
                    ? Math.max(...formattedGrades.map((g: any) => g.score))
                    : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subjects</p>
                <p className="text-2xl font-bold">{Object.keys(gradesBySubject).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Professional Loading State */}
        {isLoading && (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, j) => (
                      <div key={j} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Professional Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center py-6 sm:py-8">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 dark:text-red-400 text-xl sm:text-2xl">⚠️</span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-red-800 dark:text-red-300">
                  Unable to Load Your Grades
                </h3>
                <p className="text-sm sm:text-base text-red-600 dark:text-red-400 mb-4 max-w-md mx-auto">
                  We encountered an issue while fetching your academic records. This might be a temporary connection problem.
                </p>
                
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 max-w-md mx-auto">
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What you can do:</p>
                  <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-left space-y-1">
                    <li>• Click "Try Again" to reload your grades</li>
                    <li>• Check your internet connection</li>
                    <li>• If problem persists, contact your class teacher</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Try Again
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.location.href = '/portal/student'}
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grades by Subject */}
        {!error && isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading grades...</div>
            </CardContent>
          </Card>
        ) : !error && formattedGrades.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(gradesBySubject).map(([subject, grades]: [string, any]) => (
              <Card key={subject}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>{subject}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {grades.map((grade: any) => (
                      <div 
                        key={grade.id} 
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium">{grade.examType}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(grade.date).toLocaleDateString()} • {grade.term}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-bold text-lg">
                              {grade.score}/{grade.maxScore}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {((grade.score / grade.maxScore) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(grade.grade)}`}>
                            {grade.grade}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !error && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No grades available</h3>
                <p className="text-muted-foreground mb-4">
                  Your grades will appear here once your teachers have posted them.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/portal/student">
                    Back to Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}