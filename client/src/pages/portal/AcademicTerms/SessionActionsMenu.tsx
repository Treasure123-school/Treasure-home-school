import {
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import type { CalendarSession } from '@/hooks/useAcademicCalendar';
import { Edit, Trash2, Archive, Eye, Power, PowerOff } from 'lucide-react';

export interface SessionActions {
  onSetCurrent: (id: number) => void;
  onDeactivate: (id: number) => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onEdit: (s: CalendarSession) => void;
  onDelete: (id: number) => void;
}

export function SessionActionsMenu({ s, status, actions, testSuffix }: {
  s: CalendarSession;
  status: string;
  actions: SessionActions;
  testSuffix: string;
}) {
  const isArchived = status === 'archived';
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">Session Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {!s.isCurrent && !isArchived && (
        <DropdownMenuItem onClick={() => actions.onSetCurrent(s.id)} data-testid={`btn-session-activate-${testSuffix}-${s.id}`}>
          <Power className="h-4 w-4 mr-2 text-emerald-600" /> Set as Current
        </DropdownMenuItem>
      )}
      {s.isCurrent && (
        <DropdownMenuItem onClick={() => actions.onDeactivate(s.id)} data-testid={`btn-session-deactivate-${testSuffix}-${s.id}`}>
          <PowerOff className="h-4 w-4 mr-2 text-amber-600" /> Deactivate
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => actions.onEdit(s)} disabled={isArchived} data-testid={`btn-session-edit-${testSuffix}-${s.id}`}>
        <Edit className="h-4 w-4 mr-2" /> Edit
      </DropdownMenuItem>
      {!isArchived ? (
        <DropdownMenuItem onClick={() => actions.onArchive(s.id)} data-testid={`btn-session-archive-${testSuffix}-${s.id}`}>
          <Archive className="h-4 w-4 mr-2 text-orange-500" /> Archive
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => actions.onUnarchive(s.id)} data-testid={`btn-session-unarchive-${testSuffix}-${s.id}`}>
          <Eye className="h-4 w-4 mr-2 text-primary" /> Restore
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <DropdownMenuItem onSelect={e => e.preventDefault()}
            className="text-destructive focus:text-destructive"
            disabled={s.isCurrent}
            data-testid={`btn-session-delete-${testSuffix}-${s.id}`}>
            <Trash2 className="h-4 w-4 mr-2" />
            {s.isCurrent ? 'Cannot delete active' : 'Delete'}
          </DropdownMenuItem>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{s.name}"? Sessions with linked terms cannot be deleted — archive it instead, or unlink all terms first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => actions.onDelete(s.id)} data-testid={`btn-session-confirm-delete-${testSuffix}-${s.id}`}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
