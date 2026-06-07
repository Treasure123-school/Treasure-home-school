import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Calendar, MapPin, Clock, Filter, Search, X, ImageIcon, Tag, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EVENT_TYPES = [
  { value: 'event', label: 'General Event', color: '#3b82f6', bg: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60' },
  { value: 'exam', label: 'Exam', color: '#ef4444', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'holiday', label: 'Holiday', color: '#22c55e', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'sports', label: 'Sports', color: '#f97316', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'academic', label: 'Academic', color: '#8b5cf6', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'extracurricular', label: 'Extracurricular', color: '#ec4899', bg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
];

const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  isAllDay: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type EventFormData = z.infer<typeof eventSchema>;

interface SchoolEvent {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  imageUrl?: string;
  color?: string;
  isAllDay: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function EventsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const { data: events = [], isLoading } = useQuery<SchoolEvent[]>({
    queryKey: ['/api/admin/events'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/events');
      return res.json();
    },
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      eventType: 'event',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      location: '',
      imageUrl: '',
      isAllDay: true,
      isActive: true,
    },
  });

  const isAllDay = form.watch('isAllDay');

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const typeInfo = getTypeInfo(data.eventType);
      const res = await apiRequest('POST', '/api/admin/events', { ...data, color: typeInfo.color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({ title: 'Event created successfully' });
      setDialogOpen(false);
      form.reset();
    },
    onError: (err: any) => toast({ title: 'Failed to create event', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventFormData }) => {
      const typeInfo = getTypeInfo(data.eventType);
      const res = await apiRequest('PUT', `/api/admin/events/${id}`, { ...data, color: typeInfo.color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({ title: 'Event updated successfully' });
      setDialogOpen(false);
      setEditingEvent(null);
      form.reset();
    },
    onError: (err: any) => toast({ title: 'Failed to update event', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/admin/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({ title: 'Event deleted successfully' });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: 'Failed to delete event', description: err.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditingEvent(null);
    form.reset({ title: '', description: '', eventType: 'event', startDate: '', endDate: '', startTime: '', endTime: '', location: '', imageUrl: '', isAllDay: true, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (event: SchoolEvent) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      startDate: event.startDate,
      endDate: event.endDate || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      imageUrl: event.imageUrl || '',
      isAllDay: event.isAllDay,
      isActive: event.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: EventFormData) => {
    const cleaned = {
      ...data,
      endDate: data.endDate || undefined,
      startTime: data.isAllDay ? undefined : (data.startTime || undefined),
      endTime: data.isAllDay ? undefined : (data.endTime || undefined),
      location: data.location || undefined,
      imageUrl: data.imageUrl || undefined,
      description: data.description || undefined,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const filtered = events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || e.eventType === typeFilter;
    return matchSearch && matchType;
  });

  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isPast = (d: string) => {
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(d + 'T00:00:00') < today;
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage school events, holidays, exams and activities</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto" data-testid="button-add-event">
          <Plus className="w-4 h-4" /> Add Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-events"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-filter-type">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EVENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            data-testid="button-view-card"
          >Cards</button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            data-testid="button-view-list"
          >List</button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {EVENT_TYPES.map(t => {
          const count = events.filter(e => e.eventType === t.value).length;
          return (
            <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? 'all' : t.value)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${typeFilter === t.value ? 'ring-2 ring-primary' : ''}`}>
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className={`text-xs font-medium mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${t.bg}`}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Events */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No events found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new event</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => {
            const typeInfo = getTypeInfo(event.eventType);
            const past = isPast(event.startDate);
            return (
              <Card key={event.id} data-testid={`card-event-${event.id}`}
                className={`overflow-hidden hover:shadow-md transition-shadow ${past ? 'opacity-60' : ''} ${!event.isActive ? 'border-dashed' : ''}`}>
                {event.imageUrl && (
                  <div className="h-36 overflow-hidden bg-muted">
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="h-1" style={{ backgroundColor: typeInfo.color }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{event.title}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {!event.isActive && <EyeOff className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />}
                    </div>
                  </div>
                  <Badge className={`text-xs mb-3 ${typeInfo.bg}`} variant="secondary">{typeInfo.label}</Badge>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{formatDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}</span>
                    </div>
                    {!event.isAllDay && event.startTime && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(event)} data-testid={`button-edit-event-${event.id}`}>
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(event.id)} data-testid={`button-delete-event-${event.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(event => {
            const typeInfo = getTypeInfo(event.eventType);
            const past = isPast(event.startDate);
            return (
              <div key={event.id} data-testid={`row-event-${event.id}`}
                className={`flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow ${past ? 'opacity-60' : ''}`}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: typeInfo.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-foreground truncate">{event.title}</span>
                    {!event.isActive && <EyeOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <Badge className={`text-xs ${typeInfo.bg}`} variant="secondary">{typeInfo.label}</Badge>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.startDate)}</span>
                    {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(event)} data-testid={`button-edit-event-${event.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(event.id)} data-testid={`button-delete-event-${event.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingEvent(null); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Event Title *</FormLabel>
                    <FormControl><Input placeholder="e.g. Mid-Term Examinations" {...field} data-testid="input-event-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="eventType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g. School Hall" {...field} data-testid="input-event-location" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-event-start-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-event-end-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isAllDay" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                    <div>
                      <FormLabel className="text-sm font-medium">All Day Event</FormLabel>
                      <p className="text-xs text-muted-foreground">Toggle off to specify start and end times</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-all-day" />
                    </FormControl>
                  </FormItem>
                )} />
                {!isAllDay && (
                  <>
                    <FormField control={form.control} name="startTime" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl><Input type="time" {...field} data-testid="input-event-start-time" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="endTime" render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl><Input type="time" {...field} data-testid="input-event-end-time" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Image URL <span className="text-muted-foreground font-normal">(optional poster/banner)</span></FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} data-testid="input-event-image" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Provide details about this event..." rows={3} {...field} data-testid="textarea-event-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                    <div>
                      <FormLabel className="text-sm font-medium">Visible to Students & Parents</FormLabel>
                      <p className="text-xs text-muted-foreground">Published events are visible across all portals</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-event-active" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingEvent(null); form.reset(); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-event">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this event? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
