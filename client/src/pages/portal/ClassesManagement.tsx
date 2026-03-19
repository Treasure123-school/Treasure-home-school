import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Search, Users, GraduationCap, BookOpen, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const classFormSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  level: z.string().min(1, 'Level is required'),
  classTeacherId: z.string().min(1, 'Class teacher is required'),
  capacity: z.string().min(1, 'Class capacity is required'),
});

type ClassForm = z.infer<typeof classFormSchema>;

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

  // Fetch classes
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  useSocketIORealtime({ 
    table: 'classes', 
    queryKey: ['/api/classes']
  });

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return await response.json();
    },
  });

  // Create class mutation with OPTIMISTIC UPDATES
  const createClassMutation = useMutation({
    mutationFn: async (classData: ClassForm) => {
      const payload = {
        ...classData,
        capacity: parseInt(classData.capacity, 10),
      };
      const response = await apiRequest('POST', '/api/classes', payload);
      if (!response.ok) throw new Error('Failed to create class');
      return response.json();
    },
    onMutate: async (newClass) => {
      // INSTANT FEEDBACK: Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      
      // INSTANT FEEDBACK: Snapshot previous value
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      
      // INSTANT FEEDBACK: Optimistically add new class
      queryClient.setQueryData(['/api/classes'], (old: any) => {
        const payload = { ...newClass, capacity: parseInt(newClass.capacity, 10), id: 'temp-' + Date.now(), createdAt: new Date() };
        if (!old) return [payload];
        return [payload, ...old];
      });
      
      return { previousClasses };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: any, newClass, context: any) => {
      // ROLLBACK: Restore previous state on error
      if (context?.previousClasses) {
        queryClient.setQueryData(['/api/classes'], context.previousClasses);
      }
      toast({
        title: "Error", 
        description: error.message || "Failed to create class",
        variant: "destructive",
      });
    },
  });

  // Update class mutation with OPTIMISTIC UPDATES
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<ClassForm> }) => {
      const payload = {
        ...data,
        capacity: data.capacity ? parseInt(data.capacity, 10) : undefined,
      };
      const response = await apiRequest('PUT', `/api/classes/${id}`, payload);
      if (!response.ok) throw new Error('Failed to update class');
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      // INSTANT FEEDBACK: Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      
      // INSTANT FEEDBACK: Snapshot previous value
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      
      // INSTANT FEEDBACK: Optimistically update class
      queryClient.setQueryData(['/api/classes'], (old: any) => {
        if (!old) return old;
        const payload = { ...data, capacity: data.capacity ? parseInt(data.capacity, 10) : undefined };
        return old.map((classItem: any) => 
          classItem.id === id ? { ...classItem, ...payload } : classItem
        );
      });
      
      return { previousClasses };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setIsDialogOpen(false);
      setEditingClass(null);
      reset();
    },
    onError: (error: any, variables, context: any) => {
      // ROLLBACK: Restore previous state on error
      if (context?.previousClasses) {
        queryClient.setQueryData(['/api/classes'], context.previousClasses);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update class", 
        variant: "destructive",
      });
    },
  });

  // Delete class mutation with OPTIMISTIC UPDATES
  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/classes/${id}`);
      if (!response.ok) throw new Error('Failed to delete class');
      return response.status === 204 ? null : response.json();
    },
    onMutate: async (id: string) => {
      // INSTANT FEEDBACK: Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/classes'] });
      
      // INSTANT FEEDBACK: Snapshot previous value
      const previousClasses = queryClient.getQueryData(['/api/classes']);
      
      // INSTANT FEEDBACK: Optimistically remove class
      queryClient.setQueryData(['/api/classes'], (old: any) => {
        if (!old) return old;
        return old.filter((classItem: any) => classItem.id !== id);
      });
      
      return { previousClasses };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setClassToDelete(null);
    },
    onError: (error: any, id: string, context: any) => {
      // ROLLBACK: Restore previous state on error
      if (context?.previousClasses) {
        queryClient.setQueryData(['/api/classes'], context.previousClasses);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete class",
        variant: "destructive",
      });
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
    
    // Populate form with class data
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

  // Filter classes based on search and level
  const filteredClasses = classes.filter((classItem: any) => {
    const matchesSearch = !searchTerm || 
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.level.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = selectedLevel === 'all' || classItem.level === selectedLevel;
    
    return matchesSearch && matchesLevel;
  });

  // Get unique levels for filter
  const levels = Array.from(new Set(classes.map((c: any) => c.level).filter(Boolean))) as string[];

  return (
    <div className="space-y-6" data-testid="classes-management">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Classes Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-class">
              <Plus className="w-4 h-4 mr-2" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Class Name *</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="e.g., Grade 10 - Mathematics"
                  data-testid="input-class-name"
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="level">Level *</Label>
                <Input 
                  id="level" 
                  {...register('level')} 
                  placeholder="e.g., Grade 10, Primary, Secondary"
                  data-testid="input-level"
                />
                {errors.level && (
                  <p className="text-sm text-red-500 mt-1">{errors.level.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="classTeacherId">Class Teacher *</Label>
                <Select value={watchClassTeacherId || ''} onValueChange={(value) => setValue('classTeacherId', value)}>
                  <SelectTrigger data-testid="select-teacher">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName} - {teacher.department || 'No Department'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classTeacherId && (
                  <p className="text-sm text-red-500 mt-1">{errors.classTeacherId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="capacity">Class Capacity *</Label>
                <Input 
                  id="capacity" 
                  type="number"
                  {...register('capacity')} 
                  placeholder="e.g., 30"
                  data-testid="input-capacity"
                />
                {errors.capacity && (
                  <p className="text-sm text-red-500 mt-1">{errors.capacity.message}</p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createClassMutation.isPending || updateClassMutation.isPending}
                  data-testid="button-save-class"
                >
                  {createClassMutation.isPending || updateClassMutation.isPending ? 'Saving...' : 
                   editingClass ? 'Update Class' : 'Add Class'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search classes by name or level..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-48" data-testid="select-level-filter">
                <SelectValue placeholder="Filter by Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {levels.map((level: string) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Classes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Classes ({filteredClasses.length})</span>
            <Badge variant="secondary" data-testid="text-total-classes">
              Total: {classes.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingClasses ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading classes...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length > 0 ? (
                  filteredClasses.map((classItem: any) => {
                    const teacher = teachers.find((t: any) => t.id === classItem.classTeacherId);
                    return (
                      <TableRow key={classItem.id} data-testid={`row-class-${classItem.id}`}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-class-name-${classItem.id}`}>
                                {classItem.name}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-level-${classItem.id}`}>
                          <Badge variant="outline">
                            {classItem.level}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-teacher-${classItem.id}`}>
                          {teacher ? (
                            <div className="flex items-center">
                              <GraduationCap className="w-4 h-4 mr-2 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {teacher.firstName} {teacher.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {teacher.department || 'No Department'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No teacher assigned</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-capacity-${classItem.id}`}>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                            {classItem.capacity || 'Not set'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={classItem.isActive ? "default" : "secondary"}>
                            {classItem.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(classItem)}
                              data-testid={`button-edit-class-${classItem.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setClassToDelete(classItem)}
                              data-testid={`button-delete-class-${classItem.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No classes found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {classToDelete && (
        <Dialog open={!!classToDelete} onOpenChange={() => setClassToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete <strong>{classToDelete.name}</strong>? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setClassToDelete(null)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteClassMutation.mutate(classToDelete.id)}
                  disabled={deleteClassMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteClassMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}