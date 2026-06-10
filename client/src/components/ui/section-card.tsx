import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: string;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  headerPadding?: "normal" | "compact";
  "data-testid"?: string;
}

/**
 * Standard card with icon + title header — use everywhere a card needs
 * a small icon square, a bold label, and optional muted subtitle.
 *
 * Default contentClassName = "px-5 pb-5 space-y-4"
 * For custom padding (e.g. full-bleed tables) pass contentClassName="px-0 pb-0"
 */
export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  rightContent,
  children,
  contentClassName = "px-5 pb-5 space-y-4",
  headerPadding = "normal",
  "data-testid": testId,
}: SectionCardProps) {
  const headerCls = headerPadding === "compact" ? "pb-3 pt-4 px-5" : "pb-3 pt-5 px-5";

  return (
    <Card className="shadow-sm" data-testid={testId}>
      <CardHeader className={headerCls}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-sm font-semibold">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="truncate">{title}</span>
            {subtitle && (
              <span className="text-xs font-normal text-muted-foreground ml-0.5 shrink-0">
                {subtitle}
              </span>
            )}
          </div>
          {rightContent && (
            <div className="flex items-center gap-1.5 shrink-0">{rightContent}</div>
          )}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>
        {children}
      </CardContent>
    </Card>
  );
}
