import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// ── Single quick-action button ─────────────────────────────────────────────

interface QuickActionProps {
  title: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  className?: string;
}

function QuickActionInner({ title, icon: Icon, className, onClick }: QuickActionProps) {
  return (
    <Button
      variant="outline"
      className={cn(
        "w-full justify-start h-auto py-3 px-4",
        "border-l-4 border-l-primary",
        "hover:bg-primary/5 group transition-all",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="font-normal text-sm">{title}</span>
      </div>
    </Button>
  );
}

export function QuickAction({ href, ...props }: QuickActionProps) {
  if (href) {
    return (
      <Link href={href}>
        <QuickActionInner {...props} />
      </Link>
    );
  }
  return <QuickActionInner {...props} />;
}

// ── Grid of quick-action buttons inside a Card ─────────────────────────────
// Eliminates the repeated Card + CardHeader + CardContent boilerplate in
// every dashboard that renders a list of QuickAction items.

interface QuickActionItem {
  title: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}

interface QuickActionGridProps {
  title: string;
  titleIcon?: LucideIcon;
  items: QuickActionItem[];
  cols?: 1 | 2 | 3;
  className?: string;
}

const COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
};

export function QuickActionGrid({
  title,
  titleIcon: TitleIcon,
  items,
  cols = 2,
  className,
}: QuickActionGridProps) {
  return (
    <Card className={className}>
      <CardHeader className="p-4 sm:p-5 md:p-6">
        <CardTitle className="flex items-center text-sm sm:text-base font-semibold">
          {TitleIcon && <TitleIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
        <div className={cn("grid gap-2", COLS_CLASS[cols])}>
          {items.map((item) => (
            <QuickAction key={item.title} {...item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
