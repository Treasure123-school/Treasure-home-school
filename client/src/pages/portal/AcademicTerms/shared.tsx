import { AlertTriangle } from 'lucide-react';

// ─── Status Config ────────────────────────────────────────────────────────────

export type StatusKey = 'active' | 'upcoming' | 'completed' | 'archived' | 'inactive';

export const STATUS_CFG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  active:    { label: 'Active',    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',  dotClass: 'bg-emerald-500 animate-pulse' },
  upcoming:  { label: 'Upcoming',  badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700',           dotClass: 'bg-amber-400' },
  completed: { label: 'Completed', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',             dotClass: 'bg-slate-400' },
  archived:  { label: 'Archived',  badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700',    dotClass: 'bg-orange-400' },
  inactive:  { label: 'Inactive',  badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700',               dotClass: 'bg-gray-400' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

// ─── Error Box ────────────────────────────────────────────────────────────────

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{msg}</span>
    </div>
  );
}

// ─── Date Helpers ──────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}

export function fmtShort(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }); }
  catch { return d; }
}

export function termProgress(start: string, end: string) {
  const t = new Date(), s = new Date(start), e = new Date(end);
  if (t < s) return 0; if (t > e) return 100;
  return Math.round(((t.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100);
}

export function daysLeft(end: string) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((e.getTime() - t.getTime()) / 86400000));
}

export function daysElapsed(start: string) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((t.getTime() - s.getTime()) / 86400000));
}

export function totalDays(start: string, end: string) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

export function today() { return new Date().toISOString().split('T')[0]; }

export function isCurrentlyActive(start: string, end: string) {
  const now = today(); return start <= now && end >= now;
}

export function validateYear(y: string): string | null {
  if (!/^\d{4}\/\d{4}$/.test(y)) return 'Format must be YYYY/YYYY (e.g. 2024/2025)';
  const [a, b] = y.split('/').map(Number);
  if (b !== a + 1) return 'Years must be consecutive (e.g. 2024/2025)';
  return null;
}

export function jsonError(r: Response, fallback = 'Request failed') {
  return r.json().catch(() => ({ message: fallback }));
}
