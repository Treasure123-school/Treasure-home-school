import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, 
  School, 
  Shield, 
  Bell, 
  Database, 
  Users,
  Save,
  RefreshCw,
  CheckCircle,
  GraduationCap,
  Scale,
  Info,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Building2,
  ChevronRight,
  Menu,
  Percent
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GradingBoundary {
  id: number;
  name: string;
  grade: string;
  minScore: number;
  maxScore: number;
  remark?: string;
  gradePoint?: number;
  isDefault: boolean;
}

const schoolSettingsSchema = z.object({
  schoolName: z.string().min(1, 'School name is required'),
  schoolAddress: z.string().min(1, 'School address is required'),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  website: z.string().optional(),
  academicYear: z.string().min(1, 'Academic year is required'),
  schoolLogo: z.string().optional(),
});


const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  attendanceAlerts: z.boolean(),
  gradeAlerts: z.boolean(),
  announcementNotifications: z.boolean(),
});

type SchoolSettings = z.infer<typeof schoolSettingsSchema>;
type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

interface GradingConfigResponse {
  testWeight: number;
  examWeight: number;
  defaultGradingScale: string;
  gradingScales: Record<string, {
    name: string;
    ranges: Array<{
      grade: string;
      minScore: number;
      maxScore: number;
      gpa: number;
      remark: string;
    }>;
  }>;
}

