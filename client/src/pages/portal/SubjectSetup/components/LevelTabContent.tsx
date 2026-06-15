import { useMemo, useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, BookMarked } from 'lucide-react';
import type { ClassInfo, Subject, SubjectFilter } from '../types';
import { ClassAccordionItem } from './ClassAccordionItem';
import { QuickActionsPanel } from './QuickActionsPanel';
import { SubjectFilterBar } from './SubjectFilterBar';

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
      <Card className="border shadow-sm">
        <CardContent className="pt-10 pb-10 text-center text-muted-foreground text-sm">
          No {levelLabel} classes found. Create classes first in the Class Management section.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base">{levelLabel} Subject Assignments</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Assign subjects individually per class — each class can have a different set.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Filter bar */}
          <SubjectFilterBar
            filter={filter}
            onChange={setFilter}
            totalSubjects={allSubjects.length}
            visibleSubjects={filteredSubjects.length}
          />

          {/* Quick Actions */}
          <QuickActionsPanel
            title={`Quick Actions — ${levelLabel}`}
            description="Toggle a subject to assign or unassign it across multiple classes at once. Use year-group toggles for finer control."
            headerIcon={<BookMarked className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
            subjects={filteredSubjects}
            classes={classes}
            department={null}
            isAssigned={isAssigned}
            onToggleAll={onToggleAll}
            isSaving={isSaving}
          />

          {/* Per-class Accordions — collapsed by default */}
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
        </CardContent>
      </Card>
    </div>
  );
}
