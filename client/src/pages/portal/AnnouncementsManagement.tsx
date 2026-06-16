import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, Edit, Search, Megaphone, Calendar, Users, Trash2, 
  Bell, Mail, MessageSquare, Paperclip, Image, Clock, 
  AlertTriangle, AlertCircle, Info, FileText, GraduationCap, 
  PartyPopper, Siren, Eye, X, Upload, Save, Send, Check,
  LayoutGrid, List, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useAuth } from '@/lib/auth';
import { PageHeader, SearchInput } from "@/components/shared";

const announcementFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z.string().min(1, 'Content is required'),
  authorId: z.string().min(1, 'Author is required'),
  targetRoles: z.array(z.string()).min(1, 'Select at least one target audience'),
  targetClasses: z.array(z.string()).default([]),
  priority: z.enum(['normal', 'important', 'urgent']).default('normal'),
  announcementType: z.enum(['general', 'academic', 'examination', 'event', 'emergency']).default('general'),
  publishOption: z.enum(['now', 'schedule']).default('now'),
  scheduledAt: z.string().optional(),
  expiryDate: z.string().optional(),
  attachments: z.array(z.string()).default([]),
  coverImageUrl: z.string().optional(),
  notificationSettings: z.object({
    inApp: z.boolean().default(true),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
  }).default({ inApp: true, email: false, sms: false }),
  allowComments: z.boolean().default(false),
  allowEdit: z.boolean().default(true),
});

type AnnouncementForm = z.infer<typeof announcementFormSchema>;

