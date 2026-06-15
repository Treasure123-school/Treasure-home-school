import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Edit, Search, BookOpen, Trash2, GraduationCap,
  Palette, Briefcase, BookMarked, MoreVertical, AlertTriangle,
  CheckCircle2, Loader2, BookText, FileText, ClipboardList,
  Calendar, Users, BarChart2, Library, Archive, ArchiveRestore, Ban,
} from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectAudit {
  classLinks: number;
  studentAssignments: number;
  exams: number;
  assignments: number;
  lessonNotes: number;
  syllabusTopics: number;
  questionBanks: number;
  reportCardItems: number;
  continuousAssessments: number;
  timetableEntries: number;
  studyResources: number;
  teacherAssignments: number;
  isClean: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_CATEGORIES = [
  {
    value: 'general',
    label: 'General',
    description: 'For all classes (KG1–SS3)',
    icon: BookMarked,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'science',
    label: 'Science',
    description: 'For SS1–SS3 Science dept',
    icon: GraduationCap,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'art',
    label: 'Art',
    description: 'For SS1–SS3 Art dept',
    icon: Palette,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    description: 'For SS1–SS3 Commercial dept',
    icon: Briefcase,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
] as const;

const AUDIT_FIELDS: { key: keyof Omit<SubjectAudit, 'isClean'>; label: string; icon: any }[] = [
  { key: 'exams', label: 'Exams', icon: ClipboardList },
  { key: 'lessonNotes', label: 'Lesson notes', icon: BookText },
  { key: 'questionBanks', label: 'Question banks', icon: Library },
  { key: 'assignments', label: 'Assignments', icon: FileText },
  { key: 'syllabusTopics', label: 'Syllabus topics', icon: Library },
  { key: 'reportCardItems', label: 'Report card entries', icon: BarChart2 },
  { key: 'continuousAssessments', label: 'CA records', icon: BarChart2 },
  { key: 'classLinks', label: 'Class links', icon: BookOpen },
  { key: 'studentAssignments', label: 'Student assignments', icon: Users },
  { key: 'timetableEntries', label: 'Timetable entries', icon: Calendar },
  { key: 'studyResources', label: 'Study resources', icon: BookOpen },
  { key: 'teacherAssignments', label: 'Teacher assignments', icon: Users },
];

const subjectFormSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
  category: z.enum(['general', 'science', 'art', 'commercial']).default('general'),
});

type SubjectForm = z.infer<typeof subjectFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryInfo(cat: string) {
  return SUBJECT_CATEGORIES.find(c => c.value === cat) ?? SUBJECT_CATEGORIES[0];
}

function pluralise(n: number, singular: string) {
  return `${n.toLocaleString()} ${n === 1 ? singular : singular + 's'}`;
}

function isArchived(subject: any) {
  return subject?.status === 'archived' || subject?.isActive === false;
}

// ─── SubjectCard ──────────────────────────────────────────────────────────────

interface SubjectCardProps {
  subject: any;
  onEdit: (subject: any) => void;
  onAction: (subject: any, action: 'archive' | 'restore' | 'delete') => void;
}

