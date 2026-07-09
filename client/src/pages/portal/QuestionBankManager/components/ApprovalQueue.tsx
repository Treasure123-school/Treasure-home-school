import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { StatusBadge, DifficultyBadge } from "./StatusBadge";
import { PaginationBar } from "./PaginationBar";
import { PAGE_SIZE } from "../constants";

interface ApprovalQueueProps {
  onWorkflow: (action: string, item: any) => void;
}

export function ApprovalQueue({ onWorkflow }: ApprovalQueueProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<any>({
    queryKey:  ["/api/question-bank/pending", page],
    queryFn:   () => apiRequest("GET", `/api/question-bank/pending?page=${page}&pageSize=${PAGE_SIZE}`).then(r => r.json()),
    staleTime: 20_000,
  });

  const items: any[] = data?.items ?? [];
  const pg = {
    page:       data?.page       ?? 1,
    totalPages: data?.totalPages ?? 1,
    total:      data?.total      ?? 0,
    pageSize:   PAGE_SIZE,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground rounded-2xl border-2 border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">All caught up!</p>
            <p className="text-xs">No questions pending review. Submitted questions will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="rounded-xl border border-l-4 border-l-amber-400 bg-card shadow-sm"
              data-testid={`card-pending-${item.id}`}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3 justify-between">
                  <p className="text-sm font-medium leading-snug flex-1">{item.questionText}</p>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DifficultyBadge difficulty={item.difficulty} />
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground capitalize">
                    {item.questionType?.replace(/_/g, " ")}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
                    By: {item.submittedByName ?? item.createdBy ?? "unknown"}
                  </span>
                </div>
                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    onClick={() => onWorkflow("approve", item)}
                    data-testid={`btn-approve-queue-${item.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => onWorkflow("reject", item)}
                    data-testid={`btn-reject-queue-${item.id}`}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <PaginationBar {...pg} onPage={setPage} />
    </div>
  );
}
