import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { SubjectFilter } from '../types';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
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
  const selectedCategory = filter.categories[0] ?? 'all';

  const handleCategoryChange = (val: string) => {
    onChange({ ...filter, categories: val === 'all' ? [] : [val] });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects…"
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <Select value={selectedCategory} onValueChange={handleCategoryChange}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground self-center whitespace-nowrap shrink-0">
        {visibleSubjects === totalSubjects
          ? `${totalSubjects} subjects`
          : `${visibleSubjects} of ${totalSubjects} shown`}
      </p>
    </div>
  );
}
