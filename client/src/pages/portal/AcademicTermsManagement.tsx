import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import type { CalendarSession, CalendarTerm, TermStatus } from '@/hooks/useAcademicCalendar';
import {
  Plus, Calendar, Edit, Trash2, CheckCircle, Lock, Unlock,
  GraduationCap, Clock, Archive, Play, CalendarDays,
  AlertTriangle, Bot, ChevronRight, MoreVertical, Layers,
  RefreshCw, Info, TrendingUp, Target, Zap, Power,
  PowerOff, Eye, X, Check
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusKey = 'active' | 'upcoming' | 'completed' | 'archived' | 'inactive';

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  active:    { label: 'Active',    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',  dotClass: 'bg-emerald-500 animate-pulse' },
  upcoming:  { label: 'Upcoming',  badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700',           dotClass: 'bg-amber-400' },
  completed: { label: 'Completed', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',             dotClass: 'bg-slate-400' },
  archived:  { label: 'Archived',  badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700',    dotClass: 'bg-orange-400' },
  inactive:  { label: 'Inactive',  badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700',               dotClass: 'bg-gray-400' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

// ─── Date Helpers ──────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function fmtShort(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function termProgress(start: string, end: string) {
  const t = new Date(), s = new Date(start), e = new Date(end);
  if (t < s) return 0; if (t > e) return 100;
  return Math.round(((t.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100);
}
function daysLeft(end: string) {
  const t = new Date(); t.setHours(0,0,0,0);
  const e = new Date(end); e.setHours(0,0,0,0);
  return Math.max(0, Math.ceil((e.getTime() - t.getTime()) / 86400000));
}
function daysElapsed(start: string) {
  const t = new Date(); t.setHours(0,0,0,0);
  const s = new Date(start); s.setHours(0,0,0,0);
  return Math.max(0, Math.ceil((t.getTime() - s.getTime()) / 86400000));
}
function totalDays(start: string, end: string) {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}
function today() { return new Date().toISOString().split('T')[0]; }
function isCurrentlyActive(start: string, end: string) {
  const now = today(); return start <= now && end >= now;
}
function validateYear(y: string): string | null {
  if (!/^\d{4}\/\d{4}$/.test(y)) return 'Format must be YYYY/YYYY (e.g. 2024/2025)';
  const [a, b] = y.split('/').map(Number);
  if (b !== a + 1) return 'Years must be consecutive (e.g. 2024/2025)';
  return null;
}

// ─── Error Box ────────────────────────────────────────────────────────────────

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{msg}</span>
    </div>
  );
}

// ─── Session Dialog ───────────────────────────────────────────────────────────

interface SessionDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarSession | null;
  onSaved: () => void;
}

function SessionDialog({ open, onClose, editing, onSaved }: SessionDialogProps) {
  const { toast } = useToast();
  const blank = { name: '', year: '', startDate: '', endDate: '', description: '' };
  const [form, setForm] = useState(blank);
  const [yearErr, setYearErr] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setYearErr(null); setApiErr(null);
    setForm(editing
      ? { name: editing.name, year: editing.year, startDate: editing.startDate, endDate: editing.endDate, description: editing.description ?? '' }
      : blank);
  }, [open, editing?.id]);

  const mut = useMutation({
    mutationFn: async (d: typeof form) => {
      const url = editing ? `/api/sessions/${editing.id}` : '/api/sessions';
      const r = await apiRequest(editing ? 'PUT' : 'POST', url, d);
      if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Request failed' })); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: editing ? 'Session updated.' : 'Session created.' }); onSaved(); onClose(); },
    onError: (e: any) => setApiErr(e.message || 'An error occurred.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ye = validateYear(form.year); if (ye) { setYearErr(ye); return; }
    if (form.startDate >= form.endDate) { setApiErr('Start date must be before end date.'); return; }
    setYearErr(null); setApiErr(null);
    mut.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />{editing ? 'Edit Session' : 'New Academic Session'}</DialogTitle>
          <DialogDescription>{editing ? 'Update session details.' : 'Create a new school year / academic session.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>Session Name <span className="text-destructive">*</span></Label>
            <Input data-testid="input-session-name" placeholder="e.g. 2024/2025 Academic Session"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Academic Year <span className="text-destructive">*</span></Label>
            <Input data-testid="input-session-year" placeholder="e.g. 2024/2025"
              value={form.year} onChange={e => { setForm({ ...form, year: e.target.value }); setYearErr(null); }}
              className={yearErr ? 'border-destructive' : ''} required />
            {yearErr && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{yearErr}</p>}
            <p className="text-xs text-muted-foreground">Must be consecutive years, e.g. 2024/2025</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date <span className="text-destructive">*</span></Label>
              <Input data-testid="input-session-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>End Date <span className="text-destructive">*</span></Label>
              <Input data-testid="input-session-end" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="Brief notes about this session..." rows={2}
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <ErrorBox msg={apiErr} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mut.isPending} data-testid="button-session-submit">
              {mut.isPending ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save Changes' : 'Create Session')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Term Dialog ──────────────────────────────────────────────────────────────

interface TermDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarTerm | null;
  sessions: CalendarSession[];
  onSaved: () => void;
}

function TermDialog({ open, onClose, editing, sessions, onSaved }: TermDialogProps) {
  const { toast } = useToast();
  const blank = { name: '', sessionId: '', year: '', startDate: '', endDate: '' };
  const [form, setForm] = useState(blank);
  const [apiErr, setApiErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setApiErr(null);
    setForm(editing
      ? { name: editing.name, sessionId: editing.sessionId ? String(editing.sessionId) : '', year: editing.year, startDate: editing.startDate, endDate: editing.endDate }
      : blank);
  }, [open, editing?.id]);

  const linkedSession = sessions.find(s => String(s.id) === form.sessionId);

  function setSessionId(v: string) {
    const s = sessions.find(s => String(s.id) === v);
    setForm(f => ({ ...f, sessionId: v, year: s?.year ?? f.year }));
  }

  const mut = useMutation({
    mutationFn: async (d: typeof form) => {
      const payload = { name: d.name, year: d.year, startDate: d.startDate, endDate: d.endDate, sessionId: d.sessionId && d.sessionId !== 'none' ? parseInt(d.sessionId) : null };
      const url = editing ? `/api/terms/${editing.id}` : '/api/terms';
      const r = await apiRequest(editing ? 'PUT' : 'POST', url, payload);
      if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Request failed' })); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'Success', description: editing ? 'Term updated.' : 'Term created.' }); onSaved(); onClose(); },
    onError: (e: any) => setApiErr(e.message || 'An error occurred.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.startDate >= form.endDate) { setApiErr('Start date must be before end date.'); return; }
    const ye = !linkedSession ? validateYear(form.year) : null;
    if (ye) { setApiErr(ye); return; }
    setApiErr(null);
    mut.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />{editing ? 'Edit Term' : 'New Academic Term'}</DialogTitle>
          <DialogDescription>{editing ? 'Update term details.' : 'Add a new term to a session.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>Term Name <span className="text-destructive">*</span></Label>
            <Select value={form.name} onValueChange={v => setForm(f => ({ ...f, name: v }))}>
              <SelectTrigger data-testid="select-term-name"><SelectValue placeholder="Select term…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="First Term">First Term</SelectItem>
                <SelectItem value="Second Term">Second Term</SelectItem>
                <SelectItem value="Third Term">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select value={form.sessionId} onValueChange={setSessionId}>
              <SelectTrigger data-testid="select-term-session"><SelectValue placeholder="Select session (optional)…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No session</SelectItem>
                {sessions.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {sessions.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Tip: Create a session first, then assign terms to it. Terms in the same session share an overlap check — keeping each year isolated.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Academic Year <span className="text-destructive">*</span></Label>
            <Input data-testid="input-term-year" placeholder="e.g. 2024/2025"
              value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              readOnly={!!linkedSession} className={linkedSession ? 'bg-muted/60 cursor-not-allowed' : ''} required />
            {linkedSession ? <p className="text-xs text-muted-foreground">Auto-filled from selected session</p>
              : <p className="text-xs text-muted-foreground">Consecutive years, e.g. 2024/2025</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date <span className="text-destructive">*</span></Label>
              <Input data-testid="input-term-start" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>End Date <span className="text-destructive">*</span></Label>
              <Input data-testid="input-term-end" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          <ErrorBox msg={apiErr} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mut.isPending} data-testid="button-term-submit">
              {mut.isPending ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save Changes' : 'Create Term')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner({ session, term, isLoading }: { session: CalendarSession | null; term: CalendarTerm | null; isLoading: boolean }) {
  const active = term && isCurrentlyActive(term.startDate, term.endDate);
  const pct = active ? termProgress(term!.startDate, term!.endDate) : 0;
  const dl = active ? daysLeft(term!.endDate) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/8 via-primary/3 to-background p-5 sm:p-6">
      <div className="absolute top-0 right-0 w-56 h-56 bg-primary/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Current Academic Session</p>
            {isLoading ? <Skeleton className="h-7 w-52 mb-1" /> : (
              <h2 className="text-xl sm:text-2xl font-bold truncate" data-testid="hero-session">{session?.name ?? 'No active session'}</h2>
            )}
            {!isLoading && session && <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(session.startDate)} → {fmtDate(session.endDate)}</p>}
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Active Term</p>
            {isLoading ? <Skeleton className="h-6 w-32" /> : term ? (
              <>
                <p className="text-lg font-bold text-primary" data-testid="hero-term">{term.name}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(term.startDate)} – {fmtDate(term.endDate)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground italic">No active term</p>}
          </div>
        </div>

        {!isLoading && term && active && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" /> Term Progress
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Day {daysElapsed(term.startDate)} of {totalDays(term.startDate, term.endDate)}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{dl} {dl === 1 ? 'day' : 'days'} left</span>
              </div>
            </div>
            <Progress value={pct} className="h-3 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1.5">{pct}% of this term has elapsed</p>
          </div>
        )}

        {!isLoading && !term && (
          <div className="mt-4 pt-4 border-t border-dashed border-muted flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            No term is currently active. Use the controls below to configure or manually activate one.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string; isLoading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${color} shrink-0`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-bold truncate" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Automation Banner ────────────────────────────────────────────────────────

function AutomationBanner({ enabled, isAdmin, isPending, onToggle }: { enabled: boolean; isAdmin: boolean; isPending: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
      enabled ? 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
               : 'bg-muted/30 border-dashed border-muted-foreground/20'
    }`} data-testid="banner-automation">
      <div className={`p-2 rounded-lg shrink-0 ${enabled ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
        <Bot className={`h-5 w-5 ${enabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${enabled ? 'text-amber-900 dark:text-amber-300' : 'text-foreground'}`}>
          Automatic Detection is {enabled ? 'Enabled' : 'Disabled'}
        </p>
        <p className={`text-xs mt-0.5 ${enabled ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {enabled
            ? 'The system automatically activates terms and sessions when their start date arrives (runs daily at midnight). Admins can still override manually.'
            : 'Manual mode — no automatic switching. Admins must activate sessions and terms explicitly using "Set as Current".'}
        </p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground">Auto-detect</span>
          <Switch data-testid="switch-auto-detect" checked={enabled} onCheckedChange={onToggle} disabled={isPending} />
        </div>
      )}
    </div>
  );
}

// ─── Sessions Table ───────────────────────────────────────────────────────────

interface SessionsTableProps {
  sessions: CalendarSession[];
  isAdmin: boolean;
  getStatus: (s: CalendarSession) => string;
  termsBySession: Record<number | string, CalendarTerm[]>;
  getTermStatus: (t: CalendarTerm) => TermStatus;
  onEdit: (s: CalendarSession) => void;
  onSetCurrent: (id: number) => void;
  onDeactivate: (id: number) => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
}

function SessionsTable({ sessions, isAdmin, getStatus, termsBySession, getTermStatus, onEdit, onSetCurrent, onDeactivate, onArchive, onUnarchive, onDelete }: SessionsTableProps) {
  if (sessions.length === 0) return null;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-[11px] uppercase tracking-wide">
              <th className="text-left py-2.5 pr-4 font-semibold">Session</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Year</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Start Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">End Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Status</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Terms</th>
              {isAdmin && <th className="text-right py-2.5 font-semibold w-10">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sessions.map(s => {
              const status = getStatus(s);
              const termCount = (termsBySession[s.id] ?? []).length;
              const isArchived = status === 'archived';
              return (
                <tr key={s.id} data-testid={`session-row-${s.id}`}
                  className={`hover:bg-muted/30 transition-colors ${s.isCurrent ? 'bg-primary/5' : ''} ${isArchived ? 'opacity-60' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{s.name}</span>
                      {s.isCurrent && <Badge className="text-[10px] bg-primary hover:bg-primary py-0 px-1.5">Current</Badge>}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{s.description}</p>}
                  </td>
                  <td className="py-3 pr-4 font-medium">{s.year}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(s.startDate)}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(s.endDate)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                  <td className="py-3 pr-4">
                    <Badge variant="secondary" className="text-xs">{termCount} term{termCount !== 1 ? 's' : ''}</Badge>
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-session-menu-${s.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Session Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!s.isCurrent && !isArchived && (
                            <DropdownMenuItem onClick={() => onSetCurrent(s.id)} data-testid={`btn-session-activate-${s.id}`}>
                              <Power className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
                            </DropdownMenuItem>
                          )}
                          {s.isCurrent && (
                            <DropdownMenuItem onClick={() => onDeactivate(s.id)} data-testid={`btn-session-deactivate-${s.id}`}>
                              <PowerOff className="h-4 w-4 mr-2 text-amber-600" /> Deactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(s)} disabled={isArchived} data-testid={`btn-session-edit-${s.id}`}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {!isArchived ? (
                            <DropdownMenuItem onClick={() => onArchive(s.id)} data-testid={`btn-session-archive-${s.id}`}>
                              <Archive className="h-4 w-4 mr-2 text-orange-500" /> Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => onUnarchive(s.id)} data-testid={`btn-session-unarchive-${s.id}`}>
                              <Eye className="h-4 w-4 mr-2 text-blue-500" /> Unarchive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={e => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                                disabled={s.isCurrent}
                                data-testid={`btn-session-delete-${s.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {s.isCurrent ? 'Cannot delete active' : 'Delete'}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "{s.name}"? Sessions with linked terms cannot be deleted — unlink all terms first.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(s.id)} data-testid={`btn-session-confirm-delete-${s.id}`}>Delete</AlertDialogAction>
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
      <div className="md:hidden space-y-3">
        {sessions.map(s => {
          const status = getStatus(s);
          const isArchived = status === 'archived';
          const sessionTerms = (termsBySession[s.id] ?? []).sort((a, b) => a.startDate.localeCompare(b.startDate));
          return (
            <div key={s.id} data-testid={`session-card-${s.id}`}
              className={`p-4 rounded-xl border-2 ${s.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'} ${isArchived ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{s.name}</span>
                    {s.isCurrent && <Badge className="text-[10px] bg-primary hover:bg-primary py-0">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.year}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Start</p><p className="font-medium">{fmtDate(s.startDate)}</p></div>
                <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">End</p><p className="font-medium">{fmtDate(s.endDate)}</p></div>
              </div>
              {/* Mini term timeline */}
              {sessionTerms.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mb-3 pb-3 border-b border-border/50">
                  {sessionTerms.map((t, i) => {
                    const ts = getTermStatus(t);
                    return (
                      <div key={t.id} className="flex items-center gap-1">
                        {i > 0 && <div className="w-2 h-px bg-border" />}
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                          ts === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                          : ts === 'completed' ? 'bg-muted border-border text-muted-foreground'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                        }`}>
                          {t.name.replace(' Term', '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!s.isCurrent && !isArchived && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSetCurrent(s.id)}>
                      <Power className="h-3 w-3 mr-1" /> Set Current
                    </Button>
                  )}
                  {s.isCurrent && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300" onClick={() => onDeactivate(s.id)}>
                      <PowerOff className="h-3 w-3 mr-1" /> Deactivate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(s)} disabled={isArchived}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {!isArchived
                    ? <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-300" onClick={() => onArchive(s.id)}><Archive className="h-3 w-3 mr-1" /> Archive</Button>
                    : <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-300" onClick={() => onUnarchive(s.id)}><Eye className="h-3 w-3 mr-1" /> Restore</Button>
                  }
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-7 w-7 ml-auto" disabled={s.isCurrent}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription>Delete "{s.name}"? Sessions with linked terms cannot be deleted.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(s.id)}>Delete</AlertDialogAction>
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

// ─── Terms Table ──────────────────────────────────────────────────────────────

interface TermsTableProps {
  terms: CalendarTerm[];
  isAdmin: boolean;
  getStatus: (t: CalendarTerm) => TermStatus;
  onEdit: (t: CalendarTerm) => void;
  onSetCurrent: (id: number) => void;
  onDeactivate: (id: number) => void;
  onToggleLock: (id: number) => void;
  onDelete: (id: number) => void;
}

function TermsTable({ terms, isAdmin, getStatus, onEdit, onSetCurrent, onDeactivate, onToggleLock, onDelete }: TermsTableProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-[11px] uppercase tracking-wide">
              <th className="text-left py-2.5 pr-4 font-semibold">Term</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Start Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">End Date</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Status</th>
              <th className="text-left py-2.5 pr-4 font-semibold min-w-[130px]">Progress</th>
              <th className="text-left py-2.5 pr-4 font-semibold">Lock</th>
              {isAdmin && <th className="text-right py-2.5 font-semibold w-10">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {terms.map(t => {
              const status = getStatus(t);
              const active = status === 'active';
              const pct = active ? termProgress(t.startDate, t.endDate) : 0;
              return (
                <tr key={t.id} data-testid={`term-row-${t.id}`}
                  className={`hover:bg-muted/30 transition-colors ${t.isCurrent ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{t.name}</span>
                      {t.isCurrent && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 py-0 px-1.5">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.year}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(t.startDate)}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(t.endDate)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                  <td className="py-3 pr-4">
                    {active ? (
                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5 w-28" />
                        <p className="text-xs text-muted-foreground">{pct}% · {daysLeft(t.endDate)}d left</p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {t.isLocked
                      ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium"><Lock className="h-3 w-3" /> Locked</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-term-menu-${t.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Term Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!t.isCurrent && (
                            <DropdownMenuItem onClick={() => onSetCurrent(t.id)} data-testid={`btn-term-activate-${t.id}`}>
                              <Power className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
                            </DropdownMenuItem>
                          )}
                          {t.isCurrent && (
                            <DropdownMenuItem onClick={() => onDeactivate(t.id)} data-testid={`btn-term-deactivate-${t.id}`}>
                              <PowerOff className="h-4 w-4 mr-2 text-amber-600" /> Deactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onToggleLock(t.id)} data-testid={`btn-term-lock-${t.id}`}>
                            {t.isLocked ? <><Unlock className="h-4 w-4 mr-2" /> Unlock</> : <><Lock className="h-4 w-4 mr-2" /> Lock</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(t)} disabled={t.isLocked} data-testid={`btn-term-edit-${t.id}`}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={e => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                                disabled={t.isLocked || t.isCurrent}
                                data-testid={`btn-term-delete-${t.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t.isCurrent ? 'Cannot delete active' : t.isLocked ? 'Unlock to delete' : 'Delete'}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                                <AlertDialogDescription>Delete "{t.name} ({t.year})"? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(t.id)} data-testid={`btn-term-confirm-delete-${t.id}`}>Delete</AlertDialogAction>
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
        {terms.map(t => {
          const status = getStatus(t);
          const active = status === 'active';
          const pct = active ? termProgress(t.startDate, t.endDate) : 0;
          return (
            <div key={t.id} data-testid={`term-card-${t.id}`}
              className={`p-3.5 rounded-xl border-2 ${t.isCurrent ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{t.name}</span>
                    {t.isCurrent && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 py-0">Current</Badge>}
                    {t.isLocked && <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium"><Lock className="h-3 w-3" /> Locked</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.year}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Start</p><p className="font-medium">{fmtDate(t.startDate)}</p></div>
                <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">End</p><p className="font-medium">{fmtDate(t.endDate)}</p></div>
              </div>
              {active && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{pct}% complete</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{daysLeft(t.endDate)}d left</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              )}
              {isAdmin && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/50">
                  {!t.isCurrent && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSetCurrent(t.id)}>
                      <Power className="h-3 w-3 mr-1" /> Set Current
                    </Button>
                  )}
                  {t.isCurrent && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300" onClick={() => onDeactivate(t.id)}>
                      <PowerOff className="h-3 w-3 mr-1" /> Deactivate
                    </Button>
                  )}
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onToggleLock(t.id)}>
                    {t.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={t.isLocked} onClick={() => onEdit(t)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-7 w-7" disabled={t.isLocked || t.isCurrent}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                        <AlertDialogDescription>Delete "{t.name} ({t.year})"? This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(t.id)}>Delete</AlertDialogAction>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AcademicTermsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // ⚠ isAdmin MUST be declared before any hook that uses it
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const calendar = useAcademicCalendar();

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; editing: CalendarSession | null }>({ open: false, editing: null });
  const [termDialog, setTermDialog] = useState<{ open: boolean; editing: CalendarTerm | null }>({ open: false, editing: null });

  // ── Automation setting ──────────────────────────────────────────────────────
  const { data: calSettings } = useQuery<{ academicAutoDetect: boolean }>({
    queryKey: ['/api/academic-calendar/settings'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/academic-calendar/settings');
      if (!r.ok) return { academicAutoDetect: true };
      const j = await r.json().catch(() => null);
      return j?.data ?? j ?? { academicAutoDetect: true };
    },
    enabled: isAdmin,
    staleTime: 60000,
  });
  const autoDetect = calSettings?.academicAutoDetect !== false;

  const autoDetectMut = useMutation({
    mutationFn: async (v: boolean) => {
      const r = await apiRequest('PUT', '/api/academic-calendar/settings', { academicAutoDetect: v });
      if (!r.ok) throw new Error('Failed to save setting');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/academic-calendar/settings'] }),
    onError: () => toast({ title: 'Error', description: 'Failed to save automation setting.', variant: 'destructive' }),
  });

  // ── Run transitions ─────────────────────────────────────────────────────────
  const runTransMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/academic-calendar/run-transitions');
      if (!r.ok) throw new Error('Request failed');
      return r.json();
    },
    onSuccess: (d: any) => {
      const { activated = [], completed = [] } = d?.data ?? d ?? {};
      toast({
        title: 'Transitions Complete',
        description: activated.length > 0 || completed.length > 0
          ? `${activated.length} activated, ${completed.length} completed.`
          : 'All statuses are already up to date.',
      });
      calendar.invalidate();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Session mutations ───────────────────────────────────────────────────────
  function useSessionMut(description: string, fn: (id: number) => Promise<any>) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => { toast({ title: 'Done', description }); calendar.invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e.message || 'Operation failed.', variant: 'destructive' }),
    });
  }

  const setCurrentSessionMut = useSessionMut('Session set as current.', async (id) => {
    const r = await apiRequest('PUT', `/api/sessions/${id}/mark-current`);
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const deactivateSessionMut = useSessionMut('Session deactivated.', async (id) => {
    const r = await apiRequest('PUT', `/api/sessions/${id}`, { status: 'inactive' });
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const archiveSessionMut = useSessionMut('Session archived.', async (id) => {
    const r = await apiRequest('PUT', `/api/sessions/${id}`, { status: 'archived' });
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const unarchiveSessionMut = useSessionMut('Session restored.', async (id) => {
    const r = await apiRequest('PUT', `/api/sessions/${id}`, { status: 'upcoming' });
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const deleteSessionMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('DELETE', `/api/sessions/${id}`);
      if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed to delete' })); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'Deleted', description: 'Session deleted.' }); calendar.invalidate(); },
    onError: (e: any) => toast({ title: 'Cannot Delete', description: e.message, variant: 'destructive' }),
  });

  // ── Term mutations ──────────────────────────────────────────────────────────
  function useTermMut(description: string, fn: (id: number) => Promise<any>) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => { toast({ title: 'Done', description }); calendar.invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e.message || 'Operation failed.', variant: 'destructive' }),
    });
  }

  const setCurrentTermMut = useTermMut('Term set as current.', async (id) => {
    const r = await apiRequest('PUT', `/api/terms/${id}/mark-current`);
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const deactivateTermMut = useTermMut('Term deactivated.', async (id) => {
    const r = await apiRequest('PUT', `/api/terms/${id}/status`, { status: 'completed' });
    if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
    return r.json();
  });

  const toggleLockMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('PUT', `/api/terms/${id}/toggle-lock`);
      if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d: any) => { toast({ title: 'Done', description: d?.data?.isLocked ?? d?.isLocked ? 'Term locked.' : 'Term unlocked.' }); calendar.invalidate(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTermMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('DELETE', `/api/terms/${id}`);
      if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed to delete' })); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'Deleted', description: 'Term deleted.' }); calendar.invalidate(); },
    onError: (e: any) => toast({ title: 'Cannot Delete', description: e.message, variant: 'destructive' }),
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const { currentSession, currentTerm, upcomingTerm, allSessions, allTerms, isLoading } = calendar;
  const daysToNext = upcomingTerm ? calendar.daysUntil(upcomingTerm.startDate) : null;
  const activeTermCount = allTerms.filter(t => calendar.getTermStatus(t) === 'active').length;

  // Fallback session boundaries from terms when no session exists
  const currentYear = currentTerm?.year ?? null;
  const yearTerms = currentYear ? allTerms.filter(t => t.year === currentYear) : [];
  const fallbackSessionStart = yearTerms.length > 0
    ? yearTerms.reduce((a, b) => a.startDate < b.startDate ? a : b).startDate : null;
  const fallbackSessionEnd = yearTerms.length > 0
    ? yearTerms.reduce((a, b) => a.endDate > b.endDate ? a : b).endDate : null;

  if (!user) return <div className="flex items-center justify-center h-48 text-muted-foreground">Please log in.</div>;

  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5" data-testid="page-title">
            <div className="p-2 rounded-lg bg-primary/10"><GraduationCap className="h-6 w-6 text-primary" /></div>
            Academic Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage sessions, terms, and calendar automation</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => runTransMut.mutate()} disabled={runTransMut.isPending} data-testid="btn-run-transitions">
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${runTransMut.isPending ? 'animate-spin' : ''}`} />
                    {runTransMut.isPending ? 'Running…' : 'Run Transitions'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Manually trigger date-based term transitions</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="btn-new-term">
              <Plus className="h-4 w-4 mr-1" /> New Term
            </Button>
            <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="btn-new-session">
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          </div>
        )}
      </div>

      {/* ── Hero Banner ── */}
      <HeroBanner session={currentSession} term={currentTerm} isLoading={isLoading} />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : <>
          <StatCard icon={Play} label="Active Term" value={currentTerm?.name ?? '—'} sub={currentTerm ? `Ends ${fmtShort(currentTerm.endDate)}` : undefined} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
          <StatCard icon={Layers} label="Session" value={currentSession?.year ?? (currentYear ?? '—')} sub={currentSession ? currentSession.name : currentYear ? 'No session linked' : undefined} color="bg-primary/10 text-primary" />
          <StatCard icon={ChevronRight} label="Next Term" value={upcomingTerm?.name ?? '—'} sub={daysToNext !== null && daysToNext >= 0 ? `in ${daysToNext}d` : (upcomingTerm ? fmtShort(upcomingTerm.startDate) : undefined)} color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
          <StatCard icon={CalendarDays} label="Term/Yr Start" value={currentSession ? fmtShort(currentSession.startDate) : (fallbackSessionStart ? fmtShort(fallbackSessionStart) : '—')} sub={currentSession ? undefined : (fallbackSessionStart ? currentYear ?? undefined : undefined)} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
          <StatCard icon={Target} label="Term/Yr End" value={currentSession ? fmtShort(currentSession.endDate) : (fallbackSessionEnd ? fmtShort(fallbackSessionEnd) : '—')} sub={currentSession ? undefined : (fallbackSessionEnd ? currentYear ?? undefined : undefined)} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" />
          <StatCard icon={Zap} label="Records" value={`${allSessions.length}S · ${allTerms.length}T`} sub={`${allSessions.length} session${allSessions.length !== 1 ? 's' : ''}, ${allTerms.length} term${allTerms.length !== 1 ? 's' : ''}`} color="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400" />
        </>}
      </div>

      {/* ── Automation Banner ── */}
      <AutomationBanner
        enabled={autoDetect}
        isAdmin={isAdmin}
        isPending={autoDetectMut.isPending}
        onToggle={v => autoDetectMut.mutate(v)}
      />

      {/* ── Sessions ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Layers className="h-4 w-4 text-primary" /> Academic Sessions
                <Badge variant="secondary" className="ml-1">{allSessions.length}</Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">School years that group your terms — create, activate, archive, and delete sessions</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="btn-add-session">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          : allSessions.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-sessions">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Layers className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium mb-1">No sessions yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create an academic session (school year) to get started</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })}>
                  <Plus className="h-4 w-4 mr-1" /> Create First Session
                </Button>
              )}
            </div>
          ) : (
            <SessionsTable
              sessions={allSessions}
              isAdmin={isAdmin}
              getStatus={calendar.getSessionStatus}
              termsBySession={calendar.termsBySession}
              getTermStatus={calendar.getTermStatus}
              onEdit={s => setSessionDialog({ open: true, editing: s })}
              onSetCurrent={id => setCurrentSessionMut.mutate(id)}
              onDeactivate={id => deactivateSessionMut.mutate(id)}
              onArchive={id => archiveSessionMut.mutate(id)}
              onUnarchive={id => unarchiveSessionMut.mutate(id)}
              onDelete={id => deleteSessionMut.mutate(id)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Terms ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-primary" /> Academic Terms
                <Badge variant="secondary" className="ml-1">{allTerms.length}</Badge>
                {activeTermCount > 0 && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 py-0">{activeTermCount} active</Badge>}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Manage terms within sessions — activate, lock, and track progress</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="btn-add-term">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          : allTerms.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-terms">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium mb-1">No terms yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create a session first, then add First, Second, and Third terms to it</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setTermDialog({ open: true, editing: null })}>
                  <Plus className="h-4 w-4 mr-1" /> Create First Term
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grouped by session */}
              {allSessions.map(session => {
                const sessionTerms = (calendar.termsBySession[session.id] ?? [])
                  .slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
                if (sessionTerms.length === 0) return null;
                return (
                  <div key={session.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${session.isCurrent ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <span className="text-sm font-semibold">{session.name}</span>
                      <span className="text-xs text-muted-foreground">({session.year})</span>
                      <div className="flex-1 h-px bg-border" />
                      <Badge variant="secondary" className="text-xs">{sessionTerms.length} term{sessionTerms.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <TermsTable
                      terms={sessionTerms}
                      isAdmin={isAdmin}
                      getStatus={calendar.getTermStatus}
                      onEdit={t => setTermDialog({ open: true, editing: t })}
                      onSetCurrent={id => setCurrentTermMut.mutate(id)}
                      onDeactivate={id => deactivateTermMut.mutate(id)}
                      onToggleLock={id => toggleLockMut.mutate(id)}
                      onDelete={id => deleteTermMut.mutate(id)}
                    />
                  </div>
                );
              })}

              {/* Unassigned terms */}
              {(calendar.termsBySession['unassigned'] ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                    <span className="text-sm font-semibold text-muted-foreground">Unassigned Terms</span>
                    <div className="flex-1 h-px bg-border" />
                    <Badge variant="secondary" className="text-xs">{(calendar.termsBySession['unassigned'] ?? []).length}</Badge>
                  </div>
                  <TermsTable
                    terms={calendar.termsBySession['unassigned']}
                    isAdmin={isAdmin}
                    getStatus={calendar.getTermStatus}
                    onEdit={t => setTermDialog({ open: true, editing: t })}
                    onSetCurrent={id => setCurrentTermMut.mutate(id)}
                    onDeactivate={id => deactivateTermMut.mutate(id)}
                    onToggleLock={id => toggleLockMut.mutate(id)}
                    onDelete={id => deleteTermMut.mutate(id)}
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
