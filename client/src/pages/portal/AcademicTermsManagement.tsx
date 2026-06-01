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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import type { CalendarSession, CalendarTerm, TermStatus } from '@/hooks/useAcademicCalendar';
import {
  Plus, Calendar, Edit, Trash2, CheckCircle, Lock, Unlock,
  GraduationCap, Clock, Archive, Play, CalendarDays,
  AlertTriangle, Bot, ChevronRight, MoreVertical, Layers
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

type SessionStatus = 'active' | 'upcoming' | 'completed' | 'archived';

const statusBadge: Record<string, { label: string; className: string; icon: any }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Play },
  upcoming: { label: 'Upcoming', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: CheckCircle },
  archived: { label: 'Archived', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Archive },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusBadge[status] ?? statusBadge.upcoming;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function validateYearFormat(year: string): string | null {
  if (!/^\d{4}\/\d{4}$/.test(year)) return 'Format must be YYYY/YYYY (e.g., 2024/2025)';
  const [a, b] = year.split('/').map(Number);
  if (b !== a + 1) return 'Years must be consecutive (e.g., 2024/2025)';
  return null;
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
      setForm({
        name: editing.name,
        year: editing.year,
        startDate: editing.startDate,
        endDate: editing.endDate,
        description: editing.description ?? '',
      });
    } else {
      setForm({ name: '', year: '', startDate: '', endDate: '', description: '' });
    }
    setYearError(null);
    setApiError(null);
  }, [open, editing?.id]);

  const handleOpenChange = (o: boolean) => { if (!o) { onClose(); } };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editing ? `/api/sessions/${editing.id}` : '/api/sessions';
      const method = editing ? 'PUT' : 'POST';
      const res = await apiRequest(method, url, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(err.message || 'Request failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: editing ? 'Session updated.' : 'Session created.' });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      setApiError(err.message || 'An error occurred.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yErr = validateYearFormat(form.year);
    if (yErr) { setYearError(yErr); return; }
    setYearError(null);
    setApiError(null);
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-session">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {editing ? 'Edit Session' : 'New Academic Session'}
          </DialogTitle>
          <DialogDescription>
            {editing ? 'Update this academic session.' : 'Add a new school year session.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="s-name">Session Name</Label>
            <Input id="s-name" data-testid="input-session-name" placeholder="e.g., 2024/2025 Academic Session"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-year">Academic Year</Label>
            <Input id="s-year" data-testid="input-session-year" placeholder="e.g., 2024/2025"
              value={form.year}
              onChange={e => { setForm({ ...form, year: e.target.value }); setYearError(null); }}
              className={yearError ? 'border-destructive' : ''} required />
            {yearError && (
              <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-session-year-error">
                <AlertTriangle className="h-3 w-3" />{yearError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-start">Start Date</Label>
              <Input id="s-start" data-testid="input-session-start" type="date"
                value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-end">End Date</Label>
              <Input id="s-end" data-testid="input-session-end" type="date"
                value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-session-api-error">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {apiError}
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
  const [form, setForm] = useState({
    name: '', sessionId: '', year: '', startDate: '', endDate: ''
  });
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        sessionId: editing.sessionId ? String(editing.sessionId) : '',
        year: editing.year,
        startDate: editing.startDate,
        endDate: editing.endDate,
      });
    } else {
      setForm({ name: '', sessionId: '', year: '', startDate: '', endDate: '' });
    }
    setApiError(null);
  }, [open, editing?.id]);

  const handleOpenChange = (o: boolean) => { if (!o) { onClose(); } };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        name: data.name,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        sessionId: data.sessionId ? parseInt(data.sessionId) : null,
      };
      const url = editing ? `/api/terms/${editing.id}` : '/api/terms';
      const method = editing ? 'PUT' : 'POST';
      const res = await apiRequest(method, url, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(err.message || 'Request failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: editing ? 'Term updated.' : 'Term created.' });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      setApiError(err.message || 'An error occurred.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    mutation.mutate(form);
  };

  const selectedSession = sessions.find(s => String(s.id) === form.sessionId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-term">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {editing ? 'Edit Term' : 'New Academic Term'}
          </DialogTitle>
          <DialogDescription>
            {editing ? 'Update this academic term.' : 'Add a new term to a session.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Term Name</Label>
            <Select value={form.name} onValueChange={v => setForm({ ...form, name: v })}>
              <SelectTrigger data-testid="select-term-name">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="First Term">First Term</SelectItem>
                <SelectItem value="Second Term">Second Term</SelectItem>
                <SelectItem value="Third Term">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Session</Label>
            <Select value={form.sessionId}
              onValueChange={v => {
                const s = sessions.find(s => String(s.id) === v);
                setForm({ ...form, sessionId: v, year: s?.year ?? form.year });
              }}>
              <SelectTrigger data-testid="select-term-session">
                <SelectValue placeholder="Select session (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No session</SelectItem>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-year">Academic Year</Label>
            <Input id="t-year" data-testid="input-term-year" placeholder="e.g., 2024/2025"
              value={form.year}
              onChange={e => setForm({ ...form, year: e.target.value })}
              readOnly={!!selectedSession}
              className={selectedSession ? 'bg-muted cursor-not-allowed' : ''}
              required />
            {selectedSession && (
              <p className="text-xs text-muted-foreground">Auto-filled from selected session</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-start">Start Date</Label>
              <Input id="t-start" data-testid="input-term-start" type="date"
                value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-end">End Date</Label>
              <Input id="t-end" data-testid="input-term-end" type="date"
                value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-term-api-error">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {apiError}
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AcademicTermsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const calendar = useAcademicCalendar();

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; editing: CalendarSession | null }>({ open: false, editing: null });
  const [termDialog, setTermDialog] = useState<{ open: boolean; editing: CalendarTerm | null }>({ open: false, editing: null });

  const { data: autoDetectSetting } = useQuery<any>({
    queryKey: ['/api/settings', 'academic_auto_detect'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/settings?key=academic_auto_detect');
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
  });

  const autoDetectEnabled = autoDetectSetting?.value !== 'false';

  const autoDetectMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest('PUT', '/api/settings', {
        key: 'academic_auto_detect',
        value: String(enabled),
        description: 'Auto-detect and activate academic terms based on dates',
        dataType: 'boolean',
      });
      if (!res.ok) throw new Error('Failed to update setting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update auto-detect setting.', variant: 'destructive' });
    },
  });

  const setActiveSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/sessions/${id}/mark-current`);
      if (!res.ok) throw new Error('Failed to set active session');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Session set as current.' });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/sessions/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to delete' }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Session deleted.' });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const setActiveTermMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/terms/${id}/mark-current`);
      if (!res.ok) throw new Error('Failed to set active term');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Term set as current.' });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PUT', `/api/terms/${id}/toggle-lock`);
      if (!res.ok) throw new Error('Failed to toggle lock');
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: 'Success', description: data.isLocked ? 'Term locked.' : 'Term unlocked.' });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/terms/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to delete' }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Term deleted.' });
      calendar.invalidate();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  if (!user) return <div className="flex items-center justify-center h-screen">Please log in</div>;

  const { currentSession, currentTerm, upcomingTerm, allSessions, allTerms, isLoading } = calendar;

  const daysToNextTerm = upcomingTerm ? calendar.daysUntil(upcomingTerm.startDate) : null;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <GraduationCap className="h-7 w-7 text-primary" />
            Academic Calendar
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage sessions, terms, and school year configuration
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTermDialog({ open: true, editing: null })}
              data-testid="button-new-term">
              <Plus className="h-4 w-4 mr-1" /> New Term
            </Button>
            <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })}
              data-testid="button-new-session">
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          </div>
        )}
      </div>

      {/* ── Dashboard Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Current Session */}
        <Card className="col-span-2 md:col-span-1 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 shrink-0">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Session</p>
                {isLoading ? <Skeleton className="h-5 w-24 mt-1" /> : (
                  <p className="text-sm font-semibold truncate mt-0.5" data-testid="stat-current-session">
                    {currentSession?.year ?? '—'}
                  </p>
                )}
                {!isLoading && currentSession && (
                  <StatusBadge status={calendar.getSessionStatus(currentSession)} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Term */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-green-500/10 shrink-0">
                <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Term</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-semibold truncate mt-0.5" data-testid="stat-active-term">
                    {currentTerm?.name ?? '—'}
                  </p>
                )}
                {!isLoading && currentTerm && (
                  <StatusBadge status="active" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Term */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-amber-500/10 shrink-0">
                <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next Term</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <>
                    <p className="text-sm font-semibold truncate mt-0.5" data-testid="stat-next-term">
                      {upcomingTerm?.name ?? '—'}
                    </p>
                    {daysToNextTerm !== null && daysToNextTerm >= 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                        Starts in {daysToNextTerm}d
                      </p>
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
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-blue-500/10 shrink-0">
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Session Start</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-semibold mt-0.5" data-testid="stat-session-start">
                    {currentSession ? formatDate(currentSession.startDate) : '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session End */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-purple-500/10 shrink-0">
                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Session End</p>
                {isLoading ? <Skeleton className="h-5 w-20 mt-1" /> : (
                  <p className="text-sm font-semibold mt-0.5" data-testid="stat-session-end">
                    {currentSession ? formatDate(currentSession.endDate) : '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Auto-detect Banner ── */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border ${
        autoDetectEnabled
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
          : 'bg-muted/40 border-muted'
      }`} data-testid="banner-auto-detect">
        <Bot className={`h-5 w-5 shrink-0 ${autoDetectEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${autoDetectEnabled ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
            Auto-detect is {autoDetectEnabled ? 'ON' : 'OFF'} — {autoDetectEnabled
              ? 'terms activate automatically based on their configured start dates. You can still manually override.'
              : 'terms must be activated manually using the "Set Active" action below.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Auto-detect</span>
            <Switch
              data-testid="switch-auto-detect"
              checked={autoDetectEnabled}
              onCheckedChange={v => autoDetectMutation.mutate(v)}
              disabled={autoDetectMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* ── Sessions Section ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" /> Academic Sessions
              </CardTitle>
              <CardDescription className="text-sm">School years that group your terms together</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setSessionDialog({ open: true, editing: null })}
                data-testid="button-add-session">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : allSessions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground" data-testid="empty-sessions">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-3">No sessions yet.</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setSessionDialog({ open: true, editing: null })}
                  data-testid="button-create-first-session">
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
                      <th className="text-left py-2 pr-4 font-medium">Session Name</th>
                      <th className="text-left py-2 pr-4 font-medium">Year</th>
                      <th className="text-left py-2 pr-4 font-medium">Dates</th>
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-left py-2 pr-4 font-medium">Terms</th>
                      {isAdmin && <th className="text-right py-2 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allSessions.map(session => {
                      const status = calendar.getSessionStatus(session);
                      const termCount = (calendar.termsBySession[session.id] ?? []).length;
                      return (
                        <tr key={session.id} data-testid={`session-row-${session.id}`}
                          className={`hover:bg-muted/40 transition-colors ${session.isCurrent ? 'bg-primary/5' : ''}`}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{session.name}</span>
                              {session.isCurrent && <Badge className="text-xs bg-primary py-0">Current</Badge>}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{session.year}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(session.startDate)} – {formatDate(session.endDate)}
                          </td>
                          <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                          <td className="py-3 pr-4">
                            <Badge variant="secondary" className="text-xs">{termCount}</Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                    data-testid={`button-session-menu-${session.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!session.isCurrent && (
                                    <DropdownMenuItem data-testid={`button-session-set-active-${session.id}`}
                                      onClick={() => setActiveSessionMutation.mutate(session.id)}>
                                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Set Active
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem data-testid={`button-session-edit-${session.id}`}
                                    onClick={() => setSessionDialog({ open: true, editing: session })}>
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
                                        <AlertDialogDescription>
                                          Delete "{session.name}"? Sessions with linked terms cannot be deleted.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={() => deleteSessionMutation.mutate(session.id)}
                                          data-testid={`button-confirm-session-delete-${session.id}`}>
                                          Delete
                                        </AlertDialogAction>
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
                {allSessions.map(session => {
                  const status = calendar.getSessionStatus(session);
                  const termCount = (calendar.termsBySession[session.id] ?? []).length;
                  return (
                    <div key={session.id} data-testid={`session-card-${session.id}`}
                      className={`p-4 rounded-lg border space-y-2 ${session.isCurrent ? 'border-primary/40 bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{session.name}</span>
                            {session.isCurrent && <Badge className="text-xs bg-primary py-0">Current</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{session.year}</p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.startDate)} – {formatDate(session.endDate)}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">{termCount} term{termCount !== 1 ? 's' : ''}</Badge>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            {!session.isCurrent && (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => setActiveSessionMutation.mutate(session.id)}
                                data-testid={`button-session-activate-mobile-${session.id}`}>
                                Set Active
                              </Button>
                            )}
                            <Button variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setSessionDialog({ open: true, editing: session })}
                              data-testid={`button-session-edit-mobile-${session.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-7 w-7"
                                  disabled={session.isCurrent}
                                  data-testid={`button-session-delete-mobile-${session.id}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Delete "{session.name}"? Sessions with linked terms cannot be deleted.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteSessionMutation.mutate(session.id)}>
                                    Delete
                                  </AlertDialogAction>
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" /> Academic Terms
              </CardTitle>
              <CardDescription className="text-sm">Terms are grouped under their session</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setTermDialog({ open: true, editing: null })}
                data-testid="button-add-term">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : allTerms.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground" data-testid="empty-terms">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-3">No terms yet. Create a session first, then add terms.</p>
              {isAdmin && (
                <Button size="sm" onClick={() => setTermDialog({ open: true, editing: null })}
                  data-testid="button-create-first-term">
                  <Plus className="h-4 w-4 mr-1" /> Create First Term
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group terms by session */}
              {allSessions.map(session => {
                const sessionTerms = (calendar.termsBySession[session.id] ?? [])
                  .slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
                if (sessionTerms.length === 0) return null;
                return (
                  <div key={session.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {session.name}
                      </h4>
                      <div className="flex-1 h-px bg-border" />
                      <Badge variant="secondary" className="text-xs">{sessionTerms.length} term{sessionTerms.length !== 1 ? 's' : ''}</Badge>
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
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Unassigned</h4>
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
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left py-2 pr-4 font-medium">Term</th>
              <th className="text-left py-2 pr-4 font-medium">Dates</th>
              <th className="text-left py-2 pr-4 font-medium">Status</th>
              <th className="text-left py-2 pr-4 font-medium">Locked</th>
              {isAdmin && <th className="text-right py-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {terms.map(term => {
              const status = getStatus(term);
              return (
                <tr key={term.id} data-testid={`term-row-${term.id}`}
                  className={`hover:bg-muted/40 transition-colors ${term.isCurrent ? 'bg-primary/5' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{term.name}</span>
                      {term.isCurrent && <Badge className="text-xs bg-primary py-0">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{term.year}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(term.startDate)} – {formatDate(term.endDate)}
                  </td>
                  <td className="py-3 pr-4"><StatusBadge status={status} /></td>
                  <td className="py-3 pr-4">
                    {term.isLocked
                      ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Locked</span>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            data-testid={`button-term-menu-${term.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!term.isCurrent && (
                            <DropdownMenuItem onClick={() => onSetActive(term.id)}
                              data-testid={`button-term-set-active-${term.id}`}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Set Active
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onToggleLock(term.id)}
                            data-testid={`button-term-lock-${term.id}`}>
                            {term.isLocked
                              ? <><Unlock className="h-4 w-4 mr-2" /> Unlock</>
                              : <><Lock className="h-4 w-4 mr-2" /> Lock</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(term)}
                            disabled={term.isLocked}
                            data-testid={`button-term-edit-${term.id}`}>
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
                                <AlertDialogDescription>
                                  Delete "{term.name} ({term.year})"? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(term.id)}
                                  data-testid={`button-confirm-term-delete-${term.id}`}>
                                  Delete
                                </AlertDialogAction>
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

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {terms.map(term => {
          const status = getStatus(term);
          return (
            <div key={term.id} data-testid={`term-card-${term.id}`}
              className={`p-3 rounded-lg border space-y-2 ${term.isCurrent ? 'border-primary/40 bg-primary/5' : ''} ${term.isLocked ? 'opacity-80' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{term.name}</span>
                    {term.isCurrent && <Badge className="text-xs bg-primary py-0">Current</Badge>}
                    {term.isLocked && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{term.year}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(term.startDate)} – {formatDate(term.endDate)}
              </p>
              {isAdmin && (
                <div className="flex items-center gap-1 flex-wrap">
                  {!term.isCurrent && (
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => onSetActive(term.id)}
                      data-testid={`button-term-activate-mobile-${term.id}`}>
                      Set Active
                    </Button>
                  )}
                  <Button variant="outline" size="icon" className="h-7 w-7"
                    onClick={() => onToggleLock(term.id)}
                    data-testid={`button-term-lock-mobile-${term.id}`}>
                    {term.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7"
                    disabled={term.isLocked}
                    onClick={() => onEdit(term)}
                    data-testid={`button-term-edit-mobile-${term.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-7 w-7"
                        disabled={term.isLocked || term.isCurrent}
                        data-testid={`button-term-delete-mobile-${term.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Term?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete "{term.name} ({term.year})"? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(term.id)}>
                          Delete
                        </AlertDialogAction>
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
