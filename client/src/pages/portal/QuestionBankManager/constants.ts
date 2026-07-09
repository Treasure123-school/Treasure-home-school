// ─── Constants ────────────────────────────────────────────────

export const PAGE_SIZE = 20;

export const DIFFICULTY_OPTS = ["easy", "medium", "hard"] as const;

export const TYPE_OPTS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay",           label: "Essay" },
] as const;

export const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60" },
  approved:  { label: "Approved",  color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  active:    { label: "Active",    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  published: { label: "Published", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

export const DIFFICULTY_STYLE: Record<string, string> = {
  easy:   "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  medium: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  hard:   "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
};

export const DIFFICULTY_LEFT: Record<string, string> = {
  easy:   "border-l-emerald-400",
  medium: "border-l-amber-400",
  hard:   "border-l-red-400",
};

export const ACTION_STATUS: Record<string, string> = {
  submit:    "submitted",
  withdraw:  "draft",
  approve:   "approved",
  reject:    "rejected",
  publish:   "published",
  unpublish: "active",
};

export const ACTION_LABEL: Record<string, string> = {
  submit:    "Submitted for review",
  withdraw:  "Withdrawn to draft",
  approve:   "Question approved",
  reject:    "Question rejected",
  publish:   "Question published",
  unpublish: "Question unpublished",
};
