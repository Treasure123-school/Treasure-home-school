/**
 * EditScoreDialog — shared score-editing dialog for teachers and admins.
 *
 * UI: admin-style (shows max as a hint, no separate max-score inputs).
 * Mutation: teacher-style (full optimistic cache update → instant UI feedback,
 *           server reconciliation on success, rollback on error).
 */
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  STANDARD_GRADING_SCALE,
  calculateWeightedScore,
  calculateGradeFromConfig,
} from "@shared/grading-utils";

export interface ScoreItem {
  id: number;
  subjectName: string;
  testScore: number | null;
  testMaxScore: number | null;
  examScore: number | null;
  examMaxScore: number | null;
  teacherRemarks?: string | null;
  canEditTest?: boolean;
  canEditExam?: boolean;
  canEditRemarks?: boolean;
}

interface EditScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The report card item being edited. */
  item: ScoreItem | null;
  /** Full TanStack Query key for the report card's "full" query. */
  reportCardQueryKey: readonly unknown[];
  /** Optional grading config from the DB. Falls back to STANDARD_GRADING_SCALE. */
  gradingConfig?: any;
  /** Whether to show the teacher remarks textarea. Default: true */
  showRemarks?: boolean;
  /** Optional callback fired after a successful save, with the authoritative server response. */
  onSaveSuccess?: (serverData: any) => void;
}

