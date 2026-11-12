import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Layers } from 'lucide-react';
import { Controller } from 'react-hook-form';
import type { Exam, Class, Subject } from '@shared/schema';
import type { ExamManager } from '../useExamManager';

/** Wizard step — split from ExamManagement.tsx. */
export function StepDetails({ m }: { m: ExamManager }) {
  const { isStandalone, registerExam, examErrors, examControl, classes, subjects, subjectsLoading, teachers, selectedClassId } = m;
  return (
    <>
                  <div className="space-y-4">

                    {/* Assessment Category Picker */}
                    <div className="space-y-2">
                      <Label>Assessment Category *</Label>
                      <Controller name="assessmentCategory" control={examControl} render={({ field }) => (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange('academic')}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors ${field.value === 'academic' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-primary" />
                              <span className="text-sm font-semibold">Academic</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Updates report cards &amp; cumulative records</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange('standalone')}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors ${field.value === 'standalone' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-border hover:border-muted-foreground/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-semibold">Standalone</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Independent — no report card effect</p>
                          </button>
                        </div>
                      )} />
                      {isStandalone && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                          Standalone: results are stored independently and never affect report cards. Examples: Mock WAEC, Common Entrance, Quiz Competition.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Assessment Name *</Label>
                        <Input id="name" {...registerExam('name')} data-testid="input-exam-name" placeholder={isStandalone ? "e.g., Common Entrance Exam 2025" : "e.g., Mid-term Mathematics Test"} />
                        {examErrors.name && <p className="text-sm text-red-500 mt-1">{examErrors.name.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="date">Date *</Label>
                        <Input id="date" type="date" {...registerExam('date')} data-testid="input-exam-date" />
                        {examErrors.date && <p className="text-sm text-red-500 mt-1">{examErrors.date.message}</p>}
                      </div>
                    </div>

                    {/* Academic-only: Class and Subject */}
                    {!isStandalone && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Class *</Label>
                          <Controller name="classId" control={examControl} render={({ field }) => (
                            <Select onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) field.onChange(n); }}
                              value={field.value != null ? field.value.toString() : ''}>
                              <SelectTrigger data-testid="select-exam-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                              <SelectContent>
                                {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.classId && <p className="text-sm text-red-500 mt-1">{examErrors.classId.message}</p>}
                        </div>
                        <div>
                          <Label>Subject *</Label>
                          <Controller name="subjectId" control={examControl} render={({ field }) => (
                            <Select onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) field.onChange(n); }}
                              value={field.value != null ? field.value.toString() : ''} disabled={subjectsLoading || !selectedClassId}>
                              <SelectTrigger data-testid="select-exam-subject">
                                <SelectValue placeholder={subjectsLoading ? "Loading..." : !selectedClassId ? "Select class first" : subjects.length === 0 ? "No subjects" : "Select subject"} />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.subjectId && <p className="text-sm text-red-500 mt-1">{examErrors.subjectId.message}</p>}
                        </div>
                      </div>
                    )}

                    {/* Standalone-only: Purpose */}
                    {isStandalone && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Assessment Purpose</Label>
                          <Controller name="purpose" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger><SelectValue placeholder="Select purpose (optional)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="common_entrance">Common Entrance</SelectItem>
                                <SelectItem value="scholarship">Scholarship Exam</SelectItem>
                                <SelectItem value="mock_waec">Mock WAEC</SelectItem>
                                <SelectItem value="mock_jamb">Mock JAMB</SelectItem>
                                <SelectItem value="olympiad">Olympiad / Competition</SelectItem>
                                <SelectItem value="quiz">Quiz Competition</SelectItem>
                                <SelectItem value="practice_cbt">Practice CBT</SelectItem>
                                <SelectItem value="weekly_test">Weekly Test</SelectItem>
                                <SelectItem value="entrance_screening">Entrance Screening</SelectItem>
                                <SelectItem value="interview">Interview Assessment</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                        <div>
                          <Label>Candidate Type</Label>
                          <Controller name="candidateType" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger><SelectValue placeholder="Who can sit this?" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="internal">Internal (enrolled students)</SelectItem>
                                <SelectItem value="external">External candidates only</SelectItem>
                                <SelectItem value="both">Both internal &amp; external</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {!isStandalone && (
                        <div>
                          <Label>Exam Format *</Label>
                          <Controller name="examType" control={examControl} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger data-testid="select-exam-type"><SelectValue placeholder="Select format" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="test">Test (40% weight)</SelectItem>
                                <SelectItem value="exam">Exam (60% weight)</SelectItem>
                              </SelectContent>
                            </Select>
                          )} />
                          {examErrors.examType && <p className="text-sm text-red-500 mt-1">{examErrors.examType.message}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Test (40%) + Exam (60%) = Total (100%)</p>
                        </div>
                      )}
                      <div>
                        <Label>Teacher In-Charge</Label>
                        <Controller name="teacherInChargeId" control={examControl} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value?.toString()}>
                            <SelectTrigger data-testid="select-teacher-in-charge"><SelectValue placeholder="Select teacher (optional)" /></SelectTrigger>
                            <SelectContent>
                              {teachers && teachers.length > 0
                                ? teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)
                                : <SelectItem value="no-teachers" disabled>No teachers available</SelectItem>}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="instructions">Instructions</Label>
                      <Textarea id="instructions" {...registerExam('instructions')} data-testid="textarea-exam-instructions"
                        placeholder="Enter instructions shown to candidates before they start..." rows={3} />
                      <p className="text-xs text-muted-foreground mt-1">Shown to candidates before they start</p>
                    </div>
                  </div>
    </>
  );
}
