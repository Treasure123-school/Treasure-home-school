import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { GradingScaleManager } from './useGradingScaleManager';

/** All four dialogs for the Grading Scale section (create/edit scale, add/edit/delete boundary). */
export function ScaleDialogs({ m }: { m: GradingScaleManager }) {
  return (
    <>
      {/* Create Scale Dialog */}
      <Dialog open={m.createOpen} onOpenChange={v => { m.setCreateOpen(v); if (!v) m.setScaleForm({ name: '', description: '', copyFromId: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Grade Scale</DialogTitle>
            <DialogDescription>Create a new grading system. Optionally copy boundaries from an existing scale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Scale Name *</Label>
              <Input placeholder="e.g. My Custom Scale" value={m.scaleForm.name} onChange={e => m.setScaleForm(p => ({ ...p, name: e.target.value }))} data-testid="input-scale-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Short description of this scale" value={m.scaleForm.description} onChange={e => m.setScaleForm(p => ({ ...p, description: e.target.value }))} data-testid="input-scale-description" />
            </div>
            {m.scales.length > 0 && (
              <div className="space-y-1.5">
                <Label>Copy boundaries from <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={m.scaleForm.copyFromId} onValueChange={v => m.setScaleForm(p => ({ ...p, copyFromId: v }))}>
                  <SelectTrigger data-testid="select-copy-from"><SelectValue placeholder="Start with no boundaries" /></SelectTrigger>
                  <SelectContent>
                    {m.scales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({(s.boundaries ?? []).length})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => m.setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!m.scaleForm.name.trim()) { m.toast?.({ title: 'Name is required', variant: 'destructive' }); return; }
                m.createScaleMutation.mutate({ name: m.scaleForm.name.trim(), description: m.scaleForm.description.trim() || undefined, copyFromId: m.scaleForm.copyFromId || undefined });
              }}
              disabled={m.createScaleMutation.isPending}
              data-testid="button-create-scale"
            >
              {m.createScaleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Scale Dialog */}
      <Dialog open={m.editingScale !== null} onOpenChange={v => { if (!v) m.setEditingScale(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Scale</DialogTitle>
            <DialogDescription>Update the name and description of this grade scale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Scale Name *</Label>
              <Input value={m.scaleForm.name} onChange={e => m.setScaleForm(p => ({ ...p, name: e.target.value }))} data-testid="input-edit-scale-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Short description" value={m.scaleForm.description} onChange={e => m.setScaleForm(p => ({ ...p, description: e.target.value }))} data-testid="input-edit-scale-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => m.setEditingScale(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!m.editingScale || !m.scaleForm.name.trim()) { m.toast?.({ title: 'Name is required', variant: 'destructive' }); return; }
                m.updateScaleMutation.mutate({ id: m.editingScale.id, data: { name: m.scaleForm.name.trim(), description: m.scaleForm.description.trim() || undefined } });
              }}
              disabled={m.updateScaleMutation.isPending}
              data-testid="button-save-scale"
            >
              {m.updateScaleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Boundary Dialog */}
      <Dialog open={m.boundaryDialogOpen} onOpenChange={v => { m.setBoundaryDialogOpen(v); if (!v) m.resetBoundaryForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.editingBoundary ? 'Edit Boundary' : 'Add Boundary'}</DialogTitle>
            <DialogDescription>Map a score range to a grade letter and optional remark.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Grade *</Label>
                <Input placeholder="e.g. A1, B+, C" value={m.boundaryForm.grade} onChange={e => m.setBoundaryForm(p => ({ ...p, grade: e.target.value }))} data-testid="input-boundary-grade" />
              </div>
              <div className="space-y-1.5">
                <Label>Points <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 4" value={m.boundaryForm.gradePoint} onChange={e => m.setBoundaryForm(p => ({ ...p, gradePoint: e.target.value }))} data-testid="input-boundary-points" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Score (%)</Label>
                <Input type="number" min="0" max="100" value={m.boundaryForm.minScore} onChange={e => m.setBoundaryForm(p => ({ ...p, minScore: parseInt(e.target.value) || 0 }))} data-testid="input-boundary-min" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Score (%)</Label>
                <Input type="number" min="0" max="100" value={m.boundaryForm.maxScore} onChange={e => m.setBoundaryForm(p => ({ ...p, maxScore: parseInt(e.target.value) || 100 }))} data-testid="input-boundary-max" />
              </div>
            </div>
            {m.boundaryForm.minScore > m.boundaryForm.maxScore && (
              <p className="text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Min score cannot exceed max score</p>
            )}
            {m.overlapWarning && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5" data-testid="text-overlap-warning"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {m.overlapWarning}</p>
            )}
            <div className="space-y-1.5">
              <Label>Remark <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Distinction, Credit, Fail" value={m.boundaryForm.remark} onChange={e => m.setBoundaryForm(p => ({ ...p, remark: e.target.value }))} data-testid="input-boundary-remark" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { m.setBoundaryDialogOpen(false); m.resetBoundaryForm(); }}>Cancel</Button>
            <Button onClick={m.handleSaveBoundary} disabled={m.addBoundaryMutation.isPending || m.updateBoundaryMutation.isPending} data-testid="button-save-boundary">
              {(m.addBoundaryMutation.isPending || m.updateBoundaryMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {m.editingBoundary ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Scale Confirm */}
      <Dialog open={m.deleteScaleId !== null} onOpenChange={v => { if (!v) m.setDeleteScaleId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Grade Scale</DialogTitle>
            <DialogDescription>This permanently deletes the scale and all its boundaries. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => m.setDeleteScaleId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => m.deleteScaleId && m.deleteScaleMutation.mutate(m.deleteScaleId)} disabled={m.deleteScaleMutation.isPending} data-testid="button-confirm-delete-scale">
              {m.deleteScaleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Boundary Confirm */}
      <Dialog open={m.deleteBoundaryId !== null} onOpenChange={v => { if (!v) m.setDeleteBoundaryId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Boundary</DialogTitle>
            <DialogDescription>Remove this grade boundary. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => m.setDeleteBoundaryId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => m.deleteBoundaryId && m.deleteBoundaryMutation.mutate(m.deleteBoundaryId)} disabled={m.deleteBoundaryMutation.isPending} data-testid="button-confirm-delete-boundary">
              {m.deleteBoundaryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
