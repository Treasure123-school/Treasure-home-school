
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  Plus, Calendar, Edit, Trash2, CheckCircle, Lock, Unlock, 
  GraduationCap, Clock, Archive, Play, ChevronRight, 
  CalendarDays, Settings2, AlertTriangle
} from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

type TermStatus = 'upcoming' | 'active' | 'completed' | 'archived';

interface AcademicTerm {
  id: number;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: TermStatus;
  isLocked: boolean;
  description?: string;
  createdAt: string;
}

interface GroupedTerms {
  year: string;
  terms: AcademicTerm[];
}

const statusConfig: Record<TermStatus, { label: string; color: string; icon: any }> = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Play },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', icon: CheckCircle },
  archived: { label: 'Archived', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Archive },
};

// Validate academic year format (must be YYYY/YYYY with consecutive years)
function validateAcademicYear(year: string): { valid: boolean; error?: string } {
  const yearPattern = /^\d{4}\/\d{4}$/;
  if (!yearPattern.test(year)) {
    return { valid: false, error: 'Format must be YYYY/YYYY (e.g., 2024/2025)' };
  }
  const [startYear, endYear] = year.split('/').map(Number);
  if (endYear !== startYear + 1) {
    return { valid: false, error: 'Years must be consecutive (e.g., 2024/2025)' };
  }
  return { valid: true };
}

