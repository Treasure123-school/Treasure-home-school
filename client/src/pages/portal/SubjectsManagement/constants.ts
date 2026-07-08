import { z } from 'zod';
import {
  GraduationCap, Palette, Briefcase, BookMarked,
  ClipboardList, BookText, Library, FileText, BarChart2,
  BookOpen, Users, Calendar,
} from 'lucide-react';
import type { SubjectAudit } from './types';

// ─── Categories ─────────────────────────────────────────────────────────────

export const SUBJECT_CATEGORIES = [
  {
    value: 'general',
    label: 'General',
    description: 'For all classes (KG1–SS3)',
    icon: BookMarked,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'science',
    label: 'Science',
    description: 'For SS1–SS3 Science dept',
    icon: GraduationCap,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'art',
    label: 'Art',
    description: 'For SS1–SS3 Art dept',
    icon: Palette,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'For SS1–SS3 Commercial dept',
    icon: Briefcase,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
] as const;

// ─── Audit dialog fields ─────────────────────────────────────────────────────

export const AUDIT_FIELDS: { key: keyof Omit<SubjectAudit, 'isClean'>; label: string; icon: any }[] = [
  { key: 'exams', label: 'Exams', icon: ClipboardList },
  { key: 'lessonNotes', label: 'Lesson notes', icon: BookText },
  { key: 'questionBanks', label: 'Question banks', icon: Library },
  { key: 'assignments', label: 'Assignments', icon: FileText },
  { key: 'syllabusTopics', label: 'Syllabus topics', icon: Library },
  { key: 'reportCardItems', label: 'Report card entries', icon: BarChart2 },
  { key: 'continuousAssessments', label: 'CA records', icon: BarChart2 },
  { key: 'classLinks', label: 'Class links', icon: BookOpen },
  { key: 'studentAssignments', label: 'Student assignments', icon: Users },
  { key: 'timetableEntries', label: 'Timetable entries', icon: Calendar },
  { key: 'studyResources', label: 'Study resources', icon: BookOpen },
  { key: 'teacherAssignments', label: 'Teacher assignments', icon: Users },
];

// ─── Form schema ─────────────────────────────────────────────────────────────

export const subjectFormSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
  category: z.enum(['general', 'science', 'art', 'commercial']).default('general'),
});

export type SubjectForm = z.infer<typeof subjectFormSchema>;
