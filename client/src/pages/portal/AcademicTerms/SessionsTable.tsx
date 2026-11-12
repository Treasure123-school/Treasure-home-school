import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { CalendarSession, CalendarTerm, TermStatus } from '@/hooks/useAcademicCalendar';
import { MoreVertical } from 'lucide-react';
import { StatusBadge, fmtDate } from './shared';
import { SessionActionsMenu, type SessionActions } from './SessionActionsMenu';

interface SessionsTableProps {
  sessions: CalendarSession[];
  termsBySession: Record<number | string, CalendarTerm[]>;
  getStatus: (s: CalendarSession) => string;
  getTermStatus: (t: CalendarTerm) => TermStatus;
  actions: SessionActions;
}

export function SessionsTable({ sessions, termsBySession, getStatus, getTermStatus, actions }: SessionsTableProps) {
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
              <th className="text-right py-2.5 font-semibold w-10">Actions</th>
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
                  <td className="py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-session-menu-${s.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <SessionActionsMenu s={s} status={status} actions={actions} testSuffix="desk" />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
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
              className={`rounded-xl border-2 overflow-hidden ${s.isCurrent ? 'border-primary/40' : 'border-border'} ${isArchived ? 'opacity-70' : ''}`}>
              <div className={`flex items-center gap-2 px-4 py-3 ${s.isCurrent ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{s.name}</span>
                    {s.isCurrent && <Badge className="text-[10px] bg-primary hover:bg-primary py-0 px-1.5">Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.year}</p>
                </div>
                <StatusBadge status={status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`btn-session-menu-mobile-${s.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <SessionActionsMenu s={s} status={status} actions={actions} testSuffix="mob" />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="px-4 py-3 bg-card space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Start</p><p className="font-medium">{fmtDate(s.startDate)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">End</p><p className="font-medium">{fmtDate(s.endDate)}</p></div>
                </div>
                {sessionTerms.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {sessionTerms.map((t, i) => {
                      const ts = getTermStatus(t);
                      return (
                        <div key={t.id} className="flex items-center gap-1">
                          {i > 0 && <div className="w-2 h-px bg-border" />}
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                            ts === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                            : ts === 'completed' || ts === 'archived' ? 'bg-muted border-border text-muted-foreground'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                          }`}>{t.name.replace(' Term', '')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
