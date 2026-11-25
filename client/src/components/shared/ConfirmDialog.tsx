import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "destructive" | "default";
  loading?: boolean;
  confirmClassName?: string;
  confirmTestId?: string;
  cancelTestId?: string;
  contentTestId?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "destructive",
  loading = false,
  confirmClassName,
  confirmTestId,
  cancelTestId,
  contentTestId,
}: ConfirmDialogProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (open) firedRef.current = false;
  }, [open]);

  const handleConfirm = () => {
    if (firedRef.current || loading) return;
    firedRef.current = true;
    onConfirm();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !loading) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent data-testid={contentTestId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              confirmClassName
            )}
            data-testid={confirmTestId}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
