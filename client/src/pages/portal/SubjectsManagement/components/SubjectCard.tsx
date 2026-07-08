import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical, Archive, ArchiveRestore } from 'lucide-react';
import { getCategoryInfo, isArchived } from '../utils';
import type { SubjectAction } from '../types';

interface SubjectCardProps {
  subject: any;
  onEdit: (subject: any) => void;
  onAction: (subject: any, action: SubjectAction) => void;
}

export function SubjectCard({ subject, onEdit, onAction }: SubjectCardProps) {
  const cat = getCategoryInfo(subject.category || 'general');
  const Icon = cat.icon;
  const archived = isArchived(subject);

  return (
    <Card
      className={`group transition-all ${archived ? 'opacity-60 border-dashed' : 'hover:border-primary/40 hover:shadow-sm'}`}
      data-testid={`card-subject-${subject.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cat.iconBg}`}>
              <Icon className={`w-4 h-4 ${cat.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate" data-testid={`text-subject-name-${subject.id}`}>
                {subject.name}
              </p>
              <Badge variant="outline" className="text-[10px] mt-0.5" data-testid={`text-subject-code-${subject.id}`}>
                {subject.code}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`text-[10px] border-0 ${cat.color}`} data-testid={`text-category-${subject.id}`}>
              {cat.label}
            </Badge>
            {archived && (
              <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" data-testid={`badge-archived-${subject.id}`}>
                Archived
              </Badge>
            )}
          </div>
        </div>

        {subject.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{subject.description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-border/50">
          {!archived ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onEdit(subject)}
              data-testid={`button-edit-subject-${subject.id}`}
            >
              <Edit className="w-3 h-3 mr-1" /> Edit
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => onAction(subject, 'restore')}
              data-testid={`button-restore-subject-${subject.id}`}
            >
              <ArchiveRestore className="w-3 h-3 mr-1" /> Restore
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                data-testid={`button-actions-${subject.id}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!archived && (
                <DropdownMenuItem
                  onClick={() => onAction(subject, 'archive')}
                  data-testid={`button-archive-subject-${subject.id}`}
                >
                  <Archive className="h-4 w-4 mr-2" /> Archive
                </DropdownMenuItem>
              )}
              {!archived && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onAction(subject, 'delete')}
                data-testid={`button-delete-subject-${subject.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
