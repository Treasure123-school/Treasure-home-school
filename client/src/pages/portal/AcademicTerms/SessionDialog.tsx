import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { CalendarSession } from '@/hooks/useAcademicCalendar';
import { Layers, AlertTriangle } from 'lucide-react';
import { ErrorBox, validateYear, jsonError } from './shared';

interface SessionDialogProps {
  open: boolean;
  onClose: () => void;
  editing: CalendarSession | null;
  onSaved: () => void;
}

export function SessionDialog({ open, onClose, editing, onSaved }: SessionDialogProps) {
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
      if (!r.ok) { const e = await jsonError(r); throw new Error(e.message); }
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
