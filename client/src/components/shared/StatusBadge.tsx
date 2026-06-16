import { cn } from "@/lib/utils";

type StatusVariant =
  | "active"
  | "pending"
  | "suspended"
  | "disabled"
  | "inactive"
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "published"
  | "draft"
  | "open"
  | "closed"
  | "approved"
  | "rejected"
  | "verified"
  | string;

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  approved:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  present:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  verified:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  open:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",

  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  late:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  draft:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",

  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  absent:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rejected:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  closed:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",

  disabled: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",

  excused: "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70",
};

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? "";
  const style = STATUS_STYLES[key] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400";
  const displayLabel = label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : "—");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        style,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
