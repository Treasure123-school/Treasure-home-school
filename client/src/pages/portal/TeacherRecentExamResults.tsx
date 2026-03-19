import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  Search, 
  ArrowLeft, 
  Eye, 
  Clock, 
  Users, 
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import type { Exam, Class, Subject } from '@shared/schema';

interface ExamWithSubmissions extends Exam {
  submissionCount: number;
  averageScore: number | null;
  className?: string;
  subjectName?: string;
}

export default function TeacherRecentExamResults() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const perPage = 10;

  if (!user) {
    return <div>Loading...</div>;
  }

  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;
  const userRole = 'teacher' as const;

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('[Recent Exam Results] Exam update received', event.eventType);
    }
  });

  useSocketIORealtime({
    table: 'exam_results',
    queryKey: ['/api/exams'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('[Recent Exam Results] Exam result update received', event.eventType);
      queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
    }
  });

  const teacherExams = (exams as Exam[])
    .filter((exam) => exam.createdBy === user.id)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const filteredExams = teacherExams.filter((exam) => {
    const matchesSearch = searchQuery === '' || 
      exam.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClass = classFilter === 'all' || exam.classId?.toString() === classFilter;
    const matchesSubject = subjectFilter === 'all' || exam.subjectId?.toString() === subjectFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'published' && exam.isPublished) ||
      (statusFilter === 'unpublished' && !exam.isPublished);
    
    return matchesSearch && matchesClass && matchesSubject && matchesStatus;
  });

  const totalPages = Math.ceil(filteredExams.length / perPage);
  const paginatedExams = filteredExams.slice((page - 1) * perPage, page * perPage);

  const totalSubmissionsToday = 0;
  const totalExams = teacherExams.length;

  const getClassName = (classId: number | null | undefined) => {
    if (!classId) return 'N/A';
    const cls = classes.find((c) => c.id === classId);
    return cls?.name || 'N/A';
  };

  const getSubjectName = (subjectId: number | null | undefined) => {
    if (!subjectId) return 'N/A';
    const subject = subjects.find((s) => s.id === subjectId);
    return subject?.name || 'N/A';
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button variant="outline" size="sm" asChild data-testid="button-back" className="w-fit">
              <Link href="/portal/teacher">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                Recent Exam Results
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                View and manage all your exam results
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card data-testid="card-total-exams">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Total Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-exams">{totalExams}</div>
              <p className="text-xs text-muted-foreground">Created by you</p>
            </CardContent>
          </Card>

          <Card data-testid="card-submissions-today">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                Submissions Today
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-submissions-today">{totalSubmissionsToday}</div>
              <p className="text-xs text-muted-foreground">Student submissions</p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-exams">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                Published Exams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-active-exams">
                {teacherExams.filter((e) => e.isPublished).length}
              </div>
              <p className="text-xs text-muted-foreground">Available to students</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exams..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>

              <Select value={classFilter} onValueChange={(value) => { setClassFilter(value); setPage(1); }}>
                <SelectTrigger data-testid="select-class-filter">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={subjectFilter} onValueChange={(value) => { setSubjectFilter(value); setPage(1); }}>
                <SelectTrigger data-testid="select-subject-filter">
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="unpublished">Unpublished</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg">Exam Results</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {examsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2 text-sm">Loading exams...</p>
              </div>
            ) : paginatedExams.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  {filteredExams.length === 0 && teacherExams.length > 0
                    ? 'No exams match your filters'
                    : 'No exams created yet'}
                </p>
                {teacherExams.length === 0 && (
                  <Button asChild className="mt-4" data-testid="button-create-exam">
                    <Link href="/portal/teacher/exams/create">Create Your First Exam</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="block sm:hidden space-y-3">
                  {paginatedExams.map((exam, index) => (
                    <ExamResultCardMobile 
                      key={exam.id} 
                      exam={exam} 
                      index={index}
                      getClassName={getClassName}
                      getSubjectName={getSubjectName}
                    />
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Exam Name</TableHead>
                        <TableHead className="text-xs">Class</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">Subject</TableHead>
                        <TableHead className="text-xs">Submissions</TableHead>
                        <TableHead className="text-xs hidden lg:table-cell">Date</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExams.map((exam, index) => (
                        <ExamResultRow 
                          key={exam.id} 
                          exam={exam} 
                          index={index}
                          getClassName={getClassName}
                          getSubjectName={getSubjectName}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredExams.length)} of {filteredExams.length} exams
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{page} / {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

function ExamResultRow({ 
  exam, 
  index,
  getClassName,
  getSubjectName 
}: { 
  exam: Exam; 
  index: number;
  getClassName: (id: number | null | undefined) => string;
  getSubjectName: (id: number | null | undefined) => string;
}) {
  const { data: examResults = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/exam-results/exam/${exam.id}`],
    enabled: !!exam.id,
  });

  const totalSubmissions = examResults.length;
  const averageScore = totalSubmissions > 0
    ? Math.round(examResults.reduce((sum: number, r: any) => sum + (r.score || r.marksObtained || 0), 0) / totalSubmissions)
    : null;

  return (
    <TableRow data-testid={`row-exam-${index}`}>
      <TableCell className="font-medium text-xs sm:text-sm py-3" data-testid={`text-exam-name-${index}`}>
        {exam.name}
      </TableCell>
      <TableCell className="text-xs sm:text-sm py-3" data-testid={`text-exam-class-${index}`}>
        {getClassName(exam.classId)}
      </TableCell>
      <TableCell className="text-xs hidden md:table-cell py-3" data-testid={`text-exam-subject-${index}`}>
        {getSubjectName(exam.subjectId)}
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <Badge 
            variant={totalSubmissions > 0 ? "default" : "secondary"} 
            className="text-xs"
            data-testid={`badge-submissions-${index}`}
          >
            {isLoading ? '...' : `${totalSubmissions} submissions`}
          </Badge>
          {averageScore !== null && (
            <span className="text-xs text-primary font-medium" data-testid={`text-average-${index}`}>
              {averageScore}% avg
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs hidden lg:table-cell py-3" data-testid={`text-exam-date-${index}`}>
        {exam.date ? format(new Date(exam.date), 'dd/MM/yyyy') : 'N/A'}
      </TableCell>
      <TableCell className="py-3">
        <Badge 
          variant={exam.isPublished ? "default" : "outline"}
          className="text-xs"
          data-testid={`badge-status-${index}`}
        >
          {exam.isPublished ? 'Published' : 'Unpublished'}
        </Badge>
      </TableCell>
      <TableCell className="py-3">
        <Button
          variant="outline"
          size="sm"
          asChild
          data-testid={`button-view-results-${index}`}
        >
          <Link href={`/portal/teacher/results/exam/${exam.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            View Results
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ExamResultCardMobile({ 
  exam, 
  index,
  getClassName,
  getSubjectName 
}: { 
  exam: Exam; 
  index: number;
  getClassName: (id: number | null | undefined) => string;
  getSubjectName: (id: number | null | undefined) => string;
}) {
  const { data: examResults = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/exam-results/exam/${exam.id}`],
    enabled: !!exam.id,
  });

  const totalSubmissions = examResults.length;
  const averageScore = totalSubmissions > 0
    ? Math.round(examResults.reduce((sum: number, r: any) => sum + (r.score || r.marksObtained || 0), 0) / totalSubmissions)
    : null;

  return (
    <Card 
      className="overflow-visible"
      data-testid={`card-exam-mobile-${index}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight mb-1" data-testid={`text-exam-name-mobile-${index}`}>
              {exam.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {getSubjectName(exam.subjectId)} • {exam.date ? format(new Date(exam.date), 'dd/MM/yyyy') : 'N/A'}
            </p>
          </div>
          <Badge 
            variant={exam.isPublished ? "default" : "outline"}
            className="text-xs flex-shrink-0"
            data-testid={`badge-status-mobile-${index}`}
          >
            {exam.isPublished ? 'Published' : 'Unpublished'}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between gap-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Badge 
              variant={totalSubmissions > 0 ? "default" : "secondary"} 
              className="text-xs"
              data-testid={`badge-submissions-mobile-${index}`}
            >
              {isLoading ? '...' : `${totalSubmissions} submissions`}
            </Badge>
            {averageScore !== null && (
              <span className="text-xs text-primary font-medium" data-testid={`text-average-mobile-${index}`}>
                {averageScore}% avg
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid={`button-view-results-mobile-${index}`}
          >
            <Link href={`/portal/teacher/results/exam/${exam.id}`}>
              View Results
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
