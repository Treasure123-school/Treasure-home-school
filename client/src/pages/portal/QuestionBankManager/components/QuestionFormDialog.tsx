import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, XCircle, FileQuestion } from "lucide-react";
import { DIFFICULTY_OPTS, TYPE_OPTS } from "../constants";
import type { ContextFilters } from "../types";
import { QuestionImageUpload } from "@/components/question/QuestionImageUpload";

// isAdmin is read from outer scope via closure in the original; pass it as prop here
interface QuestionFormDialogProps {
  open:     boolean;
  onClose:  () => void;
  banks:    any[];
  context:  ContextFilters;
  editItem?: any;
  isAdmin:  boolean;
}

export function QuestionFormDialog({
  open, onClose, banks, context, editItem, isAdmin,
}: QuestionFormDialogProps) {
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
    topicId:      editItem?.topicId      ?? null,
    instructions: editItem?.instructions ?? "",
    imageUrl:     editItem?.imageUrl     ?? null,
  }));

  const selectedBank   = banks.find((b: any) => b.id === Number(form.bankId));
  const topicSubjectId = selectedBank?.subjectId ?? null;

  const { data: formTopics = [] } = useQuery<any[]>({
    queryKey: ["/api/syllabus-topics", "form", form.classId, topicSubjectId, form.termId],
    queryFn: () => {
      const p = new URLSearchParams();
      if (form.classId)    p.set("classId",   String(form.classId));
      if (topicSubjectId)  p.set("subjectId", String(topicSubjectId));
      if (form.termId)     p.set("termId",    String(form.termId));
      return apiRequest("GET", `/api/syllabus-topics?${p.toString()}`).then(r => r.json());
    },
    enabled:   !!(form.classId && topicSubjectId && form.termId),
    staleTime: 60_000,
  });

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
        qc.setQueriesData({ queryKey: ["/api/question-bank/items"] }, (old: any) => {
          if (!old?.items) return old;
          return { ...old, items: old.items.map((it: any) =>
            it.id === editItem.id ? { ...it, ...data } : it
          )};
        });
      } else {
        const tempItem = {
          id: `_temp_${Date.now()}`,
          ...data,
          status: isAdmin ? "published" : "active",
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
      qc.invalidateQueries({ queryKey: ["/api/question-bank/items"] });
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]: [any, any]) => qc.setQueryData(key, data));
      }
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!String(form.questionText).trim())
      return toast({ title: "Question text is required", variant: "destructive" });
    if (!form.bankId)
      return toast({ title: "Please select a question bank", variant: "destructive" });

    const payload: any = {
      ...form,
      // Normalise: send null instead of empty string for optional text fields
      instructions: form.instructions?.trim() || null,
      imageUrl:     form.imageUrl || null,
    };

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

          {/* Topic */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/70">
              Topic <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select
              value={form.topicId ? String(form.topicId) : "_none"}
              onValueChange={(v) => setForm((p: any) => ({ ...p, topicId: v === "_none" ? null : Number(v) }))}
              disabled={!form.classId || !topicSubjectId || !form.termId}
            >
              <SelectTrigger data-testid="form-select-topic" className="h-9">
                <SelectValue placeholder={
                  !form.classId || !topicSubjectId || !form.termId
                    ? "Set class, subject & term first"
                    : formTopics.length === 0
                    ? "No topics"
                    : "Select topic…"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  <span className="text-muted-foreground">— No specific topic —</span>
                </SelectItem>
                {formTopics.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No topics</div>
                ) : (
                  formTopics.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/70">
              Instructions{" "}
              <span className="text-muted-foreground font-normal">
                (optional — shown to student above the question)
              </span>
            </Label>
            <Textarea
              data-testid="form-instructions"
              value={form.instructions}
              onChange={(e) => setForm((p: any) => ({ ...p, instructions: e.target.value }))}
              placeholder="e.g. Choose the correct answer. / Study the diagram below. / Simplify the expression."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Question Image */}
          <QuestionImageUpload
            value={form.imageUrl}
            onChange={(url) => setForm((p: any) => ({ ...p, imageUrl: url }))}
            disabled={mutation.isPending}
          />

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
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} data-testid="btn-save-question">
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
