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

interface PreviewData {
  sourceSession: any;
  destinationSession: any;
  outcomes: {
    class: any;
    promoted: number;
    repeating: number;
    graduated: number;
    total: number;
  }[];
  summary: {
    totalStudents: number;
    toBePromoted: number;
    repeating: number;
    graduated: number;
  };
}

interface ClassMapping {
  sourceClassId: number;
  sourceClassName: string;
  destinationClassId: number | null;
  destinationClassName: string | null;
  isGraduationLevel: boolean;
}

interface StudentOutcomeOverride {
  studentId: string;
  studentName: string;
  currentClass: string;
  outcome: PromotionOutcome;
  destinationClassId?: number;
  reason?: string;
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
  const [sourceSessionId, setSourceSessionId] = useState<number | null>(null);
  const [destSessionId, setDestSessionId] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [studentOverrides, setStudentOverrides] = useState<Map<string, StudentOutcomeOverride>>(new Map());
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
      const overridesArray = Array.from(studentOverrides.values()).map(o => ({
        studentId: o.studentId,
        outcome: o.outcome,
        destinationClassId: o.destinationClassId,
        reason: o.reason,
      }));

      const response = await apiRequest('POST', '/api/admin/promotions/execute', {
        sourceSessionId: sourceSessionId!,
        destinationSessionId: destSessionId!,
        studentOutcomes: overridesArray.length > 0 ? overridesArray : undefined,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setExecutionBatchId(data.batchId);
      setCurrentStep(5);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/promotions/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      toast({
        title: 'Promotion Complete',
        description: `Successfully promoted ${data.successCount} students`,
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
    setSourceSessionId(null);
    setDestSessionId(null);
    setPreviewData(null);
    setStudentOverrides(new Map());
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
    setSourceSessionId(null);
    setDestSessionId(null);
    setPreviewData(null);
    setStudentOverrides(new Map());
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Promotion Wizard</DialogTitle>
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
              overrides={studentOverrides}
              onOverridesChange={setStudentOverrides}
            />
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && previewData && (
            <StepReview
              data={previewData}
              overrides={studentOverrides}
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
          <Select value={sourceSessionId?.toString()} onValueChange={(v) => onSourceChange(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select source session..." />
            </SelectTrigger>
            <SelectContent>
              {completedSessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.sessionYear} ({s.status})
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
          <Select value={destSessionId?.toString()} onValueChange={(v) => onDestChange(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination session..." />
            </SelectTrigger>
            <SelectContent>
              {activeSessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.sessionYear} ({s.status})
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
  return (
    <div className="space-y-4">
      <MiniStatGrid cols={4}>
        <MiniStatCard label="Total Students" value={data.summary.totalStudents} icon={Users} />
        <MiniStatCard label="To Promote" value={data.summary.toBePromoted} icon={ArrowRight} color="text-blue-600" />
        <MiniStatCard label="Repeating" value={data.summary.repeating} icon={RotateCcw} color="text-yellow-600" />
        <MiniStatCard label="Graduating" value={data.summary.graduated} icon={GraduationCap} color="text-green-600" />
      </MiniStatGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promotion by Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Promoted</TableHead>
                <TableHead className="text-right">Repeating</TableHead>
                <TableHead className="text-right">Graduated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.outcomes.map((outcome) => (
                <TableRow key={outcome.class.id}>
                  <TableCell className="font-medium">{outcome.class.name}</TableCell>
                  <TableCell className="text-right">{outcome.total}</TableCell>
                  <TableCell className="text-right">{outcome.promoted}</TableCell>
                  <TableCell className="text-right">{outcome.repeating}</TableCell>
                  <TableCell className="text-right">{outcome.graduated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StepSetOutcomes({ data, classes, overrides, onOverridesChange }: {
  data: PreviewData;
  classes: any[];
  overrides: Map<string, StudentOutcomeOverride>;
  onOverridesChange: (overrides: Map<string, StudentOutcomeOverride>) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Build list of all students from preview data
  const allStudents: any[] = [];
  data.outcomes.forEach((outcome: any) => {
    // Students would come from a separate endpoint — for now show placeholder
  });

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure individual student outcomes. By default, students will follow their class progression rules.
          Use this step to override outcomes for specific students (e.g., mark as repeating, withdrawn, or deferred).
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Search Students (Optional)</Label>
        <Input
          placeholder="Search by student name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to use default outcomes. Individual overrides can be added after initial execution via corrections.
        </p>
      </div>

      {overrides.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Outcomes ({overrides.size})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(overrides.values()).map((override: StudentOutcomeOverride) => (
                <div key={override.studentId} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium text-sm">{override.studentName}</p>
                    <p className="text-xs text-muted-foreground">{override.currentClass}</p>
                  </div>
                  <Badge>{override.outcome}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepReview({ data, overrides, sourceSessionId, destSessionId, sessions }: any) {
  const sourceSession = sessions.find((s: any) => s.id === sourceSessionId);
  const destSession = sessions.find((s: any) => s.id === destSessionId);

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
              <p className="font-medium">{sourceSession?.sessionYear}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Destination Session</p>
              <p className="font-medium">{destSession?.sessionYear}</p>
            </div>
          </div>

          <div className="pt-3 border-t space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Total Students</span>
              <span className="font-medium">{data.summary.totalStudents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">To Promote</span>
              <span className="font-medium text-blue-600">{data.summary.toBePromoted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Repeating</span>
              <span className="font-medium text-yellow-600">{data.summary.repeating}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Graduating</span>
              <span className="font-medium text-green-600">{data.summary.graduated}</span>
            </div>
            {overrides.size > 0 && (
              <div className="flex justify-between">
                <span className="text-sm">Custom Outcomes</span>
                <span className="font-medium">{overrides.size}</span>
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
                <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>
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
