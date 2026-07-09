import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { XCircle } from "lucide-react";

interface RejectDialogProps {
  target:    any | null;
  isPending: boolean;
  onClose:   () => void;
  onConfirm: (reason: string) => void;
}

export function RejectDialog({ target, isPending, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");

  const handleClose = () => {
    setReason("");
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && handleClose()}>
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
          {target && (
            <div className="bg-muted/50 rounded-lg p-3 border-l-3 border-l-muted-foreground">
              <p className="text-sm text-muted-foreground line-clamp-3">{target.questionText}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Reason for rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              data-testid="input-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this question is being rejected so the teacher can improve it…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={handleConfirm}
            data-testid="btn-confirm-reject"
          >
            {isPending ? "Rejecting…" : "Reject Question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
