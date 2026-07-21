/** Student list — search box, mobile cards, desktop table, pagination. */
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, User, Eye, CheckCircle, FileCheck, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPosition, getGradeBadgeClasses } from '@shared/grading-utils';

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
      <CheckCircle className="w-3 h-3 mr-0.5" aria-hidden /><span className="sr-only">Published</span>
    </Badge>
  );
  if (status === 'finalized') return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/30">
      <FileCheck className="w-3 h-3 mr-0.5" aria-hidden /><span className="sr-only">Finalized</span>
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
      <Clock className="w-3 h-3 mr-0.5" aria-hidden /><span className="sr-only">Draft</span>
    </Badge>
  );
}

interface SortConfig { field: string; direction: 'asc' | 'desc' }
interface SortHeaderProps { label: string; field: string; sort: SortConfig; onSort: (f: string) => void; 'data-testid'?: string }

function SortHeader({ label, field, sort, onSort, ...props }: SortHeaderProps) {
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onSort(field)} {...props}>
      <div className="flex items-center gap-1">{label}
        <span className="text-xs opacity-50">{sort.field === field ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </div>
    </TableHead>
  );
}

interface Props {
  paginatedCards: any[];
  filteredCount: number;
  totalCount: number;
  reportCardCount: number;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  sort: SortConfig;
  onSort: (field: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onView: (rc: any) => void;
}

export function ReportCardStudentTable({
  paginatedCards, filteredCount, reportCardCount, searchTerm, onSearchChange,
  sort, onSort, currentPage, totalPages, onPageChange, onView,
}: Props) {
  const startIndex = (currentPage - 1) * 10;

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input placeholder="Search students..." value={searchTerm} onChange={e => onSearchChange(e.target.value)}
          className="pl-10 h-9" data-testid="input-search-students" />
      </div>

      {/* Mobile */}
      <div className="block sm:hidden space-y-2">
        {paginatedCards.map((rc: any) => (
          <div key={rc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer"
            onClick={() => onView(rc)} data-testid={`mobile-row-${rc.id}`}>
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {rc.position || '-'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{rc.studentName}</div>
              <div className="text-xs text-muted-foreground">{rc.averagePercentage || 0}% avg</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge className={`text-xs px-2 ${getGradeBadgeClasses(rc.overallGrade)}`}>{rc.overallGrade || '-'}</Badge>
              <StatusBadge status={rc.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Pos" field="position" sort={sort} onSort={onSort} data-testid="sort-position" />
              <SortHeader label="Student" field="studentName" sort={sort} onSort={onSort} data-testid="sort-name" />
              <TableHead>Username</TableHead>
              <SortHeader label="Average" field="averagePercentage" sort={sort} onSort={onSort} data-testid="sort-average" />
              <SortHeader label="Grade" field="overallGrade" sort={sort} onSort={onSort} data-testid="sort-grade" />
              <SortHeader label="Status" field="status" sort={sort} onSort={onSort} data-testid="sort-status" />
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCards.map((rc: any) => (
              <TableRow key={rc.id} data-testid={`row-report-${rc.id}`}>
                <TableCell className="font-medium">
                  {rc.position ? formatPosition(rc.position) : '-'} of {rc.totalStudentsInClass || reportCardCount}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {rc.studentPhoto ? <AvatarImage src={rc.studentPhoto} alt={rc.studentName} /> : null}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {rc.studentName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{rc.studentName}</span>
                  </div>
                </TableCell>
                <TableCell><span className="text-sm text-muted-foreground font-mono">{rc.studentUsername || '-'}</span></TableCell>
                <TableCell>
                  <span className={(rc.averagePercentage || 0) >= 50 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {rc.averagePercentage || 0}%
                  </span>
                </TableCell>
                <TableCell><Badge className={getGradeBadgeClasses(rc.overallGrade)}>{rc.overallGrade || '-'}</Badge></TableCell>
                <TableCell><StatusBadge status={rc.status} /></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => onView(rc)} data-testid={`button-view-${rc.id}`}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Showing {startIndex + 1}–{Math.min(startIndex + 10, filteredCount)} of {filteredCount}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1} className="h-8 w-8" data-testid="pagination-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium px-2">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages} className="h-8 w-8" data-testid="pagination-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
