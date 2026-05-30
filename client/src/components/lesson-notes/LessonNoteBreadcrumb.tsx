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
      <ol className="flex items-center gap-0 min-w-0 overflow-hidden flex-nowrap">
        {items.map((item, i) => {
          const isLast  = i === items.length - 1;
          const isFirst = i === 0;

          const labelEl = (
            <span
              className="block truncate whitespace-nowrap"
              title={item.label}
            >
              {item.label}
            </span>
          );

          return (
            <li
              key={i}
              className={`flex items-center gap-0 min-w-0 shrink ${
                isLast ? 'shrink-0 max-w-[120px] sm:max-w-[200px]' : 'max-w-[72px] sm:max-w-[120px]'
              }`}
            >
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mx-1" />
              )}

              {isLast ? (
                <span
                  className="font-semibold text-foreground text-sm truncate whitespace-nowrap min-w-0"
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <button
                  type="button"
                  onClick={() => navigate(item.href!)}
                  className="flex items-center gap-1 min-w-0 text-muted-foreground hover:text-foreground transition-colors text-sm overflow-hidden"
                  title={item.label}
                >
                  {isFirst && <Home className="w-3.5 h-3.5 shrink-0" />}
                  {labelEl}
                </button>
              ) : (
                <span
                  className="text-muted-foreground text-sm min-w-0 overflow-hidden truncate whitespace-nowrap"
                  title={item.label}
                >
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
