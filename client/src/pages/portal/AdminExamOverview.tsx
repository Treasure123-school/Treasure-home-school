import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, BookOpen, CheckCircle, FileText,
  AlertCircle, Play, Filter,
} from 'lucide-react';
import { MiniStatCard, MiniStatGrid, ExamCard } from '@/components/shared';
import type { Exam, Class, Subject, AcademicTerm } from '@shared/schema';

export default function AdminExamOverview() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterTerm, setFilterTerm] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: exams = [], isLoading: examsLoading } = useQuery<Exam[]>({ queryKey: ['/api/exams'] });
  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ['/api/classes'] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });
  const { data: terms = [] } = useQuery<AcademicTerm[]>({ queryKey: ['/api/terms'] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ['/api/users'] });

  const filteredExams = exams.filter(exam => {
    const matchSearch = exam.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = filterClass === 'all' || exam.classId === parseInt(filterClass);
    const matchSubject = filterSubject === 'all' || exam.subjectId === parseInt(filterSubject);
    const matchTerm = filterTerm === 'all' || exam.termId === parseInt(filterTerm);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'published' && exam.isPublished) ||
      (filterStatus === 'draft' && !exam.isPublished);
    return matchSearch && matchClass && matchSubject && matchTerm && matchStatus;
  });

  const getClassName = (id: number | null | undefined) => (classes as any[]).find(c => c.id === id)?.name ?? 'Unknown';
  const getSubjectName = (id: number | null | undefined) => (subjects as any[]).find(s => s.id === id)?.name ?? 'Unknown';
  const getTeacherName = (id: string | null) => {
    if (!id) return 'Unknown';
    const t = (users as any[]).find(u => u.id === id);
    return t ? `${t.firstName} ${t.lastName}` : 'Unknown';
  };

  const totalExams = exams.length;
  const publishedExams = exams.filter(e => e.isPublished).length;
  const draftExams = exams.filter(e => !e.isPublished).length;
  const scheduledExams = exams.filter((exam: any) => {
    if (exam.timerMode !== 'global' || !exam.startTime || !exam.endTime) return false;
    const now = new Date();
    return now >= new Date(exam.startTime) && now <= new Date(exam.endTime) || now < new Date(exam.startTime);
  }).length;

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
      <MiniStatGrid cols={4}>
        <MiniStatCard
          label="Total Exams"
          value={totalExams}
          icon={BookOpen}
          color="text-primary"
          data-testid="card-total-exams"
        />
        <MiniStatCard
          label="Published"
          value={publishedExams}
          icon={CheckCircle}
          color="text-green-600"
          data-testid="card-published-exams"
        />
        <MiniStatCard
          label="Drafts"
          value={draftExams}
          icon={FileText}
          color="text-orange-500"
          data-testid="card-draft-exams"
        />
        <MiniStatCard
          label="Scheduled"
          value={scheduledExams}
          icon={Play}
          color="text-purple-600"
          data-testid="card-scheduled-exams"
        />
      </MiniStatGrid>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exams…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-exams"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px]" data-testid="select-filter-class">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {(classes as any[]).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[150px]" data-testid="select-filter-subject">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {(subjects as any[]).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTerm} onValueChange={setFilterTerm}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]" data-testid="select-filter-term">
              <SelectValue placeholder="All Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Term</SelectItem>
              {(terms as any[]).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status filter — icon button opens a dropdown of status choices */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filterStatus !== 'all' ? 'default' : 'outline'}
                size="sm"
                className="w-[calc(50%-4px)] sm:w-auto h-9 justify-center sm:justify-start gap-1.5"
                aria-label="Filter by status"
                data-testid="button-filter-status"
              >
                <Filter className="h-4 w-4" />
                <span>
                  {filterStatus === 'all' ? 'All Status' :
                    filterStatus === 'published' ? 'Published' : 'Draft'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                <DropdownMenuRadioItem value="all" data-testid="filter-status-all">All Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="published" data-testid="filter-status-published">Published</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="draft" data-testid="filter-status-draft">Draft</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
              <ExamCard
                key={exam.id}
                exam={exam}
                className={getClassName(exam.classId ?? undefined)}
                subjectName={getSubjectName(exam.subjectId ?? undefined)}
                teacherName={getTeacherName(exam.createdBy ?? null)}
                onView={() => navigate(`/portal/admin/exams/analysis/${exam.id}`)}
                data-testid={`row-exam-${exam.id}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {filteredExams.length} exam{filteredExams.length !== 1 ? 's' : ''} shown
          </p>
        </>
      )}
    </div>
  );
}
