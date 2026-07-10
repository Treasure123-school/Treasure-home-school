import { Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StudentResultsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  gradeFilter?: string;
  onGradeFilterChange?: (value: string) => void;
  gradeOptions?: string[];
  onExport: () => void;
  searchPlaceholder?: string;
}

/**
 * Single-line, responsive filter/export bar shared by exam result tables.
 * On mobile the search box shrinks and the export button collapses to an icon-only button.
 */
export function StudentResultsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  gradeFilter,
  onGradeFilterChange,
  gradeOptions,
  onExport,
  searchPlaceholder = 'Search students…',
}: StudentResultsToolbarProps) {
  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap">
      <div className="relative flex-1 min-w-[110px] sm:flex-initial">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          data-testid="input-student-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm w-full sm:w-48"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="h-8 text-sm w-24 sm:w-28 shrink-0" data-testid="select-status-filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pass">Pass</SelectItem>
          <SelectItem value="fail">Fail</SelectItem>
        </SelectContent>
      </Select>
      {gradeOptions && gradeOptions.length > 0 && onGradeFilterChange && (
        <Select value={gradeFilter} onValueChange={onGradeFilterChange}>
          <SelectTrigger className="h-8 text-sm w-24 sm:w-28 shrink-0" data-testid="select-grade-filter">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {gradeOptions.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        className="h-8 gap-1.5 shrink-0 px-2 sm:px-3"
        data-testid="button-export-students"
        title="Export CSV"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export CSV</span>
      </Button>
    </div>
  );
}
