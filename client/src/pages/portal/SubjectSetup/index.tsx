import { useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import {
  School,
  RefreshCw,
  Save,
  Loader2,
  Wifi,
  WifiOff,
  Info,
  X,
  GraduationCap,
  BookOpen,
  Users,
} from 'lucide-react';

import type { Subject, ClassInfo, SubjectAssignment, ClassGroup } from './types';
import { groupClassesByLevel, isSSLevel } from './utils/classGrouping';
import { useSubjectAssignmentState } from './hooks/useSubjectAssignmentState';
import { LevelTabContent } from './components/LevelTabContent';
import { SSSLevelTabContent } from './components/SSSLevelTabContent';
import { SaveBar } from './components/SaveBar';

const LEVEL_ICONS: Record<string, typeof BookOpen> = {
  primary: BookOpen,
  jss: Users,
  ss: GraduationCap,
  sss: GraduationCap,
};

const LEVEL_COLORS: Record<string, string> = {
  primary: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
  jss: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
  ss: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300',
  sss: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300',
};

export default function SubjectSetup() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [infoDismissed, setInfoDismissed] = useState(() => {
    try { return localStorage.getItem('subject-setup-info-dismissed') === 'true'; } catch { return false; }
  });

  const dismissInfo = () => {
    setInfoDismissed(true);
    try { localStorage.setItem('subject-setup-info-dismissed', 'true'); } catch {}
  };

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
  });

  const { data: classes = [], isLoading: classesLoading } = useQuery<ClassInfo[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),
  });

  const {
    data: currentAssignments = [],
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useQuery<SubjectAssignment[]>({
    queryKey: ['/api/unified-subject-assignments'],
    queryFn: async () => (await apiRequest('GET', '/api/unified-subject-assignments')).json(),
  });

  const handleRealtimeEvent = useCallback(
    (event: any) => {
      if (event.eventType === 'subject-assignments-updated' || event.type === 'subject-assignments-updated') {
        refetchAssignments();
      }
    },
    [refetchAssignments]
  );

  const { isConnected } = useSocketIORealtime({
    queryKey: ['/api/unified-subject-assignments'],
    enabled: true,
    onEvent: handleRealtimeEvent,
  });

  // Derive SS class IDs for department-aware logic
  const ssClassIds = useMemo(
    () => new Set(classes.filter((c) => isSSLevel(c.level)).map((c) => c.id)),
    [classes]
  );

  const state = useSubjectAssignmentState({ currentAssignments, ssClassIds });

  // Group classes dynamically by level
  const classGroups: ClassGroup[] = useMemo(() => groupClassesByLevel(classes), [classes]);

  // Active subjects only
  const activeSubjects = useMemo(() => subjects.filter((s) => s.isActive), [subjects]);

  const handleToggle = useCallback(
    (classId: number, subjectId: number, department: string | null, checked: boolean) => {
      state.toggle(classId, subjectId, department, checked);
    },
    [state]
  );

  const handleToggleAll = useCallback(
    (cls: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => {
      state.toggleAllForClasses(cls, subjectId, department, checked);
    },
    [state]
  );

  const handleSave = async () => {
    if (!state.hasPendingChanges) return;
    setIsSaving(true);
    try {
      const { additions, removals } = state.getSerialised();
      const response = await apiRequest('PUT', '/api/unified-subject-assignments', { additions, removals });
      const result = response.ok ? await response.json() : null;

      const parts: string[] = [];
      if (result?.reportCardItemsAdded > 0) parts.push(`${result.reportCardItemsAdded} subject row${result.reportCardItemsAdded !== 1 ? 's' : ''} added to report cards`);
      if (result?.reportCardItemsRemoved > 0) parts.push(`${result.reportCardItemsRemoved} empty row${result.reportCardItemsRemoved !== 1 ? 's' : ''} removed from report cards`);

      toast({
        title: 'Changes saved',
        description: `${additions.length} assigned, ${removals.length} unassigned.${parts.length > 0 ? ` ${parts.join('; ')}.` : ''}`,
      });

      state.reset();
      await queryClient.invalidateQueries({ queryKey: ['/api/unified-subject-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/class-subject-mappings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      await refetchAssignments();
    } catch (error: any) {
      toast({
        title: 'Error saving changes',
        description: error.message || 'Failed to save subject assignments',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    state.reset();
    toast({ title: 'Changes discarded', description: 'All pending changes have been reverted.' });
  };

  const isLoading = subjectsLoading || classesLoading || assignmentsLoading;

  // Default active tab = first group's level
  const [activeTab, setActiveTab] = useState<string>('');
  const resolvedTab = activeTab || classGroups[0]?.level || '';

  const getTabIcon = (level: string) => {
    const Icon = LEVEL_ICONS[level.toLowerCase()] ?? BookOpen;
    return <Icon className="w-4 h-4" />;
  };

  const getAssignedCountForGroup = (group: ClassGroup): number => {
    let count = 0;
    group.classes.forEach((cls) => {
      activeSubjects.forEach((s) => {
        const dept = isSSLevel(group.level) ? null : null;
        if (state.isAssigned(cls.id, s.id, dept)) count++;
      });
    });
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shadow-sm">
            <School className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Subject Setup</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Assign subjects to each class individually — every class can have a different subject set.
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <Wifi className="w-3 h-3" />
                  Live sync active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAssignments()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {state.hasPendingChanges && (
            <>
              <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 shadow-sm">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                    <Badge variant="secondary" className="text-xs ml-0.5">
                      {state.pendingCount}
                    </Badge>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {!infoDismissed && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">How this page works</p>
            <p className="text-sm text-primary/80 mt-0.5">
              Use this page to control exactly which subjects appear for each class. You can assign Basic Science to JSS 1 without assigning it to JSS 2.
              Changes affect report cards, exams, student portals, and teacher assignments — all at once.
            </p>
          </div>
          <button
            onClick={dismissInfo}
            aria-label="Dismiss"
            className="flex-shrink-0 mt-0.5 p-1 rounded-lg text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : classGroups.length === 0 ? (
        <Alert>
          <School className="h-4 w-4" />
          <AlertTitle>No classes found</AlertTitle>
          <AlertDescription>
            Create classes first in the Class Management section before assigning subjects.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs value={resolvedTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full h-12 p-1 rounded-xl`} style={{ gridTemplateColumns: `repeat(${classGroups.length}, 1fr)` }}>
            {classGroups.map((group) => (
              <TabsTrigger
                key={group.level}
                value={group.level}
                className="flex items-center gap-2 rounded-lg text-sm font-medium"
              >
                {getTabIcon(group.level)}
                <span className="hidden sm:inline">{group.label}</span>
                <span className="sm:hidden">{group.label.split(' ')[0]}</span>
                <Badge variant="secondary" className="text-xs ml-0.5">
                  {group.classes.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {classGroups.map((group) =>
            isSSLevel(group.level) ? (
              <TabsContent key={group.level} value={group.level}>
                <SSSLevelTabContent
                  classes={group.classes}
                  allSubjects={activeSubjects}
                  isAssigned={state.isAssigned}
                  pendingChanges={state.pendingChanges}
                  pendingRemovals={state.pendingRemovals}
                  isSaving={isSaving}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                />
              </TabsContent>
            ) : (
              <TabsContent key={group.level} value={group.level}>
                <LevelTabContent
                  classes={group.classes}
                  levelLabel={group.label}
                  levelColor={LEVEL_COLORS[group.level.toLowerCase()] ?? LEVEL_COLORS.jss}
                  allSubjects={activeSubjects}
                  isAssigned={state.isAssigned}
                  pendingChanges={state.pendingChanges}
                  pendingRemovals={state.pendingRemovals}
                  isSaving={isSaving}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                />
              </TabsContent>
            )
          )}
        </Tabs>
      )}

      {/* Floating Save Bar */}
      {state.hasPendingChanges && (
        <SaveBar
          pendingCount={state.pendingCount}
          isSaving={isSaving}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}
