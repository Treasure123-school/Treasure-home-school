import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit, Trash2, CheckCircle, XCircle, Send, RotateCcw,
  Globe, ChevronDown, ChevronUp, MoreVertical,
} from "lucide-react";
import { StatusBadge, DifficultyBadge } from "./StatusBadge";
import { TYPE_OPTS, DIFFICULTY_LEFT } from "../constants";

interface QuestionCardProps {
  item:          any;
  isAdmin:       boolean;
  isOwner:       boolean;
  onEdit?:       () => void;
  onDelete?:     () => void;
  onWorkflow:    (action: string, item: any) => void;
  pendingId?:    number;
  pendingAction?: string;
}

export function QuestionCard({
  item, isAdmin, isOwner, onEdit, onDelete, onWorkflow, pendingId, pendingAction,
}: QuestionCardProps) {
  const isThisPending = (_action: string) => pendingId === item.id && pendingAction === _action;
  const anyPending    = pendingId === item.id;
  const [optionsOpen, setOptionsOpen] = useState(false);

  const canEditDelete    = isAdmin || (isOwner && ["draft", "rejected"].includes(item.status));
  const canSubmit        = (isOwner || isAdmin) && ["draft", "rejected"].includes(item.status);
  const canWithdraw      = isOwner && item.status === "submitted";
  const canApproveReject = isAdmin && item.status === "submitted";
  const canPublish       = isAdmin && ["approved", "active"].includes(item.status);
  const canUnpublish     = isAdmin && item.status === "published";

  const hasActions = canEditDelete || canSubmit || canWithdraw || canApproveReject || canPublish || canUnpublish;
  const borderColor = DIFFICULTY_LEFT[item.difficulty] ?? "border-l-gray-300";

  return (
    <div
      className={`group rounded-xl border bg-card border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow`}
      data-testid={`card-question-${item.id}`}
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-2 justify-between">
          <p className="text-sm font-medium leading-snug flex-1 text-foreground">
            {item.questionText}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusBadge status={item.status} />
            {hasActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    disabled={anyPending}
                    data-testid={`btn-actions-${item.id}`}
                  >
                    {anyPending
                      ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      : <MoreVertical className="w-3.5 h-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEditDelete && (
                    <DropdownMenuItem onClick={onEdit} data-testid={`btn-edit-${item.id}`}>
                      <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {canEditDelete && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                      data-testid={`btn-delete-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                  {canSubmit && (
                    <DropdownMenuItem onClick={() => onWorkflow("submit", item)} data-testid={`btn-submit-${item.id}`}>
                      <Send className="w-3.5 h-3.5 mr-2" /> Submit for Review
                    </DropdownMenuItem>
                  )}
                  {canWithdraw && (
                    <DropdownMenuItem onClick={() => onWorkflow("withdraw", item)} data-testid={`btn-withdraw-${item.id}`}>
                      <RotateCcw className="w-3.5 h-3.5 mr-2" /> Withdraw
                    </DropdownMenuItem>
                  )}
                  {canApproveReject && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("approve", item)}
                      className="text-emerald-600 focus:text-emerald-700"
                      data-testid={`btn-approve-${item.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-2" /> Approve
                    </DropdownMenuItem>
                  )}
                  {canApproveReject && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("reject", item)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`btn-reject-${item.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                    </DropdownMenuItem>
                  )}
                  {canPublish && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("publish", item)}
                      className="text-purple-600 focus:text-purple-700"
                      data-testid={`btn-publish-${item.id}`}
                    >
                      <Globe className="w-3.5 h-3.5 mr-2" /> Publish
                    </DropdownMenuItem>
                  )}
                  {canUnpublish && (
                    <DropdownMenuItem
                      onClick={() => onWorkflow("unpublish", item)}
                      className="text-purple-600 focus:text-purple-700"
                      data-testid={`btn-unpublish-${item.id}`}
                    >
                      <Globe className="w-3.5 h-3.5 mr-2" /> Unpublish
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={item.difficulty} />
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
            {TYPE_OPTS.find(t => t.value === item.questionType)?.label ?? item.questionType}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
            {item.points} pt{item.points !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Options toggle (MCQ) */}
        {item.questionType === "multiple_choice" && (item.options?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setOptionsOpen(p => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {optionsOpen
                ? <><ChevronUp className="w-3 h-3" /> Hide options</>
                : <><ChevronDown className="w-3 h-3" /> Show {item.options.length} options</>
              }
            </button>
            {optionsOpen && (
              <ul className="mt-2 space-y-1.5 pl-1">
                {item.options.map((o: any, i: number) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-xs rounded px-2 py-1 ${
                      o.isCorrect
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="flex-shrink-0 font-bold">
                      {o.isCorrect ? "✓" : "○"}
                    </span>
                    {o.optionText}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {item.status === "rejected" && item.rejectionReason && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-2.5">
            <p className="text-xs text-red-700 dark:text-red-300">
              <strong>Rejection reason:</strong> {item.rejectionReason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
