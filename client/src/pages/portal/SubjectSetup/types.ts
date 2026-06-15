export interface Subject {
  id: number;
  name: string;
  code: string;
  category: string;
  isActive: boolean;
}

export interface ClassInfo {
  id: number;
  name: string;
  level: string;
}

export interface SubjectAssignment {
  classId: number;
  subjectId: number;
  department: string | null;
  isCompulsory: boolean;
}

export type Department = 'science' | 'art' | 'commercial';

export interface ClassGroup {
  level: string;
  label: string;
  classes: ClassInfo[];
}

export interface SubjectFilter {
  search: string;
  categories: string[];
}
