import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Archive, ArchiveRestore, Trash2, Loader2, CheckCircle2, Ban,
} from 'lucide-react';
import { AUDIT_FIELDS } from '../constants';
import type { SubjectAction, SubjectAudit } from '../types';

interface SubjectActionDialogProps {
  subject: any;
  action: SubjectAction | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function SubjectActionDialog({ subject, action, onConfirm, onCancel, isPending }: SubjectActionDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const { data: audit, isLoading: isAuditing } = useQuery<SubjectAudit>({
    queryKey: ['/api/subjects', subject?.id, 'audit'],
    queryFn: async () => (await apiRequest('GET', `/api/subjects/${subject.id}/audit`)).json(),
    enabled: !!subject && !!action,
    staleTime: 0,
  });

  const linkedItems = audit
    ? AUDIT_FIELDS.filter(f => (audit[f.key] ?? 0) > 0)
    : [];

  const isOpen = !!subject && !!action;

  function handleOpenChange(open: boolean) {
    if (!open) { setConfirmText(''); onCancel(); }
  }

  if (!subject || !action) return null;

  const confirmPhrase = subject.name ?? '';
  const canDelete = confirmText.toLowerCase() === confirmPhrase.toLowerCase() && !isAuditing && !!audit?.isClean;
  const hasLinked = !audit?.isClean;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'archive' && <><Archive className="h-5 w-5 text-amber-600 shrink-0" /> Archive Subject</>}
            {action === 'restore' && <><ArchiveRestore className="h-5 w-5 text-green-600 shrink-0" /> Restore Subject</>}
            {action === 'delete' && <><Trash2 className="h-5 w-5 text-destructive shrink-0" /> Permanently Delete Subject</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Subject name */}
          <p className="text-sm text-muted-foreground">
            {action === 'archive' && <>Archive <strong className="text-foreground">{subject.name}</strong>? It will be hidden from all new assignments but all historical data is preserved.</>}
            {action === 'restore' && <>Restore <strong className="text-foreground">{subject.name}</strong>? It will become active and available in all dropdowns again.</>}
            {action === 'delete' && <>You are about to permanently delete <strong className="text-foreground">{subject.name}</strong>. This cannot be undone.</>}
          </p>

          {/* Dependency summary */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linked Records — {subject.name}
            </p>
            {isAuditing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking linked data…
              </div>
            ) : audit?.isClean ? (
              <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No linked records found. Safe to delete.</span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {linkedItems.map(({ key, label, icon: Icon }) => (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-semibold text-foreground">{(audit![key] as number).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete-specific: block if has linked records */}
          {action === 'delete' && !isAuditing && hasLinked && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
              <Ban className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Cannot delete subject.</strong>
                <br />
                <span className="text-muted-foreground">This subject contains linked records. Please archive the subject instead, or manually remove the linked records before deletion.</span>
              </div>
            </div>
          )}

          {/* Delete-specific: name confirmation (only when clean) */}
          {action === 'delete' && !isAuditing && audit?.isClean && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-input" className="text-sm">
                Type <strong className="select-all font-mono">{confirmPhrase}</strong> to confirm permanent deletion
              </Label>
              <Input
                id="confirm-input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                className="font-mono text-sm"
                autoComplete="off"
                data-testid="input-delete-confirm"
                disabled={isPending}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>

            {action === 'archive' && (
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={onConfirm}
                disabled={isPending || isAuditing}
                data-testid="button-confirm-archive"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Archiving…</> : <><Archive className="h-4 w-4 mr-2" />Archive Subject</>}
              </Button>
            )}

            {action === 'restore' && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={onConfirm}
                disabled={isPending || isAuditing}
                data-testid="button-confirm-restore"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring…</> : <><ArchiveRestore className="h-4 w-4 mr-2" />Restore Subject</>}
              </Button>
            )}

            {action === 'delete' && (
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={!canDelete || isPending || hasLinked}
                data-testid="button-confirm-delete"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" />Permanently Delete</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
