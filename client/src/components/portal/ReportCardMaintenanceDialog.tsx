/**
 * ReportCardMaintenanceDialog
 * Four repair/sync tools surfaced in the Report Card page three-dot menu.
 * Self-contained: owns its own mutations, confirmation dialogs, and result display.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Wrench, RefreshCw, Zap, FilePlus,
  Loader2, AlertTriangle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Result panel ─────────────────────────────────────────────────────────────

interface StatChip {
  label: string;
  value: number | string;
  warn?: boolean;
}

function StatGrid({ chips }: { chips: StatChip[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
      {chips.map(({ label, value, warn }) => (
        <div
          key={label}
          className={`rounded-md border px-3 py-2 text-sm flex flex-col gap-0.5 ${
            warn ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          <span className="text-xs font-normal opacity-70">{label}</span>
          <span className="text-base font-bold">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorLog({ errors, total }: { errors: string[]; total: number }) {
  const [open, setOpen] = useState(false);
  if (!errors.length && !total) return null;
  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-destructive hover:underline"
        onClick={() => setOpen(v => !v)}
      >
        <AlertTriangle className="h-3 w-3" />
        {total} error{total !== 1 ? 's' : ''}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 max-h-36 overflow-y-auto rounded border bg-muted/40 p-2">
          {errors.map((e, i) => (
            <li key={i} className="text-xs font-mono text-destructive leading-snug">{e}</li>
          ))}
          {total > errors.length && (
            <li className="text-xs text-muted-foreground italic">…and {total - errors.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Single tool card ─────────────────────────────────────────────────────────

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeDestructive?: boolean;
  buttonLabel: string;
  buttonVariant?: 'default' | 'outline' | 'destructive';
  buttonClass?: string;
  isPending: boolean;
  pendingLabel: string;
  disabled: boolean;
  result: any;
  resultChips: StatChip[];
  onRun: () => void;
}

function ToolCard({
  icon, title, description, badge, badgeDestructive,
  buttonLabel, buttonVariant = 'outline', buttonClass,
  isPending, pendingLabel, disabled, result, resultChips, onRun,
}: ToolCardProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="font-medium text-sm flex items-center gap-1.5">
            {icon}{title}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {badge && (
          <Badge variant={badgeDestructive ? 'destructive' : 'outline'} className="shrink-0 text-xs">
            {badge}
          </Badge>
        )}
      </div>
      <Button
        size="sm"
        variant={buttonVariant}
        className={buttonClass}
        onClick={onRun}
        disabled={disabled || isPending}
      >
        {isPending
          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{pendingLabel}</>
          : <>{icon && <span className="mr-1.5">{icon}</span>}{buttonLabel}</>}
      </Button>
      {result && !isPending && (
        <div>
          <StatGrid chips={resultChips} />
          {result.message && (
            <p className="text-xs text-muted-foreground mt-2">{result.message}</p>
          )}
          <ErrorLog errors={result.errors || []} total={result.totalErrors ?? (result.errors?.length ?? 0)} />
        </div>
      )}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  label: string;
  destructive?: boolean;
  onConfirm: () => void;
}

function Confirm({ open, onOpenChange, title, description, label, destructive, onConfirm }: ConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** class filter already active on the report card page */
  selectedClass: string;
  /** term filter already active on the report card page */
  selectedTerm: string;
}

