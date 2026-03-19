import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}
export function StatsCard({ title, value, icon: Icon, color = 'primary', change, changeType = 'neutral' }: StatsCardProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'primary':
        return 'bg-primary/10 text-primary';
      case 'secondary':
        return 'bg-secondary/10 text-secondary';
      case 'green':
        return 'bg-green-100 text-green-600';
      case 'blue':
        return 'bg-blue-100 text-blue-600';
      case 'orange':
        return 'bg-orange-100 text-orange-600';
      case 'red':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  const getChangeClasses = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="shadow-sm border border-border" data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm" data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}-label`}>
              {title}
            </p>
            <p className="text-2xl font-bold" data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}-value`}>
              {value}
            </p>
            {change && (
              <p className={`text-xs mt-1 ${getChangeClasses()}`} data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}-change`}>
                {change}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${getColorClasses()}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}