import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, Plus, Search, Edit2, Trash2, Pin, Eye, Calendar,
  Users, AlertTriangle, Bell, Info, ChevronDown, ChevronUp,
  FileText, X, Filter, Clock
} from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  content: string;
  authorId: string;
  targetRoles: string;
  targetClasses: string;
  priority: string;
  announcementType: string;
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: string;
}

interface Class {
  id: number;
  name: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-l-red-500', icon: AlertTriangle },
  important: { label: 'Important', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-l-amber-500', icon: Bell },
  normal: { label: 'General', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50/60 dark:bg-blue-900/10', borderColor: 'border-l-blue-400', icon: Info },
};

const TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'examination', label: 'Examination' },
  { value: 'event', label: 'Event' },
  { value: 'emergency', label: 'Emergency' },
];

function parseJson(str: string | null | undefined, fallback: any[] = []): any[] {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function formatDate(str: string | null) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(str: string | null) {
  if (!str) return '—';
  const d = new Date(str);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface FormState {
  title: string;
  content: string;
  priority: string;
  announcementType: string;
  targetRoles: string[];
  targetClasses: string[];
  isPublished: boolean;
}

const DEFAULT_FORM: FormState = {
  title: '',
  content: '',
  priority: 'normal',
  announcementType: 'general',
  targetRoles: ['Student'],
  targetClasses: [],
  isPublished: true,
};

export default function TeacherAnnouncements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showFilters, setShowFilters] = useState(false);

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/admin/announcements'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/announcements?includeDrafts=true');
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/announcements', data);
      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setIsCreateOpen(false);
      setForm(DEFAULT_FORM);
      toast({ title: 'Announcement Created', description: 'Your announcement has been published.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create announcement.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/announcements/${id}`, data);
      if (!res.ok) throw new Error('Failed to update announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setEditingAnnouncement(null);
      setForm(DEFAULT_FORM);
      toast({ title: 'Announcement Updated', description: 'Your changes have been saved.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update announcement.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/announcements/${id}`);
      if (!res.ok) throw new Error('Failed to delete announcement');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setDeleteConfirmId(null);
      toast({ title: 'Deleted', description: 'Announcement removed.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete announcement.', variant: 'destructive' }),
  });

  const myAnnouncements = useMemo(() =>
    announcements.filter(a => a.authorId === user?.id || true),
    [announcements, user]
  );

  const filtered = useMemo(() => {
    let list = [...myAnnouncements];
    if (searchTerm) list = list.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.content.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterPriority !== 'all') list = list.filter(a => a.priority === filterPriority);
    if (filterType !== 'all') list = list.filter(a => a.announcementType === filterType);
    const pinned = list.filter(a => pinnedIds.has(a.id));
    const rest = list.filter(a => !pinnedIds.has(a.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...pinned, ...rest];
  }, [myAnnouncements, searchTerm, filterPriority, filterType, pinnedIds]);

  const handleOpenCreate = () => {
    setForm(DEFAULT_FORM);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      content: a.content,
      priority: a.priority,
      announcementType: a.announcementType,
      targetRoles: parseJson(a.targetRoles, ['Student']),
      targetClasses: parseJson(a.targetClasses, []),
      isPublished: a.isPublished,
    });
    setEditingAnnouncement(a);
  };

  const handleSubmit = () => {
    const payload = {
      title: form.title,
      content: form.content,
      priority: form.priority,
      announcementType: form.announcementType,
      targetRoles: form.targetRoles,
      targetClasses: form.targetClasses,
      isPublished: form.isPublished,
      status: form.isPublished ? 'published' : 'draft',
      publishedAt: form.isPublished ? new Date().toISOString() : null,
    };
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePin = (id: number) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isFormOpen = isCreateOpen || !!editingAnnouncement;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Announcements</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} announcement{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
          data-testid="button-create-announcement"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Announcement</span>
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm"
              data-testid="input-search-announcements"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(f => !f)}
            className={`rounded-xl gap-2 border-gray-200 dark:border-gray-700 ${showFilters ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600' : 'text-gray-600 dark:text-gray-400'}`}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-auto text-xs rounded-xl h-8 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-auto text-xs rounded-xl h-8 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPE_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterPriority !== 'all' || filterType !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterPriority('all'); setFilterType('all'); }}
                className="text-xs rounded-xl h-8 text-gray-500 gap-1"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Announcement List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Megaphone className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {searchTerm || filterPriority !== 'all' || filterType !== 'all' ? 'No matching announcements' : 'No announcements yet'}
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            {searchTerm || filterPriority !== 'all' || filterType !== 'all' ? 'Try adjusting your filters.' : 'Create your first announcement to get started.'}
          </p>
          {!searchTerm && filterPriority === 'all' && filterType === 'all' && (
            <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              New Announcement
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ann => {
            const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.normal;
            const PriorityIcon = cfg.icon;
            const isPinned = pinnedIds.has(ann.id);
            const isExpanded = expandedIds.has(ann.id);
            const targetRoles = parseJson(ann.targetRoles, ['All']);
            const targetClasses = parseJson(ann.targetClasses, []);
            const isOwn = ann.authorId === user.id;

            return (
              <div
                key={ann.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 border-l-4 ${cfg.borderColor} overflow-hidden transition-shadow hover:shadow-md`}
              >
                <div className="p-4">
                  {/* Row 1: Pin badge + title + badges */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {isPinned && (
                        <div className="flex-shrink-0 mt-0.5">
                          <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        </div>
                      )}
                      <h3 className={`text-sm font-semibold leading-snug truncate ${cfg.color}`}>{ann.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 border ${cfg.bgColor} ${cfg.color} capitalize`}
                      >
                        <PriorityIcon className="h-2.5 w-2.5 mr-1" />
                        {cfg.label}
                      </Badge>
                      {!ann.isPublished && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 text-gray-500 border-gray-300">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Content preview / full */}
                  <p className={`text-sm text-gray-600 dark:text-gray-400 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {ann.content}
                  </p>

                  {/* Row 3: Meta info */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateShort(ann.publishedAt ?? ann.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {targetClasses.length > 0 ? targetClasses.join(', ') : targetRoles.join(', ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {TYPE_OPTIONS.find(t => t.value === ann.announcementType)?.label ?? ann.announcementType}
                    </span>
                  </div>

                  {/* Row 4: Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => toggleExpand(ann.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                      data-testid={`button-expand-${ann.id}`}
                    >
                      {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" />Show less</> : <><Eye className="h-3.5 w-3.5" />Read more</>}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePin(ann.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                        title={isPinned ? 'Unpin' : 'Pin'}
                        data-testid={`button-pin-${ann.id}`}
                      >
                        <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-amber-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(ann)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Edit"
                        data-testid={`button-edit-${ann.id}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(ann.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                        data-testid={`button-delete-${ann.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setEditingAnnouncement(null); } }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Megaphone className="h-5 w-5 text-blue-600" />
              {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Title *</Label>
              <Input
                placeholder="Announcement title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="rounded-xl"
                data-testid="input-announcement-title"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Message / Content *</Label>
              <Textarea
                placeholder="Write the full announcement..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                className="rounded-xl resize-none"
                data-testid="input-announcement-content"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="rounded-xl" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Type</Label>
                <Select value={form.announcementType} onValueChange={v => setForm(f => ({ ...f, announcementType: v }))}>
                  <SelectTrigger className="rounded-xl" data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Target Audience</Label>
              <div className="flex flex-wrap gap-2">
                {['Student', 'Teacher', 'Parent', 'All'].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        targetRoles: f.targetRoles.includes(role)
                          ? f.targetRoles.filter(r => r !== role)
                          : [...f.targetRoles, role],
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                      form.targetRoles.includes(role)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                    data-testid={`button-target-${role.toLowerCase()}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {classes.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Target Classes (optional)</Label>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        const cn = cls.name;
                        setForm(f => ({
                          ...f,
                          targetClasses: f.targetClasses.includes(cn)
                            ? f.targetClasses.filter(c => c !== cn)
                            : [...f.targetClasses, cn],
                        }));
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                        form.targetClasses.includes(cls.name)
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-blue-200'
                      }`}
                      data-testid={`button-class-${cls.id}`}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isPublished: !f.isPublished }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isPublished ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                data-testid="toggle-publish"
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${form.isPublished ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {form.isPublished ? 'Publish immediately' : 'Save as draft'}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => { setIsCreateOpen(false); setEditingAnnouncement(null); }}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!form.title.trim() || !form.content.trim() || isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
                data-testid="button-submit-announcement"
              >
                <Megaphone className="h-4 w-4" />
                {isSubmitting ? 'Saving...' : editingAnnouncement ? 'Save Changes' : form.isPublished ? 'Publish' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Announcement
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Are you sure you want to delete this announcement? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
