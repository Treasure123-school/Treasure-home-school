import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteBankDialogProps {
  target:    any | null;
  isPending: boolean;
  onClose:   () => void;
  onConfirm: (id: number) => void;
}

export function DeleteBankDialog({ target, isPending, onClose, onConfirm }: DeleteBankDialogProps) {
  return (
    <AlertDialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> Delete Question Bank
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to delete <strong>"{target?.name}"</strong>?
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
            onClick={() => target && onConfirm(target.id)}
            data-testid="btn-confirm-delete-bank"
          >
            {isPending ? "Deleting…" : "Delete Bank"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