export function EditScoreDialog({
  open,
  onOpenChange,
  item,
  reportCardQueryKey,
  gradingConfig,
  showRemarks = true,
  onSaveSuccess,
}: EditScoreDialogProps) {
  const { toast } = useToast();
  const [testScore, setTestScore] = useState("");
  const [examScore, setExamScore] = useState("");
  const [remarks, setRemarks] = useState("");

  // Sync form values whenever the dialog opens or the item changes.
  // Depending on both `open` and `item` ensures form resets if the same item
  // is re-opened after a dismissed (unsaved) edit session.
  useEffect(() => {
    if (open && item) {
      setTestScore(item.testScore != null ? String(item.testScore) : "");
      setExamScore(item.examScore != null ? String(item.examScore) : "");
      setRemarks(item.teacherRemarks || "");
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: async (payload: {
      itemId: number;
      testScore?: number;
      testMaxScore?: number;
      examScore?: number;
      examMaxScore?: number;
      teacherRemarks?: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/reports/items/${payload.itemId}/override`,
        payload,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update score");
      }
      return response.json();
    },

    onMutate: async (data) => {
      // Stop any in-flight refetch so it doesn't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: reportCardQueryKey as any[] });

      // Snapshot for rollback
      const previousData = queryClient.getQueryData(reportCardQueryKey as any[]);

      // Optimistically apply the new scores and recalculate derived values locally
      queryClient.setQueryData(reportCardQueryKey as any[], (old: any) => {
        if (!old || !old.items) return old;

        const activeConfig =
          gradingConfig?.currentConfig ?? STANDARD_GRADING_SCALE;

        return {
          ...old,
          items: old.items.map((it: any) => {
            if (it.id !== data.itemId) return it;

            const updated = { ...it };

            const newTestScore =
              data.testScore !== undefined ? data.testScore : it.testScore;
            const newExamScore =
              data.examScore !== undefined ? data.examScore : it.examScore;

            // Use the item's known max scores; fall back to config weights.
            // Also mirrors the payload's max scores when the mutation sends them
            // (i.e. when the item previously had no persisted max score), so the
            // optimistic value stays consistent with what the server will persist.
            const testMax =
              data.testMaxScore !== undefined
                ? data.testMaxScore
                : it.testMaxScore != null
                  ? it.testMaxScore
                  : activeConfig.testWeight;
            const examMax =
              data.examMaxScore !== undefined
                ? data.examMaxScore
                : it.examMaxScore != null
                  ? it.examMaxScore
                  : activeConfig.examWeight;

            const weighted = calculateWeightedScore(
              newTestScore,
              testMax,
              newExamScore,
              examMax,
              activeConfig,
            );
            const gradeInfo = calculateGradeFromConfig(
              weighted.percentage,
              activeConfig,
            );

            updated.testScore = newTestScore;
            updated.examScore = newExamScore;
            updated.testMaxScore = testMax;
            updated.examMaxScore = examMax;
            updated.testWeightedScore = Math.round(weighted.testWeighted);
            updated.examWeightedScore = Math.round(weighted.examWeighted);
            updated.obtainedMarks = Math.round(weighted.weightedScore);
            updated.percentage = Math.round(weighted.percentage);
            updated.grade = gradeInfo.grade;
            updated.remarks = gradeInfo.remarks;
            if (data.teacherRemarks !== undefined)
              updated.teacherRemarks = data.teacherRemarks;
            updated.isOverridden = true;
            updated.overriddenAt = new Date().toISOString();

            return updated;
          }),
        };
      });

      // Close immediately — the user sees the updated value at once
      onOpenChange(false);

      return { previousData };
    },

    onSuccess: (serverData) => {
      // Reconcile with authoritative server data (includes recalculated totals).
      // Using setQueryData avoids a flicker-causing refetch.
      queryClient.setQueryData(reportCardQueryKey as any[], (old: any) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          // Merge report-card-level aggregates when the server returns them
          ...(serverData.reportCardTotals
            ? {
                totalScore: serverData.reportCardTotals.totalScore,
                averageScore: serverData.reportCardTotals.averageScore,
                averagePercentage:
                  serverData.reportCardTotals.averagePercentage,
                overallGrade: serverData.reportCardTotals.overallGrade,
              }
            : {}),
          items: old.items.map((it: any) =>
            it.id === serverData.id
              ? {
                  ...it,
                  ...serverData,
                  // Preserve permission flags that only the list query knows about
                  canEditTest: it.canEditTest,
                  canEditExam: it.canEditExam,
                  canEditRemarks: it.canEditRemarks,
                }
              : it,
          ),
        };
      });

      // Notify parent so it can update any secondary caches (e.g. class-term list in teacher view)
      onSaveSuccess?.(serverData);

      toast({ title: "Saved", description: "Score updated successfully" });
    },

    onError: (error: any, _vars, context: any) => {
      // Rollback to pre-mutation state
      if (context?.previousData) {
        queryClient.setQueryData(
          reportCardQueryKey as any[],
          context.previousData,
        );
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update score",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!item) return;

    const canEditTest = item.canEditTest !== false;
    const canEditExam = item.canEditExam !== false;
    const activeConfig = gradingConfig?.currentConfig ?? STANDARD_GRADING_SCALE;

    const payload: Parameters<typeof mutation.mutate>[0] = {
      itemId: item.id,
    };

    if (canEditTest && testScore !== "") {
      payload.testScore = Number(testScore);
      // If the item has no persisted max score yet, send the config's weight so the
      // server's weighted calculation doesn't treat this portion as having zero weight.
      if (item.testMaxScore == null) {
        payload.testMaxScore = activeConfig.testWeight;
      }
    }
    if (canEditExam && examScore !== "") {
      payload.examScore = Number(examScore);
      if (item.examMaxScore == null) {
        payload.examMaxScore = activeConfig.examWeight;
      }
    }
    if (showRemarks && (canEditTest || canEditExam) && remarks) {
      payload.teacherRemarks = remarks;
    }

    mutation.mutate(payload);
  };

  if (!item) return null;

  const canEditTest = item.canEditTest !== false;
  const canEditExam = item.canEditExam !== false;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Score</DialogTitle>
          <DialogDescription className="text-sm">
            Adjust scores for{" "}
            <strong>{item.subjectName}</strong>. Changes appear instantly and
            totals recalculate automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            {/* CA / Test Score */}
            <div className="space-y-1">
              <Label htmlFor="edit-test-score" className="text-sm">
                CA / Test Score
                {item.testMaxScore != null && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (max {item.testMaxScore})
                  </span>
                )}
              </Label>
              <Input
                id="edit-test-score"
                type="number"
                min="0"
                max={item.testMaxScore ?? undefined}
                value={testScore}
                onChange={(e) => setTestScore(e.target.value)}
                placeholder="e.g. 28"
                disabled={!canEditTest}
              />
              {!canEditTest && (
                <p className="text-xs text-muted-foreground">
                  You did not create this CA exam
                </p>
              )}
            </div>

            {/* Exam Score */}
            <div className="space-y-1">
              <Label htmlFor="edit-exam-score" className="text-sm">
                Exam Score
                {item.examMaxScore != null && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (max {item.examMaxScore})
                  </span>
                )}
              </Label>
              <Input
                id="edit-exam-score"
                type="number"
                min="0"
                max={item.examMaxScore ?? undefined}
                value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
                placeholder="e.g. 52"
                disabled={!canEditExam}
              />
              {!canEditExam && (
                <p className="text-xs text-muted-foreground">
                  You did not create this exam
                </p>
              )}
            </div>
          </div>

          {/* Optional remarks (shown for teachers) */}
          {showRemarks && (
            <div className="space-y-1">
              <Label htmlFor="edit-remarks" className="text-sm">
                Teacher Remarks
              </Label>
              <Textarea
                id="edit-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for override (optional)…"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Score"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
