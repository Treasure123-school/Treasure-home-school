import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
  className?: string;
}

export default function LessonNoteBreadcrumb({ items, className = '' }: Props) {
  const [, navigate] = useLocation();

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center min-w-0 overflow-hidden ${className}`}
    >
      <ol className="flex items-center gap-0.5 min-w-0 flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isFirst = i === 0;
          return (
            <li key={i} className="flex items-center gap-0.5 min-w-0">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mx-0.5" />
              )}
              {isLast ? (
                <span
                  className="font-semibold text-foreground text-sm truncate max-w-[160px] sm:max-w-[220px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <button
                  type="button"
                  onClick={() => navigate(item.href!)}
                  className={`text-muted-foreground hover:text-foreground transition-colors text-sm truncate max-w-[90px] sm:max-w-[140px] ${
                    isFirst ? 'flex items-center gap-1' : ''
                  }`}
                >
                  {isFirst && <Home className="w-3.5 h-3.5 shrink-0" />}
                  <span>{item.label}</span>
                </button>
              ) : (
                <span className="text-muted-foreground text-sm truncate max-w-[90px] sm:max-w-[140px]">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
