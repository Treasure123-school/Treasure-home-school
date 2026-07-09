import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { BarChart3, ChevronDown, SlidersHorizontal } from 'lucide-react';

interface ClassOption {
  id: number;
  name: string;
}

interface TermOption {
  id: number;
  name: string;
  year: string | number;
}

interface ReportCardFiltersProps {
  classes: ClassOption[];
  terms: TermOption[];
  selectedClass: string;
  onClassChange: (value: string) => void;
  selectedTerm: string;
  onTermChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  selectedGradingScale: string;
  onGradingScaleChange: (value: string) => void;
  availableGradingScales: string[];
  testWeight: number;
  examWeight: number;
}

/**
 * Class / Term / Status filter bar for the teacher report cards page,
 * with a collapsible "advanced filters" section for the grading scale.
 */
export function ReportCardFilters({
  classes,
  terms,
  selectedClass,
  onClassChange,
  selectedTerm,
  onTermChange,
  statusFilter,
  onStatusFilterChange,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  selectedGradingScale,
  onGradingScaleChange,
  availableGradingScales,
  testWeight,
  examWeight,
}: ReportCardFiltersProps) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-none sm:w-40">
            <Label className="text-xs text-muted-foreground">Class</Label>
            <Select value={selectedClass} onValueChange={onClassChange}>
              <SelectTrigger className="h-9" data-testid="select-class">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="no-classes" disabled>
                    No classes found
                  </SelectItem>
                ) : (
                  classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:flex-none sm:w-44">
            <Label className="text-xs text-muted-foreground">Term</Label>
            <Select value={selectedTerm} onValueChange={onTermChange}>
              <SelectTrigger className="h-9" data-testid="select-term">
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id.toString()}>
                    {term.name} ({term.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[100px] flex-1 sm:flex-none sm:w-32">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="h-9" data-testid="select-status-filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAdvancedFilters}
            className="h-9 gap-1.5"
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">More</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </Button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <BarChart3 className="w-3 h-3" />
            <span>Test {testWeight}% | Exam {examWeight}%</span>
          </div>
        </div>

        <Collapsible open={showAdvancedFilters}>
          <CollapsibleContent className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1 min-w-[140px]">
                <Label className="text-xs text-muted-foreground">Grading Scale</Label>
                <Select value={selectedGradingScale} onValueChange={onGradingScaleChange}>
                  <SelectTrigger className="h-9" data-testid="select-grading-scale">
                    <SelectValue placeholder="Grading Scale" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGradingScales.map((scaleName) => (
                      <SelectItem key={scaleName} value={scaleName}>{scaleName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
