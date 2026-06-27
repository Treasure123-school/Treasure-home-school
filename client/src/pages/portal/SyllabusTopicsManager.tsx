import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Trash2, Edit, BookOpen, Layers, Globe, EyeOff, Filter, ChevronRight, MoreHorizontal, Loader2,
} from 'lucide-react';
import { PageHeader, MiniStatCard, MiniStatGrid } from '@/components/shared';

export default function SyllabusTopicsManager() {
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [topicToDelete, setTopicToDelete] = useState<any>(null);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');

  const [topicName, setTopicName] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [topicOrder, setTopicOrder] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');

  const filtersSet = !!(selectedClassId && selectedSubjectId && selectedTermId);

  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => (await apiRequest('GET', '/api/classes')).json(),
  });
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['/api/subjects'],
    queryFn: async () => (await apiRequest('GET', '/api/subjects')).json(),
  });
  const { currentTerm, allTerms: terms } = useAcademicCalendar();

  // Auto-select current term when it loads
  useEffect(() => {
    if (currentTerm && !selectedTermId) {
      setSelectedTermId(String(currentTerm.id));
    }
  }, [currentTerm, selectedTermId]);
  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<any[]>({
    queryKey: ['/api/class-subject-mappings', selectedClassId],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/class-subject-mappings/${selectedClassId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!selectedClassId,
  });
  const { data: stats } = useQuery({
    queryKey: ['/api/syllabus-topics/stats'],
    queryFn: async () => (await apiRequest('GET', '/api/syllabus-topics/stats')).json(),
  });
  const { data: topics = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['/api/syllabus-topics', selectedClassId, selectedSubjectId, selectedTermId],
    queryFn: async () => {
      const p = new URLSearchParams({ classId: selectedClassId, subjectId: selectedSubjectId, termId: selectedTermId });
      return (await apiRequest('GET', `/api/syllabus-topics?${p}`)).json();
    },
    enabled: filtersSet,
  });

  const subjects = selectedClassId
    ? allSubjects.filter((s: any) => mappings.some((m: any) => m.subjectId === s.id))
    : allSubjects;

  const publishedCount = (topics as any[]).filter((t: any) => t.isPublished).length;
  const draftCount = (topics as any[]).length - publishedCount;

  const resetForm = () => {
    setTopicName(''); setTopicDescription(''); setTopicOrder(''); setBulkTopics('');
    setIsDialogOpen(false); setEditingTopic(null); setAddMode('single');
  };

  const handleClassChange = (v: string) => { setSelectedClassId(v); setSelectedSubjectId(''); setSelectedTermId(''); };
  const handleEdit = (t: any) => {
    setEditingTopic(t); setTopicName(t.name); setTopicDescription(t.description || '');
    setTopicOrder(String(t.orderNumber || '')); setAddMode('single'); setIsDialogOpen(true);
  };

  const getClassName = (id: number) => (classes as any[]).find((c: any) => c.id === id)?.name || '—';
  const getSubjectName = (id: number) => (allSubjects as any[]).find((s: any) => s.id === id)?.name || '—';
  const getTermName = (id: number) => (terms as any[]).find((t: any) => t.id === id)?.name || '—';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
  };

  const topicsKey = () => ['/api/syllabus-topics', selectedClassId, selectedSubjectId, selectedTermId];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest('POST', '/api/syllabus-topics', data);
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || e.message || 'Failed'); }
      return r.json();
    },
    onMutate: async (data: any) => {
      const key = topicsKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const tempId = `_temp_${Date.now()}`;
      const optimistic = {
        id: tempId, name: data.name, description: data.description || null,
        orderNumber: data.orderNumber || 0, isPublished: false, _optimistic: true,
      };
      queryClient.setQueryData(key, (old: any[]) => [...(old ?? []), optimistic]);
      return { previous, key };
    },
    onSuccess: (created, _vars, ctx: any) => {
      // Replace temp item with real server item
      queryClient.setQueryData(ctx.key, (old: any[]) =>
        (old ?? []).map((t: any) => t._optimistic ? created : t)
      );
      toast({ title: 'Success', description: 'Topic created' });
      resetForm();
      // Background sync to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics/stats'] });
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest('POST', '/api/syllabus-topics/bulk', data);
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || e.message || 'Failed'); }
      return r.json();
    },
    onMutate: async (data: any) => {
      const key = topicsKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const names: string[] = data.topics ?? [];
      const optimisticItems = names.map((name, i) => ({
        id: `_temp_${Date.now()}_${i}`, name, description: null,
        orderNumber: i, isPublished: false, _optimistic: true,
      }));
      queryClient.setQueryData(key, (old: any[]) => [...(old ?? []), ...optimisticItems]);
      return { previous, key };
    },
    onSuccess: (_res, _vars, ctx: any) => {
      // Refetch to get real items (bulk response doesn't return full objects)
      queryClient.invalidateQueries({ queryKey: ctx.key });
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics/stats'] });
      toast({ title: 'Success', description: `${_res.created} topics created` });
      resetForm();
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await apiRequest('PUT', `/api/syllabus-topics/${id}`, data);
      if (!r.ok) throw new Error('Failed to update');
      return r.json();
    },
    onMutate: async ({ id, data }) => {
      const key = topicsKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: any[]) =>
        (old ?? []).map((t: any) => t.id === id ? { ...t, ...data } : t)
      );
      return { previous, key };
    },
    onSuccess: (updated, vars, ctx: any) => {
      queryClient.setQueryData(ctx.key, (old: any[]) =>
        (old ?? []).map((t: any) => t.id === vars.id ? { ...t, ...updated } : t)
      );
      toast({ title: 'Success', description: 'Topic updated' });
      resetForm();
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: number; isPublished: boolean }) => {
      const r = await apiRequest('PATCH', `/api/syllabus-topics/${id}/publish`, { isPublished });
      if (!r.ok) throw new Error('Failed to update visibility');
      return r.json();
    },
    onMutate: async ({ id, isPublished }) => {
      const key = ['/api/syllabus-topics', selectedClassId, selectedSubjectId, selectedTermId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: any[]) =>
        (old ?? []).map((t: any) => t.id === id ? { ...t, isPublished } : t)
      );
      return { previous, key };
    },
    onSuccess: (updated, vars, ctx: any) => {
      // Patch just this one item from server response — no full refetch needed
      queryClient.setQueryData(ctx.key, (old: any[]) =>
        (old ?? []).map((t: any) => t.id === vars.id ? { ...t, ...updated } : t)
      );
      toast({ title: 'Success', description: vars.isPublished ? 'Topic published to students' : 'Topic hidden from students' });
    },
    onError: (e: any, _, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
    // No onSettled invalidate — cache is kept in sync above, avoiding any refetch flicker
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('DELETE', `/api/syllabus-topics/${id}`);
      if (!r.ok) throw new Error('Failed to delete');
      return r.json();
    },
    onMutate: async (id: number) => {
      const key = topicsKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: any[]) => (old ?? []).filter((t: any) => t.id !== id));
      return { previous, key };
    },
    onSuccess: (_res, _id, ctx: any) => {
      toast({ title: 'Success', description: 'Topic deleted' });
      setTopicToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics/stats'] });
    },
    onError: (e: any, _id, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (addMode === 'bulk') {
      const names = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
      if (!names.length) return toast({ title: 'Error', description: 'Enter at least one topic', variant: 'destructive' });
      bulkMutation.mutate({ classId: +selectedClassId, subjectId: +selectedSubjectId, termId: +selectedTermId, topics: names });
    } else if (editingTopic) {
      if (!topicName.trim()) return toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      updateMutation.mutate({ id: editingTopic.id, data: { name: topicName.trim(), description: topicDescription || null, orderNumber: topicOrder ? +topicOrder : 0 } });
    } else {
      if (!topicName.trim()) return toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      createMutation.mutate({ classId: +selectedClassId, subjectId: +selectedSubjectId, termId: +selectedTermId, name: topicName.trim(), description: topicDescription || null, orderNumber: topicOrder ? +topicOrder : 0 });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || bulkMutation.isPending;

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Header */}
        <PageHeader
          title="Scheme of Work"
          description="Define and publish curriculum topics per class, subject, and term"
          icon={Layers}
          actions={filtersSet ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="w-full sm:w-auto shrink-0" data-testid="btn-add-topic">
              <Plus className="w-4 h-4 mr-1.5" /> Add Topics
            </Button>
          ) : undefined}
        />

        {/* Stat Cards */}
        <MiniStatGrid cols={4}>
          <MiniStatCard icon={Layers} label="Total Topics" value={stats?.total ?? '—'} color="text-primary" data-testid="stat-total-topics" />
          <MiniStatCard icon={Globe} label="Published" value={stats?.published ?? '—'} color="text-emerald-600" data-testid="stat-published" />
          <MiniStatCard icon={EyeOff} label="Drafts" value={stats?.draft ?? '—'} color="text-amber-600" data-testid="stat-drafts" />
          <MiniStatCard icon={BookOpen} label="Subjects" value={stats?.subjects ?? '—'} color="text-violet-600" data-testid="stat-subjects" />
        </MiniStatGrid>

        {/* Filter Card */}
        <SectionCard icon={Filter} title="Filter Context" subtitle="— select all three to load topics">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Class <span className="text-destructive">*</span></Label>
                <Select value={selectedClassId} onValueChange={handleClassChange}>
                  <SelectTrigger data-testid="select-class"><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {(classes as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject <span className="text-destructive">*</span></Label>
                {selectedClassId && mappingsLoading ? (
                  <div className="relative">
                    <Skeleton className="h-10 rounded-md w-full" />
                    <div className="absolute inset-0 flex items-center px-3 gap-2 pointer-events-none">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Loading subjects…</span>
                    </div>
                  </div>
                ) : (
                  <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={!selectedClassId}>
                    <SelectTrigger data-testid="select-subject"><SelectValue placeholder={!selectedClassId ? 'Select class first' : 'Select subject...'} /></SelectTrigger>
                    <SelectContent>
                      {(subjects as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Term <span className="text-destructive">*</span></Label>
                <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSubjectId}>
                  <SelectTrigger data-testid="select-term"><SelectValue placeholder={!selectedSubjectId ? 'Select subject first' : 'Select term...'} /></SelectTrigger>
                  <SelectContent>
                    {(terms as any[]).map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!filtersSet && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${selectedClassId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${selectedSubjectId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${selectedTermId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                <span className="ml-1">Class → Subject → Term</span>
              </div>
            )}
        </SectionCard>

        {/* Topics Card */}
        {filtersSet ? (
          <SectionCard
            icon={BookOpen}
            title={
              <>
                <span className="hidden sm:inline truncate max-w-xs">
                  {getClassName(+selectedClassId)} → {getSubjectName(+selectedSubjectId)} → {getTermName(+selectedTermId)}
                </span>
                <span className="sm:hidden">Topics</span>
              </>
            }
            rightContent={!loadingTopics && (topics as any[]).length > 0 ? (
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-xs">{(topics as any[]).length} total</Badge>
                {publishedCount > 0 && <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500">{publishedCount} published</Badge>}
                {draftCount > 0 && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">{draftCount} draft</Badge>}
              </div>
            ) : undefined}
            contentClassName="px-0 pb-0"
          >
              {loadingTopics ? (
                <div className="px-5 pb-5 space-y-2.5">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (topics as any[]).length === 0 ? (
                <div className="text-center py-14 px-5">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="font-medium text-sm">No topics yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs mx-auto">Add topics for this combination to build the scheme of work.</p>
                </div>
              ) : (
                <>
                  {/* ── Mobile card grid (hidden on sm+) ── */}
                  <div className="sm:hidden px-4 pb-4 grid grid-cols-1 gap-2.5">
                    {[...(topics as any[])]
                      .sort((a, b) => {
                        const wDiff = (a.weekNumber || 0) - (b.weekNumber || 0);
                        return wDiff !== 0 ? wDiff : (a.orderNumber || 0) - (b.orderNumber || 0);
                      })
                      .map((topic: any, idx: number) => (
                        <div
                          key={topic.id}
                          className="rounded-xl border bg-card p-3.5 flex gap-3 items-start"
                          data-testid={`topic-card-${topic.id}`}
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {topic.weekNumber > 0 ? topic.weekNumber : (topic.orderNumber || idx + 1)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm leading-snug">{topic.name}</p>
                            {topic.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{topic.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Switch
                                checked={!!topic.isPublished}
                                onCheckedChange={(checked) => publishMutation.mutate({ id: topic.id, isPublished: checked })}
                                data-testid={`switch-publish-${topic.id}`}
                              />
                              <span className={`text-xs font-medium ${topic.isPublished ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                {topic.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" data-testid={`btn-actions-${topic.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => handleEdit(topic)} data-testid={`btn-edit-${topic.id}`}>
                                <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setTopicToDelete(topic)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                data-testid={`btn-delete-${topic.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                  </div>

                  {/* ── Desktop table (hidden on mobile) ── */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12 pl-5">Wk</TableHead>
                          <TableHead>Topic Name</TableHead>
                          <TableHead className="hidden md:table-cell">Description</TableHead>
                          <TableHead className="w-36">Visibility</TableHead>
                          <TableHead className="w-12 pr-5 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...(topics as any[])]
                          .sort((a, b) => {
                            const wDiff = (a.weekNumber || 0) - (b.weekNumber || 0);
                            return wDiff !== 0 ? wDiff : (a.orderNumber || 0) - (b.orderNumber || 0);
                          })
                          .map((topic: any, idx: number) => (
                            <TableRow key={topic.id} data-testid={`topic-row-${topic.id}`}>
                              <TableCell className="pl-5 text-muted-foreground text-sm font-mono">{topic.weekNumber > 0 ? topic.weekNumber : (topic.orderNumber || idx + 1)}</TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{topic.name}</p>
                                {topic.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 md:hidden line-clamp-1">{topic.description}</p>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                                <span className="line-clamp-1">{topic.description || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!!topic.isPublished}
                                    onCheckedChange={(checked) => publishMutation.mutate({ id: topic.id, isPublished: checked })}
                                    data-testid={`switch-publish-${topic.id}`}
                                  />
                                  <span className={`text-xs font-medium ${topic.isPublished ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                    {topic.isPublished ? 'Published' : 'Draft'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="pr-5 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`btn-actions-${topic.id}`}>
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => handleEdit(topic)} data-testid={`btn-edit-${topic.id}`}>
                                      <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setTopicToDelete(topic)}
                                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                      data-testid={`btn-delete-${topic.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
          </SectionCard>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-sm font-semibold">Select Class, Subject & Term</h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Choose all three filters above to view and manage topics for that combination.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Add / Edit Dialog ──────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTopic ? 'Edit Topic' : 'Add Syllabus Topics'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {!editingTopic && (
              <div className="flex gap-2 pb-3 border-b">
                <Button variant={addMode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('single')}>Single</Button>
                <Button variant={addMode === 'bulk' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('bulk')}>Bulk Add</Button>
              </div>
            )}

            {(addMode === 'single' || editingTopic) ? (
              <>
                <div className="space-y-1.5">
                  <Label>Topic Name <span className="text-destructive">*</span></Label>
                  <Input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="e.g. Whole Numbers" data-testid="input-topic-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">Description <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <Textarea value={topicDescription} onChange={e => setTopicDescription(e.target.value)} placeholder="Brief overview of what this topic covers" rows={3} data-testid="input-topic-desc" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">Order <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                  <Input type="number" value={topicOrder} onChange={e => setTopicOrder(e.target.value)} placeholder="e.g. 1" data-testid="input-topic-order" />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Topics — one per line <span className="text-destructive">*</span></Label>
                <Textarea value={bulkTopics} onChange={e => setBulkTopics(e.target.value)} placeholder={"Whole Numbers\nFractions\nAlgebra\nGeometry\nStatistics"} rows={8} data-testid="input-bulk-topics" />
                <p className="text-xs text-muted-foreground">{bulkTopics.split('\n').filter(t => t.trim()).length} topics entered</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSaving} data-testid="btn-submit">
                {isSaving ? 'Saving…' : editingTopic ? 'Save Changes' : addMode === 'bulk' ? 'Add All Topics' : 'Add Topic'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────── */}
      <AlertDialog open={!!topicToDelete} onOpenChange={(open) => { if (!open) setTopicToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>"{topicToDelete?.name}"</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => topicToDelete && deleteMutation.mutate(topicToDelete.id)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
