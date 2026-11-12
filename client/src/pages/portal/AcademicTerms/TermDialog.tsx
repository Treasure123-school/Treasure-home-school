import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { CalendarSession, CalendarTerm } from '@/hooks/useAcademicCalendar';
import { Calendar, Info } from 'lucide-react';
import { ErrorBox, validateYear, jsonError } from './shared';

interface TermDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarTerm | null;
  sessions: CalendarSession[];
  onSaved: () => void;
}

export function TermDialog({ open, onClose, editing, sessions, onSaved }: TermDialogProps) {
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
      if (!r.ok) { const e = await jsonError(r); throw new Error(e.message); }
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
