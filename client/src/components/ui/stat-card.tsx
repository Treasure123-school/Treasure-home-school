import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  loading?: boolean;
  "data-testid"?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading = false,
  "data-testid": testId,
}: StatCardProps) {
  if (loading) {
    return <Skeleton className="h-[72px] rounded-lg" />;
  }
  return (
    <Card data-testid={testId}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

interface StatCardGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
}

export function StatCardGrid({ children, cols = 4 }: StatCardGridProps) {
  const colClass: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };
  return (
    <div className={`grid ${colClass[cols]} gap-3`}>
      {children}
    </div>
  );
}
