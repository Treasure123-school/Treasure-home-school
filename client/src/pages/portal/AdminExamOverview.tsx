import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { Search, Eye, BookOpen, Clock, Users, CheckCircle, XCircle, AlertCircle, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { Exam, Class, Subject } from '@shared/schema';

export default function AdminExamOverview() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (!user) {
    return <div>Loading...</div>;
  }
  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || exam.classId === parseInt(filterClass);
    const matchesSubject = filterSubject === 'all' || exam.subjectId === parseInt(filterSubject);
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'published' && exam.isPublished) ||
      (filterStatus === 'draft' && !exam.isPublished);
    
    return matchesSearch && matchesClass && matchesSubject && matchesStatus;
  });

  const getClassName = (classId: number) => {
    const cls = classes.find((c: any) => c.id === classId);
    return cls?.name || 'Unknown';
  };

  const getSubjectName = (subjectId: number) => {
    const subject = subjects.find((s: any) => s.id === subjectId);
    return subject?.name || 'Unknown';
  };

  const getTeacherName = (userId: string | null) => {
    if (!userId) return 'Not assigned';
    const teacher = users.find((u: any) => u.id === userId);
    if (!teacher) return 'Unknown';
    return `${teacher.firstName} ${teacher.lastName}`;
  };

  const totalExams = exams.length;
  const publishedExams = exams.filter(e => e.isPublished).length;
  const draftExams = exams.filter(e => !e.isPublished).length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-exam-overview">Exam Overview</h1>
            <p className="text-muted-foreground">Monitor and review exams created by teachers</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-exams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-exams">{totalExams}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-published-exams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-published-exams">{publishedExams}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-draft-exams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <FileText className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-draft-exams">{draftExams}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Exams</CardTitle>
            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-exams"
                />
              </div>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-class">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-subject">
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject: any) => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {examsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading exams...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No exams found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExams.map((exam) => (
                      <TableRow key={exam.id} data-testid={`row-exam-${exam.id}`}>
                        <TableCell className="font-medium" data-testid={`text-exam-name-${exam.id}`}>
                          {exam.name}
                        </TableCell>
                        <TableCell>{getClassName(exam.classId)}</TableCell>
                        <TableCell>{getSubjectName(exam.subjectId)}</TableCell>
                        <TableCell>{getTeacherName(exam.createdBy)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {exam.date ? format(new Date(exam.date), 'MMM dd, yyyy') : 'Not set'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {exam.timeLimit ? `${exam.timeLimit} min` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {exam.isPublished ? (
                            <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${exam.id}`}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-status-${exam.id}`}>
                              <FileText className="h-3 w-3 mr-1" />
                              Draft
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${exam.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Read-Only Access</h3>
                <p className="text-sm text-blue-800 mt-1">
                  As an admin, you can view and monitor all exams but cannot create, edit, or delete them. 
                  Only teachers have permission to manage exams for their assigned subjects and classes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
