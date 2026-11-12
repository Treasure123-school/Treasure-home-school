import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import type { CalendarSession } from '@/hooks/useAcademicCalendar';
import { Clock, ChevronRight, MoreVertical, Edit, Trash2, Play, GraduationCap } from 'lucide-react';

interface SessionHistoryProps {
  historySessions: CalendarSession[];
  allTerms: { id: number; sessionId?: number | null }[];
  isAdmin: boolean;
  showHistory: boolean;
  onToggle: () => void;
  onReactivate: (id: number) => void;
  onEdit: (s: CalendarSession) => void;
  onDelete: (id: number) => void;
}

export function SessionHistory({ historySessions, allTerms, isAdmin, showHistory, onToggle, onReactivate, onEdit, onDelete }: SessionHistoryProps) {
  if (historySessions.length === 0) return null;

  return (
    <Card data-testid="card-session-history">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50">
              <Clock className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-base">Session History</CardTitle>
              <CardDescription className="text-xs">{historySessions.length} past / archived session{historySessions.length !== 1 ? 's' : ''}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} data-testid="button-toggle-history">
            <ChevronRight className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
            <span className="ml-1 text-xs">{showHistory ? 'Hide' : 'Show'}</span>
          </Button>
        </div>
      </CardHeader>
      {showHistory && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {historySessions.map(s => {
              const termCount = allTerms.filter(t => t.sessionId === s.id).length;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors" data-testid={`row-history-session-${s.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.year} · {termCount} term{termCount !== 1 ? 's' : ''} · {s.startDate} → {s.endDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="secondary" className="text-xs capitalize">{s.status}</Badge>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-history-actions-${s.id}`}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onReactivate(s.id)} data-testid={`item-reactivate-${s.id}`}>
                            <Play className="h-3.5 w-3.5 mr-2 text-emerald-500" />Reactivate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(s)} data-testid={`item-edit-history-${s.id}`}>
                            <Edit className="h-3.5 w-3.5 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={e => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                                data-testid={`item-delete-history-${s.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "{s.name}"? Sessions with linked terms cannot be deleted — archive it instead.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(s.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
