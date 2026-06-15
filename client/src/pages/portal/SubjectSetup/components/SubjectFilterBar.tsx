import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import type { SubjectFilter } from '../types';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
];

interface SubjectFilterBarProps {
  filter: SubjectFilter;
  onChange: (filter: SubjectFilter) => void;
  totalSubjects: number;
  visibleSubjects: number;
}

export function SubjectFilterBar({ filter, onChange, totalSubjects, visibleSubjects }: SubjectFilterBarProps) {
  const toggleCategory = (cat: string) => {
    const next = filter.categories.includes(cat)
      ? filter.categories.filter((c) => c !== cat)
      : [...filter.categories, cat];
    onChange({ ...filter, categories: next });
  };

  const clearSearch = () => onChange({ ...filter, search: '' });
  const clearAll = () => onChange({ search: '', categories: [] });
  const hasActiveFilter = filter.search.length > 0 || filter.categories.length > 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
      <div className="relative flex-1 min-w-0 w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search subjects..."
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          className="pl-8 pr-8 h-8 text-sm bg-background"
        />
        {filter.search && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => {
          const active = filter.categories.includes(cat.value);
          return (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                ${active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
                }
              `}
            >
              {cat.label}
            </button>
          );
        })}

        {hasActiveFilter && (
          <button
            onClick={clearAll}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {visibleSubjects === totalSubjects ? (
          <span>{totalSubjects} subjects</span>
        ) : (
          <span>
            <span className="font-semibold text-foreground">{visibleSubjects}</span> of {totalSubjects} shown
          </span>
        )}
      </div>
    </div>
  );
}
