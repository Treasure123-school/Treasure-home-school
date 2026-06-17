import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeCardProps {
  name: string;
  subtitle: string;
  icon: LucideIcon;
  gradient?: string;
  showDate?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function WelcomeCard({
  name,
  subtitle,
  icon: Icon,
  gradient = "from-primary via-primary/90 to-primary/80",
  showDate = false,
  className,
  "data-testid": testId,
}: WelcomeCardProps) {
  const today = new Date();

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl text-white shadow-xl",
        "bg-gradient-to-r",
        gradient,
        "p-6",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3">

        {/* ── Left: icon + text ───────────────────────────────── */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">

          {/* Icon bubble */}
          <div className="flex-shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl p-4">
            <Icon className="text-white h-7 w-7" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2
              className="font-bold tracking-tight leading-tight"
              style={{ fontSize: "clamp(1.40rem, 5vw, 1.55rem)" }}
            >
              {/* On mobile: "Welcome back," is on its own line, name wraps below */}
              <span className="block sm:inline">Welcome back,</span>
              <span className="block sm:inline"> {name}!</span>
            </h2>
            <p
              className="text-white/75 mt-1 leading-snug line-clamp-2"
              style={{ fontSize: "clamp(0.775rem, 2.5vw, 0.875rem)" }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        {/* ── Right: calendar tile on mobile, date badge on desktop ── */}
        <div className="flex-shrink-0">

          {/* Mobile: compact calendar tile */}
          <div className="flex sm:hidden flex-col items-center justify-center bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[54px] text-center">
            <span className="text-[10px] font-semibold text-white/70 uppercase tracking-widest leading-none">
              {today.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="text-2xl font-bold leading-tight mt-0.5">
              {today.getDate()}
            </span>
            <span className="text-[10px] text-white/60 leading-none mt-0.5">
              {today.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
          </div>

          {/* Tablet+: horizontal date badge with clock */}
          {showDate && (
            <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm whitespace-nowrap">
                {today.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
