import {
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import type { CalendarTerm } from '@/hooks/useAcademicCalendar';
import { Edit, Trash2, Archive, Eye, Power, PowerOff } from 'lucide-react';

export interface TermActions {
  onSetCurrent: (id: number) => void;
  onDeactivate: (id: number) => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onEdit: (t: CalendarTerm) => void;
  onDelete: (id: number) => void;
}

export function TermActionsMenu({ t, status, actions, testSuffix }: {
  t: CalendarTerm;
  status: string;
  actions: TermActions;
  testSuffix: string;
}) {
  const isArchived = status === 'archived';
  const deleteDisabled = t.isCurrent || isArchived;
  const deleteLabel = t.isCurrent ? 'Cannot delete active'
    : isArchived ? 'Restore to delete'
    : 'Delete';
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">Term Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {!t.isCurrent && !isArchived && (
        <DropdownMenuItem onClick={() => actions.onSetCurrent(t.id)} data-testid={`btn-term-activate-${testSuffix}-${t.id}`}>
          <Power className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
        </DropdownMenuItem>
      )}
      {t.isCurrent && (
        <DropdownMenuItem onClick={() => actions.onDeactivate(t.id)} data-testid={`btn-term-deactivate-${testSuffix}-${t.id}`}>
          <PowerOff className="h-4 w-4 mr-2 text-amber-600" /> Deactivate
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => actions.onEdit(t)} disabled={isArchived} data-testid={`btn-term-edit-${testSuffix}-${t.id}`}>
        <Edit className="h-4 w-4 mr-2" /> Edit
      </DropdownMenuItem>
      {!isArchived ? (
        <DropdownMenuItem onClick={() => actions.onArchive(t.id)} disabled={t.isCurrent} data-testid={`btn-term-archive-${testSuffix}-${t.id}`}>
          <Archive className="h-4 w-4 mr-2 text-orange-500" /> Archive
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => actions.onUnarchive(t.id)} data-testid={`btn-term-restore-${testSuffix}-${t.id}`}>
          <Eye className="h-4 w-4 mr-2 text-primary" /> Restore
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <DropdownMenuItem onSelect={e => e.preventDefault()}
            className="text-destructive focus:text-destructive"
            disabled={deleteDisabled}
            data-testid={`btn-term-delete-${testSuffix}-${t.id}`}>
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteLabel}
          </DropdownMenuItem>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Term?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{t.name} ({t.year})"? Terms linked to exams, report cards, or other records cannot be deleted — archive it instead. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => actions.onDelete(t.id)} data-testid={`btn-term-confirm-delete-${testSuffix}-${t.id}`}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
