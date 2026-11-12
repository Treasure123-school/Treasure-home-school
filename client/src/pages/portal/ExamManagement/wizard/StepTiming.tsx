import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Clock, Target, DollarSign, Ticket } from 'lucide-react';
import { Controller } from 'react-hook-form';
import type { Class } from '@shared/schema';
import type { ExamManager } from '../useExamManager';

/** Wizard step — split from ExamManagement.tsx. */
export function StepTiming({ m }: { m: ExamManager }) {
  const { watchGlobalStartTime, isStandalone, registerExam, examErrors, examControl, terms, watchTimerMode } = m;
  return (
    <>
                  <div className="space-y-4">
                    {/* Academic-only: Term */}
                    {!isStandalone && (
                      <div>
                        <Label>Academic Term *</Label>
                        <Controller name="termId" control={examControl} render={({ field }) => (
                          <Select onValueChange={(v) => { const n = parseInt(v); if (!isNaN(n)) field.onChange(n); }}
                            value={field.value != null ? field.value.toString() : ''}>
                          <SelectTrigger data-testid="select-term"><SelectValue placeholder="Select term" /></SelectTrigger>
                          <SelectContent>
                            {terms && terms.length > 0
                              ? terms.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name} - {t.year}</SelectItem>)
                              : <SelectItem value="no-terms" disabled>No academic terms available</SelectItem>}
                          </SelectContent>
                        </Select>
                        )} />
                        {examErrors.termId && <p className="text-sm text-red-500 mt-1">{examErrors.termId.message}</p>}
                      </div>
                    )}

                    {/* Standalone-only: Venue, Target, Registration */}
                    {isStandalone && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Venue / Location</Label>
                            <Input {...registerExam('venue')} placeholder="e.g., School Hall, CBT Lab" />
                          </div>
                          <div>
                            <Label>Target Audience</Label>
                            <Controller name="targetType" control={examControl} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ''}>
                                <SelectTrigger><SelectValue placeholder="Who is this for?" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="whole_school">Whole School</SelectItem>
                                  <SelectItem value="class">Specific Class</SelectItem>
                                  <SelectItem value="selected_students">Selected Students</SelectItem>
                                  <SelectItem value="external">External Candidates</SelectItem>
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-amber-600" />Registration
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Registration Fee (₦)</Label>
                              <Input type="number" min="0" {...registerExam('registrationFee', { valueAsNumber: true })} placeholder="0 = free" />
                              <p className="text-xs text-muted-foreground mt-1">Leave 0 or blank for free entry</p>
                            </div>
                            <div>
                              <Label>Registration Deadline</Label>
                              <Input type="date" {...registerExam('registrationDeadline')} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Controller name="registrationOpen" control={examControl} render={({ field }) => (
                              <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                            )} />
                            <div>
                              <Label>Open Registration Now</Label>
                              <p className="text-xs text-muted-foreground">Allow candidates to register for this assessment</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-muted/40">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Ticket className="w-4 h-4" />Candidate Features
                          </h4>
                          {[
                            { name: 'generateCandidateNumbers' as const, label: 'Generate Candidate Numbers', desc: 'Auto-assign unique exam numbers to each candidate' },
                            { name: 'generateAdmitCards' as const, label: 'Generate Admit Cards', desc: 'Produce printable admit cards for candidates' },
                            { name: 'certificateEnabled' as const, label: 'Generate Certificates', desc: 'Issue digital/printable certificates to candidates' },
                            { name: 'leaderboardEnabled' as const, label: 'Enable Leaderboard', desc: 'Show ranked results after the assessment ends' },
                          ].map(({ name, label, desc }) => (
                            <div key={name} className="flex items-center gap-3">
                              <Controller name={name} control={examControl} render={({ field }) => (
                                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                              )} />
                              <div>
                                <Label>{label}</Label>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 p-3 border rounded-lg bg-primary/5 dark:bg-primary/5">
                      <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Timer Mode</h4>
                      <Controller name="timerMode" control={examControl} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || 'individual'}>
                          <SelectTrigger data-testid="select-timer-mode"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">Individual Timer — each candidate starts their own</SelectItem>
                            <SelectItem value="global">Global Timer — all candidates start/end together</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                      {watchTimerMode === 'individual' && (
                        <p className="text-xs text-muted-foreground">Candidates can start at any time; each gets the full duration from when they click Start.</p>
                      )}
                      {watchTimerMode === 'global' && (
                        <p className="text-xs text-muted-foreground">All candidates must complete within the scheduled window. Auto-submits at end time.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="totalMarks">Total Marks *</Label>
                        <Input id="totalMarks" type="number" {...registerExam('totalMarks', { valueAsNumber: true })}
                          data-testid="input-exam-total-marks" placeholder="100" />
                        {examErrors.totalMarks && <p className="text-sm text-red-500 mt-1">{examErrors.totalMarks.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="timeLimit">{watchTimerMode === 'individual' ? 'Duration/Candidate' : 'Total Duration'} (min) *</Label>
                        <Input id="timeLimit" type="number" {...registerExam('timeLimit', { valueAsNumber: true })}
                          data-testid="input-exam-time-limit" placeholder="60" />
                        {examErrors.timeLimit && <p className="text-sm text-red-500 mt-1">{examErrors.timeLimit.message}</p>}
                      </div>
                    </div>

                    {watchTimerMode === 'global' && (
                      <div className="border rounded-lg p-3 bg-primary/5 dark:bg-primary/5 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Global Timer Window</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input id="startTime" type="datetime-local" {...registerExam('startTime')}
                              data-testid="input-exam-start-time" min={new Date().toISOString().slice(0, 16)} />
                            {examErrors.startTime && <p className="text-sm text-red-500 mt-1">{examErrors.startTime.message}</p>}
                          </div>
                          <div>
                            <Label htmlFor="endTime">End Time</Label>
                            <Input id="endTime" type="datetime-local" {...registerExam('endTime')}
                              data-testid="input-exam-end-time"
                              min={watchGlobalStartTime ? (typeof watchGlobalStartTime === 'string' ? watchGlobalStartTime : new Date(watchGlobalStartTime).toISOString().slice(0, 16)) : new Date().toISOString().slice(0, 16)} />
                            {examErrors.endTime && <p className="text-sm text-red-500 mt-1">{examErrors.endTime.message}</p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
    </>
  );
}
