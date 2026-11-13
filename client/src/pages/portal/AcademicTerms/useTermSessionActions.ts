import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';

async function call(method: 'PUT' | 'DELETE' | 'POST', url: string, body?: unknown) {
  const r = await apiRequest(method, url, body);
  if (!r.ok) { const e = await r.json().catch(() => ({ message: 'Failed' })); throw new Error(e.message); }
  return r.json();
}

function useCalMut(description: string, fn: (id: number) => Promise<any>, errorTitle = 'Error') {
  const { toast } = useToast();
  const calendar = useAcademicCalendar();
  return {
    calendar,
    mut: useMutation({
      mutationFn: fn,
      onSuccess: () => { toast({ title: 'Success', description }); calendar.invalidate(); },
      onError: (e: any) => toast({ title: errorTitle, description: e.message || 'Operation failed.', variant: 'destructive' }),
    }),
  };
}

/**
 * All session/term action mutations + automation controls.
 * Returns one stable `actions` object for the tables' menus.
 */
export function useTermSessionActions(isAdmin: boolean) {
  const { toast } = useToast();
  const calendar = useAcademicCalendar();

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
  const runTransitionsMut = useMutation({
    mutationFn: async () => call('POST', '/api/academic-calendar/run-transitions'),
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
  const { mut: setCurrentSessionMut } = useCalMut('Session set as current.', id => call('PUT', `/api/sessions/${id}/mark-current`));
  const { mut: deactivateSessionMut } = useCalMut('Session deactivated.', id => call('PUT', `/api/sessions/${id}/deactivate`));
  const { mut: archiveSessionMut } = useCalMut('Session archived.', id => call('PUT', `/api/sessions/${id}`, { status: 'archived' }));
  const { mut: unarchiveSessionMut } = useCalMut('Session restored.', id => call('PUT', `/api/sessions/${id}`, { status: 'upcoming' }));
  const { mut: deleteSessionMut } = useCalMut('Session deleted.', id => call('DELETE', `/api/sessions/${id}`), 'Cannot Delete');

  // ── Term mutations ──────────────────────────────────────────────────────────
  const { mut: setCurrentTermMut } = useCalMut('Term set as current.', id => call('PUT', `/api/terms/${id}/mark-current`));
  const { mut: deactivateTermMut } = useCalMut('Term deactivated.', id => call('PUT', `/api/terms/${id}/deactivate`));
  const { mut: archiveTermMut } = useCalMut('Term archived.', id => call('PUT', `/api/terms/${id}/status`, { status: 'archived' }));
  const { mut: unarchiveTermMut } = useCalMut('Term restored.', id => call('PUT', `/api/terms/${id}/status`, { status: 'upcoming' }));
  const { mut: deleteTermMut } = useCalMut('Term deleted.', id => call('DELETE', `/api/terms/${id}`), 'Cannot Delete');

  const [showHistory, setShowHistory] = useState(false);

  return {
    calendar,
    autoDetect,
    autoDetectMut,
    runTransitionsMut,
    showHistory,
    setShowHistory,
    sessionActions: {
      onSetCurrent: (id: number) => setCurrentSessionMut.mutate(id),
      onDeactivate: (id: number) => deactivateSessionMut.mutate(id),
      onArchive: (id: number) => archiveSessionMut.mutate(id),
      onUnarchive: (id: number) => unarchiveSessionMut.mutate(id),
      onDelete: (id: number) => deleteSessionMut.mutate(id),
    },
    termActions: {
      onSetCurrent: (id: number) => setCurrentTermMut.mutate(id),
      onDeactivate: (id: number) => deactivateTermMut.mutate(id),
      onArchive: (id: number) => archiveTermMut.mutate(id),
      onUnarchive: (id: number) => unarchiveTermMut.mutate(id),
      onDelete: (id: number) => deleteTermMut.mutate(id),
    },
    setCurrentSessionForHistory: (id: number) => setCurrentSessionMut.mutate(id),
    deleteSessionForHistory: (id: number) => deleteSessionMut.mutate(id),
  };
}
