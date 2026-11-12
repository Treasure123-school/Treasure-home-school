import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart3, ChevronDown, ChevronUp, Copy, Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingCard } from '../components';
import type { GradingScaleManager } from './useGradingScaleManager';

/** Expandable list of grade scales with their boundary tables. */
export function ScalesList({ m }: { m: GradingScaleManager }) {
  return (
    <SettingCard title="Grade Scales" description="Manage named grading systems. Only one scale is active at a time — it drives all exam results, report cards, and analytics." icon={BarChart3}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{m.scales.length} scale{m.scales.length !== 1 ? 's' : ''} configured</p>
        <Button size="sm" onClick={m.openCreateScale} data-testid="button-new-scale">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Scale
        </Button>
      </div>

      {m.scalesLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : m.scales.length === 0 ? (
        <div className="text-center py-10 bg-muted/20 rounded-lg border-2 border-dashed">
          <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No grade scales yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a scale using the "New Scale" button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {m.scales.map(scale => {
            const isExpanded = m.expandedScaleId === scale.id;
            const sorted = [...(scale.boundaries ?? [])].sort((a, b) => b.minScore - a.minScore);
            return (
              <div key={scale.id} className={cn('rounded-lg border transition-all', scale.isActive ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20' : 'border-border bg-card')}>
                <div className="flex items-start gap-3 p-4">
                  <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', scale.isActive ? 'bg-green-500' : 'bg-muted-foreground/25')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-sm">{scale.name}</span>
                      {scale.isActive && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 text-xs border-0 px-1.5 py-0">Active</Badge>}
                      {scale.isBuiltIn && <Badge variant="outline" className="text-xs px-1.5 py-0">Built-in</Badge>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {scale.description && <p className="text-xs text-muted-foreground">{scale.description}</p>}
                      <span className="text-xs text-muted-foreground/60">{(scale.boundaries ?? []).length} {(scale.boundaries ?? []).length === 1 ? 'boundary' : 'boundaries'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {!scale.isActive && (
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => m.activateMutation.mutate(scale.id)} disabled={m.activateMutation.isPending} data-testid={`button-activate-scale-${scale.id}`}>
                        {m.activateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Activate'}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit name/description" onClick={() => { m.setEditingScale(scale); m.setScaleForm({ name: scale.name, description: scale.description || '', copyFromId: '' }); }} data-testid={`button-edit-scale-${scale.id}`}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={() => m.duplicateMutation.mutate(scale.id)} disabled={m.duplicateMutation.isPending} data-testid={`button-duplicate-scale-${scale.id}`}><Copy className="w-3.5 h-3.5" /></Button>
                    {!scale.isActive && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => m.setDeleteScaleId(scale.id)} data-testid={`button-delete-scale-${scale.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" title={isExpanded ? 'Collapse' : 'Show boundaries'} onClick={() => m.setExpandedScaleId(isExpanded ? null : scale.id)} data-testid={`button-expand-scale-${scale.id}`}>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3">
                    {sorted.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No boundaries yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="py-2 text-xs">Grade</TableHead>
                              <TableHead className="py-2 text-xs">Score Range</TableHead>
                              <TableHead className="py-2 text-xs hidden sm:table-cell">Points</TableHead>
                              <TableHead className="py-2 text-xs hidden md:table-cell">Remark</TableHead>
                              <TableHead className="py-2 text-xs text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sorted.map(b => (
                              <TableRow key={b.id} data-testid={`row-boundary-${b.id}`}>
                                <TableCell className="py-2"><Badge variant="outline" className="font-bold text-xs">{b.grade}</Badge></TableCell>
                                <TableCell className="py-2 text-sm">{b.minScore}% – {b.maxScore}%</TableCell>
                                <TableCell className="py-2 text-sm hidden sm:table-cell">{b.gradePoint ?? '—'}</TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground hidden md:table-cell">{b.remark || '—'}</TableCell>
                                <TableCell className="py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => m.openEditBoundary(scale.id, b)} data-testid={`button-edit-boundary-${b.id}`}><Edit className="w-3 h-3" /></Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => m.setDeleteBoundaryId({ scaleId: scale.id, boundaryId: b.id })} data-testid={`button-delete-boundary-${b.id}`}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => m.openAddBoundary(scale.id)} data-testid={`button-add-boundary-${scale.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Boundary
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SettingCard>
  );
}
