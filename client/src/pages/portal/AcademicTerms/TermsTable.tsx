import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { CalendarTerm, TermStatus } from '@/hooks/useAcademicCalendar';
import { Progress } from '@/components/ui/progress';
import { MoreVertical, Lock } from 'lucide-react';
import { StatusBadge, fmtDate, termProgress, daysLeft } from './shared';
import { TermActionsMenu, type TermActions } from './TermActionsMenu';

interface TermsTableProps {
  terms: CalendarTerm[];
  getStatus: (t: CalendarTerm) => TermStatus;
  actions: TermActions;
}

export function TermsTable({ terms, getStatus, actions }: TermsTableProps) {
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
              <th className="text-right py-2.5 font-semibold w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {terms.map(t => {
              const status = getStatus(t);
              const active = status === 'active';
              const pct = active ? termProgress(t.startDate, t.endDate) : 0;
              const isArchived = status === 'archived';
              return (
                <tr key={t.id} data-testid={`term-row-${t.id}`}
                  className={`hover:bg-muted/30 transition-colors ${t.isCurrent ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''} ${isArchived ? 'opacity-60' : ''}`}>
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
                  <td className="py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`btn-term-menu-${t.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <TermActionsMenu t={t} status={status} actions={actions} testSuffix="desk" />
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
      <div className="md:hidden space-y-2">
        {terms.map(t => {
          const status = getStatus(t);
          const active = status === 'active';
          const pct = active ? termProgress(t.startDate, t.endDate) : 0;
          const isArchived = status === 'archived';
          return (
            <div key={t.id} data-testid={`term-card-${t.id}`}
              className={`rounded-xl border-2 overflow-hidden ${t.isCurrent ? 'border-emerald-300 dark:border-emerald-800' : 'border-border'} ${isArchived ? 'opacity-60' : ''}`}>
              <div className={`flex items-center gap-2 px-3.5 py-3 ${t.isCurrent ? 'bg-emerald-50/70 dark:bg-emerald-900/15' : 'bg-muted/30'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{t.name}</span>
                    {t.isCurrent && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 py-0 px-1.5">Current</Badge>}
                    {t.isLocked && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium"><Lock className="h-3 w-3" />Locked</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.year}</p>
                </div>
                <StatusBadge status={status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`btn-term-menu-mobile-${t.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <TermActionsMenu t={t} status={status} actions={actions} testSuffix="mob" />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="px-3.5 py-3 bg-card space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Start</p><p className="font-medium">{fmtDate(t.startDate)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">End</p><p className="font-medium">{fmtDate(t.endDate)}</p></div>
                </div>
                {active && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{pct}% complete</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{daysLeft(t.endDate)}d left</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
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
