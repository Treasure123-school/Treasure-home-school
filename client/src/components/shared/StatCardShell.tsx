import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Reusable shell for gradient stat cards used on every portal dashboard.
 * Handles: glow blob, responsive padding, hover/scale animation.
 * Put your label + value content as children.
 */
interface StatCardShellProps {
  glowColor: string;
  animationDuration?: number;
  className?: string;
  children: React.ReactNode;
  "data-testid"?: string;
}

export function StatCardShell({
  glowColor,
  animationDuration,
  className,
  children,
  "data-testid": testId,
}: StatCardShellProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-none shadow-xl",
        "hover:shadow-2xl transition-all duration-300 hover:scale-105",
        "animate-in fade-in slide-in-from-bottom-4",
        className,
      )}
      style={animationDuration ? { animationDuration: `${animationDuration}ms` } : undefined}
      data-testid={testId}
    >
      {/* Decorative glow blob */}
      <div
        className={cn(
          "absolute top-0 right-0 rounded-full bg-gradient-to-br",
          "w-24 h-24 -mr-12 -mt-12 sm:w-32 sm:h-32 sm:-mr-16 sm:-mt-16",
          glowColor,
        )}
      />
      <CardContent className="p-5 sm:p-6 relative z-10">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Coloured icon bubble used in the top-right corner of each stat card.
 */
interface StatCardIconProps {
  icon: LucideIcon;
  gradient: string;
  className?: string;
}

export function StatCardIcon({ icon: Icon, gradient, className }: StatCardIconProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 p-2 sm:p-3 rounded-xl bg-gradient-to-br text-white shadow-lg",
        gradient,
        className,
      )}
    >
      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
    </div>
  );
}
