export const normalizeDept = (dept: string | null | undefined): string | null => {
  if (dept === undefined || dept === null || dept === '' || dept === 'null') return null;
  return dept;
};

export const getAssignmentKey = (
  classId: number,
  subjectId: number,
  department: string | null | undefined
): string => `${classId}-${subjectId}-${normalizeDept(department) ?? 'null'}`;

export const parseAssignmentKey = (key: string): { classId: number; subjectId: number; department: string | null } => {
  const [classId, subjectId, department] = key.split('-');
  return {
    classId: parseInt(classId),
    subjectId: parseInt(subjectId),
    department: department === 'null' ? null : department,
  };
};
