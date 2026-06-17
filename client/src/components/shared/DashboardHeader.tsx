import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  name: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  "data-testid"?: string;
}

export function DashboardHeader({
  name,
  subtitle,
  icon: Icon,
  className,
  "data-testid": testId,
}: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl p-4 sm:p-6 text-white shadow-xl",
        className
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg flex-shrink-0">
            <Icon className="h-7 w-7 sm:h-10 sm:w-10 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight leading-tight">
              Welcome back, {name}!
            </h2>
            <p className="text-white/70 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">{subtitle}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-3">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
