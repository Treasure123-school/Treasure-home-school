import { Checkbox } from '@/components/ui/checkbox';
import type { Subject } from '../types';
import { getAssignmentKey } from '../utils/assignmentKeys';

interface SubjectCheckboxProps {
  subject: Subject;
  classId: number;
  department?: string | null;
  isAssigned: boolean;
  isPending: boolean;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
}

export function SubjectCheckbox({
  subject,
  classId,
  department = null,
  isAssigned,
  isPending,
  isSaving,
  onToggle,
}: SubjectCheckboxProps) {
  const key = getAssignmentKey(classId, subject.id, department);

  const handleClick = () => {
    if (!isSaving) onToggle(classId, subject.id, department, !isAssigned);
  };

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-1 border-b border-border/30 last:border-b-0 transition-colors
        ${isAssigned ? 'bg-transparent' : ''}
        ${isSaving ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:bg-muted/40 rounded-md'}
      `}
      onClick={handleClick}
    >
      <Checkbox
        id={key}
        checked={isAssigned}
        disabled={isSaving}
        className="shrink-0"
        onCheckedChange={(checked) => {
          if (typeof checked === 'boolean') onToggle(classId, subject.id, department, checked);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <label
        htmlFor={key}
        className={`flex-1 text-sm leading-snug select-none
          ${isAssigned ? 'text-foreground font-medium' : 'text-muted-foreground'}
          ${isSaving ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {subject.name}
      </label>
      {isPending && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-label="Unsaved change" />
      )}
    </div>
  );
}