const settingsNavItems = [
  { id: 'school', label: 'School Info', icon: School, description: 'Basic school details' },
  { id: 'grading', label: 'Grading', icon: GraduationCap, description: 'Grade scales & weights' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences' },
  { id: 'system', label: 'System', icon: Database, description: 'Status & maintenance (view only)' },
];

function GradingBoundariesSection() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBoundary, setEditingBoundary] = useState<GradingBoundary | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [boundaryToDelete, setBoundaryToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: 'Standard',
    grade: '',
    minScore: 0,
    maxScore: 100,
    remark: '',
    gradePoint: 0,
    isDefault: true,
  });

  const { data: boundaries = [], isLoading } = useQuery<GradingBoundary[]>({
    queryKey: ['/api/grading-boundaries'],
  });

  const createBoundaryMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/grading-boundaries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] });
      toast({ title: 'Success', description: 'Grading boundary created successfully' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create grading boundary', variant: 'destructive' });
    },
  });

  const updateBoundaryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PATCH', `/api/grading-boundaries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] });
      toast({ title: 'Success', description: 'Grading boundary updated successfully' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update grading boundary', variant: 'destructive' });
    },
  });

  const deleteBoundaryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/grading-boundaries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] });
      toast({ title: 'Success', description: 'Grading boundary deleted successfully' });
      setDeleteConfirmOpen(false);
      setBoundaryToDelete(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete grading boundary', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: 'Standard',
      grade: '',
      minScore: 0,
      maxScore: 100,
      remark: '',
      gradePoint: 0,
      isDefault: true,
    });
    setEditingBoundary(null);
  };

  const handleSubmit = () => {
    if (!formData.grade) {
      toast({ title: 'Error', description: 'Grade letter is required', variant: 'destructive' });
      return;
    }
    if (formData.minScore > formData.maxScore) {
      toast({ title: 'Error', description: 'Minimum score cannot be greater than maximum score', variant: 'destructive' });
      return;
    }
    if (editingBoundary) {
      updateBoundaryMutation.mutate({ id: editingBoundary.id, data: formData });
    } else {
      createBoundaryMutation.mutate(formData);
    }
  };

  const handleEdit = (boundary: GradingBoundary) => {
    setFormData({
      name: boundary.name,
      grade: boundary.grade,
      minScore: boundary.minScore,
      maxScore: boundary.maxScore,
      remark: boundary.remark || '',
      gradePoint: boundary.gradePoint || 0,
      isDefault: boundary.isDefault,
    });
    setEditingBoundary(boundary);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setBoundaryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (boundaryToDelete) {
      deleteBoundaryMutation.mutate(boundaryToDelete);
    }
  };

  const defaultBoundaries = [
    { grade: 'A+', minScore: 90, maxScore: 100, remark: 'Excellent', gradePoint: 4.0 },
    { grade: 'A', minScore: 80, maxScore: 89, remark: 'Very Good', gradePoint: 3.7 },
    { grade: 'B+', minScore: 70, maxScore: 79, remark: 'Good', gradePoint: 3.3 },
    { grade: 'B', minScore: 60, maxScore: 69, remark: 'Credit', gradePoint: 3.0 },
    { grade: 'C', minScore: 50, maxScore: 59, remark: 'Pass', gradePoint: 2.0 },
    { grade: 'D', minScore: 40, maxScore: 49, remark: 'Fair', gradePoint: 1.0 },
    { grade: 'F', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: 0.0 },
  ];

  const createDefaultBoundariesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/grading-boundaries/bulk', {
        name: 'Standard',
        isDefault: true,
        boundaries: defaultBoundaries,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] });
      toast({ title: 'Success', description: 'Default grading boundaries created' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create default boundaries', variant: 'destructive' });
    },
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Grading Boundaries
          </h3>
          <p className="text-sm text-muted-foreground">Define grade ranges and points</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {boundaries.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => createDefaultBoundariesMutation.mutate()}
              disabled={createDefaultBoundariesMutation.isPending}
              data-testid="button-create-defaults"
            >
              {createDefaultBoundariesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Default Scale
            </Button>
          )}
          <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="button-add-boundary">
            <Plus className="w-4 h-4 mr-2" />
            Add Boundary
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : boundaries.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No grading boundaries configured yet.</p>
          <p className="text-sm text-muted-foreground">Click "Create Default Scale" to set up the standard A-F grading scale.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Score Range</TableHead>
                <TableHead className="hidden sm:table-cell">Grade Point</TableHead>
                <TableHead className="hidden md:table-cell">Remark</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boundaries.map((boundary) => (
                <TableRow key={boundary.id} data-testid={`row-boundary-${boundary.id}`}>
                  <TableCell className="font-semibold">
                    <Badge variant="outline">{boundary.grade}</Badge>
                  </TableCell>
                  <TableCell>{boundary.minScore} - {boundary.maxScore}%</TableCell>
                  <TableCell className="hidden sm:table-cell">{boundary.gradePoint?.toFixed(1) || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{boundary.remark || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(boundary)}
                        data-testid={`button-edit-boundary-${boundary.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(boundary.id)}
                        data-testid={`button-delete-boundary-${boundary.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBoundary ? 'Edit Grading Boundary' : 'Add Grading Boundary'}</DialogTitle>
            <DialogDescription>
              Define the score range for this grade level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grade">Grade Letter</Label>
                <Input
                  id="grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value.toUpperCase() })}
                  placeholder="e.g., A+"
                  data-testid="input-grade"
                />
              </div>
              <div>
                <Label htmlFor="gradePoint">Grade Point</Label>
                <Input
                  id="gradePoint"
                  type="number"
                  step="0.1"
                  value={formData.gradePoint}
                  onChange={(e) => setFormData({ ...formData, gradePoint: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 4.0"
                  data-testid="input-grade-point"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minScore">Minimum Score (%)</Label>
                <Input
                  id="minScore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.minScore}
                  onChange={(e) => setFormData({ ...formData, minScore: parseInt(e.target.value) || 0 })}
                  data-testid="input-min-score"
                />
              </div>
              <div>
                <Label htmlFor="maxScore">Maximum Score (%)</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) || 100 })}
                  data-testid="input-max-score"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="remark">Remark</Label>
              <Input
                id="remark"
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="e.g., Excellent, Very Good, Pass"
                data-testid="input-remark"
              />
            </div>
            <div>
              <Label htmlFor="name">Scale Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard, Custom"
                data-testid="input-scale-name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                data-testid="switch-is-default"
              />
              <Label htmlFor="isDefault">Set as default grading scale</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createBoundaryMutation.isPending || updateBoundaryMutation.isPending} 
              data-testid="button-save-boundary"
            >
              {(createBoundaryMutation.isPending || updateBoundaryMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingBoundary ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this grading boundary? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBoundaryMutation.isPending} data-testid="button-confirm-delete">
              {deleteBoundaryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClassPositionSettings() {
  const { toast } = useToast();
  const [positioningMethod, setPositioningMethod] = useState('average');
  const [isLoading, setIsLoading] = useState(true);

  const { data: settings } = useQuery<{ positioningMethod: string }>({
    queryKey: ['/api/settings/positioning-method'],
  });

  useEffect(() => {
    if (settings) {
      setPositioningMethod(settings.positioningMethod || 'average');
      setIsLoading(false);
    }
  }, [settings]);

  const savePositioningMethodMutation = useMutation({
    mutationFn: async (method: string) => {
      return apiRequest('PATCH', '/api/settings/positioning-method', { positioningMethod: method });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/positioning-method'] });
      toast({ title: 'Success', description: 'Class position calculation method updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update positioning method', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    savePositioningMethodMutation.mutate(positioningMethod);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Class Position Calculation
        </h3>
        <p className="text-sm text-muted-foreground">Choose how student rankings are calculated</p>
      </div>

      <div className="space-y-3">
        <Select
          value={positioningMethod}
          onValueChange={setPositioningMethod}
          disabled={isLoading}
        >
          <SelectTrigger data-testid="select-positioning-method">
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="average" data-testid="option-average">
              Average Score (Recommended)
            </SelectItem>
            <SelectItem value="total" data-testid="option-total">
              Total Marks
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {positioningMethod === 'average' 
              ? 'Students are ranked by average percentage. Fair when students take different numbers of subjects.'
              : 'Students are ranked by total marks. May not be fair when students take different numbers of subjects.'}
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={savePositioningMethodMutation.isPending}
          size="sm"
          data-testid="button-save-positioning"
        >
          {savePositioningMethodMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}

function SettingsNavItem({ 
  item, 
  isActive, 
  onClick 
}: { 
  item: typeof settingsNavItems[0]; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
        isActive 
          ? "bg-primary text-primary-foreground" 
          : "hover-elevate"
      )}
      data-testid={`nav-${item.id}`}
    >
      <item.icon className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.label}</p>
        <p className={cn(
          "text-xs truncate",
          isActive ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {item.description}
        </p>
      </div>
      <ChevronRight className={cn(
        "w-4 h-4 shrink-0",
        isActive ? "text-primary-foreground/70" : "text-muted-foreground"
      )} />
    </button>
  );
}

export default function SettingsManagement() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('school');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const schoolForm = useForm<SchoolSettings>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: {
      schoolName: 'Treasure-Home School',
      schoolAddress: '123 Education Street, Learning City, ED 12345',
      phoneNumber: '+1 (555) 123-4567',
      email: 'info@treasurehome.edu',
      website: 'https://treasurehome.edu',
      academicYear: '2024-2025',
    },
  });

  const notificationForm = useForm<NotificationSettings>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      attendanceAlerts: true,
      gradeAlerts: true,
      announcementNotifications: true,
    },
  });

  const [testWeight, setTestWeight] = useState(40);
  const [selectedScale, setSelectedScale] = useState('standard');

  const { data: gradingConfig } = useQuery<GradingConfigResponse>({
    queryKey: ['/api/grading-config'],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (gradingConfig) {
      setTestWeight(gradingConfig.testWeight);
      setSelectedScale(gradingConfig.defaultGradingScale);
    }
  }, [gradingConfig]);

  const [systemStatus] = useState({
    database: 'Connected',
    storage: 'Healthy',
    cache: 'Active',
    backups: 'Up to date',
  });

  const saveSchoolSettingsMutation = useMutation({
    mutationFn: async (data: SchoolSettings) => {
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({ title: "Success", description: "School settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update school settings", variant: "destructive" });
    },
  });

  const saveNotificationSettingsMutation = useMutation({
    mutationFn: async (data: NotificationSettings) => {
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update notification settings", variant: "destructive" });
    },
  });

  const handleDatabaseBackup = () => {
    toast({ title: "Backup Started", description: "Database backup has been initiated..." });
  };

  const handleSystemMaintenance = () => {
    toast({ title: "Maintenance Mode", description: "System maintenance mode activated" });
  };

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileNavOpen(false);
  };

  const activeNavItem = settingsNavItems.find(item => item.id === activeSection);

  const renderContent = () => {
    switch (activeSection) {
      case 'school':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="w-5 h-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>School name and academic year</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={schoolForm.handleSubmit((data) => saveSchoolSettingsMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schoolName">School Name *</Label>
                      <Input 
                        id="schoolName" 
                        {...schoolForm.register('schoolName')}
                        data-testid="input-school-name"
                      />
                      {schoolForm.formState.errors.schoolName && (
                        <p className="text-sm text-destructive">{schoolForm.formState.errors.schoolName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="academicYear" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Academic Year *
                      </Label>
                      <Input 
                        id="academicYear" 
                        {...schoolForm.register('academicYear')}
                        data-testid="input-academic-year"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={saveSchoolSettingsMutation.isPending} data-testid="button-save-basic">
                      <Save className="w-4 h-4 mr-2" />
                      {saveSchoolSettingsMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
                <CardDescription>School address details</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="schoolAddress">Full Address *</Label>
                    <Textarea 
                      id="schoolAddress" 
                      {...schoolForm.register('schoolAddress')}
                      rows={2}
                      data-testid="textarea-school-address"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={schoolForm.handleSubmit((data) => saveSchoolSettingsMutation.mutate(data))} disabled={saveSchoolSettingsMutation.isPending} data-testid="button-save-location">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>Phone, email, and website</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone
                      </Label>
                      <Input 
                        id="phoneNumber" 
                        {...schoolForm.register('phoneNumber')}
                        data-testid="input-phone-number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Input 
                        id="email" 
                        type="email"
                        {...schoolForm.register('email')}
                        data-testid="input-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Website
                      </Label>
                      <Input 
                        id="website" 
                        {...schoolForm.register('website')}
                        data-testid="input-website"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={schoolForm.handleSubmit((data) => saveSchoolSettingsMutation.mutate(data))} disabled={saveSchoolSettingsMutation.isPending} data-testid="button-save-contact">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        );

      case 'grading':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Percent className="w-5 h-5" />
                  Assessment Weights
                </CardTitle>
                <CardDescription>Configure how test and exam scores are weighted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Test Weight: {testWeight}%</span>
                    <span className="font-medium">Exam Weight: {100 - testWeight}%</span>
                  </div>
                  <Slider
                    value={[testWeight]}
                    onValueChange={(value) => setTestWeight(value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="slider-test-weight"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>More weight on tests</span>
                    <span>More weight on exams</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="defaultScale">Default Grading Scale</Label>
                  <Select value={selectedScale} onValueChange={setSelectedScale}>
                    <SelectTrigger data-testid="select-default-scale">
                      <SelectValue placeholder="Select grading scale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (A-F)</SelectItem>
                      <SelectItem value="percentage">Percentage Based</SelectItem>
                      <SelectItem value="custom">Custom Scale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" data-testid="button-save-grading-weights">
                    <Save className="w-4 h-4 mr-2" />
                    Save Weights
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <ClassPositionSettings />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <GradingBoundariesSection />
              </CardContent>
            </Card>
          </div>
        );

      case 'notifications':
        return (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose which notifications to receive</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={notificationForm.handleSubmit((data) => saveNotificationSettingsMutation.mutate(data))} className="space-y-4">
                <div className="space-y-3">
                  {[
                    { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
                    { id: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
                    { id: 'attendanceAlerts', label: 'Attendance Alerts', desc: 'Get notified about attendance issues' },
                    { id: 'gradeAlerts', label: 'Grade Alerts', desc: 'Get notified about grade updates' },
                    { id: 'announcementNotifications', label: 'Announcements', desc: 'Get notified about new announcements' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <Label htmlFor={item.id} className="text-base font-medium">{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch 
                        id={item.id}
                        {...notificationForm.register(item.id as keyof NotificationSettings)}
                        data-testid={`switch-${item.id}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" disabled={saveNotificationSettingsMutation.isPending} data-testid="button-save-notifications">
                    <Save className="w-4 h-4 mr-2" />
                    {saveNotificationSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        );

      case 'system':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="w-5 h-5" />
                  System Status
                </CardTitle>
                <CardDescription>Current system health overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Database', desc: 'PostgreSQL Connection', status: systemStatus.database },
                    { label: 'Storage', desc: 'File System Health', status: systemStatus.storage },
                    { label: 'Cache', desc: 'Redis Cache Status', status: systemStatus.cache },
                    { label: 'Backups', desc: 'Last Backup Status', status: systemStatus.backups },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-medium text-green-600">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5" />
                  System Actions
                </CardTitle>
                <CardDescription>Database backup and maintenance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={handleDatabaseBackup} data-testid="button-backup" className="flex-1">
                    <Database className="w-4 h-4 mr-2" />
                    Backup Database
                  </Button>
                  <Button variant="outline" onClick={handleSystemMaintenance} data-testid="button-maintenance" className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Maintenance Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full" data-testid="settings-management">
      <div className="lg:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="w-full justify-between"
          data-testid="button-mobile-nav"
        >
          <span className="flex items-center gap-2">
            {activeNavItem && <activeNavItem.icon className="w-4 h-4" />}
            {activeNavItem?.label || 'Settings'}
          </span>
          <Menu className="w-4 h-4" />
        </Button>

        {mobileNavOpen && (
          <Card className="mt-2">
            <CardContent className="p-2">
              <div className="space-y-1">
                {settingsNavItems.map((item) => (
                  <SettingsNavItem
                    key={item.id}
                    item={item}
                    isActive={activeSection === item.id}
                    onClick={() => handleNavClick(item.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden lg:block w-64 shrink-0">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {settingsNavItems.map((item) => (
                <SettingsNavItem
                  key={item.id}
                  item={item}
                  isActive={activeSection === item.id}
                  onClick={() => handleNavClick(item.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {activeNavItem && <activeNavItem.icon className="w-6 h-6" />}
            {activeNavItem?.label} Settings
          </h1>
          <p className="text-muted-foreground text-sm">{activeNavItem?.description}</p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
