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
      <div className="flex items-center gap-4">

        {/* Icon bubble */}
        <div className="flex-shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-lg rounded-xl sm:rounded-2xl p-4">
          <Icon className="text-white h-7 w-7" />
        </div>

        {/* Text — flex-1 min-w-0 keeps it from overflowing the card */}
        <div className="flex-1 min-w-0">
          <h2
            className="font-bold tracking-tight leading-tight truncate"
            style={{ fontSize: "clamp(1.15rem, 4.5vw, 1.55rem)" }}
          >
            Welcome back, {name}!
          </h2>
          <p
            className="text-white/75 mt-1 leading-snug truncate"
            style={{ fontSize: "clamp(0.775rem, 2.5vw, 0.875rem)" }}
          >
            {subtitle}
          </p>
        </div>

        {/* Date badge — visible on tablet+ only when showDate is set */}
        {showDate && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm whitespace-nowrap">
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
