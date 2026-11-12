import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Play } from 'lucide-react';
import { Controller } from 'react-hook-form';
import type { ExamForm } from '../schemas';
import type { ExamManager } from '../useExamManager';

/** Wizard step — split from ExamManagement.tsx. */
export function StepOptions({ m }: { m: ExamManager }) {
  const { registerExam, examErrors, examControl, watchExam, availableGradingScales, activeGradingScaleName, watchTimerMode } = m;
  return (
    <>
                <div className="space-y-4">
                  <div className="space-y-3 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Play className="w-4 h-4" />Publishing</h4>
                    <div className="flex items-center gap-3">
                      <Controller name="isPublished" control={examControl} render={({ field }) => (
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-exam-published" />
                      )} />
                      <div>
                        <Label>Publish Immediately</Label>
                        <p className="text-xs text-muted-foreground">{watchTimerMode === 'global' ? 'Will publish at scheduled start time' : 'Make visible to students now'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Controller name="shuffleQuestions" control={examControl} render={({ field }) => (
                        <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid="switch-exam-shuffle" />
                      )} />
                      <div>
                        <Label>Shuffle Questions</Label>
                        <p className="text-xs text-muted-foreground">Randomize question order per student</p>
                      </div>
                    </div>
                    {!watchExam('isPublished') && (
                      <p className="text-xs text-muted-foreground bg-white dark:bg-gray-900 p-2 rounded border">
                        💾 Saved as draft — add questions and publish later.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <h4 className="font-medium text-sm">Auto-Grading</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { name: 'autoGradingEnabled' as keyof ExamForm, label: 'Enable Auto-Grading', testId: 'switch-auto-grading' },
                        { name: 'instantFeedback' as keyof ExamForm, label: 'Instant Feedback', testId: 'switch-instant-feedback' },
                        { name: 'showCorrectAnswers' as keyof ExamForm, label: 'Show Correct Answers After Submission', testId: 'switch-show-answers' },
                      ].map(({ name, label, testId }) => (
                        <div key={String(name)} className="flex items-center gap-3">
                          <Controller name={name as any} control={examControl} render={({ field }) => (
                            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} data-testid={testId} />
                          )} />
                          <Label>{label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <Label htmlFor="passingScore">Passing Score (%)</Label>
                        <Input id="passingScore" type="number" min="0" max="100"
                          {...registerExam('passingScore', { valueAsNumber: true })}
                          data-testid="input-passing-score" placeholder="60" />
                        {examErrors.passingScore && <p className="text-sm text-red-500 mt-1">{examErrors.passingScore.message}</p>}
                      </div>
                      <div>
                        <Label>Grading Scale</Label>
                        <Controller name="gradingScale" control={examControl} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || 'active'} data-testid="select-grading-scale">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">
                                School Active Scale {activeGradingScaleName ? `(${activeGradingScaleName})` : ''}
                              </SelectItem>
                              {availableGradingScales.filter((s: any) => s !== activeGradingScaleName).map((scaleName: any) => (
                                <SelectItem key={scaleName} value={scaleName}>{scaleName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
    </>
  );
}