export function ReportCardMaintenanceDialog({ open, onOpenChange, selectedClass, selectedTerm }: Props) {
  const { toast } = useToast();
  const { currentTerm } = useAcademicCalendar();

  // Confirm gates
  const [confirmRepair, setConfirmRepair] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false);

  // Per-tool results
  const [repairResult, setRepairResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [forceResult, setForceResult] = useState<any>(null);
  const [genResult, setGenResult] = useState<any>(null);

  const termId = selectedTerm !== 'all' ? Number(selectedTerm) : (currentTerm?.id ?? undefined);
  const classId = selectedClass !== 'all' ? Number(selectedClass) : undefined;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

  // 8-minute AbortController — maintenance ops can take several minutes on large schools
  const MAINTENANCE_TIMEOUT_MS = 8 * 60 * 1000;

  async function postMaintenance(path: string, body?: object): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAINTENANCE_TIMEOUT_MS);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Repair All ──────────────────────────────────────────────────────────────
  const repairMutation = useMutation({
    mutationFn: () => postMaintenance('/api/admin/repair-report-cards'),
    onSuccess: (data) => { setRepairResult(data); invalidate(); toast({ title: 'Repair complete', description: `${data.itemsAdded ?? 0} subjects added, ${data.examScoresSynced ?? 0} scores synced.` }); },
    onError: (e: any) => toast({ title: 'Repair failed', description: e.message, variant: 'destructive' }),
  });

  // ── Sync Missing Scores ─────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: () => postMaintenance('/api/admin/sync-all-missing-exam-scores', termId ? { termId } : {}),
    onSuccess: (data) => { setSyncResult(data); invalidate(); toast({ title: 'Sync complete', description: `${data.synced ?? 0} scores synced.` }); },
    onError: (e: any) => toast({ title: 'Sync failed', description: e.message, variant: 'destructive' }),
  });

  // ── Force Re-Sync ───────────────────────────────────────────────────────────
  const forceMutation = useMutation({
    mutationFn: () => postMaintenance('/api/admin/force-resync-all-exams', termId ? { termId } : {}),
    onSuccess: (data) => { setForceResult(data); invalidate(); toast({ title: 'Force re-sync complete', description: `${data.synced ?? 0} of ${data.total ?? 0} scores resynced.` }); },
    onError: (e: any) => toast({ title: 'Force re-sync failed', description: e.message, variant: 'destructive' }),
  });

  // ── Generate Missing ────────────────────────────────────────────────────────
  const genMutation = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (classId) params.append('classId', String(classId));
      if (termId)  params.append('termId',  String(termId));
      return postMaintenance(`/api/admin/report-cards/generate-missing?${params}`);
    },
    onSuccess: (data) => { setGenResult(data); invalidate(); toast({ title: 'Generation complete', description: data.message || `${data.created ?? 0} report cards created.` }); },
    onError: (e: any) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const anyRunning = repairMutation.isPending || syncMutation.isPending || forceMutation.isPending || genMutation.isPending;

  const scopeLabel = termId ? 'Current term scope' : 'All terms';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Report Card Maintenance
            </DialogTitle>
            <DialogDescription>
              Run these tools to fix missing subjects and exam scores on existing report cards.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
              <p><strong>Repair All</strong> — run first: adds missing subjects + syncs scores (safe to repeat).</p>
              <p><strong>Sync Missing</strong> — fills only blank score slots, never overwrites existing scores.</p>
              <p><strong>Force Re-Sync</strong> — overwrites every score from raw exam data, clears overrides.</p>
              <p><strong>Generate Missing</strong> — creates new report cards for students with no card yet.</p>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {/* ── Repair All ────────────────────────────────────────────── */}
            <ToolCard
              icon={<Wrench className="h-3.5 w-3.5 text-primary" />}
              title="Repair All Report Cards"
              description="Scans every report card across all terms, adds missing subjects, syncs exam scores. Safe to run multiple times."
              badge="All terms"
              buttonLabel="Run Repair"
              buttonVariant="default"
              isPending={repairMutation.isPending}
              pendingLabel="Repairing…"
              disabled={anyRunning}
              result={repairResult}
              resultChips={[
                { label: 'Students', value: repairResult?.studentsProcessed ?? 0 },
                { label: 'Subjects added', value: repairResult?.itemsAdded ?? 0 },
                { label: 'Scores synced', value: repairResult?.examScoresSynced ?? 0 },
                { label: 'Errors', value: repairResult?.totalErrors ?? 0, warn: (repairResult?.totalErrors ?? 0) > 0 },
              ]}
              onRun={() => setConfirmRepair(true)}
            />

            <Separator />

            {/* ── Sync Missing Scores ───────────────────────────────────── */}
            <ToolCard
              icon={<RefreshCw className="h-3.5 w-3.5 text-blue-600" />}
              title="Sync Missing Exam Scores"
              description="Fills only blank exam/test score slots. Never overwrites existing scores or manual overrides."
              badge={scopeLabel}
              buttonLabel="Sync Missing Scores"
              buttonClass="border-blue-300 text-blue-700 hover:bg-blue-50"
              isPending={syncMutation.isPending}
              pendingLabel="Syncing…"
              disabled={anyRunning}
              result={syncResult}
              resultChips={[
                { label: 'Synced', value: syncResult?.synced ?? 0 },
                { label: 'Failed', value: syncResult?.failed ?? 0, warn: (syncResult?.failed ?? 0) > 0 },
              ]}
              onRun={() => setConfirmSync(true)}
            />

            {/* ── Force Re-Sync ─────────────────────────────────────────── */}
            <ToolCard
              icon={<Zap className="h-3.5 w-3.5 text-orange-500" />}
              title="Force Re-Sync All Exams"
              description="Overwrites ALL exam scores from raw exam data, clearing any manual overrides. Use only when Repair All isn't enough."
              badge="Overwrites"
              badgeDestructive
              buttonLabel="Force Re-Sync"
              buttonClass="border-orange-300 text-orange-700 hover:bg-orange-50"
              isPending={forceMutation.isPending}
              pendingLabel="Re-syncing…"
              disabled={anyRunning}
              result={forceResult}
              resultChips={[
                { label: 'Processed', value: forceResult?.total ?? 0 },
                { label: 'Synced', value: forceResult?.synced ?? 0 },
                { label: 'Failed', value: forceResult?.failed ?? 0, warn: (forceResult?.failed ?? 0) > 0 },
              ]}
              onRun={() => setConfirmForce(true)}
            />

            <Separator />

            {/* ── Generate Missing ─────────────────────────────────────── */}
            <ToolCard
              icon={<FilePlus className="h-3.5 w-3.5 text-green-600" />}
              title="Generate Missing Report Cards"
              description="Creates report cards only for students who have exam results but no report card yet. Students who already have one are never touched."
              badge={classId ? 'Filtered to class' : scopeLabel}
              buttonLabel="Generate Missing"
              buttonClass="border-green-300 text-green-700 hover:bg-green-50"
              isPending={genMutation.isPending}
              pendingLabel="Generating…"
              disabled={anyRunning}
              result={genResult}
              resultChips={[
                { label: 'Students checked', value: genResult?.pairsChecked ?? 0 },
                { label: 'Created', value: genResult?.created ?? 0 },
              ]}
              onRun={() => setConfirmGen(true)}
            />
          </div>

          {anyRunning && (
            <div className="flex items-center gap-2 text-xs text-primary font-medium pt-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Tool running — please wait…
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={anyRunning}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation gates ─────────────────────────────────────────────── */}
      <Confirm
        open={confirmRepair} onOpenChange={setConfirmRepair}
        title="Repair All Report Cards?"
        description="Scans every report card across all terms, adds missing subjects, and syncs exam scores. Safe to run multiple times — never deletes data. May take a minute for large schools."
        label="Run Repair"
        onConfirm={() => repairMutation.mutate()}
      />
      <Confirm
        open={confirmSync} onOpenChange={setConfirmSync}
        title="Sync Missing Exam Scores?"
        description={`Fills blank exam/test score slots from raw exam results. Existing scores and manual overrides are preserved. ${termId ? 'Scoped to the current term.' : 'Runs across all terms.'}`}
        label="Sync Scores"
        onConfirm={() => syncMutation.mutate()}
      />
      <Confirm
        open={confirmForce} onOpenChange={setConfirmForce}
        title="Force Re-Sync All Exams?"
        description={`Overwrites ALL exam scores in report cards from raw exam data, clearing manual overrides. ${termId ? 'Scoped to the current term.' : 'Runs across all terms.'} This cannot be undone.`}
        label="Force Re-Sync"
        destructive
        onConfirm={() => forceMutation.mutate()}
      />
      <Confirm
        open={confirmGen} onOpenChange={setConfirmGen}
        title="Generate Missing Report Cards?"
        description={`Creates new report cards for students with exam results but no existing report card. Students who already have one are not touched. ${classId ? 'Filtered to selected class.' : ''} ${termId ? 'Filtered to current term.' : ''}`}
        label="Generate"
        onConfirm={() => genMutation.mutate()}
      />
    </>
  );
}
