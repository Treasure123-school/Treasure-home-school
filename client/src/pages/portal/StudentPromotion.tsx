import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, MiniStatCard, MiniStatGrid, EmptyState } from '@/components/shared';
import { 
  ArrowRight, Users, TrendingUp, RotateCcw, GraduationCap, UserX, 
  Clock, ChevronRight, ChevronLeft, Check, AlertCircle, Calendar,
  CheckCircle2, XCircle, Loader2, History, ArrowUpCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PromotionOutcome = 'promoted' | 'repeating' | 'graduated' | 'withdrawn' | 'deferred';

interface PreviewStudent {
  id: string;
  name: string;
  admissionNumber: string;
  currentClassId: number;
  currentClassName: string;
  department: string | null;
  accountStatus: string;
  hasSourceEnrollment: boolean;
  alreadyProcessed: boolean;
  suggestedDestinationClassId: number | null;
  suggestedDestinationClassName: string | null;
  suggestedOutcome: PromotionOutcome;
}

interface PreviewData {
  sourceSession: any;
  destinationSession: any;
  classGroups: {
    id: number;
    name: string;
    level: string;
    sequenceOrder: number;
    nextClassId: number | null;
    nextClassName: string | null;
    isGraduationLevel: boolean;
    studentCount: number;
  }[];
  stats: {
    totalActiveStudents: number;
    awaitingDecision: number;
    alreadyProcessed: number;
    graduatingStudents: number;
    promoted: number;
    repeating: number;
    graduated: number;
    withdrawn: number;
    deferred: number;
  };
  students: PreviewStudent[];
  existingBatches: any[];
}

interface ClassMapping {
  sourceClassId: number;
  sourceClassName: string;
  destinationClassId: number | null;
  destinationClassName: string | null;
  isGraduationLevel: boolean;
}

/** Per-student outcome assignment (defaults from preview, overridable in Step 3). */
interface StudentAssignment {
  outcome: PromotionOutcome;
  toClassId: number | null;
  overridden: boolean;
}

const WIZARD_STEPS = [
  { id: 1, title: 'Select Sessions', desc: 'Choose source and destination academic years' },
  { id: 2, title: 'Preview Students', desc: 'Review students to be promoted' },
  { id: 3, title: 'Set Outcomes', desc: 'Configure individual student outcomes' },
  { id: 4, title: 'Review & Confirm', desc: 'Final review before promotion' },
  { id: 5, title: 'Execute', desc: 'Promotion in progress' },
];

export default function StudentPromotion() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [sourceSessionId, setSourceSessionId] = useState<string>('');
  const [destSessionId, setDestSessionId] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, StudentAssignment>>({});
  const [executionBatchId, setExecutionBatchId] = useState<number | null>(null);

  // Fetch academic sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['/api/sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/sessions');
      return await response.json();
    },
  });

  // Fetch classes for mappings
  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  // Fetch promotion history
  const { data: historyData = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['/api/admin/promotions/history'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/promotions/history');
      return await response.json();
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', `/api/admin/promotions/preview?sourceSessionId=${sourceSessionId}&destinationSessionId=${destSessionId}`);
      return await response.json();
    },
    onSuccess: (data) => {
      // Initialize per-student assignments from server-suggested outcomes
      const assignments: Record<string, StudentAssignment> = {};
      (data.students || []).forEach((s: PreviewStudent) => {
        assignments[s.id] = {
          outcome: s.suggestedOutcome || 'promoted',
          toClassId: s.suggestedDestinationClassId,
          overridden: false,
        };
      });
      setStudentAssignments(assignments);
      setPreviewData(data);
      setCurrentStep(2);
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to load promotion preview',
        variant: 'destructive',
      });
    },
  });

  // Execute promotion mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error('No preview data');

      // Send ALL students with their (possibly overridden) outcomes
      const students = previewData.students.map((s) => ({
        studentId: s.id,
        outcome: studentAssignments[s.id]?.outcome || s.suggestedOutcome || 'promoted',
        toClassId: studentAssignments[s.id]?.toClassId ?? s.suggestedDestinationClassId ?? null,
        reason: studentAssignments[s.id]?.overridden ? `Manual override to ${studentAssignments[s.id].outcome}` : undefined,
      }));

      const response = await apiRequest('POST', '/api/admin/promotions/execute', {
        sourceSessionId: Number(sourceSessionId),
        destinationSessionId: Number(destSessionId),
        students,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setExecutionBatchId(data.batch?.id ?? null);
      setCurrentStep(5);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promotions/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      const b = data.batch || {};
      const failed = b.failedCount || 0;
      toast({
        title: failed > 0 ? 'Promotion Completed with Errors' : 'Promotion Complete',
        description: failed > 0
          ? `Processed ${b.totalStudents ?? 0} students: ${b.promotedCount ?? 0} promoted, ${b.repeatingCount ?? 0} repeating, ${b.graduatedCount ?? 0} graduated, ${failed} failed`
          : `Processed ${b.totalStudents ?? 0} students: ${b.promotedCount ?? 0} promoted, ${b.repeatingCount ?? 0} repeating, ${b.graduatedCount ?? 0} graduated`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Promotion Failed',
        description: error.message || 'Failed to execute promotion',
        variant: 'destructive',
      });
    },
  });

  const handleStartWizard = () => {
    setIsWizardOpen(true);
    setCurrentStep(1);
    setSourceSessionId('');
    setDestSessionId('');
    setPreviewData(null);
    setStudentAssignments({});
    setExecutionBatchId(null);
  };

  const handlePreview = () => {
    if (!sourceSessionId || !destSessionId) {
      toast({
        title: 'Missing Selection',
        description: 'Please select both source and destination sessions',
        variant: 'destructive',
      });
      return;
    }
    previewMutation.mutate();
  };

  const handleNext = () => {
    if (currentStep === 1) {
      handlePreview();
    } else if (currentStep < 5) {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleExecute = () => {
    executeMutation.mutate();
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setCurrentStep(1);
    setSourceSessionId('');
    setDestSessionId('');
    setPreviewData(null);
    setStudentAssignments({});
    setExecutionBatchId(null);
  };

  const completedSessions = sessions.filter((s: any) => s.status === 'completed');
  const activeSessions = sessions.filter((s: any) => s.status === 'active');

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Student Promotion & Rollover"
        description="Bulk-promote students between academic sessions and manage academic year transitions"
        icon={ArrowUpCircle}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="wizard">Promotion Wizard</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Start New Promotion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The promotion wizard will guide you through bulk-promoting students from one academic session to the next.
                    You can preview changes before executing.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleStartWizard} size="lg" className="w-full sm:w-auto">
                  <ArrowUpCircle className="mr-2 h-5 w-5" />
                  Start Promotion Wizard
                </Button>
              </div>
            </CardContent>
          </Card>

          {historyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Promotions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {historyData.slice(0, 3).map((batch: any) => (
                    <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{batch.sourceSessionYear} → {batch.destinationSessionYear}</p>
                        <p className="text-sm text-muted-foreground">
                          {batch.promotedCount} promoted, {batch.graduatedCount} graduated
                        </p>
                      </div>
                      <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'failed' ? 'destructive' : 'secondary'}>
                        {batch.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryView data={historyData} isLoading={loadingHistory} />
        </TabsContent>
      </Tabs>

      {/* Wizard Dialog */}
      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="wizard-description">
          <DialogHeader>
            <DialogTitle>Student Promotion Wizard</DialogTitle>
            <p id="wizard-description" className="sr-only">
              A 5-step guided process to bulk-promote students between academic sessions
            </p>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-0 mb-1">
            {WIZARD_STEPS.map((step, i) => (
              <div key={step.id} className={`flex items-center ${i < WIZARD_STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors flex-shrink-0 ${
                  currentStep > step.id ? 'bg-primary border-primary text-primary-foreground' :
                  currentStep === step.id ? 'border-primary text-primary' :
                  'border-muted-foreground/30 text-muted-foreground'
                }`}>
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-primary mb-3">{WIZARD_STEPS[currentStep - 1].title}</p>
          <p className="text-xs text-muted-foreground mb-4">{WIZARD_STEPS[currentStep - 1].desc}</p>

          {/* Step 1: Select Sessions */}
          {currentStep === 1 && (
            <StepSelectSessions
              sessions={sessions}
              completedSessions={completedSessions}
              activeSessions={activeSessions}
              sourceSessionId={sourceSessionId}
              destSessionId={destSessionId}
              onSourceChange={setSourceSessionId}
              onDestChange={setDestSessionId}
            />
          )}

          {/* Step 2: Preview */}
          {currentStep === 2 && previewData && (
            <StepPreview data={previewData} />
          )}

          {/* Step 3: Set Outcomes */}
          {currentStep === 3 && previewData && (
            <StepSetOutcomes
              data={previewData}
              classes={classes}
              assignments={studentAssignments}
              onAssignmentsChange={setStudentAssignments}
            />
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && previewData && (
            <StepReview
              data={previewData}
              assignments={studentAssignments}
              sourceSessionId={sourceSessionId}
              destSessionId={destSessionId}
              sessions={sessions}
            />
          )}

          {/* Step 5: Execute Result */}
          {currentStep === 5 && (
            <StepExecuteResult batchId={executionBatchId} />
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep === 1 ? handleCloseWizard : handleBack}
              disabled={currentStep === 5}
            >
              {currentStep === 1 ? 'Cancel' : currentStep === 5 ? 'Close' : <><ChevronLeft className="w-4 h-4 mr-1" />Back</>}
            </Button>
            {currentStep < 4 && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={currentStep === 1 && (!sourceSessionId || !destSessionId)}
              >
                {currentStep === 1 && previewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            )}
            {currentStep === 4 && (
              <Button
                type="button"
                onClick={handleExecute}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Execute Promotion
                  </>
                )}
              </Button>
            )}
            {currentStep === 5 && (
              <Button type="button" onClick={handleCloseWizard}>
                Done
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Step Components
function StepSelectSessions({ sessions, completedSessions, activeSessions, sourceSessionId, destSessionId, onSourceChange, onDestChange }: any) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Select a completed source session and an active destination session. Students will be promoted from source to destination.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Source Session (Completed)</Label>
          <Select value={sourceSessionId || ''} onValueChange={onSourceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select source session..." />
            </SelectTrigger>
            <SelectContent>
              {completedSessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.year || s.sessionYear} ({s.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {completedSessions.length} completed session(s) available
          </p>
        </div>

        <div className="space-y-2">
          <Label>Destination Session (Active)</Label>
          <Select value={destSessionId || ''} onValueChange={onDestChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination session..." />
            </SelectTrigger>
            <SelectContent>
              {activeSessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.year || s.sessionYear} ({s.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {activeSessions.length} active session(s) available
          </p>
        </div>
      </div>
    </div>
  );
}

function StepPreview({ data }: { data: PreviewData }) {
  const classesWithStudents = data.classGroups.filter(c => c.studentCount > 0);
  
  return (
    <div className="space-y-4">
      <MiniStatGrid cols={4}>
        <MiniStatCard label="Total Students" value={data.stats.totalActiveStudents} icon={Users} />
        <MiniStatCard label="To Promote" value={data.stats.promoted} icon={ArrowRight} color="text-blue-600" />
        <MiniStatCard label="Repeating" value={data.stats.repeating} icon={RotateCcw} color="text-yellow-600" />
        <MiniStatCard label="Graduating" value={data.stats.graduated} icon={GraduationCap} color="text-green-600" />
      </MiniStatGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class Progression Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {classesWithStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Current Class</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Next Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classesWithStudents.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.level}</TableCell>
                    <TableCell className="text-right">{cls.studentCount}</TableCell>
                    <TableCell>
                      {cls.isGraduationLevel ? (
                        <Badge variant="secondary">Graduation</Badge>
                      ) : cls.nextClassName ? (
                        <span className="text-sm">{cls.nextClassName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No students found in source session
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepSetOutcomes({ data, classes, assignments, onAssignmentsChange }: {
  data: PreviewData;
  classes: any[];
  assignments: Record<string, StudentAssignment>;
  onAssignmentsChange: (assignments: Record<string, StudentAssignment>) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');

  const handleUpdate = (studentId: string, patch: Partial<StudentAssignment>) => {
    const current = assignments[studentId];
    if (!current) return;
    onAssignmentsChange({
      ...assignments,
      [studentId]: { ...current, ...patch, overridden: true },
    });
  };

  const handleReset = (studentId: string) => {
    const s = data.students.find(st => st.id === studentId);
    if (!s) return;
    onAssignmentsChange({
      ...assignments,
      [studentId]: {
        outcome: s.suggestedOutcome || 'promoted',
        toClassId: s.suggestedDestinationClassId,
        overridden: false,
      },
    });
  };

  const filteredStudents = data.students.filter((s) => {
    if (classFilter !== 'all' && s.currentClassId !== Number(classFilter)) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(search) ||
      s.admissionNumber?.toLowerCase().includes(search) ||
      s.currentClassName?.toLowerCase().includes(search)
    );
  });

  const overrideCount = Object.values(assignments).filter(a => a.overridden).length;

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Each student shows the server-suggested outcome based on class progression rules. Change any student's outcome below —
          only changed students count as overrides. Students already processed in a previous batch are skipped automatically.
        </AlertDescription>
      </Alert>

      {overrideCount > 0 && (
        <p className="text-sm font-medium text-amber-600">
          ⚠ {overrideCount} student(s) have custom overrides
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Name, admission number or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Filter by Current Class</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {data.classGroups.filter(c => c.studentCount > 0).map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name} ({c.studentCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md max-h-80 overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No students match your search</p>
        ) : (
          filteredStudents.map((student) => {
            const a = assignments[student.id];
            if (!a) return null;
            return (
              <div key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border-b last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{student.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {student.currentClassName}
                    {student.alreadyProcessed && ' • ✓ Already processed (will be skipped)'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select
                    value={a.outcome}
                    onValueChange={(v) => handleUpdate(student.id, { outcome: v as PromotionOutcome })}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promoted">Promoted</SelectItem>
                      <SelectItem value="repeating">Repeating</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                      <SelectItem value="deferred">Deferred</SelectItem>
                    </SelectContent>
                  </Select>
                  {(a.outcome === 'promoted' || a.outcome === 'repeating') && (
                    <Select
                      value={a.toClassId?.toString() || ''}
                      onValueChange={(v) => handleUpdate(student.id, { toClassId: v ? Number(v) : null })}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Default class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls: any) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {a.overridden && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Reset to suggested outcome"
                      onClick={() => handleReset(student.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {a.overridden && (
                    <Badge variant="outline" className="text-[10px] px-1.5">overridden</Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Showing {filteredStudents.length} of {data.students.length} students
      </p>
    </div>
  );
}

function StepReview({ data, assignments, sourceSessionId, destSessionId, sessions }: any) {
  const sourceSession = sessions.find((s: any) => s.id === Number(sourceSessionId));
  const destSession = sessions.find((s: any) => s.id === Number(destSessionId));

  return (
    <div className="space-y-4">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          Review the promotion summary below. Click "Execute Promotion" to proceed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promotion Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Source Session</p>
              <p className="font-medium">{sourceSession?.year || sourceSession?.sessionYear}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destination Session</p>
              <p className="font-medium">{destSession?.year || destSession?.sessionYear}</p>
            </div>
          </div>

          <div className="pt-3 border-t space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total Students</span>
              <span className="font-medium">{data.stats.totalActiveStudents}</span>
            </div>
            {(() => {
              // Live counts from the actual per-student assignments
              const counts: Record<string, number> = {};
              ((Object.values(assignments)) as StudentAssignment[]).forEach((a) => {
                counts[a.outcome] = (counts[a.outcome] || 0) + 1;
              });
              const outcomeLabels: Record<string, string> = {
                promoted: 'To Promote',
                repeating: 'Repeating',
                graduated: 'Graduating',
                withdrawn: 'Withdrawn',
                deferred: 'Deferred',
              };
              const colors: Record<string, string> = {
                promoted: 'text-blue-600',
                repeating: 'text-yellow-600',
                graduated: 'text-green-600',
                withdrawn: 'text-red-600',
                deferred: 'text-purple-600',
              };
              return Object.keys(outcomeLabels).filter(k => counts[k] > 0).map((k) => (
                <div key={k} className="flex justify-between">
                  <span className="text-sm">{outcomeLabels[k]}</span>
                  <span className={`font-medium ${colors[k]}`}>{counts[k]}</span>
                </div>
              ));
            })()}
            {(Object.values(assignments) as StudentAssignment[]).filter(a => a.overridden).length > 0 && (
              <div className="flex justify-between">
                <span className="text-sm">Custom Overrides</span>
                <span className="font-medium">{(Object.values(assignments) as StudentAssignment[]).filter(a => a.overridden).length}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepExecuteResult({ batchId }: { batchId: number | null }) {
  const { data: batchDetail } = useQuery({
    queryKey: ['/api/admin/promotions/history', batchId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/promotions/history/${batchId}`);
      return await response.json();
    },
    enabled: !!batchId,
  });

  if (!batchDetail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const successCount = batchDetail.batch.promotedCount + batchDetail.batch.graduatedCount;
  const failedCount = batchDetail.batch.failedCount;

  return (
    <div className="space-y-4">
      <Alert className={failedCount === 0 ? 'border-green-500' : 'border-yellow-500'}>
        {failedCount === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />}
        <AlertDescription>
          {failedCount === 0 ? (
            <>Promotion completed successfully. All {successCount} students processed.</>
          ) : (
            <>Promotion completed with {failedCount} error(s). {successCount} students processed successfully.</>
          )}
        </AlertDescription>
      </Alert>

      <MiniStatGrid cols={4}>
        <MiniStatCard label="Promoted" value={batchDetail.batch.promotedCount} icon={ArrowRight} color="text-blue-600" />
        <MiniStatCard label="Repeating" value={batchDetail.batch.repeatingCount} icon={RotateCcw} color="text-yellow-600" />
        <MiniStatCard label="Graduated" value={batchDetail.batch.graduatedCount} icon={GraduationCap} color="text-green-600" />
        <MiniStatCard label="Failed" value={failedCount} icon={XCircle} color="text-red-600" />
      </MiniStatGrid>

      {failedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failed Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Some students could not be promoted. You can review and correct them in the History tab.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoryView({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No Promotion History"
        description="No student promotions have been executed yet"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotion History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Transition</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Promoted</TableHead>
              <TableHead className="text-right">Graduated</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((batch: any) => (
              <TableRow key={batch.id}>
                <TableCell>
                  {batch.executedAt 
                    ? new Date(batch.executedAt).toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : batch.createdAt 
                      ? new Date(batch.createdAt).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })
                      : 'N/A'
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{batch.sourceSessionYear}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{batch.destinationSessionYear}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{batch.totalStudents}</TableCell>
                <TableCell className="text-right">{batch.promotedCount}</TableCell>
                <TableCell className="text-right">{batch.graduatedCount}</TableCell>
                <TableCell className="text-right">{batch.failedCount}</TableCell>
                <TableCell>
                  <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'failed' ? 'destructive' : 'secondary'}>
                    {batch.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
