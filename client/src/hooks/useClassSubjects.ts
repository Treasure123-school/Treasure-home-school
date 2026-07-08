/**
 * useClassSubjects
 *
 * Reusable hook that returns the subjects assigned to a given class.
 *
 * - For admins  → queries /api/class-subject-mappings/:classId (the canonical
 *   source of truth for which subjects belong to a class).
 * - For teachers → filters the teacher's own assignments down to the chosen class.
 *
 * Usage:
 *   const { subjects, isLoading } = useClassSubjects(selectedClassId);
 *
 * The hook internally re-uses any cached /api/my-assignments data so there is
 * no extra network round-trip when the parent component already fetches it.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── shared types ────────────────────────────────────────────────────────────

export interface SubjectOption {
  id: number;
  name: string;
  code?: string;
}

export interface ClassSubjectMapping {
  id: number;
  classId: number;
  subjectId: number;
  department: string | null;
  isCompulsory: boolean;
  subjectName: string;
  subjectCode: string;
  category: string;
}

interface MyAssignments {
  isAdmin: boolean;
  classes: Array<{ id: number; name: string; [key: string]: unknown }>;
  subjects: Array<{ id: number; name: string; code?: string; [key: string]: unknown }>;
  assignments: Array<{
    classId: number;
    subjectId: number;
    department?: string;
    termId?: number;
    isActive: boolean;
  }>;
}

// ─── hook ────────────────────────────────────────────────────────────────────

/**
 * @param classId  The currently-selected class ID (pass `undefined` or `null`
 *                 when no class has been chosen yet).
 */
export function useClassSubjects(classId: number | undefined | null) {
  // My-assignments is already fetched by almost every portal page; React Query
  // will serve this from cache without a network call in most cases.
  const { data: myAssignments, isLoading: assignmentsLoading } =
    useQuery<MyAssignments>({
      queryKey: ['/api/my-assignments'],
      staleTime: 30_000,
    });

  const isAdmin = myAssignments?.isAdmin ?? false;

  // Only fetch mappings for admins and only when a class is selected.
  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<
    ClassSubjectMapping[]
  >({
    queryKey: ['/api/class-subject-mappings', classId],
    queryFn: async () => {
      if (!classId) return [];
      const res = await apiRequest(
        'GET',
        `/api/class-subject-mappings/${classId}`
      );
      return res.json();
    },
    enabled: !!classId && isAdmin,
    staleTime: 30_000,
  });

  const subjects = useMemo<SubjectOption[]>(() => {
    if (!classId) return [];

    if (isAdmin) {
      if (mappingsLoading) return [];
      // Build options directly from the mapping payload — it already carries
      // subjectName and subjectCode, so we never depend on myAssignments.subjects
      // being a complete catalog (it may be partial for large tenants).
      return mappings.map((m) => ({
        id: m.subjectId,
        name: m.subjectName,
        code: m.subjectCode,
      }));
    }

    if (!myAssignments) return [];

    // Teacher path: subjects they are actively assigned to for this class.
    const validIds = new Set(
      myAssignments.assignments
        .filter((a) => a.classId === classId && a.isActive)
        .map((a) => a.subjectId)
    );
    return myAssignments.subjects.filter((s) => validIds.has(s.id));
  }, [myAssignments, classId, isAdmin, mappings, mappingsLoading]);

  const isLoading =
    assignmentsLoading || (isAdmin && !!classId && mappingsLoading);

  return {
    /** Subjects that belong to the selected class (empty when no class chosen). */
    subjects,
    /** True while any required data is still being fetched. */
    isLoading,
    /** Whether the current user is an admin (useful for conditional UI). */
    isAdmin,
  };
}
