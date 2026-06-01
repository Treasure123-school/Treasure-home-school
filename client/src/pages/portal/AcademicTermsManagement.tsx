import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import type { CalendarSession, CalendarTerm, TermStatus } from '@/hooks/useAcademicCalendar';
import {
  Plus, Calendar, Edit, Trash2, CheckCircle, Lock, Unlock,
  GraduationCap, Clock, Archive, Play, CalendarDays,
  AlertTriangle, Bot, ChevronRight, MoreVertical, Layers,
  RefreshCw, Info, TrendingUp, Target, Zap
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

type SessionStatus = 'active' | 'upcoming' | 'completed' | 'archived';

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; className: string; dotClass: string; icon: any }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    icon: Play,
  },
  upcoming: {
    label: 'Upcoming',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dotClass: 'bg-slate-400',
    icon: CheckCircle,
  },
  archived: {
    label: 'Archived',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
    dotClass: 'bg-orange-400',
    icon: Archive,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

// ─── Date Helpers ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function formatDateShort(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function getTermProgress(startDate: string, endDate: string): number {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (today < start) return 0;
  if (today > end) return 100;
  const total = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  return Math.round((elapsed / total) * 100);
}

function getDaysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

function getDaysElapsed(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function getTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function validateYearFormat(year: string): string | null {
  if (!/^\d{4}\/\d{4}$/.test(year)) return 'Format must be YYYY/YYYY (e.g., 2024/2025)';
  const [a, b] = year.split('/').map(Number);
  if (b !== a + 1) return 'Years must be consecutive (e.g., 2024/2025)';
  return null;
}

// ─── Term Progress Bar ────────────────────────────────────────────────────────

function TermProgressBar({ term, compact = false }: { term: CalendarTerm; compact?: boolean }) {
  const today = new Date().toISOString().split('T')[0];
  const isActive = term.startDate <= today && term.endDate >= today;
  if (!isActive) return null;
  const progress = getTermProgress(term.startDate, term.endDate);
  const daysLeft = getDaysRemaining(term.endDate);
  const elapsed = getDaysElapsed(term.startDate);
  const total = getTotalDays(term.startDate, term.endDate);

  if (compact) {
    return (
      <div className="mt-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{progress}% complete</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{daysLeft}d left</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Day {elapsed} of {total}</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{daysLeft} days remaining</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground">{progress}% through this term</p>
    </div>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner({ session, term, isLoading }: {
  session: CalendarSession | null;
  term: CalendarTerm | null;
  isLoading: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isTermActive = term ? (term.startDate <= today && term.endDate >= today) : false;
  const progress = term && isTermActive ? getTermProgress(term.startDate, term.endDate) : 0;
  const daysLeft = term ? getDaysRemaining(term.endDate) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-5 sm:p-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Left: Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Academic Calendar</span>
              {!isLoading && session && <StatusBadge status="active" />}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-48 mb-2" />
            ) : (
              <h2 className="text-xl sm:text-2xl font-bold" data-testid="hero-session-name">
                {session?.name ?? 'No Active Session'}
              </h2>
            )}
            {!isLoading && session && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(session.startDate)} → {formatDate(session.endDate)}
              </p>
            )}
          </div>

          {/* Right: Term info */}
          <div className="shrink-0 sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Current Term</p>
            {isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : term ? (
              <>
                <p className="text-lg font-bold text-primary" data-testid="hero-term-name">{term.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(term.startDate)} – {formatDate(term.endDate)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No active term</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {!isLoading && term && isTermActive && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Term Progress</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  Day {getDaysElapsed(term.startDate)} of {getTotalDays(term.startDate, term.endDate)}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </span>
              </div>
            </div>
            <Progress value={progress} className="h-3 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1.5">{progress}% of this term has elapsed</p>
          </div>
        )}

        {!isLoading && !term && (
          <div className="mt-4 pt-4 border-t border-dashed border-muted-foreground/20 flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>No term is currently active. Configure term dates or manually set an active term below.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Session Dialog ─────────────────────────────────────────────────────────

interface SessionDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarSession | null;
  onSaved: () => void;
}

function SessionDialog({ open, onClose, editing, onSaved }: SessionDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', year: '', startDate: '', endDate: '', description: '' });
  const [yearError, setYearError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ name: editing.name, year: editing.year, startDate: editing.startDate, endDate: editing.endDate, description: editing.description ?? '' });
    } else {
      setForm({ name: '', year: '', startDate: '', endDate: '', description: '' });
    }
    setYearError(null); setApiError(null);
  }, [open, editing?.id]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editing ? `/api/sessions/${editing.id}` : '/api/sessions';
      const res = await apiRequest(editing ? 'PUT' : 'POST', url, data);
      if (!res.ok) { const err = await res.json().catch(() => ({ message: 'Request failed' })); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: editing ? 'Session updated.' : 'Session created.' }); onSaved(); onClose(); },
    onError: (err: any) => setApiError(err.message || 'An error occurred.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yErr = validateYearFormat(form.year);
    if (yErr) { setYearError(yErr); return; }
    setYearError(null); setApiError(null);
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-session">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {editing ? 'Edit Session' : 'New Academic Session'}
          </DialogTitle>
          <DialogDescription>{editing ? 'Update this academic session.' : 'Add a new school year session.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Session Name</Label>
            <Input id="s-name" data-testid="input-session-name" placeholder="e.g., 2024/2025 Academic Session"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-year">Academic Year</Label>
            <Input id="s-year" data-testid="input-session-year" placeholder="e.g., 2024/2025"
              value={form.year} onChange={e => { setForm({ ...form, year: e.target.value }); setYearError(null); }}
              className={yearError ? 'border-destructive' : ''} required />
            {yearError && <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-session-year-error"><AlertTriangle className="h-3 w-3" />{yearError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-start">Start Date</Label>
              <Input id="s-start" data-testid="input-session-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-end">End Date</Label>
              <Input id="s-end" data-testid="input-session-end" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc">Description (optional)</Label>
            <Input id="s-desc" placeholder="e.g., Main academic year" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-session-api-error">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{apiError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-session-cancel">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-session-submit">
              {mutation.isPending ? (editing ? 'Saving...' : 'Creating...') : (editing ? 'Save Changes' : 'Create Session')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Term Dialog ─────────────────────────────────────────────────────────────

interface TermDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarTerm | null;
  sessions: CalendarSession[];
  onSaved: () => void;
}

function TermDialog({ open, onClose, editing, sessions, onSaved }: TermDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', sessionId: '', year: '', startDate: '', endDate: '' });
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ name: editing.name, sessionId: editing.sessionId ? String(editing.sessionId) : '', year: editing.year, startDate: editing.startDate, endDate: editing.endDate });
    } else {
      setForm({ name: '', sessionId: '', year: '', startDate: '', endDate: '' });
    }
    setApiError(null);
  }, [open, editing?.id]);

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = { name: data.name, year: data.year, startDate: data.startDate, endDate: data.endDate, sessionId: data.sessionId && data.sessionId !== 'none' ? parseInt(data.sessionId) : null };
      const url = editing ? `/api/terms/${editing.id}` : '/api/terms';
      const res = await apiRequest(editing ? 'PUT' : 'POST', url, payload);
      if (!res.ok) { const err = await res.json().catch(() => ({ message: 'Request failed' })); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: editing ? 'Term updated.' : 'Term created.' }); onSaved(); onClose(); },
    onError: (err: any) => setApiError(err.message || 'An error occurred.'),
  });

  const selectedSession = sessions.find(s => String(s.id) === form.sessionId);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-term">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {editing ? 'Edit Term' : 'New Academic Term'}
          </DialogTitle>
          <DialogDescription>{editing ? 'Update this academic term.' : 'Add a new term to a session.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); setApiError(null); mutation.mutate(form); }} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Term Name</Label>
            <Select value={form.name} onValueChange={v => setForm({ ...form, name: v })}>
              <SelectTrigger data-testid="select-term-name"><SelectValue placeholder="Select term" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="First Term">First Term</SelectItem>
                <SelectItem value="Second Term">Second Term</SelectItem>
                <SelectItem value="Third Term">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select value={form.sessionId} onValueChange={v => { const s = sessions.find(s => String(s.id) === v); setForm({ ...form, sessionId: v, year: s?.year ?? form.year }); }}>
              <SelectTrigger data-testid="select-term-session"><SelectValue placeholder="Select session (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No session</SelectItem>
                {sessions.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-year">Academic Year</Label>
            <Input id="t-year" data-testid="input-term-year" placeholder="e.g., 2024/2025"
              value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
              readOnly={!!selectedSession} className={selectedSession ? 'bg-muted cursor-not-allowed' : ''} required />
            {selectedSession && <p className="text-xs text-muted-foreground">Auto-filled from selected session</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-start">Start Date</Label>
              <Input id="t-start" data-testid="input-term-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-end">End Date</Label>
              <Input id="t-end" data-testid="input-term-end" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-term-api-error">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{apiError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-term-cancel">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-term-submit">
              {mutation.isPending ? (editing ? 'Saving...' : 'Creating...') : (editing ? 'Save Changes' : 'Create Term')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Terms Table Sub-component ────────────────────────────────────────────────

interface TermsTableProps {
  terms: CalendarTerm[];
  isAdmin: boolean;
  onEdit: (t: CalendarTerm) => void;
  onSetActive: (id: number) => void;
  onToggleLock: (id: number) => void;
  onDelete: (id: number) => void;
  getStatus: (t: CalendarTerm) => TermStatus;
}

function TermsTable({ terms, isAdmin, onEdit, onSetActive, onToggleLock, onDelete, getStatus }: TermsTableProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left py-2.5 pr-4 font-semibold">Term</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Start Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">End Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Status</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Progress</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Locked</th>
              {isAdmin && <th className="text-right py-2.5 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {terms.map(term => {
              const status = getStatus(term);
              const isActive = status === 'active';
              const progress = isActive ? getTermProgress(term.startDate, term.endDate) : 0;
              const daysLeft = isActive ? getDaysRemaining(term.endDate) : 0;
              return (
                <tr key={term.id} data-testid={`term-row-${term.id}`}
                  className={`hover:bg-muted/40 transition-colors ${term.isCurrent ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{term.name}</span>
                      {term.isCurrent && (
                        <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500 py-0 px-1.5">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{term.year}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(term.startDate)}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(term.endDate)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                  <td className="py-3 pr-4 min-w-[120px]">
                    {isActive ? (
                      <div className="space-y-1">
                        <Progress value={progress} className="h-1.5 w-24" />
                        <p className="text-xs text-muted-foreground">{progress}% · {daysLeft}d left</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {term.isLocked
                      ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><Lock className="h-3 w-3" /> Locked</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-term-menu-${term.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!term.isCurrent && (
                            <DropdownMenuItem onClick={() => onSetActive(term.id)} data-testid={`button-term-set-active-${term.id}`}>
                              <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onToggleLock(term.id)} data-testid={`button-term-lock-${term.id}`}>
                            {term.isLocked ? <><Unlock className="h-4 w-4 mr-2" /> Unlock</> : <><Lock className="h-4 w-4 mr-2" /> Lock</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(term)} disabled={term.isLocked} data-testid={`button-term-edit-${term.id}`}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={e => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                                disabled={term.isLocked || term.isCurrent}
                                data-testid={`button-term-delete-${term.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {term.isCurrent ? 'Cannot delete current' : term.isLocked ? 'Unlock to delete' : 'Delete'}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                                <AlertDialogDescription>Delete "{term.name} ({term.year})"? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(term.id)} data-testid={`button-confirm-term-delete-${term.id}`}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {terms.map(term => {
          const status = getStatus(term);
          return (
            <div key={term.id} data-testid={`term-card-${term.id}`}
              className={`p-3.5 rounded-xl border space-y-3 ${term.isCurrent ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-card'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{term.name}</span>
                    {term.isCurrent && <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500 py-0">Current</Badge>}
                    {term.isLocked && <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium"><Lock className="h-3 w-3" /> Locked</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{term.year}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold mb-0.5">Start</p>
                  <p className="font-medium">{formatDate(term.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold mb-0.5">End</p>
                  <p className="font-medium">{formatDate(term.endDate)}</p>
                </div>
              </div>
              <TermProgressBar term={term} compact />
              {isAdmin && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                  {!term.isCurrent && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSetActive(term.id)}
                      data-testid={`button-term-activate-mobile-${term.id}`}>
                      Set Current
                    </Button>
                  )}
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onToggleLock(term.id)}
                    data-testid={`button-term-lock-mobile-${term.id}`}>
                    {term.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={term.isLocked} onClick={() => onEdit(term)}
                    data-testid={`button-term-edit-mobile-${term.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-7 w-7" disabled={term.isLocked || term.isCurrent}
                        data-testid={`button-term-delete-mobile-${term.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                        <AlertDialogDescription>Delete "{term.name} ({term.year})"? This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(term.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Session Timeline ─────────────────────────────────────────────────────────

function SessionTimeline({ session, terms, getTermStatus }: {
  session: CalendarSession;
  terms: CalendarTerm[];
  getTermStatus: (t: CalendarTerm) => TermStatus;
}) {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Terms Timeline</p>
      <div className="flex items-center gap-1 flex-wrap">
        {sorted.map((term, idx) => {
          const status = getTermStatus(term);
          const isActive = status === 'active';
          const progress = isActive ? getTermProgress(term.startDate, term.endDate) : 0;
          return (
            <div key={term.id} className="flex items-center gap-1">
              {idx > 0 && <div className="w-3 h-px bg-border shrink-0" />}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`relative px-2.5 py-1.5 rounded-md text-xs font-medium cursor-default border transition-all ${
                      isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                        : status === 'completed'
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                    }`}>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 rounded-b-md bg-emerald-400/30 dark:bg-emerald-500/20 transition-all" 
                          style={{ height: '3px', width: `${progress}%` }} />
                      )}
                      {term.name.replace(' Term', '')}
                      {isActive && <span className="ml-1 text-[10px] opacity-70">{progress}%</span>}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{term.name}</p>
                    <p className="text-xs">{formatDate(term.startDate)} – {formatDate(term.endDate)}</p>
                    {isActive && <p className="text-xs text-emerald-400">{getDaysRemaining(term.endDate)} days remaining</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AcademicTermsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const calendar = useAcademicCalendar();

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; editing: CalendarSession | null }>({ open: false, editing: null });
  const [termDialog, setTermDialog] = useState<{ open: boolean; editing: CalendarTerm | null }>({ open: false, editing: null });

  // Auto-detect setting
  const { data: autoDetectSetting } = useQuery<any>({
    queryKey: ['/api/academic-calendar/settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/academic-calendar/settings');
      if (!res.ok) return { academicAutoDetect: true };
      const json = await res.json().catch(() => null);
      return json?.data ?? json ?? { academicAutoDetect: true };
    },
    enabled: isAdmin,
  });
  const autoDetectEnabled = autoDetectSetting?.academicAutoDetect !== false;

  const autoDetectMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest('PUT', '/api/academic-calendar/settings', { academicAutoDetect: enabled });
      if (!res.ok) throw new Error('Failed to update setting');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/academic-calendar/settings'] }),
    onError: () => toast({ title: 'Error', description: 'Failed to update auto-detect setting.', variant: 'destructive' }),
  });

  // Run Transitions
  const runTransitionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/academic-calendar/run-transitions');
      if (!res.ok) throw new Error('Failed to run transitions');
      return res.json();
    },
    onSuccess: (data: any) => {
      const { activated = [], completed = [] } = data?.data ?? data ?? {};
      const msg = activated.length > 0 || completed.length > 0
        ? `${activated.length} term(s) activated, ${completed.length} term(s) completed.`
        : 'All term statuses are already up to date.';
      toast({ title: 'Transitions Complete', description: msg });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Session mutations
  const setActiveSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/sessions/${id}/mark-current`);
      if (!res.ok) throw new Error('Failed to set active session');
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Session set as current.' }); calendar.invalidate(); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/sessions/${id}`);
      if (!res.ok) { const err = await res.json().catch(() => ({ message: 'Failed to delete' })); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Session deleted.' }); calendar.invalidate(); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Term mutations
  const setActiveTermMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/terms/${id}/mark-current`);
      if (!res.ok) throw new Error('Failed to set active term');
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Term set as current.' }); calendar.invalidate(); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/terms/${id}/toggle-lock`);
      if (!res.ok) throw new Error('Failed to toggle lock');
      return res.json();
    },
    onSuccess: (data: any) => { toast({ title: 'Success', description: data.isLocked ? 'Term locked.' : 'Term unlocked.' }); calendar.invalidate(); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/terms/${id}`);
      if (!res.ok) { const err = await res.json().catch(() => ({ message: 'Failed to delete' })); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: 'Term deleted.' }); calendar.invalidate(); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  if (!user) return <div className="flex items-center justify-center h-screen">Please log in</div>;

  const { currentSession, currentTerm, upcomingTerm, allSessions, allTerms, isLoading } = calendar;
  const daysToNextTerm = upcomingTerm ? calendar.daysUntil(upcomingTerm.startDate) : null;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5" data-testid="page-title">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            Academic Calendar
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage sessions, terms, and automatic calendar transitions</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => runTransitionsMutation.mutate()}
                    disabled={runTransitionsMutation.isPending} data-testid="button-run-transitions">
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${runTransitionsMutation.isPending ? 'animate-spin' : ''}`} />
                    {runTransitionsMutation.isPending ? 'Running...' : 'Run Transitions'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manually trigger automatic term/session transitions based on today's date</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="button-new-term">
              <Plus className="h-4 w-4 mr-1" /> New Term
            </Button>
            <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="button-new-session">
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          </div>
        )}
      </div>

      {/* ── Hero Banner ── */}
      <HeroBanner session={currentSession} term={currentTerm} isLoading={isLoading} />

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active Term */}
        <Card className={`col-span-1 ${currentTerm ? 'border-emerald-200 dark:border-emerald-800' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active Term</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-bold truncate mt-0.5" data-testid="stat-active-term">{currentTerm?.name ?? '—'}</p>
                )}
                {!isLoading && currentTerm && <StatusBadge status="active" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Session */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Session</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-bold truncate mt-0.5" data-testid="stat-current-session">{currentSession?.year ?? '—'}</p>
                )}
                {!isLoading && currentSession && <StatusBadge status={calendar.getSessionStatus(currentSession)} />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Term */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Next Term</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <>
                    <p className="text-sm font-bold truncate mt-0.5" data-testid="stat-next-term">{upcomingTerm?.name ?? '—'}</p>
                    {daysToNextTerm !== null && daysToNextTerm >= 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">in {daysToNextTerm}d</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Start */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Session Start</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-bold mt-0.5" data-testid="stat-session-start">{currentSession ? formatDateShort(currentSession.startDate) : '—'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session End */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Session End</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-bold mt-0.5" data-testid="stat-session-end">{currentSession ? formatDateShort(currentSession.endDate) : '—'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Counts */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 shrink-0">
                <Zap className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Records</p>
                {isLoading ? <Skeleton className="h-5 w-16 mt-1" /> : (
                  <p className="text-sm font-bold mt-0.5" data-testid="stat-records">
                    {allSessions.length}s · {allTerms.length}t
                  </p>
                )}
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">{allSessions.length} sessions · {allTerms.length} terms</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Auto-Detect Banner ── */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 ${
        autoDetectEnabled
          ? 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
          : 'bg-muted/30 border-dashed border-muted-foreground/20'
      }`} data-testid="banner-auto-detect">
        <div className={`p-2 rounded-lg shrink-0 ${autoDetectEnabled ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
          <Bot className={`h-5 w-5 ${autoDetectEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${autoDetectEnabled ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
            Auto-detect is {autoDetectEnabled ? 'ON' : 'OFF'}
          </p>
          <p className={`text-xs mt-0.5 ${autoDetectEnabled ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {autoDetectEnabled
              ? 'Terms activate and deactivate automatically based on their configured start/end dates (runs daily at midnight). You can still manually override.'
              : 'Terms must be activated manually. The system will not auto-transition based on dates.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">Auto-detect</span>
            <Switch data-testid="switch-auto-detect" checked={autoDetectEnabled}
              onCheckedChange={v => autoDetectMutation.mutate(v)} disabled={autoDetectMutation.isPending} />
          </div>
        )}
      </div>

      {/* ── Sessions Section ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Layers className="h-4 w-4 text-primary" /> Academic Sessions
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">School years that group your terms together</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="button-add-session">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Session
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : allSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-sessions">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Layers className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium mb-1">No sessions yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create an academic session to get started</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="button-create-first-session">
                  <Plus className="h-4 w-4 mr-1" /> Create First Session
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2.5 pr-4 font-semibold">Session Name</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Year</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Start Date</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">End Date</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Status</th>
                      <th className="text-left py-2.5 pr-4 font-semibold">Terms</th>
                      {isAdmin && <th className="text-right py-2.5 font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {allSessions.map(session => {
                      const status = calendar.getSessionStatus(session);
                      const termCount = (calendar.termsBySession[session.id] ?? []).length;
                      return (
                        <tr key={session.id} data-testid={`session-row-${session.id}`}
                          className={`hover:bg-muted/40 transition-colors ${session.isCurrent ? 'bg-primary/5' : ''}`}>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{session.name}</span>
                              {session.isCurrent && <Badge className="text-xs bg-primary hover:bg-primary py-0 px-1.5">Current</Badge>}
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 text-muted-foreground font-medium">{session.year}</td>
                          <td className="py-3.5 pr-4 text-muted-foreground text-xs">{formatDate(session.startDate)}</td>
                          <td className="py-3.5 pr-4 text-muted-foreground text-xs">{formatDate(session.endDate)}</td>
                          <td className="py-3.5 pr-4"><StatusBadge status={status} /></td>
                          <td className="py-3.5 pr-4">
                            <Badge variant="secondary" className="text-xs font-medium">{termCount} term{termCount !== 1 ? 's' : ''}</Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-session-menu-${session.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!session.isCurrent && (
                                    <DropdownMenuItem onClick={() => setActiveSessionMutation.mutate(session.id)} data-testid={`button-session-set-active-${session.id}`}>
                                      <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setSessionDialog({ open: true, editing: session })} data-testid={`button-session-edit-${session.id}`}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={e => e.preventDefault()}
                                        className="text-destructive focus:text-destructive"
                                        data-testid={`button-session-delete-${session.id}`}
                                        disabled={session.isCurrent}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {session.isCurrent ? 'Cannot delete active' : 'Delete'}
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                        <AlertDialogDescription>Delete "{session.name}"? Sessions with linked terms cannot be deleted.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => deleteSessionMutation.mutate(session.id)} data-testid={`button-confirm-session-delete-${session.id}`}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile session cards */}
              <div className="md:hidden space-y-3">
                {allSessions.map(session => {
                  const status = calendar.getSessionStatus(session);
                  const sessionTerms = (calendar.termsBySession[session.id] ?? []).sort((a, b) => a.startDate.localeCompare(b.startDate));
                  return (
                    <div key={session.id} data-testid={`session-card-${session.id}`}
                      className={`p-4 rounded-xl border-2 space-y-2 ${session.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{session.name}</span>
                            {session.isCurrent && <Badge className="text-xs bg-primary hover:bg-primary py-0">Current</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{session.year}</p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold mb-0.5">Start</p>
                          <p className="font-medium">{formatDate(session.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-semibold mb-0.5">End</p>
                          <p className="font-medium">{formatDate(session.endDate)}</p>
                        </div>
                      </div>
                      <SessionTimeline session={session} terms={sessionTerms} getTermStatus={calendar.getTermStatus} />
                      <div className="flex items-center justify-between pt-1">
                        <Badge variant="secondary" className="text-xs">{sessionTerms.length} term{sessionTerms.length !== 1 ? 's' : ''}</Badge>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            {!session.isCurrent && (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => setActiveSessionMutation.mutate(session.id)} data-testid={`button-session-activate-mobile-${session.id}`}>
                                Set Current
                              </Button>
                            )}
                            <Button variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setSessionDialog({ open: true, editing: session })} data-testid={`button-session-edit-mobile-${session.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-7 w-7"
                                  disabled={session.isCurrent} data-testid={`button-session-delete-mobile-${session.id}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                  <AlertDialogDescription>Delete "{session.name}"? Sessions with linked terms cannot be deleted.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteSessionMutation.mutate(session.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Terms Section ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-primary" /> Academic Terms
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Terms grouped by session — showing start date, end date, status, and progress</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="button-add-term">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Term
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : allTerms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-terms">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-7 w-7 opacity-40" />
              </div>
              <p className="text-sm font-medium mb-1">No terms yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create a session first, then add terms to it</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="button-create-first-term">
                  <Plus className="h-4 w-4 mr-1" /> Create First Term
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Terms grouped by session */}
              {allSessions.map(session => {
                const sessionTerms = (calendar.termsBySession[session.id] ?? [])
                  .slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
                if (sessionTerms.length === 0) return null;
                return (
                  <div key={session.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${session.isCurrent ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      <h4 className="text-sm font-semibold">{session.name}</h4>
                      <span className="text-xs text-muted-foreground">({session.year})</span>
                      <div className="flex-1 h-px bg-border" />
                      <Badge variant="secondary" className="text-xs font-medium">{sessionTerms.length} term{sessionTerms.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <TermsTable
                      terms={sessionTerms}
                      isAdmin={isAdmin}
                      onEdit={t => setTermDialog({ open: true, editing: t })}
                      onSetActive={id => setActiveTermMutation.mutate(id)}
                      onToggleLock={id => toggleLockMutation.mutate(id)}
                      onDelete={id => deleteTermMutation.mutate(id)}
                      getStatus={calendar.getTermStatus}
                    />
                  </div>
                );
              })}

              {/* Unassigned terms */}
              {(calendar.termsBySession['unassigned'] ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <h4 className="text-sm font-semibold text-muted-foreground">Unassigned Terms</h4>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <TermsTable
                    terms={calendar.termsBySession['unassigned']}
                    isAdmin={isAdmin}
                    onEdit={t => setTermDialog({ open: true, editing: t })}
                    onSetActive={id => setActiveTermMutation.mutate(id)}
                    onToggleLock={id => toggleLockMutation.mutate(id)}
                    onDelete={id => deleteTermMutation.mutate(id)}
                    getStatus={calendar.getTermStatus}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}
      <SessionDialog
        open={sessionDialog.open}
        onClose={() => setSessionDialog({ open: false, editing: null })}
        editing={sessionDialog.editing}
        onSaved={() => calendar.invalidate()}
      />
      <TermDialog
        open={termDialog.open}
        onClose={() => setTermDialog({ open: false, editing: null })}
        editing={termDialog.editing}
        sessions={allSessions}
        onSaved={() => calendar.invalidate()}
      />
    </div>
  );
}
