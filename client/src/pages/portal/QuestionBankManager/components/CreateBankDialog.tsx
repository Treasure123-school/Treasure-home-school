import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAcademicCalendar } from "@/hooks/useAcademicCalendar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Database, Info } from "lucide-react";

interface CreateBankDialogProps {
  open:        boolean;
  onOpenChange: (v: boolean) => void;
}

export function CreateBankDialog({ open, onOpenChange }: CreateBankDialogProps) {
  const qc    = useQueryClient();
  const { toast } = useToast();
  const { currentTerm, allTerms } = useAcademicCalendar();

  const [bankName,     setBankName]     = useState("");
  const [bankDesc,     setBankDesc]     = useState("");
  const [bankSubjectId, setBankSubjectId] = useState("");
  const [bankClassId,  setBankClassId]  = useState("");
  const [bankTermId,   setBankTermId]   = useState("");

  const { data: allClasses = [] } = useQuery<any[]>({ queryKey: ["/api/classes"] });

  const { data: bankDialogSubjects = [] } = useQuery<any[]>({
    queryKey:  ["/api/classes", bankClassId, "available-subjects"],
    queryFn:   () => apiRequest("GET", `/api/classes/${bankClassId}/available-subjects`).then(r => r.json()),
    enabled:   !!bankClassId,
    staleTime: 60_000,
  });

  // Auto-select current term
  useEffect(() => {
    if (currentTerm && !bankTermId) {
      setBankTermId(String(currentTerm.id));
    }
  }, [currentTerm]);

  const reset = () => {
    setBankName(""); setBankDesc(""); setBankSubjectId(""); setBankClassId(""); setBankTermId("");
  };

  const createBankMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/question-banks`, data);
      if (!res.ok) {
        let msg = "Failed to create bank";
        try { const b = await res.json(); msg = b.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onMutate: async () => {
      // Cancel any in-flight bank queries so they don't overwrite the upcoming write.
      await qc.cancelQueries({ queryKey: ["/api/question-banks"] });
      const snapshot = qc.getQueriesData({ queryKey: ["/api/question-banks"] });
      return { snapshot };
    },
    onSuccess: (savedBank: any) => {
      // The server returns the created bank. Insert it directly into the cache
      // entry that the dropdown (ContextFilterBar) is watching — keyed by the
      // bank's own classId / subjectId / termId.
      // Do NOT invalidateQueries here: a background GET races the DB write and
      // would return the old list (without the new bank), so the dropdown would
      // appear empty or miss the new entry.
      const cid = savedBank.classId;
      const sid = savedBank.subjectId;
      const tid = savedBank.termId ?? null;
      qc.setQueryData(
        ["/api/question-banks", "filtered", cid, sid, tid],
        (old: any) => (Array.isArray(old) ? [...old, savedBank] : [savedBank])
      );

      // Stats counter changed — safe to sync independently.
      qc.invalidateQueries({ queryKey: ["/api/question-bank/stats"] });

      toast({ title: "Success", description: "Question bank created." });
      onOpenChange(false);
      reset();
    },
    onError: (e: any, _vars, ctx: any) => {
      // Restore the bank list cache, then hard-refetch to get server truth.
      if (ctx?.snapshot) ctx.snapshot.forEach(([k, d]: [any, any]) => qc.setQueryData(k, d));
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createBankMutation.mutate({
      name:        bankName.trim(),
      subjectId:   Number(bankSubjectId),
      classId:     Number(bankClassId),
      termId:      Number(bankTermId),
      description: bankDesc || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
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
              A bank is scoped to a specific <strong>class</strong>, <strong>subject</strong> and <strong>term</strong>. All three are required.
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
              Term <span className="text-destructive">*</span>
            </Label>
            <Select value={bankTermId} onValueChange={setBankTermId} disabled={!bankClassId || !bankSubjectId}>
              <SelectTrigger data-testid="select-bank-term" className="h-9">
                <SelectValue placeholder={!bankClassId || !bankSubjectId ? "Select class & subject first" : "Select term…"} />
              </SelectTrigger>
              <SelectContent>
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
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. JSS 1 Mathematics — First Term 2025"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              data-testid="input-bank-desc"
              value={bankDesc}
              onChange={(e) => setBankDesc(e.target.value)}
              placeholder="Describe what this bank covers…"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!bankName.trim() || !bankSubjectId || !bankClassId || !bankTermId || createBankMutation.isPending}
            onClick={handleCreate}
            data-testid="btn-confirm-create-bank"
          >
            {createBankMutation.isPending ? "Creating…" : "Create Bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
