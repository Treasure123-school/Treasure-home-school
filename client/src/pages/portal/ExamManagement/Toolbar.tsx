import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, FileText, Play, Check, Layers, Filter, ArrowUpDown } from 'lucide-react';
import { SearchInput, MiniStatCard, MiniStatGrid } from '@/components/shared';
import type { Class } from '@shared/schema';
import type { ExamManager } from './useExamManager';

/** Stats grid + search + filter/sort bar. */
export function Toolbar({ m }: { m: ExamManager }) {
  const { searchTerm, setSearchTerm, classFilter, setClassFilter, termFilter, setTermFilter, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, sortBy, setSortBy, exams, allClasses, terms, hasActiveFilters, clearAllFilters } = m;
  return (
    <>
    <MiniStatGrid cols={4}>
      <MiniStatCard
        label="Total Assessments"
        value={exams.length}
        icon={FileText}
        color="text-blue-600"
      />
      <MiniStatCard
        label="Published"
        value={exams.filter((e: any) => e.isPublished).length}
        icon={Check}
        color="text-green-600"
      />
      <MiniStatCard
        label="Drafts"
        value={exams.filter((e: any) => !e.isPublished).length}
        icon={Clock}
        color="text-amber-600"
      />
      <MiniStatCard
        label="Scheduled/Live"
        value={exams.filter((exam: any) => {
          if (exam.timerMode !== 'global' || !exam.startTime || !exam.endTime) return false;
          const now = new Date();
          const startTime = new Date(exam.startTime);
          const endTime = new Date(exam.endTime);
          return (now >= startTime && now <= endTime) || now < startTime;
        }).length}
        icon={Play}
        color="text-purple-600"
      />
    </MiniStatGrid>

    <div className="space-y-3">
      <SearchInput
        placeholder="Search assessments..."
        value={searchTerm}
        onChange={setSearchTerm}
        className="w-full sm:max-w-sm"
        data-testid="input-search-exams"
      />

      {/* Class / Term / Category filters + Status filter icon + Sort icon */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]" data-testid="select-filter-class">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {allClasses.map((c: Class) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={termFilter} onValueChange={setTermFilter}>
          <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]" data-testid="select-filter-term">
            <SelectValue placeholder="All Terms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Terms</SelectItem>
            {terms.map((t: any) => (
              <SelectItem key={t.id} value={t.id.toString()}>{t.name} — {t.year}{t.isCurrent ? ' (Current)' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter — icon button opens a dropdown of category choices */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={categoryFilter !== 'all' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              aria-label="Filter by category"
              data-testid="button-filter-category"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">
                {categoryFilter === 'all' ? 'Category' : categoryFilter === 'academic' ? 'Academic' : 'Standalone'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
              <DropdownMenuRadioItem value="all" data-testid="filter-category-all">All Categories</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="academic" data-testid="filter-category-academic">Academic</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="standalone" data-testid="filter-category-standalone">Standalone</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status filter — icon button opens a dropdown of status choices */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={statusFilter !== 'all' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              aria-label="Filter by status"
              data-testid="button-filter-status"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">
                {statusFilter === 'all' ? 'Status' : statusFilter === 'published' ? 'Published' : 'Drafts'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
              <DropdownMenuRadioItem value="all" data-testid="filter-status-all">All Status</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="published" data-testid="filter-status-published">Published</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="draft" data-testid="filter-status-draft">Drafts</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort — icon button opens a dropdown of sort choices */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={sortBy !== 'date-desc' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              aria-label="Sort assessments"
              data-testid="button-sort-exams"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
              <DropdownMenuRadioItem value="date-desc" data-testid="sort-date-desc">Date (Newest)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date-asc" data-testid="sort-date-asc">Date (Oldest)</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="name-asc" data-testid="sort-name-asc">Name (A → Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name-desc" data-testid="sort-name-desc">Name (Z → A)</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="duration-desc" data-testid="sort-duration-desc">Duration (Longest)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="duration-asc" data-testid="sort-duration-asc">Duration (Shortest)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground"
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
    </>
  );
}
