import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Edit, Trash2, CheckCircle, XCircle, Send, RotateCcw,
  BookOpen, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Filter, Eye, EyeOff, Globe, Layers, Info,
  Search, ListChecks, BarChart3, Database, FileQuestion,
  ChevronDown, ChevronUp, Check, GraduationCap, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const DIFFICULTY_OPTS = ["easy", "medium", "hard"];

const TYPE_OPTS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "text",            label: "Short Answer" },
  { value: "essay",           label: "Essay" },
  { value: "true_false",      label: "True / False" },
  { value: "fill_blank",      label: "Fill in the Blank" },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60" },
  approved:  { label: "Approved",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  active:    { label: "Active",    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  published: { label: "Published", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const DIFFICULTY_STYLE: Record<string, string> = {
  easy:   "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  medium: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  hard:   "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
};

const DIFFICULTY_LEFT: Record<string, string> = {
  easy:   "border-l-emerald-400",
  medium: "border-l-amber-400",
  hard:   "border-l-red-400",
};

// ─────────────────────────────────────────────────────────────
//  Small helper components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${m.color}`}>
      {m.label}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const c = DIFFICULTY_STYLE[difficulty] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${c}`}>
      {difficulty}
    </span>
  );
}


// ─────────────────────────────────────────────────────────────
//  Context Filter Bar  (Class → Subject → Term → Bank)
// ─────────────────────────────────────────────────────────────

interface ContextFilters {
  classId?:   number;
  subjectId?: number;
  termId?:    number;
  bankId?:    number;
}

function ContextFilterBar({
  value, onChange, showBank = true,
}: {
  value: ContextFilters;
  onChange: (v: ContextFilters) => void;
  showBank?: boolean;
}) {
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });
  const { allTerms: terms } = useAcademicCalendar();

  const { data: classSubjects = [], isLoading: subjectsLoading } = useQuery<any[]>({
    queryKey:  ["/api/classes", value.classId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${value.classId}/available-subjects`).then(r => r.json()),
    enabled:   !!value.classId,
    staleTime: 60_000,
  });

  const canLoadBanks = !!value.classId && !!value.subjectId;
  const bankParams = useMemo(() => {
    if (!canLoadBanks) return null;
    const p = new URLSearchParams({
      classId:   String(value.classId!),
      subjectId: String(value.subjectId!),
    });
    if (value.termId) p.set("termId", String(value.termId));
    return p.toString();
  }, [canLoadBanks, value.classId, value.subjectId, value.termId]);

  const { data: banks = [], isLoading: banksLoading } = useQuery<any[]>({
    queryKey:  ["/api/question-banks", "filtered", value.classId, value.subjectId, value.termId ?? null],
    queryFn:   (): Promise<any[]> => apiRequest("GET", `/api/question-banks?${bankParams}`).then(r => r.json()),
    enabled:   canLoadBanks && !!bankParams,
    staleTime: 30_000,
  });

  const steps = [
    { n: 1, label: "Class",         done: !!value.classId },
    { n: 2, label: "Subject",       done: !!value.subjectId },
    { n: 3, label: "Term (opt.)",   done: !!value.termId },
    ...(showBank ? [{ n: 4, label: "Bank", done: !!value.bankId }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Progress steps */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors
                ${s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.done ? <Check className="w-2.5 h-2.5" /> : s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${s.done ? "text-primary" : "text-muted-foreground/60"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-5 h-px flex-shrink-0 ${s.done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Filter grid */}
      <div className={`grid gap-3 ${showBank ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        {/* Class */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Class <span className="text-destructive normal-case tracking-normal">*</span>
          </Label>
          <Select
            value={value.classId ? String(value.classId) : ""}
            onValueChange={(v) => onChange({ classId: Number(v) })}
            disabled={(classes as any[]).length === 0}
          >
            <SelectTrigger data-testid="ctx-select-class" className="h-9">
              <SelectValue placeholder={
                (classes as any[]).length === 0 ? "No classes available" : "Select class…"
              } />
            </SelectTrigger>
            <SelectContent>
              {(classes as any[]).length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No classes available</div>
              ) : (
                (classes as any[]).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Subject <span className="text-destructive normal-case tracking-normal">*</span>
          </Label>
          <Select
            value={value.subjectId ? String(value.subjectId) : ""}
            onValueChange={(v) => onChange({ ...value, subjectId: Number(v), bankId: undefined })}
            disabled={!value.classId || subjectsLoading}
          >
            <SelectTrigger data-testid="ctx-select-subject" className="h-9">
              <SelectValue placeholder={
                !value.classId             ? "Select class first" :
                subjectsLoading            ? "Loading subjects…" :
                classSubjects.length === 0 ? "No subjects for this class" :
                                             "Select subject…"
              } />
            </SelectTrigger>
            <SelectContent>
              {!subjectsLoading && classSubjects.length === 0 && value.classId ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No subjects assigned to this class
                </div>
              ) : (
                classSubjects.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Term */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
            Term
            <span className="text-muted-foreground normal-case tracking-normal font-normal text-[10px] ml-1">(optional)</span>
          </Label>
          <Select
            value={value.termId ? String(value.termId) : "_all"}
            onValueChange={(v) => onChange({ ...value, termId: v === "_all" ? undefined : Number(v), bankId: undefined })}
            disabled={!value.subjectId}
          >
            <SelectTrigger data-testid="ctx-select-term" className="h-9">
              <SelectValue placeholder={value.subjectId ? "All terms" : "Select subject first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">
                <span className="text-muted-foreground">— All Terms —</span>
              </SelectItem>
              {(terms as any[]).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bank */}
        {showBank && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
              Question Bank <span className="text-destructive normal-case tracking-normal">*</span>
            </Label>
            <Select
              value={value.bankId ? String(value.bankId) : ""}
              onValueChange={(v) => onChange({ ...value, bankId: Number(v) })}
              disabled={!canLoadBanks || (canLoadBanks && !banksLoading && banks.length === 0)}
            >
              <SelectTrigger data-testid="ctx-select-bank" className="h-9">
                <SelectValue placeholder={
                  !canLoadBanks      ? "Select class & subject first" :
                  banksLoading       ? "Loading banks…" :
                  banks.length === 0 && value.termId ? "No banks for this term" :
                  banks.length === 0 ? "No banks found — create one first" :
                                      "Select bank…"
                } />
              </SelectTrigger>
              <SelectContent>
                {!banksLoading && banks.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {value.termId
                      ? "No banks exist for this term. Try \"All Terms\" or create a new bank."
                      : "No banks found. Create one using the \"New Bank\" button."}
                  </div>
                ) : (
                  banks.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {canLoadBanks && !value.termId && banks.length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 flex-shrink-0" />
                Select a term above to narrow banks
              </p>
            )}
          </div>
        )}
      </div>

      {(!value.classId || !value.subjectId) && (
        <div className="flex items-start gap-2 bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30/50 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary dark:text-primary/60">
            Select <strong>Class → Subject</strong>{showBank ? " → Bank" : ""} to load questions.
            Term is optional — leave it as <strong>All Terms</strong> to see banks from any term.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Pagination bar
// ─────────────────────────────────────────────────────────────

function PaginationBar({
  page, totalPages, total, pageSize, onPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1 && total <= pageSize) return null;
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between pt-4 border-t mt-4">
      <span className="text-xs text-muted-foreground">
        {from}–{to} of <strong>{total}</strong> question{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant="outline" className="h-7 w-7 p-0"
          disabled={page <= 1} onClick={() => onPage(page - 1)}
          data-testid="btn-prev-page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs px-2 font-medium tabular-nums">
          {page} / {totalPages || 1}
        </span>
        <Button
          size="sm" variant="outline" className="h-7 w-7 p-0"
          disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          data-testid="btn-next-page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Question Form Dialog
// ─────────────────────────────────────────────────────────────

function QuestionFormDialog({
  open, onClose, banks, context, editItem,
}: {
  open: boolean;
  onClose: () => void;
  banks: any[];
  context: ContextFilters;
  editItem?: any;
}) {
  const qc    = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editItem;

  const [form, setForm] = useState<any>(() => ({
    bankId:       editItem?.bankId       ?? context.bankId ?? banks[0]?.id ?? "",
    questionText: editItem?.questionText ?? "",
    questionType: editItem?.questionType ?? "multiple_choice",
    difficulty:   editItem?.difficulty   ?? "medium",
    points:       editItem?.points       ?? 1,
    classId:      editItem?.classId      ?? context.classId,
    termId:       editItem?.termId       ?? context.termId,
  }));

  const [options, setOptions] = useState<Array<{ optionText: string; isCorrect: boolean }>>(() =>
    editItem?.options?.length
      ? editItem.options.map((o: any) => ({ optionText: o.optionText, isCorrect: o.isCorrect }))
      : [
          { optionText: "", isCorrect: false },
          { optionText: "", isCorrect: false },
          { optionText: "", isCorrect: false },
          { optionText: "", isCorrect: false },
        ]
  );

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = isEdit
        ? await apiRequest("PUT",  `/api/question-bank/items/${editItem.id}`, data)
        : await apiRequest("POST", `/api/question-bank/items`, data);
      if (!res.ok) {
        let msg = "Failed to save question";
        try { const b = await res.json(); msg = b.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onMutate: async (data: any) => {
      await qc.cancelQueries({ queryKey: ["/api/question-bank/items"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-bank/items"] });

      if (isEdit) {
        // Optimistically update the edited item in all cached pages
        qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
          if (!old?.items) return old;
          return { ...old, items: old.items.map((it: any) =>
            it.id === editItem.id ? { ...it, ...data } : it
          )};
        });
      } else {
        // Optimistically prepend a temporary new question on the first cached page
        const tempItem = {
          id: `_temp_${Date.now()}`,
          ...data,
          status: "draft",
          createdAt: new Date().toISOString(),
          _optimistic: true,
        };
        qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
          if (!old) return old;
          return { ...old, items: [tempItem, ...(old.items ?? [])], total: (old.total ?? 0) + 1 };
        });
      }
      return { snapshot };
    },
    onSuccess: (savedItem: any) => {
      // Replace temp / stale item with confirmed server data
      qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
        if (!old?.items) return old;
        if (isEdit) {
          return { ...old, items: old.items.map((it: any) =>
            it.id === editItem.id ? { ...it, ...savedItem } : it
          )};
        }
        return { ...old, items: old.items.map((it: any) =>
          it._optimistic ? savedItem : it
        )};
      });
      toast({ title: "Success", description: isEdit ? "Question updated." : "Question created." });
      onClose();
      // Background sync for stats and full consistency
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
    onError: (e: any, _vars, context: any) => {
      // Roll back to pre-mutation state
      if (context?.snapshot) {
        context.snapshot.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      }
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!String(form.questionText).trim())
      return toast({ title: "Question text is required", variant: "destructive" });
    if (!form.bankId)
      return toast({ title: "Please select a question bank", variant: "destructive" });

    const payload: any = { ...form };

    if (form.questionType === "multiple_choice") {
      const valid = options.filter(o => o.optionText.trim());
      if (valid.length < 2)
        return toast({ title: "At least 2 options are required", variant: "destructive" });
      if (!valid.some(o => o.isCorrect))
        return toast({ title: "Mark at least one option as correct", variant: "destructive" });
      payload.options = valid.map((o, i) => ({ ...o, orderNumber: i + 1, explanationText: null }));
    }

    mutation.mutate(payload);
  };

  const isMCQ = form.questionType === "multiple_choice";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileQuestion className="w-4 h-4 text-primary" />
            </div>
            {isEdit ? "Edit Question" : "Add New Question"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bank + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/70">Question Bank</Label>
              <Select
                value={form.bankId ? String(form.bankId) : "_none"}
                onValueChange={(v) => setForm((p: any) => ({ ...p, bankId: v === "_none" ? undefined : Number(v) }))}
                disabled={banks.length === 0}
              >
                <SelectTrigger data-testid="form-select-bank" className="h-9">
                  <SelectValue placeholder={banks.length === 0 ? "No bank available" : "Select bank…"} />
                </SelectTrigger>
                <SelectContent>
                  {banks.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No banks available — create a bank first
                    </div>
                  ) : (
                    <>
                      <SelectItem value="_none">
                        <span className="text-muted-foreground">— Select bank —</span>
                      </SelectItem>
                      {banks.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/70">Question Type</Label>
              <Select
                value={form.questionType}
                onValueChange={(v) => setForm((p: any) => ({ ...p, questionType: v }))}
              >
                <SelectTrigger data-testid="form-select-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Question text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/70">
              Question Text <span className="text-destructive">*</span>
            </Label>
            <Textarea
              data-testid="form-question-text"
              value={form.questionText}
              onChange={(e) => setForm((p: any) => ({ ...p, questionText: e.target.value }))}
              placeholder="Enter the question…"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Difficulty + Points */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/70">Difficulty</Label>
              <Select
                value={form.difficulty}
                onValueChange={(v) => setForm((p: any) => ({ ...p, difficulty: v }))}
              >
                <SelectTrigger data-testid="form-select-difficulty" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTS.map(d => (
                    <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/70">Points</Label>
              <Input
                data-testid="form-points"
                type="number" min={1} max={100}
                value={form.points}
                onChange={(e) => setForm((p: any) => ({ ...p, points: Number(e.target.value) }))}
                className="h-9"
              />
            </div>
          </div>

          {/* MCQ options */}
          {isMCQ && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/70">
                Answer Options <span className="text-muted-foreground font-normal">(tick the correct one)</span>
              </Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    opt.isCorrect ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-border"
                  }`}>
                    <input
                      type="checkbox"
                      checked={opt.isCorrect}
                      onChange={(e) =>
                        setOptions(prev => prev.map((o, j) =>
                          j === i ? { ...o, isCorrect: e.target.checked } : o
                        ))
                      }
                      data-testid={`form-opt-correct-${i}`}
                      className="w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <Input
                      data-testid={`form-opt-text-${i}`}
                      value={opt.optionText}
                      onChange={(e) =>
                        setOptions(prev => prev.map((o, j) =>
                          j === i ? { ...o, optionText: e.target.value } : o
                        ))
                      }
                      placeholder={`Option ${i + 1}`}
                      className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                      disabled={options.length <= 2}
                      data-testid={`form-opt-delete-${i}`}
                      className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={options.length <= 2 ? "Minimum 2 options required" : "Remove option"}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button" size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setOptions(p => [...p, { optionText: "", isCorrect: false }])}
              >
                <Plus className="w-3 h-3 mr-1" /> Add option
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} data-testid="btn-save-question">
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
//  Question Card
// ─────────────────────────────────────────────────────────────

function QuestionCard({
  item, isAdmin, isOwner, onEdit, onDelete, onWorkflow, pendingId, pendingAction,
}: {
  item: any;
  isAdmin: boolean;
  isOwner: boolean;
  onEdit?:   () => void;
  onDelete?: () => void;
  onWorkflow: (action: string, item: any) => void;
  pendingId?:     number;
  pendingAction?: string;
}) {
  const isThisPending = (action: string) => pendingId === item.id && pendingAction === action;
  const anyPending    = pendingId === item.id;
  const [optionsOpen, setOptionsOpen] = useState(false);

  const canEditDelete =
    isAdmin || (isOwner && ["draft", "rejected"].includes(item.status));
  const canSubmit =
    (isOwner || isAdmin) && ["draft", "rejected"].includes(item.status);
  const canWithdraw = isOwner && item.status === "submitted";
  const canApproveReject = isAdmin && item.status === "submitted";
  const canPublish   = isAdmin && ["approved", "active"].includes(item.status);
  const canUnpublish = isAdmin && item.status === "published";

  const borderColor = DIFFICULTY_LEFT[item.difficulty] ?? "border-l-gray-300";

  return (
    <div
      className={`group rounded-xl border bg-card border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow`}
      data-testid={`card-question-${item.id}`}
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-2 justify-between">
          <p className="text-sm font-medium leading-snug flex-1 text-foreground">
            {item.questionText}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusBadge status={item.status} />
            {(canEditDelete || canSubmit || canWithdraw || canApproveReject || canPublish || canUnpublish) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    disabled={anyPending}
                    data-testid={`btn-actions-${item.id}`}
                  >
                    {anyPending
                      ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      : <MoreVertical className="w-3.5 h-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEditDelete && (
                    <DropdownMenuItem onClick={onEdit} data-testid={`btn-edit-${item.id}`}>
                      <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {canEditDelete && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                      data-testid={`btn-delete-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                  {canSubmit && (
                    <DropdownMenuItem onClick={() => onWorkflow("submit", item)} data-testid={`btn-submit-${item.id}`}>
                      <Send className="w-3.5 h-3.5 mr-2" /> Submit for Review
                    </DropdownMenuItem>
                  )}
                  {canWithdraw && (
                    <DropdownMenuItem onClick={() => onWorkflow("withdraw", item)} data-testid={`btn-withdraw-${item.id}`}>
                      <RotateCcw className="w-3.5 h-3.5 mr-2" /> Withdraw
                    </DropdownMenuItem>
                  )}
                  {canApproveReject && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("approve", item)}
                      className="text-emerald-600 focus:text-emerald-700"
                      data-testid={`btn-approve-${item.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-2" /> Approve
                    </DropdownMenuItem>
                  )}
                  {canApproveReject && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("reject", item)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`btn-reject-${item.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                    </DropdownMenuItem>
                  )}
                  {canPublish && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("publish", item)}
                      className="text-purple-600 focus:text-purple-700"
                      data-testid={`btn-publish-${item.id}`}
                    >
                      <Globe className="w-3.5 h-3.5 mr-2" /> Publish
                    </DropdownMenuItem>
                  )}
                  {canUnpublish && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("unpublish", item)}
                      className="text-purple-600 focus:text-purple-700"
                      data-testid={`btn-unpublish-${item.id}`}
                    >
                      <Globe className="w-3.5 h-3.5 mr-2" /> Unpublish
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={item.difficulty} />
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
            {TYPE_OPTS.find(t => t.value === item.questionType)?.label ?? item.questionType}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
            {item.points} pt{item.points !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Options toggle (MCQ) */}
        {item.questionType === "multiple_choice" && (item.options?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setOptionsOpen(p => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {optionsOpen
                ? <><ChevronUp className="w-3 h-3" /> Hide options</>
                : <><ChevronDown className="w-3 h-3" /> Show {item.options.length} options</>
              }
            </button>
            {optionsOpen && (
              <ul className="mt-2 space-y-1.5 pl-1">
                {item.options.map((o: any, i: number) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-xs rounded px-2 py-1 ${
                      o.isCorrect
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="flex-shrink-0 font-bold">
                      {o.isCorrect ? "✓" : "○"}
                    </span>
                    {o.optionText}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {item.status === "rejected" && item.rejectionReason && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-2.5">
            <p className="text-xs text-red-700 dark:text-red-300">
              <strong>Rejection reason:</strong> {item.rejectionReason}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Paginated question list
// ─────────────────────────────────────────────────────────────

function QuestionList({
  paramObj, isAdmin, userId, banks, context, page, onPageChange, onWorkflow,
  pendingId, pendingAction,
}: {
  paramObj:     Record<string, string>;
  isAdmin:      boolean;
  userId:       string;
  banks:        any[];
  context:      ContextFilters;
  page:         number;
  onPageChange: (p: number) => void;
  onWorkflow:   (action: string, item: any) => void;
  pendingId?:     number;
  pendingAction?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editItem,      setEditItem]      = useState<any>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<any>(null);
  const [formOpen,      setFormOpen]      = useState(false);

  const qs = new URLSearchParams({ ...paramObj, page: String(page) }).toString();

  // term is optional; classId + bankId (browse) or classId + subjectId (myOnly) are required
  const enabled =
    !!paramObj.classId &&
    (paramObj.myOnly === "true"
      ? true
      : !!paramObj.bankId);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey:  ["/api/question-bank/items", { ...paramObj, page: String(page) }],
    queryFn:   () => apiRequest("GET", `/api/question-bank/items?${qs}`).then(r => r.json()),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/question-bank/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      toast({ title: "Success", description: "Question deleted." });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Layers className="w-7 h-7 opacity-40" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Context not complete</p>
          <p className="text-xs max-w-xs">Select Class, Subject and Bank to load questions. Term is optional.</p>
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

  const items: any[] = data?.items ?? [];
  const pg = {
    page:       data?.page       ?? 1,
    totalPages: data?.totalPages ?? 1,
    total:      data?.total      ?? 0,
    pageSize:   data?.pageSize   ?? PAGE_SIZE,
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{pg.total}</span> question{pg.total !== 1 ? "s" : ""} found
        </p>
        <Button
          size="sm" className="h-8"
          onClick={() => { setEditItem(null); setFormOpen(true); }}
          data-testid="btn-add-question"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Question
        </Button>
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

      {formOpen && (
        <QuestionFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          banks={banks}
          context={context}
          editItem={editItem}
        />
      )}

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
              {deleteMutation.isPending ? "Deleting…" : "Delete Question"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Approval Queue  (Admin only)
// ─────────────────────────────────────────────────────────────

function ApprovalQueue({ onWorkflow }: { onWorkflow: (action: string, item: any) => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<any>({
    queryKey:  ["/api/question-bank/pending", page],
    queryFn:   () => apiRequest("GET", `/api/question-bank/pending?page=${page}&pageSize=${PAGE_SIZE}`).then(r => r.json()),
    staleTime: 20_000,
  });

  const items: any[] = data?.items ?? [];
  const pg = {
    page:       data?.page       ?? 1,
    totalPages: data?.totalPages ?? 1,
    total:      data?.total      ?? 0,
    pageSize:   PAGE_SIZE,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">All caught up!</p>
            <p className="text-xs">No questions pending review. Submitted questions will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="rounded-xl border border-l-4 border-l-amber-400 bg-card shadow-sm"
              data-testid={`card-pending-${item.id}`}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3 justify-between">
                  <p className="text-sm font-medium leading-snug flex-1">{item.questionText}</p>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DifficultyBadge difficulty={item.difficulty} />
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground capitalize">
                    {item.questionType?.replace(/_/g, " ")}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
                    By: {item.submittedByName ?? item.createdBy ?? "unknown"}
                  </span>
                </div>
                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    onClick={() => onWorkflow("approve", item)}
                    data-testid={`btn-approve-queue-${item.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => onWorkflow("reject", item)}
                    data-testid={`btn-reject-queue-${item.id}`}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationBar {...pg} onPage={setPage} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────

export default function QuestionBankManager() {
  const { user }   = useAuth();
  const { toast }  = useToast();
  const qc         = useQueryClient();

  const roleId      = user?.roleId ?? 0;
  const isAdminRole = roleId === 2;

  // ── Context states
  const [browseCtx, setBrowseCtx] = useState<ContextFilters>({});
  const [myCtx,     setMyCtx]     = useState<ContextFilters>({});

  // ── Refinement filter states
  const [browseStatus,  setBrowseStatus]  = useState("");
  const [browseDiff,    setBrowseDiff]    = useState("");
  const [browseType,    setBrowseType]    = useState("");
  const [browsePage,    setBrowsePage]    = useState(1);
  const [myStatus,      setMyStatus]      = useState("");
  const [myPage,        setMyPage]        = useState(1);

  // ── Stats queries (admin only)
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

  // ── Bank params for context
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

  // ── Create bank dialog state
  const [createBankOpen,  setCreateBankOpen]  = useState(false);
  const [newBankName,     setNewBankName]     = useState("");
  const [newBankDesc,     setNewBankDesc]     = useState("");
  const [bankSubjectId,   setBankSubjectId]   = useState("");
  const [bankClassId,     setBankClassId]     = useState("");
  const [bankTermId,      setBankTermId]      = useState("");

  const { data: bankDialogSubjects = [] } = useQuery<any[]>({
    queryKey:  ["/api/classes", bankClassId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${bankClassId}/available-subjects`).then(r => r.json()),
    enabled:   !!bankClassId,
    staleTime: 60_000,
  });
  const { currentTerm, allTerms } = useAcademicCalendar();
  const { data: allClasses = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  // Auto-select current term in browse, my-bank, and create-bank filters
  useEffect(() => {
    if (currentTerm) {
      if (!browseCtx.termId) setBrowseCtx(c => ({ ...c, termId: currentTerm.id }));
      if (!myCtx.termId) setMyCtx(c => ({ ...c, termId: currentTerm.id }));
      if (!bankTermId) setBankTermId(String(currentTerm.id));
    }
  }, [currentTerm]);

  // ── Workflow dialogs
  const [rejectTarget,    setRejectTarget]    = useState<any>(null);
  const [rejectReason,    setRejectReason]    = useState("");
  const [deleteBankTarget, setDeleteBankTarget] = useState<any>(null);

  // ── Context change handlers
  const handleBrowseCtxChange = useCallback((v: ContextFilters) => {
    setBrowseCtx(v); setBrowsePage(1);
  }, []);
  const handleMyCtxChange = useCallback((v: ContextFilters) => {
    setMyCtx(v); setMyPage(1);
  }, []);

  // ── Ready flags + params
  // Term is optional — bank already scopes the term context
  const browseReady = !!browseCtx.classId && !!browseCtx.subjectId && !!browseCtx.bankId;
  const myReady     = !!myCtx.classId    && !!myCtx.subjectId;

  const browseParams: Record<string, string> = browseReady ? {
    bankId:   String(browseCtx.bankId),
    classId:  String(browseCtx.classId),
    pageSize: String(PAGE_SIZE),
    ...(browseCtx.termId ? { termId: String(browseCtx.termId) } : {}),
    ...(browseDiff   ? { difficulty: browseDiff }     : {}),
    ...(browseType   ? { questionType: browseType }   : {}),
    ...(browseStatus ? { status: browseStatus }       : {}),
  } : {};

  const myParams: Record<string, string> = myReady ? {
    classId:  String(myCtx.classId),
    myOnly:   "true",
    pageSize: String(PAGE_SIZE),
    ...(myCtx.termId ? { termId: String(myCtx.termId) } : {}),
    ...(myStatus ? { status: myStatus } : {}),
  } : {};

  // ── Status map for optimistic updates
  const ACTION_STATUS: Record<string, string> = {
    submit: "submitted", withdraw: "draft", approve: "approved",
    reject: "rejected",  publish: "published", unpublish: "approved",
  };

  const ACTION_LABEL: Record<string, string> = {
    submit: "Submitted for review", withdraw: "Withdrawn to draft",
    approve: "Question approved",   reject: "Question rejected",
    publish: "Question published",  unpublish: "Question unpublished",
  };

  // ── Mutations
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

    onError: (e: any, _vars, context: any) => {
      if (context?.snapshot) {
        context.snapshot.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      }
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    },

    onSuccess: (serverItem: any, vars) => {
      // Stamp server-confirmed item into cache so the subsequent invalidation
      // refetch never briefly shows stale data (eliminates the unpublish flicker).
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

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
  });

  const createBankMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/question-banks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
      toast({ title: "Success", description: "Question bank created." });
      setCreateBankOpen(false);
      setNewBankName(""); setNewBankDesc(""); setBankSubjectId("");
      setBankClassId(""); setBankTermId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

  const handleWorkflow = (action: string, item: any) => {
    if (action === "reject") {
      setRejectTarget(item); setRejectReason(""); return;
    }
    workflowMutation.mutate({ action, id: item.id });
  };

  const pendingTotal = pendingData?.total ?? 0;

  // ── Render
  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
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
              <Button onClick={() => setCreateBankOpen(true)} data-testid="btn-create-bank" className="w-full sm:w-auto sm:flex-shrink-0">
                <Plus className="w-4 h-4 mr-1.5" /> New Bank
              </Button>
            )}
          </div>

          {/* Stats row (admin only) */}
          {isAdminRole && (
            <div className="mt-5">
              <StatCardGrid cols={4}>
                <StatCard
                  icon={Database} label="Total Banks"
                  value={statsData?.totalBanks ?? "—"} color="text-primary"
                  loading={!statsData}
                />
                <StatCard
                  icon={FileQuestion} label="Total Questions"
                  value={statsData?.totalQuestions ?? "—"} color="text-violet-600"
                  loading={!statsData}
                />
                <StatCard
                  icon={Clock} label="Pending Review"
                  value={pendingTotal} color="text-amber-600"
                  loading={!pendingData}
                />
                <StatCard
                  icon={Globe} label="Published"
                  value={statsData?.publishedQuestions ?? "—"} color="text-emerald-600"
                  loading={!statsData}
                />
              </StatCardGrid>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
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

            {/* Refinement filters */}
            {browseReady && (
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={browseStatus || "_all"}
                  onValueChange={(v) => { setBrowseStatus(v === "_all" ? "" : v); setBrowsePage(1); }}
                >
                  <SelectTrigger data-testid="filter-browse-status" className="h-8 text-xs w-36">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All statuses</SelectItem>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={browseDiff || "_all"}
                  onValueChange={(v) => { setBrowseDiff(v === "_all" ? "" : v); setBrowsePage(1); }}
                >
                  <SelectTrigger data-testid="filter-browse-diff" className="h-8 text-xs w-28">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All levels</SelectItem>
                    {DIFFICULTY_OPTS.map(d => (
                      <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={browseType || "_all"}
                  onValueChange={(v) => { setBrowseType(v === "_all" ? "" : v); setBrowsePage(1); }}
                >
                  <SelectTrigger data-testid="filter-browse-type" className="h-8 text-xs w-36">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All types</SelectItem>
                    {TYPE_OPTS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(browseStatus || browseDiff || browseType) && (
                  <Button
                    size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground"
                    onClick={() => { setBrowseStatus(""); setBrowseDiff(""); setBrowseType(""); setBrowsePage(1); }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            {/* Question list or empty state */}
            {!browseCtx.classId || !browseCtx.subjectId ? (
              <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-primary/40" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold">Start by selecting your context above</p>
                  <p className="text-xs max-w-sm text-center">
                    Choose Class → Subject → Bank to load questions. Term is optional — leave it as All Terms to see banks from any term.
                  </p>
                </div>
              </div>
            ) : !browseCtx.bankId ? (
              <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 opacity-40" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold">Now select a Question Bank</p>
                  <p className="text-xs max-w-xs">
                    {(browseBanks as any[]).length === 0
                      ? "No banks exist for this class/subject yet. Create one with the \"New Bank\" button above."
                      : `${(browseBanks as any[]).length} bank${(browseBanks as any[]).length > 1 ? "s" : ""} available — select one from the Bank dropdown.`
                    }
                  </p>
                </div>
              </div>
            ) : (
              <Card className="shadow-sm">
                {isAdminRole && (
                  <CardHeader className="pb-2 pt-4 px-5 border-b flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                        <Database className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">
                        {(browseBanks as any[]).find((b: any) => b.id === browseCtx.bankId)?.name ?? "Selected Bank"}
                      </span>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setDeleteBankTarget(
                        (browseBanks as any[]).find((b: any) => b.id === browseCtx.bankId)
                      )}
                      data-testid="btn-delete-bank"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete Bank
                    </Button>
                  </CardHeader>
                )}
                <CardContent className="p-5">
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
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ My Questions Tab ═══════════════════════════ */}
          <TabsContent value="my" className="space-y-4 mt-0">
            <SectionCard icon={Filter} title="Filter Context" subtitle="— Class &amp; Subject required, Term optional" contentClassName="px-5 pb-5">
              <ContextFilterBar
                value={myCtx}
                onChange={handleMyCtxChange}
                showBank={false}
              />
            </SectionCard>

            {myReady && (
              <div className="flex flex-wrap gap-2">
                <Select
                  value={myStatus || "_all"}
                  onValueChange={(v) => { setMyStatus(v === "_all" ? "" : v); setMyPage(1); }}
                >
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
            )}

            {!myCtx.classId || !myCtx.subjectId ? (
              <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <BarChart3 className="w-7 h-7 text-primary/40" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold">Select Class and Subject</p>
                  <p className="text-xs max-w-xs">
                    Choose a class and subject to load your questions. Term is optional — leave it as All Terms to see questions from any term.
                  </p>
                </div>
              </div>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="p-5">
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
                  />
                </CardContent>
              </Card>
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

      {/* ── Reject dialog ──────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              Reject Question
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {rejectTarget && (
              <div className="bg-muted/50 rounded-lg p-3 border-l-3 border-l-muted-foreground">
                <p className="text-sm text-muted-foreground line-clamp-3">{rejectTarget.questionText}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Reason for rejection <span className="text-destructive">*</span>
              </Label>
              <Textarea
                data-testid="input-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this question is being rejected so the teacher can improve it…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || workflowMutation.isPending}
              onClick={() => {
                workflowMutation.mutate({ action: "reject", id: rejectTarget.id, reason: rejectReason });
                setRejectTarget(null);
              }}
              data-testid="btn-confirm-reject"
            >
              {workflowMutation.isPending ? "Rejecting…" : "Reject Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Bank dialog (Admin) ─────────────────── */}
      {isAdminRole && (
        <Dialog open={createBankOpen} onOpenChange={(v) => {
          setCreateBankOpen(v);
          if (!v) { setNewBankName(""); setNewBankDesc(""); setBankSubjectId(""); setBankClassId(""); setBankTermId(""); }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="w-4 h-4 text-primary" />
                </div>
                Create Question Bank
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary dark:text-primary/60">
                  A bank is scoped to a specific <strong>class</strong> and <strong>subject</strong>. Optionally link it to a specific term.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Class <span className="text-destructive">*</span></Label>
                  <Select value={bankClassId} onValueChange={(v) => { setBankClassId(v); setBankSubjectId(""); }}>
                    <SelectTrigger data-testid="select-bank-class" className="h-9">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(allClasses as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Subject <span className="text-destructive">*</span></Label>
                  <Select value={bankSubjectId} onValueChange={setBankSubjectId} disabled={!bankClassId}>
                    <SelectTrigger data-testid="select-bank-subject" className="h-9">
                      <SelectValue placeholder={bankClassId ? "Select subject…" : "Select class first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(bankDialogSubjects as any[]).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Term <span className="text-muted-foreground font-normal">(optional — leave blank for all terms)</span>
                </Label>
                <Select value={bankTermId} onValueChange={setBankTermId}>
                  <SelectTrigger data-testid="select-bank-term" className="h-9">
                    <SelectValue placeholder="All terms…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">All terms (no specific term)</SelectItem>
                    {(allTerms as any[]).map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Bank Name <span className="text-destructive">*</span></Label>
                <Input
                  data-testid="input-bank-name"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="e.g. JSS 1 Mathematics — First Term 2025"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  data-testid="input-bank-desc"
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Describe what this bank covers…"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBankOpen(false)}>Cancel</Button>
              <Button
                disabled={!newBankName.trim() || !bankSubjectId || !bankClassId || createBankMutation.isPending}
                onClick={() => createBankMutation.mutate({
                  name:        newBankName.trim(),
                  subjectId:   Number(bankSubjectId),
                  classId:     Number(bankClassId),
                  termId:      bankTermId && bankTermId !== "_none" ? Number(bankTermId) : null,
                  description: newBankDesc || null,
                })}
                data-testid="btn-confirm-create-bank"
              >
                {createBankMutation.isPending ? "Creating…" : "Create Bank"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Bank Confirm ─────────────────────────── */}
      <AlertDialog open={!!deleteBankTarget} onOpenChange={(v) => !v && setDeleteBankTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Delete Question Bank
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Are you sure you want to delete <strong>"{deleteBankTarget?.name}"</strong>?
              </span>
              <span className="block text-destructive font-medium">
                This will permanently remove the bank and ALL questions inside it. This cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBankTarget && deleteBankMutation.mutate(deleteBankTarget.id)}
              data-testid="btn-confirm-delete-bank"
            >
              {deleteBankMutation.isPending ? "Deleting…" : "Delete Bank"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
