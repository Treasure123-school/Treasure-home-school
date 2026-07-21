/**
 * Action bar shown inside the report card preview dialog.
 * Displays the current status badge and export / workflow action buttons.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCircle, Clock, Download, FileCheck, FileText, Loader2, Printer, RefreshCw, Send, Undo2 } from 'lucide-react';

interface Props {
  fullReportCard: any;
  isDownloading: boolean;
  recalculatePending: boolean;
  updateStatusPending: boolean;
  onPrint: () => void;
  onExportPDF: () => void;
  onExportImage: () => void;
  onRefresh: () => void;
  onFinalize: () => void;
  onRevertDraft: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Editing enabled',
  finalized: 'Awaiting admin approval',
  published: 'Visible to students and parents',
};

export function ReportCardActionBar({
  fullReportCard, isDownloading, recalculatePending, updateStatusPending,
  onPrint, onExportPDF, onExportImage, onRefresh, onFinalize, onRevertDraft,
}: Props) {
  const { status } = fullReportCard;

  return (
    <div className="px-2 py-2 sm:px-4 sm:py-3 border-b bg-muted/30 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {status === 'draft' && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              <Clock className="w-3 h-3 mr-1" />Draft
            </Badge>
          )}
          {status === 'finalized' && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-xs">
              <FileCheck className="w-3 h-3 mr-1" />Awaiting Approval
            </Badge>
          )}
          {status === 'published' && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />Published
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden md:inline">
            {STATUS_LABEL[status] || ''}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button variant="outline" size="icon" onClick={onPrint} aria-label="Print" data-testid="button-print">
            <Printer className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDownloading} aria-label="Export" data-testid="button-download">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportPDF} data-testid="menu-export-pdf">
                <FileText className="w-4 h-4 mr-2" />Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportImage} data-testid="menu-export-image">
                <Download className="w-4 h-4 mr-2" />Export as Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" onClick={onRefresh}
            disabled={recalculatePending || status !== 'draft'}
            aria-label="Recalculate scores" data-testid="button-recalculate-scores">
            {recalculatePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          {status === 'draft' && (
            <Button onClick={onFinalize} disabled={updateStatusPending} size="sm" className="text-xs sm:text-sm h-9" data-testid="button-finalize">
              <Send className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Finalize</span>
            </Button>
          )}
          {status === 'finalized' && (
            <Button variant="outline" size="sm" onClick={onRevertDraft} disabled={updateStatusPending}
              className="text-xs sm:text-sm h-9 text-amber-600 hover:text-amber-700" data-testid="button-revert-draft">
              <Undo2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Revert to Draft</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
