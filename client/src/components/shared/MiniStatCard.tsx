import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MiniStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  "data-testid"?: string;
}

export function MiniStatCard({
  label,
  value,
  icon: Icon,
  color = "text-foreground",
  active = false,
  onClick,
  "data-testid": testId,
}: MiniStatCardProps) {
  return (
    <Card
      className={cn(
        "p-4 transition-all",
        onClick && "cursor-pointer",
        active
          ? "border-2 border-primary"
          : onClick
          ? "border-2 border-transparent hover:border-primary/30"
          : ""
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold", color)}>{value}</p>
        </div>
        <Icon className={cn("h-6 w-6 opacity-60", color)} />
      </div>
    </Card>
  );
}

interface MiniStatGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}

export function MiniStatGrid({ children, cols = 4, className }: MiniStatGridProps) {
  const colClass: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };
  return (
    <div className={cn("grid gap-3", colClass[cols], className)}>
      {children}
    </div>
  );
}
