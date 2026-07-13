import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Clock, Globe, BookOpen, Database,
  FileQuestion, GraduationCap, BarChart3,
  Search, ListChecks, Filter,
} from "lucide-react";

import { ContextFilterBar }  from "./components/ContextFilterBar";
import { QuestionList }      from "./components/QuestionList";
import { ApprovalQueue }     from "./components/ApprovalQueue";
import { CreateBankDialog }  from "./components/CreateBankDialog";
import { RejectDialog }      from "./components/RejectDialog";
import { DeleteBankDialog }  from "./components/DeleteBankDialog";
import { ACTION_STATUS, ACTION_LABEL, STATUS_META, PAGE_SIZE } from "./constants";
import type { ContextFilters } from "./types";

// ─────────────────────────────────────────────────────────────
//  Browse-tab refinement filters
// ─────────────────────────────────────────────────────────────

interface RefinementFiltersProps {
  status:    string;
  diff:      string;
  type:      string;
  onStatus:  (v: string) => void;
  onDiff:    (v: string) => void;
  onType:    (v: string) => void;
  onClear:   () => void;
}

const DIFFICULTY_OPTS = ["easy", "medium", "hard"];
const TYPE_OPTS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay",           label: "Essay" },
];

function BrowseRefinementFilters({
  status, diff, type, onStatus, onDiff, onType, onClear,
}: RefinementFiltersProps) {
  return (
    <div className="flex gap-2 items-center">
      {/* Status — shows full label on desktop, abbreviated on mobile */}
      <Select value={status || "_all"} onValueChange={(v) => onStatus(v === "_all" ? "" : v)}>
        <SelectTrigger data-testid="filter-browse-status" className="flex-1 min-w-0 h-8 text-xs">
          <SelectValue>
            {status
              ? <span className="truncate">{STATUS_META[status as keyof typeof STATUS_META]?.label ?? status}</span>
              : <span className="truncate hidden sm:inline">All statuses</span>}
            {!status && <span className="truncate sm:hidden">Status</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Difficulty — shows "All levels" on desktop, "Level" on mobile */}
      <Select value={diff || "_all"} onValueChange={(v) => onDiff(v === "_all" ? "" : v)}>
        <SelectTrigger data-testid="filter-browse-diff" className="flex-1 min-w-0 h-8 text-xs">
          <SelectValue>
            {diff
              ? <span className="truncate capitalize">{diff}</span>
              : <span className="truncate hidden sm:inline">All levels</span>}
            {!diff && <span className="truncate sm:hidden">Level</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All levels</SelectItem>
          {DIFFICULTY_OPTS.map(d => (
            <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type — shows "Type" on mobile, "All types" on desktop */}
      <Select value={type || "_all"} onValueChange={(v) => onType(v === "_all" ? "" : v)}>
        <SelectTrigger data-testid="filter-browse-type" className="flex-1 min-w-0 h-8 text-xs">
          <SelectValue>
            {type
              ? <span className="truncate">{TYPE_OPTS.find(t => t.value === type)?.label ?? type}</span>
              : <span className="truncate hidden sm:inline">All types</span>}
            {!type && <span className="truncate sm:hidden">Type</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All types</SelectItem>
          {TYPE_OPTS.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  My-Questions tab refinement filters
// ─────────────────────────────────────────────────────────────

function MyRefinementFilters({
  status, onStatus,
}: { status: string; onStatus: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={status || "_all"} onValueChange={(v) => onStatus(v === "_all" ? "" : v)}>
        <SelectTrigger data-testid="filter-my-status" className="h-8 text-xs w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Empty state helper
// ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body }: {
  icon: React.ElementType; title: string; body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
      <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
        <Icon className="w-7 h-7 text-primary/40" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs max-w-sm text-center">{body}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────

export default function QuestionBankManager() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();

  const roleId      = user?.roleId ?? 0;
  const isAdminRole = roleId === 2;

  // ── Context state ───────────────────────────────────────────
  const [browseCtx, setBrowseCtx] = useState<ContextFilters>({});
  const [myCtx,     setMyCtx]     = useState<ContextFilters>({});

  // ── Refinement filters ──────────────────────────────────────
  const [browseStatus, setBrowseStatus] = useState("");
  const [browseDiff,   setBrowseDiff]   = useState("");
  const [browseType,   setBrowseType]   = useState("");
  const [browsePage,   setBrowsePage]   = useState(1);
  const [myStatus,     setMyStatus]     = useState("");
  const [myPage,       setMyPage]       = useState(1);

  // ── Admin stats ─────────────────────────────────────────────
  const { data: statsData } = useQuery<any>({
    queryKey:  ["/api/question-bank/stats"],
    queryFn:   () => apiRequest("GET", "/api/question-bank/stats").then(r => r.json()),
    enabled:   isAdminRole,
    staleTime: 60_000,
  });
  const { data: pendingData } = useQuery<any>({
    queryKey:  ["/api/question-bank/pending", 1],
    queryFn:   () => apiRequest("GET", "/api/question-bank/pending?page=1&pageSize=1").then(r => r.json()),
    enabled:   isAdminRole,
    staleTime: 20_000,
  });

  // ── Bank lists (for resolving bank name) ────────────────────
  const browseBankParams = useMemo(() => {
    if (!browseCtx.classId || !browseCtx.subjectId) return null;
    const p = new URLSearchParams({ classId: String(browseCtx.classId), subjectId: String(browseCtx.subjectId) });
    if (browseCtx.termId) p.set("termId", String(browseCtx.termId));
    return p.toString();
  }, [browseCtx.classId, browseCtx.subjectId, browseCtx.termId]);

  const myBankParams = useMemo(() => {
    if (!myCtx.classId || !myCtx.subjectId) return null;
    const p = new URLSearchParams({ classId: String(myCtx.classId), subjectId: String(myCtx.subjectId) });
    if (myCtx.termId) p.set("termId", String(myCtx.termId));
    return p.toString();
  }, [myCtx.classId, myCtx.subjectId, myCtx.termId]);

  const { data: browseBanks = [] } = useQuery({
    queryKey: ["/api/question-banks", "filtered", browseCtx.classId, browseCtx.subjectId, browseCtx.termId ?? null],
    queryFn:  (): Promise<any[]> => apiRequest("GET", `/api/question-banks?${browseBankParams}`).then(r => r.json()),
    enabled:  !!browseCtx.classId && !!browseCtx.subjectId && !!browseBankParams,
    staleTime: 30_000,
  });
  const { data: myBanks = [] } = useQuery({
    queryKey: ["/api/question-banks", "filtered", myCtx.classId, myCtx.subjectId, myCtx.termId ?? null],
    queryFn:  (): Promise<any[]> => apiRequest("GET", `/api/question-banks?${myBankParams}`).then(r => r.json()),
    enabled:  !!myCtx.classId && !!myCtx.subjectId && !!myBankParams,
    staleTime: 30_000,
  });

  // ── Dialog states ───────────────────────────────────────────
  const [createBankOpen,   setCreateBankOpen]   = useState(false);
  const [rejectTarget,     setRejectTarget]     = useState<any>(null);
  const [deleteBankTarget, setDeleteBankTarget] = useState<any>(null);

  // ── Auto-select current term ────────────────────────────────
  const { currentTerm } = useAcademicCalendar();
  useEffect(() => {
    if (currentTerm) {
      if (!browseCtx.termId) setBrowseCtx(c => ({ ...c, termId: currentTerm.id }));
      if (!myCtx.termId)     setMyCtx(c => ({ ...c, termId: currentTerm.id }));
    }
  }, [currentTerm]);

  // ── Context change handlers ─────────────────────────────────
  const handleBrowseCtxChange = useCallback((v: ContextFilters) => {
    setBrowseCtx(v); setBrowsePage(1);
  }, []);
  const handleMyCtxChange = useCallback((v: ContextFilters) => {
    setMyCtx(v); setMyPage(1);
  }, []);

  // ── Ready flags + query param objects ──────────────────────
  const browseReady = !!browseCtx.classId && !!browseCtx.subjectId && !!browseCtx.termId && !!browseCtx.bankId;
  const myReady     = !!myCtx.classId && !!myCtx.subjectId && !!myCtx.termId;

  const browseParams: Record<string, string> = browseReady ? {
    bankId:   String(browseCtx.bankId),
    classId:  String(browseCtx.classId),
    termId:   String(browseCtx.termId),
    pageSize: String(PAGE_SIZE),
    ...(browseDiff   ? { difficulty: browseDiff }     : {}),
    ...(browseType   ? { questionType: browseType }   : {}),
    ...(browseStatus ? { status: browseStatus }       : {}),
  } : {};

  const myParams: Record<string, string> = myReady ? {
    classId:  String(myCtx.classId),
    termId:   String(myCtx.termId),
    myOnly:   "true",
    pageSize: String(PAGE_SIZE),
    ...(myStatus ? { status: myStatus } : {}),
  } : {};

  // ── Workflow mutation ───────────────────────────────────────
  const workflowMutation = useMutation({
    mutationFn: async ({ action, id, reason }: { action: string; id: number; reason?: string }) => {
      const res = await apiRequest("POST", `/api/question-bank/items/${id}/${action}`, reason ? { reason } : undefined);
      if (!res.ok) {
        let msg = "Action failed. Please try again.";
        try { const body = await res.json(); msg = body.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onMutate: async ({ action, id }) => {
      const newStatus = ACTION_STATUS[action];
      if (!newStatus) return;
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.map((it: any) =>
          it.id === id ? { ...it, status: newStatus } : it
        )};
      });
      return { snapshot };
    },
    onSuccess: (serverItem: any, vars) => {
      // Write the server-confirmed item directly into cache — this IS the truth.
      // Do NOT invalidate items: a background GET races the DB write and would
      // restore the old status, overwriting the correct optimistic state.
      if (serverItem?.id) {
        qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
          if (!old?.items) return old;
          return { ...old, items: old.items.map((it: any) =>
            it.id === serverItem.id ? { ...it, ...serverItem } : it
          )};
        });
      }
      toast({ title: "Success", description: ACTION_LABEL[vars.action] ?? "Action completed." });
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      }
      // Hard-refetch after rollback so the list reflects server truth.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      // Pending and stats are counters / separate lists — safe to sync.
      // Never invalidate items here: it races the DB commit.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
  });

  const handleWorkflow = (action: string, item: any) => {
    if (action === "reject") { setRejectTarget(item); return; }
    workflowMutation.mutate({ action, id: item.id });
  };

  // ── Delete bank mutation ────────────────────────────────────
  const deleteBankMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/question-banks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      toast({ title: "Success", description: "Question bank and all its questions removed." });
      setDeleteBankTarget(null);
      setBrowseCtx(prev => ({ ...prev, bankId: undefined }));
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const pendingTotal = pendingData?.total ?? 0;

  // ── Selected bank name (for the bank header) ────────────────
  const selectedBankName =
    (browseBanks as any[]).find((b: any) => b.id === browseCtx.bankId)?.name ?? "Selected Bank";

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Question Bank Manager</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isAdminRole
                    ? "Create banks, manage questions and review teacher submissions"
                    : "Write questions and submit them for admin review"}
                </p>
              </div>
            </div>
            {isAdminRole && (
              <Button
                onClick={() => setCreateBankOpen(true)}
                data-testid="btn-create-bank"
                className="w-full sm:w-auto sm:flex-shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" /> New Bank
              </Button>
            )}
          </div>

          {/* Stats row (admin only) */}
          {isAdminRole && (
            <div className="mt-5">
              <StatCardGrid cols={4}>
                <StatCard icon={Database}      label="Total Banks"     value={statsData?.totalBanks ?? "—"}      color="text-primary"      loading={!statsData} />
                <StatCard icon={FileQuestion}  label="Total Questions" value={statsData?.totalQuestions ?? "—"}  color="text-violet-600"   loading={!statsData} />
                <StatCard icon={Clock}         label="Pending Review"  value={pendingTotal}                      color="text-amber-600"    loading={!pendingData} />
                <StatCard icon={Globe}         label="Published"       value={statsData?.publishedQuestions ?? "—"} color="text-emerald-600" loading={!statsData} />
              </StatCardGrid>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="browse" className="space-y-5">
          <TabsList className="w-full">
            <TabsTrigger value="browse" className="flex-1 text-xs sm:text-sm" data-testid="tab-browse">
              <Search className="w-3.5 h-3.5" />
              {isAdminRole ? "Browse Banks" : "Browse"}
            </TabsTrigger>
            <TabsTrigger value="my" className="flex-1 text-xs sm:text-sm" data-testid="tab-my">
              <BookOpen className="w-3.5 h-3.5" />
              My Questions
            </TabsTrigger>
            {isAdminRole && (
              <TabsTrigger value="pending" className="flex-1 text-xs sm:text-sm" data-testid="tab-pending">
                <ListChecks className="w-3.5 h-3.5" />
                Approval Queue
                {pendingTotal > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingTotal > 99 ? "99+" : pendingTotal}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ══ Browse Tab ══════════════════════════════════ */}
          <TabsContent value="browse" className="space-y-4 mt-0">
            <SectionCard icon={Filter} title="Filter Context" subtitle="— all four fields required before questions load" contentClassName="px-5 pb-5">
              <ContextFilterBar value={browseCtx} onChange={handleBrowseCtxChange} showBank />
            </SectionCard>

            {browseReady && (
              <BrowseRefinementFilters
                status={browseStatus} diff={browseDiff} type={browseType}
                onStatus={(v) => { setBrowseStatus(v); setBrowsePage(1); }}
                onDiff={(v)   => { setBrowseDiff(v);   setBrowsePage(1); }}
                onType={(v)   => { setBrowseType(v);   setBrowsePage(1); }}
                onClear={() => { setBrowseStatus(""); setBrowseDiff(""); setBrowseType(""); setBrowsePage(1); }}
              />
            )}

            {/* Empty state ladder */}
            {!browseCtx.classId || !browseCtx.subjectId ? (
              <EmptyState
                icon={GraduationCap}
                title="Start by selecting your context above"
                body="Choose Class → Subject → Term → Bank to load questions. All four fields are required."
              />
            ) : !browseCtx.termId ? (
              <EmptyState
                icon={BookOpen}
                title="Select a Term"
                body="Term is required — select one from the filter above."
              />
            ) : !browseCtx.bankId ? (
              <EmptyState
                icon={BookOpen}
                title="Now select a Question Bank"
                body={
                  (browseBanks as any[]).length === 0
                    ? "No banks exist for this class/subject/term. Create one with the \"New Bank\" button above."
                    : `${(browseBanks as any[]).length} bank${(browseBanks as any[]).length > 1 ? "s" : ""} available — select one from the Bank dropdown.`
                }
              />
            ) : (
              /* QuestionList now owns the Card + CardHeader (bank name + ⋮ menu) */
              <QuestionList
                paramObj={browseParams}
                isAdmin={isAdminRole}
                userId={user?.id ?? ""}
                banks={browseBanks as any[]}
                context={browseCtx}
                page={browsePage}
                onPageChange={setBrowsePage}
                onWorkflow={handleWorkflow}
                pendingId={workflowMutation.isPending ? workflowMutation.variables?.id : undefined}
                pendingAction={workflowMutation.isPending ? workflowMutation.variables?.action : undefined}
                showBankHeader={isAdminRole}
                bankName={selectedBankName}
                onDeleteBank={() => setDeleteBankTarget(
                  (browseBanks as any[]).find((b: any) => b.id === browseCtx.bankId)
                )}
              />
            )}
          </TabsContent>

          {/* ══ My Questions Tab ═══════════════════════════ */}
          <TabsContent value="my" className="space-y-4 mt-0">
            <SectionCard icon={Filter} title="Filter Context" subtitle="— Class, Subject &amp; Term required" contentClassName="px-5 pb-5">
              <ContextFilterBar value={myCtx} onChange={handleMyCtxChange} showBank={false} />
            </SectionCard>

            {myReady && (
              <MyRefinementFilters
                status={myStatus}
                onStatus={(v) => { setMyStatus(v); setMyPage(1); }}
              />
            )}

            {!myCtx.classId || !myCtx.subjectId ? (
              <EmptyState
                icon={BarChart3}
                title="Select Class and Subject"
                body="Choose Class, Subject and Term to load your questions."
              />
            ) : (
              <QuestionList
                paramObj={myParams}
                isAdmin={isAdminRole}
                userId={user?.id ?? ""}
                banks={myBanks as any[]}
                context={myCtx}
                page={myPage}
                onPageChange={setMyPage}
                onWorkflow={handleWorkflow}
                pendingId={workflowMutation.isPending ? workflowMutation.variables?.id : undefined}
                pendingAction={workflowMutation.isPending ? workflowMutation.variables?.action : undefined}
                showBankHeader={false}
              />
            )}
          </TabsContent>

          {/* ══ Approval Queue (Admin) ════════════════════ */}
          {isAdminRole && (
            <TabsContent value="pending" className="space-y-4 mt-0">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 pt-5 px-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                      <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    Pending Review
                    {pendingTotal > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0 text-xs">
                        {pendingTotal}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <ApprovalQueue onWorkflow={handleWorkflow} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {isAdminRole && (
        <CreateBankDialog open={createBankOpen} onOpenChange={setCreateBankOpen} />
      )}

      <RejectDialog
        target={rejectTarget}
        isPending={workflowMutation.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          workflowMutation.mutate({ action: "reject", id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />

      <DeleteBankDialog
        target={deleteBankTarget}
        isPending={deleteBankMutation.isPending}
        onClose={() => setDeleteBankTarget(null)}
        onConfirm={(id) => deleteBankMutation.mutate(id)}
      />
    </div>
  );
}
