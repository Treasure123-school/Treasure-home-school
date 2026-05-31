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
} from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

const SUBJECT_CATEGORIES = [
  { value: 'general', label: 'General', description: 'For all classes (KG1–SS3)', icon: BookMarked, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'science', label: 'Science', description: 'For SS1–SS3 Science dept', icon: GraduationCap, color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'art', label: 'Art', description: 'For SS1–SS3 Art dept', icon: Palette, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { value: 'commercial', label: 'Commercial', description: 'For SS1–SS3 Commercial dept', icon: Briefcase, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
] as const;

const subjectFormSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
  category: z.enum(['general', 'science', 'art', 'commercial']).default('general'),
});

type SubjectForm = z.infer<typeof subjectFormSchema>;

function getCategoryInfo(cat: string) {
  return SUBJECT_CATEGORIES.find(c => c.value === cat) ?? SUBJECT_CATEGORIES[0];
}

export default function SubjectsManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { register, handleSubmit, formState: { errors }, setValue, reset, control, watch } = useForm<SubjectForm>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { category: 'general' },
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
  });

  useSocketIORealtime({ table: 'subjects', queryKey: ['/api/subjects'] });

  const createSubjectMutation = useMutation({
    mutationFn: async (data: SubjectForm) => {
      const res = await apiRequest('POST', '/api/subjects', data);
      if (!res.ok) throw new Error('Failed to create subject');
      return res.json();
    },
    onMutate: async (newSubject) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const prev = queryClient.getQueryData(['/api/subjects']);
      queryClient.setQueryData(['/api/subjects'], (old: any) => {
        const temp = { ...newSubject, id: 'temp-' + Date.now(), createdAt: new Date() };
        return old ? [temp, ...old] : [temp];
      });
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      handleCloseDialog();
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubjectForm> }) => {
      const res = await apiRequest('PUT', `/api/subjects/${id}`, data);
      if (!res.ok) throw new Error('Failed to update subject');
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const prev = queryClient.getQueryData(['/api/subjects']);
      queryClient.setQueryData(['/api/subjects'], (old: any) =>
        old?.map((s: any) => s.id === id ? { ...s, ...data } : s) ?? old
      );
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      handleCloseDialog();
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/subjects/${id}`);
      if (!res.ok) throw new Error('Failed to delete subject');
      return res.status === 204 ? null : res.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const prev = queryClient.getQueryData(['/api/subjects']);
      queryClient.setQueryData(['/api/subjects'], (old: any) => old?.filter((s: any) => s.id !== id) ?? old);
      return { prev };
    },
    onSuccess: () => {
      toast({ title: 'Subject deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setSubjectToDelete(null);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/subjects'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: SubjectForm) => {
    if (editingSubject) updateSubjectMutation.mutate({ id: editingSubject.id, data });
    else createSubjectMutation.mutate(data);
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setValue('name', subject.name);
    setValue('code', subject.code);
    setValue('description', subject.description || '');
    setValue('category', subject.category || 'general');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSubject(null);
    reset({ category: 'general' });
  };

  const filteredSubjects = subjects.filter((s: any) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const isPending = createSubjectMutation.isPending || updateSubjectMutation.isPending;

  // Stats per category
  const counts = SUBJECT_CATEGORIES.map(c => ({
    ...c,
    count: (subjects as any[]).filter((s: any) => s.category === c.value).length,
  }));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="subjects-management">

      {/* ── Header ── */}
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
        <Button onClick={() => { reset({ category: 'general' }); setEditingSubject(null); setIsDialogOpen(true); }} data-testid="button-add-subject">
          <Plus className="w-4 h-4 mr-2" />
          Add Subject
        </Button>
      </div>

      {/* ── Category stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counts.map(c => (
          <Card
            key={c.value}
            className={`p-3 cursor-pointer transition-all border-2 ${categoryFilter === c.value ? 'border-primary' : 'border-transparent hover:border-primary/30'}`}
            onClick={() => setCategoryFilter(categoryFilter === c.value ? 'all' : c.value)}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground leading-none">{c.label}</p>
                <p className="text-xl font-bold leading-tight">{c.count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
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
                  <c.icon className="w-3.5 h-3.5" />
                  <span>{c.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Loading ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No subjects found</p>
          <p className="text-sm mt-1">
            {searchTerm || categoryFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first subject to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Card grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.map((subject: any) => {
              const cat = getCategoryInfo(subject.category || 'general');
              const CatIcon = cat.icon;
              return (
                <Card
                  key={subject.id}
                  className="group hover:border-primary/40 hover:shadow-sm transition-all"
                  data-testid={`card-subject-${subject.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CatIcon className="w-4 h-4 text-primary" />
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
                      {/* Dropdown actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-actions-${subject.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(subject)} data-testid={`button-edit-subject-${subject.id}`}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setSubjectToDelete(subject)}
                            data-testid={`button-delete-subject-${subject.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Category badge */}
                    <Badge className={`text-[10px] ${cat.color}`} data-testid={`text-category-${subject.id}`}>
                      {cat.label}
                    </Badge>

                    {/* Description */}
                    {subject.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{subject.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {filteredSubjects.length} subject{filteredSubjects.length !== 1 ? 's' : ''} shown
          </p>
        </>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
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
                            <c.icon className="w-4 h-4" />
                            <span>{c.label}</span>
                            <span className="text-muted-foreground text-xs">({c.description})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">General subjects are for all classes. Science/Art/Commercial are for SS1–SS3 only.</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-subject">
                {isPending ? 'Saving…' : editingSubject ? 'Update Subject' : 'Add Subject'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!subjectToDelete} onOpenChange={() => setSubjectToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Subject
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{subjectToDelete?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setSubjectToDelete(null)} data-testid="button-cancel-delete">Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteSubjectMutation.mutate(subjectToDelete.id)}
                disabled={deleteSubjectMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteSubjectMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
