import { Card, CardContent } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradientStatCardProps {
  label: string;
  value: number;
  sublabel?: string;
  icon: LucideIcon;
  iconGradient: string;
  glowColor?: string;
  textGradient?: string;
  loading?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function GradientStatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconGradient,
  glowColor = "from-primary/10 to-transparent",
  textGradient = "from-primary to-primary/90",
  loading = false,
  className,
  "data-testid": testId,
}: GradientStatCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border-none shadow-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between mb-3 sm:mb-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 sm:w-28" />
              <Skeleton className="h-8 sm:h-10 w-14 sm:w-16" />
              <Skeleton className="h-3 w-20 sm:w-24" />
            </div>
            <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105",
        className,
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "absolute top-0 right-0 rounded-full bg-gradient-to-br",
          "w-24 h-24 -mr-12 -mt-12 sm:w-32 sm:h-32 sm:-mr-16 sm:-mt-16",
          glowColor,
        )}
      />
      <CardContent className="p-4 sm:p-6 relative z-10">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">{label}</p>
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <AnimatedCounter
                value={value}
                className={cn(
                  "text-3xl sm:text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                  textGradient,
                )}
              />
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            {sublabel && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">{sublabel}</p>
            )}
          </div>
          <div
            className={cn(
              "p-2 sm:p-3 rounded-xl bg-gradient-to-br text-white shadow-lg flex-shrink-0",
              iconGradient,
            )}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
