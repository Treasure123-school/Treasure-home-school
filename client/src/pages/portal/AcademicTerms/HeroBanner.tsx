import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { CalendarSession, CalendarTerm } from '@/hooks/useAcademicCalendar';
import { TrendingUp, Info } from 'lucide-react';
import { fmtDate, termProgress, daysLeft, daysElapsed, totalDays, isCurrentlyActive } from './shared';

interface HeroBannerProps {
  session: CalendarSession | null;
  term: CalendarTerm | null;
  isLoading: boolean;
}

export function HeroBanner({ session, term, isLoading }: HeroBannerProps) {
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
