
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { 
  Award, 
  BarChart3, 
  Download, 
  Filter,
  TrendingUp,
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  Target,
  Percent
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface ExamReport {
  examId: number;
  examTitle: string;
  className: string;
  subjectName: string;
  totalStudents: number;
  completedStudents: number;
  averageScore: number;
  maxScore: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  examDate: string;
  status: 'ongoing' | 'completed';
  gradingProgress: number;
}
interface StudentReport {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  score: number;
  percentage: number;
  grade: string;
  rank: number;
  timeSpent: number;
  submittedAt: string;
  autoScored: boolean;
  manualScored: boolean;
}
export default function ExamReports() {
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedExam, setSelectedExam] = useState<ExamReport | null>(null);
  const [showStudentDetails, setShowStudentDetails] = useState(false);

  // Fetch exam reports
  const { data: examReports = [], isLoading } = useQuery<ExamReport[]>({
    queryKey: ['/api/exam-reports', selectedSubject, selectedClass],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.append('subject', selectedSubject);
      if (selectedClass !== 'all') params.append('class', selectedClass);
      
      const response = await apiRequest('GET', `/api/exam-reports?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch exam reports');
      return response.json();
    },
  });

  // Fetch student details for selected exam
  const { data: studentReports = [] } = useQuery<StudentReport[]>({
    queryKey: ['/api/exam-reports', selectedExam?.examId, 'students'],
    queryFn: async () => {
      if (!selectedExam) return [];
      const response = await apiRequest('GET', `/api/exam-reports/${selectedExam.examId}/students`);
      if (!response.ok) throw new Error('Failed to fetch student reports');
      return response.json();
    },
    enabled: !!selectedExam && showStudentDetails,
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['/api/exam-reports/filters'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exam-reports/filters');
      if (!response.ok) throw new Error('Failed to fetch filter options');
      return response.json();
    },
  });

  const getGradeColor = (grade: string) => {
    const colors = {
      'A': 'text-green-600',
      'B': 'text-blue-600',
      'C': 'text-yellow-600',
      'D': 'text-orange-600',
      'F': 'text-red-600'
    };
    return colors[grade as keyof typeof colors] || 'text-gray-600';
  };

  const getStatusBadge = (status: string, gradingProgress: number) => {
    if (status === 'ongoing') {
      return <Badge variant="destructive">Ongoing</Badge>;
    }
    if (gradingProgress < 100) {
      return <Badge variant="secondary">Grading ({gradingProgress}%)</Badge>;
    }
    return <Badge variant="default">Completed</Badge>;
  };

  const exportExamReport = async (examId: number, format: 'pdf' | 'excel') => {
    try {
      const response = await apiRequest('GET', `/api/exam-reports/${examId}/export?format=${format}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${examId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
    }
  };

  // Calculate summary statistics
  const totalExams = examReports.length;
  const completedExams = examReports.filter(r => r.status === 'completed' && r.gradingProgress === 100).length;
  const averagePassRate = examReports.length > 0 
    ? Math.round(examReports.reduce((sum, r) => sum + r.passRate, 0) / examReports.length)
    : 0;
  const totalStudentsExamined = examReports.reduce((sum, r) => sum + r.completedStudents, 0);

  if (!user) {
    return <div>Please log in to access exam reports.</div>;
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
    return roleMap[roleId] || 'admin';
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Exam Reports & Analytics</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Comprehensive exam performance analysis and reporting</p>
          </div>
          <Button onClick={() => exportExamReport(0, 'pdf')}>
            <Download className="w-4 h-4 mr-2" />
            Export Summary
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Exams</p>
                  <p className="text-2xl font-bold">{totalExams}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{completedExams}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Pass Rate</p>
                  <p className="text-2xl font-bold text-purple-600">{averagePassRate}%</p>
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Students Examined</p>
                  <p className="text-2xl font-bold text-orange-600">{totalStudentsExamined}</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {filterOptions?.classes?.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {filterOptions?.subjects?.map((subject: any) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!showStudentDetails ? (
          // Exam Reports Table
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Exam Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading reports...</div>
              ) : examReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No exam reports found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Class/Subject</TableHead>
                      <TableHead>Participation</TableHead>
                      <TableHead>Average Score</TableHead>
                      <TableHead>Pass Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examReports.map((report) => (
                      <TableRow key={report.examId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.examTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(report.examDate).toLocaleDateString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.className}</p>
                            <p className="text-sm text-muted-foreground">{report.subjectName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{report.completedStudents}/{report.totalStudents}</span>
                              <span className="text-muted-foreground">
                                {Math.round((report.completedStudents / report.totalStudents) * 100)}%
                              </span>
                            </div>
                            <Progress 
                              value={(report.completedStudents / report.totalStudents) * 100} 
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {report.averageScore.toFixed(1)}/{report.maxScore}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              ({((report.averageScore / report.maxScore) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Percent className="w-4 h-4 text-muted-foreground" />
                            <span className={`font-medium ${
                              report.passRate >= 80 ? 'text-green-600' :
                              report.passRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {report.passRate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(report.status, report.gradingProgress)}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExam(report);
                                setShowStudentDetails(true);
                              }}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exportExamReport(report.examId, 'pdf')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          // Student Details View
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  {selectedExam?.examTitle} - Student Results
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={() => setShowStudentDetails(false)}
                >
                  Back to Overview
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Time Spent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentReports.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        <Badge variant="outline">#{student.rank}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.studentName}</p>
                          <p className="text-sm text-muted-foreground">{student.admissionNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{student.score}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({student.percentage}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getGradeColor(student.grade)}>
                          {student.grade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{Math.round(student.timeSpent / 60)} min</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {student.autoScored && (
                            <Badge variant="secondary" className="text-xs">Auto</Badge>
                          )}
                          {student.manualScored && (
                            <Badge variant="default" className="text-xs">Manual</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
