import { useQuery } from '@tanstack/react-query';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { queryClient } from '@/lib/queryClient';

export interface CalendarSession {
  id: number;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  description?: string;
  createdAt: string;
}

export interface CalendarTerm {
  id: number;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  isLocked: boolean;
  description?: string;
  sessionId?: number | null;
  createdAt: string;
}

export type TermStatus = 'active' | 'upcoming' | 'completed' | 'archived';
export type SessionStatus = 'active' | 'upcoming' | 'completed' | 'archived';

export interface CalendarState {
  currentSession: CalendarSession | null;
  currentTerm: CalendarTerm | null;
  upcomingTerm: CalendarTerm | null;
  allSessions: CalendarSession[];
  allTerms: CalendarTerm[];
}

const CALENDAR_KEY = ['/api/academic-calendar/current'] as const;

export function useAcademicCalendar() {
  const { data, isLoading, error } = useQuery<CalendarState>({
    queryKey: CALENDAR_KEY,
    staleTime: 30000,
  });

  useSocketIORealtime({
    table: 'academic_terms',
    queryKey: [...CALENDAR_KEY],
  });

  useSocketIORealtime({
    table: 'academic_sessions',
    queryKey: [...CALENDAR_KEY],
  });

  const allSessions = data?.allSessions ?? [];
  // Sort terms chronologically (First Term → Second Term → Third Term) as a safety net
  // in case the server returns them in a different order.
  const allTerms = [...(data?.allTerms ?? [])].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  const termsBySession: Record<number | string, CalendarTerm[]> = {};
  for (const term of allTerms) {
    const key = term.sessionId ?? 'unassigned';
    if (!termsBySession[key]) termsBySession[key] = [];
    termsBySession[key].push(term);
  }

  function getTermStatus(term: CalendarTerm): TermStatus {
    const today = new Date().toISOString().split('T')[0];
    if (term.startDate <= today && term.endDate >= today) return 'active';
    if (term.endDate < today) return 'completed';
    if (term.startDate > today) return 'upcoming';
    return (term.status as TermStatus) ?? 'upcoming';
  }

  function getSessionStatus(session: CalendarSession): SessionStatus {
    const today = new Date().toISOString().split('T')[0];
    if (session.startDate <= today && session.endDate >= today) return 'active';
    if (session.endDate < today) return 'completed';
    if (session.startDate > today) return 'upcoming';
    return (session.status as SessionStatus) ?? 'upcoming';
  }

  function daysUntil(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
    queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
  }

  return {
    currentSession: data?.currentSession ?? null,
    currentTerm: data?.currentTerm ?? null,
    upcomingTerm: data?.upcomingTerm ?? null,
    allSessions,
    allTerms,
    termsBySession,
    isLoading,
    error,
    getTermStatus,
    getSessionStatus,
    daysUntil,
    invalidate,
  };
}
