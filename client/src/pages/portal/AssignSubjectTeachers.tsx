import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueries } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, BookOpen, Plus, Trash2, Loader2, GraduationCap, User, Info } from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

export default function AssignSubjectTeachers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);

  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['/api/teachers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teachers');
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

  // Fetch class-subject mappings for all selected classes
  const classMappingsQueries = useQueries({
    queries: selectedClasses.map(classId => ({
      queryKey: ['/api/class-subject-mappings', classId],
      queryFn: async () => {
        const response = await apiRequest('GET', `/api/class-subject-mappings/${classId}`);
        return await response.json();
      },
    })),
  });

  // Compute available subjects based on selected classes' mappings
  const { availableSubjects, hasNoMappedSubjects } = useMemo(() => {
    if (selectedClasses.length === 0) {
      // No classes selected - show all subjects
      return { availableSubjects: subjects, hasNoMappedSubjects: false };
    }

    // Collect all mappings from selected classes
    const allMappings: any[] = [];
    classMappingsQueries.forEach(query => {
      if (query.data && Array.isArray(query.data)) {
        allMappings.push(...query.data);
      }
    });

    if (allMappings.length === 0) {
      // No mappings found for selected classes
      return { availableSubjects: [], hasNoMappedSubjects: true };
    }

    // Get unique subject IDs that are mapped to ALL selected classes (intersection)
    // For each class, get the set of mapped subject IDs
    const subjectIdsByClass: Map<number, Set<number>> = new Map();
    selectedClasses.forEach(classId => {
      subjectIdsByClass.set(classId, new Set());
    });

    allMappings.forEach((mapping: any) => {
      const classSet = subjectIdsByClass.get(mapping.classId);
      if (classSet) {
        classSet.add(mapping.subjectId);
      }
    });

    // Find subjects that are common to all selected classes
    const classSets = Array.from(subjectIdsByClass.values());
    let commonSubjectIds: Set<number>;
    
    if (classSets.length === 0) {
      commonSubjectIds = new Set();
    } else {
      // Start with the first class's subjects
      commonSubjectIds = new Set(classSets[0]);
      // Intersect with each subsequent class's subjects
      for (let i = 1; i < classSets.length; i++) {
        commonSubjectIds = new Set(
          [...commonSubjectIds].filter(id => classSets[i].has(id))
        );
      }
    }

    // Filter subjects list to only include those in common
    const filtered = subjects.filter((s: any) => commonSubjectIds.has(s.id));
    return { 
      availableSubjects: filtered, 
      hasNoMappedSubjects: filtered.length === 0 && selectedClasses.length > 0 
    };
  }, [selectedClasses, classMappingsQueries, subjects]);

  // Check if mappings are still loading
  const mappingsLoading = classMappingsQueries.some(q => q.isLoading);

  // Clear selected subjects that are no longer available when class selection changes
  useEffect(() => {
    if (selectedClasses.length === 0) {
      // No classes selected - don't clear (all subjects available)
      return;
    }
    
    // If mappings are still loading, wait
    if (mappingsLoading) {
      return;
    }
    
    if (availableSubjects.length === 0) {
      // No subjects available for selected classes - clear all
      if (selectedSubjects.length > 0) {
        setSelectedSubjects([]);
      }
    } else {
      // Filter to keep only valid subjects
      const availableIds = new Set(availableSubjects.map((s: any) => s.id));
      const validSubjects = selectedSubjects.filter(id => availableIds.has(id));
      if (validSubjects.length !== selectedSubjects.length) {
        setSelectedSubjects(validSubjects);
      }
    }
  }, [availableSubjects, selectedClasses.length, mappingsLoading]);

  const { data: assignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['/api/teacher-assignments', selectedTeacher?.id],
    queryFn: async () => {
      if (!selectedTeacher?.id) return [];
      const response = await apiRequest('GET', `/api/teacher-assignments/${selectedTeacher.id}`);
      return await response.json();
    },
    enabled: !!selectedTeacher?.id,
  });

  useSocketIORealtime({
    table: 'teacher_class_assignments',
    queryKey: ['/api/teacher-assignments', selectedTeacher?.id],
    enabled: !!selectedTeacher?.id,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async ({ teacherId, classId, subjectId }: { teacherId: string; classId: number; subjectId: number }) => {
      const response = await apiRequest('POST', '/api/teacher-assignments', {
        teacherId,
        classId,
        subjectId,
      });
      return await response.json();
    },
    onSuccess: () => {
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await apiRequest('DELETE', `/api/teacher-assignments/${assignmentId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Assignment Removed',
        description: 'Teacher assignment has been removed',
      });
      refetchAssignments();
      queryClient.invalidateQueries({ queryKey: ['/api/teacher-assignments'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Removal Failed',
        description: error.message || 'Failed to remove assignment',
        variant: 'destructive',
      });
    },
  });

  const handleBulkAssign = async () => {
    if (!selectedTeacher || selectedClasses.length === 0 || selectedSubjects.length === 0) return;
    
    const promises: Promise<any>[] = [];
    
    for (const classId of selectedClasses) {
      for (const subjectId of selectedSubjects) {
        const existingAssignment = assignments.find(
          (a: any) => a.classId === classId && a.subjectId === subjectId
        );
        if (!existingAssignment) {
          promises.push(
            createAssignmentMutation.mutateAsync({
              teacherId: selectedTeacher.id,
              classId,
              subjectId,
            })
          );
        }
      }
    }
    
    try {
      await Promise.all(promises);
      toast({
        title: 'Assignments Created',
        description: `Successfully assigned ${selectedClasses.length} class(es) and ${selectedSubjects.length} subject(s)`,
      });
      setIsAssignDialogOpen(false);
      setSelectedClasses([]);
      setSelectedSubjects([]);
    } catch (error: any) {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to create assignments',
        variant: 'destructive',
      });
    }
  };

  const filteredTeachers = teachers.filter((teacher: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      teacher.firstName?.toLowerCase().includes(searchLower) ||
      teacher.lastName?.toLowerCase().includes(searchLower) ||
      teacher.email?.toLowerCase().includes(searchLower) ||
      teacher.staffId?.toLowerCase().includes(searchLower)
    );
  });

  const getClassName = (classId: number) => {
    const classInfo = classes.find((c: any) => c.id === classId);
    return classInfo?.name || 'Unknown';
  };

  const getSubjectName = (subjectId: number) => {
    const subject = subjects.find((s: any) => s.id === subjectId);
    return subject?.name || 'Unknown';
  };

  const groupedAssignments = assignments.reduce((acc: any, assignment: any) => {
    const className = getClassName(assignment.classId);
    if (!acc[className]) acc[className] = [];
    acc[className].push(assignment);
    return acc;
  }, {});

  return (
      <div className="space-y-6" data-testid="assign-subject-teachers">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Assign Subject Teachers</h1>
            <p className="text-muted-foreground mt-1">Assign teachers to subjects and classes they will teach</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Select Teacher
              </CardTitle>
              <CardDescription>Choose a teacher to manage their subject assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search teachers by name, email, or staff ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-teachers"
                />
              </div>

              {teachersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {filteredTeachers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No teachers found
                      </div>
                    ) : (
                      filteredTeachers.map((teacher: any) => (
                        <div
                          key={teacher.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors
                            ${selectedTeacher?.id === teacher.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'}
                          `}
                          onClick={() => setSelectedTeacher(teacher)}
                          data-testid={`teacher-card-${teacher.id}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{teacher.firstName} {teacher.lastName}</div>
                            <div className="text-sm text-muted-foreground truncate">{teacher.email}</div>
                          </div>
                          {teacher.staffId && (
                            <Badge variant="outline">{teacher.staffId}</Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Teaching Assignments
                  </CardTitle>
                  <CardDescription>
                    {selectedTeacher 
                      ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}'s class and subject assignments`
                      : 'Select a teacher to view their assignments'}
                  </CardDescription>
                </div>
                {selectedTeacher && (
                  <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-assignments">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Assignments
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Assign Classes & Subjects</DialogTitle>
                        <DialogDescription>
                          Select classes and subjects for {selectedTeacher.firstName} {selectedTeacher.lastName}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Select Classes</h4>
                          <ScrollArea className="h-[150px] border rounded-md p-2">
                            <div className="space-y-2">
                              {classes.map((c: any) => (
                                <div
                                  key={c.id}
                                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                  onClick={() => {
                                    setSelectedClasses(prev =>
                                      prev.includes(c.id)
                                        ? prev.filter(id => id !== c.id)
                                        : [...prev, c.id]
                                    );
                                  }}
                                  data-testid={`row-class-${c.id}`}
                                >
                                  <Checkbox
                                    checked={selectedClasses.includes(c.id)}
                                    onCheckedChange={() => {
                                      setSelectedClasses(prev =>
                                        prev.includes(c.id)
                                          ? prev.filter(id => id !== c.id)
                                          : [...prev, c.id]
                                      );
                                    }}
                                    data-testid={`checkbox-class-${c.id}`}
                                  />
                                  <span>{c.name}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedClasses.length} class(es) selected
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Select Subjects</h4>
                          {selectedClasses.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Select one or more classes first to see available subjects
                            </p>
                          ) : mappingsLoading ? (
                            <div className="h-[150px] flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : hasNoMappedSubjects ? (
                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                No subjects are configured for the selected class(es). 
                                Please configure subjects for this class in the Class Level Subject Assignment page first.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <ScrollArea className="h-[150px] border rounded-md p-2">
                              <div className="space-y-2">
                                {availableSubjects.map((s: any) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                    onClick={() => {
                                      setSelectedSubjects(prev =>
                                        prev.includes(s.id)
                                          ? prev.filter(id => id !== s.id)
                                          : [...prev, s.id]
                                      );
                                    }}
                                    data-testid={`row-subject-${s.id}`}
                                  >
                                    <Checkbox
                                      checked={selectedSubjects.includes(s.id)}
                                      onCheckedChange={() => {
                                        setSelectedSubjects(prev =>
                                          prev.includes(s.id)
                                            ? prev.filter(id => id !== s.id)
                                            : [...prev, s.id]
                                        );
                                      }}
                                      data-testid={`checkbox-subject-${s.id}`}
                                    />
                                    <span>{s.name}</span>
                                    <Badge variant="outline" className="ml-auto">{s.code}</Badge>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedSubjects.length} subject(s) selected
                            {selectedClasses.length > 0 && availableSubjects.length > 0 && (
                              <span className="ml-2">
                                (showing {availableSubjects.length} mapped subject{availableSubjects.length !== 1 ? 's' : ''})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} data-testid="button-cancel-assign">
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBulkAssign}
                          disabled={selectedClasses.length === 0 || selectedSubjects.length === 0 || hasNoMappedSubjects || mappingsLoading || createAssignmentMutation.isPending}
                          data-testid="button-confirm-assign"
                        >
                          {createAssignmentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Assign ({selectedClasses.length * selectedSubjects.length} combinations)
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedTeacher ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a teacher to view their assignments</p>
                </div>
              ) : assignmentsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No assignments yet</p>
                  <p className="text-sm">Click "Add Assignments" to assign classes and subjects</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    {Object.entries(groupedAssignments).map(([className, classAssignments]: [string, any]) => (
                      <div key={className} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          <h4 className="font-medium">{className}</h4>
                          <Badge variant="secondary">{classAssignments.length} subject(s)</Badge>
                        </div>
                        <div className="grid gap-2">
                          {classAssignments.map((assignment: any) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                              data-testid={`assignment-${assignment.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                                <span>{getSubjectName(assignment.subjectId)}</span>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                                disabled={deleteAssignmentMutation.isPending}
                                data-testid={`button-remove-${assignment.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
