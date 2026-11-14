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

function useCalMut(
  description: string,
  fn: (id: number) => Promise<any>,
  errorTitle = 'Error',
  optimisticUpdate?: (id: number, oldData: any) => any
) {
  const { toast } = useToast();
  const CALENDAR_KEY = ['/api/academic-calendar/current'];

  return {
    mut: useMutation({
      mutationFn: fn,
      // Apply optimistic update immediately (before server responds)
      onMutate: async (id: number) => {
        if (!optimisticUpdate) return;
        
        // Cancel outgoing refetches so they don't overwrite optimistic update
        await queryClient.cancelQueries({ queryKey: CALENDAR_KEY });
        
        // Snapshot current data for rollback
        const prev = queryClient.getQueryData(CALENDAR_KEY);
        
        // Optimistically update cache
        if (prev && optimisticUpdate) {
          queryClient.setQueryData(CALENDAR_KEY, optimisticUpdate(id, prev));
        }
        
        return { prev };
      },
      onSuccess: () => {
        toast({ title: 'Success', description });
        // SocketIO will handle the refetch when server emits table_change event
        // No manual refetch needed - prevents double refetch and flickering
      },
      onError: (e: any, _id, context: any) => {
        // Rollback optimistic update on error
        if (context?.prev) {
          queryClient.setQueryData(CALENDAR_KEY, context.prev);
        }
        toast({ title: errorTitle, description: e.message || 'Operation failed.', variant: 'destructive' });
      },
      // SocketIO handles refetching - no manual invalidation needed
      // This prevents race conditions and flickering from multiple refetches
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
  const { mut: setCurrentSessionMut } = useCalMut(
    'Session set as current.',
    id => call('PUT', `/api/sessions/${id}/mark-current`),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      currentSession: oldData.allSessions?.find((s: any) => s.id === id) ?? oldData.currentSession,
      allSessions: oldData.allSessions?.map((s: any) => ({ ...s, isCurrent: s.id === id })) ?? oldData.allSessions,
    })
  );

  const { mut: deactivateSessionMut } = useCalMut(
    'Session deactivated.',
    id => call('PUT', `/api/sessions/${id}/deactivate`),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      currentSession: oldData.currentSession?.id === id ? null : oldData.currentSession,
      allSessions: oldData.allSessions?.map((s: any) => s.id === id ? { ...s, isCurrent: false, status: 'inactive' } : s) ?? oldData.allSessions,
    })
  );

  const { mut: archiveSessionMut } = useCalMut(
    'Session archived.',
    id => call('PUT', `/api/sessions/${id}`, { status: 'archived' }),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      allSessions: oldData.allSessions?.map((s: any) => s.id === id ? { ...s, status: 'archived', isCurrent: false } : s) ?? oldData.allSessions,
    })
  );

  const { mut: unarchiveSessionMut } = useCalMut(
    'Session restored.',
    id => call('PUT', `/api/sessions/${id}`, { status: 'upcoming' }),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      allSessions: oldData.allSessions?.map((s: any) => s.id === id ? { ...s, status: 'upcoming' } : s) ?? oldData.allSessions,
    })
  );

  const { mut: deleteSessionMut } = useCalMut(
    'Session deleted.',
    id => call('DELETE', `/api/sessions/${id}`),
    'Cannot Delete',
    (id, oldData: any) => ({
      ...oldData,
      allSessions: oldData.allSessions?.filter((s: any) => s.id !== id) ?? oldData.allSessions,
    })
  );

  // ── Term mutations ──────────────────────────────────────────────────────────
  const { mut: setCurrentTermMut } = useCalMut(
    'Term set as current.',
    id => call('PUT', `/api/terms/${id}/mark-current`),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      currentTerm: oldData.allTerms?.find((t: any) => t.id === id) ?? oldData.currentTerm,
      allTerms: oldData.allTerms?.map((t: any) => ({ ...t, isCurrent: t.id === id })) ?? oldData.allTerms,
    })
  );

  const { mut: deactivateTermMut } = useCalMut(
    'Term deactivated.',
    id => call('PUT', `/api/terms/${id}/deactivate`),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      currentTerm: oldData.currentTerm?.id === id ? null : oldData.currentTerm,
      allTerms: oldData.allTerms?.map((t: any) => t.id === id ? { ...t, isCurrent: false, status: 'inactive' } : t) ?? oldData.allTerms,
    })
  );

  const { mut: archiveTermMut } = useCalMut(
    'Term archived.',
    id => call('PUT', `/api/terms/${id}/status`, { status: 'archived' }),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      allTerms: oldData.allTerms?.map((t: any) => t.id === id ? { ...t, status: 'archived', isCurrent: false } : t) ?? oldData.allTerms,
    })
  );

  const { mut: unarchiveTermMut } = useCalMut(
    'Term restored.',
    id => call('PUT', `/api/terms/${id}/status`, { status: 'upcoming' }),
    'Error',
    (id, oldData: any) => ({
      ...oldData,
      allTerms: oldData.allTerms?.map((t: any) => t.id === id ? { ...t, status: 'upcoming' } : t) ?? oldData.allTerms,
    })
  );

  const { mut: deleteTermMut } = useCalMut(
    'Term deleted.',
    id => call('DELETE', `/api/terms/${id}`),
    'Cannot Delete',
    (id, oldData: any) => ({
      ...oldData,
      allTerms: oldData.allTerms?.filter((t: any) => t.id !== id) ?? oldData.allTerms,
    })
  );

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
