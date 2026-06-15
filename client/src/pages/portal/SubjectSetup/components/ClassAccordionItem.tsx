import type { ReactNode } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { BookMarked, GraduationCap } from 'lucide-react';
import type { ClassInfo, Subject } from '../types';
import { SubjectCategorySection } from './SubjectCategorySection';
import { getAssignmentKey } from '../utils/assignmentKeys';

interface ClassAccordionItemProps {
  cls: ClassInfo;
  department?: string | null;
  generalSubjects: Subject[];
  specialSubjects: Subject[];
  specialLabel?: string;
  specialIcon?: ReactNode;
  levelColor?: string;
  isAssigned: (classId: number, subjectId: number, department: string | null) => boolean;
  pendingChanges: Map<string, unknown>;
  pendingRemovals: Set<string>;
  isSaving: boolean;
  onToggle: (classId: number, subjectId: number, department: string | null, checked: boolean) => void;
}

export function ClassAccordionItem({
  cls,
  department = null,
  generalSubjects,
  specialSubjects,
  specialLabel,
  specialIcon,
  levelColor = 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
  isAssigned,
  pendingChanges,
  pendingRemovals,
  isSaving,
  onToggle,
}: ClassAccordionItemProps) {
  const allVisible = [...generalSubjects, ...specialSubjects];
  const assignedCount = allVisible.filter((s) => isAssigned(cls.id, s.id, department)).length;

  const hasPending = allVisible.some((s) => {
    const key = getAssignmentKey(cls.id, s.id, department);
    return pendingChanges.has(key) || pendingRemovals.has(key);
  });

  return (
    <AccordionItem value={cls.id.toString()} className="border rounded-xl overflow-hidden shadow-sm">
      <AccordionTrigger className="hover:no-underline px-3 py-3 md:px-4 bg-muted/30 hover:bg-muted/50 transition-colors [&[data-state=open]]:bg-muted/50">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${levelColor}`}>
            {cls.name.replace(/\s/g, '').slice(0, 4)}
          </div>
          <span className="font-semibold text-sm truncate">{cls.name}</span>
          <div className="flex items-center gap-1.5 ml-auto mr-2 shrink-0">
            <Badge variant="secondary" className="text-xs font-normal">
              {assignedCount}/{allVisible.length}
            </Badge>
            {hasPending && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:border-amber-600">
                •
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pt-3 pb-4 md:px-4 bg-background">
        <div className="space-y-5">
          <SubjectCategorySection
            title="General Subjects"
            icon={<BookMarked className="w-4 h-4 text-slate-500" />}
            subjects={generalSubjects}
            classId={cls.id}
            department={department}
            isAssigned={isAssigned}
            pendingChanges={pendingChanges}
            pendingRemovals={pendingRemovals}
            isSaving={isSaving}
            onToggle={onToggle}
          />
          {specialSubjects.length > 0 && specialLabel && (
            <SubjectCategorySection
              title={specialLabel}
              icon={specialIcon ?? <GraduationCap className="w-4 h-4 text-primary" />}
              subjects={specialSubjects}
              classId={cls.id}
              department={department}
              isAssigned={isAssigned}
              pendingChanges={pendingChanges}
              pendingRemovals={pendingRemovals}
              isSaving={isSaving}
              onToggle={onToggle}
            />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
