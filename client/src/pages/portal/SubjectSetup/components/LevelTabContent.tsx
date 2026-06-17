import { useMemo, useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SectionCard } from '@/components/ui/section-card';
import { BookOpen, School, Zap } from 'lucide-react';
import type { ClassInfo, Subject, SubjectFilter } from '../types';
import { ClassAccordionItem } from './ClassAccordionItem';
import { SubjectFilterBar } from './SubjectFilterBar';
import { QuickActionsPanel } from './QuickActionsPanel';

interface LevelTabContentProps {
  classes: ClassInfo[];
  levelLabel: string;
  levelColor?: string;
  allSubjects: Subject[];
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  pendingChanges: Map<string, unknown>;
  pendingRemovals: Set<string>;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
  onToggleAll: (classes: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => void;
}

export function LevelTabContent({
  classes,
  levelLabel,
  levelColor = 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
  allSubjects,
  isAssigned,
  pendingChanges,
  pendingRemovals,
  isSaving,
  onToggle,
  onToggleAll,
}: LevelTabContentProps) {
  const [filter, setFilter] = useState<SubjectFilter>({ search: '', categories: [] });

  const filteredSubjects = useMemo(() => {
    let result = allSubjects;
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
    }
    if (filter.categories.length > 0) {
      result = result.filter((s) => filter.categories.includes(s.category));
    }
    return result;
  }, [allSubjects, filter]);

  const generalSubjects = useMemo(() => filteredSubjects.filter((s) => s.category === 'general'), [filteredSubjects]);
  const specialSubjects = useMemo(() => filteredSubjects.filter((s) => s.category !== 'general'), [filteredSubjects]);

  if (classes.length === 0) {
    return (
      <div className="mt-4">
        <Alert>
          <School className="h-4 w-4" />
          <AlertDescription>
            No {levelLabel} classes found. Create classes first in the Class Management section.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <SectionCard
        icon={BookOpen}
        title={`${levelLabel} Subject Assignments`}
        subtitle={`${classes.length} classes`}
        contentClassName="px-4 pb-5 space-y-4 md:px-5"
      >
        {/* Quick assign panel for the whole level */}
        <QuickActionsPanel
          title={`Quick assign — all ${levelLabel} classes`}
          description={`Tick a subject to assign it to every class in ${levelLabel} at once. You can still fine-tune individual classes below.`}
          headerClassName=""
          headerIcon={<Zap className="w-4 h-4" />}
          subjects={allSubjects}
          classes={classes}
          department={null}
          isAssigned={isAssigned}
          onToggleAll={onToggleAll}
          isSaving={isSaving}
        />

        <SubjectFilterBar
          filter={filter}
          onChange={setFilter}
          totalSubjects={allSubjects.length}
          visibleSubjects={filteredSubjects.length}
        />

        <Accordion type="multiple" className="space-y-2">
          {classes.map((cls) => (
            <ClassAccordionItem
              key={cls.id}
              cls={cls}
              department={null}
              generalSubjects={generalSubjects}
              specialSubjects={specialSubjects}
              specialLabel="Other Subjects"
              specialIcon={<BookOpen className="w-4 h-4 text-primary" />}
              levelColor={levelColor}
              isAssigned={isAssigned}
              pendingChanges={pendingChanges}
              pendingRemovals={pendingRemovals}
              isSaving={isSaving}
              onToggle={onToggle}
            />
          ))}
        </Accordion>
      </SectionCard>
    </div>
  );
}
