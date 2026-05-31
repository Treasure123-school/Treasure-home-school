import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, Eye, BookOpen, Clock, CheckCircle, FileText,
  AlertCircle, Calendar, GraduationCap, User,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Exam, Class, Subject } from '@shared/schema';

export default function AdminExamOverview() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({ queryKey: ['/api/exams'] });
  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ['/api/classes'] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ['/api/users'] });

  const filteredExams = exams.filter(exam => {
    const matchSearch = exam.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = filterClass === 'all' || exam.classId === parseInt(filterClass);
    const matchSubject = filterSubject === 'all' || exam.subjectId === parseInt(filterSubject);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'published' && exam.isPublished) ||
      (filterStatus === 'draft' && !exam.isPublished);
    return matchSearch && matchClass && matchSubject && matchStatus;
  });

  const getClassName = (id: number) => (classes as any[]).find(c => c.id === id)?.name ?? 'Unknown';
  const getSubjectName = (id: number) => (subjects as any[]).find(s => s.id === id)?.name ?? 'Unknown';
  const getTeacherName = (id: string | null) => {
    if (!id) return 'Not assigned';
    const t = (users as any[]).find(u => u.id === id);
    return t ? `${t.firstName} ${t.lastName}` : 'Unknown';
  };

  const totalExams = exams.length;
  const publishedExams = exams.filter(e => e.isPublished).length;
  const draftExams = exams.filter(e => !e.isPublished).length;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-exam-overview">
          <BookOpen className="h-6 w-6 text-primary" />
          Exam Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor and review all exams created by teachers</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Exams', value: totalExams, icon: BookOpen, color: 'text-primary', testId: 'card-total-exams', valId: 'text-total-exams' },
          { label: 'Published', value: publishedExams, icon: CheckCircle, color: 'text-green-600', testId: 'card-published-exams', valId: 'text-published-exams' },
          { label: 'Drafts', value: draftExams, icon: FileText, color: 'text-orange-500', testId: 'card-draft-exams', valId: 'text-draft-exams' },
        ].map(s => (
          <Card key={s.label} className="p-4" data-testid={s.testId}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`} data-testid={s.valId}>{s.value}</p>
              </div>
              <s.icon className={`h-7 w-7 ${s.color} opacity-70`} />
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exams…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-exams"
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger data-testid="select-filter-class"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {(classes as any[]).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger data-testid="select-filter-subject"><SelectValue placeholder="All Subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {(subjects as any[]).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Exam list ── */}
      {examsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No exams found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredExams.map(exam => (
              <Card
                key={exam.id}
                className="group hover:border-primary/40 hover:shadow-sm transition-all"
                data-testid={`row-exam-${exam.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug" data-testid={`text-exam-name-${exam.id}`}>
                      {exam.name}
                    </p>
                    {exam.isPublished ? (
                      <Badge className="shrink-0 bg-green-600 text-white text-[10px]" data-testid={`badge-status-${exam.id}`}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Published
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 text-[10px]" data-testid={`badge-status-${exam.id}`}>
                        <FileText className="h-3 w-3 mr-1" /> Draft
                      </Badge>
                    )}
                  </div>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{getClassName(exam.classId)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{getSubjectName(exam.subjectId)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{getTeacherName(exam.createdBy ?? null)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{exam.timeLimit ? `${exam.timeLimit} min` : 'N/A'}</span>
                    </div>
                    {exam.date && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{format(new Date(exam.date), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {/* View button */}
                  <div className="pt-1 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs justify-center"
                      onClick={() => navigate(`/portal/admin/exams/analysis/${exam.id}`)}
                      data-testid={`button-view-${exam.id}`}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {filteredExams.length} exam{filteredExams.length !== 1 ? 's' : ''} shown
          </p>
        </>
      )}

      {/* ── Read-only notice ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">Read-Only Access</p>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
            As an admin you can view and monitor all exams. Only teachers can create, edit, or delete exams for their assigned subjects.
          </p>
        </div>
      </div>
    </div>
  );
}