const priorityConfig = {
  normal: { label: 'Normal', icon: Info, color: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70', badgeVariant: 'secondary' as const },
  important: { label: 'Important', icon: AlertCircle, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', badgeVariant: 'default' as const },
  urgent: { label: 'Urgent', icon: AlertTriangle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', badgeVariant: 'destructive' as const },
};

const typeConfig = {
  general: { label: 'General', icon: FileText, color: 'text-gray-600 dark:text-gray-400' },
  academic: { label: 'Academic', icon: GraduationCap, color: 'text-primary dark:text-primary/70' },
  examination: { label: 'Examination', icon: FileText, color: 'text-purple-600 dark:text-purple-400' },
  event: { label: 'Event', icon: PartyPopper, color: 'text-green-600 dark:text-green-400' },
  emergency: { label: 'Emergency', icon: Siren, color: 'text-red-600 dark:text-red-400' },
};

function safeJsonParse(str: string | null | undefined, fallback: any = []): any {
  if (!str) return fallback;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    // If it's a plain string like "Student", wrap it in an array or return as is
    if (Array.isArray(fallback)) {
      return [str];
    }
    return str || fallback;
  }
}

export default function AnnouncementsManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, formState: { errors }, setValue, watch, reset, getValues } = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      authorId: '',
      targetRoles: ['All'],
      targetClasses: [],
      priority: 'normal',
      announcementType: 'general',
      publishOption: 'now',
      attachments: [],
      notificationSettings: { inApp: true, email: false, sms: false },
      allowComments: false,
      allowEdit: true,
    },
  });

  const watchedValues = watch();
  const publishOption = watch('publishOption');

  useEffect(() => {
    if (isDialogOpen && currentUser && !editingAnnouncement) {
      setValue('authorId', currentUser.id);
    }
  }, [isDialogOpen, currentUser, editingAnnouncement, setValue]);

  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['/api/announcements'] as any,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/announcements');
      return await response.json();
    },
  });

  useSocketIORealtime({ 
    table: 'announcements', 
    queryKey: ['/api/announcements'] as any,
    onEvent: (event) => {
      // Force an immediate refetch on any announcement event
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    }
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: any) => {
      const response = await apiRequest('POST', '/api/announcements', announcementData);
      if (!response.ok) throw new Error('Failed to create announcement');
      return response.json();
    },
    onSuccess: (newAnnouncement) => {
      // Update UI cache immediately for instant visibility
      queryClient.setQueryData(['/api/announcements'] as any, (old: any) => [newAnnouncement, ...(old || [])]);
      
      toast({ title: "Success", description: "Announcement published successfully" });
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to create announcement",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const response = await apiRequest('PUT', `/api/announcements/${id}`, data);
      if (!response.ok) throw new Error('Failed to update announcement');
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/announcements'] as any });
      const previousAnnouncements = queryClient.getQueryData(['/api/announcements'] as any);
      queryClient.setQueryData(['/api/announcements'] as any, (old: any) => {
        if (!old) return old;
        return old.map((announcement: any) => 
          announcement.id === id ? { ...announcement, ...data } : announcement
        );
      });
      return { previousAnnouncements };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Announcement updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsDialogOpen(false);
      setEditingAnnouncement(null);
      reset();
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousAnnouncements) {
        queryClient.setQueryData(['/api/announcements'] as any, context.previousAnnouncements);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update announcement", 
        variant: "destructive",
      });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/announcements/${id}`);
      if (!response.ok) throw new Error('Failed to delete announcement');
      return response.status === 204 ? null : response.json();
    },
    onMutate: async (id: number) => {
      // 1. Close the dialog IMMEDIATELY
      setAnnouncementToDelete(null);
      
      // 2. Optimistic update: Remove from UI immediately
      await queryClient.cancelQueries({ queryKey: ['/api/announcements'] as any });
      const previousAnnouncements = queryClient.getQueryData(['/api/announcements'] as any);
      
      queryClient.setQueryData(['/api/announcements'] as any, (old: any) => {
        if (!old) return [];
        return old.filter((announcement: any) => announcement.id !== id);
      });
      
      return { previousAnnouncements };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
      // Invalidate silently in the background
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'], exact: false });
    },
    onError: (error: any, id: number, context: any) => {
      // Rollback only if the server operation actually failed
      if (context?.previousAnnouncements) {
        queryClient.setQueryData(['/api/announcements'] as any, context.previousAnnouncements);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete announcement",
        variant: "destructive",
      });
    },
  });

  const prepareSubmissionData = (data: AnnouncementForm, status: 'draft' | 'published' | 'scheduled') => {
    return {
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      targetRoles: JSON.stringify(data.targetRoles),
      targetClasses: JSON.stringify(data.targetClasses),
      priority: data.priority,
      announcementType: data.announcementType,
      scheduledAt: data.publishOption === 'schedule' && data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : null,
      attachments: JSON.stringify(data.attachments),
      coverImageUrl: data.coverImageUrl || null,
      notificationSettings: JSON.stringify(data.notificationSettings),
      allowComments: data.allowComments,
      allowEdit: data.allowEdit,
      status,
      isPublished: status === 'published',
      publishedAt: status === 'published' ? new Date().toISOString() : null,
    };
  };

  const onSubmit = (data: AnnouncementForm, saveAsDraft = false) => {
    let status: 'draft' | 'published' | 'scheduled' = 'published';
    if (saveAsDraft) {
      status = 'draft';
    } else if (data.publishOption === 'schedule') {
      status = 'scheduled';
    }
    
    const submissionData = prepareSubmissionData(data, status);
    
    if (editingAnnouncement) {
      updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: submissionData });
    } else {
      createAnnouncementMutation.mutate(submissionData);
    }
  };

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    
    const targetRoles = safeJsonParse(announcement.targetRoles, ['All']);
    const targetClasses = safeJsonParse(announcement.targetClasses, []);
    const attachments = safeJsonParse(announcement.attachments, []);
    const notificationSettings = safeJsonParse(announcement.notificationSettings, { inApp: true, email: false, sms: false });
    
    setValue('title', announcement.title);
    setValue('content', announcement.content);
    setValue('authorId', announcement.authorId || '');
    setValue('targetRoles', targetRoles);
    setValue('targetClasses', targetClasses);
    setValue('priority', announcement.priority || 'normal');
    setValue('announcementType', announcement.announcementType || 'general');
    setValue('publishOption', announcement.scheduledAt ? 'schedule' : 'now');
    setValue('scheduledAt', announcement.scheduledAt ? new Date(announcement.scheduledAt).toISOString().slice(0, 16) : '');
    setValue('expiryDate', announcement.expiryDate ? new Date(announcement.expiryDate).toISOString().slice(0, 16) : '');
    setValue('attachments', attachments);
    setValue('coverImageUrl', announcement.coverImageUrl || '');
    setValue('notificationSettings', notificationSettings);
    setValue('allowComments', announcement.allowComments || false);
    setValue('allowEdit', announcement.allowEdit ?? true);
    
    setIsDialogOpen(true);
    setActiveTab('content');
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAnnouncement(null);
    setPreviewMode(false);
    setActiveTab('content');
    reset();
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    const currentRoles = watchedValues.targetRoles || [];
    if (checked) {
      if (role === 'All') {
        setValue('targetRoles', ['All']);
      } else {
        const newRoles = currentRoles.filter(r => r !== 'All');
        setValue('targetRoles', [...newRoles, role]);
      }
    } else {
      const newRoles = currentRoles.filter(r => r !== role);
      setValue('targetRoles', newRoles.length > 0 ? newRoles : ['All']);
    }
  };

  const handleClassToggle = (classId: string, checked: boolean) => {
    const currentClasses = watchedValues.targetClasses || [];
    if (checked) {
      setValue('targetClasses', [...currentClasses, classId]);
    } else {
      setValue('targetClasses', currentClasses.filter(c => c !== classId));
    }
  };

  const filteredAnnouncements = announcements.filter((announcement: any) => {
    const matchesSearch = !searchTerm || 
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const announcementRoles = safeJsonParse(announcement.targetRoles, ['All']);
    
    const matchesRole = selectedRole === 'all' || announcementRoles.includes(selectedRole);
    
    const matchesPriority = selectedPriority === 'all' || announcement.priority === selectedPriority;
    
    const status = announcement.status || (announcement.isPublished ? 'published' : 'draft');
    const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
    
    return matchesSearch && matchesRole && matchesPriority && matchesStatus;
  });

  const availableRoles = ['All', 'Student', 'Teacher', 'Parent', 'Admin'];

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal;
    const Icon = config.icon;
    return (
      <Badge variant={config.badgeVariant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.general;
    const Icon = config.icon;
    return (
      <div className={`flex items-center gap-1 text-sm ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </div>
    );
  };

  const getStatusBadge = (announcement: any) => {
    const status = announcement.status || (announcement.isPublished ? 'published' : 'draft');
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'secondary' },
      scheduled: { label: 'Scheduled', variant: 'outline' },
      published: { label: 'Published', variant: 'default' },
      expired: { label: 'Expired', variant: 'destructive' },
      archived: { label: 'Archived', variant: 'secondary' },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="announcements-management">
      <PageHeader
        icon={Megaphone}
        title="Announcements Management"
        description="Create and manage school-wide announcements"
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 px-3 rounded-md"
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List className="w-4 h-4 mr-2" />
              Table
            </Button>
            <Button 
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 px-3 rounded-md"
              onClick={() => setViewMode('cards')}
              title="Live Card View"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Cards
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none" data-testid="button-add-announcement">
                <Plus className="w-4 h-4 mr-2" />
                Add Announcement
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-xl font-semibold">
                  {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
                </DialogTitle>
                <Button
                  type="button"
                  variant={previewMode ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setPreviewMode(!previewMode)}
                  data-testid="button-toggle-preview"
                  className="h-8 w-8"
                  title={previewMode ? 'Edit Content' : 'Preview Announcement'}
                >
                  {previewMode ? <Edit className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </DialogHeader>

            {previewMode ? (
              <ScrollArea className="h-[70vh] px-6 pb-6">
                <div className="mt-4 border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(watchedValues.priority || 'normal')}
                      {getTypeBadge(watchedValues.announcementType || 'general')}
                    </div>
                    <Badge variant="outline">
                      {watchedValues.publishOption === 'schedule' ? 'Scheduled' : 'Immediate'}
                    </Badge>
                  </div>
                  
                  {watchedValues.coverImageUrl && (
                    <div className="w-full h-48 rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={watchedValues.coverImageUrl} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <h2 className="text-2xl font-bold">{watchedValues.title || 'Announcement Title'}</h2>
                  
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {(watchedValues.targetRoles || []).join(', ')}
                    </span>
                    {watchedValues.expiryDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Expires: {new Date(watchedValues.expiryDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                    {watchedValues.content || 'Announcement content will appear here...'}
                  </div>
                  
                  {(watchedValues.attachments?.length || 0) > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        Attachments ({watchedValues.attachments?.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {watchedValues.attachments?.map((url, idx) => (
                          <Badge key={idx} variant="outline">{url.split('/').pop()}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      {watchedValues.notificationSettings?.inApp && (
                        <span className="flex items-center gap-1"><Bell className="w-4 h-4" /> In-App</span>
                      )}
                      {watchedValues.notificationSettings?.email && (
                        <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> Email</span>
                      )}
                      {watchedValues.notificationSettings?.sms && (
                        <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> SMS</span>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <form onSubmit={handleSubmit((data) => onSubmit(data, false))}>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="px-6">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
                      <TabsTrigger value="audience" data-testid="tab-audience">Audience</TabsTrigger>
                      <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
                      <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
                    </TabsList>
                  </div>

                  <ScrollArea className="h-[55vh] px-6 mt-4">
                    <TabsContent value="content" className="space-y-4 mt-0">
                      <div>
                        <Label htmlFor="title">Title *</Label>
                        <Input 
                          id="title" 
                          {...register('title')} 
                          placeholder="e.g., Mid-Term Break Notice"
                          data-testid="input-title"
                        />
                        {errors.title && (
                          <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="content">Message / Body *</Label>
                        <Textarea 
                          id="content" 
                          {...register('content')} 
                          placeholder="Write your announcement content here... Supports paragraphs and bullet points."
                          rows={8}
                          className="min-h-[200px]"
                          data-testid="textarea-content"
                        />
                        {errors.content && (
                          <p className="text-sm text-destructive mt-1">{errors.content.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Tip: Use line breaks for paragraphs. Start lines with - or * for bullet points.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Priority Level</Label>
                          <Controller
                            name="priority"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger data-testid="select-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="normal">
                                    <div className="flex items-center gap-2">
                                      <Info className="w-4 h-4 text-primary" />
                                      Normal
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="important">
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-amber-500" />
                                      Important
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="urgent">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 text-red-500" />
                                      Urgent
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div>
                          <Label>Announcement Type</Label>
                          <Controller
                            name="announcementType"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger data-testid="select-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      General
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="academic">
                                    <div className="flex items-center gap-2">
                                      <GraduationCap className="w-4 h-4" />
                                      Academic
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="examination">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      Examination
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="event">
                                    <div className="flex items-center gap-2">
                                      <PartyPopper className="w-4 h-4" />
                                      Event
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="emergency">
                                    <div className="flex items-center gap-2">
                                      <Siren className="w-4 h-4" />
                                      Emergency
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Cover Image (Optional)</Label>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            {...register('coverImageUrl')}
                            placeholder="Enter image URL or upload"
                            data-testid="input-cover-image"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => coverImageInputRef.current?.click()}>
                            <Image className="w-4 h-4" />
                          </Button>
                          <input 
                            type="file" 
                            ref={coverImageInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                toast({ title: "Info", description: "File upload will be available soon. Please use a URL for now." });
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4" />
                          Attachments (URLs)
                        </Label>
                        <div className="mt-2 flex gap-2">
                          <Input 
                            id="new-attachment-url"
                            placeholder="https://example.com/file.pdf"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const url = input.value.trim();
                                if (url) {
                                  const current = getValues('attachments') || [];
                                  setValue('attachments', [...current, url]);
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="secondary"
                            onClick={() => {
                              const input = document.getElementById('new-attachment-url') as HTMLInputElement;
                              const url = input?.value.trim();
                              if (url) {
                                const current = getValues('attachments') || [];
                                setValue('attachments', [...current, url]);
                                input.value = '';
                              }
                            }}
                          >
                            Add Link
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Paste a link and press Enter or click Add.
                        </p>

                        {(watchedValues.attachments?.length || 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {watchedValues.attachments?.map((url, idx) => (
                              <Badge key={idx} variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 dark:bg-primary/5 text-primary dark:text-primary/60 border-primary/20 dark:border-primary/30">
                                <FileText className="w-3 h-3" />
                                <span className="max-w-[150px] truncate">{url.split('/').pop() || url}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newAttachments = watchedValues.attachments?.filter((_, i) => i !== idx);
                                    setValue('attachments', newAttachments || []);
                                  }}
                                  className="ml-1 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="audience" className="space-y-4 mt-0">
                      <div>
                        <Label htmlFor="authorId">Posted By</Label>
                        <div className="mt-1 p-3 bg-muted rounded-lg flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Loading...'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {currentUser?.role || 'Admin'}
                            </p>
                          </div>
                        </div>
                        <input type="hidden" {...register('authorId')} />
                      </div>

                      <div>
                        <Label>Target Audience *</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Select who should see this announcement
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {availableRoles.map((role) => {
                            const isSelected = (watchedValues.targetRoles || []).includes(role);
                            return (
                              <button
                                type="button"
                                key={role}
                                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
                                  isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                                onClick={() => handleRoleToggle(role, !isSelected)}
                                data-testid={`checkbox-role-${role.toLowerCase()}`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected 
                                    ? 'bg-primary border-primary' 
                                    : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{role === 'All' ? 'All Users' : `${role}s`}</span>
                              </div>
                              </button>
                            );
                          })}
                        </div>
                        {errors.targetRoles && (
                          <p className="text-sm text-destructive mt-1">{errors.targetRoles.message}</p>
                        )}
                      </div>

                      {!(watchedValues.targetRoles || []).includes('All') && 
                       ((watchedValues.targetRoles || []).includes('Student') || (watchedValues.targetRoles || []).includes('Parent')) && (
                        <div>
                          <Label>Specific Classes (Optional)</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Optionally target specific classes. Leave empty for all classes.
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                            {classes.map((cls: any) => {
                              const isClassSelected = (watchedValues.targetClasses || []).includes(String(cls.id));
                              return (
                                <button
                                  type="button"
                                  key={cls.id}
                                  className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors text-sm text-left ${
                                    isClassSelected
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                                  onClick={() => handleClassToggle(String(cls.id), !isClassSelected)}
                                  data-testid={`checkbox-class-${cls.id}`}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                                    isClassSelected 
                                      ? 'bg-primary border-primary' 
                                      : 'border-muted-foreground/30'
                                  }`}>
                                    {isClassSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                  </div>
                                  <span>{cls.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-4 mt-0">
                      <div>
                        <Label>Publish Option</Label>
                        <Controller
                          name="publishOption"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div
                                className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                                  field.value === 'now'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => field.onChange('now')}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 ${field.value === 'now' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                <div>
                                  <p className="font-medium">Publish Now</p>
                                  <p className="text-sm text-muted-foreground">Immediately visible to audience</p>
                                </div>
                              </div>
                              <div
                                className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                                  field.value === 'schedule'
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => field.onChange('schedule')}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 ${field.value === 'schedule' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                <div>
                                  <p className="font-medium">Schedule for Later</p>
                                  <p className="text-sm text-muted-foreground">Choose date and time</p>
                                </div>
                              </div>
                            </div>
                          )}
                        />
                      </div>

                      {publishOption === 'schedule' && (
                        <div>
                          <Label htmlFor="scheduledAt">Scheduled Date & Time</Label>
                          <Input
                            type="datetime-local"
                            id="scheduledAt"
                            {...register('scheduledAt')}
                            min={new Date().toISOString().slice(0, 16)}
                            data-testid="input-scheduled-at"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
                        <Input
                          type="datetime-local"
                          id="expiryDate"
                          {...register('expiryDate')}
                          min={new Date().toISOString().slice(0, 16)}
                          data-testid="input-expiry-date"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Announcement will automatically stop showing after this date
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4 mt-0">
                      <div>
                        <Label className="text-base font-semibold">Notification Settings</Label>
                        <p className="text-sm text-muted-foreground mb-3">
                          Choose how to notify the target audience
                        </p>
                        <div className="space-y-3">
                          <Controller
                            name="notificationSettings.inApp"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <Bell className="w-5 h-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">In-App Notification</p>
                                    <p className="text-sm text-muted-foreground">Show notification in the app</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-notify-inapp"
                                />
                              </div>
                            )}
                          />
                          <Controller
                            name="notificationSettings.email"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <Mail className="w-5 h-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">Email Notification</p>
                                    <p className="text-sm text-muted-foreground">Send email to recipients</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-notify-email"
                                />
                              </div>
                            )}
                          />
                          <Controller
                            name="notificationSettings.sms"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">SMS Notification</p>
                                    <p className="text-sm text-muted-foreground">Send SMS to recipients (if supported)</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-notify-sms"
                                />
                              </div>
                            )}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-base font-semibold">Advanced Options</Label>
                        <div className="space-y-3 mt-3">
                          <Controller
                            name="allowComments"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div>
                                  <p className="font-medium">Allow Comments</p>
                                  <p className="text-sm text-muted-foreground">Let users comment on this announcement</p>
                                </div>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-allow-comments"
                                />
                              </div>
                            )}
                          />
                          <Controller
                            name="allowEdit"
                            control={control}
                            render={({ field }) => (
                              <div className="flex items-center justify-between p-3 rounded-lg border">
                                <div>
                                  <p className="font-medium">Allow Edit After Publishing</p>
                                  <p className="text-sm text-muted-foreground">Can edit after it's published</p>
                                </div>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-allow-edit"
                                />
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>

                <div className="flex items-center gap-2 p-6 pt-2 border-t mt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                    data-testid="button-publish-announcement"
                  >
                    {(createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending) ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {watchedValues.publishOption === 'schedule' ? 'Schedule' : 'Publish'}
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => {
                      const data = getValues();
                      onSubmit(data, true);
                    }}
                    disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
                    data-testid="button-save-draft"
                    title="Save as Draft"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search announcements by title or content..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-role-filter">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[160px] col-span-2" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Announcements ({filteredAnnouncements.length})</span>
            <Badge variant="secondary" data-testid="text-total-announcements">
              Total: {announcements.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className={viewMode === 'cards' ? "bg-gray-50/30 dark:bg-gray-900/10 p-6" : ""}>
          {loadingAnnouncements ? (
            <div className={viewMode === 'table' ? "" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
              {viewMode === 'table' ? (
                <div className="space-y-4 p-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
                    <div className="h-40 bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <CardContent className="p-5 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <div className="flex justify-between items-center pt-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-md border-0 sm:border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hidden sm:table-row">
                    <TableHead className="w-[45%]">Announcement</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnnouncements.length > 0 ? (
                    filteredAnnouncements.map((announcement: any) => {
                      const targetRoles = safeJsonParse(announcement.targetRoles, ['All']);
                      const isCurrentUserAuthor = currentUser?.id === announcement.authorId;
                      
                      return (
                        <TableRow key={announcement.id} data-testid={`row-announcement-${announcement.id}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div className="flex items-start space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                announcement.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                                announcement.priority === 'important' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                                'bg-primary/10 dark:bg-primary/5 text-primary'
                              }`}>
                                <Megaphone className="w-5 h-5" />
                              </div>
                              <div className="max-w-md">
                                <div className="font-semibold text-gray-900 dark:text-white line-clamp-1" data-testid={`text-announcement-title-${announcement.id}`}>
                                  {announcement.title}
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                  {announcement.content}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  <span>by {isCurrentUserAuthor && currentUser ? 'You' : (announcement.authorName || 'School Admin')}</span>
                                  <span className="mx-1">•</span>
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getPriorityBadge(announcement.priority || 'normal')}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getTypeBadge(announcement.announcementType || 'general')}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell" data-testid={`text-roles-${announcement.id}`}>
                            <div className="flex flex-wrap gap-1">
                              {targetRoles.slice(0, 2).map((role: string) => (
                                <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                  {role}
                                </Badge>
                              ))}
                              {targetRoles.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                  +{targetRoles.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getStatusBadge(announcement)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Eye className="w-4 h-4" />
                              {announcement.viewCount || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  data-testid={`button-actions-announcement-${announcement.id}`}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEdit(announcement)}
                                  data-testid={`button-edit-announcement-${announcement.id}`}
                                >
                                  <Edit className="w-3.5 h-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setAnnouncementToDelete(announcement)}
                                  data-testid={`button-delete-announcement-${announcement.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Search className="w-8 h-8 mb-2 opacity-20" />
                          <p>No announcements found matching your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAnnouncements.length > 0 ? (
                filteredAnnouncements.map((announcement: any) => {
                  const priority = (announcement.priority || 'normal') as 'urgent' | 'important' | 'normal';
                  const pConfig = {
                    urgent: { label: 'Urgent', border: 'border-l-red-500', bg: 'bg-red-50/50 dark:bg-red-900/10', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
                    important: { label: 'Important', border: 'border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/10', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                    normal: { label: 'General', border: 'border-l-primary/60', bg: 'bg-white dark:bg-gray-900', badge: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60' }
                  }[priority];

                  return (
                    <Card key={announcement.id} className={`overflow-hidden border-2 border-gray-100 dark:border-gray-800 transition-all hover:shadow-md border-l-4 ${pConfig.border} flex flex-col rounded-xl group`}>
                      {announcement.coverImageUrl && (
                        <div className="h-40 overflow-hidden bg-muted relative">
                          <img 
                            src={announcement.coverImageUrl} 
                            alt={announcement.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                          />
                          <div className="absolute top-3 right-3">
                            <Badge className={`${pConfig.badge} border-none shadow-sm`}>{pConfig.label}</Badge>
                          </div>
                        </div>
                      )}
                      
                      <CardContent className={`p-5 flex-1 flex flex-col ${!announcement.coverImageUrl ? pConfig.bg : ''}`}>
                        {!announcement.coverImageUrl && (
                          <div className="flex justify-between items-start mb-3">
                            <Badge className={`${pConfig.badge} border-none shadow-sm font-medium`}>{pConfig.label}</Badge>
                            <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                              {getTypeBadge(announcement.announcementType || 'general')}
                            </div>
                          </div>
                        )}
                        
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">
                          {announcement.title}
                        </h3>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4 flex-1">
                          {announcement.content}
                        </p>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(announcement.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1.5 font-medium">
                              <Users className="w-3.5 h-3.5" />
                              Target: {safeJsonParse(announcement.targetRoles, ['All'])[0]}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 text-xs font-semibold rounded-lg"
                              onClick={() => handleEdit(announcement)}
                            >
                              <Edit className="w-3 h-3 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 h-8 text-xs font-semibold rounded-lg"
                              onClick={() => setAnnouncementToDelete(announcement)}
                            >
                              <Trash2 className="w-3 h-3 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground/40 bg-white/50 dark:bg-gray-900/50">
                  <Megaphone className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-lg font-medium opacity-60">No announcements to display</p>
                  <p className="text-sm">Switch to Table view or try different filters</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {announcementToDelete && (
        <Dialog open={!!announcementToDelete} onOpenChange={() => setAnnouncementToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete <strong>{announcementToDelete.title}</strong>? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setAnnouncementToDelete(null)}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteAnnouncementMutation.mutate(announcementToDelete.id)}
                  disabled={deleteAnnouncementMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteAnnouncementMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}