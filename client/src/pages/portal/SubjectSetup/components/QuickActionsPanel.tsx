import { useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ClassInfo, Subject } from '../types';
import { getClassYearGroups } from '../utils/classGrouping';

interface SubjectPillProps {
  subject: Subject;
  classes: ClassInfo[];
  department: string | null;
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  onToggleAll: (classes: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => void;
  isSaving: boolean;
  label?: string;
}

function SubjectPill({ subject, classes, department, isAssigned, onToggleAll, isSaving, label }: SubjectPillProps) {
  const allAssigned = classes.length > 0 && classes.every((c) => isAssigned(c.id, subject.id, department));
  const someAssigned = classes.some((c) => isAssigned(c.id, subject.id, department));
  const isIndeterminate = !allAssigned && someAssigned;

  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm select-none
        ${allAssigned
          ? 'bg-primary/10 border-primary/30 text-primary font-medium'
          : isIndeterminate
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
        }
        ${isSaving ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <Checkbox
        checked={allAssigned ? true : isIndeterminate ? 'indeterminate' : false}
        onCheckedChange={(checked) => {
          if (checked === 'indeterminate') return;
          onToggleAll(classes, subject.id, department, !!checked);
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={isSaving}
      />
      {label ?? subject.name}
    </label>
  );
}

interface QuickActionsPanelProps {
  title: string;
  description: string;
  headerClassName?: string;
  headerIcon: ReactNode;
  subjects: Subject[];
  classes: ClassInfo[];
  department?: string | null;
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  onToggleAll: (classes: ClassInfo[], subjectId: number, department: string | null, checked: boolean) => void;
  isSaving: boolean;
}

export function QuickActionsPanel({
  title,
  description,
  headerClassName = '',
  headerIcon,
  subjects,
  classes,
  department = null,
  isAssigned,
  onToggleAll,
  isSaving,
}: QuickActionsPanelProps) {
  const [open, setOpen] = useState(false);
  const yearGroups = getClassYearGroups(classes);
  const hasMultipleYearGroups = yearGroups.size > 1;

  const assignedAll = subjects.length > 0 && classes.length > 0 &&
    subjects.every((s) => classes.every((c) => isAssigned(c.id, s.id, department)));
  const assignedSome = subjects.some((s) => classes.some((c) => isAssigned(c.id, s.id, department)));
  const summary = assignedAll
    ? 'All subjects assigned to all classes'
    : assignedSome
      ? 'Some subjects assigned'
      : 'No subjects assigned yet';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors text-left ${headerClassName}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 text-muted-foreground">{headerIcon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
            </div>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          }
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-xl border border-border bg-background p-4 space-y-4">
          <p className="text-xs text-muted-foreground">{description}</p>

          {/* Assign to ALL classes in this level */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Assign to all classes
            </p>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <SubjectPill
                  key={subject.id}
                  subject={subject}
                  classes={classes}
                  department={department}
                  isAssigned={isAssigned}
                  onToggleAll={onToggleAll}
                  isSaving={isSaving}
                />
              ))}
            </div>
          </div>

          {/* Assign by year group */}
          {hasMultipleYearGroups && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Assign by year group
              </p>
              <div className="space-y-3">
                {Array.from(yearGroups.entries()).map(([yearGroup, yearClasses]) => (
                  <div key={yearGroup}>
                    <p className="text-xs text-muted-foreground font-medium mb-1.5">{yearGroup}</p>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((subject) => (
                        <SubjectPill
                          key={subject.id}
                          subject={subject}
                          classes={yearClasses}
                          department={department}
                          isAssigned={isAssigned}
                          onToggleAll={onToggleAll}
                          isSaving={isSaving}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
