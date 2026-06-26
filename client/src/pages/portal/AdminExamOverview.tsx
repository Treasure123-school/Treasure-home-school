import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Search, BookOpen, CheckCircle, FileText,
  AlertCircle, Play,
} from 'lucide-react';
import { MiniStatCard, MiniStatGrid, ExamCard } from '@/components/shared';
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

      {/* ── Read-only notice ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/5 border border-primary/30 dark:border-primary/30">
        <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-primary dark:text-primary/50 text-sm">Read-Only Access</p>
          <p className="text-xs text-primary dark:text-primary/60 mt-0.5">
            As an admin you can view and monitor all exams. Only teachers can create, edit, or delete exams for their assigned subjects.
          </p>
        </div>
      </div>
    </div>
  );
}
