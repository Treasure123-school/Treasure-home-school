import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { optimisticUpdateItem, optimisticDelete, rollbackOnError } from '@/lib/optimisticUpdates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentSchema, quickCreateStudentSchema, type CreateStudentRequest, type QuickCreateStudentRequest } from '@shared/schema';
import { UserPlus, Edit, Search, Download, Trash2, Shield, ShieldOff, Upload, FileText, Key, AlertTriangle, AlertCircle, GraduationCap, Palette, Briefcase, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { ROLE_IDS } from '@/lib/roles';
import { isSeniorSecondaryClass } from '@/lib/utils';

const DEPARTMENTS = [
  { value: 'science', label: 'Science', icon: GraduationCap },
  { value: 'art', label: 'Art', icon: Palette },
  { value: 'commercial', label: 'Commercial', icon: Briefcase },
] as const;

// Use shared schema to prevent frontend/backend drift
type StudentForm = CreateStudentRequest;
type QuickStudentForm = QuickCreateStudentRequest;

export default function StudentManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page.</div>;
  }
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedStudents, setUploadedStudents] = useState<any[]>([]);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [formSelectedClassId, setFormSelectedClassId] = useState<number | null>(null);
  const [editFormSelectedClassId, setEditFormSelectedClassId] = useState<number | null>(null);
  const [editFormDepartment, setEditFormDepartment] = useState<string | null>(null);
  const [studentToBlock, setStudentToBlock] = useState<any>(null);

  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<QuickStudentForm>({
    resolver: zodResolver(quickCreateStudentSchema),
    defaultValues: {
      fullName: '',
      gender: undefined,
      dateOfBirth: '',
      classId: undefined,
      department: undefined,
    }
  });

  // Edit form
  const { register: registerEdit, handleSubmit: handleEditSubmit, formState: { errors: editErrors }, setValue: setEditValue, reset: resetEdit } = useForm<StudentForm>({
    resolver: zodResolver(createStudentSchema.partial()),
  });

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['/api/students'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/students');
      return await response.json();
    },
  });

  // Enable real-time updates for students
  useSocketIORealtime({ 
    table: 'students', 
    queryKey: ['/api/students']
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  // Helper to check if a class is a senior secondary class (SS1-SS3, SSS1-SSS3)
  const isSeniorClass = (className: string | undefined) => {
    return isSeniorSecondaryClass(className);
  };
  
  // Get the selected class object for the create form (must be after classes query)
  const formSelectedClass = classes.find((c: any) => c.id === formSelectedClassId);
  const requiresDepartment = isSeniorClass(formSelectedClass?.name);
  
  // Get the selected class object for the edit form
  const editFormSelectedClass = classes.find((c: any) => c.id === editFormSelectedClassId);
  const editRequiresDepartment = isSeniorClass(editFormSelectedClass?.name);

  // Fetch users (for parents)
  const { data: parents = [] } = useQuery({
    queryKey: ['/api/users', 'parent'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Parent');
      return await response.json();
    },
  });

  // Fetch all users to get student user info
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return await response.json();
    },
  });

  // Create student mutation
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);

  const createStudentMutation = useMutation({
    mutationFn: async (data: QuickStudentForm) => {
      // Parse full name into first and last name
      const nameParts = data.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
      
      // Auto-set admission date to today
      const today = new Date().toISOString().split('T')[0];
      
      // Create student - email, password, username, and admissionNumber are auto-generated by backend
      const studentResponse = await apiRequest('POST', '/api/students', {
        firstName,
        lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        classId: data.classId,
        admissionDate: today,
        department: data.department || undefined,
      });

      if (!studentResponse.ok) {
        const errorData = await studentResponse.json();
        throw new Error(errorData.message || 'Failed to create student');
      }
      return await studentResponse.json();
    },
    onSuccess: (data) => {
      // Store generated credentials to show to admin
      if (data.credentials) {
        setCreatedCredentials(data.credentials);
      }
      toast({
        title: 'Success',
        description: data.parentCreated 
          ? 'Student and Parent accounts created successfully!' 
          : 'Student created successfully with auto-generated credentials',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      reset();
      setFormSelectedClassId(null); // Reset form class selection
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create student',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: QuickStudentForm) => {
    createStudentMutation.mutate(data);
  };

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StudentForm> }) => {
      const response = await apiRequest('PATCH', `/api/students/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update student');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Student updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      resetEdit();
      setEditingStudent(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update student',
        variant: 'destructive',
      });
    },
  });

  // Block/Unblock student mutation with optimistic update
  const blockStudentMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/students/${id}/block`, { isActive });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update student status');
      }
      return await response.json();
    },
    onMutate: async ({ id, isActive }) => {
      const queryKey = ['/api/students'];
      await queryClient.cancelQueries({ queryKey });
      
      const previousData = queryClient.getQueryData(queryKey);
      
      // Update the nested user.isActive field for proper UI feedback
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((student: any) =>
          student.id === id
            ? { ...student, isActive, user: { ...student.user, isActive } }
            : student
        );
      });
      
      toast({
        title: isActive ? "Activating..." : "Blocking...",
        description: "Updating student status",
      });
      
      return { previousData };
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousData) {
        rollbackOnError(['/api/students'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to update student status',
        variant: 'destructive',
      });
    },
  });

  // Delete student mutation with optimistic update
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/students/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete student');
      }
      // Handle 204 No Content response - don't parse JSON
      if (response.status === 204) return { message: 'Student deleted successfully' };
      // Only parse JSON if there's content
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        return response.json();
      }
      return { message: 'Student deleted successfully' };
    },
    onMutate: async (id) => {
      const queryKey = ['/api/students'];
      const context = await optimisticDelete({ queryKey, idToDelete: id, idField: 'id' });
      
      toast({
        title: "Deleting...",
        description: "Removing student from the system",
      });
      
      return context;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data?.message || 'Student deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousData) {
        rollbackOnError(['/api/students'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete student',
        variant: 'destructive',
      });
    },
  });

  // CSV Upload mutation
  const csvUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/students/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload students');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Upload Successful',
        description: `Created ${data.students?.length || 0} students successfully`,
      });
      setUploadedStudents(data.students || []);
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Generate login slips mutation
  const generateLoginSlipsMutation = useMutation({
    mutationFn: async ({ studentIds, passwords }: { studentIds: string[], passwords?: Record<string, string> }) => {
      const studentsForSlips = enrichedStudents
        .filter((s: any) => studentIds.includes(s.id))
        .map((s: any) => ({
          firstName: s.user?.firstName || '',
          lastName: s.user?.lastName || '',
          roleId: ROLE_IDS.STUDENT,
          username: s.user?.username || '',
          password: passwords?.[s.id] || 'Contact Admin',
        }));

      const response = await fetch('/api/users/generate-login-slips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ users: studentsForSlips }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate login slips');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `THS-Login-Slips-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: 'Login Slips Generated',
        description: 'PDF downloaded successfully',
      });
      setSelectedStudents([]);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate login slips',
        variant: 'destructive',
      });
    },
  });

  const onEditSubmit = (data: Partial<StudentForm>) => {
    if (editingStudent) {
      updateStudentMutation.mutate({ id: editingStudent.id, data });
    }
  };

  const handleEditClick = (student: any) => {
    setEditingStudent(student);
    // Track class and department for conditional rendering
    setEditFormSelectedClassId(student.classId || null);
    setEditFormDepartment(student.department || null);
    // Populate edit form with current student data (email, password, admissionNumber are not editable)
    resetEdit({
      firstName: student.user?.firstName || '',
      lastName: student.user?.lastName || '',
      phone: student.user?.phone || '',
      address: student.user?.address || '',
      dateOfBirth: student.user?.dateOfBirth || '',
      gender: student.user?.gender || undefined,
      classId: student.classId || undefined,
      parentId: student.parentId || undefined,
      admissionDate: student.admissionDate || '',
      emergencyContact: student.emergencyContact || '',
      medicalInfo: student.medicalInfo || '',
      guardianName: student.guardianName || '',
      department: student.department || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleBlockToggle = (student: any) => {
    const newActiveStatus = !student.user?.isActive;
    blockStudentMutation.mutate({ id: student.id, isActive: newActiveStatus });
  };

  const handleDeleteStudent = (studentId: string) => {
    deleteStudentMutation.mutate(studentId);
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a CSV file',
          variant: 'destructive',
        });
        return;
      }
      // Show preview first
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/students/csv-preview', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to preview CSV');
        }
        const preview = await response.json();
        setCsvPreview(preview);
        setIsPreviewDialogOpen(true);
      } catch (error) {
        toast({
          title: 'Preview Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }
      event.target.value = '';
    }
  };

  const handleConfirmCSVImport = async () => {
    if (csvPreview?.valid.length > 0) {
      try {
        // Commit the import
        const response = await fetch('/api/students/csv-commit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ validRows: csvPreview.valid }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to import students');
        }
        const data = await response.json();
        
        // Transform credentials for display
        const transformedCredentials = data.credentials.map((cred: any) => ({
          id: cred.student.id,
          firstName: cred.student.name.split(' ')[0],
          lastName: cred.student.name.split(' ').slice(1).join(' ') || cred.student.name.split(' ')[0],
          username: cred.student.username,
          password: cred.student.password,
          class: cred.student.classCode
        }));

        setUploadedStudents(transformedCredentials);
        setIsPreviewDialogOpen(false);
        setCsvPreview(null);
        
        queryClient.invalidateQueries({ queryKey: ['/api/students'] });
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        
        toast({
          title: 'Import Successful',
          description: `Created ${data.successCount} students successfully`,
        });
      } catch (error) {
        toast({
          title: 'Import Failed',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s: any) => s.id));
    }
  };

  const handleGenerateLoginSlips = () => {
    if (selectedStudents.length === 0) {
      toast({
        title: 'No Students Selected',
        description: 'Please select at least one student',
        variant: 'destructive',
      });
      return;
    }
    generateLoginSlipsMutation.mutate({ studentIds: selectedStudents });
  };

  // Get student details with user info
  const enrichedStudents = students.map((student: any) => {
    const user = users.find((u: any) => u.id === student.id);
    const classInfo = classes.find((c: any) => c.id === student.classId);
    const parent = users.find((u: any) => u.id === student.parentId);

    return {
      ...student,
      user,
      class: classInfo,
      parent,
    };
  });

  // Filter students
  const filteredStudents = enrichedStudents.filter((student: any) => {
    const matchesSearch = !searchTerm || 
      student.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClass = selectedClass === 'all' || student.classId?.toString() === selectedClass;

    return matchesSearch && matchesClass;
  });

  return (
    <>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Page Header - Fully Responsive */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Student Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage student enrollment and information</p>
          </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-add-student">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Student
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Quick Student Onboarding
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Enter only essential information. Login credentials will be auto-generated. 
                      Student can complete their full profile later.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  {...register('fullName')}
                  placeholder="First name and Last name (e.g. John Adebayo)"
                  data-testid="input-fullName"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter first and last name separated by space</p>
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gender" className="text-sm font-medium">Gender <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(value) => setValue('gender', value as 'Male' | 'Female' | 'Other')}>
                    <SelectTrigger data-testid="select-gender" className="mt-1">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && (
                    <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="dateOfBirth" className="text-sm font-medium">Date of Birth <span className="text-red-500">*</span></Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...register('dateOfBirth')}
                    data-testid="input-dateOfBirth"
                    className="mt-1"
                  />
                  {errors.dateOfBirth && (
                    <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="classId" className="text-sm font-medium">Class <span className="text-red-500">*</span></Label>
                <Select onValueChange={(value) => {
                  const classId = parseInt(value);
                  setValue('classId', classId);
                  setFormSelectedClassId(classId);
                  const cls = classes.find((c: any) => c.id === classId);
                  if (!isSeniorClass(cls?.name)) {
                    setValue('department', null);
                  }
                }}>
                  <SelectTrigger data-testid="select-class" className="mt-1">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && (
                  <p className="text-red-500 text-xs mt-1">{errors.classId.message}</p>
                )}
              </div>

              {requiresDepartment && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2 mb-3">
                    <GraduationCap className="h-4 w-4 text-orange-700 dark:text-orange-300 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                        Department Required for Senior Secondary
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                        This determines which subjects will be auto-assigned.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="department" className="text-sm font-medium">Department <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(value) => setValue('department', value as 'science' | 'art' | 'commercial')}>
                      <SelectTrigger data-testid="select-department" className="mt-1">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => {
                          const Icon = dept.icon;
                          return (
                            <SelectItem key={dept.value} value={dept.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {dept.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  reset();
                  setFormSelectedClassId(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createStudentMutation.isPending}
                  data-testid="button-submit-student"
                >
                  {createStudentMutation.isPending ? 'Creating...' : 'Create Student'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

          <div className="relative w-full sm:w-auto">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
              id="csv-upload"
              data-testid="input-csv-upload"
            />
            <Button
              onClick={() => document.getElementById('csv-upload')?.click()}
              variant="outline"
              className="w-full sm:w-auto"
              disabled={csvUploadMutation.isPending}
              data-testid="button-bulk-upload"
            >
              <Upload className="h-4 w-4 mr-2" />
              {csvUploadMutation.isPending ? 'Uploading...' : 'Bulk Upload CSV'}
            </Button>
          </div>

          <Button
            onClick={handleGenerateLoginSlips}
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={selectedStudents.length === 0 || generateLoginSlipsMutation.isPending}
            data-testid="button-generate-slips"
          >
            <FileText className="h-4 w-4 mr-2" />
            {generateLoginSlipsMutation.isPending ? 'Generating...' : `Generate Login Slips (${selectedStudents.length})`}
          </Button>
        </div>

        {/* Generated Credentials Dialog - Enhanced with Parent Credentials */}
        <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5 text-green-600" />
                {createdCredentials?.parent ? 'Student & Parent Accounts Created!' : 'Student Created Successfully!'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Student Credentials */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Student Login Credentials:
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Username:</p>
                    <p className="font-mono text-sm font-bold">{createdCredentials?.student?.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Password:</p>
                    <p className="font-mono text-sm font-bold">{createdCredentials?.student?.password}</p>
                  </div>
                </div>
              </div>

              {/* Parent Credentials - Only show if parent was auto-created */}
              {createdCredentials?.parent && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Parent Login Credentials (Auto-Created):
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Username:</p>
                      <p className="font-mono text-sm font-bold">{createdCredentials?.parent?.username}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Password:</p>
                      <p className="font-mono text-sm font-bold">{createdCredentials?.parent?.password}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Important:</strong> Save these credentials immediately! The passwords will not be shown again. 
                    Both accounts must change their passwords on first login.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  onClick={() => {
                    // Copy all credentials to clipboard
                    let text = `=== STUDENT CREDENTIALS ===\nUsername: ${createdCredentials?.student?.username}\nPassword: ${createdCredentials?.student?.password}`;

                    if (createdCredentials?.parent) {
                      text += `\n\n=== PARENT CREDENTIALS ===\nUsername: ${createdCredentials?.parent?.username}\nPassword: ${createdCredentials?.parent?.password}`;
                    }

        {/* CSV Preview Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                CSV Import Preview
              </DialogTitle>
            </DialogHeader>
            {csvPreview && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                    <p className="text-2xl font-bold">{csvPreview.summary.total}</p>
                  </Card>
                  <Card className="p-3 border-green-200">
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-2xl font-bold text-green-600">{csvPreview.summary.validCount}</p>
                  </Card>
                  <Card className="p-3 border-red-200">
                    <p className="text-xs text-muted-foreground">Invalid</p>
                    <p className="text-2xl font-bold text-red-600">{csvPreview.summary.invalidCount}</p>
                  </Card>
                  <Card className="p-3 border-blue-200">
                    <p className="text-xs text-muted-foreground">New Parents</p>
                    <p className="text-2xl font-bold text-blue-600">{csvPreview.summary.newParents}</p>
                  </Card>
                </div>

                {/* Invalid Rows Warning */}
                {csvPreview.invalid.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-700 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          {csvPreview.invalid.length} Invalid Rows Found
                        </p>
                        <div className="mt-2 space-y-1">
                          {csvPreview.invalid.slice(0, 5).map((item: any) => (
                            <p key={item.row} className="text-xs text-red-600">
                              Row {item.row}: {item.errors.join(', ')}
                            </p>
                          ))}
                          {csvPreview.invalid.length > 5 && (
                            <p className="text-xs text-red-600">
                              ...and {csvPreview.invalid.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Valid Rows Preview */}
                {csvPreview.valid.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Valid Rows Preview (first 10)</h3>
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>DOB</TableHead>
                            <TableHead>Parent</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvPreview.valid.slice(0, 10).map((item: any) => (
                            <TableRow key={item.row}>
                              <TableCell>{item.data.fullName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{item.data.classCode}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{item.data.dob}</TableCell>
                              <TableCell className="text-xs">
                                {item.data.parentEmail || item.data.parentPhone || 'N/A'}
                              </TableCell>
                              <TableCell>
                                {item.parentExists ? (
                                  <Badge variant="outline" className="text-xs">Link Existing</Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs bg-blue-600">Create New</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmCSVImport}
                    disabled={csvPreview.valid.length === 0}
                  >
                    Import {csvPreview.valid.length} Students
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>


                    navigator.clipboard.writeText(text);
                    toast({
                      title: "Copied!",
                      description: "All credentials copied to clipboard",
                    });
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-copy-credentials"
                >
                  <FileText className="h-4 w-4" />
                  Copy All
                </Button>
                <Button
                  onClick={() => {
                    // Print/Download credentials as PDF
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>THS Portal Login Credentials</title>
                            <style>
                              body { font-family: Arial, sans-serif; padding: 40px; }
                              .header { text-align: center; margin-bottom: 30px; }
                              .section { margin: 20px 0; padding: 20px; border: 2px solid #ddd; border-radius: 8px; }
                              .student { border-color: #3b82f6; }
                              .parent { border-color: #22c55e; }
                              h1 { color: #1e40af; }
                              h2 { margin-top: 0; }
                              .credential { margin: 10px 0; }
                              .label { font-weight: bold; }
                              .value { font-family: monospace; font-size: 16px; }
                              .warning { background: #fef3c7; padding: 15px; border-radius: 5px; margin-top: 20px; }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <h1>Treasure-Home School Portal</h1>
                              <p>Login Credentials</p>
                            </div>

                            <div class="section student">
                              <h2>Student Login</h2>
                              <div class="credential">
                                <span class="label">Username:</span>
                                <div class="value">${createdCredentials?.student?.username}</div>
                              </div>
                              <div class="credential">
                                <span class="label">Password:</span>
                                <div class="value">${createdCredentials?.student?.password}</div>
                              </div>
                            </div>

                            ${createdCredentials?.parent ? `
                              <div class="section parent">
                                <h2>Parent/Guardian Login</h2>
                                <div class="credential">
                                  <span class="label">Username:</span>
                                  <div class="value">${createdCredentials?.parent?.username}</div>
                                </div>
                                <div class="credential">
                                  <span class="label">Password:</span>
                                  <div class="value">${createdCredentials?.parent?.password}</div>
                                </div>
                              </div>
                            ` : ''}

                            <div class="warning">
                              <strong>Important Notes:</strong>
                              <ul>
                                <li>Keep these credentials safe and secure</li>
                                <li>You must change your password on first login</li>
                                <li>Never share your password with anyone</li>
                                <li>Contact school administration if you forget your password</li>
                              </ul>
                            </div>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-print-credentials"
                >
                  <Download className="h-4 w-4" />
                  Print/Download
                </Button>
                <Button onClick={() => setCreatedCredentials(null)} data-testid="button-close-credentials">
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Results Dialog */}
        <Dialog open={uploadedStudents.length > 0} onOpenChange={() => setUploadedStudents([])}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Upload Results</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Successfully created {uploadedStudents.length} student(s)
              </p>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Class</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedStudents.map((student: any) => (
                      <TableRow key={student.username}>
                        <TableCell>{student.firstName} {student.lastName}</TableCell>
                        <TableCell className="font-mono text-sm">{student.username}</TableCell>
                        <TableCell className="font-mono text-sm">{student.password}</TableCell>
                        <TableCell>{student.class || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    const studentIds = uploadedStudents.map((s: any) => s.id).filter(Boolean);
                    const passwords: Record<string, string> = {};
                    uploadedStudents.forEach((s: any) => {
                      if (s.id && s.password) {
                        passwords[s.id] = s.password;
                      }
                    });
                    if (studentIds.length > 0) {
                      generateLoginSlipsMutation.mutate({ studentIds, passwords });
                      setUploadedStudents([]);
                    }
                  }}
                  data-testid="button-generate-uploaded-slips"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Login Slips
                </Button>
                <Button variant="outline" onClick={() => setUploadedStudents([])}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Edit Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="editFirstName" className="text-sm">First Name</Label>
                  <Input
                    id="editFirstName"
                    {...registerEdit('firstName')}
                    data-testid="input-edit-firstName"
                  />
                  {editErrors.firstName && (
                    <p className="text-red-500 text-sm">{editErrors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="editLastName" className="text-sm">Last Name</Label>
                  <Input
                    id="editLastName"
                    {...registerEdit('lastName')}
                    data-testid="input-edit-lastName"
                  />
                  {editErrors.lastName && (
                    <p className="text-red-500 text-sm">{editErrors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="editAdmissionDate" className="text-sm">Date of Admission</Label>
                <Input
                  id="editAdmissionDate"
                  type="date"
                  {...registerEdit('admissionDate')}
                  data-testid="input-edit-admissionDate"
                />
                {editErrors.admissionDate && (
                  <p className="text-red-500 text-sm">{editErrors.admissionDate.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Email, password, username, and admission number are auto-generated and cannot be edited here.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="editDateOfBirth" className="text-sm">Date of Birth</Label>
                  <Input
                    id="editDateOfBirth"
                    type="date"
                    {...registerEdit('dateOfBirth')}
                    data-testid="input-edit-dateOfBirth"
                  />
                  {editErrors.dateOfBirth && (
                    <p className="text-red-500 text-sm">{editErrors.dateOfBirth.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="editGender" className="text-sm">Gender</Label>
                  <Select 
                    value={editingStudent?.user?.gender ?? undefined} 
                    onValueChange={(value) => setEditValue('gender', value as 'Male' | 'Female' | 'Other')}
                  >
                    <SelectTrigger data-testid="select-edit-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {editErrors.gender && (
                    <p className="text-red-500 text-sm">{editErrors.gender.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="editClassId" className="text-sm">Class</Label>
                  <Select 
                    value={editFormSelectedClassId ? editFormSelectedClassId.toString() : ''} 
                    onValueChange={(value) => {
                      const classId = parseInt(value);
                      setEditValue('classId', classId);
                      setEditFormSelectedClassId(classId);
                      // Clear department when class changes to non-senior
                      const cls = classes.find((c: any) => c.id === classId);
                      if (!isSeniorClass(cls?.name)) {
                        setEditValue('department', null);
                        setEditFormDepartment(null);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-edit-class">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name} ({cls.level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editErrors.classId && (
                    <p className="text-red-500 text-sm">{editErrors.classId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="editParentId" className="text-sm">Parent</Label>
                  <Select 
                    value={editingStudent?.parentId || 'none'} 
                    onValueChange={(value) => setEditValue('parentId', value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger data-testid="select-edit-parent">
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Parent</SelectItem>
                      {parents.map((parent: any) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.firstName} {parent.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editErrors.parentId && (
                    <p className="text-red-500 text-sm">{editErrors.parentId.message}</p>
                  )}
                </div>
              </div>

              {editRequiresDepartment && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2 mb-3">
                    <GraduationCap className="h-4 w-4 text-orange-700 dark:text-orange-300 mt-0.5" />
                    <div>
                      <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                        Department Selection Required
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                        Senior secondary students (SS1-SS3) must select a department. This determines which subjects they will be assigned.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="editDepartment" className="text-sm">Department</Label>
                    <Select 
                      value={editFormDepartment || ''}
                      onValueChange={(value) => {
                        setEditValue('department', value as 'science' | 'art' | 'commercial');
                        setEditFormDepartment(value);
                      }}
                    >
                      <SelectTrigger data-testid="select-edit-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => {
                          const Icon = dept.icon;
                          return (
                            <SelectItem key={dept.value} value={dept.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {dept.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {editErrors.department && (
                      <p className="text-red-500 text-sm">{editErrors.department.message}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="editEmergencyContact" className="text-sm">Emergency Contact</Label>
                <Input
                  id="editEmergencyContact"
                  {...registerEdit('emergencyContact')}
                  data-testid="input-edit-emergencyContact"
                />
                {editErrors.emergencyContact && (
                  <p className="text-red-500 text-sm">{editErrors.emergencyContact.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="editPhone" className="text-sm">Phone (Optional)</Label>
                <Input
                  id="editPhone"
                  {...registerEdit('phone')}
                  data-testid="input-edit-phone"
                />
              </div>

              <div>
                <Label htmlFor="editAddress" className="text-sm">Address (Optional)</Label>
                <Input
                  id="editAddress"
                  {...registerEdit('address')}
                  data-testid="input-edit-address"
                />
              </div>

              <div>
                <Label htmlFor="editMedicalInfo" className="text-sm">Medical Information (Optional)</Label>
                <Input
                  id="editMedicalInfo"
                  {...registerEdit('medicalInfo')}
                  data-testid="input-edit-medicalInfo"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateStudentMutation.isPending}
                  data-testid="button-update-student"
                >
                  {updateStudentMutation.isPending ? 'Updating...' : 'Update Student'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filter and Search - Fully Responsive */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Filter Students</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 sm:pt-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm">Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-students"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="classFilter" className="text-sm">Filter by Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full mt-1.5" data-testid="select-class-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table - Fully Responsive */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <CardTitle className="text-base sm:text-lg">Students ({filteredStudents.length})</CardTitle>
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm" data-testid="button-export-students">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 sm:pt-0">
          {loadingStudents ? (
            <div className="text-center py-8 text-sm sm:text-base">Loading students...</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredStudents.map((student: any) => (
                  <div 
                    key={student.id} 
                    className="border border-border rounded-lg p-4 bg-muted/30"
                    data-testid={`card-student-${student.id}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {student.user?.firstName} {student.user?.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {student.user?.email}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {student.admissionNumber}
                          </div>
                        </div>
                        <Badge variant={student.user?.isActive ? "default" : "secondary"} className="ml-2 text-xs">
                          {student.user?.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Class:</span>
                          <div className="font-medium mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {student.class?.name || 'N/A'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Department:</span>
                          <div className="font-medium mt-0.5">
                            {student.department ? (
                              <Badge 
                                variant="outline" 
                                className={`text-xs capitalize ${
                                  student.department === 'science' 
                                    ? 'border-blue-500 text-blue-700 dark:text-blue-300' 
                                    : student.department === 'art' 
                                      ? 'border-purple-500 text-purple-700 dark:text-purple-300' 
                                      : 'border-green-500 text-green-700 dark:text-green-300'
                                }`}
                              >
                                {student.department}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Parent:</span>
                          <div className="font-medium mt-0.5 truncate">
                            {student.parent?.firstName ? `${student.parent.firstName} ${student.parent.lastName}` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Emergency:</span>
                          <div className="font-medium mt-0.5">{student.emergencyContact}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleEditClick(student)}
                          data-testid={`button-edit-${student.id}`}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setStudentToBlock(student)}
                          disabled={blockStudentMutation.isPending && blockStudentMutation.variables?.id === student.id}
                          data-testid={`button-block-${student.id}`}
                        >
                          {student.user?.isActive ? (
                            <>
                              <ShieldOff className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
                              Block
                            </>
                          ) : (
                            <>
                              <Shield className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                              Activate
                            </>
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              data-testid={`button-delete-${student.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Student</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {student.user?.firstName} {student.user?.lastName}? 
                                This will deactivate the student account and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteStudent(student.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Student
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No students found
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-xs lg:text-sm">Admission Number</TableHead>
                      <TableHead className="text-xs lg:text-sm">Name</TableHead>
                      <TableHead className="text-xs lg:text-sm">Class</TableHead>
                      <TableHead className="text-xs lg:text-sm">Department</TableHead>
                      <TableHead className="text-xs lg:text-sm">Parent</TableHead>
                      <TableHead className="text-xs lg:text-sm">Contact</TableHead>
                      <TableHead className="text-xs lg:text-sm">Status</TableHead>
                      <TableHead className="text-xs lg:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student: any) => (
                      <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleSelectStudent(student.id)}
                            className="h-4 w-4"
                            data-testid={`checkbox-student-${student.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-xs lg:text-sm">
                          {student.admissionNumber}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          <div>
                            <div className="font-medium">
                              {student.user?.firstName} {student.user?.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {student.user?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          <Badge variant="secondary" className="text-xs">
                            {student.class?.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          {student.department ? (
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${
                                student.department === 'science' 
                                  ? 'border-blue-500 text-blue-700 dark:text-blue-300' 
                                  : student.department === 'art' 
                                    ? 'border-purple-500 text-purple-700 dark:text-purple-300' 
                                    : 'border-green-500 text-green-700 dark:text-green-300'
                              }`}
                            >
                              {student.department}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">
                          {student.parent?.firstName} {student.parent?.lastName}
                        </TableCell>
                        <TableCell className="text-xs lg:text-sm">{student.emergencyContact}</TableCell>
                        <TableCell>
                          {!student.user?.isActive ? (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          ) : student.user?.mustChangePassword && !student.user?.lastLoginAt ? (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-300">
                              ⏳ Pending Login
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-green-600">
                              ✅ Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditClick(student)}
                              data-testid={`button-edit-${student.id}`}
                              title="Edit student"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStudentToBlock(student)}
                              disabled={blockStudentMutation.isPending && blockStudentMutation.variables?.id === student.id}
                              data-testid={`button-block-${student.id}`}
                              title={student.user?.isActive ? "Block student" : "Activate student"}
                            >
                              {student.user?.isActive ? (
                                <ShieldOff className="h-4 w-4 text-orange-600" />
                              ) : (
                                <Shield className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-delete-${student.id}`}
                                  title="Delete student"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Student</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {student.user?.firstName} {student.user?.lastName}? 
                                    This will deactivate the student account and cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Student
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-sm">
                          No students found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block / Unblock Confirmation Dialog */}
      <AlertDialog open={!!studentToBlock} onOpenChange={(open) => { if (!open) setStudentToBlock(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {studentToBlock?.user?.isActive ? 'Block Student Account' : 'Unblock Student Account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {studentToBlock?.user?.isActive ? (
                <>
                  Are you sure you want to <strong>block</strong>{' '}
                  <strong>{studentToBlock?.user?.firstName} {studentToBlock?.user?.lastName}</strong>?
                  <br /><br />
                  They will be immediately logged out and unable to sign in until their account is unblocked.
                </>
              ) : (
                <>
                  Are you sure you want to <strong>unblock</strong>{' '}
                  <strong>{studentToBlock?.user?.firstName} {studentToBlock?.user?.lastName}</strong>?
                  <br /><br />
                  Their account will be restored and they will be able to sign in again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (studentToBlock) {
                  handleBlockToggle(studentToBlock);
                  setStudentToBlock(null);
                }
              }}
              className={studentToBlock?.user?.isActive ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {studentToBlock?.user?.isActive ? 'Yes, Block Account' : 'Yes, Unblock Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}