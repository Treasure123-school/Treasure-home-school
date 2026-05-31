import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Edit, Search, Users, GraduationCap, BookOpen, Trash2,
  School, Filter, AlertTriangle,
} from 'lucide-react';

const classFormSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  level: z.string().min(1, 'Level is required'),
  classTeacherId: z.string().min(1, 'Class teacher is required'),
  capacity: z.string().min(1, 'Class capacity is required'),
});

type ClassForm = z.infer<typeof classFormSchema>;

const LEVEL_COLORS: Record<string, string> = {
  primary: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  jss: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  ss: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

function getLevelColor(level: string) {
  const l = level?.toLowerCase() ?? '';
  if (l.includes('primary') || l.startsWith('p')) return LEVEL_COLORS.primary;
  if (l.includes('jss') || l.includes('js')) return LEVEL_COLORS.jss;
  if (l.includes('ss')) return LEVEL_COLORS.ss;
  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
}

export default function ClassesManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [editingClass, setEditingClass] = useState<any>(null);
  const [classToDelete, setClassToDelete] = useState<any>(null);

  const { register, handleSubmit, formState: { errors }, setValue, reset, watch } = useForm<ClassForm>({
    resolver: zodResolver(classFormSchema),
  });

  const watchClassTeacherId = watch('classTeacherId');

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return response.json();
    },
  });

  useSocketIORealtime({ table: 'classes', queryKey: ['/api/classes'] });

  const { data: teachers = [] } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return response.json();
    },
  });

  const createClassMutation = useMutation({
    mutationFn: async (classData: ClassForm) => {
      const payload = { ...classData, capacity: parseInt(classData.capacity, 10) };
      const response = await apiRequest('POST', '/api/classes', payload);
      if (!response.ok) throw new Error('Failed to create class');
      return response.json();
    },
    onMutate: async (newClass) => {
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      queryClient.setQueryData(['/api/classes'], (old: any) => {
        const payload = { ...newClass, capacity: parseInt(newClass.capacity, 10), id: 'temp-' + Date.now(), createdAt: new Date() };
        return old ? [payload, ...old] : [payload];
      });
      return { previousClasses };
    },
    onSuccess: () => {
      toast({ title: 'Class created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      handleCloseDialog();
    },
    onError: (error: any, _v, context: any) => {
      if (context?.previousClasses) queryClient.setQueryData(['/api/classes'], context.previousClasses);
      toast({ title: 'Failed to create class', description: error.message, variant: 'destructive' });
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClassForm> }) => {
      const payload = { ...data, capacity: data.capacity ? parseInt(data.capacity, 10) : undefined };
      const response = await apiRequest('PUT', `/api/classes/${id}`, payload);
      if (!response.ok) throw new Error('Failed to update class');
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      queryClient.setQueryData(['/api/classes'], (old: any) => {
        if (!old) return old;
        const payload = { ...data, capacity: data.capacity ? parseInt(data.capacity, 10) : undefined };
        return old.map((c: any) => c.id === id ? { ...c, ...payload } : c);
      });
      return { previousClasses };
    },
    onSuccess: () => {
      toast({ title: 'Class updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      handleCloseDialog();
    },
    onError: (error: any, _v, context: any) => {
      if (context?.previousClasses) queryClient.setQueryData(['/api/classes'], context.previousClasses);
      toast({ title: 'Failed to update class', description: error.message, variant: 'destructive' });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/classes/${id}`);
      if (!response.ok) throw new Error('Failed to delete class');
      return response.status === 204 ? null : response.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      queryClient.setQueryData(['/api/classes'], (old: any) => old?.filter((c: any) => c.id !== id) ?? old);
      return { previousClasses };
    },
    onSuccess: () => {
      toast({ title: 'Class deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setClassToDelete(null);
    },
    onError: (error: any, _v, context: any) => {
      if (context?.previousClasses) queryClient.setQueryData(['/api/classes'], context.previousClasses);
      toast({ title: 'Failed to delete class', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: ClassForm) => {
    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data });
    } else {
      createClassMutation.mutate(data);
    }
  };

  const handleEdit = (classItem: any) => {
    setEditingClass(classItem);
    setValue('name', classItem.name);
    setValue('level', classItem.level);
    setValue('classTeacherId', classItem.classTeacherId || '');
    setValue('capacity', classItem.capacity?.toString() || '');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClass(null);
    reset();
  };

  const filteredClasses = classes.filter((c: any) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.level?.toLowerCase().includes(q);
    const matchLevel = selectedLevel === 'all' || c.level === selectedLevel;
    return matchSearch && matchLevel;
  });

  const levels = Array.from(new Set(classes.map((c: any) => c.level).filter(Boolean))) as string[];

  const isPending = createClassMutation.isPending || updateClassMutation.isPending;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" data-testid="classes-management">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <School className="h-6 w-6 text-primary" />
            Classes Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage school classes, assign teachers and set capacities
          </p>
        </div>
        <Button onClick={() => { reset(); setEditingClass(null); setIsDialogOpen(true); }} data-testid="button-add-class">
          <Plus className="w-4 h-4 mr-2" />
          Add Class
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Classes', value: classes.length, icon: School, color: 'text-primary' },
          { label: 'Active', value: classes.filter((c: any) => c.isActive !== false).length, icon: BookOpen, color: 'text-green-600' },
          { label: 'Shown', value: filteredClasses.length, icon: Filter, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
              <s.icon className={`h-7 w-7 ${s.color} opacity-70`} />
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or level…"
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-level-filter">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels.map((l: string) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Loading skeleton ── */}
      {loadingClasses ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <School className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No classes found</p>
          <p className="text-sm mt-1">
            {searchTerm || selectedLevel !== 'all' ? 'Try adjusting your filters' : 'Add your first class to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile / tablet: card grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map((classItem: any) => {
              const teacher = teachers.find((t: any) => t.id === classItem.classTeacherId);
              return (
                <Card
                  key={classItem.id}
                  className="group hover:border-primary/40 hover:shadow-sm transition-all"
                  data-testid={`card-class-${classItem.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Top row: name + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate" data-testid={`text-class-name-${classItem.id}`}>
                            {classItem.name}
                          </p>
                          <Badge className={`text-[10px] mt-0.5 ${getLevelColor(classItem.level)}`} data-testid={`text-level-${classItem.id}`}>
                            {classItem.level}
                          </Badge>
                        </div>
                      </div>
                      <Badge
                        variant={classItem.isActive !== false ? 'default' : 'secondary'}
                        className="shrink-0 text-[10px]"
                      >
                        {classItem.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Teacher row */}
                    <div className="flex items-center gap-2 text-sm" data-testid={`text-teacher-${classItem.id}`}>
                      <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                      {teacher ? (
                        <div className="min-w-0">
                          <span className="font-medium truncate block">
                            {teacher.firstName} {teacher.lastName}
                          </span>
                          {teacher.department && (
                            <span className="text-xs text-muted-foreground truncate block">
                              {teacher.department}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">No teacher assigned</span>
                      )}
                    </div>

                    {/* Capacity row */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-capacity-${classItem.id}`}>
                      <Users className="w-4 h-4 shrink-0" />
                      <span>{classItem.capacity ? `Capacity: ${classItem.capacity}` : 'Capacity not set'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => handleEdit(classItem)}
                        data-testid={`button-edit-class-${classItem.id}`}
                      >
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setClassToDelete(classItem)}
                        data-testid={`button-delete-class-${classItem.id}`}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-right">
            {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''} shown
          </p>
        </>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="name">Class Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g. JSS 1A, Primary 4"
                className="mt-1"
                data-testid="input-class-name"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="level">Level <span className="text-destructive">*</span></Label>
              <Input
                id="level"
                {...register('level')}
                placeholder="e.g. JSS, SS, Primary"
                className="mt-1"
                data-testid="input-level"
              />
              {errors.level && <p className="text-xs text-destructive mt-1">{errors.level.message}</p>}
            </div>

            <div>
              <Label>Class Teacher <span className="text-destructive">*</span></Label>
              <Select value={watchClassTeacherId || ''} onValueChange={v => setValue('classTeacherId', v)}>
                <SelectTrigger className="mt-1" data-testid="select-teacher">
                  <SelectValue placeholder="Select a teacher…" />
                </SelectTrigger>
                <SelectContent>
                  {(teachers as any[]).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}{t.department ? ` — ${t.department}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classTeacherId && <p className="text-xs text-destructive mt-1">{errors.classTeacherId.message}</p>}
            </div>

            <div>
              <Label htmlFor="capacity">Class Capacity <span className="text-destructive">*</span></Label>
              <Input
                id="capacity"
                type="number"
                {...register('capacity')}
                placeholder="e.g. 30"
                className="mt-1"
                data-testid="input-capacity"
              />
              {errors.capacity && <p className="text-xs text-destructive mt-1">{errors.capacity.message}</p>}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-class">
                {isPending ? 'Saving…' : editingClass ? 'Update Class' : 'Add Class'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!classToDelete} onOpenChange={() => setClassToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Class
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{classToDelete?.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setClassToDelete(null)} data-testid="button-cancel-delete">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteClassMutation.mutate(classToDelete.id)}
                disabled={deleteClassMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteClassMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
