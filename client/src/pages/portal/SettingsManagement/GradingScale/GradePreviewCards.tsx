import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Eye, Info, Scale } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SettingCard } from '../components';
import type { GradingScaleManager } from './useGradingScaleManager';

/** Class position method selector (average % vs total marks). */
export function PositionMethodCard({ m }: { m: GradingScaleManager }) {
  return (
    <SettingCard title="Class Position Method" description="How students are ranked within their class" icon={Scale}>
      <div className="space-y-3">
        <Select value={m.positioningMethod} onValueChange={v => { m.setPositioningMethod(v); m.save.mutate({ positioningMethod: v }); }}>
          <SelectTrigger data-testid="select-positioning-method"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="average">By Average Score (Recommended)</SelectItem>
            <SelectItem value="total">By Total Marks</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{m.positioningMethod === 'average' ? 'Ranks by average % — fairer when students take different numbers of subjects.' : 'Ranks by total marks — may disadvantage students with fewer subjects.'}</span>
        </div>
      </div>
    </SettingCard>
  );
}

/** Live grade preview for an entered score against the active scale. */
export function GradePreviewCard({ m }: { m: GradingScaleManager }) {
  const gradeColor = (grade: string) => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'text-green-600 dark:text-green-400';
    if (g.startsWith('B')) return 'text-primary dark:text-primary/70';
    if (g.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
    if (g.startsWith('D')) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };
  const gradeBg = (grade: string) => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (g.startsWith('B')) return 'bg-primary/5 dark:bg-primary/5 border-primary/30 dark:border-primary/30';
    if (g.startsWith('C')) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    if (g.startsWith('D')) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  return (
    <SettingCard
      title="Grade Preview"
      description={m.activeScale ? `Live preview using: ${m.activeScale.name}` : 'Activate a scale above to enable preview'}
      icon={Eye}
    >
      <div className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Enter score (0–100)</Label>
            <Input
              type="number" min="0" max="100"
              placeholder="e.g. 75"
              value={m.previewScore}
              onChange={e => m.setPreviewScore(e.target.value)}
              disabled={!m.activeScale}
              data-testid="input-preview-score"
            />
          </div>
          {m.previewResult && (
            <div className={cn('rounded-lg border px-4 py-2 text-center min-w-[100px]', gradeBg(m.previewResult.grade))}>
              <div className={cn('text-2xl font-bold leading-tight', gradeColor(m.previewResult.grade))}>{m.previewResult.grade}</div>
              {m.previewResult.remark && <div className="text-xs text-muted-foreground">{m.previewResult.remark}</div>}
              {m.previewResult.gradePoint != null && <div className="text-xs font-medium mt-0.5">{m.previewResult.gradePoint} pt{m.previewResult.gradePoint !== 1 ? 's' : ''}</div>}
            </div>
          )}
          {m.previewScore && !m.previewResult && m.activeScale && (
            <div className="rounded-lg border px-4 py-2 text-center min-w-[100px] bg-muted/30">
              <div className="text-sm text-muted-foreground">—</div>
            </div>
          )}
        </div>

        {m.activeScale && (m.activeScale.boundaries ?? []).length > 0 && (
          <div className="overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="py-2 text-xs">Grade</TableHead>
                  <TableHead className="py-2 text-xs">Range</TableHead>
                  <TableHead className="py-2 text-xs hidden sm:table-cell">Points</TableHead>
                  <TableHead className="py-2 text-xs hidden sm:table-cell">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...(m.activeScale.boundaries ?? [])].sort((a, b) => b.minScore - a.minScore).map(b => (
                  <TableRow key={b.id} className={cn(m.previewResult?.id === b.id ? 'bg-primary/8 font-medium' : '')}>
                    <TableCell className="py-1.5"><Badge variant="outline" className={cn('text-xs font-bold', m.previewResult?.id === b.id ? gradeColor(b.grade) : '')}>{b.grade}</Badge></TableCell>
                    <TableCell className="py-1.5 text-xs">{b.minScore}–{b.maxScore}%</TableCell>
                    <TableCell className="py-1.5 text-xs hidden sm:table-cell">{b.gradePoint ?? '—'}</TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground hidden sm:table-cell">{b.remark || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SettingCard>
  );
}
