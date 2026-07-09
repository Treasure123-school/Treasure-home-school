import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, BookOpen } from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { PageHeader, FilterBar, EmptyState, MiniStatCard, MiniStatGrid } from '@/components/shared';

import { SUBJECT_CATEGORIES } from './constants';
import type { SubjectForm } from './constants';
import type { SubjectAction } from './types';
import { isArchived } from './utils';
import { SubjectCard } from './components/SubjectCard';
import { SubjectFormDialog } from './components/SubjectFormDialog';
import { SubjectActionDialog } from './components/SubjectActionDialog';

export default function SubjectsManagement() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [actionSubject, setActionSubject] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<SubjectAction | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

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
      toast({ title: 'Success', description: 'Subject created' });
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
      toast({ title: 'Success', description: 'Subject updated' });
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
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subject archived — hidden from all dropdowns.' });
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
      toast({ title: 'Success', description: 'Subject restored — now active in all dropdowns.' });
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
      toast({ title: 'Success', description: 'Subject permanently deleted' });
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

  const openAdd = () => {
    setEditingSubject(null);
    setIsFormOpen(true);
  };

  const openEdit = (subject: any) => {
    setEditingSubject(subject);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSubject(null);
  };

  const openAction = (subject: any, action: SubjectAction) => {
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
      <PageHeader
        icon={BookOpen}
        title="Subjects Management"
        description="Manage school subjects across all departments"
        actions={
          <Button onClick={openAdd} className="w-full sm:w-auto" data-testid="button-add-subject">
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        }
      />

      {/* Category stat cards */}
      <MiniStatGrid cols={4}>
        {categoryCounts.map(c => (
          <MiniStatCard
            key={c.value}
            label={c.label}
            value={c.count}
            icon={c.icon}
            color={c.textColor}
            active={categoryFilter === c.value}
            onClick={() => setCategoryFilter(categoryFilter === c.value ? 'all' : c.value)}
            data-testid={`stat-category-${c.value}`}
          />
        ))}
      </MiniStatGrid>

      {/* Filters */}
      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, code, or description…"
        data-testid="input-search"
      >
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
      </FilterBar>

      {/* Subject grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description={
            searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first subject to get started'
          }
        />
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
      <SubjectFormDialog
        open={isFormOpen}
        editingSubject={editingSubject}
        onClose={closeForm}
        onSubmit={onSubmit}
        isPending={isFormPending}
      />

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
