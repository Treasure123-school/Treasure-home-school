import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { Subject } from '../types';
import { getAssignmentKey } from '../utils/assignmentKeys';

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  science: 'bg-primary/10 text-primary',
  art: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  commercial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

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
  const catColor = CATEGORY_COLORS[subject.category] ?? CATEGORY_COLORS.general;

  const handleClick = () => {
    if (!isSaving) onToggle(classId, subject.id, department, !isAssigned);
  };

  return (
    <div
      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-all duration-150
        ${isAssigned ? 'border-primary/20 bg-primary/5 dark:bg-primary/10' : 'border-border bg-background hover:bg-muted/40'}
        ${isPending ? 'ring-1 ring-amber-400/60 border-amber-300 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/30' : ''}
        ${isSaving ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
      `}
      onClick={handleClick}
    >
      <Checkbox
        id={key}
        checked={isAssigned}
        disabled={isSaving}
        className="mt-0.5 shrink-0"
        onCheckedChange={(checked) => {
          if (typeof checked === 'boolean') onToggle(classId, subject.id, department, checked);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <label
        htmlFor={key}
        className={`flex flex-col gap-0.5 text-xs flex-1 min-w-0 select-none ${isSaving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`font-medium leading-snug break-words ${isAssigned ? 'text-foreground' : 'text-muted-foreground'}`}>
          {subject.name}
        </span>
        <Badge className={`text-xs px-1 py-0 w-fit ${catColor}`}>{subject.code}</Badge>
      </label>
    </div>
  );
}
