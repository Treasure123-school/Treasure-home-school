import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted" | "purple" | "orange";

interface AppBadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  primary:  "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70",
  success:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  muted:    "bg-muted text-muted-foreground",
  purple:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export function AppBadge({ variant = "default", children, className }: AppBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
