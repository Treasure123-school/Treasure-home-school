import { useState, useMemo, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Palette, Briefcase, UserPlus, Search, Mail, Phone, Edit, Trash2, CheckCircle, Copy, BookOpen, X, Plus } from 'lucide-react';

import { ROLE_IDS } from '@/lib/roles';
import { isSeniorSecondaryClass } from '@/lib/utils';

const DEPARTMENTS = [
  { value: 'science', label: 'Science', icon: GraduationCap },
  { value: 'art', label: 'Art', icon: Palette },
  { value: 'commercial', label: 'Commercial', icon: Briefcase },
] as const;

const teacherFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  roleId: z.number().default(ROLE_IDS.TEACHER), // Teacher role ID = 3
  employeeId: z.string().optional(),
  department: z.string().optional(),
  qualifications: z.string().optional(),
  dateOfJoining: z.string().optional(),
  salary: z.string().optional(),
});

type TeacherForm = z.infer<typeof teacherFormSchema>;

export default function TeachersManagement() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<any>(null);
  const [credentialsDialog, setCredentialsDialog] = useState<{
    open: boolean;
    username: string;
    password: string;
    email: string;
  }>({ open: false, username: '', password: '', email: '' });
  
  // Assignment dialog state (for editing existing teachers)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedTeacherForAssignment, setSelectedTeacherForAssignment] = useState<any>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDepartmentForAssignment, setSelectedDepartmentForAssignment] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  
  // Create modal assignment state (for creating new teachers with assignments)
  const [createSelectedClassIds, setCreateSelectedClassIds] = useState<number[]>([]);
  const [createSelectedSubjectIds, setCreateSelectedSubjectIds] = useState<number[]>([]);
  
  // Edit modal assignment state (for editing existing teachers with assignments)
  const [editSelectedClassIds, setEditSelectedClassIds] = useState<number[]>([]);
  const [editSelectedSubjectIds, setEditSelectedSubjectIds] = useState<number[]>([]);
  const [originalAssignments, setOriginalAssignments] = useState<{classId: number, subjectId: number, assignmentId: number}[]>([]);

  const { register, handleSubmit, formState: { errors }, setValue, reset, control } = useForm<TeacherForm>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      roleId: ROLE_IDS.TEACHER, // Teacher role = 3
    }
  });
  
  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });
  
  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });
  
  // Fetch teacher assignments when a teacher is selected (for separate assignment dialog)
  const { data: teacherAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['/api/teacher-assignments', selectedTeacherForAssignment?.id],
    queryFn: async () => {
      if (!selectedTeacherForAssignment?.id) return [];
      const response = await apiRequest('GET', `/api/teachers/${selectedTeacherForAssignment.id}/assignments`);
      return await response.json();
    },
    enabled: !!selectedTeacherForAssignment?.id,
  });
  
  // Fetch teacher assignments when editing (for edit modal)
  const { data: editingTeacherAssignments = [], refetch: refetchEditingAssignments } = useQuery({
    queryKey: ['/api/teacher-assignments', editingTeacher?.id],
    queryFn: async () => {
      if (!editingTeacher?.id) return [];
      const response = await apiRequest('GET', `/api/teachers/${editingTeacher.id}/assignments`);
      return await response.json();
    },
    enabled: !!editingTeacher?.id,
  });
  
  // Helper to check if a class is a senior class (SS1-SS3)
  const isSeniorClass = (className: string | undefined | null) => {
    return isSeniorSecondaryClass(className);
  };
  
  // Get the selected class object
  const selectedClass = useMemo(() => {
    return classes.find((c: any) => String(c.id) === selectedClassId);
  }, [classes, selectedClassId]);
  
  // Show ALL subjects for assignment dialog - admin can assign any subject to teacher
  // No class selection requirement - always show all 17 subjects for visibility
  const filteredSubjects = useMemo(() => {
    // Return ALL active subjects so admin can choose any subject for the teacher
    // Sort by category to group similar subjects together
    return [...subjects]
      .filter((subject: any) => subject.isActive !== false)
      .sort((a: any, b: any) => {
        const categoryOrder: Record<string, number> = { 'general': 0, 'science': 1, 'art': 2, 'commercial': 3 };
        const catA = (a.category || 'general').toLowerCase();
        const catB = (b.category || 'general').toLowerCase();
        const orderA = categoryOrder[catA] ?? 99;
        const orderB = categoryOrder[catB] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [subjects]);
  
  // Show ALL subjects for create modal - admin can assign any subject to teacher
  // No class selection requirement - always show all 17 subjects for visibility
  const createFilteredSubjects = useMemo(() => {
    // Return ALL active subjects so admin can choose any subject for the teacher
    // Sort by category to group similar subjects together
    return [...subjects]
      .filter((subject: any) => subject.isActive !== false)
      .sort((a: any, b: any) => {
        const categoryOrder: Record<string, number> = { 'general': 0, 'science': 1, 'art': 2, 'commercial': 3 };
        const catA = (a.category || 'general').toLowerCase();
        const catB = (b.category || 'general').toLowerCase();
        const orderA = categoryOrder[catA] ?? 99;
        const orderB = categoryOrder[catB] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [subjects]);

  // Fetch teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return await response.json();
    },
  });

  useSocketIORealtime({ 
    table: 'users', 
    queryKey: ['/api/users', 'Teacher']
  });
  
  // Real-time subscription for teacher assignments - broad subscription for any assignment changes
  useSocketIORealtime({
    table: 'teacher_class_assignments',
    queryKey: ['/api/teacher-assignments', selectedTeacherForAssignment?.id],
    onEvent: () => {
      if (selectedTeacherForAssignment?.id) {
        refetchAssignments();
      }
      if (editingTeacher?.id) {
        refetchEditingAssignments();
      }
    },
  });
  
  // Populate edit assignment state when editing teacher assignments are loaded
  useEffect(() => {
    if (editingTeacher) {
      const classIds = new Set<number>();
      const subjectIds = new Set<number>();
      const assignments: {classId: number, subjectId: number, assignmentId: number}[] = [];
      
      // Process assignments if any exist
      if (editingTeacherAssignments && editingTeacherAssignments.length > 0) {
        editingTeacherAssignments.forEach((assignment: any) => {
          classIds.add(assignment.classId);
          assignment.subjects?.forEach((subject: any) => {
            subjectIds.add(subject.subjectId);
            assignments.push({
              classId: assignment.classId,
              subjectId: subject.subjectId,
              assignmentId: subject.assignmentId
            });
          });
        });
      }
      
      // Always set state (even if empty) to ensure clean state for each teacher
      setEditSelectedClassIds(Array.from(classIds));
      setEditSelectedSubjectIds(Array.from(subjectIds));
      setOriginalAssignments(assignments);
    }
  }, [editingTeacher, editingTeacherAssignments]);

  // Create teacher mutation with assignments
  const createTeacherMutation = useMutation({
    mutationFn: async (teacherData: TeacherForm & { 
      classIds?: number[]; 
      subjectIds?: number[]; 
    }) => {
      // Generate a temporary password for the teacher
      const currentYear = new Date().getFullYear();
      const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
      const tempPassword = `THS@${currentYear}#${randomString}`;
      
      // Extract assignment data (these are not part of the user API)
      const { classIds, subjectIds, ...userData } = teacherData;
      
      const response = await apiRequest('POST', '/api/users', {
        ...userData,
        password: tempPassword,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create teacher');
      }
      const createdTeacher = await response.json();
      
      // Track assignment results
      const assignmentResults = { success: 0, skipped: 0, failed: 0 };
      
      // Create assignments if classes and subjects are selected
      if (classIds && classIds.length > 0 && subjectIds && subjectIds.length > 0) {
        for (const classId of classIds) {
          for (const subjectId of subjectIds) {
            try {
              const assignResponse = await apiRequest('POST', '/api/teacher-assignments', {
                teacherId: createdTeacher.id,
                classId,
                subjectId,
              });
              if (assignResponse.ok) {
                assignmentResults.success++;
              } else if (assignResponse.status === 409) {
                // Assignment already exists - skip it (not an error)
                assignmentResults.skipped++;
              } else {
                assignmentResults.failed++;
              }
            } catch (err) {
              console.error('Failed to create assignment:', err);
              assignmentResults.failed++;
            }
          }
        }
      }
      
      return { ...createdTeacher, assignmentResults };
    },
    onMutate: async (newTeacher) => {
      await queryClient.cancelQueries({ queryKey: ['/api/users', 'Teacher'] });
      const previousData = queryClient.getQueryData(['/api/users', 'Teacher']);
      
      // Only include user-related fields in the optimistic update (exclude assignment data)
      queryClient.setQueryData(['/api/users', 'Teacher'], (old: any) => {
        const tempTeacher = { 
          firstName: newTeacher.firstName,
          lastName: newTeacher.lastName,
          email: newTeacher.email,
          phone: newTeacher.phone,
          gender: newTeacher.gender,
          id: 'temp-' + Date.now(), 
          createdAt: new Date(), 
          role: { id: ROLE_IDS.TEACHER, name: 'Teacher' },
          isActive: true
        };
        if (!old) return [tempTeacher];
        return [tempTeacher, ...old];
      });
      
      return { previousData };
    },
    onSuccess: (data) => {
      const { assignmentResults, ...teacherData } = data;
      
      // Show simple success message
      toast({
        title: "Success",
        description: "Teacher created successfully.",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/users', 'Teacher'] });
      setIsDialogOpen(false);
      reset();
      
      // Reset create modal assignment state
      setCreateSelectedClassIds([]);
      setCreateSelectedSubjectIds([]);
      
      // Show credentials dialog
      setCredentialsDialog({
        open: true,
        username: teacherData.username || '',
        password: teacherData.temporaryPassword || '',
        email: teacherData.email || ''
      });
    },
    onError: (error: any, newTeacher, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/users', 'Teacher'], context.previousData);
      }
      toast({
        title: "Error", 
        description: error.message || "Failed to create teacher",
        variant: "destructive",
      });
    },
  });

  // Update teacher mutation with assignment handling
  const updateTeacherMutation = useMutation({
    mutationFn: async ({ id, data, classIds, subjectIds, originalAssignments: origAssign }: { 
      id: string; 
      data: Partial<TeacherForm>;
      classIds?: number[];
      subjectIds?: number[];
      originalAssignments?: {classId: number, subjectId: number, assignmentId: number}[];
    }) => {
      // Update teacher info
      const response = await apiRequest('PUT', `/api/users/${id}`, data);
      if (!response.ok) throw new Error('Failed to update teacher');
      const updatedTeacher = await response.json();
      
      // Handle assignment changes if class/subject IDs are provided
      if (classIds && subjectIds && origAssign) {
        // Determine which assignments to add and remove
        const newAssignmentKeys = new Set<string>();
        classIds.forEach(classId => {
          subjectIds.forEach(subjectId => {
            newAssignmentKeys.add(`${classId}-${subjectId}`);
          });
        });
        
        const originalAssignmentKeys = new Set(
          origAssign.map(a => `${a.classId}-${a.subjectId}`)
        );
        
        // Find assignments to add (in new but not in original)
        const toAdd: {classId: number, subjectId: number}[] = [];
        classIds.forEach(classId => {
          subjectIds.forEach(subjectId => {
            const key = `${classId}-${subjectId}`;
            if (!originalAssignmentKeys.has(key)) {
              toAdd.push({ classId, subjectId });
            }
          });
        });
        
        // Find assignments to remove (in original but not in new)
        const toRemove = origAssign.filter(a => {
          const key = `${a.classId}-${a.subjectId}`;
          return !newAssignmentKeys.has(key);
        });
        
        // Add new assignments
        for (const { classId, subjectId } of toAdd) {
          try {
            await apiRequest('POST', '/api/teacher-assignments', {
              teacherId: id,
              classId,
              subjectId,
            });
          } catch (err) {
            console.error('Failed to add assignment:', err);
          }
        }
        
        // Remove old assignments
        for (const { assignmentId } of toRemove) {
          try {
            await apiRequest('DELETE', `/api/teacher-assignments/${assignmentId}`);
          } catch (err) {
            console.error('Failed to remove assignment:', err);
          }
        }
      }
      
      return updatedTeacher;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/users', 'Teacher'] });
      const previousData = queryClient.getQueryData(['/api/users', 'Teacher']);
      
      queryClient.setQueryData(['/api/users', 'Teacher'], (old: any) => {
        if (!old) return old;
        return old.map((teacher: any) => 
          teacher.id === id ? { ...teacher, ...data } : teacher
        );
      });
      
      toast({ title: "Updating...", description: "Saving teacher information and assignments" });
      return { previousData };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Teacher and assignments updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', 'Teacher'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
      setIsDialogOpen(false);
      setEditingTeacher(null);
      reset();
      // Reset edit modal assignment state
      setEditSelectedClassIds([]);
      setEditSelectedSubjectIds([]);
      setOriginalAssignments([]);
    },
    onError: (error: any, variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/users', 'Teacher'], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher", 
        variant: "destructive",
      });
    },
  });

  // Delete teacher mutation
  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/users/${id}`);
      if (!response.ok) throw new Error('Failed to delete teacher');
      return response.status === 204 ? null : response.json();
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/users', 'Teacher'] });
      const previousData = queryClient.getQueryData(['/api/users', 'Teacher']);
      
      queryClient.setQueryData(['/api/users', 'Teacher'], (old: any) => {
        if (!old) return old;
        return old.filter((teacher: any) => teacher.id !== id);
      });
      
      toast({ title: "Deleting...", description: "Removing teacher from system" });
      return { previousData };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users', 'Teacher'] });
      setTeacherToDelete(null);
    },
    onError: (error: any, id: string, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/users', 'Teacher'], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete teacher",
        variant: "destructive",
      });
    },
  });
  
  // Create teacher assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: { teacherId: string; classId: number; subjectId: number; department?: string }) => {
      const response = await apiRequest('POST', '/api/teacher-assignments', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create assignment');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Subject assigned successfully",
      });
      refetchAssignments();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign subject",
        variant: "destructive",
      });
    },
  });
  
  // Delete teacher assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await apiRequest('DELETE', `/api/teacher-assignments/${assignmentId}`);
      if (!response.ok) throw new Error('Failed to remove assignment');
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
      refetchAssignments();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove assignment",
        variant: "destructive",
      });
    },
  });
  
  // Handle opening assignment dialog
  const handleOpenAssignmentDialog = (teacher: any) => {
    setSelectedTeacherForAssignment(teacher);
    setSelectedClassId('');
    setSelectedDepartmentForAssignment('');
    setSelectedSubjectIds([]);
    setAssignmentDialogOpen(true);
  };
  
  // Handle class selection change
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedDepartmentForAssignment('');
    setSelectedSubjectIds([]);
  };
  
  // Handle adding assignments for selected subjects
  const handleAddAssignments = async () => {
    if (!selectedTeacherForAssignment || !selectedClassId || selectedSubjectIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select a class and at least one subject",
        variant: "destructive",
      });
      return;
    }
    
    // Get department if provided (optional for all classes)
    const department = selectedDepartmentForAssignment || undefined;
    
    // Create assignments for each selected subject
    for (const subjectId of selectedSubjectIds) {
      await createAssignmentMutation.mutateAsync({
        teacherId: selectedTeacherForAssignment.id,
        classId: Number(selectedClassId),
        subjectId,
        department,
      });
    }
    
    // Reset selection after adding
    setSelectedSubjectIds([]);
  };
  
  // Toggle subject selection
  const toggleSubjectSelection = (subjectId: number) => {
    setSelectedSubjectIds(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const onSubmit = (data: TeacherForm) => {
    if (editingTeacher) {
      // Include assignment data for editing teachers
      updateTeacherMutation.mutate({ 
        id: editingTeacher.id, 
        data,
        classIds: editSelectedClassIds,
        subjectIds: editSelectedSubjectIds,
        originalAssignments
      });
    } else {
      // Include assignment data for new teachers
      createTeacherMutation.mutate({
        ...data,
        classIds: createSelectedClassIds,
        subjectIds: createSelectedSubjectIds,
      });
    }
  };

  const handleEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    
    // Reset edit assignment state - will be populated by useEffect when assignments are fetched
    setEditSelectedClassIds([]);
    setEditSelectedSubjectIds([]);
    setOriginalAssignments([]);
    
    // Populate form with teacher data
    setValue('firstName', teacher.firstName);
    setValue('lastName', teacher.lastName);
    setValue('email', teacher.email);
    setValue('phone', teacher.phone || '');
    setValue('address', teacher.address || '');
    setValue('dateOfBirth', teacher.dateOfBirth || '');
    setValue('gender', teacher.gender || 'Male');
    setValue('employeeId', teacher.employeeId || '');
    setValue('department', teacher.department || '');
    setValue('qualifications', teacher.qualifications || '');
    setValue('dateOfJoining', teacher.dateOfJoining || '');
    setValue('salary', teacher.salary || '');
    
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTeacher(null);
    reset();
    // Reset create modal assignment state
    setCreateSelectedClassIds([]);
    setCreateSelectedSubjectIds([]);
    // Reset edit modal assignment state
    setEditSelectedClassIds([]);
    setEditSelectedSubjectIds([]);
    setOriginalAssignments([]);
  };
  
  // Toggle class selection for edit modal
  const toggleEditClassSelection = (classId: number) => {
    setEditSelectedClassIds(prev => {
      const newSelection = prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
      return newSelection;
    });
  };
  
  // Toggle subject selection for edit modal
  const toggleEditSubjectSelection = (subjectId: number) => {
    setEditSelectedSubjectIds(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };
  
  // Toggle class selection for create modal
  const toggleCreateClassSelection = (classId: number) => {
    setCreateSelectedClassIds(prev => {
      const newSelection = prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
      
      // Clear subject selection when classes change
      setCreateSelectedSubjectIds([]);
      
      return newSelection;
    });
  };
  
  // Toggle subject selection for create modal
  const toggleCreateSubjectSelection = (subjectId: number) => {
    setCreateSelectedSubjectIds(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  // Filter teachers based on search and department
  const filteredTeachers = teachers.filter((teacher: any) => {
    const matchesSearch = !searchTerm || 
      `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (teacher.employeeId && teacher.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDepartment = selectedDepartment === 'all' || 
      (teacher.department && teacher.department === selectedDepartment);
    
    return matchesSearch && matchesDepartment;
  });

  // Get unique departments for filter
  const departments = Array.from(new Set(teachers.map((t: any) => t.department).filter(Boolean))) as string[];

  return (
    <div className="space-y-6" data-testid="teachers-management">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Teachers Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-teacher">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input 
                      id="firstName" 
                      {...register('firstName')} 
                      data-testid="input-first-name"
                    />
                    {errors.firstName && (
                      <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input 
                      id="lastName" 
                      {...register('lastName')} 
                      data-testid="input-last-name"
                    />
                    {errors.lastName && (
                      <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.gender && (
                      <p className="text-sm text-red-500 mt-1">{errors.gender.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      {...register('phone')} 
                      placeholder="e.g., 08012345678"
                      data-testid="input-phone"
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    {...register('email')} 
                    data-testid="input-email"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Section 2: Teaching Assignment (only for new teachers) */}
              {!editingTeacher && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                    Teaching Assignment
                  </h3>
                  
                  {/* Assign Classes - Multi-select */}
                  <div>
                    <Label>Assign Classes</Label>
                    <div className="border rounded-lg p-3 mt-2 max-h-40 overflow-y-auto">
                      {classes.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {classes.map((classItem: any) => (
                            <label 
                              key={classItem.id} 
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={createSelectedClassIds.includes(classItem.id)}
                                onCheckedChange={() => toggleCreateClassSelection(classItem.id)}
                                data-testid={`checkbox-class-${classItem.id}`}
                              />
                              <span className="text-sm">{classItem.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">No classes available</p>
                      )}
                    </div>
                    {createSelectedClassIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Selected: {createSelectedClassIds.map(id => classes.find((c: any) => c.id === id)?.name).join(', ')}
                      </p>
                    )}
                  </div>
                  
                  {/* Assign Subjects - Always show ALL subjects for visibility */}
                  <div>
                    <Label>Assign Subjects</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {createSelectedClassIds.length > 0 
                        ? `Select subjects to assign to this teacher for the selected class(es)`
                        : `All available subjects (${createFilteredSubjects.length}). Select class(es) above first.`
                      }
                    </p>
                    <div className={`border rounded-lg p-3 mt-2 max-h-64 overflow-y-auto ${createSelectedClassIds.length === 0 ? 'opacity-60' : ''}`}>
                      {createFilteredSubjects.length > 0 ? (
                        <div className="space-y-1">
                          {createFilteredSubjects.map((subject: any) => (
                            <label 
                              key={subject.id} 
                              className={`flex items-center gap-2 p-2 rounded ${createSelectedClassIds.length > 0 ? 'hover:bg-muted cursor-pointer' : 'cursor-not-allowed'}`}
                            >
                              <Checkbox
                                checked={createSelectedSubjectIds.includes(subject.id)}
                                onCheckedChange={() => toggleCreateSubjectSelection(subject.id)}
                                disabled={createSelectedClassIds.length === 0}
                                data-testid={`checkbox-subject-${subject.id}`}
                              />
                              <span className="text-sm flex-1">{subject.name}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  (subject.category || 'general').toLowerCase() === 'science' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                                  (subject.category || 'general').toLowerCase() === 'art' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' :
                                  (subject.category || 'general').toLowerCase() === 'commercial' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                                  'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                }`}
                              >
                                {subject.category || 'general'}
                              </Badge>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">No subjects available. Please add subjects first.</p>
                      )}
                    </div>
                    {createSelectedSubjectIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Selected: {createSelectedSubjectIds.length} subject(s)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Additional fields for editing */}
              {editingTeacher && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input 
                        id="employeeId" 
                        {...register('employeeId')} 
                        placeholder="e.g., EMP/2024/001"
                        data-testid="input-employee-id"
                      />
                      {errors.employeeId && (
                        <p className="text-sm text-red-500 mt-1">{errors.employeeId.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input 
                        id="dateOfBirth" 
                        type="date" 
                        {...register('dateOfBirth')} 
                        data-testid="input-date-of-birth"
                      />
                      {errors.dateOfBirth && (
                        <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input 
                      id="address" 
                      {...register('address')} 
                      data-testid="input-address"
                    />
                    {errors.address && (
                      <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input 
                        id="department" 
                        {...register('department')} 
                        placeholder="e.g., Mathematics"
                        data-testid="input-department"
                      />
                      {errors.department && (
                        <p className="text-sm text-red-500 mt-1">{errors.department.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="dateOfJoining">Date of Joining</Label>
                      <Input 
                        id="dateOfJoining" 
                        type="date" 
                        {...register('dateOfJoining')} 
                        data-testid="input-date-of-joining"
                      />
                      {errors.dateOfJoining && (
                        <p className="text-sm text-red-500 mt-1">{errors.dateOfJoining.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="qualifications">Qualifications</Label>
                    <Input 
                      id="qualifications" 
                      {...register('qualifications')} 
                      placeholder="e.g., B.Ed Mathematics, M.Sc Mathematics"
                      data-testid="input-qualifications"
                    />
                    {errors.qualifications && (
                      <p className="text-sm text-red-500 mt-1">{errors.qualifications.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="salary">Salary</Label>
                    <Input 
                      id="salary" 
                      {...register('salary')} 
                      placeholder="e.g., 50000"
                      data-testid="input-salary"
                    />
                    {errors.salary && (
                      <p className="text-sm text-red-500 mt-1">{errors.salary.message}</p>
                    )}
                  </div>
                  
                  {/* Teaching Assignment Section for Edit Modal */}
                  <div className="space-y-4 border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                      Teaching Assignment
                    </h3>
                    
                    {/* Assign Classes - Multi-select */}
                    <div>
                      <Label>Assign Classes</Label>
                      <div className="border rounded-lg p-3 mt-2 max-h-40 overflow-y-auto">
                        {classes.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {classes.map((classItem: any) => (
                              <label 
                                key={classItem.id} 
                                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={editSelectedClassIds.includes(classItem.id)}
                                  onCheckedChange={() => toggleEditClassSelection(classItem.id)}
                                  data-testid={`checkbox-edit-class-${classItem.id}`}
                                />
                                <span className="text-sm">{classItem.name}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-2">No classes available</p>
                        )}
                      </div>
                      {editSelectedClassIds.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: {editSelectedClassIds.map(id => classes.find((c: any) => c.id === id)?.name).join(', ')}
                        </p>
                      )}
                    </div>
                    
                    {/* Assign Subjects - Show ALL subjects */}
                    <div>
                      <Label>Assign Subjects</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        {editSelectedClassIds.length > 0 
                          ? `Select subjects to assign to this teacher for the selected class(es)`
                          : `Select class(es) above first to assign subjects.`
                        }
                      </p>
                      <div className={`border rounded-lg p-3 mt-2 max-h-64 overflow-y-auto ${editSelectedClassIds.length === 0 ? 'opacity-60' : ''}`}>
                        {createFilteredSubjects.length > 0 ? (
                          <div className="space-y-1">
                            {createFilteredSubjects.map((subject: any) => (
                              <label 
                                key={subject.id} 
                                className={`flex items-center gap-2 p-2 rounded ${editSelectedClassIds.length > 0 ? 'hover:bg-muted cursor-pointer' : 'cursor-not-allowed'}`}
                              >
                                <Checkbox
                                  checked={editSelectedSubjectIds.includes(subject.id)}
                                  onCheckedChange={() => toggleEditSubjectSelection(subject.id)}
                                  disabled={editSelectedClassIds.length === 0}
                                  data-testid={`checkbox-edit-subject-${subject.id}`}
                                />
                                <span className="text-sm flex-1">{subject.name}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    (subject.category || 'general').toLowerCase() === 'science' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                                    (subject.category || 'general').toLowerCase() === 'art' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' :
                                    (subject.category || 'general').toLowerCase() === 'commercial' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                                    'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                  }`}
                                >
                                  {subject.category || 'general'}
                                </Badge>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-2">No subjects available.</p>
                        )}
                      </div>
                      {editSelectedSubjectIds.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: {editSelectedSubjectIds.length} subject(s)
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTeacherMutation.isPending || updateTeacherMutation.isPending}
                  data-testid="button-save-teacher"
                >
                  {createTeacherMutation.isPending || updateTeacherMutation.isPending ? 'Saving...' : 
                   editingTeacher ? 'Update Teacher' : 'Add Teacher'}
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
                  placeholder="Search teachers by name, email, or employee ID..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48" data-testid="select-department-filter">
                <SelectValue placeholder="Filter by Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept: string) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Teachers List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Teachers ({filteredTeachers.length})</span>
            <Badge variant="secondary" data-testid="text-total-teachers">
              Total: {teachers.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTeachers ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading teachers...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher: any) => (
                    <TableRow key={teacher.id} data-testid={`row-teacher-${teacher.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {teacher.firstName?.[0]}{teacher.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium" data-testid={`text-teacher-name-${teacher.id}`}>
                              {teacher.firstName} {teacher.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {teacher.qualifications || 'No qualifications listed'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-employee-id-${teacher.id}`}>
                        <Badge variant="outline">
                          {teacher.employeeId || 'Not assigned'}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-department-${teacher.id}`}>
                        <div className="flex items-center">
                          <GraduationCap className="w-4 h-4 mr-1 text-muted-foreground" />
                          {teacher.department || 'Not assigned'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="w-3 h-3 mr-1 text-muted-foreground" />
                            {teacher.email}
                          </div>
                          {teacher.phone && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Phone className="w-3 h-3 mr-1" />
                              {teacher.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-joining-date-${teacher.id}`}>
                        {teacher.dateOfJoining ? 
                          new Date(teacher.dateOfJoining).toLocaleDateString() : 
                          'Not specified'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={teacher.isActive ? "default" : "secondary"}>
                          {teacher.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(teacher)}
                            data-testid={`button-edit-teacher-${teacher.id}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setTeacherToDelete(teacher)}
                            data-testid={`button-delete-teacher-${teacher.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No teachers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {teacherToDelete && (
        <Dialog open={!!teacherToDelete} onOpenChange={() => setTeacherToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete <strong>{teacherToDelete.firstName} {teacherToDelete.lastName}</strong>? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setTeacherToDelete(null)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteTeacherMutation.mutate(teacherToDelete.id)}
                  disabled={deleteTeacherMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteTeacherMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Login Credentials Dialog */}
      <Dialog open={credentialsDialog.open} onOpenChange={(open) => setCredentialsDialog({ ...credentialsDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Teacher Created Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                Please share these login credentials with the teacher. An email has also been sent to <strong>{credentialsDialog.email}</strong>.
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                ⚠️ These credentials will only be shown once. Make sure to save them.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <Label className="text-xs text-muted-foreground">Username</Label>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-sm font-mono font-semibold" data-testid="text-teacher-username">
                    {credentialsDialog.username}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsDialog.username);
                      toast({ title: "Copied!", description: "Username copied to clipboard" });
                    }}
                    data-testid="button-copy-username"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-sm font-mono font-semibold" data-testid="text-teacher-password">
                    {credentialsDialog.password}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsDialog.password);
                      toast({ title: "Copied!", description: "Password copied to clipboard" });
                    }}
                    data-testid="button-copy-password"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> The teacher will be required to change their password on first login.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => setCredentialsDialog({ open: false, username: '', password: '', email: '' })}
                data-testid="button-close-credentials"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Assignment Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Manage Class & Subject Assignments
            </DialogTitle>
          </DialogHeader>
          
          {selectedTeacherForAssignment && (
            <div className="space-y-6">
              {/* Teacher Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-medium">
                  {selectedTeacherForAssignment.firstName} {selectedTeacherForAssignment.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{selectedTeacherForAssignment.email}</p>
              </div>
              
              {/* Current Assignments */}
              <div>
                <h3 className="font-medium mb-3">Current Assignments</h3>
                {teacherAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {teacherAssignments.map((assignment: any) => (
                      <div 
                        key={assignment.classId} 
                        className="border rounded-lg p-3"
                        data-testid={`assignment-class-${assignment.classId}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{assignment.className}</span>
                          {assignment.department && (
                            <Badge variant="secondary">{assignment.department}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {assignment.subjects?.map((subject: any) => (
                            <Badge 
                              key={subject.id} 
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {subject.name}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 ml-1"
                                onClick={() => deleteAssignmentMutation.mutate(subject.assignmentId)}
                                disabled={deleteAssignmentMutation.isPending}
                                data-testid={`button-remove-assignment-${subject.assignmentId}`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No subjects assigned yet.</p>
                )}
              </div>
              
              {/* Add New Assignment */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Add New Assignment</h3>
                
                <div className="space-y-4">
                  {/* Class Selection */}
                  <div>
                    <Label>Select Class</Label>
                    <Select value={selectedClassId} onValueChange={handleClassChange}>
                      <SelectTrigger data-testid="select-assignment-class">
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls: any) => (
                          <SelectItem key={cls.id} value={String(cls.id)}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Department Selection (for SS1-SS3) */}
                  {selectedClass && isSeniorClass(selectedClass.name) && (
                    <div>
                      <Label>Select Department</Label>
                      <Select 
                        value={selectedDepartmentForAssignment} 
                        onValueChange={setSelectedDepartmentForAssignment}
                      >
                        <SelectTrigger data-testid="select-assignment-department">
                          <SelectValue placeholder="Choose a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept.value} value={dept.value}>
                              <div className="flex items-center gap-2">
                                <dept.icon className="w-4 h-4" />
                                {dept.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Senior secondary classes require department selection.
                      </p>
                    </div>
                  )}
                  
                  {/* Subject Selection - Always show ALL subjects for visibility */}
                  <div>
                    <Label>Select Subjects</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {selectedClassId 
                        ? `Select subjects to assign to this teacher`
                        : `All available subjects (${filteredSubjects.length}). Select a class above first.`
                      }
                    </p>
                    <div className={`border rounded-lg p-3 mt-2 max-h-64 overflow-y-auto ${!selectedClassId ? 'opacity-60' : ''}`}>
                      {filteredSubjects.length > 0 ? (
                        <div className="space-y-2">
                          {filteredSubjects.map((subject: any) => (
                            <div 
                              key={subject.id} 
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={`subject-${subject.id}`}
                                checked={selectedSubjectIds.includes(subject.id)}
                                onCheckedChange={() => toggleSubjectSelection(subject.id)}
                                disabled={!selectedClassId}
                                data-testid={`checkbox-subject-${subject.id}`}
                              />
                              <label 
                                htmlFor={`subject-${subject.id}`}
                                className={`text-sm flex items-center gap-2 flex-1 ${selectedClassId ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              >
                                <span>{subject.name}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    (subject.category || 'general').toLowerCase() === 'science' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                                    (subject.category || 'general').toLowerCase() === 'art' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' :
                                    (subject.category || 'general').toLowerCase() === 'commercial' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                                    'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                  }`}
                                >
                                  {subject.category || 'general'}
                                </Badge>
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No subjects available. Please add subjects first.
                        </p>
                      )}
                    </div>
                    {selectedSubjectIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedSubjectIds.length} subject(s) selected
                      </p>
                    )}
                  </div>
                  
                  {/* Add Button */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAssignmentDialogOpen(false)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleAddAssignments}
                      disabled={
                        !selectedClassId || 
                        selectedSubjectIds.length === 0 ||
                        createAssignmentMutation.isPending
                      }
                      data-testid="button-add-assignments"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {createAssignmentMutation.isPending ? 'Adding...' : 'Add Subjects'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}