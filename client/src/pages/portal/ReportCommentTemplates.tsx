import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, MessageSquare, User, Award, AlertCircle, Info, Filter, RefreshCw, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PERFORMANCE_LEVELS = [
  { value: 'excellent', label: 'Excellent', minDefault: 70, maxDefault: 100, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
  { value: 'very_good', label: 'Very Good', minDefault: 60, maxDefault: 69, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
  { value: 'good', label: 'Good', minDefault: 50, maxDefault: 59, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
  { value: 'fair', label: 'Fair', minDefault: 40, maxDefault: 49, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' },
  { value: 'needs_improvement', label: 'Needs Improvement', minDefault: 0, maxDefault: 39, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
] as const;

const templateFormSchema = z.object({
  role: z.enum(['teacher', 'principal']),
  performanceLevel: z.string().min(1, 'Performance level is required'),
  minPercentage: z.number().min(0).max(100),
  maxPercentage: z.number().min(0).max(100),
  commentTemplate: z.string().min(10, 'Comment template must be at least 10 characters'),
  isActive: z.boolean().default(true),
});

type TemplateForm = z.infer<typeof templateFormSchema>;

export default function ReportCommentTemplates() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('teacher');

  const { register, handleSubmit, formState: { errors }, setValue, reset, control, watch } = useForm<TemplateForm>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      role: 'teacher',
      performanceLevel: 'excellent',
      minPercentage: 70,
      maxPercentage: 100,
      commentTemplate: '',
      isActive: true,
    }
  });

  const watchedRole = watch('role');
  const watchedPerformanceLevel = watch('performanceLevel');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/admin/report-comment-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/report-comment-templates');
      return await response.json();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateForm) => {
      const response = await apiRequest('POST', '/api/admin/report-comment-templates', data);
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Comment template created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-comment-templates'] });
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TemplateForm> }) => {
      const response = await apiRequest('PATCH', `/api/admin/report-comment-templates/${id}`, data);
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Comment template updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-comment-templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/admin/report-comment-templates/${id}`);
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Comment template deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-comment-templates'] });
      setTemplateToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete template", variant: "destructive" });
    },
  });

  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ updated: number; skipped: number; total: number } | null>(null);

  const handleBackfillComments = async (overwrite: boolean = false) => {
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const response = await apiRequest('POST', '/api/reports/backfill-comments', { overwrite });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to backfill comments');
      }
      const result = await response.json();
      setBackfillResult({ updated: result.updated, skipped: result.skipped, total: result.total });
      toast({ 
        title: "Comments Applied", 
        description: `Updated ${result.updated} report cards. Skipped ${result.skipped} (already had comments).` 
      });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to apply default comments", 
        variant: "destructive" 
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const onSubmit = (data: TemplateForm) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setValue('role', template.role);
    setValue('performanceLevel', template.performanceLevel);
    setValue('minPercentage', template.minPercentage);
    setValue('maxPercentage', template.maxPercentage);
    setValue('commentTemplate', template.commentTemplate);
    setValue('isActive', template.isActive);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingTemplate(null);
    reset({
      role: activeTab as 'teacher' | 'principal',
      performanceLevel: 'excellent',
      minPercentage: 70,
      maxPercentage: 100,
      commentTemplate: '',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handlePerformanceLevelChange = (level: string) => {
    setValue('performanceLevel', level);
    const levelConfig = PERFORMANCE_LEVELS.find(l => l.value === level);
    if (levelConfig) {
      setValue('minPercentage', levelConfig.minDefault);
      setValue('maxPercentage', levelConfig.maxDefault);
    }
  };

  const filteredTemplates = templates.filter((t: any) => t.role === activeTab);

  const getPerformanceLevelBadge = (level: string) => {
    const config = PERFORMANCE_LEVELS.find(l => l.value === level);
    return config ? (
      <Badge className={`${config.color} no-default-hover-elevate no-default-active-elevate`}>
        {config.label}
      </Badge>
    ) : (
      <Badge variant="secondary">{level}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Report Comment Templates</h1>
          <p className="text-muted-foreground">
            Manage default comment templates for report cards based on performance levels
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-template">
          <Plus className="w-4 h-4 mr-2" />
          Add Template
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Use <code className="bg-muted px-1 rounded">{'{lastName}'}</code> in your templates to automatically insert the student's last name.
          Example: "{'{lastName}'} has shown excellent performance this term."
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teacher" data-testid="tab-teacher">
            <User className="w-4 h-4 mr-2" />
            Teacher Comments
          </TabsTrigger>
          <TabsTrigger value="principal" data-testid="tab-principal">
            <Award className="w-4 h-4 mr-2" />
            Principal Comments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teacher" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Teacher Comment Templates
              </CardTitle>
              <CardDescription>
                These comments are used by class teachers for their assigned classes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderTemplatesTable('teacher')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="principal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Principal Comment Templates
              </CardTitle>
              <CardDescription>
                These comments are used for principal remarks on report cards (admin-only).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderTemplatesTable('principal')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Apply Comments to Existing Reports
          </CardTitle>
          <CardDescription>
            Use this to automatically populate teacher and principal comments on existing report cards 
            based on student performance averages and your configured templates above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Comments will be generated using the student's last name and their overall performance level.
              This follows school convention by using <strong>lastName</strong> (not first name) in all comments.
            </AlertDescription>
          </Alert>
          
          {backfillResult && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Successfully processed {backfillResult.total} report cards. 
                Updated: {backfillResult.updated}, Skipped: {backfillResult.skipped}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => handleBackfillComments(false)} 
              disabled={isBackfilling}
              variant="outline"
              data-testid="button-backfill-empty"
            >
              {isBackfilling ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Apply to Empty Comments Only
            </Button>
            <Button 
              onClick={() => handleBackfillComments(true)} 
              disabled={isBackfilling}
              variant="secondary"
              data-testid="button-backfill-all"
            >
              {isBackfilling ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate All Comments
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            "Empty Comments Only" will preserve existing comments. "Regenerate All" will overwrite all comments.
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingTemplate(null);
          reset();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Comment Template' : 'Add Comment Template'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Performance Level</Label>
              <Controller
                name="performanceLevel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handlePerformanceLevelChange}>
                    <SelectTrigger data-testid="select-performance-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERFORMANCE_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label} ({level.minDefault}%-{level.maxDefault}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.performanceLevel && <p className="text-sm text-destructive">{errors.performanceLevel.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Percentage</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...register('minPercentage', { valueAsNumber: true })}
                  data-testid="input-min-percentage"
                />
                {errors.minPercentage && <p className="text-sm text-destructive">{errors.minPercentage.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Max Percentage</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...register('maxPercentage', { valueAsNumber: true })}
                  data-testid="input-max-percentage"
                />
                {errors.maxPercentage && <p className="text-sm text-destructive">{errors.maxPercentage.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comment Template</Label>
              <Textarea
                {...register('commentTemplate')}
                placeholder="Use {lastName} to insert the student's last name. Example: {lastName} has shown excellent progress..."
                rows={4}
                data-testid="input-comment-template"
              />
              {errors.commentTemplate && <p className="text-sm text-destructive">{errors.commentTemplate.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-is-active"
                  />
                )}
              />
              <Label>Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                data-testid="button-submit-template"
              >
                {createTemplateMutation.isPending || updateTemplateMutation.isPending
                  ? 'Saving...'
                  : editingTemplate
                  ? 'Update Template'
                  : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => templateToDelete && deleteTemplateMutation.mutate(templateToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderTemplatesTable(role: string) {
    const roleTemplates = templates.filter((t: any) => t.role === role);

    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (roleTemplates.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No {role} comment templates yet</p>
          <Button variant="outline" className="mt-4" onClick={handleOpenDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Template
          </Button>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Performance Level</TableHead>
            <TableHead>Range</TableHead>
            <TableHead>Comment Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roleTemplates.map((template: any) => (
            <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
              <TableCell>
                {getPerformanceLevelBadge(template.performanceLevel)}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {template.minPercentage}% - {template.maxPercentage}%
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {template.commentTemplate}
              </TableCell>
              <TableCell>
                {template.isActive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(template)}
                    data-testid={`button-edit-${template.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setTemplateToDelete(template)}
                    data-testid={`button-delete-${template.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
}
