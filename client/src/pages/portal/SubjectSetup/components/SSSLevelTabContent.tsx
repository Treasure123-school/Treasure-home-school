import { useMemo, useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Palette, Briefcase, BookMarked } from 'lucide-react';
import type { ClassInfo, Subject, Department, SubjectFilter } from '../types';
import { ClassAccordionItem } from './ClassAccordionItem';
import { QuickActionsPanel } from './QuickActionsPanel';
import { SubjectFilterBar } from './SubjectFilterBar';

const DEPARTMENTS: Department[] = ['science', 'art', 'commercial'];

const DEPT_CONFIG: Record<Department, {
  label: string;
  icon: typeof GraduationCap;
  color: string;
  levelColor: string;
  headerBg: string;
  borderColor: string;
}> = {
  science: {
    label: 'Science',
    icon: GraduationCap,
    color: 'bg-primary/85',
    levelColor: 'bg-primary/10 dark:bg-primary/5 text-primary dark:text-primary/60',
    headerBg: 'bg-primary/5 dark:bg-primary/5 border-primary/30 dark:border-primary/30',
    borderColor: 'border-primary/30 dark:border-primary/30',
  },
  art: {
    label: 'Art',
    icon: Palette,
    color: 'bg-purple-500',
    levelColor: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
    headerBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  commercial: {
    label: 'Commercial',
    icon: Briefcase,
    color: 'bg-amber-500',
    levelColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
    headerBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
};

interface SSSLevelTabContentProps {
  classes: ClassInfo[];
  allSubjects: Subject[];
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  pendingChanges: Map<string, unknown>;
  pendingRemovals: Set<string>;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
  onToggleAll: (classes: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => void;
}

interface DeptTabProps {
  dept: Department;
  classes: ClassInfo[];
  allSubjects: Subject[];
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  pendingChanges: Map<string, unknown>;
  pendingRemovals: Set<string>;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
  onToggleAll: (classes: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => void;
}

function DeptTab({ dept, classes, allSubjects, isAssigned, pendingChanges, pendingRemovals, isSaving, onToggle, onToggleAll }: DeptTabProps) {
  const config = DEPT_CONFIG[dept];
  const Icon = config.icon;

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
  const deptSubjects = useMemo(() => filteredSubjects.filter((s) => s.category === dept), [filteredSubjects, dept]);

  return (
    <div className="space-y-4 mt-0">
      <SubjectFilterBar
        filter={filter}
        onChange={setFilter}
        totalSubjects={allSubjects.length}
        visibleSubjects={filteredSubjects.length}
      />

      <QuickActionsPanel
        title={`Quick Actions — All SSS Classes (${config.label})`}
        description={`Toggle a subject to assign or unassign it across all SSS ${config.label} classes at once. Use year-group toggles for finer control.`}
        headerClassName={config.headerBg}
        headerIcon={<Icon className="w-4 h-4" />}
        subjects={filteredSubjects}
        classes={classes}
        department={dept}
        isAssigned={isAssigned}
        onToggleAll={onToggleAll}
        isSaving={isSaving}
      />

      <Accordion type="multiple" className="space-y-2">
        {classes.map((cls) => (
          <ClassAccordionItem
            key={cls.id}
            cls={cls}
            department={dept}
            generalSubjects={generalSubjects}
            specialSubjects={deptSubjects}
            specialLabel={`${config.label} Subjects`}
            specialIcon={<Icon className={`w-4 h-4 ${dept === 'science' ? 'text-primary' : dept === 'art' ? 'text-purple-500' : 'text-amber-500'}`} />}
            levelColor={config.levelColor}
            isAssigned={isAssigned}
            pendingChanges={pendingChanges}
            pendingRemovals={pendingRemovals}
            isSaving={isSaving}
            onToggle={onToggle}
          />
        ))}
      </Accordion>
    </div>
  );
}

export function SSSLevelTabContent({
  classes,
  allSubjects,
  isAssigned,
  pendingChanges,
  pendingRemovals,
  isSaving,
  onToggle,
  onToggleAll,
}: SSSLevelTabContentProps) {
  const assignedCountForDept = (dept: Department) => {
    let count = 0;
    classes.forEach((cls) => {
      allSubjects.forEach((s) => {
        if (isAssigned(cls.id, s.id, dept)) count++;
      });
    });
    return count;
  };

  if (classes.length === 0) {
    return (
      <div className="mt-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground text-sm">
            No Senior Secondary classes found. Create classes first in the Class Management section.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">SSS Subject Assignments by Department</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                SSS students see subjects based on their department — Science, Art, or Commercial.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <Tabs defaultValue="science">
            <TabsList className="flex w-full h-11 p-1 rounded-xl mb-5">
              {DEPARTMENTS.map((dept) => {
                const config = DEPT_CONFIG[dept];
                const Icon = config.icon;
                return (
                  <TabsTrigger
                    key={dept}
                    value={dept}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg text-sm font-medium"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{config.label}</span>
                    <Badge variant="secondary" className="text-xs ml-0.5">
                      {assignedCountForDept(dept)}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {DEPARTMENTS.map((dept) => (
              <TabsContent key={dept} value={dept}>
                <DeptTab
                  dept={dept}
                  classes={classes}
                  allSubjects={allSubjects}
                  isAssigned={isAssigned}
                  pendingChanges={pendingChanges}
                  pendingRemovals={pendingRemovals}
                  isSaving={isSaving}
                  onToggle={onToggle}
                  onToggleAll={onToggleAll}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
