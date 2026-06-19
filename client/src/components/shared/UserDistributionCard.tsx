import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'hsl(220, 90%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 90%, 55%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
];

export interface DistributionEntry {
  name: string;
  value: number;
}

interface UserDistributionCardProps {
  entries: DistributionEntry[];
  total: number;
  className?: string;
  'data-testid'?: string;
}

interface RoleRowProps {
  name: string;
  value: number;
  total: number;
  color: string;
}

function RoleRow({ name, value, total, color }: RoleRowProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="font-medium text-foreground">{name}</span>
        </div>
        <div className="flex items-center gap-2.5 tabular-nums">
          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
          <span className="font-semibold text-foreground w-6 text-right">{value}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const EMPTY_SLICE = [{ name: 'No data', value: 1, color: 'hsl(var(--muted))' }];

export function UserDistributionCard({
  entries,
  total,
  className,
  'data-testid': testId,
}: UserDistributionCardProps) {
  const slices = entries.length > 0
    ? entries.map((e, i) => ({ ...e, color: CHART_COLORS[i % CHART_COLORS.length] }))
    : EMPTY_SLICE;

  return (
    <Card className={cn('shadow-sm border border-border', className)} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          User Distribution
          <span className="text-xs font-normal text-muted-foreground">— by role</span>
        </CardTitle>
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary"
          data-testid="badge-total-users"
        >
          {total} total
        </span>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut chart */}
          <div className="relative shrink-0 w-[160px] h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={slices.length > 1 ? 3 : 0}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {slices.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-foreground leading-none">{total}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Users</span>
            </div>
          </div>

          {/* Role breakdown */}
          <div className="flex-1 w-full space-y-3">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No users registered yet.</p>
            ) : (
              entries.map((entry, i) => (
                <RoleRow
                  key={entry.name}
                  name={entry.name}
                  value={entry.value}
                  total={total}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
