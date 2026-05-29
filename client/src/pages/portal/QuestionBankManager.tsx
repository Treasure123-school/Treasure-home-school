import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Edit, Trash2, CheckCircle, XCircle, Send, RotateCcw,
  BookOpen, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Filter, Eye, EyeOff, Globe, Layers, ArrowRight, Info,
  Search, ListChecks, BarChart3,
} from "lucide-react";

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

const STATUS_META: Record<string, { label: string; variant: "default"|"secondary"|"outline"|"destructive" }> = {
  draft:     { label: "Draft",     variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  approved:  { label: "Approved",  variant: "default" },
  rejected:  { label: "Rejected",  variant: "destructive" },
  active:    { label: "Active",    variant: "default" },
  published: { label: "Published", variant: "default" },
};

// ─────────────────────────────────────────────────────────────
//  Small helper components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant} className="capitalize text-xs">{m.label}</Badge>;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const c: Record<string, string> = {
    easy:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    hard:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${c[difficulty] ?? "bg-gray-100 text-gray-800"}`}>
      {difficulty}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  Step progress indicator
// ─────────────────────────────────────────────────────────────

function StepDot({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
        ${done   ? "bg-primary border-primary text-primary-foreground"
                 : active ? "border-primary text-primary bg-primary/10"
                          : "border-muted-foreground/25 text-muted-foreground/40 bg-muted/20"}`}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-[10px] text-center leading-tight font-medium
        ${done || active ? "text-foreground" : "text-muted-foreground/40"}`}>{label}</span>
    </div>
  );
}

function StepBar({ classId, subjectId, termId, bankId }: {
  classId?: number; subjectId?: number; termId?: number; bankId?: number;
}) {
  const steps = [
    { label: "Class",   done: !!classId },
    { label: "Subject", done: !!subjectId },
    { label: "Term",    done: !!termId },
    { label: "Bank",    done: !!bankId },
  ];
  const activeIdx = steps.findIndex(s => !s.done);
  return (
    <div className="flex items-center gap-1 py-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-0.5">
          <StepDot n={i + 1} done={s.done} active={i === activeIdx} label={s.label} />
          {i < steps.length - 1 && (
            <ArrowRight className={`w-3 h-3 flex-shrink-0 mb-3.5 ${s.done ? "text-primary" : "text-muted-foreground/25"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Context Filter Bar  (Class → Subject → Term → Bank)
//
//  Rules:
//   • Selecting Class resets Subject / Term / Bank
//   • Selecting Subject resets Bank
//   • Questions never load until all required fields are set
// ─────────────────────────────────────────────────────────────

interface ContextFilters {
  classId?:   number;
  subjectId?: number;
  termId?:    number;
  bankId?:    number;
}

function ContextFilterBar({
  value, onChange, showBank = true, bankOptional = false,
}: {
  value: ContextFilters;
  onChange: (v: ContextFilters) => void;
  showBank?: boolean;
  bankOptional?: boolean;
}) {
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });
  const { data: terms   = [] } = useQuery<any[]>({ queryKey: ["/api/terms"] });

  // Subjects are filtered to only those mapped to the selected class
  const { data: classSubjects = [], isLoading: subjectsLoading } = useQuery<any[]>({
    queryKey:  ["/api/classes", value.classId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${value.classId}/available-subjects`).then(r => r.json()),
    enabled:   !!value.classId,
    staleTime: 60_000,
  });

  // Banks are filtered by class + subject (required) + term (optional refinement)
  // They load as soon as class AND subject are selected — term is not needed to list banks
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

  const contextOk = !!value.classId && !!value.subjectId && !!value.termId;

  return (
    <div className="space-y-3">
      <StepBar
        classId={value.classId}
        subjectId={value.subjectId}
        termId={value.termId}
        bankId={showBank ? value.bankId : (contextOk ? 1 : undefined)}
      />

      <div className={`grid gap-2 ${showBank ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
        {/* Class */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Class <span className="text-destructive">*</span></Label>
          <Select
            value={value.classId ? String(value.classId) : ""}
            onValueChange={(v) => onChange({ classId: Number(v) })}
          >
            <SelectTrigger data-testid="ctx-select-class" className="h-8 text-xs">
              <SelectValue placeholder="Select class…" />
            </SelectTrigger>
            <SelectContent>
              {(classes as any[]).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject — only subjects mapped to the selected class */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Subject <span className="text-destructive">*</span></Label>
          <Select
            value={value.subjectId ? String(value.subjectId) : ""}
            onValueChange={(v) => onChange({ ...value, subjectId: Number(v), bankId: undefined })}
            disabled={!value.classId}
          >
            <SelectTrigger data-testid="ctx-select-subject" className="h-8 text-xs">
              <SelectValue placeholder={
                !value.classId      ? "Select class first" :
                subjectsLoading     ? "Loading subjects…" :
                classSubjects.length === 0 ? "No subjects for this class" :
                                     "Select subject…"
              } />
            </SelectTrigger>
            <SelectContent>
              {classSubjects.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Term */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Term <span className="text-destructive">*</span></Label>
          <Select
            value={value.termId ? String(value.termId) : ""}
            onValueChange={(v) => onChange({ ...value, termId: Number(v) })}
            disabled={!value.subjectId}
          >
            <SelectTrigger data-testid="ctx-select-term" className="h-8 text-xs">
              <SelectValue placeholder={value.subjectId ? "Select term…" : "Select subject first"} />
            </SelectTrigger>
            <SelectContent>
              {(terms as any[]).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bank — loads after class + subject selected; narrows when term is selected */}
        {showBank && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">
              Question Bank {!bankOptional && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={value.bankId ? String(value.bankId) : ""}
              onValueChange={(v) => onChange({ ...value, bankId: Number(v) })}
              disabled={!canLoadBanks}
            >
              <SelectTrigger data-testid="ctx-select-bank" className="h-8 text-xs">
                <SelectValue placeholder={
                  !canLoadBanks          ? "Select class & subject first" :
                  banksLoading           ? "Loading banks…" :
                  banks.length === 0     ? "No banks found" :
                                          "Select bank…"
                } />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                    {!value.termId && b.termId && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground opacity-70">
                        (term filtered)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canLoadBanks && !value.termId && banks.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Showing banks across all terms. Select term to narrow.
              </p>
            )}
          </div>
        )}
      </div>

      {!contextOk && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3 h-3 flex-shrink-0" />
          Select <strong>Class</strong>, <strong>Subject</strong>, and <strong>Term</strong> to load questions. Banks become available after Class + Subject.
        </p>
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
    <div className="flex items-center justify-between pt-3 border-t mt-3">
      <span className="text-xs text-muted-foreground">{from}–{to} of {total} question{total !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant="outline" className="h-7 w-7 p-0"
          disabled={page <= 1} onClick={() => onPage(page - 1)}
          data-testid="btn-prev-page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs px-2 font-medium">
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
//  Question Form Dialog  (create / edit)
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
    mutationFn: (data: any) => isEdit
      ? apiRequest("PUT",  `/api/question-bank/items/${editItem.id}`, data)
      : apiRequest("POST", `/api/question-bank/items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      toast({ title: isEdit ? "Question updated" : "Question created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
          <DialogTitle>{isEdit ? "Edit Question" : "Add New Question"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Question Bank</Label>
              <Select
                value={String(form.bankId || "")}
                onValueChange={(v) => setForm((p: any) => ({ ...p, bankId: Number(v) }))}
              >
                <SelectTrigger data-testid="form-select-bank" className="text-sm">
                  <SelectValue placeholder="Select bank…" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Question Type</Label>
              <Select
                value={form.questionType}
                onValueChange={(v) => setForm((p: any) => ({ ...p, questionType: v }))}
              >
                <SelectTrigger data-testid="form-select-type" className="text-sm">
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

          <div className="space-y-1">
            <Label className="text-xs">Question Text <span className="text-destructive">*</span></Label>
            <Textarea
              data-testid="form-question-text"
              value={form.questionText}
              onChange={(e) => setForm((p: any) => ({ ...p, questionText: e.target.value }))}
              placeholder="Enter the question…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Difficulty</Label>
              <Select
                value={form.difficulty}
                onValueChange={(v) => setForm((p: any) => ({ ...p, difficulty: v }))}
              >
                <SelectTrigger data-testid="form-select-difficulty" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTS.map(d => (
                    <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Points</Label>
              <Input
                data-testid="form-points"
                type="number" min={1} max={100}
                value={form.points}
                onChange={(e) => setForm((p: any) => ({ ...p, points: Number(e.target.value) }))}
                className="text-sm"
              />
            </div>
          </div>

          {isMCQ && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Answer Options <span className="text-muted-foreground">(tick the correct one)</span>
              </Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
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
                    className="text-sm"
                  />
                </div>
              ))}
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setOptions(p => [...p, { optionText: "", isCorrect: false }])}
                className="text-xs"
              >
                + Add option
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            data-testid="btn-save-question"
          >
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
  item, isAdmin, isOwner, onEdit, onDelete, onWorkflow,
}: {
  item: any;
  isAdmin: boolean;
  isOwner: boolean;
  onEdit?:   () => void;
  onDelete?: () => void;
  onWorkflow: (action: string, item: any) => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);

  const canEditDelete =
    isAdmin || (isOwner && ["draft", "rejected"].includes(item.status));
  const canSubmit =
    (isOwner || isAdmin) && ["draft", "rejected"].includes(item.status);
  const canWithdraw = isOwner && item.status === "submitted";
  const canApproveReject = isAdmin && item.status === "submitted";
  const canPublish = isAdmin && ["approved", "active"].includes(item.status);

  return (
    <Card className="group hover:shadow-md transition-shadow" data-testid={`card-question-${item.id}`}>
      <CardContent className="p-4 space-y-2">
        {/* Question text + status */}
        <div className="flex items-start gap-2 justify-between">
          <p className="text-sm font-medium leading-snug flex-1">{item.questionText}</p>
          <StatusBadge status={item.status} />
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <DifficultyBadge difficulty={item.difficulty} />
          <Badge variant="outline" className="text-xs capitalize">
            {TYPE_OPTS.find(t => t.value === item.questionType)?.label ?? item.questionType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {item.points} pt{item.points !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Options preview */}
        {item.questionType === "multiple_choice" && (item.options?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setOptionsOpen(p => !p)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {optionsOpen
                ? <><EyeOff className="w-3 h-3" /> Hide options</>
                : <><Eye className="w-3 h-3" /> Show {item.options.length} options</>
              }
            </button>
            {optionsOpen && (
              <ul className="mt-2 space-y-1 pl-2">
                {item.options.map((o: any, i: number) => (
                  <li
                    key={i}
                    className={`flex items-start gap-1.5 text-xs ${
                      o.isCorrect
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0">{o.isCorrect ? "✓" : "○"}</span>
                    {o.optionText}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {item.status === "rejected" && item.rejectionReason && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-2">
            <p className="text-xs text-destructive">
              <strong>Rejection reason:</strong> {item.rejectionReason}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {canEditDelete && (
            <>
              <Button
                size="sm" variant="outline" className="h-6 text-xs px-2"
                onClick={onEdit} data-testid={`btn-edit-${item.id}`}
              >
                <Edit className="w-3 h-3 mr-1" /> Edit
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                onClick={onDelete} data-testid={`btn-delete-${item.id}`}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </>
          )}
          {canSubmit && (
            <Button
              size="sm" className="h-6 text-xs px-2"
              onClick={() => onWorkflow("submit", item)}
              data-testid={`btn-submit-${item.id}`}
            >
              <Send className="w-3 h-3 mr-1" /> Submit for Review
            </Button>
          )}
          {canWithdraw && (
            <Button
              size="sm" variant="outline" className="h-6 text-xs px-2"
              onClick={() => onWorkflow("withdraw", item)}
              data-testid={`btn-withdraw-${item.id}`}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Withdraw
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                size="sm" variant="outline"
                className="h-6 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                onClick={() => onWorkflow("approve", item)}
                data-testid={`btn-approve-${item.id}`}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-6 text-xs px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => onWorkflow("reject", item)}
                data-testid={`btn-reject-${item.id}`}
              >
                <XCircle className="w-3 h-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {canPublish && (
            <Button
              size="sm"
              className="h-6 text-xs px-2 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => onWorkflow("publish", item)}
              data-testid={`btn-publish-${item.id}`}
            >
              <Globe className="w-3 h-3 mr-1" /> Publish
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Paginated question list
//  queryKey[1] contains the URL params as a plain object
// ─────────────────────────────────────────────────────────────

function QuestionList({
  paramObj, isAdmin, userId, banks, context, page, onPageChange, onWorkflow,
}: {
  paramObj:     Record<string, string>;
  isAdmin:      boolean;
  userId:       string;
  banks:        any[];
  context:      ContextFilters;
  page:         number;
  onPageChange: (p: number) => void;
  onWorkflow:   (action: string, item: any) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editItem,      setEditItem]      = useState<any>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<any>(null);
  const [formOpen,      setFormOpen]      = useState(false);

  const qs = new URLSearchParams({ ...paramObj, page: String(page) }).toString();

  const enabled =
    !!paramObj.classId && !!paramObj.termId &&
    (!!paramObj.bankId || paramObj.myOnly === "true");

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
      toast({ title: "Question deleted" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border-2 border-dashed rounded-lg">
        <Layers className="w-10 h-10 opacity-25" />
        <p className="text-sm font-medium">Context filters incomplete</p>
        <p className="text-xs text-center max-w-xs">
          Select Class, Subject, and Term — then choose a bank — to load questions safely.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm">Failed to load questions. Please retry.</p>
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
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {pg.total} question{pg.total !== 1 ? "s" : ""} found
        </p>
        <Button
          size="sm" className="h-7 text-xs"
          onClick={() => { setEditItem(null); setFormOpen(true); }}
          data-testid="btn-add-question"
        >
          <Plus className="w-3 h-3 mr-1" /> Add Question
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <BookOpen className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">No questions found</p>
          <p className="text-xs">Adjust filters or add the first question.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <QuestionCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isOwner={item.createdBy === userId}
              onEdit={() => { setEditItem(item); setFormOpen(true); }}
              onDelete={() => setDeleteTarget(item)}
              onWorkflow={onWorkflow}
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
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
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
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold">Pending Review</span>
        <Badge variant="secondary" className="text-xs">{pg.total}</Badge>
        {pg.total === 0 && (
          <span className="text-xs text-muted-foreground">— all caught up!</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-medium">Nothing pending review</p>
          <p className="text-xs">Teachers' submitted questions will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item: any) => (
            <Card
              key={item.id}
              className="border-amber-200 dark:border-amber-800/60"
              data-testid={`card-pending-${item.id}`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2 justify-between">
                  <p className="text-sm font-medium leading-snug flex-1">{item.questionText}</p>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <DifficultyBadge difficulty={item.difficulty} />
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.questionType?.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    By: {item.createdBy ?? "unknown"}
                  </Badge>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    size="sm" variant="outline"
                    className="h-6 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    onClick={() => onWorkflow("approve", item)}
                    data-testid={`btn-approve-queue-${item.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-6 text-xs px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => onWorkflow("reject", item)}
                    data-testid={`btn-reject-queue-${item.id}`}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
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
  const isAdminRole = roleId === 1 || roleId === 2;

  // ── Context states ───────────────────────────────────────
  const [browseCtx, setBrowseCtx] = useState<ContextFilters>({});
  const [myCtx,     setMyCtx]     = useState<ContextFilters>({});

  // ── Refinement filter states ─────────────────────────────
  const [browseStatus,  setBrowseStatus]  = useState("");
  const [browseDiff,    setBrowseDiff]    = useState("");
  const [browseType,    setBrowseType]    = useState("");
  const [browsePage,    setBrowsePage]    = useState(1);

  const [myStatus, setMyStatus] = useState("");
  const [myPage,   setMyPage]   = useState(1);

  // ── Banks for current filter contexts (class + subject + optional term) ──────
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
  const { data: allSubjects = [] } = useQuery<any[]>({ queryKey: ["/api/subjects"] });

  // ── Workflow dialogs ─────────────────────────────────────
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [createBankOpen, setCreateBankOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankDesc, setNewBankDesc] = useState("");
  const [bankSubjectId, setBankSubjectId] = useState("");
  const [bankClassId,   setBankClassId]   = useState("");
  const [bankTermId,    setBankTermId]    = useState("");

  // Subjects for the bank creation dialog (filtered by selected class)
  const { data: bankDialogSubjects = [] } = useQuery<any[]>({
    queryKey:  ["/api/classes", bankClassId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${bankClassId}/available-subjects`).then(r => r.json()),
    enabled:   !!bankClassId,
    staleTime: 60_000,
  });
  const { data: allTerms = [] } = useQuery<any[]>({ queryKey: ["/api/terms"] });
  const { data: allClasses = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  // ── Context change handlers — reset page + downstream ──
  const handleBrowseCtxChange = useCallback((v: ContextFilters) => {
    setBrowseCtx(v);
    setBrowsePage(1);
  }, []);
  const handleMyCtxChange = useCallback((v: ContextFilters) => {
    setMyCtx(v);
    setMyPage(1);
  }, []);

  // ── Param objects for query keys ─────────────────────────
  const browseReady = !!browseCtx.classId && !!browseCtx.termId && !!browseCtx.bankId;
  const myReady     = !!myCtx.classId    && !!myCtx.termId;

  const browseParams: Record<string, string> = browseReady ? {
    bankId:  String(browseCtx.bankId),
    classId: String(browseCtx.classId),
    termId:  String(browseCtx.termId),
    pageSize: String(PAGE_SIZE),
    ...(browseDiff   ? { difficulty: browseDiff }     : {}),
    ...(browseType   ? { questionType: browseType }   : {}),
    ...(browseStatus ? { status: browseStatus }       : {}),
  } : {};

  const myParams: Record<string, string> = myReady ? {
    classId: String(myCtx.classId),
    termId:  String(myCtx.termId),
    myOnly:  "true",
    pageSize: String(PAGE_SIZE),
    ...(myStatus ? { status: myStatus } : {}),
  } : {};

  // ── Workflow mutation ────────────────────────────────────
  const workflowMutation = useMutation({
    mutationFn: ({ action, id, reason }: { action: string; id: number; reason?: string }) =>
      apiRequest("POST", `/api/question-bank/items/${id}/${action}`, reason ? { reason } : undefined),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/pending"] });
      const labels: Record<string, string> = {
        submit: "Submitted for review", withdraw: "Withdrawn to draft",
        approve: "Question approved", reject: "Question rejected",
        publish: "Question published",
      };
      toast({ title: labels[vars.action] ?? "Action complete" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const createBankMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/question-banks`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      toast({ title: "Question bank created" });
      setCreateBankOpen(false);
      setNewBankName(""); setNewBankDesc(""); setBankSubjectId("");
      setBankClassId(""); setBankTermId("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleWorkflow = (action: string, item: any) => {
    if (action === "reject") {
      setRejectTarget(item);
      setRejectReason("");
      return;
    }
    workflowMutation.mutate({ action, id: item.id });
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Question Bank Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organised by class, subject &amp; term. Questions load only when context is set.
          </p>
        </div>
        {isAdminRole && (
          <Button size="sm" onClick={() => setCreateBankOpen(true)} data-testid="btn-create-bank">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Bank
          </Button>
        )}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <Search className="w-3.5 h-3.5 mr-1.5" />
            {isAdminRole ? "Browse Banks" : "Browse Bank"}
          </TabsTrigger>
          <TabsTrigger value="my" data-testid="tab-my">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            My Questions
          </TabsTrigger>
          {isAdminRole && (
            <TabsTrigger value="pending" data-testid="tab-pending">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Approval Queue
            </TabsTrigger>
          )}
        </TabsList>

        {/* ══ Browse Tab ══════════════════════════════════════ */}
        <TabsContent value="browse" className="space-y-4">
          {/* Context selector card */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                Select Context
                <span className="text-xs font-normal text-muted-foreground">
                  — all four fields required before questions load
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ContextFilterBar value={browseCtx} onChange={handleBrowseCtxChange} showBank />
            </CardContent>
          </Card>

          {/* Refinement filters — only shown once context is ready */}
          {browseReady && (
            <div className="flex flex-wrap gap-2 items-center">
              <Select
                value={browseStatus || "_all"}
                onValueChange={(v) => { setBrowseStatus(v === "_all" ? "" : v); setBrowsePage(1); }}
              >
                <SelectTrigger data-testid="filter-browse-status" className="h-7 text-xs w-36">
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
                <SelectTrigger data-testid="filter-browse-diff" className="h-7 text-xs w-28">
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
                <SelectTrigger data-testid="filter-browse-type" className="h-7 text-xs w-36">
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
                  size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setBrowseStatus(""); setBrowseDiff(""); setBrowseType(""); setBrowsePage(1); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Placeholder: context not set */}
          {!browseCtx.classId || !browseCtx.subjectId || !browseCtx.termId ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <Layers className="w-10 h-10 opacity-25" />
              <p className="text-sm font-semibold">Start by selecting your context above</p>
              <p className="text-xs text-center max-w-sm">
                Choosing Class → Subject → Term → Bank ensures only the relevant questions load — keeping the page fast regardless of how many questions exist in the system.
              </p>
            </div>
          ) : !browseCtx.bankId ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <BookOpen className="w-10 h-10 opacity-25" />
              <p className="text-sm font-semibold">Now select a Question Bank</p>
              <p className="text-xs text-center max-w-xs">
                {(browseBanks as any[]).length === 0
                  ? "No banks exist for this subject yet. Create one with the button above."
                  : `${(browseBanks as any[]).length} bank${(browseBanks as any[]).length > 1 ? "s" : ""} available for the selected subject.`
                }
              </p>
            </div>
          ) : (
            <QuestionList
              paramObj={browseParams}
              isAdmin={isAdminRole}
              userId={user?.id ?? ""}
              banks={browseBanks as any[]}
              context={browseCtx}
              page={browsePage}
              onPageChange={setBrowsePage}
              onWorkflow={handleWorkflow}
            />
          )}
        </TabsContent>

        {/* ══ My Questions Tab ════════════════════════════════ */}
        <TabsContent value="my" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                Select Context
                <span className="text-xs font-normal text-muted-foreground">
                  — Class &amp; Term required
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ContextFilterBar
                value={myCtx}
                onChange={handleMyCtxChange}
                showBank={false}
              />
            </CardContent>
          </Card>

          {myReady && (
            <div className="flex flex-wrap gap-2">
              <Select
                value={myStatus || "_all"}
                onValueChange={(v) => { setMyStatus(v === "_all" ? "" : v); setMyPage(1); }}
              >
                <SelectTrigger data-testid="filter-my-status" className="h-7 text-xs w-36">
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

          {!myCtx.classId || !myCtx.termId ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <BarChart3 className="w-10 h-10 opacity-25" />
              <p className="text-sm font-semibold">Select Class and Term to see your questions</p>
              <p className="text-xs text-center max-w-xs">
                This scopes the list to one class-term at a time, keeping it organised and fast.
              </p>
            </div>
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
            />
          )}
        </TabsContent>

        {/* ══ Approval Queue (Admin) ═══════════════════════════ */}
        {isAdminRole && (
          <TabsContent value="pending" className="space-y-4">
            <ApprovalQueue onWorkflow={handleWorkflow} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Reject dialog ──────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {rejectTarget && (
              <p className="text-sm text-muted-foreground border-l-2 pl-3 line-clamp-3">
                {rejectTarget.questionText}
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">
                Reason for rejection <span className="text-destructive">*</span>
              </Label>
              <Textarea
                data-testid="input-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this question is being rejected…"
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
              {workflowMutation.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Bank dialog (Admin) ─────────────────────── */}
      {isAdminRole && (
        <Dialog open={createBankOpen} onOpenChange={(v) => {
          setCreateBankOpen(v);
          if (!v) { setNewBankName(""); setNewBankDesc(""); setBankSubjectId(""); setBankClassId(""); setBankTermId(""); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Question Bank</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {/* Step hint */}
              <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                A bank is scoped to a specific <strong>class</strong>, <strong>subject</strong>, and optionally a <strong>term</strong> — this keeps banks organised and filterable.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Class (required) */}
                <div className="space-y-1">
                  <Label className="text-xs">Class <span className="text-destructive">*</span></Label>
                  <Select value={bankClassId} onValueChange={(v) => { setBankClassId(v); setBankSubjectId(""); }}>
                    <SelectTrigger data-testid="select-bank-class" className="text-sm">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(allClasses as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject — filtered by selected class */}
                <div className="space-y-1">
                  <Label className="text-xs">Subject <span className="text-destructive">*</span></Label>
                  <Select value={bankSubjectId} onValueChange={setBankSubjectId} disabled={!bankClassId}>
                    <SelectTrigger data-testid="select-bank-subject" className="text-sm">
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

              {/* Term (optional) */}
              <div className="space-y-1">
                <Label className="text-xs">Term <span className="text-muted-foreground">(optional — leave blank to apply to all terms)</span></Label>
                <Select value={bankTermId} onValueChange={setBankTermId}>
                  <SelectTrigger data-testid="select-bank-term" className="text-sm">
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

              <div className="space-y-1">
                <Label className="text-xs">Bank Name <span className="text-destructive">*</span></Label>
                <Input
                  data-testid="input-bank-name"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="e.g. JSS 1 Computer Studies — First Term"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  data-testid="input-bank-desc"
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Optional description…"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBankOpen(false)}>Cancel</Button>
              <Button
                disabled={!newBankName.trim() || !bankSubjectId || !bankClassId || createBankMutation.isPending}
                onClick={() => createBankMutation.mutate({
                  name:      newBankName.trim(),
                  subjectId: Number(bankSubjectId),
                  classId:   Number(bankClassId),
                  termId:    bankTermId && bankTermId !== "_none" ? Number(bankTermId) : null,
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
    </div>
  );
}
