import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

export function StatCard({ icon: Icon, label, value, sub, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${color} shrink-0`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-bold truncate" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
