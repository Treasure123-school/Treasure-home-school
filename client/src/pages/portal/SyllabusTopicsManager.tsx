import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, BookOpen, Search, Layers, ArrowUpDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function SyllabusTopicsManager() {
    const { toast } = useToast();
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTermId, setSelectedTermId] = useState<string>('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [topicToDelete, setTopicToDelete] = useState<any>(null);
    const [bulkMode, setBulkMode] = useState(false);

    // Single topic form
    const [topicName, setTopicName] = useState('');
    const [topicDescription, setTopicDescription] = useState('');
    const [topicOrder, setTopicOrder] = useState('');
    // Bulk form
    const [bulkTopics, setBulkTopics] = useState('');

    // Fetch classes, subjects, terms
    const { data: classes = [] } = useQuery({
        queryKey: ['/api/classes'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/classes'); return r.json(); },
    });
    const { data: subjects = [] } = useQuery({
        queryKey: ['/api/subjects'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/subjects'); return r.json(); },
    });
    const { data: terms = [] } = useQuery({
        queryKey: ['/api/academic-terms'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/academic-terms'); return r.json(); },
    });

    // Fetch syllabus topics with filters
    const { data: topics = [], isLoading: loadingTopics } = useQuery({
        queryKey: ['/api/syllabus-topics', selectedClassId, selectedSubjectId, selectedTermId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedClassId) params.set('classId', selectedClassId);
            if (selectedSubjectId) params.set('subjectId', selectedSubjectId);
            if (selectedTermId) params.set('termId', selectedTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${params.toString()}`);
            return r.json();
        },
        enabled: !!(selectedClassId && selectedSubjectId && selectedTermId),
    });

    // Create topic mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/syllabus-topics', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to create topic'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Topic created successfully' });
            queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
            resetForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Bulk create
    const bulkCreateMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/syllabus-topics/bulk', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to create topics'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: 'Success', description: `${result.created} topics created` });
            if (result.errors?.length > 0) {
                toast({ title: 'Some errors', description: result.errors.join(', '), variant: 'destructive' });
            }
            queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
            resetForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Update topic
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const r = await apiRequest('PUT', `/api/syllabus-topics/${id}`, data);
            if (!r.ok) throw new Error('Failed to update topic');
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Topic updated' });
            queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
            resetForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Delete topic
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const r = await apiRequest('DELETE', `/api/syllabus-topics/${id}`);
            if (!r.ok) throw new Error('Failed to delete topic');
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Topic deleted' });
            queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
            setTopicToDelete(null);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const resetForm = () => {
        setTopicName(''); setTopicDescription(''); setTopicOrder('');
        setBulkTopics(''); setIsAddDialogOpen(false); setEditingTopic(null);
        setBulkMode(false);
    };

    const handleSubmit = () => {
        if (bulkMode) {
            const topicNames = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
            if (topicNames.length === 0) return toast({ title: 'Error', description: 'Enter at least one topic', variant: 'destructive' });
            bulkCreateMutation.mutate({
                classId: parseInt(selectedClassId), subjectId: parseInt(selectedSubjectId),
                termId: parseInt(selectedTermId), topics: topicNames,
            });
        } else if (editingTopic) {
            updateMutation.mutate({ id: editingTopic.id, data: { name: topicName, description: topicDescription || null, orderNumber: topicOrder ? parseInt(topicOrder) : 0 } });
        } else {
            if (!topicName.trim()) return toast({ title: 'Error', description: 'Topic name is required', variant: 'destructive' });
            createMutation.mutate({
                classId: parseInt(selectedClassId), subjectId: parseInt(selectedSubjectId),
                termId: parseInt(selectedTermId), name: topicName.trim(),
                description: topicDescription || null, orderNumber: topicOrder ? parseInt(topicOrder) : 0,
            });
        }
    };

    const handleEdit = (topic: any) => {
        setEditingTopic(topic);
        setTopicName(topic.name);
        setTopicDescription(topic.description || '');
        setTopicOrder(String(topic.orderNumber || ''));
        setBulkMode(false);
        setIsAddDialogOpen(true);
    };

    const getClassName = (id: number) => classes.find((c: any) => c.id === id)?.name || '—';
    const getSubjectName = (id: number) => subjects.find((s: any) => s.id === id)?.name || '—';
    const getTermName = (id: number) => terms.find((t: any) => t.id === id)?.name || '—';

    const filtersSet = selectedClassId && selectedSubjectId && selectedTermId;

    return (
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-7 h-7 text-primary" />
                        Syllabus Topics
                    </h1>
                    <p className="text-muted-foreground mt-1">Define curriculum topics for each Class → Subject → Term</p>
                </div>
                {filtersSet && (
                    <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Add Topics
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <Label>Class *</Label>
                            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                <SelectContent>
                                    {classes.map((c: any) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Subject *</Label>
                            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                <SelectContent>
                                    {subjects.map((s: any) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Term *</Label>
                            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                                <SelectContent>
                                    {terms.map((t: any) => (
                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Topics List */}
            {filtersSet ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Topics for {getClassName(parseInt(selectedClassId))} → {getSubjectName(parseInt(selectedSubjectId))} → {getTermName(parseInt(selectedTermId))}
                            </span>
                            <Badge variant="secondary">{topics.length} topics</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingTopics ? (
                            <div className="flex justify-center py-8 text-muted-foreground">Loading topics...</div>
                        ) : topics.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="text-muted-foreground">No syllabus topics defined yet for this combination.</p>
                                <Button className="mt-4" onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                                    <Plus className="w-4 h-4 mr-2" /> Add First Topic
                                </Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-16">#</TableHead>
                                        <TableHead>Topic Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-20">Status</TableHead>
                                        <TableHead className="w-28">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topics.map((topic: any, idx: number) => (
                                        <TableRow key={topic.id}>
                                            <TableCell className="text-muted-foreground">{topic.orderNumber || idx + 1}</TableCell>
                                            <TableCell className="font-medium">{topic.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{topic.description || '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant={topic.isActive ? 'default' : 'secondary'}>
                                                    {topic.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="sm" onClick={() => handleEdit(topic)}>
                                                        <Edit className="w-3 h-3" />
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => setTopicToDelete(topic)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Layers className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground">Select Class, Subject & Term</h3>
                        <p className="text-sm text-muted-foreground mt-1">Choose all three filters above to view and manage syllabus topics.</p>
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingTopic ? 'Edit Topic' : 'Add Syllabus Topics'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {!editingTopic && (
                            <div className="flex gap-2">
                                <Button variant={!bulkMode ? 'default' : 'outline'} size="sm" onClick={() => setBulkMode(false)}>
                                    Single Topic
                                </Button>
                                <Button variant={bulkMode ? 'default' : 'outline'} size="sm" onClick={() => setBulkMode(true)}>
                                    Bulk Add
                                </Button>
                            </div>
                        )}

                        {bulkMode ? (
                            <div>
                                <Label>Topics (one per line)</Label>
                                <Textarea
                                    value={bulkTopics}
                                    onChange={(e) => setBulkTopics(e.target.value)}
                                    placeholder={"Nouns\nVerbs\nComprehension\nPoetry\nSpeech Writing"}
                                    rows={8}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Enter each topic name on a new line. Order numbers will be assigned automatically.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label>Topic Name *</Label>
                                    <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="e.g., Nouns" />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Input value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)} placeholder="Brief description (optional)" />
                                </div>
                                <div>
                                    <Label>Order Number</Label>
                                    <Input type="number" value={topicOrder} onChange={(e) => setTopicOrder(e.target.value)} placeholder="e.g., 1" />
                                </div>
                            </>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={createMutation.isPending || bulkCreateMutation.isPending || updateMutation.isPending}
                            >
                                {(createMutation.isPending || bulkCreateMutation.isPending || updateMutation.isPending) ? 'Saving...' :
                                    editingTopic ? 'Update Topic' : bulkMode ? 'Add All Topics' : 'Add Topic'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            {topicToDelete && (
                <Dialog open={!!topicToDelete} onOpenChange={() => setTopicToDelete(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Delete Topic</DialogTitle></DialogHeader>
                        <p>Are you sure you want to delete <strong>{topicToDelete.name}</strong>? This cannot be undone.</p>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setTopicToDelete(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => deleteMutation.mutate(topicToDelete.id)} disabled={deleteMutation.isPending}>
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
