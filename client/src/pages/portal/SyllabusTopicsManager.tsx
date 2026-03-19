import { useState, useRef } from 'react';
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
import { Plus, Trash2, Edit, BookOpen, Layers, Upload, Download, FileUp, AlertTriangle, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function SyllabusTopicsManager() {
    const { toast } = useToast();
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTermId, setSelectedTermId] = useState<string>('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [topicToDelete, setTopicToDelete] = useState<any>(null);
    const [addMode, setAddMode] = useState<'single' | 'bulk' | 'csv'>('single');

    // Single topic form
    const [topicName, setTopicName] = useState('');
    const [topicDescription, setTopicDescription] = useState('');
    const [topicOrder, setTopicOrder] = useState('');
    // Bulk form
    const [bulkTopics, setBulkTopics] = useState('');
    // CSV state
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ═══ REFERENCE DATA ═══
    const { data: classes = [] } = useQuery({
        queryKey: ['/api/classes'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/classes'); return r.json(); },
    });
    const { data: allSubjects = [] } = useQuery({
        queryKey: ['/api/subjects'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/subjects'); return r.json(); },
    });
    const { data: terms = [] } = useQuery({
        queryKey: ['/api/terms'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/terms'); return r.json(); },
    });

    // ═══ SUBJECT CASCADING — filter by class-subject mappings ═══
    const { data: classSubjectMappings = [] } = useQuery<any[]>({
        queryKey: ['/api/class-subject-mappings', selectedClassId],
        queryFn: async () => {
            const r = await apiRequest('GET', `/api/class-subject-mappings/${selectedClassId}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!selectedClassId,
    });

    // Filtered subjects based on selected class
    const subjects = selectedClassId
        ? allSubjects.filter((s: any) => classSubjectMappings.some((m: any) => m.subjectId === s.id))
        : allSubjects;

    // ═══ CASCADING RESETS ═══
    const handleClassChange = (v: string) => {
        setSelectedClassId(v);
        setSelectedSubjectId('');
        setSelectedTermId('');
    };
    const handleSubjectChange = (v: string) => {
        setSelectedSubjectId(v);
        // Don't reset term — it's independent of subject
    };

    // ═══ TOPICS QUERY ═══
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

    // ═══ MUTATIONS ═══
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

    const csvUploadMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/syllabus-topics/bulk-csv', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to upload topics'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: '✓ CSV Upload Complete', description: `${result.created} topics created.${result.errors?.length ? ` ${result.errors.length} failed.` : ''}` });
            queryClient.invalidateQueries({ queryKey: ['/api/syllabus-topics'] });
            if (!result.errors?.length) {
                resetForm();
            } else {
                setCsvErrors(result.errors);
            }
        },
        onError: (e: any) => toast({ title: 'Upload Error', description: e.message, variant: 'destructive' }),
    });

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

    // ═══ HELPERS ═══
    const resetForm = () => {
        setTopicName(''); setTopicDescription(''); setTopicOrder('');
        setBulkTopics(''); setCsvPreview([]); setCsvErrors([]);
        setIsAddDialogOpen(false); setEditingTopic(null);
        setAddMode('single');
    };

    const handleSubmit = () => {
        // Validate filters are set for single/bulk modes (not CSV — CSV carries its own IDs)
        if (addMode !== 'csv' && !editingTopic) {
            if (!selectedClassId || !selectedSubjectId || !selectedTermId) {
                return toast({ title: 'Error', description: 'Please select Class, Subject, and Term from the filters first', variant: 'destructive' });
            }
        }

        if (addMode === 'bulk') {
            const topicNames = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
            if (topicNames.length === 0) return toast({ title: 'Error', description: 'Enter at least one topic', variant: 'destructive' });
            bulkCreateMutation.mutate({
                classId: parseInt(selectedClassId), subjectId: parseInt(selectedSubjectId),
                termId: parseInt(selectedTermId), topics: topicNames,
            });
        } else if (addMode === 'csv') {
            if (csvPreview.length === 0) return toast({ title: 'Error', description: 'No valid topics to upload', variant: 'destructive' });
            csvUploadMutation.mutate({ topics: csvPreview });
        } else if (editingTopic) {
            if (!topicName.trim()) return toast({ title: 'Error', description: 'Topic name is required', variant: 'destructive' });
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
        setAddMode('single');
        setIsAddDialogOpen(true);
    };

    const getClassName = (id: number) => classes.find((c: any) => c.id === id)?.name || '—';
    const getSubjectName = (id: number) => allSubjects.find((s: any) => s.id === id)?.name || '—';
    const getTermName = (id: number) => terms.find((t: any) => t.id === id)?.name || '—';

    // ═══ CSV PARSING ═══
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
            else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
            else { current += ch; }
        }
        result.push(current.trim());
        return result;
    };

    const handleCSVFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';
        if (!file.name.toLowerCase().endsWith('.csv')) {
            return toast({ title: 'Invalid File', description: 'Please select a .csv file', variant: 'destructive' });
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target?.result as string;
                const lines = csv.trim().split('\n').filter(l => l.trim());
                if (lines.length < 2) throw new Error('CSV needs header + at least one row');
                const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
                const topics: any[] = []; const errors: string[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    const get = (name: string) => {
                        const idx = headers.indexOf(name.toLowerCase());
                        return idx >= 0 ? row[idx]?.trim() : '';
                    };

                    const className = get('class');
                    const subjectName = get('subject');
                    const termName = get('term');
                    const topicName = get('topic');

                    if (!topicName || topicName.length < 2) { errors.push(`Row ${i + 1}: Topic name too short`); continue; }

                    // Resolve names to IDs
                    const classMatch = classes.find((c: any) => c.name.toLowerCase() === className.toLowerCase());
                    if (!classMatch && className) { errors.push(`Row ${i + 1}: Class "${className}" not found`); continue; }

                    const subjectMatch = allSubjects.find((s: any) => s.name.toLowerCase() === subjectName.toLowerCase());
                    if (!subjectMatch && subjectName) { errors.push(`Row ${i + 1}: Subject "${subjectName}" not found`); continue; }

                    const termMatch = terms.find((t: any) => t.name.toLowerCase() === termName.toLowerCase());
                    if (!termMatch && termName) { errors.push(`Row ${i + 1}: Term "${termName}" not found`); continue; }

                    topics.push({
                        classId: classMatch?.id || parseInt(selectedClassId),
                        subjectId: subjectMatch?.id || parseInt(selectedSubjectId),
                        termId: termMatch?.id || parseInt(selectedTermId),
                        name: topicName,
                        description: get('description') || null,
                        orderNumber: parseInt(get('order')) || 0,
                        // Display fields for preview
                        _className: classMatch?.name || className,
                        _subjectName: subjectMatch?.name || subjectName,
                        _termName: termMatch?.name || termName,
                    });
                }
                setCsvPreview(topics);
                setCsvErrors(errors);
                if (topics.length === 0 && errors.length > 0) {
                    toast({ title: 'All rows failed', description: errors.slice(0, 3).join('; '), variant: 'destructive' });
                }
            } catch (err: any) {
                toast({ title: 'Parse Error', description: err.message, variant: 'destructive' });
            }
        };
        reader.readAsText(file);
    };

    const downloadCSVTemplate = () => {
        const csv = `Class,Subject,Term,Topic,Description,Order
"JSS1","Mathematics","First Term","Whole Numbers","Understanding whole numbers and place values",1
"JSS1","Mathematics","First Term","Factors and Multiples","LCM and HCF of numbers",2
"JSS1","Mathematics","First Term","Fractions","Proper, improper fractions and mixed numbers",3
"JSS1","English","First Term","Nouns","Types of nouns and usage",1
"JSS1","English","First Term","Verbs","Action words and tenses",2
"JSS1","English","First Term","Comprehension","Reading and understanding passages",3`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'syllabus_topics_template.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: 'Template Downloaded', description: 'CSV template with Class, Subject, Term, Topic columns' });
    };

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
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setAddMode('csv'); setCsvPreview([]); setCsvErrors([]); setIsAddDialogOpen(true); }}>
                        <Upload className="w-4 h-4 mr-2" /> CSV Upload
                    </Button>
                    {filtersSet && (
                        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Add Topics
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Admin-managed topics:</strong> Only Admins can create, edit, or delete topics. Teachers select from these predefined topics when adding questions to the Question Bank.
                </div>
            </div>

            {/* Filters — Cascading: Class → Subject → Term */}
            <Card>
                <CardContent className="py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <Label>Class *</Label>
                            <Select value={selectedClassId} onValueChange={handleClassChange}>
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
                            <Select value={selectedSubjectId} onValueChange={handleSubjectChange} disabled={!selectedClassId}>
                                <SelectTrigger><SelectValue placeholder={!selectedClassId ? 'Select class first' : 'Select subject'} /></SelectTrigger>
                                <SelectContent>
                                    {subjects.map((s: any) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedClassId && subjects.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">No subjects mapped to this class. Check Class-Subject Assignments.</p>
                            )}
                        </div>
                        <div>
                            <Label>Term *</Label>
                            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSubjectId}>
                                <SelectTrigger><SelectValue placeholder={!selectedSubjectId ? 'Select subject first' : 'Select term'} /></SelectTrigger>
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
                        <p className="text-xs text-muted-foreground mt-3">Or use <strong>CSV Upload</strong> to add topics for multiple classes at once.</p>
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit/CSV Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingTopic ? 'Edit Topic' : 'Add Syllabus Topics'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Mode selector */}
                        {!editingTopic && (
                            <div className="flex gap-2 border-b pb-3">
                                <Button variant={addMode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('single')} disabled={!filtersSet}>
                                    Single Topic
                                </Button>
                                <Button variant={addMode === 'bulk' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('bulk')} disabled={!filtersSet}>
                                    Bulk Add
                                </Button>
                                <Button variant={addMode === 'csv' ? 'default' : 'outline'} size="sm" onClick={() => setAddMode('csv')}>
                                    <Upload className="w-3 h-3 mr-1" /> CSV Upload
                                </Button>
                            </div>
                        )}

                        {/* Warning when filters not set for single/bulk */}
                        {!editingTopic && addMode !== 'csv' && !filtersSet && (
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div className="text-sm text-amber-800 dark:text-amber-300">
                                    <strong>Select filters first:</strong> Close this dialog and select a Class, Subject, and Term from the filters above before adding topics. Or use <strong>CSV Upload</strong> to add topics with class/subject/term specified in the file.
                                </div>
                            </div>
                        )}

                        {/* ═══ CSV MODE ═══ */}
                        {addMode === 'csv' && (
                            <div className="space-y-4">
                                <div className="bg-muted/30 border rounded-lg p-3 text-xs space-y-1">
                                    <p className="font-medium">CSV Format: Class, Subject, Term, Topic, Description (optional), Order (optional)</p>
                                    <p className="text-muted-foreground">Class/Subject/Term names are matched to existing records. Upload topics for multiple classes and subjects at once!</p>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
                                        <Download className="w-4 h-4 mr-1" /> Download Template
                                    </Button>
                                    <label className="cursor-pointer">
                                        <Button variant="outline" size="sm" asChild>
                                            <span><FileUp className="w-4 h-4 mr-1" /> Choose CSV File</span>
                                        </Button>
                                        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
                                    </label>
                                </div>

                                {/* CSV Preview */}
                                {csvPreview.length > 0 && (
                                    <div className="border rounded-lg">
                                        <div className="p-2 bg-muted/50 flex items-center justify-between rounded-t-lg">
                                            <span className="text-sm font-medium">{csvPreview.length} topic{csvPreview.length !== 1 ? 's' : ''} ready</span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto divide-y">
                                            {csvPreview.slice(0, 15).map((t: any, i: number) => (
                                                <div key={i} className="p-2 text-xs flex items-center gap-2">
                                                    <Badge variant="outline" className="shrink-0 text-[10px]">{t._className}</Badge>
                                                    <Badge variant="secondary" className="shrink-0 text-[10px]">{t._subjectName}</Badge>
                                                    <Badge variant="secondary" className="shrink-0 text-[10px]">{t._termName}</Badge>
                                                    <span className="font-medium flex-1">{t.name}</span>
                                                </div>
                                            ))}
                                            {csvPreview.length > 15 && <div className="p-2 text-xs text-center text-muted-foreground">...and {csvPreview.length - 15} more</div>}
                                        </div>
                                    </div>
                                )}

                                {/* CSV Errors */}
                                {csvErrors.length > 0 && (
                                    <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                                        <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-1">
                                            <AlertTriangle className="w-4 h-4" /> {csvErrors.length} Error{csvErrors.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="max-h-24 overflow-y-auto space-y-1">
                                            {csvErrors.map((err, i) => <p key={i} className="text-xs text-destructive/80">{err}</p>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ BULK MODE ═══ */}
                        {addMode === 'bulk' && (
                            <div>
                                <Label>Topics (one per line)</Label>
                                <Textarea
                                    value={bulkTopics}
                                    onChange={(e) => setBulkTopics(e.target.value)}
                                    placeholder={"Nouns\nVerbs\nComprehension\nPoetry\nSpeech Writing"}
                                    rows={8}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Topics will be added to: <strong>{getClassName(parseInt(selectedClassId))} → {getSubjectName(parseInt(selectedSubjectId))} → {getTermName(parseInt(selectedTermId))}</strong>
                                </p>
                            </div>
                        )}

                        {/* ═══ SINGLE MODE ═══ */}
                        {addMode === 'single' && (
                            <>
                                {filtersSet && !editingTopic && (
                                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                                        Adding to: <strong>{getClassName(parseInt(selectedClassId))} → {getSubjectName(parseInt(selectedSubjectId))} → {getTermName(parseInt(selectedTermId))}</strong>
                                    </p>
                                )}
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
                                disabled={
                                    createMutation.isPending || bulkCreateMutation.isPending || updateMutation.isPending || csvUploadMutation.isPending ||
                                    (addMode !== 'csv' && !editingTopic && !filtersSet)
                                }
                            >
                                {(createMutation.isPending || bulkCreateMutation.isPending || updateMutation.isPending || csvUploadMutation.isPending) ? 'Saving...' :
                                    editingTopic ? 'Update Topic' :
                                        addMode === 'bulk' ? 'Add All Topics' :
                                            addMode === 'csv' ? `Upload ${csvPreview.length} Topic${csvPreview.length !== 1 ? 's' : ''}` :
                                                'Add Topic'}
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
