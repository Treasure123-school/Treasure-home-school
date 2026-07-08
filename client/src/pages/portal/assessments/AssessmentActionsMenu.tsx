import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Edit, Eye, MoreVertical, Play, Settings, Trash2 } from 'lucide-react';
import type { Exam } from '@shared/schema';

/**
 * DeleteAction / DropdownMenu — isolated context-menu + deletion-trigger logic
 * shared by both the mobile card and desktop table row.
 *
 * The delete item never deletes directly: it only calls `onRequestDelete`,
 * which asks the parent to open the shared confirmation dialog
 * (see DeleteAssessmentDialog). The actual mutation only runs after the
 * user confirms there, and the item only leaves the list after the backend
 * confirms success (see the delete mutation in ExamManagement.tsx).
 */
export interface AssessmentActionsMenuProps {
  exam: Exam;
  /** Mobile renders a plain outline icon button; desktop renders a ghost icon button
   *  and includes a "Manage Questions" entry (mobile has its own dedicated button). */
  variant: 'mobile' | 'desktop';
  isPublishToggling: boolean;
  isDeleting: boolean;
  onManageQuestions: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onPreview: (exam: Exam) => void;
  onEditSettings: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
}

export function AssessmentActionsMenu({
  exam,
  variant,
  isPublishToggling,
  isDeleting,
  onManageQuestions,
  onTogglePublish,
  onPreview,
  onEditSettings,
  onRequestDelete,
}: AssessmentActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'mobile' ? (
          <Button variant="outline" size="icon" data-testid={`button-exam-actions-${exam.id}`}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-exam-actions-${exam.id}`}>
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {variant === 'desktop' && (
          <DropdownMenuItem
            onClick={() => onManageQuestions(exam)}
            className="cursor-pointer"
            data-testid={`menu-manage-questions-${exam.id}`}
          >
            <Edit className="w-4 h-4 mr-2 text-primary" />
            Manage Questions
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => onTogglePublish(exam)}
          disabled={isPublishToggling}
          className="cursor-pointer"
          data-testid={variant === 'mobile' ? `dropdown-toggle-publish-${exam.id}` : `menu-toggle-publish-${exam.id}`}
        >
          <Play className={variant === 'desktop' ? `w-4 h-4 mr-2 ${exam.isPublished ? 'text-amber-500' : 'text-green-500'}` : 'w-4 h-4 mr-2'} />
          {isPublishToggling
            ? (exam.isPublished ? 'Unpublishing...' : 'Publishing...')
            : (exam.isPublished ? 'Unpublish' : 'Publish')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPreview(exam)}
          className="cursor-pointer"
          data-testid={variant === 'mobile' ? `dropdown-preview-exam-${exam.id}` : `menu-preview-exam-${exam.id}`}
        >
          <Eye className={variant === 'desktop' ? 'w-4 h-4 mr-2 text-purple-500' : 'w-4 h-4 mr-2'} />
          {variant === 'desktop' ? 'Preview Exam' : 'Preview'}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onEditSettings(exam)}
          className="cursor-pointer"
          data-testid={variant === 'mobile' ? `dropdown-edit-exam-${exam.id}` : `menu-edit-exam-${exam.id}`}
        >
          {variant === 'desktop' ? <Settings className="w-4 h-4 mr-2 text-gray-500" /> : <Edit className="w-4 h-4 mr-2" />}
          {variant === 'desktop' ? 'Exam Settings' : 'Edit Exam'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            if (!isDeleting) onRequestDelete(exam);
          }}
          disabled={isDeleting}
          className="text-destructive focus:text-destructive cursor-pointer"
          data-testid={variant === 'mobile' ? `dropdown-delete-exam-${exam.id}` : `menu-delete-exam-${exam.id}`}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isDeleting ? 'Deleting...' : 'Delete Exam'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
