import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { 
  Save, 
  Loader2, 
  BookMarked, 
  GraduationCap, 
  Palette, 
  Briefcase, 
  Info, 
  School,
  Users,
  BookOpen,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
const JSS_CLASSES = ['JSS1', 'JSS2', 'JSS3', 'JSS 1', 'JSS 2', 'JSS 3'];
const SSS_CLASSES = ['SS1', 'SS2', 'SS3', 'SS 1', 'SS 2', 'SS 3', 'SSS1', 'SSS2', 'SSS3', 'SSS 1', 'SSS 2', 'SSS 3'];
const DEPARTMENTS = ['science', 'art', 'commercial'] as const;

const CATEGORY_CONFIG = {
  general: { label: 'General', icon: BookMarked, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', description: 'Core subjects for all students' },
  science: { label: 'Science', icon: GraduationCap, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', description: 'Science department subjects' },
  art: { label: 'Art', icon: Palette, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', description: 'Art department subjects' },
  commercial: { label: 'Commercial', icon: Briefcase, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', description: 'Commercial department subjects' },
};

const DEPARTMENT_CONFIG = {
  science: { label: 'Science Department', icon: GraduationCap, color: 'bg-blue-500', bgLight: 'bg-blue-50 dark:bg-blue-950' },
  art: { label: 'Art Department', icon: Palette, color: 'bg-purple-500', bgLight: 'bg-purple-50 dark:bg-purple-950' },
  commercial: { label: 'Commercial Department', icon: Briefcase, color: 'bg-amber-500', bgLight: 'bg-amber-50 dark:bg-amber-950' },
};

interface Subject {
  id: number;
  name: string;
  code: string;
  category: string;
  isActive: boolean;
}

interface ClassInfo {
  id: number;
  name: string;
  level: string;
}

interface SubjectAssignment {
  classId: number;
  subjectId: number;
  department: string | null;
  isCompulsory: boolean;
}

export default function UnifiedSubjectAssignment() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'jss' | 'sss'>('jss');
  const [pendingChanges, setPendingChanges] = useState<Map<string, SubjectAssignment>>(new Map());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<Subject[]>({
    queryKey: ['/api/subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/subjects');
      return await response.json();
    },
  });

  const { data: classes = [], isLoading: classesLoading } = useQuery<ClassInfo[]>({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  const { data: currentAssignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useQuery<SubjectAssignment[]>({
    queryKey: ['/api/unified-subject-assignments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/unified-subject-assignments');
      return await response.json();
    },
  });

  const handleRealtimeEvent = useCallback((event: any) => {
    if (event.eventType === 'subject-assignments-updated' || event.type === 'subject-assignments-updated') {
      console.log('[REALTIME] Subject assignments updated, refreshing data...');
      refetchAssignments();
    }
  }, [refetchAssignments]);

  const { isConnected } = useSocketIORealtime({
    queryKey: ['/api/unified-subject-assignments'],
    enabled: true,
    onEvent: handleRealtimeEvent,
  });

  const activeSubjects = useMemo(() => subjects.filter(s => s.isActive), [subjects]);
  
  const generalSubjects = useMemo(() => activeSubjects.filter(s => s.category === 'general'), [activeSubjects]);
  const scienceSubjects = useMemo(() => activeSubjects.filter(s => s.category === 'science'), [activeSubjects]);
  const artSubjects = useMemo(() => activeSubjects.filter(s => s.category === 'art'), [activeSubjects]);
  const commercialSubjects = useMemo(() => activeSubjects.filter(s => s.category === 'commercial'), [activeSubjects]);

  const jssClasses = useMemo(() => 
    classes.filter(c => JSS_CLASSES.some(jss => c.name.startsWith(jss))).sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  const sssClasses = useMemo(() => 
    classes.filter(c => SSS_CLASSES.some(sss => c.name.startsWith(sss))).sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  // Normalize department: treat undefined, empty string, and null as null
  const normalizeDept = (dept: string | null | undefined): string | null => {
    if (dept === undefined || dept === null || dept === '') return null;
    return dept;
  };

  const getAssignmentKey = (classId: number, subjectId: number, department: string | null | undefined) => 
    `${classId}-${subjectId}-${normalizeDept(department) || 'null'}`;

  // Check if an SSS class (used for special handling of NULL-department records)
  const isSSSClass = useCallback((classId: number): boolean => {
    return sssClasses.some(c => c.id === classId);
  }, [sssClasses]);

  // Check if assignment exists in database (handles null/undefined/empty department)
  const existsInDatabase = useCallback((classId: number, subjectId: number, department: string | null | undefined): boolean => {
    const normalizedDept = normalizeDept(department);
    
    // Check for exact match only - no legacy NULL-department fallback
    return currentAssignments.some(a => 
      a.classId === classId && 
      a.subjectId === subjectId && 
      normalizeDept(a.department) === normalizedDept
    );
  }, [currentAssignments]);

  // Check if a NULL-department record exists for this class/subject (for removal handling)
  const hasNullDepartmentRecord = useCallback((classId: number, subjectId: number): boolean => {
    return currentAssignments.some(a => 
      a.classId === classId && 
      a.subjectId === subjectId && 
      normalizeDept(a.department) === null
    );
  }, [currentAssignments]);

  const isSubjectAssigned = useCallback((classId: number, subjectId: number, department: string | null = null): boolean => {
    const key = getAssignmentKey(classId, subjectId, department);
    const nullKey = getAssignmentKey(classId, subjectId, null);
    
    // Check pending state first (these override DB state)
    if (pendingRemovals.has(key)) return false;
    if (pendingChanges.has(key)) return true;
    
    // For SSS with specific department, also check if NULL-department is being removed
    if (department !== null && isSSSClass(classId)) {
      if (pendingRemovals.has(nullKey)) return false;
    }
    
    // Check database state
    return existsInDatabase(classId, subjectId, department);
  }, [pendingRemovals, pendingChanges, existsInDatabase, isSSSClass]);

  const toggleSubjectAssignment = useCallback((classId: number, subjectId: number, department: string | null = null, checked?: boolean | 'indeterminate') => {
    // Skip indeterminate state
    if (checked === 'indeterminate') return;
    
    const key = getAssignmentKey(classId, subjectId, department);
    const nullKey = getAssignmentKey(classId, subjectId, null);
    
    // Determine if we should assign based on the checked value
    // If checked is explicitly true/false, use that; otherwise toggle
    const shouldAssign = typeof checked === 'boolean' ? checked : !isSubjectAssigned(classId, subjectId, department);
    
    if (shouldAssign) {
      // ASSIGN: For SSS, determine the proper handling based on NULL record state
      const hasNullRecord = department !== null && isSSSClass(classId) && hasNullDepartmentRecord(classId, subjectId);
      const nullWasBeingRemoved = pendingRemovals.has(nullKey);
      
      // Check if ALL departments will be assigned after this toggle
      // Only then should we cancel the NULL removal and clear replacements
      let allDepartmentsAssigned = false;
      if (hasNullRecord && nullWasBeingRemoved && department !== null) {
        const otherDepts = DEPARTMENTS.filter(d => d !== department);
        allDepartmentsAssigned = otherDepts.every(otherDept => 
          isSubjectAssigned(classId, subjectId, otherDept)
        );
      }
      
      // Remove from pending removals
      setPendingRemovals(prev => {
        const next = new Set(prev);
        next.delete(key);
        // Only cancel NULL removal if ALL departments will now be assigned
        if (hasNullRecord && nullWasBeingRemoved && allDepartmentsAssigned) {
          next.delete(nullKey);
        }
        return next;
      });
      
      // Update pending changes
      setPendingChanges(prev => {
        const next = new Map(prev);
        
        // If ALL departments will be assigned, clear all replacement entries
        if (hasNullRecord && nullWasBeingRemoved && allDepartmentsAssigned && department !== null) {
          const otherDepts = DEPARTMENTS.filter(d => d !== department);
          for (const otherDept of otherDepts) {
            const otherKey = getAssignmentKey(classId, subjectId, otherDept);
            // Only delete if it's a replacement (not in DB originally)
            const hasOtherExact = currentAssignments.some(a => 
              a.classId === classId && 
              a.subjectId === subjectId && 
              normalizeDept(a.department) === otherDept
            );
            if (!hasOtherExact) {
              next.delete(otherKey);
            }
          }
        }
        
        // Only add to pendingChanges if not already in DB (exact match)
        const hasExactMatch = currentAssignments.some(a => 
          a.classId === classId && 
          a.subjectId === subjectId && 
          normalizeDept(a.department) === normalizeDept(department)
        );
        
        if (!hasExactMatch) {
          // Add department-specific record if:
          // 1. No NULL record exists, OR
          // 2. NULL record is being removed and NOT all departments will be assigned
          if (!hasNullRecord) {
            next.set(key, {
              classId,
              subjectId,
              department: normalizeDept(department),
              isCompulsory: false
            });
          } else if (nullWasBeingRemoved && !allDepartmentsAssigned) {
            // NULL is being removed but not all depts assigned - add specific record
            next.set(key, {
              classId,
              subjectId,
              department: normalizeDept(department),
              isCompulsory: false
            });
          }
          // If allDepartmentsAssigned, we canceled the NULL removal so it covers this dept
        } else {
          // It exists in DB and we're assigning, just remove from pending changes if it was there
          next.delete(key);
        }
        
        return next;
      });
    } else {
      // UNASSIGN: First determine what needs to happen atomically
      const hasNullRecord = department !== null && isSSSClass(classId) && hasNullDepartmentRecord(classId, subjectId);
      const hasExactMatch = currentAssignments.some(a => 
        a.classId === classId && 
        a.subjectId === subjectId && 
        normalizeDept(a.department) === normalizeDept(department)
      );
      
      // Calculate replacements needed for other departments (only if NULL record exists and will be removed)
      const replacementsNeeded: Array<{key: string, dept: string}> = [];
      if (hasNullRecord) {
        const otherDepts = DEPARTMENTS.filter(d => d !== department);
        for (const otherDept of otherDepts) {
          const otherKey = getAssignmentKey(classId, subjectId, otherDept);
          // Only create replacement if:
          // 1. Not already in DB with exact match, AND
          // 2. Currently assigned (via isSubjectAssigned) for that department
          const hasOtherExact = currentAssignments.some(a => 
            a.classId === classId && 
            a.subjectId === subjectId && 
            normalizeDept(a.department) === otherDept
          );
          // Check if other dept is currently considered assigned
          const otherIsAssigned = isSubjectAssigned(classId, subjectId, otherDept);
          if (!hasOtherExact && otherIsAssigned) {
            replacementsNeeded.push({key: otherKey, dept: otherDept});
          }
        }
      }
      
      // Update pending changes
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(key);
        
        // Add replacement records for other departments
        for (const {key: otherKey, dept: otherDept} of replacementsNeeded) {
          next.set(otherKey, {
            classId,
            subjectId,
            department: otherDept,
            isCompulsory: false
          });
        }
        return next;
      });
      
      // Update pending removals
      setPendingRemovals(prev => {
        const next = new Set(prev);
        if (hasNullRecord) {
          next.add(nullKey);
        }
        if (hasExactMatch) {
          next.add(key);
        }
        return next;
      });
    }
  }, [isSubjectAssigned, currentAssignments, isSSSClass, hasNullDepartmentRecord, pendingRemovals]);

  const toggleAllJSSSubjects = useCallback((subjectId: number, checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    
    // Use functional updates to avoid stale state
    setPendingChanges(prevChanges => {
      const newChanges = new Map(prevChanges);
      jssClasses.forEach(cls => {
        const key = getAssignmentKey(cls.id, subjectId, null);
        const inDB = existsInDatabase(cls.id, subjectId, null);
        
        if (checked) {
          // Add to changes only if not in DB
          if (!inDB) {
            newChanges.set(key, {
              classId: cls.id,
              subjectId,
              department: null,
              isCompulsory: false
            });
          } else {
            newChanges.delete(key);
          }
        } else {
          // Remove from changes
          newChanges.delete(key);
        }
      });
      return newChanges;
    });
    
    setPendingRemovals(prevRemovals => {
      const newRemovals = new Set(prevRemovals);
      jssClasses.forEach(cls => {
        const key = getAssignmentKey(cls.id, subjectId, null);
        const inDB = existsInDatabase(cls.id, subjectId, null);
        
        if (checked) {
          // Remove from removals when assigning
          newRemovals.delete(key);
        } else {
          // Add to removals only if in DB
          if (inDB) {
            newRemovals.add(key);
          }
        }
      });
      return newRemovals;
    });
  }, [jssClasses, existsInDatabase]);

  const toggleAllSSSSubjectsForDept = useCallback((subjectId: number, department: string | null, checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    
    // Normalize department - treat 'null' string as actual null
    const normalizedDept = department === 'null' ? null : department;
    
    // Pre-compute all changes and removals atomically
    const newRemovals = new Set(pendingRemovals);
    const newChanges = new Map(pendingChanges);
    
    sssClasses.forEach(cls => {
      const key = getAssignmentKey(cls.id, subjectId, normalizedDept);
      const nullKey = getAssignmentKey(cls.id, subjectId, null);
      
      // Check for exact match in DB
      const hasExactMatch = currentAssignments.some(a => 
        a.classId === cls.id && 
        a.subjectId === subjectId && 
        normalizeDept(a.department) === normalizedDept
      );
      
      // Check for NULL-department record  
      const hasNullRecord = hasNullDepartmentRecord(cls.id, subjectId);
      
      if (checked) {
        // ASSIGN: Check if we're canceling a previous unassign that added replacements
        const nullWasBeingRemoved = newRemovals.has(nullKey);
        
        // Check if ALL departments will be assigned after this toggle
        let allDepartmentsAssigned = false;
        if (hasNullRecord && nullWasBeingRemoved && normalizedDept !== null) {
          const otherDepts = DEPARTMENTS.filter(d => d !== normalizedDept);
          allDepartmentsAssigned = otherDepts.every(otherDept => 
            isSubjectAssigned(cls.id, subjectId, otherDept)
          );
        }
        
        // Remove from removals when assigning
        newRemovals.delete(key);
        // Only cancel NULL removal if ALL departments will be assigned
        if (hasNullRecord && nullWasBeingRemoved && allDepartmentsAssigned) {
          newRemovals.delete(nullKey);
        }
        
        // If ALL departments will be assigned, clear all replacement entries
        if (hasNullRecord && nullWasBeingRemoved && allDepartmentsAssigned && normalizedDept !== null) {
          const otherDepts = DEPARTMENTS.filter(d => d !== normalizedDept);
          for (const otherDept of otherDepts) {
            const otherKey = getAssignmentKey(cls.id, subjectId, otherDept);
            // Only delete if it's a replacement (not in DB originally)
            const hasOtherExact = currentAssignments.some(a => 
              a.classId === cls.id && 
              a.subjectId === subjectId && 
              normalizeDept(a.department) === otherDept
            );
            if (!hasOtherExact) {
              newChanges.delete(otherKey);
            }
          }
        }
        
        // Add to changes only if not in DB and we should create a new record
        if (!hasExactMatch) {
          // Add department-specific record if:
          // 1. No NULL record exists, OR
          // 2. NULL record is being removed and NOT all departments will be assigned
          const nullStillBeingRemoved = newRemovals.has(nullKey);
          if (!hasNullRecord) {
            newChanges.set(key, {
              classId: cls.id,
              subjectId,
              department: normalizedDept,
              isCompulsory: false
            });
          } else if (nullStillBeingRemoved) {
            // NULL record is still being removed - need department-specific record
            newChanges.set(key, {
              classId: cls.id,
              subjectId,
              department: normalizedDept,
              isCompulsory: false
            });
          }
          // If !nullStillBeingRemoved (i.e., allDepartmentsAssigned), the NULL covers this dept
        } else {
          newChanges.delete(key);
        }
      } else {
        // UNASSIGN: Remove from changes
        newChanges.delete(key);
        
        // Add to removals
        if (hasExactMatch) {
          newRemovals.add(key);
        }
        if (normalizedDept !== null && hasNullRecord) {
          newRemovals.add(nullKey);
        }
        
        // Create replacement records for OTHER departments if NULL record exists
        // Only create for departments that are currently considered assigned
        if (normalizedDept !== null && hasNullRecord) {
          const otherDepts = DEPARTMENTS.filter(d => d !== normalizedDept);
          for (const otherDept of otherDepts) {
            const otherKey = getAssignmentKey(cls.id, subjectId, otherDept);
            // Only add if:
            // 1. Not already in DB with exact match, AND
            // 2. Currently assigned for that department
            const hasOtherExact = currentAssignments.some(a => 
              a.classId === cls.id && 
              a.subjectId === subjectId && 
              normalizeDept(a.department) === otherDept
            );
            // Check current assigned state (considers pending state too)
            const otherIsAssigned = isSubjectAssigned(cls.id, subjectId, otherDept);
            if (!hasOtherExact && otherIsAssigned) {
              newChanges.set(otherKey, {
                classId: cls.id,
                subjectId,
                department: otherDept,
                isCompulsory: false
              });
            }
          }
        }
      }
    });
    
    // Apply all changes atomically
    setPendingRemovals(newRemovals);
    setPendingChanges(newChanges);
  }, [sssClasses, currentAssignments, hasNullDepartmentRecord, pendingRemovals, pendingChanges, isSubjectAssigned]);

  const areAllJSSAssigned = useCallback((subjectId: number): boolean => {
    return jssClasses.every(cls => isSubjectAssigned(cls.id, subjectId, null));
  }, [jssClasses, isSubjectAssigned]);

  const areAllSSSAssignedForDept = useCallback((subjectId: number, department: string | null): boolean => {
    // Normalize department - treat 'null' string as actual null
    const normalizedDept = department === 'null' ? null : department;
    return sssClasses.every(cls => isSubjectAssigned(cls.id, subjectId, normalizedDept));
  }, [sssClasses, isSubjectAssigned]);

  const hasPendingChanges = pendingChanges.size > 0 || pendingRemovals.size > 0;

  const saveChanges = async () => {
    if (!hasPendingChanges) return;
    
    setIsSaving(true);
    try {
      const additions = Array.from(pendingChanges.values());
      const removals = Array.from(pendingRemovals).map(key => {
        const [classId, subjectId, department] = key.split('-');
        return {
          classId: parseInt(classId),
          subjectId: parseInt(subjectId),
          department: department === 'null' ? null : department
        };
      });

      const response = await apiRequest('PUT', '/api/unified-subject-assignments', {
        additions,
        removals
      });
      const result = response.ok ? await response.json() : null;

      const reportCardParts: string[] = [];
      if (result?.reportCardItemsAdded > 0) {
        reportCardParts.push(`${result.reportCardItemsAdded} subject row${result.reportCardItemsAdded !== 1 ? 's' : ''} added to report cards`);
      }
      if (result?.reportCardItemsRemoved > 0) {
        reportCardParts.push(`${result.reportCardItemsRemoved} empty row${result.reportCardItemsRemoved !== 1 ? 's' : ''} removed from report cards`);
      }

      const baseDesc = `${additions.length} subject${additions.length !== 1 ? 's' : ''} assigned, ${removals.length} unassigned.`;
      const reportCardDesc = reportCardParts.length > 0 ? ` Report cards updated: ${reportCardParts.join('; ')}.` : '';

      toast({
        title: 'Changes saved',
        description: baseDesc + reportCardDesc,
      });

      setPendingChanges(new Map());
      setPendingRemovals(new Set());
      
      await queryClient.invalidateQueries({ queryKey: ['/api/unified-subject-assignments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/class-subject-mappings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/subjects'] });
      
      await refetchAssignments();
    } catch (error: any) {
      toast({
        title: 'Error saving changes',
        description: error.message || 'Failed to save subject assignments',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    setPendingRemovals(new Set());
    toast({
      title: 'Changes discarded',
      description: 'All pending changes have been reverted.',
    });
  };

  const isLoading = subjectsLoading || classesLoading || assignmentsLoading;

  const getJSSAssignmentCount = () => {
    let count = 0;
    jssClasses.forEach(cls => {
      activeSubjects.forEach(subj => {
        if (isSubjectAssigned(cls.id, subj.id, null)) count++;
      });
    });
    return count;
  };

  const getSSSAssignmentCount = (department: string) => {
    let count = 0;
    sssClasses.forEach(cls => {
      activeSubjects.forEach(subj => {
        if (isSubjectAssigned(cls.id, subj.id, department)) count++;
      });
    });
    return count;
  };

  const renderSubjectCheckbox = (subject: Subject, classId: number, department: string | null = null) => {
    const isAssigned = isSubjectAssigned(classId, subject.id, department);
    const key = getAssignmentKey(classId, subject.id, department);
    const isPending = pendingChanges.has(key) || pendingRemovals.has(key);
    const config = CATEGORY_CONFIG[subject.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.general;

    return (
      <div 
        key={`${classId}-${subject.id}-${department}`}
        className={`flex items-center gap-2 p-2 rounded-md transition-colors ${isPending ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isSaving ? 'opacity-70' : ''}`}
      >
        <Checkbox
          id={key}
          checked={isAssigned}
          disabled={isSaving}
          onCheckedChange={(checked) => toggleSubjectAssignment(classId, subject.id, department, checked)}
          data-testid={`checkbox-subject-${subject.id}-class-${classId}${department ? `-dept-${department}` : ''}`}
        />
        <label htmlFor={key} className={`flex items-center gap-2 text-sm flex-1 ${isSaving ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <span>{subject.name}</span>
          <Badge className={`text-xs ${config.color}`}>{subject.code}</Badge>
          {isPending && <Badge variant="outline" className="text-xs text-yellow-600">Pending</Badge>}
        </label>
      </div>
    );
  };

  const renderSubjectCategory = (
    title: string,
    subjects: Subject[],
    classId: number,
    department: string | null = null,
    icon: React.ReactNode
  ) => {
    if (subjects.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          <span>{title}</span>
          <Badge variant="secondary" className="text-xs">{subjects.length} subjects</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {subjects.map(subject => renderSubjectCheckbox(subject, classId, department))}
        </div>
      </div>
    );
  };

  return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <School className="h-6 w-6" />
              Class-Level & Department Subject Assignment
            </h1>
            <p className="text-muted-foreground mt-1">
              Centralized configuration for all subject visibility across the school portal
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="status-connection">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="hidden sm:inline">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-yellow-500" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>
            {hasPendingChanges && (
              <>
                <Button 
                  variant="outline" 
                  onClick={discardChanges}
                  disabled={isSaving}
                  data-testid="button-discard-changes"
                >
                  Discard
                </Button>
                <Button 
                  onClick={saveChanges}
                  disabled={isSaving}
                  data-testid="button-save-changes"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes ({pendingChanges.size + pendingRemovals.size})
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchAssignments()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Single Source of Truth</AlertTitle>
          <AlertDescription>
            This configuration controls subject visibility across the entire system: report cards, exam creation, 
            student portals, and teacher assignments. Changes apply instantly to all areas.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'jss' | 'sss')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="jss" className="flex items-center gap-2" data-testid="tab-jss">
                <Users className="w-4 h-4" />
                Junior Secondary (JSS1-JSS3)
                <Badge variant="secondary" className="text-xs">{getJSSAssignmentCount()}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sss" className="flex items-center gap-2" data-testid="tab-sss">
                <GraduationCap className="w-4 h-4" />
                Senior Secondary (SS1-SS3)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jss" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    JSS Subject Assignments
                  </CardTitle>
                  <CardDescription>
                    Configure which subjects are visible to Junior Secondary School students (JSS1, JSS2, JSS3).
                    All JSS students see the same subjects regardless of department.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-3">Quick Actions - Assign to All JSS Classes</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <BookMarked className="w-4 h-4" /> General Subjects
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {generalSubjects.map(subject => (
                            <div key={subject.id} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                              <Checkbox
                                id={`jss-all-${subject.id}`}
                                checked={areAllJSSAssigned(subject.id)}
                                onCheckedChange={(checked) => toggleAllJSSSubjects(subject.id, checked)}
                                data-testid={`checkbox-jss-all-${subject.id}`}
                              />
                              <label htmlFor={`jss-all-${subject.id}`} className="text-sm cursor-pointer">
                                {subject.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Accordion type="multiple" defaultValue={jssClasses.map(c => c.id.toString())}>
                    {jssClasses.map(cls => (
                      <AccordionItem key={cls.id} value={cls.id.toString()}>
                        <AccordionTrigger className="hover:no-underline" data-testid={`accordion-class-${cls.id}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{cls.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {activeSubjects.filter(s => isSubjectAssigned(cls.id, s.id, null)).length} subjects
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          <ScrollArea className="h-auto max-h-[400px]">
                            <div className="space-y-6 pr-4">
                              {renderSubjectCategory('General Subjects', generalSubjects, cls.id, null, <BookMarked className="w-4 h-4" />)}
                              {renderSubjectCategory('Science Subjects', scienceSubjects, cls.id, null, <GraduationCap className="w-4 h-4" />)}
                              {renderSubjectCategory('Art Subjects', artSubjects, cls.id, null, <Palette className="w-4 h-4" />)}
                              {renderSubjectCategory('Commercial Subjects', commercialSubjects, cls.id, null, <Briefcase className="w-4 h-4" />)}
                            </div>
                          </ScrollArea>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sss" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    SSS Subject Assignments by Department
                  </CardTitle>
                  <CardDescription>
                    Configure subjects for each department. SSS students see subjects based on their assigned department 
                    (Science, Art, or Commercial). General subjects can be shared across departments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="science">
                    <TabsList className="grid w-full grid-cols-3">
                      {DEPARTMENTS.map(dept => {
                        const config = DEPARTMENT_CONFIG[dept];
                        const Icon = config.icon;
                        return (
                          <TabsTrigger key={dept} value={dept} className="flex items-center gap-2" data-testid={`tab-dept-${dept}`}>
                            <Icon className="w-4 h-4" />
                            {config.label}
                            <Badge variant="secondary" className="text-xs">{getSSSAssignmentCount(dept)}</Badge>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {DEPARTMENTS.map(dept => {
                      const config = DEPARTMENT_CONFIG[dept];
                      const Icon = config.icon;
                      const deptSubjects = activeSubjects.filter(s => s.category === dept);

                      return (
                        <TabsContent key={dept} value={dept} className="space-y-4">
                          <div className={`p-4 rounded-lg ${config.bgLight}`}>
                            <h3 className="font-medium mb-3 flex items-center gap-2">
                              <Icon className="w-5 h-5" />
                              Quick Actions - Assign to All SSS Classes ({config.label})
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">General Subjects</h4>
                                <div className="flex flex-wrap gap-2">
                                  {generalSubjects.map(subject => (
                                    <div key={subject.id} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                                      <Checkbox
                                        id={`sss-${dept}-all-general-${subject.id}`}
                                        checked={areAllSSSAssignedForDept(subject.id, dept)}
                                        onCheckedChange={(checked) => toggleAllSSSSubjectsForDept(subject.id, dept, checked)}
                                        data-testid={`checkbox-sss-${dept}-all-${subject.id}`}
                                      />
                                      <label htmlFor={`sss-${dept}-all-general-${subject.id}`} className="text-sm cursor-pointer">
                                        {subject.name}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">{config.label} Specific Subjects</h4>
                                <div className="flex flex-wrap gap-2">
                                  {deptSubjects.map(subject => (
                                    <div key={subject.id} className="flex items-center gap-2 p-2 bg-background rounded-md border">
                                      <Checkbox
                                        id={`sss-${dept}-all-${subject.id}`}
                                        checked={areAllSSSAssignedForDept(subject.id, dept)}
                                        onCheckedChange={(checked) => toggleAllSSSSubjectsForDept(subject.id, dept, checked)}
                                        data-testid={`checkbox-sss-${dept}-all-specific-${subject.id}`}
                                      />
                                      <label htmlFor={`sss-${dept}-all-${subject.id}`} className="text-sm cursor-pointer">
                                        {subject.name}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Accordion type="multiple" defaultValue={sssClasses.map(c => c.id.toString())}>
                            {sssClasses.map(cls => (
                              <AccordionItem key={cls.id} value={cls.id.toString()}>
                                <AccordionTrigger className="hover:no-underline" data-testid={`accordion-class-${cls.id}-dept-${dept}`}>
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{cls.name}</span>
                                    <Badge className={config.color}>{config.label}</Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {activeSubjects.filter(s => isSubjectAssigned(cls.id, s.id, dept)).length} subjects
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4">
                                  <ScrollArea className="h-auto max-h-[400px]">
                                    <div className="space-y-6 pr-4">
                                      {renderSubjectCategory('General Subjects', generalSubjects, cls.id, dept, <BookMarked className="w-4 h-4" />)}
                                      {renderSubjectCategory(`${config.label} Subjects`, deptSubjects, cls.id, dept, <Icon className="w-4 h-4" />)}
                                    </div>
                                  </ScrollArea>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {hasPendingChanges && (
          <div className="fixed bottom-4 right-4 z-50">
            <Card className="shadow-lg border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Info className="w-5 h-5" />
                  <span className="font-medium">
                    {pendingChanges.size + pendingRemovals.size} unsaved changes
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={discardChanges} disabled={isSaving}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={saveChanges} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  );
}
