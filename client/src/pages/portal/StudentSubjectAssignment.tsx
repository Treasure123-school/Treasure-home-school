import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, BookOpen, Users, GraduationCap, Palette, Briefcase, BookMarked, Wand2, Plus, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const DEPARTMENT_OPTIONS = [
  { value: 'all', label: 'All Departments' },
  { value: 'science', label: 'Science', icon: GraduationCap },
  { value: 'art', label: 'Art', icon: Palette },
  { value: 'commercial', label: 'Commercial', icon: Briefcase },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  science: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  art: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  commercial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export default function StudentSubjectAssignment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);


  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['/api/students'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/students');
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

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });

  const { data: studentSubjects = [], refetch: refetchStudentSubjects } = useQuery({
    queryKey: ['/api/students', selectedStudent?.id, 'subjects'],
    queryFn: async () => {
      if (!selectedStudent?.id) return [];
      const response = await apiRequest('GET', `/api/students/${selectedStudent.id}/subjects`);
      return await response.json();
    },
    enabled: !!selectedStudent?.id,
  });

  const { data: availableSubjects = [] } = useQuery({
    queryKey: ['/api/classes', selectedStudent?.classId, 'available-subjects', selectedStudent?.department],
    queryFn: async () => {
      if (!selectedStudent?.classId) return [];
      const departmentParam = selectedStudent.department ? `?department=${selectedStudent.department}` : '';
      const response = await apiRequest('GET', `/api/classes/${selectedStudent.classId}/available-subjects${departmentParam}`);
      return await response.json();
    },
    enabled: !!selectedStudent?.classId,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiRequest('POST', `/api/students/${studentId}/auto-assign-subjects`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Subjects Assigned',
        description: data.message || 'Subjects have been automatically assigned',
      });
      refetchStudentSubjects();
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to auto-assign subjects',
        variant: 'destructive',
      });
    },
  });

  const manualAssignMutation = useMutation({
    mutationFn: async ({ studentId, subjectIds }: { studentId: string; subjectIds: number[] }) => {
      const response = await apiRequest('POST', `/api/students/${studentId}/subjects`, { subjectIds });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Subjects Assigned',
        description: data.message || 'Selected subjects have been assigned',
      });
      setIsAssignDialogOpen(false);
      setSelectedSubjects([]);
      refetchStudentSubjects();
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign subjects',
        variant: 'destructive',
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await apiRequest('DELETE', `/api/student-subject-assignments/${assignmentId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Subject Removed',
        description: 'Subject assignment has been removed',
      });
      refetchStudentSubjects();
    },
    onError: (error: any) => {
      toast({
        title: 'Removal Failed',
        description: error.message || 'Failed to remove subject assignment',
        variant: 'destructive',
      });
    },
  });

  const filteredStudents = students.filter((student: any) => {
    const matchesSearch = !searchTerm || 
      student.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClass === 'all' || student.classId?.toString() === selectedClass;
    
    return matchesSearch && matchesClass;
  });

  const getClassName = (classId: number) => {
    const classInfo = classes.find((c: any) => c.id === classId);
    return classInfo?.name || 'Not Assigned';
  };

  const getDepartmentBadge = (department: string | null) => {
    if (!department) return null;
    const deptInfo = DEPARTMENT_OPTIONS.find(d => d.value === department);
    const Icon = deptInfo?.icon || BookMarked;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="w-3 h-3" />
        {deptInfo?.label || department}
      </Badge>
    );
  };

  const handleAutoAssign = async (student: any) => {
    if (!student.classId) {
      toast({
        title: 'Cannot Assign',
        description: 'Student must be assigned to a class first',
        variant: 'destructive',
      });
      return;
    }
    autoAssignMutation.mutate(student.id);
  };

  const handleManualAssign = () => {
    if (!selectedStudent || selectedSubjects.length === 0) return;
    manualAssignMutation.mutate({
      studentId: selectedStudent.id,
      subjectIds: selectedSubjects,
    });
  };

  const toggleSubjectSelection = (subjectId: number) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const getUnassignedSubjects = () => {
    const assignedIds = studentSubjects.map((s: any) => s.subjectId);
    return availableSubjects.filter((subject: any) => !assignedIds.includes(subject.id));
  };

  return (
      <div className="space-y-6" data-testid="student-subject-assignment">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Student Subject Assignment</h1>
            <p className="text-muted-foreground mt-1">Assign subjects to students based on their class level and department</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Students
            </CardTitle>
            <CardDescription>Select a student to view or assign subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-students"
                />
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-class-filter">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden sm:table-cell">Student ID</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.slice(0, 50).map((student: any) => (
                      <TableRow 
                        key={student.id}
                        className={selectedStudent?.id === student.id ? 'bg-muted' : ''}
                        onClick={() => setSelectedStudent(student)}
                        data-testid={`row-student-${student.id}`}
                      >
                        <TableCell className="font-medium">
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {student.studentId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getClassName(student.classId)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getDepartmentBadge(student.department)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudent(student);
                              }}
                              data-testid={`button-view-subjects-${student.id}`}
                            >
                              <BookOpen className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoAssign(student);
                              }}
                              disabled={!student.classId || autoAssignMutation.isPending}
                              data-testid={`button-auto-assign-${student.id}`}
                            >
                              {autoAssignMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Wand2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredStudents.length > 50 && (
              <p className="text-sm text-muted-foreground mt-2">
                Showing first 50 of {filteredStudents.length} students. Use search to find specific students.
              </p>
            )}
          </CardContent>
        </Card>

        {selectedStudent && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Assigned Subjects
                  </CardTitle>
                  <CardDescription>
                    {selectedStudent.firstName} {selectedStudent.lastName} - {getClassName(selectedStudent.classId)}
                    {selectedStudent.department && ` (${selectedStudent.department})`}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => handleAutoAssign(selectedStudent)}
                    disabled={!selectedStudent.classId || autoAssignMutation.isPending}
                    data-testid="button-auto-assign-selected"
                  >
                    {autoAssignMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-2" />
                    )}
                    Auto-Assign
                  </Button>
                  <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-manual-assign">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Subjects
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Subjects</DialogTitle>
                        <DialogDescription>
                          Select subjects to assign to {selectedStudent.firstName} {selectedStudent.lastName}
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-2 pr-4">
                          {getUnassignedSubjects().length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">
                              All available subjects are already assigned
                            </p>
                          ) : (
                            getUnassignedSubjects().map((subject: any) => (
                              <div
                                key={subject.id}
                                className="flex items-center space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
                                onClick={() => toggleSubjectSelection(subject.id)}
                                data-testid={`checkbox-subject-${subject.id}`}
                              >
                                <Checkbox
                                  checked={selectedSubjects.includes(subject.id)}
                                  onCheckedChange={() => toggleSubjectSelection(subject.id)}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{subject.name}</div>
                                  <div className="text-sm text-muted-foreground">{subject.code}</div>
                                </div>
                                <Badge className={CATEGORY_COLORS[subject.category] || CATEGORY_COLORS.general}>
                                  {subject.category || 'general'}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleManualAssign}
                          disabled={selectedSubjects.length === 0 || manualAssignMutation.isPending}
                          data-testid="button-confirm-assign"
                        >
                          {manualAssignMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Assign {selectedSubjects.length} Subject{selectedSubjects.length !== 1 ? 's' : ''}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentSubjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No subjects assigned yet</p>
                  <p className="text-sm">Use Auto-Assign or Add Subjects to assign subjects to this student</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {studentSubjects.map((assignment: any) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`subject-assignment-${assignment.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{assignment.subjectName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">{assignment.subjectCode}</span>
                          <Badge className={CATEGORY_COLORS[assignment.category] || CATEGORY_COLORS.general}>
                            {assignment.category || 'general'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                        disabled={removeAssignmentMutation.isPending}
                        data-testid={`button-remove-subject-${assignment.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

  );
}
