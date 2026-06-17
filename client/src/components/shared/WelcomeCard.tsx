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

/**
 * Fully-responsive welcome banner used across every portal dashboard.
 *
 * Typography scales fluidly via CSS clamp() — no hard breakpoint jumps.
 * Layout adapts from compact-mobile → tablet → spacious-desktop without
 * horizontal overflow or clipping at any viewport width.
 */
export function WelcomeCard({
  name,
  subtitle,
  icon: Icon,
  gradient = "from-primary via-primary/90 to-primary/80",
  showDate = false,
  className,
  "data-testid": testId,
}: WelcomeCardProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl text-white shadow-xl",
        "bg-gradient-to-r",
        gradient,
        "p-6",
        className
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">

        {/* ── Left: icon + text ─────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">

          {/* Icon bubble — scales with viewport */}
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-center",
              "bg-white/20 backdrop-blur-sm shadow-lg",
              "rounded-xl sm:rounded-2xl",
              "p-4"
            )}
          >
            <Icon
              className={cn(
                "text-white",
                "h-10 w-10"
              )}
            />
          </div>

          {/* Text block — min-w-0 allows truncation instead of overflow */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2
              className="font-bold tracking-tight leading-tight"
              style={{
                /* Fluid: 16px on ~320px screen → 24px at ~600px and wider */
                fontSize: "clamp(1rem, 4.5vw, 1.5rem)",
              }}
            >
              Welcome back, {name}!
            </h2>
            <p
              className="text-white/75 mt-0.5 leading-snug line-clamp-2"
              style={{
                /* Fluid: 11px on tiny screens → 14px at 600px+ */
                fontSize: "clamp(0.6875rem, 2.5vw, 0.875rem)",
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        {/* ── Right: date badge (hidden on mobile) ──────────────────── */}
        {showDate && (
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 md:gap-2 flex-shrink-0",
              "bg-white/10 backdrop-blur-sm rounded-lg",
              "px-3 py-1.5 md:px-4 md:py-2"
            )}
          >
            <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
            <span className="text-xs md:text-sm whitespace-nowrap">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
