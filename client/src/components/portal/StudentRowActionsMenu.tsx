import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface StudentRowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  testId?: string;
  destructive?: boolean;
}

interface StudentRowActionsMenuProps {
  actions: StudentRowAction[];
  testId?: string;
}

/**
 * Consolidated three-dot actions menu used for both desktop rows and mobile
 * result cards, so row/bulk actions never need their own separate buttons.
 */
export function StudentRowActionsMenu({ actions, testId = 'button-row-actions' }: StudentRowActionsMenuProps) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={testId}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={action.onClick}
            data-testid={action.testId}
            className={action.destructive ? 'text-destructive focus:text-destructive focus:bg-destructive/10' : undefined}
          >
            <action.icon className="mr-2 h-3.5 w-3.5" /> {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
