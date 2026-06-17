import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

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
        "w-full justify-start h-auto py-3 px-4 border-l-4 border-l-transparent",
        "hover:border-l-primary bg-gradient-to-r hover:from-primary/5 group transition-all",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="font-medium text-sm">{title}</span>
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
