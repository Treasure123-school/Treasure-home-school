import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wrench,
  RefreshCw,
  Zap,
  FilePlus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react';

// ─── Shared result display ──────────────────────────────────────────────────

interface ResultItem {
  label: string;
  value: number | string;
  variant?: 'success' | 'warning' | 'error' | 'neutral';
}

function ResultBadge({ label, value, variant = 'neutral' }: ResultItem) {
  const cls = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  }[variant];
  return (
    <div className={`rounded-md border px-3 py-2 text-sm font-medium flex flex-col gap-0.5 ${cls}`}>
      <span className="text-xs font-normal opacity-70">{label}</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  );
}

interface ToolResultProps {
  data: Record<string, any> | null;
  fields: Array<{ key: string; label: string; variant?: ResultItem['variant'] }>;
}

function ToolResult({ data, fields }: ToolResultProps) {
  const [showErrors, setShowErrors] = useState(false);
  if (!data) return null;

  const errors: string[] = data.errors || [];

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {fields.map(({ key, label, variant }) => (
          <ResultBadge key={key} label={label} value={data[key] ?? 0} variant={variant} />
        ))}
      </div>
      {data.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}
      {errors.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive px-0"
            onClick={() => setShowErrors(v => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.length} error{errors.length !== 1 ? 's' : ''} logged
            {showErrors ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
          {showErrors && (
            <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded border bg-muted/40 p-2">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-destructive font-mono leading-snug">{e}</li>
              ))}
              {data.totalErrors > errors.length && (
                <li className="text-xs text-muted-foreground italic">
                  …and {data.totalErrors - errors.length} more (truncated)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Confirmation dialog ────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Run',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminReportCardMaintenance() {
  const { toast } = useToast();
  const { currentTerm, allTerms: terms } = useAcademicCalendar();
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Confirm dialogs
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [confirmSyncMissing, setConfirmSyncMissing] = useState(false);
  const [confirmForceResync, setConfirmForceResync] = useState(false);
  const [confirmGenMissing, setConfirmGenMissing] = useState(false);

  // Per-tool results
  const [repairResult, setRepairResult] = useState<any>(null);
  const [syncMissingResult, setSyncMissingResult] = useState<any>(null);
  const [forceResyncResult, setForceResyncResult] = useState<any>(null);
  const [genMissingResult, setGenMissingResult] = useState<any>(null);

  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),
  });

  // ── helper: effective term ID ──────────────────────────────────────────────
  const effectiveTermId = selectedTermId || (currentTerm ? String(currentTerm.id) : '');

  // ── Mutation 1: Repair All Report Cards ───────────────────────────────────
  const repairMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/repair-report-cards');
      if (!res.ok) throw new Error((await res.json()).message || 'Repair failed');
      return res.json();
    },
    onSuccess: (data) => {
      setRepairResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({
        title: 'Repair Complete',
        description: `${data.itemsAdded ?? 0} subjects added, ${data.examScoresSynced ?? 0} scores synced across ${data.studentsProcessed ?? 0} students.`,
        className: 'border-green-500 bg-green-50',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Repair Failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Mutation 2: Sync Missing Exam Scores ──────────────────────────────────
  const syncMissingMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (effectiveTermId) body.termId = Number(effectiveTermId);
      const res = await apiRequest('POST', '/api/admin/sync-all-missing-exam-scores', body);
      if (!res.ok) throw new Error((await res.json()).message || 'Sync failed');
      return res.json();
    },
    onSuccess: (data) => {
      setSyncMissingResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({
        title: 'Sync Complete',
        description: `${data.synced ?? 0} scores synced, ${data.failed ?? 0} failed.`,
        className: 'border-green-500 bg-green-50',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Mutation 3: Force Re-Sync All Exams ──────────────────────────────────
  const forceResyncMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (effectiveTermId) body.termId = Number(effectiveTermId);
      const res = await apiRequest('POST', '/api/admin/force-resync-all-exams', body);
      if (!res.ok) throw new Error((await res.json()).message || 'Force re-sync failed');
      return res.json();
    },
    onSuccess: (data) => {
      setForceResyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({
        title: 'Force Re-Sync Complete',
        description: `${data.synced ?? 0} scores synced (${data.total ?? 0} total results processed).`,
        className: 'border-green-500 bg-green-50',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Force Re-Sync Failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Mutation 4: Generate Missing Report Cards ─────────────────────────────
  const genMissingMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (selectedClassId) params.append('classId', selectedClassId);
      if (effectiveTermId) params.append('termId', effectiveTermId);
      const res = await apiRequest('POST', `/api/admin/report-cards/generate-missing?${params}`);
      if (!res.ok) throw new Error((await res.json()).message || 'Generation failed');
      return res.json();
    },
    onSuccess: (data) => {
      setGenMissingResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({
        title: 'Generation Complete',
        description: data.message || `${data.created ?? 0} report card(s) created.`,
        className: 'border-green-500 bg-green-50',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    },
  });

  const anyRunning =
    repairMutation.isPending ||
    syncMissingMutation.isPending ||
    forceResyncMutation.isPending ||
    genMissingMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" />
          Report Card Maintenance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Repair tools for fixing missing subjects, syncing exam scores, and recovering incomplete report cards. Run these when scores are missing or report cards look incomplete.
        </p>
      </div>

      {/* Info banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-300">When to use these tools</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm mt-1 space-y-1">
          <p>• <strong>Repair All</strong> — run first. Adds missing subjects and syncs scores for every existing report card.</p>
          <p>• <strong>Sync Missing Scores</strong> — fills only the exam scores that are blank (safe to re-run anytime).</p>
          <p>• <strong>Force Re-Sync</strong> — overwrites every score from raw exam results, clearing manual overrides.</p>
          <p>• <strong>Generate Missing</strong> — creates report cards for students who sat exams but have no report card yet.</p>
        </AlertDescription>
      </Alert>

      {/* Term / Class filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Scope Filters
          </CardTitle>
          <CardDescription className="text-xs">
            Leave blank to apply tools across all terms and classes. Filters affect Sync Missing, Force Re-Sync, and Generate Missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground font-medium">Academic Term</label>
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={currentTerm ? `${currentTerm.name} (current)` : 'All terms'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All terms</SelectItem>
                  {(terms ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} {t.id === currentTerm?.id ? '(current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground font-medium">Class (Generate Missing only)</label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All classes</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tool 1: Repair All ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Repair All Report Cards
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Scans every existing report card and: (1) adds any missing subject rows that should be present based on class/department setup, (2) syncs all exam scores into those rows, (3) recalculates grades and positions. Safe to run multiple times — it never deletes data.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">All terms</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setConfirmRepair(true)}
            disabled={anyRunning}
            className="gap-2"
          >
            {repairMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
              : <><Wrench className="h-4 w-4" /> Run Repair</>}
          </Button>
          {repairResult && !repairMutation.isPending && (
            <ToolResult
              data={repairResult}
              fields={[
                { key: 'studentsProcessed', label: 'Students scanned', variant: 'neutral' },
                { key: 'itemsAdded', label: 'Subjects added', variant: 'success' },
                { key: 'examScoresSynced', label: 'Scores synced', variant: 'success' },
                { key: 'totalErrors', label: 'Errors', variant: repairResult.totalErrors > 0 ? 'error' : 'neutral' },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Tool 2: Sync Missing Exam Scores ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                Sync Missing Exam Scores
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Finds every exam result that has a score but whose matching report card item still shows blank. Only fills in what is missing — it never overwrites a score that is already there or a manually-overridden entry. Use this after running exams or after a connectivity issue.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs border-blue-300 text-blue-700">
              {selectedTermId ? `Term filtered` : 'All terms'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setConfirmSyncMissing(true)}
            disabled={anyRunning}
            className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {syncMissingMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Syncing…</>
              : <><RefreshCw className="h-4 w-4" /> Sync Missing Scores</>}
          </Button>
          {syncMissingResult && !syncMissingMutation.isPending && (
            <ToolResult
              data={syncMissingResult}
              fields={[
                { key: 'synced', label: 'Scores synced', variant: 'success' },
                { key: 'failed', label: 'Failed', variant: syncMissingResult.failed > 0 ? 'error' : 'neutral' },
                { key: 'totalErrors', label: 'Errors logged', variant: syncMissingResult.totalErrors > 0 ? 'warning' : 'neutral' },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Tool 3: Force Re-Sync All Exams ────────────────────────────────── */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                Force Re-Sync All Exams
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                <strong className="text-orange-700 dark:text-orange-400">Overwrites existing scores.</strong> Re-pushes every exam result in the database into its matching report card item, clearing any manual override flags. Use this to fully rebuild report card scores from raw exam data when Repair All is not enough.
              </CardDescription>
            </div>
            <Badge className="shrink-0 text-xs bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">
              Overwrites
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setConfirmForceResync(true)}
            disabled={anyRunning}
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {forceResyncMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-syncing…</>
              : <><Zap className="h-4 w-4" /> Force Re-Sync</>}
          </Button>
          {forceResyncResult && !forceResyncMutation.isPending && (
            <ToolResult
              data={forceResyncResult}
              fields={[
                { key: 'total', label: 'Results processed', variant: 'neutral' },
                { key: 'synced', label: 'Synced', variant: 'success' },
                { key: 'failed', label: 'Failed', variant: forceResyncResult.failed > 0 ? 'error' : 'neutral' },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Tool 4: Generate Missing Report Cards ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FilePlus className="h-4 w-4 text-green-600" />
                Generate Missing Report Cards
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Creates brand-new report cards only for students who have exam results but no report card yet for the selected term. Students who already have a report card are never touched. Use this when new students wrote exams but their report cards were never generated.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs border-green-300 text-green-700">
              {selectedClassId
                ? `${classes.find((c: any) => String(c.id) === selectedClassId)?.name ?? 'Filtered class'}`
                : selectedTermId ? 'Term filtered' : 'All classes/terms'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setConfirmGenMissing(true)}
            disabled={anyRunning}
            className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
          >
            {genMissingMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              : <><FilePlus className="h-4 w-4" /> Generate Missing</>}
          </Button>
          {genMissingResult && !genMissingMutation.isPending && (
            <ToolResult
              data={genMissingResult}
              fields={[
                { key: 'pairsChecked', label: 'Students checked', variant: 'neutral' },
                { key: 'created', label: 'Created', variant: 'success' },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      {anyRunning && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border bg-background shadow-lg px-4 py-3 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Tool running — please wait…
        </div>
      )}

      {/* ── Confirm dialogs ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmRepair}
        onOpenChange={setConfirmRepair}
        title="Repair All Report Cards?"
        description="This will scan every report card across all terms, add missing subjects, and sync exam scores. It is safe to run and will not delete any data. This may take a minute for large schools."
        confirmLabel="Run Repair"
        onConfirm={() => repairMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmSyncMissing}
        onOpenChange={setConfirmSyncMissing}
        title="Sync Missing Exam Scores?"
        description={`This will find all blank exam score slots in report cards and fill them from raw exam results. Only missing scores are filled — existing scores are preserved. ${selectedTermId ? 'Scoped to the selected term.' : 'Runs across all terms.'}`}
        confirmLabel="Sync Scores"
        onConfirm={() => syncMissingMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmForceResync}
        onOpenChange={setConfirmForceResync}
        title="Force Re-Sync All Exams?"
        description={`This will overwrite ALL exam scores in report cards from raw exam data, including entries that were manually adjusted. Manual overrides will be cleared. ${selectedTermId ? 'Scoped to the selected term.' : 'Runs across all terms.'} This cannot be undone.`}
        confirmLabel="Force Re-Sync"
        destructive
        onConfirm={() => forceResyncMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmGenMissing}
        onOpenChange={setConfirmGenMissing}
        title="Generate Missing Report Cards?"
        description={`This will create new report cards for students who have exam results but no report card yet. Students who already have a report card are not affected. ${selectedClassId ? 'Filtered to selected class.' : ''} ${selectedTermId ? 'Filtered to selected term.' : ''}`}
        confirmLabel="Generate"
        onConfirm={() => genMissingMutation.mutate()}
      />
    </div>
  );
}
