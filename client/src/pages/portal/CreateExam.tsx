import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useClassSubjects } from '@/hooks/useClassSubjects';
import type { Class, Subject } from '@shared/schema';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  FileText,
  Calendar,
  Settings,
  Lock,
  CheckCircle,
  Clock,
  BookOpen,
  GraduationCap,
  AlertCircle,
  X,
  Check,
  Info,
  Shield,
  Target,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const createExamSchema = z.object({
  name: z.string().min(3, 'Exam name must be at least 3 characters'),
  classId: z.number({ required_error: 'Please select a class' }).min(1, 'Please select a class'),
  subjectId: z.number({ required_error: 'Please select a subject' }).min(1, 'Please select a subject'),
  termId: z.number({ required_error: 'Please select a term' }).min(1, 'Please select a term'),
  examType: z.enum(['test', 'exam'], { required_error: 'Please select exam type' }),
  totalMarks: z.number().min(1, 'Total marks must be at least 1').max(1000, 'Maximum 1000 marks'),
  passingScore: z.number().min(0).max(100).optional(),
  teacherInChargeId: z.string().uuid().optional(),
  date: z.string().min(1, 'Exam date is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeLimit: z.number().min(1, 'Duration must be at least 1 minute').optional(),
  timerMode: z.enum(['individual', 'global']).default('individual'),
  instructions: z.string().optional(),
  isPublished: z.boolean().default(false),
  shuffleQuestions: z.boolean().default(false),
  autoGradingEnabled: z.boolean().default(true),
  instantFeedback: z.boolean().default(false),
  showCorrectAnswers: z.boolean().default(false),
  gradingScale: z.string().optional(),
  showInstructionsScreen: z.boolean().default(true),
});

type CreateExamFormData = z.infer<typeof createExamSchema>;

const steps = [
  { id: 1, title: 'Exam Details', icon: FileText },
  { id: 2, title: 'Academic & Timing', icon: Calendar },
  { id: 3, title: 'Options & Grading', icon: Settings },
  { id: 4, title: 'Review & Create', icon: CheckCircle },
];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}
function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted ? 'rgb(34, 197, 94)' : isCurrent ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)',
                  }}
                  transition={{ duration: 0.3 }}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary/85 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}
                    transition-all duration-300 shadow-lg
                  `}
                  data-testid={`step-indicator-${step.id}`}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <StepIcon className="w-6 h-6" />
                  )}
                </motion.div>
                <div className="mt-2 text-center">
                  <p className={`text-xs font-medium ${isCurrent ? 'text-primary dark:text-primary/70' : 'text-gray-500 dark:text-gray-400'}`}>
                    Step {step.id}
                  </p>
                  <p className={`text-xs ${isCurrent ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-400'} hidden sm:block`}>
                    {step.title}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 relative">
                  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <motion.div
                    initial={false}
                    animate={{
                      width: isCompleted ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-green-500 rounded-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function CreateExam() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  if (!user) {
    return <div>Loading...</div>;
  }
  const userRole = 'teacher' as 'admin' | 'teacher' | 'student' | 'parent';
  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;

  if (user.roleId !== ROLE_IDS.TEACHER) {
    navigate('/portal/teacher/dashboard');
    return null;
  }
  const form = useForm<CreateExamFormData>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      examType: 'exam',
      timerMode: 'individual',
      totalMarks: 100,
      passingScore: 60,
      timeLimit: 60,
      isPublished: false,
      shuffleQuestions: false,
      autoGradingEnabled: true,
      instantFeedback: false,
      showCorrectAnswers: true,
      gradingScale: 'standard',
      showInstructionsScreen: true,
    },
  });

  // Watch classId and subjectId to enable dynamic teacher filtering
  const selectedClassId = form.watch('classId');
  const selectedSubjectId = form.watch('subjectId');

  // Fetch teacher's assigned classes and subjects (teachers only see their assignments)
  const { data: myAssignments, isLoading: assignmentsLoading } = useQuery<{
    isAdmin: boolean;
    classes: Class[];
    subjects: Subject[];
    assignments: Array<{ classId: number; subjectId: number; department?: string; termId?: number; isActive: boolean }>;
  }>({
    queryKey: ['/api/my-assignments'],
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Use teacher's assigned classes only (not all classes)
  const classes = myAssignments?.classes || [];
  const classesLoading = assignmentsLoading;

  // Filter subjects to only those assigned to the selected class (reusable hook)
  const {
    subjects: availableSubjects,
    isLoading: subjectsLoading,
  } = useClassSubjects(selectedClassId);

  // Fetch academic calendar (provides currentTerm + allTerms)
  const { currentTerm, allTerms: terms, isLoading: termsLoading } = useAcademicCalendar();

  // Auto-select current term when it loads
  useEffect(() => {
    if (currentTerm && !form.getValues('termId')) {
      form.setValue('termId', currentTerm.id);
    }
  }, [currentTerm, form]);

  // Clear subject and teacher selection when class changes to avoid stale selections
  useEffect(() => {
    if (selectedClassId) {
      form.setValue('subjectId', undefined as any);
      form.setValue('teacherInChargeId', undefined);
    }
  }, [selectedClassId, form]);

  // Fetch teachers filtered by class and subject (dynamic filtering)
  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['/api/teachers-for-subject', selectedClassId, selectedSubjectId],
    queryFn: async () => {
      if (!selectedClassId || !selectedSubjectId) {
        return [];
      }
      const response = await apiRequest(
        'GET',
        `/api/teachers-for-subject?classId=${selectedClassId}&subjectId=${selectedSubjectId}`
      );
      return await response.json();
    },
    enabled: !!selectedClassId && !!selectedSubjectId,
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: CreateExamFormData) => {
      const response = await apiRequest('POST', '/api/exams', {
        ...data,
        createdBy: user.id,
      });
      if (!response.ok) throw new Error('Failed to create exam');
      return response.json();
    },
    onMutate: () => {
      toast({
        title: 'Creating Exam...',
        description: 'Setting up your new exam',
      });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Exam Created Successfully!',
        description: `"${data.name}" has been created. Proceed to upload questions.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
      navigate(`/portal/teacher/exams/${data.id}/questions`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Exam',
        description: error.message || 'Failed to create exam. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof CreateExamFormData)[] = [];
    
    switch (step) {
      case 1:
        fieldsToValidate = ['name', 'examType', 'classId', 'subjectId', 'date'];
        break;
      case 2:
        fieldsToValidate = ['termId', 'totalMarks', 'timeLimit', 'timerMode'];
        break;
      case 3:
        fieldsToValidate = ['isPublished', 'shuffleQuestions', 'autoGradingEnabled', 'showCorrectAnswers', 'instantFeedback', 'passingScore', 'gradingScale'];
        break;
      default:
        return true;
    }
    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = (data: CreateExamFormData) => {
    // Validate class/subject assignment before submission
    if (!myAssignments?.isAdmin) {
      const isValidAssignment = myAssignments?.assignments?.some(
        a => a.classId === data.classId && a.subjectId === data.subjectId && a.isActive
      );
      
      if (!isValidAssignment) {
        toast({
          title: 'Invalid Assignment',
          description: 'You are not assigned to teach this subject for the selected class. Please refresh and try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    createExamMutation.mutate(data);
  };

  const onSaveDraft = () => {
    const data = form.getValues();
    
    // Validate class/subject assignment before saving draft
    if (!myAssignments?.isAdmin && data.classId && data.subjectId) {
      const isValidAssignment = myAssignments?.assignments?.some(
        a => a.classId === data.classId && a.subjectId === data.subjectId && a.isActive
      );
      
      if (!isValidAssignment) {
        toast({
          title: 'Invalid Assignment',
          description: 'You are not assigned to teach this subject for the selected class.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    createExamMutation.mutate({ ...data, isPublished: false });
  };

  const formValues = form.watch();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-2xl rounded-2xl border-border">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-indigo-50 dark:from-primary/5 dark:to-indigo-900/10 rounded-t-2xl">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/85 text-white">
                    <FileText className="w-6 h-6" />
                  </div>
                  Exam Details
                </CardTitle>
                <CardDescription>Essential information about the exam</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Show notice if teacher has no assignments */}
                {!assignmentsLoading && myAssignments && !myAssignments.isAdmin && classes.length === 0 && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800 dark:text-orange-200">No Class Assignments Found</p>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          You don't have any class or subject assignments yet. Please contact your administrator to be assigned to classes and subjects before creating exams.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="name">
                      Exam Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g., Mid-Term Mathematics Test"
                      {...form.register('name')}
                      data-testid="input-exam-name"
                      className="h-12 text-base"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">
                      Exam Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      {...form.register('date')}
                      data-testid="input-exam-date"
                      className="h-12"
                    />
                    {form.formState.errors.date && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.date.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classId">
                      Class / Grade <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      name="classId"
                      control={form.control}
                      render={({ field }) => (
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(value) => field.onChange(Number(value))}
                          disabled={classesLoading}
                        >
                          <SelectTrigger data-testid="select-class" className="h-12">
                            <SelectValue placeholder={classesLoading ? "Loading classes..." : "Select class"} />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((cls: any) => (
                              <SelectItem key={cls.id} value={cls.id.toString()}>
                                {cls.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.classId && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.classId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subjectId">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      name="subjectId"
                      control={form.control}
                      render={({ field }) => (
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(value) => field.onChange(Number(value))}
                          disabled={subjectsLoading || !selectedClassId}
                        >
                          <SelectTrigger data-testid="select-subject" className="h-12">
                            <SelectValue placeholder={
                              subjectsLoading ? "Loading subjects..." : 
                              !selectedClassId ? "Select a class first" :
                              availableSubjects.length === 0 ? (
                                myAssignments?.isAdmin 
                                  ? "No subjects configured for this class" 
                                  : "No subjects assigned for this class"
                              ) :
                              "Select subject"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubjects.map((subject: any) => (
                              <SelectItem key={subject.id} value={subject.id.toString()}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.subjectId && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.subjectId.message}
                      </p>
                    )}
                    {myAssignments?.isAdmin && selectedClassId && !subjectsLoading && availableSubjects.length === 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Configure subjects for this class in Subject Manager &gt; Class Level Assignment
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="examType">
                      Assessment Type <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      name="examType"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-exam-type" className="h-12">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Test (40% weight)</SelectItem>
                            <SelectItem value="exam">Exam (60% weight)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.examType && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.examType.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Final grade = Test (40%) + Exam (60%) = Total (100%)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teacherInChargeId">
                      Teacher In-Charge 
                      {selectedSubjectId && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (filtered by selected subject)
                        </span>
                      )}
                    </Label>
                    <Controller
                      name="teacherInChargeId"
                      control={form.control}
                      render={({ field }) => (
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
                          disabled={!selectedClassId || !selectedSubjectId || teachersLoading}
                        >
                          <SelectTrigger data-testid="select-teacher-in-charge" className="h-12">
                            <SelectValue 
                              placeholder={
                                !selectedClassId || !selectedSubjectId 
                                  ? "Select class and subject first" 
                                  : teachersLoading 
                                    ? "Loading teachers..." 
                                    : teachers.length === 0
                                      ? "No teacher assigned to this subject"
                                      : "Select teacher (optional)"
                              } 
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.length === 0 ? (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                <p className="font-medium">No teachers assigned</p>
                                <p className="text-xs mt-1">No teacher is currently assigned to this subject in this class.</p>
                              </div>
                            ) : (
                              teachers.map((teacher: any) => (
                                <SelectItem key={teacher.id} value={teacher.id}>
                                  {teacher.firstName} {teacher.lastName}
                                  {teacher.username && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({teacher.username})
                                    </span>
                                  )}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {selectedClassId && selectedSubjectId && teachers.length === 0 && !teachersLoading && (
                      <p className="text-sm text-amber-600 dark:text-amber-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        No teacher is assigned to teach this subject in this class. You may proceed without selecting a teacher.
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea
                      id="instructions"
                      placeholder="Displayed to students before exam starts (e.g., allowed materials, rules)"
                      rows={4}
                      {...form.register('instructions')}
                      data-testid="input-instructions"
                      className="text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide clear guidelines about what students should know before taking the exam
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-2xl rounded-2xl border-border">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-t-2xl">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500 text-white">
                    <Calendar className="w-6 h-6" />
                  </div>
                  Academic & Timing Settings
                </CardTitle>
                <CardDescription>Configure duration, term, and timer mode</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="termId">
                      Academic Term <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      name="termId"
                      control={form.control}
                      render={({ field }) => (
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(value) => field.onChange(Number(value))}
                          disabled={termsLoading}
                        >
                          <SelectTrigger data-testid="select-term" className="h-12">
                            <SelectValue placeholder={termsLoading ? "Loading terms..." : "Select term"} />
                          </SelectTrigger>
                          <SelectContent>
                            {terms.map((term: any) => (
                              <SelectItem key={term.id} value={term.id.toString()}>
                                {term.name} ({term.year})
                                {term.isCurrent && (
                                  <span className="ml-2 text-xs bg-primary/85 text-white px-2 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.termId && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.termId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalMarks">
                      Total Marks <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="totalMarks"
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="100"
                      {...form.register('totalMarks', { valueAsNumber: true })}
                      data-testid="input-total-marks"
                      className="h-12 text-base"
                    />
                    {form.formState.errors.totalMarks && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.totalMarks.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">
                      Duration per Student (minutes) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      min="1"
                      placeholder="60"
                      {...form.register('timeLimit', { valueAsNumber: true })}
                      data-testid="input-time-limit"
                      className="h-12 text-base"
                    />
                    {form.formState.errors.timeLimit && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {form.formState.errors.timeLimit.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <Label>Timer Mode <span className="text-destructive">*</span></Label>
                    <Controller
                      name="timerMode"
                      control={form.control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-3"
                        >
                          <div className={`
                            flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer
                            ${field.value === 'individual' ? 'border-primary bg-primary/5 dark:bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                          `}>
                            <RadioGroupItem value="individual" id="timer-individual" data-testid="radio-timer-individual" />
                            <div className="flex-1">
                              <Label htmlFor="timer-individual" className="font-semibold text-base cursor-pointer">
                                Individual Timer — Each student's timer starts when they begin
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Info className="w-4 h-4" />
                                💡 Ideal for flexible scheduling and different time zones.
                              </p>
                            </div>
                          </div>

                          <div className={`
                            flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer
                            ${field.value === 'global' ? 'border-primary bg-primary/5 dark:bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                          `}>
                            <RadioGroupItem value="global" id="timer-global" data-testid="radio-timer-global" />
                            <div className="flex-1">
                              <Label htmlFor="timer-global" className="font-semibold text-base cursor-pointer">
                                Global Timer — All students start and end at the same time
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Info className="w-4 h-4" />
                                💡 Best for synchronized, controlled exam sessions.
                              </p>
                            </div>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-2xl rounded-2xl border-border">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-t-2xl">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500 text-white">
                    <Settings className="w-6 h-6" />
                  </div>
                  Options & Grading
                </CardTitle>
                <CardDescription>Control visibility, behavior, and grading</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Publishing Options
                  </h3>
                  
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="isPublished" className="text-base font-semibold cursor-pointer">Publish Immediately</Label>
                      <p className="text-sm text-muted-foreground">
                        Make exam visible to students right away
                      </p>
                    </div>
                    <Controller
                      name="isPublished"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="isPublished"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="shuffleQuestions" className="text-base font-semibold cursor-pointer">Shuffle Questions</Label>
                      <p className="text-sm text-muted-foreground">
                        Randomize question order for each student
                      </p>
                    </div>
                    <Controller
                      name="shuffleQuestions"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="shuffleQuestions"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="showInstructionsScreen" className="text-base font-semibold cursor-pointer">Show Instructions Screen</Label>
                      <p className="text-sm text-muted-foreground">
                        Students must read and accept exam rules before starting
                      </p>
                    </div>
                    <Controller
                      name="showInstructionsScreen"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="showInstructionsScreen"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    Grading Settings
                  </h3>

                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoGradingEnabled" className="text-base font-semibold cursor-pointer">Enable Auto-Grading</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically grade objective questions
                      </p>
                    </div>
                    <Controller
                      name="autoGradingEnabled"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="autoGradingEnabled"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="showCorrectAnswers" className="text-base font-semibold cursor-pointer">Show Correct Answers</Label>
                      <p className="text-sm text-muted-foreground">
                        Display correct answers after submission
                      </p>
                    </div>
                    <Controller
                      name="showCorrectAnswers"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="showCorrectAnswers"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passingScore">Passing Score (%)</Label>
                      <Input
                        id="passingScore"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="60"
                        {...form.register('passingScore', { valueAsNumber: true })}
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gradingScale">Grading Scale</Label>
                      <Controller
                        name="gradingScale"
                        control={form.control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select scale" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">A-F (Standard)</SelectItem>
                              <SelectItem value="pass-fail">Pass/Fail</SelectItem>
                              <SelectItem value="numeric">Numeric (0-100)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      case 4:
        const selectedClass = classes.find((c: any) => c.id === formValues.classId);
        const selectedSubject = (myAssignments?.subjects || []).find((s: any) => s.id === formValues.subjectId);
        const selectedTerm = terms.find((t: any) => t.id === formValues.termId);
        
        return (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-2xl rounded-2xl border-border">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-t-2xl">
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500 text-white">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  Review & Create
                </CardTitle>
                <CardDescription>Review your exam configuration before creating</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Exam Name</p>
                    <p className="font-semibold text-lg">{formValues.name || 'Not set'}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Assessment Type</p>
                    <Badge variant="outline" className="text-base">
                      {formValues.examType === 'exam' ? 'Exam (60% weight)' : 'Test (40% weight)'}
                    </Badge>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Class</p>
                    <p className="font-semibold">{selectedClass?.name || 'Not selected'}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Subject</p>
                    <p className="font-semibold">{selectedSubject?.name || 'Not selected'}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Academic Term</p>
                    <p className="font-semibold">{selectedTerm ? `${selectedTerm.name} (${selectedTerm.year})` : 'Not selected'}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Exam Date</p>
                    <p className="font-semibold">{formValues.date || 'Not set'}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total Marks</p>
                    <p className="font-semibold text-lg">{formValues.totalMarks || 0}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Duration</p>
                    <p className="font-semibold">{formValues.timeLimit || 0} minutes</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Timer Mode</p>
                    <Badge variant={formValues.timerMode === 'individual' ? 'default' : 'secondary'} className="text-base">
                      {formValues.timerMode === 'individual' ? '⏱️ Individual Timer' : '🕐 Global Timer'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Options & Grading
                  </h3>
                  <div className="grid grid-cols-2 gap-3 border p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      {formValues.isPublished ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Publish Immediately</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formValues.shuffleQuestions ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Shuffle Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formValues.autoGradingEnabled ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Auto-Grading</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formValues.showCorrectAnswers ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Show Correct Answers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formValues.instantFeedback ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm">Instant Feedback</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Passing: {formValues.passingScore}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                        Ready to Create!
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Your exam is configured and ready. Click "Create Exam" to proceed to question upload.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4" data-testid="create-exam-page">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/85 to-indigo-600 shadow-lg">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                Create New Exam
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Design a comprehensive exam with modern features, security, and automatic grading
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/portal/teacher/exams')}
              data-testid="button-cancel"
              className="h-12"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
          <Separator className="mt-4" />
        </div>

        <StepIndicator currentStep={currentStep} totalSteps={4} />

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-border shadow-lg rounded-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previousStep}
                  disabled={currentStep === 1 || createExamMutation.isPending}
                  data-testid="button-previous"
                  className="h-12"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-3">
                  {currentStep === 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onSaveDraft}
                      disabled={createExamMutation.isPending}
                      data-testid="button-save-draft"
                      className="h-12"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save as Draft
                    </Button>
                  )}

                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      data-testid="button-next"
                      className="h-12 min-w-[120px]"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={createExamMutation.isPending}
                      data-testid="button-create-exam"
                      className="h-12 min-w-[180px] bg-gradient-to-r from-primary/85 to-indigo-600 hover:from-primary hover:to-indigo-700"
                    >
                      {createExamMutation.isPending ? (
                        <>
                          <Clock className="w-5 h-5 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Create Exam
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
    </div>
  );
}
