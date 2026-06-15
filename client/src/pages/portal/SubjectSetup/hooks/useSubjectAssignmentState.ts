import { useState, useCallback } from 'react';
import type { SubjectAssignment, Department } from '../types';
import { getAssignmentKey, normalizeDept } from '../utils/assignmentKeys';

const DEPARTMENTS: Department[] = ['science', 'art', 'commercial'];

interface UseSubjectAssignmentStateProps {
  currentAssignments: SubjectAssignment[];
  ssClassIds: Set<number>;
}

export function useSubjectAssignmentState({ currentAssignments, ssClassIds }: UseSubjectAssignmentStateProps) {
  const [pendingChanges, setPendingChanges] = useState<Map<string, SubjectAssignment>>(new Map());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setPendingChanges(new Map());
    setPendingRemovals(new Set());
  }, []);

  const hasPendingChanges = pendingChanges.size > 0 || pendingRemovals.size > 0;
  const pendingCount = pendingChanges.size + pendingRemovals.size;

  const existsInDatabase = useCallback(
    (classId: number, subjectId: number, department: string | null | undefined): boolean => {
      const normalizedDept = normalizeDept(department);
      return currentAssignments.some(
        (a) => a.classId === classId && a.subjectId === subjectId && normalizeDept(a.department) === normalizedDept
      );
    },
    [currentAssignments]
  );

  const hasNullDeptRecord = useCallback(
    (classId: number, subjectId: number): boolean =>
      currentAssignments.some(
        (a) => a.classId === classId && a.subjectId === subjectId && normalizeDept(a.department) === null
      ),
    [currentAssignments]
  );

  const isAssigned = useCallback(
    (classId: number, subjectId: number, department: string | null = null): boolean => {
      const key = getAssignmentKey(classId, subjectId, department);
      const nullKey = getAssignmentKey(classId, subjectId, null);

      if (pendingRemovals.has(key)) return false;
      if (pendingChanges.has(key)) return true;

      if (department !== null && ssClassIds.has(classId)) {
        if (pendingRemovals.has(nullKey)) return false;
      }

      return existsInDatabase(classId, subjectId, department);
    },
    [pendingRemovals, pendingChanges, existsInDatabase, ssClassIds]
  );

  const toggle = useCallback(
    (classId: number, subjectId: number, department: string | null = null, checkedOverride?: boolean) => {
      const shouldAssign =
        typeof checkedOverride === 'boolean' ? checkedOverride : !isAssigned(classId, subjectId, department);

      const key = getAssignmentKey(classId, subjectId, department);
      const nullKey = getAssignmentKey(classId, subjectId, null);
      const isSSClass = ssClassIds.has(classId);
      const hasNullRecord = department !== null && isSSClass && hasNullDeptRecord(classId, subjectId);

      if (shouldAssign) {
        const nullWasBeingRemoved = pendingRemovals.has(nullKey);

        let allDepsAssigned = false;
        if (hasNullRecord && nullWasBeingRemoved && department !== null) {
          const otherDepts = DEPARTMENTS.filter((d) => d !== department);
          allDepsAssigned = otherDepts.every((d) => isAssigned(classId, subjectId, d));
        }

        setPendingRemovals((prev) => {
          const next = new Set(prev);
          next.delete(key);
          if (hasNullRecord && nullWasBeingRemoved && allDepsAssigned) next.delete(nullKey);
          return next;
        });

        setPendingChanges((prev) => {
          const next = new Map(prev);
          if (hasNullRecord && nullWasBeingRemoved && allDepsAssigned && department !== null) {
            DEPARTMENTS.filter((d) => d !== department).forEach((d) => {
              const otherKey = getAssignmentKey(classId, subjectId, d);
              if (!existsInDatabase(classId, subjectId, d)) next.delete(otherKey);
            });
          }

          const hasExact = existsInDatabase(classId, subjectId, department);
          if (!hasExact) {
            const nullStillRemoving = pendingRemovals.has(nullKey) && !allDepsAssigned;
            if (!hasNullRecord || nullStillRemoving) {
              next.set(key, { classId, subjectId, department: normalizeDept(department), isCompulsory: false });
            }
          } else {
            next.delete(key);
          }
          return next;
        });
      } else {
        const hasExact = existsInDatabase(classId, subjectId, department);
        const replacementsNeeded: Array<{ key: string; dept: string }> = [];

        if (hasNullRecord) {
          DEPARTMENTS.filter((d) => d !== department).forEach((d) => {
            const otherKey = getAssignmentKey(classId, subjectId, d);
            const hasOtherExact = existsInDatabase(classId, subjectId, d);
            if (!hasOtherExact && isAssigned(classId, subjectId, d)) {
              replacementsNeeded.push({ key: otherKey, dept: d });
            }
          });
        }

        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.delete(key);
          replacementsNeeded.forEach(({ key: rk, dept }) => {
            next.set(rk, { classId, subjectId, department: dept, isCompulsory: false });
          });
          return next;
        });

        setPendingRemovals((prev) => {
          const next = new Set(prev);
          if (hasNullRecord) next.add(nullKey);
          if (hasExact) next.add(key);
          return next;
        });
      }
    },
    [isAssigned, existsInDatabase, hasNullDeptRecord, ssClassIds, pendingRemovals]
  );

  const toggleAllForClasses = useCallback(
    (classes: Array<{ id: number }>, subjectId: number, department: string | null, checked: boolean) => {
      const newRemovals = new Set(pendingRemovals);
      const newChanges = new Map(pendingChanges);

      classes.forEach(({ id: classId }) => {
        const key = getAssignmentKey(classId, subjectId, department);
        const nullKey = getAssignmentKey(classId, subjectId, null);
        const isSSClass = ssClassIds.has(classId);
        const hasNullRecord = department !== null && isSSClass && hasNullDeptRecord(classId, subjectId);
        const hasExact = existsInDatabase(classId, subjectId, department);

        if (checked) {
          newRemovals.delete(key);
          if (hasNullRecord) {
            const otherDepts = DEPARTMENTS.filter((d) => d !== department);
            const allWillBeAssigned = otherDepts.every((d) => isAssigned(classId, subjectId, d));
            if (allWillBeAssigned) {
              newRemovals.delete(nullKey);
              otherDepts.forEach((d) => {
                const ok = getAssignmentKey(classId, subjectId, d);
                if (!existsInDatabase(classId, subjectId, d)) newChanges.delete(ok);
              });
            }
          }
          if (!hasExact) {
            const nullStillRemoving = newRemovals.has(nullKey);
            if (!hasNullRecord || nullStillRemoving) {
              newChanges.set(key, { classId, subjectId, department: normalizeDept(department), isCompulsory: false });
            }
          } else {
            newChanges.delete(key);
          }
        } else {
          newChanges.delete(key);
          if (hasExact) newRemovals.add(key);
          if (hasNullRecord) {
            newRemovals.add(nullKey);
            DEPARTMENTS.filter((d) => d !== department).forEach((d) => {
              const ok = getAssignmentKey(classId, subjectId, d);
              const hasOtherExact = existsInDatabase(classId, subjectId, d);
              if (!hasOtherExact && isAssigned(classId, subjectId, d)) {
                newChanges.set(ok, { classId, subjectId, department: d, isCompulsory: false });
              }
            });
          }
        }
      });

      setPendingRemovals(newRemovals);
      setPendingChanges(newChanges);
    },
    [pendingRemovals, pendingChanges, ssClassIds, hasNullDeptRecord, existsInDatabase, isAssigned]
  );

  const getSerialised = useCallback(() => {
    const additions = Array.from(pendingChanges.values());
    const removals = Array.from(pendingRemovals).map((key) => {
      const [classId, subjectId, department] = key.split('-');
      return {
        classId: parseInt(classId),
        subjectId: parseInt(subjectId),
        department: department === 'null' ? null : department,
      };
    });
    return { additions, removals };
  }, [pendingChanges, pendingRemovals]);

  return {
    pendingChanges,
    pendingRemovals,
    hasPendingChanges,
    pendingCount,
    isAssigned,
    toggle,
    toggleAllForClasses,
    existsInDatabase,
    reset,
    getSerialised,
  };
}
