import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { Search, Plus, Edit, Trash2, History, Users, BookOpen, GraduationCap, CheckCircle, XCircle, AlertTriangle, Clock, Filter } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { isSeniorSecondaryClass } from '@/lib/utils';
import { format } from 'date-fns';

interface TeacherAssignment {
  id: number;
  teacherId: string;
  classId: number;
  subjectId: number;
  department?: string;
  termId?: number;
  session?: string;
  isActive: boolean;
  validUntil?: string;
  createdAt: string;
  teacherFirstName?: string;
  teacherLastName?: string;
  className?: string;
  classLevel?: string;
  subjectName?: string;
  subjectCode?: string;
}

interface AssignmentHistory {
  id: number;
  assignmentId: number;
  teacherId: string;
  classId: number;
  subjectId: number;
  action: string;
  previousValues?: string;
  newValues?: string;
  reason?: string;
  createdAt: string;
  performedByFirstName?: string;
  performedByLastName?: string;
}

const DEPARTMENTS = [
  { value: 'science', label: 'Science' },
  { value: 'art', label: 'Art' },
  { value: 'commercial', label: 'Commercial' },
];

export default function TeacherAssignmentManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('assignments');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null);
  
  const [formData, setFormData] = useState({
    teacherId: '',
    classId: '',
    subjectId: '',
    department: '',
    termId: '',
    session: '',
    validUntil: '',
  });


  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<TeacherAssignment[]>({
    queryKey: ['/api/teacher-assignments', showInactive ? 'inactive' : 'active'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/teacher-assignments?includeInactive=${showInactive}`);
      return await response.json();
    },
  });

  const { data: assignmentHistory = [] } = useQuery<AssignmentHistory[]>({
    queryKey: ['/api/teacher-assignments/history'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teacher-assignments/history?limit=100');
      return await response.json();
    },
    enabled: activeTab === 'history',
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=Teacher');
      return await response.json();
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });

  const { data: terms = [] } = useQuery({
    queryKey: ['/api/academic-terms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/academic-terms');
      return await response.json();
    },
  });

  useSocketIORealtime({
    table: 'teacher_class_assignments',
    queryKey: ['/api/teacher-assignments', showInactive ? 'inactive' : 'active'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/teacher-assignments', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create assignment');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Success', description: 'Assignment created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/teacher-assignments/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update assignment');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
      setIsEditDialogOpen(false);
      setSelectedAssignment(null);
      toast({ title: 'Success', description: 'Assignment updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/teacher-assignments/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete assignment');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments/history'] });
      setIsDeleteDialogOpen(false);
      setSelectedAssignment(null);
      toast({ title: 'Success', description: 'Assignment deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      teacherId: '',
      classId: '',
      subjectId: '',
      department: '',
      termId: '',
      session: '',
      validUntil: '',
    });
  };

  const isSeniorClass = (className: string | undefined | null) => {
    return isSeniorSecondaryClass(className);
  };

  const selectedClassObj = useMemo(() => {
    return classes.find((c: any) => String(c.id) === formData.classId);
  }, [classes, formData.classId]);

  // Show ALL subjects - admin can assign any subject to teacher
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

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a: TeacherAssignment) => {
      const searchMatch = searchTerm === '' || 
        `${a.teacherFirstName} ${a.teacherLastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.className?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.subjectName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const teacherMatch = filterTeacher === 'all' || a.teacherId === filterTeacher;
      const classMatch = filterClass === 'all' || String(a.classId) === filterClass;
      const subjectMatch = filterSubject === 'all' || String(a.subjectId) === filterSubject;
      
      return searchMatch && teacherMatch && classMatch && subjectMatch;
    });
  }, [assignments, searchTerm, filterTeacher, filterClass, filterSubject]);

  const handleCreate = () => {
    if (!formData.teacherId || !formData.classId || !formData.subjectId) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      teacherId: formData.teacherId,
      classId: parseInt(formData.classId),
      subjectId: parseInt(formData.subjectId),
      department: formData.department || undefined,
      termId: formData.termId ? parseInt(formData.termId) : undefined,
      session: formData.session || undefined,
      validUntil: formData.validUntil || undefined,
    });
  };

  const handleUpdate = () => {
    if (!selectedAssignment) return;
    updateMutation.mutate({
      id: selectedAssignment.id,
      data: {
        isActive: selectedAssignment.isActive,
        department: formData.department || undefined,
        termId: formData.termId ? parseInt(formData.termId) : null,
        session: formData.session || undefined,
        validUntil: formData.validUntil || null,
      },
    });
  };

  const openEditDialog = (assignment: TeacherAssignment) => {
    setSelectedAssignment(assignment);
    setFormData({
      teacherId: assignment.teacherId,
      classId: String(assignment.classId),
      subjectId: String(assignment.subjectId),
      department: assignment.department || '',
      termId: assignment.termId ? String(assignment.termId) : '',
      session: assignment.session || '',
      validUntil: assignment.validUntil ? assignment.validUntil.split('T')[0] : '',
    });
    setIsEditDialogOpen(true);
  };

  const toggleActive = async (assignment: TeacherAssignment) => {
    updateMutation.mutate({
      id: assignment.id,
      data: { isActive: !assignment.isActive },
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Created</Badge>;
      case 'updated':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Updated</Badge>;
      case 'deleted':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Deleted</Badge>;
      case 'disabled':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Disabled</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const stats = useMemo(() => {
    const active = assignments.filter((a: TeacherAssignment) => a.isActive).length;
    const inactive = assignments.filter((a: TeacherAssignment) => !a.isActive).length;
    const uniqueTeachers = new Set(assignments.map((a: TeacherAssignment) => a.teacherId)).size;
    const uniqueClasses = new Set(assignments.map((a: TeacherAssignment) => a.classId)).size;
    return { active, inactive, uniqueTeachers, uniqueClasses };
  }, [assignments]);

  return (

      <div className="p-6 space-y-6" data-testid="teacher-assignment-management">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Teacher-Class-Subject Assignments</h1>
            <p className="text-muted-foreground">Manage which teachers can access specific classes and subjects</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-assignment">
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Assignments</p>
                  <p className="text-2xl font-bold" data-testid="text-active-count">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <XCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inactive Assignments</p>
                  <p className="text-2xl font-bold" data-testid="text-inactive-count">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teachers Assigned</p>
                  <p className="text-2xl font-bold" data-testid="text-teachers-count">{stats.uniqueTeachers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Classes Covered</p>
                  <p className="text-2xl font-bold" data-testid="text-classes-count">{stats.uniqueClasses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="assignments" data-testid="tab-assignments">
              <BookOpen className="w-4 h-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filters
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-inactive" className="text-sm">Show Inactive</Label>
                    <Switch
                      id="show-inactive"
                      checked={showInactive}
                      onCheckedChange={setShowInactive}
                      data-testid="switch-show-inactive"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                    <SelectTrigger data-testid="select-filter-teacher">
                      <SelectValue placeholder="Filter by Teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teachers</SelectItem>
                      {teachers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger data-testid="select-filter-class">
                      <SelectValue placeholder="Filter by Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSubject} onValueChange={setFilterSubject}>
                    <SelectTrigger data-testid="select-filter-subject">
                      <SelectValue placeholder="Filter by Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {subjects.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {loadingAssignments ? (
                  <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>
                ) : filteredAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No assignments found. Create one to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssignments.map((assignment: TeacherAssignment) => (
                        <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                                {assignment.teacherFirstName?.[0]}{assignment.teacherLastName?.[0]}
                              </div>
                              <span className="font-medium">
                                {assignment.teacherFirstName} {assignment.teacherLastName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{assignment.className}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{assignment.subjectName}</span>
                              <span className="text-xs text-muted-foreground ml-2">({assignment.subjectCode})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignment.department ? (
                              <Badge variant="secondary" className="capitalize">{assignment.department}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={assignment.isActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}
                            >
                              {assignment.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.validUntil ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="w-3 h-3" />
                                {format(new Date(assignment.validUntil), 'MMM d, yyyy')}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No expiry</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleActive(assignment)}
                                title={assignment.isActive ? 'Deactivate' : 'Activate'}
                                data-testid={`button-toggle-${assignment.id}`}
                              >
                                {assignment.isActive ? (
                                  <XCircle className="w-4 h-4 text-yellow-600" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(assignment)}
                                data-testid={`button-edit-${assignment.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setIsDeleteDialogOpen(true);
                                }}
                                data-testid={`button-delete-${assignment.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Assignment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No history records found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentHistory.map((record: AssignmentHistory) => (
                        <TableRow key={record.id} data-testid={`row-history-${record.id}`}>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(record.createdAt), 'MMM d, yyyy')}
                              <span className="text-muted-foreground ml-1">
                                {format(new Date(record.createdAt), 'h:mm a')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getActionBadge(record.action)}</TableCell>
                          <TableCell>
                            <span className="font-medium">ID: {record.teacherId.slice(0, 8)}...</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              Class ID: {record.classId}, Subject ID: {record.subjectId}
                              {record.reason && (
                                <div className="mt-1 text-xs">Reason: {record.reason}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.performedByFirstName && record.performedByLastName ? (
                              <span>{record.performedByFirstName} {record.performedByLastName}</span>
                            ) : (
                              <span className="text-muted-foreground">System</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>
                Assign a teacher to a class and subject combination.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Teacher *</Label>
                <Select value={formData.teacherId} onValueChange={(v) => setFormData({...formData, teacherId: v})}>
                  <SelectTrigger data-testid="select-teacher">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select 
                  value={formData.classId} 
                  onValueChange={(v) => setFormData({...formData, classId: v, department: '', subjectId: ''})}
                >
                  <SelectTrigger data-testid="select-class">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClassObj && isSeniorClass(selectedClassObj.name) && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select 
                    value={formData.department} 
                    onValueChange={(v) => setFormData({...formData, department: v, subjectId: ''})}
                  >
                    <SelectTrigger data-testid="select-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Select 
                  value={formData.subjectId} 
                  onValueChange={(v) => setFormData({...formData, subjectId: v})}
                  disabled={!formData.classId}
                >
                  <SelectTrigger data-testid="select-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term (Optional)</Label>
                <Select value={formData.termId} onValueChange={(v) => setFormData({...formData, termId: v})}>
                  <SelectTrigger data-testid="select-term">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session (Optional)</Label>
                <Input
                  placeholder="e.g., 2024/2025"
                  value={formData.session}
                  onChange={(e) => setFormData({...formData, session: e.target.value})}
                  data-testid="input-session"
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until (Optional)</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                  data-testid="input-valid-until"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {setIsCreateDialogOpen(false); resetForm();}}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={createMutation.isPending}
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Assignment</DialogTitle>
              <DialogDescription>
                Update assignment details. Teacher, class, and subject cannot be changed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <strong>Teacher:</strong> {selectedAssignment?.teacherFirstName} {selectedAssignment?.teacherLastName}
                </div>
                <div className="text-sm">
                  <strong>Class:</strong> {selectedAssignment?.className}
                </div>
                <div className="text-sm">
                  <strong>Subject:</strong> {selectedAssignment?.subjectName}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                  <SelectTrigger data-testid="edit-select-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={formData.termId} onValueChange={(v) => setFormData({...formData, termId: v})}>
                  <SelectTrigger data-testid="edit-select-term">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {terms.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Input
                  placeholder="e.g., 2024/2025"
                  value={formData.session}
                  onChange={(e) => setFormData({...formData, session: e.target.value})}
                  data-testid="edit-input-session"
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                  data-testid="edit-input-valid-until"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending}
                data-testid="button-submit-update"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Assignment
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this assignment? This action cannot be undone.
                The teacher will lose access to this class/subject combination.
              </DialogDescription>
            </DialogHeader>
            {selectedAssignment && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <strong>Teacher:</strong> {selectedAssignment.teacherFirstName} {selectedAssignment.teacherLastName}
                </div>
                <div className="text-sm">
                  <strong>Class:</strong> {selectedAssignment.className}
                </div>
                <div className="text-sm">
                  <strong>Subject:</strong> {selectedAssignment.subjectName}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => selectedAssignment && deleteMutation.mutate(selectedAssignment.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Assignment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

  );
}
