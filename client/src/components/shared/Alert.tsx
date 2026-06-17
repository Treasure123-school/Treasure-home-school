import type { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { icon: typeof Info; styles: string }
> = {
  info: {
    icon: Info,
    styles:
      "bg-primary/10 text-primary border-primary/20 dark:bg-primary/5 dark:text-primary/80",
  },
  success: {
    icon: CheckCircle,
    styles:
      "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  },
  warning: {
    icon: AlertTriangle,
    styles:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  },
  error: {
    icon: AlertCircle,
    styles:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  onDismiss,
  className,
}: AlertProps) {
  const { icon: Icon, styles } = VARIANT_CONFIG[variant];

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-sm",
        styles,
        className
      )}
      role="alert"
    >
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
