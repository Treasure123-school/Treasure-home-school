import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import type { CalendarSession, CalendarTerm } from '@/hooks/useAcademicCalendar';
import {
  Plus, Calendar, GraduationCap, AlertTriangle,
  ChevronRight, Layers, Play, CalendarDays, Info,
  TrendingUp, Target, Zap,
} from 'lucide-react';
import { HeroBanner } from './HeroBanner';
import { StatCard } from './StatCard';
import { AutomationBanner } from './AutomationBanner';
import { SessionsTable } from './SessionsTable';
import { TermsTable } from './TermsTable';
import { SessionHistory } from './SessionHistory';
import { SessionDialog } from './SessionDialog';
import { TermDialog } from './TermDialog';
import { useTermSessionActions } from './useTermSessionActions';
import { fmtShort } from './shared';

export default function AcademicTermsManagement() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;

  const {
    calendar, autoDetect, autoDetectMut,
    showHistory, setShowHistory, sessionActions, termActions,
    setCurrentSessionForHistory, deleteSessionForHistory,
  } = useTermSessionActions(isAdmin);

  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; editing: CalendarSession | null }>({ open: false, editing: null });
  const [termDialog, setTermDialog] = useState<{ open: boolean; editing: CalendarTerm | null }>({ open: false, editing: null });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const { currentSession, currentTerm, upcomingTerm, allSessions, allTerms, isLoading } = calendar;
  const daysToNext = upcomingTerm ? calendar.daysUntil(upcomingTerm.startDate) : null;
  const activeTermCount = allTerms.filter(t => calendar.getTermStatus(t) === 'active').length;
  const multipleActiveTerms = activeTermCount > 1;
  const multipleActiveSessions = allSessions.filter(s => s.isCurrent).length > 1;

  const activeSessions = allSessions.filter(s => {
    const st = calendar.getSessionStatus(s);
    return st === 'active' || st === 'upcoming';
  });
  const historySessions = allSessions.filter(s => {
    const st = calendar.getSessionStatus(s);
    return st === 'completed' || st === 'archived';
  });

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
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setTermDialog({ open: true, editing: null })} data-testid="btn-new-term">
              <Plus className="h-4 w-4 mr-1" /> New Term
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setSessionDialog({ open: true, editing: null })} data-testid="btn-new-session">
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Button>
          </div>
        )}
      </div>

      <HeroBanner session={currentSession} term={currentTerm} isLoading={isLoading} />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : <>
          <StatCard icon={Play} label="Active Term" value={currentTerm?.name ?? '—'} sub={currentTerm ? `Ends ${fmtShort(currentTerm.endDate)}` : undefined} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
          <StatCard icon={Layers} label="Session" value={currentSession?.year ?? (currentYear ?? '—')} sub={currentSession ? currentSession.name : currentYear ? 'No session linked' : undefined} color="bg-primary/10 text-primary" />
          <StatCard icon={ChevronRight} label="Next Term" value={upcomingTerm?.name ?? (allTerms.length > 0 ? 'None yet' : '—')} sub={upcomingTerm ? (daysToNext !== null && daysToNext >= 0 ? `in ${daysToNext}d` : fmtShort(upcomingTerm.startDate)) : (allTerms.length > 0 ? 'Add a future term' : undefined)} color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
          <StatCard icon={CalendarDays} label="Term/Yr Start" value={currentSession ? fmtShort(currentSession.startDate) : (fallbackSessionStart ? fmtShort(fallbackSessionStart) : '—')} sub={currentSession ? undefined : (fallbackSessionStart ? currentYear ?? undefined : undefined)} color="bg-primary/10 dark:bg-primary/5 text-primary dark:text-primary/70" />
          <StatCard icon={Target} label="Term/Yr End" value={currentSession ? fmtShort(currentSession.endDate) : (fallbackSessionEnd ? fmtShort(fallbackSessionEnd) : '—')} sub={currentSession ? undefined : (fallbackSessionEnd ? currentYear ?? undefined : undefined)} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" />
          <StatCard icon={Zap} label="Records" value={`${allSessions.length}S · ${allTerms.length}T`} sub={`${allSessions.length} session${allSessions.length !== 1 ? 's' : ''}, ${allTerms.length} term${allTerms.length !== 1 ? 's' : ''}`} color="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400" />
        </>}
      </div>

      <AutomationBanner
        enabled={autoDetect}
        isAdmin={isAdmin}
        isPending={autoDetectMut.isPending}
        onToggle={v => autoDetectMut.mutate(v)}
      />

      {/* ── Validation Warnings ── */}
      {!isLoading && multipleActiveTerms && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-sm" data-testid="warning-multiple-active-terms">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Multiple active terms detected ({activeTermCount})</p>
            <p className="text-xs text-muted-foreground mt-0.5">Only one term should be active at a time. Use <strong>Deactivate</strong> on the extra terms, or use <strong>Set as Current</strong> on the correct term to automatically clear the others.</p>
          </div>
        </div>
      )}
      {!isLoading && multipleActiveSessions && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-sm" data-testid="warning-multiple-active-sessions">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Multiple active sessions detected</p>
            <p className="text-xs text-muted-foreground mt-0.5">Only one session should be marked as current. Use <strong>Deactivate</strong> on the extra sessions.</p>
          </div>
        </div>
      )}
      {!isLoading && !autoDetect && isAdmin && !currentSession && !currentTerm && allSessions.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5 text-sm" data-testid="info-manual-mode-no-active">
          <Info className="h-4 w-4 text-primary dark:text-primary/70 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary dark:text-primary/60">Manual mode — no active session or term</p>
            <p className="text-xs text-primary dark:text-primary/70 mt-0.5">Use <strong>Set as Current</strong> on a session and term below to activate them for the portal.</p>
          </div>
        </div>
      )}

      {/* ── Sessions ── */}
      <Card>
        <CardHeader className="pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-primary" /> Academic Sessions
              <Badge variant="secondary" className="ml-1">{allSessions.length}</Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">School years that group your terms — create, activate, archive, and delete sessions</CardDescription>
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
              termsBySession={calendar.termsBySession}
              getStatus={calendar.getSessionStatus}
              getTermStatus={calendar.getTermStatus}
              actions={{ ...sessionActions, onEdit: s => setSessionDialog({ open: true, editing: s }) }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Terms ── */}
      <Card>
        <CardHeader className="pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold flex-wrap">
              <Calendar className="h-4 w-4 text-primary" /> Academic Terms
              <Badge variant="secondary" className="ml-1">{allTerms.length}</Badge>
              {activeTermCount > 0 && <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 py-0">{activeTermCount} active</Badge>}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Manage terms within sessions — activate, lock, archive, and track progress</CardDescription>
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
                    <TermsTable terms={sessionTerms} getStatus={calendar.getTermStatus} actions={{ ...termActions, onEdit: t => setTermDialog({ open: true, editing: t }) }} />
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
                  <TermsTable terms={calendar.termsBySession['unassigned']} getStatus={calendar.getTermStatus} actions={{ ...termActions, onEdit: t => setTermDialog({ open: true, editing: t }) }} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Session History ── */}
      <SessionHistory
        historySessions={historySessions}
        allTerms={allTerms}
        isAdmin={isAdmin}
        showHistory={showHistory}
        onToggle={() => setShowHistory(v => !v)}
        onReactivate={setCurrentSessionForHistory}
        onEdit={s => setSessionDialog({ open: true, editing: s })}
        onDelete={deleteSessionForHistory}
      />

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
