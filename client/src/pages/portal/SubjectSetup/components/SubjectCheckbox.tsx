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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150
        ${isAssigned ? 'border-primary/20 bg-primary/5 dark:bg-primary/10' : 'border-border bg-background hover:bg-muted/40'}
        ${isPending ? 'ring-2 ring-amber-400/50 border-amber-300 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/30' : ''}
        ${isSaving ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
      `}
      onClick={handleClick}
    >
      <Checkbox
        id={key}
        checked={isAssigned}
        disabled={isSaving}
        onCheckedChange={(checked) => {
          if (typeof checked === 'boolean') onToggle(classId, subject.id, department, checked);
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <label
        htmlFor={key}
        className={`flex items-center gap-2 text-sm flex-1 select-none ${isSaving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`font-medium ${isAssigned ? 'text-foreground' : 'text-muted-foreground'}`}>
          {subject.name}
        </span>
        <Badge className={`text-xs px-1.5 py-0 ${catColor}`}>{subject.code}</Badge>
        {isPending && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300 dark:border-amber-600">
            Pending
          </Badge>
        )}
      </label>
    </div>
  );
}
