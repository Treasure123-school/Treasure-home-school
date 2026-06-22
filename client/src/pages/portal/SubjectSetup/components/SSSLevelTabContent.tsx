import { useMemo, useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SectionCard } from '@/components/ui/section-card';
import { Select, SelectTrigger, SelectValue, PortalSelectContent, PortalSelectItem } from '@/components/ui/portal-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Palette, Briefcase, School, Zap } from 'lucide-react';
import type { ClassInfo, Subject, Department, SubjectFilter } from '../types';
import { ClassAccordionItem } from './ClassAccordionItem';
import { SubjectFilterBar } from './SubjectFilterBar';
import { QuickActionsPanel } from './QuickActionsPanel';

const DEPARTMENTS: Department[] = ['science', 'art', 'commercial'];

const DEPT_CONFIG: Record<Department, {
  label: string;
  icon: typeof GraduationCap;
  levelColor: string;
}> = {
  science: {
    label: 'Science',
    icon: GraduationCap,
    levelColor: 'bg-primary/10 dark:bg-primary/5 text-primary dark:text-primary/60',
  },
  art: {
    label: 'Art',
    icon: Palette,
    levelColor: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
  },
  commercial: {
    label: 'Commercial',
    icon: Briefcase,
    levelColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
  },
};

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
    <div className="space-y-4">
      {/* Quick assign for this department — all SS classes */}
      <QuickActionsPanel
        title={`Quick assign — all SSS ${config.label} classes`}
        description={`Tick a subject to assign it to every SSS class at once. Fine-tune individual classes in the accordions below.`}
        headerIcon={<Zap className="w-4 h-4" />}
        subjects={allSubjects}
        classes={classes}
        department={dept}
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

      <Accordion type="single" collapsible className="space-y-2">
        {classes.map((cls) => (
          <ClassAccordionItem
            key={cls.id}
            cls={cls}
            department={dept}
            generalSubjects={generalSubjects}
            specialSubjects={deptSubjects}
            specialLabel={`${config.label} Subjects`}
            specialIcon={
              <Icon className={`w-4 h-4 ${
                dept === 'science' ? 'text-primary' :
                dept === 'art' ? 'text-purple-500' : 'text-amber-500'
              }`} />
            }
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
  const [activeDept, setActiveDept] = useState<string>('science');

  const assignedCountForDept = (dept: Department) => {
    let count = 0;
    classes.forEach((cls) => allSubjects.forEach((s) => { if (isAssigned(cls.id, s.id, dept)) count++; }));
    return count;
  };

  if (classes.length === 0) {
    return (
      <div className="mt-4">
        <Alert>
          <School className="h-4 w-4" />
          <AlertDescription>
            No Senior Secondary classes found. Create classes first in the Class Management section.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <SectionCard
        icon={GraduationCap}
        title="SSS Subject Assignments"
        subtitle={`${classes.length} classes · by department`}
        contentClassName="px-4 pb-5 space-y-4 md:px-5"
      >
        {/* Mobile department selector */}
        <div className="sm:hidden">
          <Select value={activeDept} onValueChange={setActiveDept}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select department…" />
            </SelectTrigger>
            <PortalSelectContent>
              {DEPARTMENTS.map((dept) => {
                const config = DEPT_CONFIG[dept];
                const Icon = config.icon;
                return (
                  <PortalSelectItem
                    key={dept}
                    value={dept}
                    icon={<Icon className="w-4 h-4" />}
                    label={config.label}
                    meta={`${assignedCountForDept(dept)} assigned`}
                  />
                );
              })}
            </PortalSelectContent>
          </Select>
        </div>

        {/* Desktop department tabs */}
        <Tabs value={activeDept} onValueChange={setActiveDept} className="hidden sm:block">
          <TabsList className="grid w-full grid-cols-3 h-11 p-1 rounded-xl">
            {DEPARTMENTS.map((dept) => {
              const config = DEPT_CONFIG[dept];
              const Icon = config.icon;
              return (
                <TabsTrigger key={dept} value={dept} className="flex items-center gap-1.5 rounded-lg text-sm font-medium">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{config.label}</span>
                  <Badge variant="secondary" className="text-xs ml-0.5 px-1.5 shrink-0">
                    {assignedCountForDept(dept)}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Department content — driven by activeDept for both mobile & desktop */}
        {DEPARTMENTS.map((dept) =>
          activeDept === dept ? (
            <DeptTab
              key={dept}
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
          ) : null
        )}
      </SectionCard>
    </div>
  );
}
