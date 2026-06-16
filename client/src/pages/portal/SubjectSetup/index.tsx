import { useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  School,
  Save,
  Loader2,
  BookOpen,
  BookMarked,
  Info,
} from 'lucide-react';

import type { Subject, ClassInfo, SubjectAssignment, ClassGroup } from './types';
import { groupClassesByLevel, isSSLevel } from './utils/classGrouping';
import { useSubjectAssignmentState } from './hooks/useSubjectAssignmentState';
import { LevelSwitcher } from './components/LevelSwitcher';
import { LevelTabContent } from './components/LevelTabContent';
import { SSSLevelTabContent } from './components/SSSLevelTabContent';
import { SaveBar } from './components/SaveBar';

const LEVEL_COLORS: Record<string, string> = {
  primary: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
  jss: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
  ss: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300',
  sss: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300',
};

export default function SubjectSetup() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeLevel, setActiveLevel] = useState<string>('');

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

  const ssClassIds = useMemo(
    () => new Set(classes.filter((c) => isSSLevel(c.level)).map((c) => c.id)),
    [classes]
  );

  const state = useSubjectAssignmentState({ currentAssignments, ssClassIds });

  const classGroups: ClassGroup[] = useMemo(() => groupClassesByLevel(classes), [classes]);
  const activeSubjects = useMemo(() => subjects.filter((s) => s.isActive), [subjects]);

  const resolvedLevel = activeLevel || classGroups[0]?.level || '';

  const totalAssignments = useMemo(() => currentAssignments.length, [currentAssignments]);

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
      if (result?.reportCardItemsAdded > 0)
        parts.push(`${result.reportCardItemsAdded} row${result.reportCardItemsAdded !== 1 ? 's' : ''} added to report cards`);
      if (result?.reportCardItemsRemoved > 0)
        parts.push(`${result.reportCardItemsRemoved} empty row${result.reportCardItemsRemoved !== 1 ? 's' : ''} removed`);

      toast({
        title: 'Changes saved',
        description: `${additions.length} assigned, ${removals.length} unassigned.${parts.length ? ` ${parts.join('; ')}.` : ''}`,
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

  const renderLevelContent = (group: ClassGroup) =>
    isSSLevel(group.level) ? (
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
    ) : (
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
    );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <School className="h-6 w-6 text-primary shrink-0" />
            Subject Setup
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="How this page works"
                  className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Info className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="max-w-xs text-sm">
                <p className="font-semibold mb-1">How this page works</p>
                <p className="text-muted-foreground leading-relaxed">
                  Control exactly which subjects appear for each class — you can assign Basic Science to
                  JSS 1 without assigning it to JSS 2. Changes affect report cards, exams, student
                  portals, and teacher assignments all at once.
                </p>
              </PopoverContent>
            </Popover>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign subjects to each class individually — every class can have a different set.
          </p>
        </div>
        {state.hasPendingChanges && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5 shadow-sm">
              {isSaving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save
                  <Badge variant="secondary" className="text-xs ml-0.5">
                    {state.pendingCount}
                  </Badge>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : (
        <StatCardGrid cols={4}>
          <StatCard
            label="Total Classes"
            value={classes.length}
            icon={School}
            color="text-primary"
          />
          <StatCard
            label="Active Subjects"
            value={activeSubjects.length}
            icon={BookOpen}
            color="text-emerald-600"
          />
          <StatCard
            label="Assignments"
            value={totalAssignments}
            icon={BookMarked}
            color="text-indigo-600"
          />
          <StatCard
            label="Pending Changes"
            value={state.pendingCount}
            icon={Save}
            color={state.pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}
          />
        </StatCardGrid>
      )}

      {/* ── Main Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
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
        <div className="space-y-0">
          <LevelSwitcher
            groups={classGroups}
            value={resolvedLevel}
            onChange={setActiveLevel}
          />
          {classGroups.map((group) =>
            resolvedLevel === group.level ? (
              <div key={group.level}>
                {renderLevelContent(group)}
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── Floating Save Bar ──────────────────────────────────────────── */}
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
