import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  page:       number;
  totalPages: number;
  total:      number;
  pageSize:   number;
  onPage:     (p: number) => void;
}

export function PaginationBar({ page, totalPages, total, pageSize, onPage }: PaginationBarProps) {
  if (totalPages <= 1 && total <= pageSize) return null;
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between pt-4 border-t mt-4">
      <span className="text-xs text-muted-foreground">
        {from}–{to} of <strong>{total}</strong> question{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant="outline" className="h-7 w-7 p-0"
          disabled={page <= 1} onClick={() => onPage(page - 1)}
          data-testid="btn-prev-page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs px-2 font-medium tabular-nums">
          {page} / {totalPages || 1}
        </span>
        <Button
          size="sm" variant="outline" className="h-7 w-7 p-0"
          disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          data-testid="btn-next-page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
