import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export interface MiniStatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'amber' | 'green' | 'gray' | 'blue' | 'red' | 'primary';
  testId?: string;
}

const COLOR_CLASSES: Record<NonNullable<MiniStatItem['color']>, { text: string; icon: string }> = {
  amber: { text: 'text-amber-600', icon: 'text-amber-500' },
  green: { text: 'text-green-600', icon: 'text-green-500' },
  gray: { text: 'text-gray-600', icon: 'text-gray-500' },
  blue: { text: 'text-primary', icon: 'text-primary' },
  red: { text: 'text-red-600', icon: 'text-red-500' },
  primary: { text: 'text-primary', icon: 'text-primary' },
};

/**
 * A single compact stat card: label + value stacked/centered on mobile,
 * label+value left-aligned next to an icon from `sm` breakpoint up.
 */
export function MiniStatCard({ label, value, icon: Icon, color = 'primary', testId }: MiniStatItem) {
  const classes = COLOR_CLASSES[color] ?? COLOR_CLASSES.primary;
  const slug = testId ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <Card data-testid={`stats-card-${slug}`}>
      <CardContent className="p-3 sm:pt-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm text-muted-foreground" data-testid={`text-${slug}-label`}>{label}</p>
            <p className={`text-xl sm:text-2xl font-bold ${classes.text}`} data-testid={`text-${slug}-value`}>{value}</p>
          </div>
          <Icon className={`hidden sm:block w-8 h-8 ${classes.icon}`} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Responsive grid of MiniStatCards. 3 items stay stacked in a single row
 * from `sm` up (matching the original report-card layout); 2 or 4 items
 * use a 2-up mobile grid that expands to match the item count on `sm`+.
 */
export function MiniStatCardGrid({ items }: { items: MiniStatItem[] }) {
  const count = items.length;
  const gridClass =
    count === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : count === 2
        ? 'grid-cols-2'
        : count === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-2 sm:gap-4`}>
      {items.map((item) => (
        <MiniStatCard key={item.testId ?? item.label} {...item} />
      ))}
    </div>
  );
}
