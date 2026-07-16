import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, AlertTriangle, BookOpen, Layers,
  Globe, EyeOff, MoreVertical, Upload, Database, Trash2, Eraser,
} from "lucide-react";
import { BulkCSVQuestionsDialog } from "@/components/shared/BulkCSVQuestionsDialog";
import type { ParsedQuestion } from "@/components/shared/BulkCSVQuestionsDialog";
import { QuestionCard } from "./QuestionCard";
import { QuestionFormDialog } from "./QuestionFormDialog";
import { PaginationBar } from "./PaginationBar";
import { PAGE_SIZE } from "../constants";
import type { ContextFilters } from "../types";

interface QuestionListProps {
  paramObj:      Record<string, string>;
  isAdmin:       boolean;
  userId:        string;
  banks:         any[];
  context:       ContextFilters;
  page:          number;
  onPageChange:  (p: number) => void;
  onWorkflow:    (action: string, item: any) => void;
  pendingId?:    number;
  pendingAction?: string;
  // Bank header props — when provided, renders a bank header with the ⋮ actions menu
  bankName?:     string;
  onDeleteBank?: () => void;
  showBankHeader?: boolean;
}

export function QuestionList({
  paramObj, isAdmin, userId, banks, context, page, onPageChange, onWorkflow,
  pendingId, pendingAction,
  bankName, onDeleteBank, showBankHeader = false,
}: QuestionListProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editItem,              setEditItem]              = useState<any>(null);
  const [deleteTarget,          setDeleteTarget]          = useState<any>(null);
  const [formOpen,              setFormOpen]              = useState(false);
  const [csvUploadOpen,         setCsvUploadOpen]         = useState(false);
  const [csvServerErrors,       setCsvServerErrors]       = useState<string[]>([]);
  const [deleteAllQuestionsOpen, setDeleteAllQuestionsOpen] = useState(false);

  // ── Fetch question page ─────────────────────────────────────
  const qs = new URLSearchParams({ ...paramObj, page: String(page) }).toString();
  const enabled =
    !!paramObj.classId &&
    (paramObj.myOnly === "true" ? true : !!paramObj.bankId);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey:  ["/api/question-bank/items", { ...paramObj, page: String(page) }],
    queryFn:   () => apiRequest("GET", `/api/question-bank/items?${qs}`).then(r => r.json()),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  // ── Delete question (optimistic) ────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/question-bank/items/${id}`),

    onMutate: async (id: number) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic state
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });

      // Snapshot everything we might need to roll back
      const snapshot      = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });
      const statsSnapshot = qc.getQueryData(["/api/question-bank/stats"]);

      // Optimistically remove the item from every cached page variant
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter((it: any) => it.id !== id),
          total: Math.max(0, (old.total ?? 0) - 1),
        };
      });

      // Optimistically decrement the stats counter
      qc.setQueryData(["/api/question-bank/stats"], (old: any) =>
        old ? { ...old, totalQuestions: Math.max(0, (old.totalQuestions ?? 0) - 1) } : old
      );

      // Close the modal and show success toast immediately — before the request completes
      setDeleteTarget(null);
      toast({ title: "Deleted successfully.", description: "The question has been removed." });

      return { snapshot, statsSnapshot };
    },

    onSuccess: () => {
      // Deletion confirmed by the server. The optimistic cache is already correct —
      // do NOT refetch items here; a background GET races the DB commit and would
      // restore the just-deleted row. Only sync the stats counter.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },

    onError: (e: any, _id, ctx: any) => {
      // Restore all cache pages to their pre-delete state
      ctx?.snapshot?.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      if (ctx?.statsSnapshot !== undefined) {
        qc.setQueryData(["/api/question-bank/stats"], ctx.statsSnapshot);
      }
      // Hard-refetch so the list reflects server truth after the rollback
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      toast({ title: "Delete failed", description: e.message ?? "Please try again.", variant: "destructive" });
    },
  });

  // ── Bulk CSV upload ─────────────────────────────────────────
  const bulkCsvMutation = useMutation({
    mutationFn: async (questions: ParsedQuestion[]) => {
      if (!context.bankId)  throw new Error("Select a question bank before uploading.");
      if (!context.classId) throw new Error("Select a class before uploading.");
      if (!context.termId)  throw new Error("Select a term before uploading (required for question bank items).");
      const r = await apiRequest("POST", "/api/question-bank/items/bulk-csv", {
        bankId:    context.bankId,
        classId:   context.classId,
        termId:    context.termId,
        questions,
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || err.message || "Upload failed"); }
      return r.json();
    },
    onMutate: async () => {
      // Cancel in-flight queries so they don't overwrite the upcoming cache write.
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });
      return { snapshot };
    },
    onSuccess: (result, _vars, _ctx) => {
      const serverErrs: string[] = result.errors   ?? [];
      const createdItems: any[]  = result.questions ?? [];

      if (createdItems.length > 0) {
        // Target ONLY the page-1 cache entry. Prepend the new items (sliced to pageSize
        // so the list stays one page long), and recompute totalPages from the updated total.
        // Updating every cached page via setQueriesData would corrupt per-page slices and
        // leave totalPages stale (making pagination appear broken until a hard refresh).
        const page1Key = ["/api/question-bank/items", { ...paramObj, page: "1" }];
        qc.setQueryData(page1Key, (old: any) => {
          if (!old) return old;
          const newTotal      = (old.total ?? 0) + createdItems.length;
          const ps            = old.pageSize ?? PAGE_SIZE;
          const newTotalPages = Math.ceil(newTotal / ps);
          // Prepend newest items; truncate so page 1 stays at pageSize entries
          const merged = [...createdItems, ...(old.items ?? [])].slice(0, ps);
          return { ...old, items: merged, total: newTotal, totalPages: newTotalPages };
        });

        // Invalidate every other cached page so they refetch with correct server data.
        // DB writes are fully committed before onSuccess fires — no race risk here.
        qc.invalidateQueries({
          queryKey: ["/api/question-bank/items"],
          predicate: (query) => {
            const params = query.queryKey[1] as Record<string, string> | undefined;
            return params?.page !== "1";
          },
        });

        // Navigate to page 1 so the user immediately sees the uploaded questions.
        if (page !== 1) onPageChange(1);
      }

      // Stats counter changed — safe to sync independently.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });

      toast({
        title: "Bulk upload complete",
        description: `${result.created} question${result.created !== 1 ? "s" : ""} added.${
          serverErrs.length ? ` ${serverErrs.length} row(s) skipped — see details below.` : ""
        }`,
      });
      if (serverErrs.length) {
        setCsvServerErrors(serverErrs);
      } else {
        setCsvServerErrors([]);
        setCsvUploadOpen(false);
      }
    },
    onError: (e: any, _vars, ctx: any) => {
      // Restore cache to pre-upload snapshot, then hard-refetch for server truth.
      if (ctx?.snapshot) ctx.snapshot.forEach(([k, d]: [any, any]) => qc.setQueryData(k, d));
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  // ── Bulk publish (optimistic) ───────────────────────────────
  const bulkPublishMutation = useMutation({
    mutationFn: async (bankId: number) => {
      const res = await apiRequest("POST", `/api/question-banks/${bankId}/bulk-publish`);
      if (!res.ok) {
        let msg = "Bulk publish failed";
        try { const b = await res.json(); msg = b.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old?.items) return old;
        const publishable = new Set(["draft", "submitted", "active", "approved"]);
        return { ...old, items: old.items.map((it: any) =>
          publishable.has(it.status) ? { ...it, status: "published" } : it
        )};
      });
      return { snapshot };
    },
    onSuccess: (data: any) => {
      // Optimistic state is already correct — all eligible items flipped to "published".
      // Do NOT invalidate items: a background GET races the DB write and restores old statuses.
      toast({ title: "Published", description: data.message ?? "All questions published." });
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.snapshot) ctx.snapshot.forEach(([k, d]: [any, any]) => qc.setQueryData(k, d));
      // Hard-refetch after rollback so the list reflects server truth.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      // Stats counter only — never invalidate items here.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
  });

  // ── Bulk unpublish (optimistic) ─────────────────────────────
  const bulkUnpublishMutation = useMutation({
    mutationFn: async (bankId: number) => {
      const res = await apiRequest("POST", `/api/question-banks/${bankId}/bulk-unpublish`);
      if (!res.ok) {
        let msg = "Bulk unpublish failed";
        try { const b = await res.json(); msg = b.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.map((it: any) =>
          it.status === "published" ? { ...it, status: "active" } : it
        )};
      });
      return { snapshot };
    },
    onSuccess: (data: any) => {
      // Optimistic state is already correct — all published items flipped to "active".
      // Do NOT invalidate items: a background GET races the DB write and restores old statuses.
      toast({ title: "Unpublished", description: data.message ?? "All questions unpublished." });
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.snapshot) ctx.snapshot.forEach(([k, d]: [any, any]) => qc.setQueryData(k, d));
      // Hard-refetch after rollback so the list reflects server truth.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      toast({ title: "Unpublish failed", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      // Stats counter only — never invalidate items here.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
  });

  // ── Delete all questions in bank (keeps the bank record) ────
  const deleteAllMutation = useMutation({
    mutationFn: async (bankId: number) => {
      const res = await apiRequest("DELETE", `/api/question-banks/${bankId}/questions`);
      if (!res.ok) {
        let msg = "Failed to delete questions";
        try { const b = await res.json(); msg = b.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      // Wipe all cached pages for this bank so the list shows empty state immediately.
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old) return old;
        return { ...old, items: [], total: 0, totalPages: 1 };
      });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      onPageChange(1);
      setDeleteAllQuestionsOpen(false);
      toast({ title: "Questions deleted", description: data.message ?? "All questions removed from this bank." });
    },
    onError: (e: any) => {
      toast({ title: "Delete failed", description: e.message ?? "Please try again.", variant: "destructive" });
    },
  });

  // ── Derived state ───────────────────────────────────────────
  const items: any[] = data?.items ?? [];
  const pg = {
    page:       data?.page       ?? 1,
    totalPages: data?.totalPages ?? 1,
    total:      data?.total      ?? 0,
    pageSize:   data?.pageSize   ?? PAGE_SIZE,
  };
  const allPublished = items.length > 0 && items.every((it: any) => it.status === "published");
  const bulkPending  = bulkPublishMutation.isPending || bulkUnpublishMutation.isPending;

  // ── Render states ───────────────────────────────────────────
  const renderBody = () => {
    if (!enabled) {
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Layers className="w-7 h-7 opacity-40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">Context not complete</p>
            <p className="text-xs max-w-xs">Select Class, Subject, Term and Bank to load questions.</p>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 text-destructive opacity-80" />
          <p className="text-sm font-medium">Failed to load questions</p>
          <p className="text-xs">Check your connection and try again.</p>
        </div>
      );
    }

    return (
      <>
        {/* Question count row — ⋮ shown here when bank-header is hidden (teacher / My Questions) */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pg.total}</span>{" "}
            question{pg.total !== 1 ? "s" : ""} found
          </p>
          {!showBankHeader && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid="btn-add-question-trigger">
                  <MoreVertical className="w-4 h-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => { setEditItem(null); setFormOpen(true); }}
                  data-testid="btn-add-question"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCsvUploadOpen(true)}
                  title={!context.termId ? "Select a term to enable bulk upload" : undefined}
                >
                  <Upload className="w-4 h-4 mr-2" /> Bulk Upload CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <BookOpen className="w-7 h-7 opacity-40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold">No questions found</p>
              <p className="text-xs">Adjust filters or add the first question to this bank.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <QuestionCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                isOwner={item.createdBy === userId}
                onEdit={() => { setEditItem(item); setFormOpen(true); }}
                onDelete={() => setDeleteTarget(item)}
                onWorkflow={onWorkflow}
                pendingId={pendingId}
                pendingAction={pendingAction}
              />
            ))}
          </div>
        )}

        <PaginationBar {...pg} onPage={onPageChange} />
      </>
    );
  };

  return (
    <>
      <Card className="shadow-sm">
        {/* ── Bank header with three-dot actions menu ─── */}
        {showBankHeader && bankName && (
          <CardHeader className="pb-2 pt-4 px-5 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                <Database className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm font-semibold">{bankName}</span>
            </div>

            {/* ⋮ Three-dot dropdown — Add, Upload, Publish/Unpublish, Delete Bank */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid="btn-bank-actions">
                  <MoreVertical className="w-4 h-4" />
                  <span className="sr-only">Bank actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => { setEditItem(null); setFormOpen(true); }}
                  data-testid="btn-add-question"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Question
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCsvUploadOpen(true)}
                  title={!context.termId ? "Select a term to enable bulk upload" : undefined}
                >
                  <Upload className="w-4 h-4 mr-2" /> Bulk Upload CSV
                </DropdownMenuItem>

                {isAdmin && context.bankId && (
                  <>
                    <DropdownMenuSeparator />
                    {allPublished ? (
                      <DropdownMenuItem
                        onClick={() => bulkUnpublishMutation.mutate(context.bankId!)}
                        disabled={bulkPending}
                        className="text-amber-600 focus:text-amber-600"
                        data-testid="btn-bulk-unpublish"
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        {bulkUnpublishMutation.isPending ? "Unpublishing…" : "Unpublish All"}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => bulkPublishMutation.mutate(context.bankId!)}
                        disabled={bulkPending}
                        className="text-purple-600 focus:text-purple-600"
                        data-testid="btn-bulk-publish"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        {bulkPublishMutation.isPending ? "Publishing…" : "Publish All"}
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                {isAdmin && context.bankId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteAllQuestionsOpen(true)}
                      disabled={deleteAllMutation.isPending}
                      className="text-destructive focus:text-destructive"
                      data-testid="btn-delete-all-questions"
                    >
                      <Eraser className="w-4 h-4 mr-2" />
                      {deleteAllMutation.isPending ? "Deleting…" : "Delete All Questions"}
                    </DropdownMenuItem>
                  </>
                )}

                {isAdmin && onDeleteBank && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDeleteBank}
                      className="text-destructive focus:text-destructive"
                      data-testid="btn-delete-bank"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Bank
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
        )}

        <CardContent className="p-5">
          {renderBody()}
        </CardContent>
      </Card>

      {/* ── Question form dialog ──────────────────────── */}
      {formOpen && (
        <QuestionFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          banks={banks}
          context={context}
          editItem={editItem}
          isAdmin={isAdmin}
          page={page}
          paramObj={paramObj}
          onPageChange={onPageChange}
        />
      )}

      {/* ── Bulk CSV dialog ────────────────────────────── */}
      <BulkCSVQuestionsDialog
        open={csvUploadOpen}
        onOpenChange={(v) => { setCsvUploadOpen(v); if (!v) setCsvServerErrors([]); }}
        onUpload={(questions) => { setCsvServerErrors([]); bulkCsvMutation.mutate(questions); }}
        isPending={bulkCsvMutation.isPending}
        showDifficulty
        title="Bulk Upload to Question Bank"
        serverErrors={csvServerErrors}
      />

      {/* ── Delete all questions confirm ───────────────── */}
      <AlertDialog open={deleteAllQuestionsOpen} onOpenChange={(v) => !v && !deleteAllMutation.isPending && setDeleteAllQuestionsOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Eraser className="w-4 h-4" /> Delete All Questions
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently remove <strong>every question</strong> from{" "}
                <strong>"{bankName}"</strong>. The bank itself will remain.
              </span>
              <span className="block text-destructive font-medium">
                This cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAllMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteAllMutation.isPending}
              onClick={() => context.bankId && deleteAllMutation.mutate(context.bankId)}
            >
              {deleteAllMutation.isPending ? "Deleting…" : "Delete All Questions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete question confirm ────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The question will be permanently removed from the bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
