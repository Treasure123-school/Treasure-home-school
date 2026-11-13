// ─── Shared types ─────────────────────────────────────────────

export interface ContextFilters {
  classId?:   number;
  subjectId?: number;
  termId?:    number;   // Concrete termId for stamping new questions
  termName?:  string;   // Cross-session filter: 'all' | 'first' | 'second' | 'third'
  bankId?:    number;
}
