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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Database, Search, Filter, BookOpen, BarChart3, Sparkles, CheckCircle2, XCircle, Upload, Download, FileUp, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function QuestionBankManager() {
    const { toast } = useToast();
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [filterClassId, setFilterClassId] = useState<string>('');
    const [filterSubjectId, setFilterSubjectId] = useState<string>('');
    const [filterTermId, setFilterTermId] = useState<string>('');
    const [filterTopicId, setFilterTopicId] = useState<string>('');
    const [filterDifficulty, setFilterDifficulty] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);
    const [questionToDelete, setQuestionToDelete] = useState<any>(null);
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('browse');
    const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);

    // Form state
    const [questionText, setQuestionText] = useState('');
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [difficulty, setDifficulty] = useState('medium');
    const [points, setPoints] = useState('1');
    const [formClassId, setFormClassId] = useState('');
    const [formTermId, setFormTermId] = useState('');
    const [formTopicId, setFormTopicId] = useState('');
    const [explanationText, setExplanationText] = useState('');
    const [options, setOptions] = useState([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
    ]);
    const [expectedAnswer, setExpectedAnswer] = useState('');

    // Bank form
    const [bankName, setBankName] = useState('');
    const [bankDescription, setBankDescription] = useState('');
    const [bankSubjectId, setBankSubjectId] = useState('');

    // Fetch reference data
    const { data: classes = [] } = useQuery({
        queryKey: ['/api/classes'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/classes'); return r.json(); },
    });
    const { data: subjects = [] } = useQuery({
        queryKey: ['/api/subjects'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/subjects'); return r.json(); },
    });
    const { data: terms = [] } = useQuery({
        queryKey: ['/api/terms'],
        queryFn: async () => { const r = await apiRequest('GET', '/api/terms'); return r.json(); },
    });
    const { data: banks = [] } = useQuery({
        queryKey: ['/api/question-banks'],
        queryFn: async () => {
            try {
                const r = await apiRequest('GET', '/api/question-banks');
                return r.ok ? r.json() : [];
            } catch { return []; }
        },
    });

    // Derive subject from the currently selected bank (for form context)
    const selectedBankSubjectId = selectedBankId
        ? String(banks.find((b: any) => b.id === parseInt(selectedBankId))?.subjectId || '')
        : '';

    // ── FILTER PANEL topics (browse questions) ──
    const { data: filterTopics = [] } = useQuery({
        queryKey: ['/api/syllabus-topics', 'filter', filterClassId, filterSubjectId, filterTermId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filterClassId) params.set('classId', filterClassId);
            if (filterSubjectId) params.set('subjectId', filterSubjectId);
            if (filterTermId) params.set('termId', filterTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${params.toString()}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!(filterClassId && filterSubjectId && filterTermId),
    });

    // ── FORM DIALOG topics (add/edit question) ──
    const formSubjectId = selectedBankSubjectId || bankSubjectId;
    const { data: formTopics = [] } = useQuery({
        queryKey: ['/api/syllabus-topics', 'form', formClassId, formSubjectId, formTermId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (formClassId) params.set('classId', formClassId);
            if (formSubjectId) params.set('subjectId', formSubjectId);
            if (formTermId) params.set('termId', formTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${params.toString()}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!(formClassId && formSubjectId && formTermId),
    });

    // Combined topics for display labels (used by question table)
    const syllabusTopics = [...filterTopics, ...formTopics].filter(
        (t: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === t.id) === i
    );

    // Fetch question bank items with filters
    const { data: questions = [], isLoading: loadingQuestions } = useQuery({
        queryKey: ['/api/question-bank/items', selectedBankId, filterClassId, filterSubjectId, filterTermId, filterTopicId, filterDifficulty, filterType],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (selectedBankId) params.set('bankId', selectedBankId);
            if (filterClassId) params.set('classId', filterClassId);
            if (filterSubjectId) params.set('subjectId', filterSubjectId);
            if (filterTermId) params.set('termId', filterTermId);
            if (filterTopicId) params.set('topicId', filterTopicId);
            if (filterDifficulty) params.set('difficulty', filterDifficulty);
            if (filterType) params.set('questionType', filterType);
            const r = await apiRequest('GET', `/api/question-bank/items?${params.toString()}`);
            return r.ok ? r.json() : [];
        },
    });

    // Create bank
    const createBankMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/question-banks', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to create bank'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: 'Success', description: 'Question bank created' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-banks'] });
            setSelectedBankId(String(result.id));
            setIsBankDialogOpen(false);
            setBankName(''); setBankDescription(''); setBankSubjectId('');
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Create question
    const createQuestionMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/question-bank/items', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to create question'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Question added to bank' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-bank/items'] });
            resetQuestionForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Update question
    const updateQuestionMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const r = await apiRequest('PUT', `/api/question-bank/items/${id}`, data);
            if (!r.ok) throw new Error('Failed to update');
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Question updated' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-bank/items'] });
            resetQuestionForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // Delete question
    const deleteQuestionMutation = useMutation({
        mutationFn: async (id: number) => {
            const r = await apiRequest('DELETE', `/api/question-bank/items/${id}`);
            if (!r.ok) throw new Error('Failed to delete');
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Question deleted' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-bank/items'] });
            setQuestionToDelete(null);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const resetQuestionForm = () => {
        setQuestionText(''); setQuestionType('multiple_choice'); setDifficulty('medium');
        setPoints('1'); setFormClassId(''); setFormTermId(''); setFormTopicId('');
        setExplanationText(''); setExpectedAnswer('');
        setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
        setIsAddDialogOpen(false); setEditingQuestion(null);
    };

    const handleSubmitQuestion = () => {
        if (!selectedBankId) return toast({ title: 'Error', description: 'Select a question bank first', variant: 'destructive' });
        if (!questionText.trim()) return toast({ title: 'Error', description: 'Question text is required', variant: 'destructive' });

        const data: any = {
            bankId: parseInt(selectedBankId), questionText: questionText.trim(),
            questionType, difficulty, points: parseInt(points) || 1,
            classId: formClassId ? parseInt(formClassId) : null,
            termId: formTermId ? parseInt(formTermId) : null,
            topicId: formTopicId ? parseInt(formTopicId) : null,
            explanationText: explanationText || null,
        };

        if (questionType === 'multiple_choice') {
            const validOptions = options.filter(o => o.text.trim());
            if (validOptions.length < 2) return toast({ title: 'Error', description: 'At least 2 options required', variant: 'destructive' });
            if (!validOptions.some(o => o.isCorrect)) return toast({ title: 'Error', description: 'Mark at least one option as correct', variant: 'destructive' });
            data.options = validOptions.map((o, i) => ({ optionText: o.text.trim(), isCorrect: o.isCorrect, orderNumber: i + 1 }));
        } else {
            if (expectedAnswer) data.expectedAnswers = JSON.stringify([expectedAnswer]);
        }

        if (editingQuestion) {
            updateQuestionMutation.mutate({ id: editingQuestion.id, data });
        } else {
            createQuestionMutation.mutate(data);
        }
    };

    const handleEditQuestion = (q: any) => {
        setEditingQuestion(q);
        setQuestionText(q.questionText);
        setQuestionType(q.questionType);
        setDifficulty(q.difficulty);
        setPoints(String(q.points));
        setFormClassId(q.classId ? String(q.classId) : '');
        setFormTermId(q.termId ? String(q.termId) : '');
        setFormTopicId(q.topicId ? String(q.topicId) : '');
        setExplanationText(q.explanationText || '');
        if (q.options?.length) {
            setOptions(q.options.map((o: any) => ({ text: o.optionText, isCorrect: o.isCorrect })));
        }
        setIsAddDialogOpen(true);
    };

    const getDifficultyColor = (d: string) => {
        switch (d) { case 'easy': return 'bg-green-100 text-green-800'; case 'hard': return 'bg-red-100 text-red-800'; default: return 'bg-yellow-100 text-yellow-800'; }
    };

    const getTypeLabel = (t: string) => {
        switch (t) { case 'multiple_choice': return 'MCQ'; case 'essay': return 'Essay'; case 'true_false': return 'T/F'; case 'fill_blank': return 'Fill'; default: return 'Text'; }
    };

    const getTopicName = (id: number | null) => {
        if (!id) return '—';
        return syllabusTopics.find((t: any) => t.id === id)?.name || `Topic #${id}`;
    };

    const clearFilters = () => {
        setFilterClassId(''); setFilterSubjectId(''); setFilterTermId('');
        setFilterTopicId(''); setFilterDifficulty(''); setFilterType('');
    };

    // Cascading resets — filter panel
    const handleFilterClassChange = (v: string) => { setFilterClassId(v); setFilterTermId(''); setFilterTopicId(''); };
    const handleFilterTermChange = (v: string) => { setFilterTermId(v); setFilterTopicId(''); };
    // Cascading resets — form dialog
    const handleFormClassChange = (v: string) => { setFormClassId(v); setFormTermId(''); setFormTopicId(''); };
    const handleFormTermChange = (v: string) => { setFormTermId(v); setFormTopicId(''); };

    // ═══ CSV UPLOAD ═══
    const csvUploadMutation = useMutation({
        mutationFn: async (data: { bankId: number; classId?: number; termId?: number; topicId?: number; questions: any[] }) => {
            const r = await apiRequest('POST', '/api/question-bank/items/bulk-csv', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed to upload'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: '✓ Upload Complete', description: `${result.created} question${result.created !== 1 ? 's' : ''} added to bank.${result.errors?.length ? ` ${result.errors.length} failed.` : ''}` });
            queryClient.invalidateQueries({ queryKey: ['/api/question-bank/items'] });
            if (result.errors?.length) {
                setCsvErrors(result.errors);
            } else {
                setIsCsvDialogOpen(false); setCsvPreview([]); setCsvErrors([]);
            }
        },
        onError: (e: any) => toast({ title: 'Upload Error', description: e.message, variant: 'destructive' }),
    });

    const downloadBankCSVTemplate = () => {
        const csv = `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Difficulty
"What is 2 + 2?",multiple_choice,"2","3","4","5","C",1,easy
"Explain photosynthesis.",essay,"","","","","",5,medium
"The earth is flat.",true_false,"True","False","","","B",1,easy
"Capital of Nigeria is ___.",fill_blank,"","","","","Abuja",2,medium`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'question_bank_template.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
        toast({ title: 'Template Downloaded', description: 'CSV template with examples has been downloaded.' });
    };

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

    const handleBankCSVFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                if (lines.length < 2) throw new Error('CSV must have a header row and at least one question.');
                const headers = parseCSVLine(lines[0]);
                const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
                const questions: any[] = []; const errors: string[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    const get = (name: string) => { const idx = normalizedHeaders.indexOf(name.toLowerCase()); return idx >= 0 ? row[idx]?.trim() : ''; };
                    const questionText = get('QuestionText');
                    const questionType = get('Type')?.toLowerCase().replace(/[-\s]/g, '_') || 'text';
                    const points = parseInt(get('Points')) || 1;
                    const difficulty = get('Difficulty') || 'medium';
                    if (!questionText || questionText.length < 5) { errors.push(`Row ${i + 1}: Question text too short`); continue; }
                    const q: any = { questionText, questionType, points, difficulty };
                    if (questionType === 'multiple_choice') {
                        const opts = ['OptionA', 'OptionB', 'OptionC', 'OptionD'].map(get).filter(Boolean);
                        const correct = get('CorrectAnswer')?.toUpperCase();
                        if (opts.length < 2) { errors.push(`Row ${i + 1}: MCQ needs at least 2 options`); continue; }
                        q.options = opts.map((text, idx) => ({ optionText: text, isCorrect: String.fromCharCode(65 + idx) === correct }));
                        if (!q.options.some((o: any) => o.isCorrect)) { errors.push(`Row ${i + 1}: No correct answer marked`); continue; }
                    } else if (questionType === 'fill_blank' || questionType === 'text') {
                        const answer = get('CorrectAnswer');
                        if (answer) q.expectedAnswer = answer;
                    }
                    questions.push(q);
                }
                setCsvPreview(questions); setCsvErrors(errors);
                if (questions.length === 0 && errors.length > 0) {
                    toast({ title: 'All rows failed', description: errors.slice(0, 3).join('; '), variant: 'destructive' });
                }
            } catch (err: any) {
                toast({ title: 'CSV Parse Error', description: err.message, variant: 'destructive' });
            }
        };
        reader.readAsText(file);
    };

    const handleCsvSubmit = () => {
        if (!selectedBankId || csvPreview.length === 0) return;
        csvUploadMutation.mutate({
            bankId: parseInt(selectedBankId),
            classId: formClassId ? parseInt(formClassId) : undefined,
            termId: formTermId ? parseInt(formTermId) : undefined,
            topicId: formTopicId ? parseInt(formTopicId) : undefined,
            questions: csvPreview,
        });
    };

    return (
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Database className="w-7 h-7 text-primary" />
                        Question Bank
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage reusable questions organized by curriculum</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New Bank
                    </Button>
                    {selectedBankId && (
                        <>
                            <Button variant="outline" onClick={() => { setCsvPreview([]); setCsvErrors([]); setIsCsvDialogOpen(true); }}>
                                <Upload className="w-4 h-4 mr-2" /> CSV Upload
                            </Button>
                            <Button onClick={() => { resetQuestionForm(); setIsAddDialogOpen(true); }}>
                                <Plus className="w-4 h-4 mr-2" /> Add Question
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Bank selector + Filters */}
            <Card>
                <CardContent className="py-4 space-y-4">
                    {/* Bank selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Question Bank</Label>
                            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                <SelectTrigger><SelectValue placeholder="Select a bank..." /></SelectTrigger>
                                <SelectContent>
                                    {banks.map((b: any) => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name} ({subjects.find((s: any) => s.id === b.subjectId)?.name || '—'})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium flex items-center gap-1"><Filter className="w-4 h-4" /> Filters</span>
                            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear All</Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <Select value={filterClassId} onValueChange={handleFilterClassChange}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Class" /></SelectTrigger>
                                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Subject" /></SelectTrigger>
                                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={filterTermId} onValueChange={handleFilterTermChange}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Term" /></SelectTrigger>
                                <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={filterTopicId} onValueChange={setFilterTopicId} disabled={!filterClassId || !filterSubjectId || !filterTermId}>
                                <SelectTrigger className="h-9"><SelectValue placeholder={!filterClassId || !filterSubjectId || !filterTermId ? 'Set class, subject & term' : 'Topic'} /></SelectTrigger>
                                <SelectContent>{filterTopics.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="multiple_choice">MCQ</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="essay">Essay</SelectItem>
                                    <SelectItem value="true_false">True/False</SelectItem>
                                    <SelectItem value="fill_blank">Fill Blank</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Questions List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><BookOpen className="w-5 h-5" /> Questions</span>
                        <Badge variant="secondary">{questions.length} found</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingQuestions ? (
                        <div className="flex justify-center py-8 text-muted-foreground">Loading questions...</div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-12">
                            <Database className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-muted-foreground">No questions found. {selectedBankId ? 'Add your first question!' : 'Select a bank to get started.'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {questions.map((q: any, idx: number) => (
                                <div key={q.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                                <Badge variant="outline" className="text-xs">{getTypeLabel(q.questionType)}</Badge>
                                                <Badge className={`text-xs ${getDifficultyColor(q.difficulty)}`}>{q.difficulty}</Badge>
                                                <Badge variant="secondary" className="text-xs">{q.points} pt{q.points !== 1 ? 's' : ''}</Badge>
                                                {q.topicId && <Badge variant="outline" className="text-xs bg-blue-50">{getTopicName(q.topicId)}</Badge>}
                                                {(q.usageCount || 0) > 0 && (
                                                    <Badge variant="outline" className="text-xs bg-purple-50">
                                                        <BarChart3 className="w-3 h-3 mr-1" />Used {q.usageCount}x
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium line-clamp-2">{q.questionText}</p>
                                            {q.options?.length > 0 && (
                                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                    {q.options.map((o: any, i: number) => (
                                                        <div key={i} className={`text-xs px-2 py-1 rounded ${o.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600'}`}>
                                                            {o.isCorrect ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1 opacity-30" />}
                                                            {o.optionText}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <Button variant="outline" size="sm" onClick={() => handleEditQuestion(q)}><Edit className="w-3 h-3" /></Button>
                                            <Button variant="destructive" size="sm" onClick={() => setQuestionToDelete(q)}><Trash2 className="w-3 h-3" /></Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Bank Dialog */}
            <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create Question Bank</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div><Label>Bank Name *</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g., JSS1 English Questions" /></div>
                        <div><Label>Description</Label><Input value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} placeholder="Brief description" /></div>
                        <div>
                            <Label>Subject *</Label>
                            <Select value={bankSubjectId} onValueChange={setBankSubjectId}>
                                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button>
                            <Button onClick={() => {
                                if (!bankName.trim() || !bankSubjectId) return toast({ title: 'Error', description: 'Name and subject are required', variant: 'destructive' });
                                createBankMutation.mutate({ name: bankName.trim(), description: bankDescription, subjectId: parseInt(bankSubjectId) });
                            }} disabled={createBankMutation.isPending}>
                                {createBankMutation.isPending ? 'Creating...' : 'Create Bank'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Question Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetQuestionForm(); setIsAddDialogOpen(open); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Question Text *</Label>
                            <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter the question..." rows={3} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <Label>Type</Label>
                                <Select value={questionType} onValueChange={setQuestionType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                        <SelectItem value="text">Short Answer</SelectItem>
                                        <SelectItem value="essay">Essay</SelectItem>
                                        <SelectItem value="true_false">True/False</SelectItem>
                                        <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Difficulty</Label>
                                <Select value={difficulty} onValueChange={setDifficulty}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="easy">Easy</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="hard">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Points</Label>
                                <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} min="1" />
                            </div>
                        </div>

                        {/* Curriculum binding */}
                        <div className="border-t pt-3">
                            <p className="text-sm font-medium mb-2">Curriculum Binding (optional)</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Class</Label>
                                    <Select value={formClassId} onValueChange={handleFormClassChange}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Select class" /></SelectTrigger>
                                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Term</Label>
                                    <Select value={formTermId} onValueChange={handleFormTermChange} disabled={!formClassId}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder={!formClassId ? 'Select class first' : 'Select term'} /></SelectTrigger>
                                        <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Topic</Label>
                                    <Select value={formTopicId} onValueChange={setFormTopicId} disabled={!formClassId || !formTermId}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder={!formClassId || !formTermId ? 'Set class & term' : 'Select topic'} /></SelectTrigger>
                                        <SelectContent>{formTopics.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {formClassId && selectedBankSubjectId && (
                                <p className="text-xs text-muted-foreground mt-1">Subject: {subjects.find((s: any) => s.id === parseInt(selectedBankSubjectId))?.name || '—'} (from bank)</p>
                            )}
                        </div>

                        {/* MCQ Options */}
                        {questionType === 'multiple_choice' && (
                            <div className="border-t pt-3">
                                <Label>Options (check correct answer)</Label>
                                <div className="space-y-2 mt-2">
                                    {options.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={opt.isCorrect}
                                                onChange={(e) => {
                                                    const newOpts = [...options];
                                                    newOpts[i].isCorrect = e.target.checked;
                                                    setOptions(newOpts);
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <Input
                                                value={opt.text}
                                                onChange={(e) => {
                                                    const newOpts = [...options];
                                                    newOpts[i].text = e.target.value;
                                                    setOptions(newOpts);
                                                }}
                                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                className="h-9"
                                            />
                                            {options.length > 2 && (
                                                <Button variant="ghost" size="sm" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {options.length < 6 && (
                                        <Button variant="ghost" size="sm" onClick={() => setOptions([...options, { text: '', isCorrect: false }])}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Option
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Expected answer for text/essay */}
                        {(questionType === 'text' || questionType === 'fill_blank') && (
                            <div>
                                <Label>Expected Answer</Label>
                                <Input value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} placeholder="Expected answer for auto-grading" />
                            </div>
                        )}

                        <div>
                            <Label>Explanation (optional)</Label>
                            <Textarea value={explanationText} onChange={(e) => setExplanationText(e.target.value)} placeholder="Explanation shown after answering" rows={2} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={resetQuestionForm}>Cancel</Button>
                            <Button onClick={handleSubmitQuestion} disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}>
                                {(createQuestionMutation.isPending || updateQuestionMutation.isPending) ? 'Saving...' :
                                    editingQuestion ? 'Update Question' : 'Add Question'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            {questionToDelete && (
                <Dialog open={!!questionToDelete} onOpenChange={() => setQuestionToDelete(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Delete Question</DialogTitle></DialogHeader>
                        <p className="text-sm">Are you sure you want to delete this question?</p>
                        <p className="text-sm text-muted-foreground italic line-clamp-2 mt-1">"{questionToDelete.questionText}"</p>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setQuestionToDelete(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => deleteQuestionMutation.mutate(questionToDelete.id)} disabled={deleteQuestionMutation.isPending}>
                                {deleteQuestionMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* CSV Upload Dialog */}
            <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="w-5 h-5" /> CSV Bulk Upload</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={downloadBankCSVTemplate}>
                                <Download className="w-4 h-4 mr-1" /> Download Template
                            </Button>
                            <label className="cursor-pointer">
                                <Button variant="outline" size="sm" asChild>
                                    <span><Upload className="w-4 h-4 mr-1" /> Choose CSV File</span>
                                </Button>
                                <input type="file" accept=".csv" className="hidden" onChange={handleBankCSVFile} />
                            </label>
                        </div>

                        {/* Optional curriculum binding for all uploaded questions */}
                        <div className="border rounded-lg p-3 bg-muted/30">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Apply curriculum to all uploaded questions (optional)</p>
                            <div className="grid grid-cols-3 gap-2">
                                <Select value={formClassId} onValueChange={handleFormClassChange}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Class" /></SelectTrigger>
                                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={formTermId} onValueChange={handleFormTermChange} disabled={!formClassId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={!formClassId ? 'Class first' : 'Term'} /></SelectTrigger>
                                    <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={formTopicId} onValueChange={setFormTopicId} disabled={!formClassId || !formTermId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={!formTermId ? 'Term first' : 'Topic'} /></SelectTrigger>
                                    <SelectContent>{formTopics.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* CSV Preview */}
                        {csvPreview.length > 0 && (
                            <div className="border rounded-lg">
                                <div className="p-2 bg-muted/50 flex items-center justify-between rounded-t-lg">
                                    <span className="text-sm font-medium">{csvPreview.length} question{csvPreview.length !== 1 ? 's' : ''} ready</span>
                                    <Badge variant="secondary">{csvPreview.filter(q => q.questionType === 'multiple_choice').length} MCQ, {csvPreview.filter(q => q.questionType !== 'multiple_choice').length} Theory</Badge>
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y">
                                    {csvPreview.slice(0, 10).map((q: any, i: number) => (
                                        <div key={i} className="p-2 text-xs flex items-center gap-2">
                                            <Badge variant="outline" className="shrink-0 text-[10px]">{q.questionType === 'multiple_choice' ? 'MCQ' : q.questionType}</Badge>
                                            <span className="line-clamp-1 flex-1">{q.questionText}</span>
                                            <Badge variant="secondary" className="shrink-0 text-[10px]">{q.points}pt</Badge>
                                        </div>
                                    ))}
                                    {csvPreview.length > 10 && <div className="p-2 text-xs text-muted-foreground text-center">...and {csvPreview.length - 10} more</div>}
                                </div>
                            </div>
                        )}

                        {/* CSV Errors */}
                        {csvErrors.length > 0 && (
                            <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                                <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-1"><AlertTriangle className="w-4 h-4" /> {csvErrors.length} Error{csvErrors.length !== 1 ? 's' : ''}</p>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {csvErrors.map((err, i) => <p key={i} className="text-xs text-destructive/80">{err}</p>)}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setIsCsvDialogOpen(false); setCsvPreview([]); setCsvErrors([]); }}>Cancel</Button>
                            <Button onClick={handleCsvSubmit} disabled={csvPreview.length === 0 || csvUploadMutation.isPending}>
                                {csvUploadMutation.isPending ? 'Uploading...' : `Upload ${csvPreview.length} Question${csvPreview.length !== 1 ? 's' : ''}`}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