export default function AcademicTermsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [yearError, setYearError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    year: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    status: 'upcoming' as TermStatus,
    description: ''
  });

  const { data: terms = [], isLoading, error, refetch } = useQuery<AcademicTerm[]>({
    queryKey: ['/api/terms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/terms');
      if (!response.ok) {
        throw new Error('Failed to fetch terms');
      }
      return response.json();
    },
    retry: 3,
    retryDelay: 1000,
  });

  const { data: groupedTerms = [] } = useQuery<GroupedTerms[]>({
    queryKey: ['/api/terms/grouped'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/terms/grouped');
      if (!response.ok) {
        throw new Error('Failed to fetch grouped terms');
      }
      return response.json();
    },
    retry: 2,
  });

  useSocketIORealtime({ 
    table: 'academic_terms', 
    queryKey: ['/api/terms']
  });

  const createTermMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/terms', data);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create term');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Academic term created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create term", variant: "destructive" });
    },
  });

  const updateTermMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/terms/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update term' }));
        throw new Error(errorData.message || 'Failed to update term');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Academic term updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update term", variant: "destructive" });
    },
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/terms/${id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete term' }));
        throw new Error(errorData.message || 'Failed to delete term');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Academic term deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete term", variant: "destructive" });
    },
  });

  const markAsCurrentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/terms/${id}/mark-current`);
      if (!response.ok) {
        throw new Error('Failed to mark term as current');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Term marked as current successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark term as current", variant: "destructive" });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/terms/${id}/toggle-lock`);
      if (!response.ok) {
        throw new Error('Failed to toggle lock status');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Success", 
        description: data.isLocked ? "Term locked successfully" : "Term unlocked successfully" 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to toggle lock", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TermStatus }) => {
      const response = await apiRequest('PUT', `/api/terms/${id}/status`, { status });
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Term status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/terms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/terms/grouped'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate year format before submitting
    const yearValidation = validateAcademicYear(formData.year);
    if (!yearValidation.valid) {
      setYearError(yearValidation.error || 'Invalid year format');
      toast({ 
        title: "Validation Error", 
        description: yearValidation.error, 
        variant: "destructive" 
      });
      return;
    }
    setYearError(null);
    
    if (editingTerm) {
      updateTermMutation.mutate({ id: editingTerm.id, data: formData });
    } else {
      createTermMutation.mutate(formData);
    }
  };

  const handleEdit = (term: AcademicTerm) => {
    if (term.isLocked) {
      toast({ 
        title: "Term Locked", 
        description: "This term is locked and cannot be edited. Unlock it first.", 
        variant: "destructive" 
      });
      return;
    }
    setEditingTerm(term);
    setFormData({
      name: term.name,
      year: term.year,
      startDate: term.startDate,
      endDate: term.endDate,
      isCurrent: term.isCurrent,
      status: term.status || 'upcoming',
      description: term.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTerm(null);
    setYearError(null);
    setFormData({ 
      name: '', 
      year: '', 
      startDate: '', 
      endDate: '', 
      isCurrent: false, 
      status: 'upcoming',
      description: '' 
    });
  };

  const currentTerm = terms.find(t => t.isCurrent);
  const activeTermsCount = terms.filter(t => t.status === 'active' || t.isCurrent).length;
  const upcomingTermsCount = terms.filter(t => t.status === 'upcoming').length;
  const archivedTermsCount = terms.filter(t => t.status === 'archived').length;
  const uniqueYears = [...new Set(terms.map(t => t.year))];

  const filteredTerms = activeTab === 'all' 
    ? terms 
    : terms.filter(t => t.status === activeTab || (activeTab === 'active' && t.isCurrent));

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const getTermProgress = (term: AcademicTerm) => {
    const now = new Date();
    const start = new Date(term.startDate);
    const end = new Date(term.endDate);
    if (now < start) return 0;
    if (now > end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <GraduationCap className="h-8 w-8 text-primary" />
            Academic Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage academic years, terms, and session configurations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-term" size="default">
              <Plus className="w-4 h-4 mr-2" />
              New Term
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {editingTerm ? 'Edit Academic Term' : 'Create Academic Term'}
              </DialogTitle>
              <DialogDescription>
                {editingTerm 
                  ? 'Update the details for this academic term.' 
                  : 'Add a new academic term to your school calendar.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Term Name</Label>
                  <Select
                    value={formData.name}
                    onValueChange={(value) => setFormData({ ...formData, name: value })}
                  >
                    <SelectTrigger data-testid="select-term-name">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Term">First Term</SelectItem>
                      <SelectItem value="Second Term">Second Term</SelectItem>
                      <SelectItem value="Third Term">Third Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Academic Year</Label>
                  <Input
                    id="year"
                    data-testid="input-term-year"
                    value={formData.year}
                    onChange={(e) => {
                      setFormData({ ...formData, year: e.target.value });
                      if (yearError) setYearError(null);
                    }}
                    placeholder="e.g., 2024/2025"
                    required
                    className={yearError ? 'border-destructive' : ''}
                  />
                  {yearError && (
                    <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-year-error">
                      <AlertTriangle className="h-3 w-3" />
                      {yearError}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    data-testid="input-term-start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    data-testid="input-term-end-date"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TermStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-term-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  data-testid="input-term-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any notes about this term..."
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="isCurrent" className="text-sm font-normal cursor-pointer">
                    Set as current active term
                  </Label>
                </div>
                <Switch
                  id="isCurrent"
                  data-testid="switch-term-current"
                  checked={formData.isCurrent}
                  onCheckedChange={(checked) => setFormData({ ...formData, isCurrent: checked })}
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleDialogClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTermMutation.isPending || updateTermMutation.isPending} 
                  data-testid="button-submit-term"
                >
                  {createTermMutation.isPending || updateTermMutation.isPending 
                    ? (editingTerm ? 'Updating...' : 'Creating...') 
                    : (editingTerm ? 'Update Term' : 'Create Term')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Terms</p>
                <p className="text-2xl font-bold" data-testid="stat-total-terms">{terms.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold" data-testid="stat-active-terms">{activeTermsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold" data-testid="stat-upcoming-terms">{upcomingTermsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-500/10">
                <Archive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Academic Years</p>
                <p className="text-2xl font-bold" data-testid="stat-years">{uniqueYears.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Term Highlight */}
      {currentTerm && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/20">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Current Active Session</p>
                  <h3 className="text-xl font-bold" data-testid="current-term-name">
                    {currentTerm.name} - {currentTerm.year}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(currentTerm.startDate)} - {formatDate(currentTerm.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-lg font-semibold" data-testid="current-term-progress">
                    {getTermProgress(currentTerm)}%
                  </p>
                </div>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${getTermProgress(currentTerm)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terms List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Manage Terms
              </CardTitle>
              <CardDescription>
                View, edit, and manage all academic terms
              </CardDescription>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
                <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="archived" data-testid="tab-archived">Archived</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              Loading academic terms...
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive mb-4">Failed to load academic terms.</p>
              <Button onClick={() => refetch()} variant="outline" data-testid="button-retry">
                Try Again
              </Button>
            </div>
          ) : filteredTerms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">
                {activeTab === 'all' 
                  ? 'No academic terms found. Create your first term to get started.'
                  : `No ${activeTab} terms found.`}
              </p>
              {activeTab === 'all' && (
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-term">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Term
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTerms.map((term) => {
                const StatusIcon = statusConfig[term.status || 'upcoming']?.icon || Clock;
                const progress = getTermProgress(term);
                
                return (
                  <div 
                    key={term.id}
                    data-testid={`term-card-${term.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      term.isCurrent 
                        ? 'border-primary/50 bg-primary/5' 
                        : term.isLocked 
                          ? 'border-muted bg-muted/30' 
                          : 'hover-elevate'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-md ${statusConfig[term.status || 'upcoming']?.color || 'bg-muted'}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold" data-testid={`text-term-name-${term.id}`}>
                            {term.name}
                          </h4>
                          <Badge variant="outline" className="text-xs" data-testid={`badge-term-year-${term.id}`}>
                            {term.year}
                          </Badge>
                          {term.isCurrent && (
                            <Badge className="text-xs bg-primary">Current</Badge>
                          )}
                          {term.isLocked && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(term.startDate)} - {formatDate(term.endDate)}
                        </p>
                        {term.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {term.description}
                          </p>
                        )}
                        {term.isCurrent && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 max-w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status selector */}
                      <Select
                        value={term.status || 'upcoming'}
                        onValueChange={(value: TermStatus) => updateStatusMutation.mutate({ id: term.id, status: value })}
                        disabled={term.isLocked || updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-status-${term.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Mark as current */}
                      {!term.isCurrent && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => markAsCurrentMutation.mutate(term.id)}
                          disabled={markAsCurrentMutation.isPending}
                          title="Mark as current term"
                          data-testid={`button-mark-current-${term.id}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Lock/Unlock */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleLockMutation.mutate(term.id)}
                        disabled={toggleLockMutation.isPending}
                        title={term.isLocked ? "Unlock term" : "Lock term"}
                        data-testid={`button-lock-${term.id}`}
                      >
                        {term.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(term)}
                        disabled={term.isLocked}
                        title={term.isLocked ? "Unlock to edit" : "Edit term"}
                        data-testid={`button-edit-${term.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="icon"
                            disabled={term.isLocked || term.isCurrent}
                            title={term.isCurrent ? "Cannot delete current term" : term.isLocked ? "Unlock to delete" : "Delete term"}
                            data-testid={`button-delete-${term.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Academic Term</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{term.name} ({term.year})"? 
                              This action cannot be undone. All associated data may be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-delete-${term.id}`}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteTermMutation.mutate(term.id)}
                              disabled={deleteTermMutation.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${term.id}`}
                            >
                              {deleteTermMutation.isPending ? 'Deleting...' : 'Delete Term'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouped by Year Section */}
      {groupedTerms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Sessions by Academic Year
            </CardTitle>
            <CardDescription>
              View terms organized by academic year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupedTerms.map((group) => (
                <div key={group.year} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Academic Year {group.year}
                    </h4>
                    <Badge variant="secondary">{group.terms.length} terms</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {group.terms.map((term) => (
                      <div 
                        key={term.id}
                        className={`p-3 rounded-md border ${
                          term.isCurrent ? 'border-primary bg-primary/5' : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{term.name}</span>
                          {term.isCurrent && (
                            <Badge className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(term.startDate)} - {formatDate(term.endDate)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
