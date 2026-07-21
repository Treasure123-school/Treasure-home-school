/**
 * Pure filtering, sorting, pagination and statistics derivation for report cards.
 * Stateless — accepts values from the page hook and returns derived data.
 */
import { useEffect } from 'react';
import type { SortField, SortDir } from '@/hooks/useTeacherReportCardPage';

const ITEMS_PER_PAGE = 10;
const STATUS_ORDER: Record<string, number> = { draft: 1, finalized: 2, published: 3 };

interface Options {
  reportCards: any[];
  searchTerm: string;
  statusFilter: string;
  sortField: SortField;
  sortDirection: SortDir;
  currentPage: number;
  setCurrentPage: (p: number) => void;
}

export function useReportCardFilters({
  reportCards, searchTerm, statusFilter,
  sortField, sortDirection, currentPage, setCurrentPage,
}: Options) {

  const filtered = reportCards
    .filter((rc: any) => {
      const q = searchTerm.toLowerCase();
      return (
        rc.studentName?.toLowerCase().includes(q) ||
        rc.admissionNumber?.toLowerCase().includes(q) ||
        rc.studentUsername?.toLowerCase().includes(q)
      ) && (statusFilter === 'all' || rc.status === statusFilter);
    })
    .sort((a: any, b: any) => {
      const vals: Record<string, [any, any]> = {
        position:          [a.position || 999, b.position || 999],
        studentName:       [(a.studentName || '').toLowerCase(), (b.studentName || '').toLowerCase()],
        averagePercentage: [a.averagePercentage || 0, b.averagePercentage || 0],
        overallGrade:      [a.overallGrade || 'Z', b.overallGrade || 'Z'],
        status:            [STATUS_ORDER[a.status] || 4, STATUS_ORDER[b.status] || 4],
      };
      const [av, bv] = vals[sortField] || [0, 0];
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDirection === 'asc' ? 1 : -1);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to last valid page if filtered results shrink
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filtered.length, totalPages]);

  // Statistics — only students with actual scores (> 0) affect highest/lowest/average.
  // Students with no exams (averagePercentage === 0 or null) are intentionally excluded
  // so unscored cards don't skew the class statistics.
  const scoredCards = reportCards.filter(
    (rc: any) => rc.averagePercentage !== null && rc.averagePercentage !== undefined && rc.averagePercentage > 0
  );

  const statistics = reportCards.length > 0 ? {
    totalStudents:  reportCards.length,
    passedStudents: reportCards.filter((rc: any) => (rc.averagePercentage || 0) >= 50).length,
    failedStudents: reportCards.filter((rc: any) => (rc.averagePercentage || 0) < 50).length,
    classAverage: scoredCards.length > 0
      ? Math.round((scoredCards.reduce((s: number, rc: any) => s + (rc.averagePercentage || 0), 0) / scoredCards.length) * 10) / 10
      : 0,
    classHighest: scoredCards.length > 0 ? Math.max(...scoredCards.map((rc: any) => rc.averagePercentage as number)) : 0,
    classLowest:  scoredCards.length > 0 ? Math.min(...scoredCards.map((rc: any) => rc.averagePercentage as number)) : 0,
    draftCount:     reportCards.filter((rc: any) => rc.status === 'draft').length,
    finalizedCount: reportCards.filter((rc: any) => rc.status === 'finalized').length,
    publishedCount: reportCards.filter((rc: any) => rc.status === 'published').length,
  } : null;

  return { filtered, paginated, totalPages, statistics };
}
