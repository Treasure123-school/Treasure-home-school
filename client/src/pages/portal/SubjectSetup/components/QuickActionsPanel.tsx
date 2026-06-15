import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClassInfo, Subject } from '../types';
import { getClassYearGroups } from '../utils/classGrouping';

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
  const yearGroups = getClassYearGroups(classes);
  const hasMultipleYearGroups = yearGroups.size > 1;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/50 ${headerClassName}`}>
        {headerIcon}
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">{description}</p>

        {/* Assign to ALL classes in this level */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
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

        {/* Assign by year group (e.g. all JSS 1, all JSS 2) */}
        {hasMultipleYearGroups && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Assign by year group
            </p>
            <div className="space-y-3">
              {Array.from(yearGroups.entries()).map(([yearGroup, yearClasses]) => (
                <div key={yearGroup}>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">{yearGroup}</p>
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
                        label={subject.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
