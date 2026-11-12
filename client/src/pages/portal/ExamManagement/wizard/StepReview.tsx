import { Badge } from '@/components/ui/badge';
import { BookOpen, Layers, Target } from 'lucide-react';
import type { Exam, Class, Subject } from '@shared/schema';
import type { ExamManager } from '../useExamManager';

/** Wizard step — split from ExamManagement.tsx. */
export function StepReview({ m }: { m: ExamManager }) {
  const { editingExam, isStandalone, watchExam, allClasses, allSubjects, terms } = m;
  return (
    <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    {isStandalone
                      ? <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"><Layers className="w-3 h-3 mr-1" />Standalone Assessment</Badge>
                      : <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300"><BookOpen className="w-3 h-3 mr-1" />Academic Assessment</Badge>
                    }
                  </div>
                  <p className="text-sm text-muted-foreground">Review your assessment before {editingExam ? 'updating' : 'creating'}.</p>
                  {[
                    { label: 'Name', value: watchExam('name') },
                    { label: 'Date', value: watchExam('date') },
                    ...(!isStandalone ? [
                      { label: 'Class', value: (allClasses as any[]).find((c: any) => c.id === watchExam('classId'))?.name || '—' },
                      { label: 'Subject', value: (allSubjects as any[]).find((s: any) => s.id === watchExam('subjectId'))?.name || '—' },
                      { label: 'Format', value: watchExam('examType') === 'exam' ? 'Exam (60% weight)' : 'Test (40% weight)' },
                      { label: 'Term', value: (() => { const t = (terms as any[]).find((t: any) => t.id === watchExam('termId')); return t ? `${t.name} - ${t.year}` : '—'; })() },
                    ] : [
                      { label: 'Purpose', value: watchExam('purpose' as any) || '—' },
                      { label: 'Venue', value: (watchExam as any)('venue') || '—' },
                      { label: 'Target', value: (watchExam as any)('targetType') || '—' },
                      { label: 'Registration Fee', value: (() => { const fee = (watchExam as any)('registrationFee'); return fee && fee > 0 ? `₦${Number(fee).toLocaleString()}` : 'Free'; })() },
                      { label: 'Candidate Numbers', value: (watchExam as any)('generateCandidateNumbers') ? 'Yes' : 'No' },
                      { label: 'Admit Cards', value: (watchExam as any)('generateAdmitCards') ? 'Yes' : 'No' },
                    ]),
                    { label: 'Total Marks', value: watchExam('totalMarks') },
                    { label: 'Duration', value: watchExam('timeLimit') ? `${watchExam('timeLimit')} min` : '—' },
                    { label: 'Timer Mode', value: watchExam('timerMode') === 'individual' ? 'Individual' : 'Global' },
                    { label: 'Status', value: watchExam('isPublished') ? 'Published' : 'Draft' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right">{String(value ?? '—')}</span>
                    </div>
                  ))}
                </div>
    </>
  );
}
