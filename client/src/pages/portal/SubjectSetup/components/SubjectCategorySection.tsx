import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Subject } from '../types';
import { SubjectCheckbox } from './SubjectCheckbox';
import { getAssignmentKey } from '../utils/assignmentKeys';

interface SubjectCategorySectionProps {
  title: string;
  icon: ReactNode;
  subjects: Subject[];
  classId: number;
  department?: string | null;
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  pendingChanges: Map<string, unknown>;
  pendingRemovals: Set<string>;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
}

export function SubjectCategorySection({
  title,
  icon,
  subjects,
  classId,
  department = null,
  isAssigned,
  pendingChanges,
  pendingRemovals,
  isSaving,
  onToggle,
}: SubjectCategorySectionProps) {
  if (subjects.length === 0) return null;

  const assignedCount = subjects.filter((s) => isAssigned(classId, s.id, department)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          <span>{title}</span>
        </div>
        <Badge variant="secondary" className="text-xs font-normal ml-auto">
          {assignedCount}/{subjects.length} assigned
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
        {subjects.map((subject) => {
          const key = getAssignmentKey(classId, subject.id, department);
          const isPending = pendingChanges.has(key) || pendingRemovals.has(key);
          return (
            <SubjectCheckbox
              key={subject.id}
              subject={subject}
              classId={classId}
              department={department}
              isAssigned={isAssigned(classId, subject.id, department)}
              isPending={isPending}
              isSaving={isSaving}
              onToggle={onToggle}
            />
          );
        })}
      </div>
    </div>
  );
}
