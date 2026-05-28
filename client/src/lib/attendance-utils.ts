import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { ElementType } from 'react';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];

export interface AttendanceStatusMeta {
  label: string;
  color: string;
  bgColor: string;
  badgeClass: string;
  borderClass: string;
  dotColor: string;
  barColor: string;
  icon: ElementType;
}

export const STATUS_CONFIG: Record<AttendanceStatus, AttendanceStatusMeta> = {
  Present: {
    label: 'Present',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    barColor: '#10b981',
    icon: CheckCircle,
  },
  Absent: {
    label: 'Absent',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    borderClass: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    barColor: '#ef4444',
    icon: XCircle,
  },
  Late: {
    label: 'Late',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    barColor: '#f59e0b',
    icon: Clock,
  },
  Excused: {
    label: 'Excused',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-400',
    barColor: '#60a5fa',
    icon: AlertCircle,
  },
};

export function pctColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function pctBarColor(pct: number): string {
  if (pct >= 90) return '#10b981';
  if (pct >= 75) return '#f59e0b';
  return '#ef4444';
}

export function pctRatingLabel(pct: number): { label: string; className: string } {
  if (pct >= 90) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' };
  if (pct >= 75) return { label: 'Good', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' };
  if (pct >= 60) return { label: 'Needs Improvement', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
  return { label: 'Critical', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function calcAttendanceRate(present: number, late: number, total: number): number {
  return total > 0 ? Math.round(((present + late) / total) * 100) : 0;
}

export function deduplicateByStudentDate<T extends { studentId: string; date: string; id: number }>(records: T[]): T[] {
  const latest = new Map<string, T>();
  for (const r of records) {
    const key = `${r.studentId}::${String(r.date).slice(0, 10)}`;
    const existing = latest.get(key);
    if (!existing || r.id > existing.id) latest.set(key, r);
  }
  return Array.from(latest.values());
}
