import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useClassSubjects } from '@/hooks/useClassSubjects';
import type { Exam, Class, Subject } from '@shared/schema.pg';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useExamQueries({ watchExam, setExamValue, isExamDialogOpen, editingExam }: { watchExam: any; setExamValue: any; isExamDialogOpen: any; editingExam: any }) {
    // Fetch exams with pending deletion filter
  const { data: rawExams = [], isLoading: loadingExams } = useQuery({
    queryKey: ['/api/exams'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/exams');
      return await response.json();
    },
  });

  // Assessments stay visible until the backend actually confirms deletion —
  // see deleteExamMutation below. deletingExamIds only tracks in-flight
  // deletions for "Deleting..." button/menu labels, it no longer hides items.
  const exams = rawExams;

    // Fetch teacher's assigned classes and subjects (teachers only see their assignments)
  const { data: myAssignments, isLoading: assignmentsLoading } = useQuery<{
    isAdmin: boolean;
    classes: any[];
    subjects: any[];
    assignments: Array<{ classId: number; subjectId: number; isActive: boolean }>;
  }>({
    queryKey: ['/api/my-assignments'],
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch ALL subjects for display purposes (showing subject names for existing exams)
  const { data: allSubjects = [] } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
    staleTime: 60000,
  });

  // Fetch ALL classes for display purposes (showing class names for existing exams)
  const { data: allClasses = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
    staleTime: 60000,
  });

  // Use teacher's assigned classes for dropdowns (teachers), or all classes (admins)
  const classes = myAssignments?.isAdmin ? allClasses : (myAssignments?.classes || []);
  const classesLoading = assignmentsLoading;

  // Filter subjects based on selected class - only show subjects the teacher is assigned to for that class
  const selectedClassId = watchExam('classId');

  // Filter subjects to only those assigned to the selected class (reusable hook)
  const {
    subjects: availableSubjects,
    isLoading: subjectsLoading,
  } = useClassSubjects(selectedClassId);

  // availableSubjects is for dropdown selections (filtered to teacher's assignments or class mappings)
  const subjects = availableSubjects;

  // Clear subject and teacher when class changes (to prevent stale selections)
  useEffect(() => {
    if (selectedClassId) {
      setExamValue('subjectId', undefined as any);
      setExamValue('teacherInChargeId', undefined);
    }
  }, [selectedClassId, setExamValue]);

  // Fetch teachers for teacher in-charge dropdown
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return await response.json();
    },
  });

  const { currentTerm, currentSessionTerms: terms } = useAcademicCalendar();

  // Auto-select current term when the Create Exam dialog opens (not for edits)
  useEffect(() => {
    if (currentTerm && !editingExam && isExamDialogOpen) {
      setExamValue('termId', currentTerm.id as any);
    }
  }, [currentTerm, editingExam, isExamDialogOpen, setExamValue]);

  // Fetch active grading config so the exam form can show real DB scale names
  const { data: gradingConfigData } = useQuery<{ availableScales: string[]; dbSettings: { defaultGradingScale: string } }>({
    queryKey: ['/api/grading-config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/grading-config');
      if (!res.ok) return null;
      return res.json();
    },
  });
  const availableGradingScales: string[] = gradingConfigData?.availableScales ?? [];
  const activeGradingScaleName: string = gradingConfigData?.dbSettings?.defaultGradingScale ?? 'standard';

  return { exams, loadingExams, myAssignments, assignmentsLoading, allSubjects, allClasses, classes, classesLoading, selectedClassId, subjects, subjectsLoading, teachers, loadingTeachers, currentTerm, terms, availableGradingScales, activeGradingScaleName };
}
