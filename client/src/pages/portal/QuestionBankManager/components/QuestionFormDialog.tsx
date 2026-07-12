import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileQuestion } from "lucide-react";
import { DIFFICULTY_OPTS } from "../constants";
import type { ContextFilters } from "../types";
import { ManualQuestionFields } from "@/components/question/ManualQuestionFields";
import type { QuestionOption } from "@/components/question/ManualQuestionFields";

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
          {/* Bank + Difficulty — bank-specific fields */}
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
          </div>

          {/* Topic — bank-specific */}
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

          {/* Shared question fields (text, type, points, instructions, image, options) */}
          <ManualQuestionFields
            questionText={form.questionText}
            onQuestionTextChange={(v) => setForm((p: any) => ({ ...p, questionText: v }))}
            questionType={form.questionType}
            onQuestionTypeChange={(v) => setForm((p: any) => ({ ...p, questionType: v }))}
            points={form.points}
            onPointsChange={(v) => setForm((p: any) => ({ ...p, points: Number(v) }))}
            instructions={form.instructions}
            onInstructionsChange={(v) => setForm((p: any) => ({ ...p, instructions: v }))}
            imageUrl={form.imageUrl}
            onImageUrlChange={(url) => setForm((p: any) => ({ ...p, imageUrl: url }))}
            options={options}
            onOptionsChange={setOptions}
            disabled={mutation.isPending}
          />
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
