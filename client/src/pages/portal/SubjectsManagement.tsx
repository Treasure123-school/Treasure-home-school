import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Search, BookOpen, Trash2, GraduationCap, Palette, Briefcase, BookMarked } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

const SUBJECT_CATEGORIES = [
  { value: 'general', label: 'General', description: 'For all classes (KG1-SS3)', icon: BookMarked },
  { value: 'science', label: 'Science', description: 'For SS1-SS3 Science department', icon: GraduationCap },
  { value: 'art', label: 'Art', description: 'For SS1-SS3 Art department', icon: Palette },
  { value: 'commercial', label: 'Commercial', description: 'For SS1-SS3 Commercial department', icon: Briefcase },
] as const;

const subjectFormSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required'),
  description: z.string().optional(),
  category: z.enum(['general', 'science', 'art', 'commercial']).default('general'),
});

type SubjectForm = z.infer<typeof subjectFormSchema>;

export default function SubjectsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null);

  const { register, handleSubmit, formState: { errors }, setValue, reset, control, watch } = useForm<SubjectForm>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      category: 'general',
    }
  });
  
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch subjects
  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });

  useSocketIORealtime({ 
    table: 'subjects', 
    queryKey: ['/api/subjects']
  });

  // Create subject mutation
  const createSubjectMutation = useMutation({
    mutationFn: async (subjectData: SubjectForm) => {
      const response = await apiRequest('POST', '/api/subjects', subjectData);
      if (!response.ok) throw new Error('Failed to create subject');
      return response.json();
    },
    onMutate: async (newSubject) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const previousSubjects = queryClient.getQueryData(['/api/subjects']);
      
      queryClient.setQueryData(['/api/subjects'], (old: any) => {
        const tempSubject = { ...newSubject, id: 'temp-' + Date.now(), createdAt: new Date() };
        if (!old) return [tempSubject];
        return [tempSubject, ...old];
      });
      
      // INSTANT FEEDBACK: Show creating toast immediately
      toast({
        title: "Creating...",
        description: "Adding new subject",
      });
      
      return { previousSubjects };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Subject created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: any, newSubject, context: any) => {
      if (context?.previousSubjects) {
        queryClient.setQueryData(['/api/subjects'], context.previousSubjects);
      }
      toast({
        title: "Error", 
        description: error.message || "Failed to create subject",
        variant: "destructive",
      });
    },
  });

  // Update subject mutation
  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<SubjectForm> }) => {
      const response = await apiRequest('PUT', `/api/subjects/${id}`, data);
      if (!response.ok) throw new Error('Failed to update subject');
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const previousSubjects = queryClient.getQueryData(['/api/subjects']);
      
      queryClient.setQueryData(['/api/subjects'], (old: any) => {
        if (!old) return old;
        return old.map((subject: any) => 
          subject.id === id ? { ...subject, ...data } : subject
        );
      });
      
      // INSTANT FEEDBACK: Show updating toast immediately
      toast({
        title: "Updating...",
        description: "Saving changes",
      });
      
      return { previousSubjects };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Subject updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setIsDialogOpen(false);
      setEditingSubject(null);
      reset();
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousSubjects) {
        queryClient.setQueryData(['/api/subjects'], context.previousSubjects);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update subject", 
        variant: "destructive",
      });
    },
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/subjects/${id}`);
      if (!response.ok) throw new Error('Failed to delete subject');
      return response.status === 204 ? null : response.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/subjects'] });
      const previousSubjects = queryClient.getQueryData(['/api/subjects']);
      
      queryClient.setQueryData(['/api/subjects'], (old: any) => {
        if (!old) return old;
        return old.filter((subject: any) => subject.id !== id);
      });
      
      // INSTANT FEEDBACK: Show deleting toast immediately
      toast({
        title: "Deleting...",
        description: "Removing subject",
      });
      
      return { previousSubjects };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Subject deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      setSubjectToDelete(null);
    },
    onError: (error: any, id: string, context: any) => {
      if (context?.previousSubjects) {
        queryClient.setQueryData(['/api/subjects'], context.previousSubjects);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete subject",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SubjectForm) => {
    if (editingSubject) {
      updateSubjectMutation.mutate({ id: editingSubject.id, data });
    } else {
      createSubjectMutation.mutate(data);
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    
    // Populate form with subject data
    setValue('name', subject.name);
    setValue('code', subject.code);
    setValue('description', subject.description || '');
    setValue('category', subject.category || 'general');
    
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSubject(null);
    reset();
  };

  // Filter subjects based on search and category
  const filteredSubjects = subjects.filter((subject: any) => {
    const matchesSearch = !searchTerm || 
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subject.description && subject.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || subject.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  // Helper function to get category badge color
  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case 'science': return 'default';
      case 'art': return 'secondary';
      case 'commercial': return 'outline';
      default: return 'secondary';
    }
  };
  
  // Helper function to get category icon
  const getCategoryIcon = (category: string) => {
    const categoryInfo = SUBJECT_CATEGORIES.find(c => c.value === category);
    return categoryInfo?.icon || BookMarked;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Subjects Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-subject">
              <Plus className="w-4 h-4 mr-2" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Subject Name *</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="e.g., Mathematics"
                  data-testid="input-subject-name"
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="code">Subject Code *</Label>
                <Input 
                  id="code" 
                  {...register('code')} 
                  placeholder="e.g., MATH101"
                  data-testid="input-subject-code"
                />
                {errors.code && (
                  <p className="text-sm text-red-500 mt-1">{errors.code.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description" 
                  {...register('description')} 
                  placeholder="Brief description of the subject"
                  data-testid="input-description"
                />
                {errors.description && (
                  <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <cat.icon className="w-4 h-4" />
                              <div>
                                <span className="font-medium">{cat.label}</span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  ({cat.description})
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  General subjects are for all classes. Science/Art/Commercial are for SS1-SS3 departments only.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSubjectMutation.isPending || updateSubjectMutation.isPending}
                  data-testid="button-save-subject"
                >
                  {createSubjectMutation.isPending || updateSubjectMutation.isPending ? 'Saving...' : 
                   editingSubject ? 'Update Subject' : 'Add Subject'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects by name, code, or description..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {SUBJECT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" />
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjects List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Subjects ({filteredSubjects.length})</span>
            <Badge variant="secondary" data-testid="text-total-subjects">
              Total: {subjects.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSubjects ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading subjects...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject: any) => {
                    const CategoryIcon = getCategoryIcon(subject.category || 'general');
                    const categoryInfo = SUBJECT_CATEGORIES.find(c => c.value === (subject.category || 'general'));
                    return (
                      <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <CategoryIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-subject-name-${subject.id}`}>
                                {subject.name}
                              </div>
                              {subject.description && (
                                <div className="text-sm text-muted-foreground">
                                  {subject.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-subject-code-${subject.id}`}>
                          <Badge variant="outline">
                            {subject.code}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-category-${subject.id}`}>
                          <Badge variant={getCategoryBadgeVariant(subject.category || 'general')}>
                            {categoryInfo?.label || 'General'}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-created-${subject.id}`}>
                          {subject.createdAt ? 
                            new Date(subject.createdAt).toLocaleDateString() : 
                            'Unknown'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(subject)}
                              data-testid={`button-edit-subject-${subject.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSubjectToDelete(subject)}
                              data-testid={`button-delete-subject-${subject.id}`}
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
                    <TableCell colSpan={5} className="text-center py-8">
                      No subjects found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {subjectToDelete && (
        <Dialog open={!!subjectToDelete} onOpenChange={() => setSubjectToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete <strong>{subjectToDelete.name}</strong>? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSubjectToDelete(null)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteSubjectMutation.mutate(subjectToDelete.id)}
                  disabled={deleteSubjectMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteSubjectMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}