function SubjectCard({ subject, onEdit, onAction }: SubjectCardProps) {
  const cat = getCategoryInfo(subject.category || 'general');
  const Icon = cat.icon;
  const archived = isArchived(subject);

  return (
    <Card
      className={`transition-all ${archived ? 'opacity-60 border-dashed' : 'hover:border-primary/40 hover:shadow-sm'}`}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                data-testid={`button-actions-${subject.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!archived && (
                <DropdownMenuItem onClick={() => onEdit(subject)} data-testid={`button-edit-subject-${subject.id}`}>
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {!archived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAction(subject, 'archive')}
                    data-testid={`button-archive-subject-${subject.id}`}
                  >
                    <Archive className="h-4 w-4 mr-2" /> Archive
                  </DropdownMenuItem>
                </>
              )}
              {archived && (
                <DropdownMenuItem
                  onClick={() => onAction(subject, 'restore')}
                  data-testid={`button-restore-subject-${subject.id}`}
                >
                  <ArchiveRestore className="h-4 w-4 mr-2" /> Restore
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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

        <div className="flex flex-wrap gap-1.5">
          <Badge className={`text-[10px] border-0 ${cat.color}`} data-testid={`text-category-${subject.id}`}>
            {cat.label}
          </Badge>
          {archived && (
            <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" data-testid={`badge-archived-${subject.id}`}>
              Archived
            </Badge>
          )}
        </div>

        {subject.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{subject.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CategoryStatCard ─────────────────────────────────────────────────────────

function CategoryStatCard({
  category,
  count,
  isActive,
  onClick,
}: {
  category: typeof SUBJECT_CATEGORIES[number];
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;
  return (
    <Card
      className={`p-3 cursor-pointer transition-all border-2 ${isActive ? 'border-primary' : 'border-transparent hover:border-primary/30'}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${category.iconBg}`}>
          <Icon className={`h-4 w-4 ${category.iconColor}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground leading-none">{category.label}</p>
          <p className="text-xl font-bold leading-tight">{count}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── SubjectActionDialog ──────────────────────────────────────────────────────

interface SubjectActionDialogProps {
  subject: any;
  action: 'archive' | 'restore' | 'delete' | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function SubjectActionDialog({ subject, action, onConfirm, onCancel, isPending }: SubjectActionDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const { data: audit, isLoading: isAuditing } = useQuery<SubjectAudit>({
    queryKey: ['/api/subjects', subject?.id, 'audit'],
    queryFn: async () => (await apiRequest('GET', `/api/subjects/${subject.id}/audit`)).json(),
    enabled: !!subject && !!action,
    staleTime: 0,
  });

  const linkedItems = audit
    ? AUDIT_FIELDS.filter(f => (audit[f.key] ?? 0) > 0)
    : [];

  const isOpen = !!subject && !!action;

  function handleOpenChange(open: boolean) {
    if (!open) { setConfirmText(''); onCancel(); }
  }

  if (!subject || !action) return null;

  const confirmPhrase = subject.name ?? '';
  const canDelete = confirmText.toLowerCase() === confirmPhrase.toLowerCase() && !isAuditing && !!audit?.isClean;
  const hasLinked = !audit?.isClean;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'archive' && <><Archive className="h-5 w-5 text-amber-600 shrink-0" /> Archive Subject</>}
            {action === 'restore' && <><ArchiveRestore className="h-5 w-5 text-green-600 shrink-0" /> Restore Subject</>}
            {action === 'delete' && <><Trash2 className="h-5 w-5 text-destructive shrink-0" /> Permanently Delete Subject</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Subject name */}
          <p className="text-sm text-muted-foreground">
            {action === 'archive' && <>Archive <strong className="text-foreground">{subject.name}</strong>? It will be hidden from all new assignments but all historical data is preserved.</>}
            {action === 'restore' && <>Restore <strong className="text-foreground">{subject.name}</strong>? It will become active and available in all dropdowns again.</>}
            {action === 'delete' && <>You are about to permanently delete <strong className="text-foreground">{subject.name}</strong>. This cannot be undone.</>}
          </p>

          {/* Dependency summary */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linked Records — {subject.name}
            </p>
            {isAuditing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking linked data…
              </div>
            ) : audit?.isClean ? (
              <div className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No linked records found. Safe to delete.</span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {linkedItems.map(({ key, label, icon: Icon }) => (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-semibold text-foreground">{(audit![key] as number).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete-specific: block if has linked records */}
          {action === 'delete' && !isAuditing && hasLinked && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-sm text-destructive">
              <Ban className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <strong>Cannot delete subject.</strong>
                <br />
                <span className="text-muted-foreground">This subject contains linked records. Please archive the subject instead, or manually remove the linked records before deletion.</span>
              </div>
            </div>
          )}

          {/* Delete-specific: name confirmation (only when clean) */}
          {action === 'delete' && !isAuditing && audit?.isClean && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-input" className="text-sm">
                Type <strong className="select-all font-mono">{confirmPhrase}</strong> to confirm permanent deletion
              </Label>
              <Input
                id="confirm-input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                className="font-mono text-sm"
                autoComplete="off"
                data-testid="input-delete-confirm"
                disabled={isPending}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>

            {action === 'archive' && (
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={onConfirm}
                disabled={isPending || isAuditing}
                data-testid="button-confirm-archive"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Archiving…</> : <><Archive className="h-4 w-4 mr-2" />Archive Subject</>}
              </Button>
            )}

            {action === 'restore' && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={onConfirm}
                disabled={isPending || isAuditing}
                data-testid="button-confirm-restore"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring…</> : <><ArchiveRestore className="h-4 w-4 mr-2" />Restore Subject</>}
              </Button>
            )}

            {action === 'delete' && (
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={!canDelete || isPending || hasLinked}
                data-testid="button-confirm-delete"
              >
                {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" />Permanently Delete</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubjectsManagement() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [actionSubject, setActionSubject] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  const { register, handleSubmit, formState: { errors }, setValue, reset, control } = useForm<SubjectForm>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { category: 'general' },
  });

  // Management page uses /api/subjects/all to include archived subjects
  const { data: subjects = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/subjects/all'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects/all')).json(),
  });

  useSocketIORealtime({ table: 'subjects', queryKey: ['/api/subjects/all'] });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: SubjectForm) => {
      const res = await apiRequest('POST', '/api/subjects', data);
      if (!res.ok) throw new Error('Failed to create subject');
      return res.json();
    },
    onMutate: async (newSubject) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects/all'] });
      const prev = queryClient.getQueryData(['/api/subjects/all']);
      queryClient.setQueryData(['/api/subjects/all'], (old: any) => [
        { ...newSubject, id: 'temp-' + Date.now(), status: 'active', isActive: true },
        ...(old ?? []),
      ]);
      closeForm();
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject created' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects/all'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: any; data: Partial<SubjectForm> }) => {
      const res = await apiRequest('PUT', `/api/subjects/${id}`, data);
      if (!res.ok) throw new Error('Failed to update subject');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects/all'] });
      const prev = queryClient.getQueryData(['/api/subjects/all']);
      queryClient.setQueryData(['/api/subjects/all'], (old: any) =>
        old?.map((s: any) => s.id === id ? { ...s, ...data } : s) ?? old
      );
      closeForm();
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects/all'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: any) => {
      const res = await apiRequest('PATCH', `/api/subjects/${id}/archive`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to archive subject');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Subject archived', description: 'It has been hidden from all dropdowns.' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      closeActionDialog();
    },
    onError: (e: any) => {
      toast({ title: 'Archive failed', description: e.message, variant: 'destructive' });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: any) => {
      const res = await apiRequest('PATCH', `/api/subjects/${id}/restore`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to restore subject');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Subject restored', description: 'It is now active and available in all dropdowns.' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      closeActionDialog();
    },
    onError: (e: any) => {
      toast({ title: 'Restore failed', description: e.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => {
      const res = await apiRequest('DELETE', `/api/subjects/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to delete subject');
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects/all'] });
      const prev = queryClient.getQueryData(['/api/subjects/all']);
      queryClient.setQueryData(['/api/subjects/all'], (old: any) =>
        old?.filter((s: any) => s.id !== id) ?? old
      );
      closeActionDialog();
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject permanently deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects/all'], ctx.prev);
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const onSubmit = (data: SubjectForm) => {
    if (editingSubject) updateMutation.mutate({ id: editingSubject.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (subject: any) => {
    setEditingSubject(subject);
    setValue('name', subject.name);
    setValue('code', subject.code);
    setValue('description', subject.description || '');
    setValue('category', subject.category || 'general');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSubject(null);
    reset({ category: 'general' });
  };

  const openAction = (subject: any, action: 'archive' | 'restore' | 'delete') => {
    setActionSubject(subject);
    setPendingAction(action);
  };

  const closeActionDialog = () => {
    setActionSubject(null);
    setPendingAction(null);
  };

  const handleActionConfirm = () => {
    if (!actionSubject) return;
    if (pendingAction === 'archive') archiveMutation.mutate(actionSubject.id);
    else if (pendingAction === 'restore') restoreMutation.mutate(actionSubject.id);
    else if (pendingAction === 'delete') deleteMutation.mutate(actionSubject.id);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = subjects.filter((s: any) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
    const archived = isArchived(s);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'archived' ? archived : !archived);
    return matchSearch && matchCat && matchStatus;
  });

  const categoryCounts = SUBJECT_CATEGORIES.map(c => ({
    ...c,
    count: subjects.filter((s: any) => s.category === c.value && !isArchived(s)).length,
  }));

  const activeCount = subjects.filter((s: any) => !isArchived(s)).length;
  const archivedCount = subjects.filter((s: any) => isArchived(s)).length;

  const isActionPending = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending;
  const isFormPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="subjects-management">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Subjects Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage school subjects across all departments
          </p>
        </div>
        <Button
          onClick={() => { reset({ category: 'general' }); setEditingSubject(null); setIsFormOpen(true); }}
          data-testid="button-add-subject"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Subject
        </Button>
      </div>

      {/* Category stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categoryCounts.map(c => (
          <CategoryStatCard
            key={c.value}
            category={c}
            count={c.count}
            isActive={categoryFilter === c.value}
            onClick={() => setCategoryFilter(categoryFilter === c.value ? 'all' : c.value)}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or description…"
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {SUBJECT_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>
                <div className="flex items-center gap-2">
                  <c.icon className={`w-3.5 h-3.5 ${c.iconColor}`} />
                  <span>{c.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({subjects.length})</SelectItem>
            <SelectItem value="active">Active ({activeCount})</SelectItem>
            <SelectItem value="archived">Archived ({archivedCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subject grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No subjects found</p>
          <p className="text-sm mt-1">
            {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first subject to get started'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((subject: any) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onEdit={openEdit}
                onAction={openAction}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} subject{filtered.length !== 1 ? 's' : ''} shown
          </p>
        </>
      )}

      {/* ── Create / Edit dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="name">Subject Name <span className="text-destructive">*</span></Label>
              <Input id="name" {...register('name')} placeholder="e.g. Mathematics" className="mt-1" data-testid="input-subject-name" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="code">Subject Code <span className="text-destructive">*</span></Label>
              <Input id="code" {...register('code')} placeholder="e.g. MATH101" className="mt-1" data-testid="input-subject-code" />
              {errors.code && <p className="text-xs text-destructive mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register('description')} placeholder="Brief description" className="mt-1" data-testid="input-description" />
            </div>
            <div>
              <Label>Category <span className="text-destructive">*</span></Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECT_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <c.icon className={`w-4 h-4 ${c.iconColor}`} />
                            <span>{c.label}</span>
                            <span className="text-muted-foreground text-xs">({c.description})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">
                General subjects are for all classes. Science/Art/Commercial are for SS1–SS3 only.
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={isFormPending} data-testid="button-save-subject">
                {isFormPending ? 'Saving…' : editingSubject ? 'Update Subject' : 'Add Subject'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Archive / Restore / Delete dialog ── */}
      <SubjectActionDialog
        subject={actionSubject}
        action={pendingAction}
        isPending={isActionPending}
        onConfirm={handleActionConfirm}
        onCancel={closeActionDialog}
      />
    </div>
  );
}
