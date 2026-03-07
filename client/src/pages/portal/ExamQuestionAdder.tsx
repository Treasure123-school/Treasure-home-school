/**
 * ExamQuestionAdder — 3-tab dialog for adding questions to exams
 *
 * Tab 1: Manual — directly type a question
 * Tab 2: CSV Upload — bulk upload via CSV file
 * Tab 3: Import from Question Bank — browse/filter/select from bank
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    PenLine, Upload, Database, Download, Search, Filter,
    CheckCircle2, XCircle, AlertTriangle, Plus, Trash2, FileUp
} from 'lucide-react';

interface ExamQuestionAdderProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    examId: number;
    examClassId?: number;
    examSubjectId?: number;
    onQuestionsAdded: () => void;
}

export default function ExamQuestionAdder({
    open, onOpenChange, examId, examClassId, examSubjectId, onQuestionsAdded
}: ExamQuestionAdderProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ═══ TAB STATE ═══
    const [activeTab, setActiveTab] = useState('manual');

    // ═══ MANUAL TAB STATE ═══
    const [questionText, setQuestionText] = useState('');
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [points, setPoints] = useState('1');
    const [options, setOptions] = useState([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
    ]);
    const [expectedAnswer, setExpectedAnswer] = useState('');
    const [instructions, setInstructions] = useState('');
    const [sampleAnswer, setSampleAnswer] = useState('');

    // ═══ CSV TAB STATE ═══
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);

    // ═══ BANK IMPORT TAB STATE ═══
    const [bankFilterClassId, setBankFilterClassId] = useState(examClassId ? String(examClassId) : '');
    const [bankFilterSubjectId, setBankFilterSubjectId] = useState(examSubjectId ? String(examSubjectId) : '');
    const [bankFilterTermId, setBankFilterTermId] = useState('');
    const [bankFilterTopicId, setBankFilterTopicId] = useState('');
    const [bankFilterDifficulty, setBankFilterDifficulty] = useState('');
    const [bankFilterType, setBankFilterType] = useState('');
    const [selectedBankItems, setSelectedBankItems] = useState<Set<number>>(new Set());

    // ═══ REFERENCE DATA ═══
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
    const { data: bankTopics = [] } = useQuery({
        queryKey: ['/api/syllabus-topics', 'bank-import', bankFilterClassId, bankFilterSubjectId, bankFilterTermId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (bankFilterClassId) params.set('classId', bankFilterClassId);
            if (bankFilterSubjectId) params.set('subjectId', bankFilterSubjectId);
            if (bankFilterTermId) params.set('termId', bankFilterTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${params.toString()}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!(bankFilterClassId && bankFilterTermId),
    });

    // ═══ BANK ITEMS QUERY ═══
    const { data: bankItems = [], isLoading: loadingBankItems } = useQuery({
        queryKey: ['/api/question-bank/items', 'import', bankFilterClassId, bankFilterSubjectId, bankFilterTermId, bankFilterTopicId, bankFilterDifficulty, bankFilterType],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (bankFilterClassId) params.set('classId', bankFilterClassId);
            if (bankFilterSubjectId) params.set('subjectId', bankFilterSubjectId);
            if (bankFilterTermId) params.set('termId', bankFilterTermId);
            if (bankFilterTopicId) params.set('topicId', bankFilterTopicId);
            if (bankFilterDifficulty) params.set('difficulty', bankFilterDifficulty);
            if (bankFilterType) params.set('questionType', bankFilterType);
            const r = await apiRequest('GET', `/api/question-bank/items?${params.toString()}`);
            return r.ok ? r.json() : [];
        },
        enabled: open && activeTab === 'bank',
    });

    // ═══ MUTATIONS ═══
    // Manual question creation
    const createManualMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/exam-questions', data);
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || err.message || 'Failed'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Success', description: 'Question added to exam' });
            queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', examId] });
            queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
            resetManualForm();
            onQuestionsAdded();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    // CSV bulk upload to exam
    const csvUploadMutation = useMutation({
        mutationFn: async (questions: any[]) => {
            const r = await apiRequest('POST', '/api/exam-questions/bulk', { examId, questions });
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Upload failed'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: '✓ Upload Complete', description: `${result.created} question${result.created !== 1 ? 's' : ''} added.${result.errors?.length ? ` ${result.errors.length} failed.` : ''}` });
            queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', examId] });
            queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
            if (!result.errors?.length) {
                setCsvPreview([]); setCsvErrors([]);
                onQuestionsAdded();
            } else {
                setCsvErrors(result.errors);
            }
        },
        onError: (e: any) => toast({ title: 'Upload Error', description: e.message, variant: 'destructive' }),
    });

    // Import from question bank
    const importBankMutation = useMutation({
        mutationFn: async (itemIds: number[]) => {
            const r = await apiRequest('POST', '/api/question-bank/import-to-exam', {
                examId, questionItemIds: itemIds,
            });
            if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Import failed'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: '✓ Import Complete', description: `${result.imported} question${result.imported !== 1 ? 's' : ''} imported from bank` });
            queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', examId] });
            queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
            setSelectedBankItems(new Set());
            onQuestionsAdded();
        },
        onError: (e: any) => toast({ title: 'Import Error', description: e.message, variant: 'destructive' }),
    });

    // ═══ HELPERS ═══
    const resetManualForm = () => {
        setQuestionText(''); setQuestionType('multiple_choice'); setPoints('1');
        setOptions([{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
        setExpectedAnswer(''); setInstructions(''); setSampleAnswer('');
    };

    const handleManualSubmit = () => {
        if (!questionText.trim() || questionText.trim().length < 5) {
            return toast({ title: 'Error', description: 'Question text must be at least 5 characters', variant: 'destructive' });
        }
        const data: any = {
            examId, questionText: questionText.trim(), questionType,
            points: parseInt(points) || 1, orderNumber: 0,
        };
        if (instructions) data.instructions = instructions;
        if (sampleAnswer) data.sampleAnswer = sampleAnswer;

        if (questionType === 'multiple_choice') {
            const valid = options.filter(o => o.text.trim());
            if (valid.length < 2) return toast({ title: 'Error', description: 'At least 2 options required', variant: 'destructive' });
            if (!valid.some(o => o.isCorrect)) return toast({ title: 'Error', description: 'Mark at least one correct option', variant: 'destructive' });
            data.options = valid.map((o, i) => ({ optionText: o.text.trim(), isCorrect: o.isCorrect }));
        } else if (expectedAnswer) {
            data.expectedAnswers = JSON.stringify([expectedAnswer]);
        }
        createManualMutation.mutate(data);
    };

    // CSV parsing
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
                if (lines.length < 2) throw new Error('CSV needs a header + at least one data row');
                const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
                const questions: any[] = []; const errors: string[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    const get = (name: string) => { const idx = headers.indexOf(name.toLowerCase()); return idx >= 0 ? row[idx]?.trim() : ''; };
                    const questionText = get('questiontext');
                    const type = get('type')?.toLowerCase().replace(/[-\s]/g, '_') || 'text';
                    const pts = parseInt(get('points')) || 1;
                    if (!questionText || questionText.length < 5) { errors.push(`Row ${i + 1}: Question too short`); continue; }
                    const q: any = { questionText, questionType: type, points: pts };
                    if (get('instructions')) q.instructions = get('instructions');
                    if (get('sampleanswer')) q.sampleAnswer = get('sampleanswer');
                    if (type === 'multiple_choice') {
                        const opts = ['optiona', 'optionb', 'optionc', 'optiond'].map(get).filter(Boolean);
                        const correct = get('correctanswer')?.toUpperCase();
                        if (opts.length < 2) { errors.push(`Row ${i + 1}: MCQ needs 2+ options`); continue; }
                        q.options = opts.map((text, idx) => ({ optionText: text, isCorrect: String.fromCharCode(65 + idx) === correct }));
                        if (!q.options.some((o: any) => o.isCorrect)) { errors.push(`Row ${i + 1}: No correct answer`); continue; }
                    }
                    questions.push(q);
                }
                setCsvPreview(questions); setCsvErrors(errors);
            } catch (err: any) {
                toast({ title: 'Parse Error', description: err.message, variant: 'destructive' });
            }
        };
        reader.readAsText(file);
    };

    const downloadTemplate = () => {
        const csv = `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Instructions,SampleAnswer
"What is 2 + 2?",multiple_choice,"2","3","4","5","C",1,"Choose the correct answer","4"
"Explain photosynthesis in detail.",essay,"","","","","",10,"Write a comprehensive explanation","Photosynthesis is the process..."
"The capital of Nigeria is ___.",text,"","","","","Abuja",2,"Fill in the answer","Abuja"`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'exam_questions_template.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // Bank item helpers
    const toggleBankItem = (id: number) => {
        const next = new Set(selectedBankItems);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedBankItems(next);
    };
    const toggleAllBankItems = () => {
        if (selectedBankItems.size === bankItems.length) {
            setSelectedBankItems(new Set());
        } else {
            setSelectedBankItems(new Set(bankItems.map((q: any) => q.id)));
        }
    };
    const handleBankFilterClassChange = (v: string) => { setBankFilterClassId(v); setBankFilterTermId(''); setBankFilterTopicId(''); };
    const handleBankFilterTermChange = (v: string) => { setBankFilterTermId(v); setBankFilterTopicId(''); };

    const getDifficultyColor = (d: string) => {
        switch (d) { case 'easy': return 'bg-green-100 text-green-800'; case 'hard': return 'bg-red-100 text-red-800'; default: return 'bg-yellow-100 text-yellow-800'; }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Add Questions to Exam
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="manual" className="flex items-center gap-1.5 text-xs sm:text-sm">
                            <PenLine className="w-4 h-4" /> Manual
                        </TabsTrigger>
                        <TabsTrigger value="csv" className="flex items-center gap-1.5 text-xs sm:text-sm">
                            <Upload className="w-4 h-4" /> CSV Upload
                        </TabsTrigger>
                        <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs sm:text-sm">
                            <Database className="w-4 h-4" /> From Bank
                        </TabsTrigger>
                    </TabsList>

                    {/* ═══ TAB 1: MANUAL ═══ */}
                    <TabsContent value="manual" className="space-y-4 mt-4">
                        <div>
                            <Label>Question Text *</Label>
                            <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter your question..." rows={3} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Type</Label>
                                <Select value={questionType} onValueChange={setQuestionType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                        <SelectItem value="text">Short Answer</SelectItem>
                                        <SelectItem value="essay">Essay</SelectItem>
                                        <SelectItem value="true_false">True/False</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Points</Label>
                                <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} min="1" />
                            </div>
                            <div>
                                <Label>Instructions</Label>
                                <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Optional" />
                            </div>
                        </div>

                        {questionType === 'multiple_choice' && (
                            <div className="border-t pt-3">
                                <Label>Options (check correct answer)</Label>
                                <div className="space-y-2 mt-2">
                                    {options.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input type="checkbox" checked={opt.isCorrect} onChange={(e) => {
                                                const n = [...options]; n[i].isCorrect = e.target.checked; setOptions(n);
                                            }} className="w-4 h-4" />
                                            <Input value={opt.text} onChange={(e) => {
                                                const n = [...options]; n[i].text = e.target.value; setOptions(n);
                                            }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="h-9" />
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

                        {(questionType === 'text' || questionType === 'essay') && (
                            <div>
                                <Label>Expected/Sample Answer</Label>
                                <Textarea value={expectedAnswer || sampleAnswer} onChange={(e) => {
                                    if (questionType === 'essay') setSampleAnswer(e.target.value);
                                    else setExpectedAnswer(e.target.value);
                                }} placeholder="Answer for auto-grading or reference" rows={2} />
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={handleManualSubmit} disabled={createManualMutation.isPending}>
                                {createManualMutation.isPending ? 'Adding...' : 'Add Question'}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ═══ TAB 2: CSV UPLOAD ═══ */}
                    <TabsContent value="csv" className="space-y-4 mt-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                <Download className="w-4 h-4 mr-1" /> Download Template
                            </Button>
                            <label className="cursor-pointer">
                                <Button variant="outline" size="sm" asChild>
                                    <span><FileUp className="w-4 h-4 mr-1" /> Choose CSV File</span>
                                </Button>
                                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
                            </label>
                        </div>

                        <div className="border rounded-lg p-3 bg-muted/30 text-xs">
                            <p className="font-medium mb-1">CSV Format:</p>
                            <p className="text-muted-foreground">QuestionText, Type (multiple_choice/text/essay), OptionA-D, CorrectAnswer (A/B/C/D), Points, Instructions, SampleAnswer</p>
                        </div>

                        {csvPreview.length > 0 && (
                            <div className="border rounded-lg">
                                <div className="p-2 bg-muted/50 flex items-center justify-between rounded-t-lg">
                                    <span className="text-sm font-medium">{csvPreview.length} question{csvPreview.length !== 1 ? 's' : ''} parsed</span>
                                    <Badge variant="secondary">{csvPreview.filter((q: any) => q.questionType === 'multiple_choice').length} MCQ, {csvPreview.filter((q: any) => q.questionType !== 'multiple_choice').length} Theory</Badge>
                                </div>
                                <div className="max-h-40 overflow-y-auto divide-y">
                                    {csvPreview.slice(0, 8).map((q: any, i: number) => (
                                        <div key={i} className="p-2 text-xs flex items-center gap-2">
                                            <Badge variant="outline" className="shrink-0 text-[10px]">{q.questionType === 'multiple_choice' ? 'MCQ' : q.questionType}</Badge>
                                            <span className="line-clamp-1 flex-1">{q.questionText}</span>
                                            <Badge variant="secondary" className="shrink-0 text-[10px]">{q.points}pt</Badge>
                                        </div>
                                    ))}
                                    {csvPreview.length > 8 && <div className="p-2 text-xs text-center text-muted-foreground">...and {csvPreview.length - 8} more</div>}
                                </div>
                            </div>
                        )}

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

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={() => csvUploadMutation.mutate(csvPreview)} disabled={csvPreview.length === 0 || csvUploadMutation.isPending}>
                                {csvUploadMutation.isPending ? 'Uploading...' : `Upload ${csvPreview.length} Question${csvPreview.length !== 1 ? 's' : ''}`}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ═══ TAB 3: IMPORT FROM QUESTION BANK ═══ */}
                    <TabsContent value="bank" className="space-y-4 mt-4">
                        {/* Filters */}
                        <div className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Questions</span>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                    setBankFilterClassId(''); setBankFilterSubjectId(''); setBankFilterTermId('');
                                    setBankFilterTopicId(''); setBankFilterDifficulty(''); setBankFilterType('');
                                }}>Clear</Button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                <Select value={bankFilterClassId} onValueChange={handleBankFilterClassChange}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Class" /></SelectTrigger>
                                    <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={bankFilterSubjectId} onValueChange={setBankFilterSubjectId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
                                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={bankFilterTermId} onValueChange={handleBankFilterTermChange}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Term" /></SelectTrigger>
                                    <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={bankFilterTopicId} onValueChange={setBankFilterTopicId} disabled={!bankFilterClassId || !bankFilterTermId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={!bankFilterTermId ? 'Set term' : 'Topic'} /></SelectTrigger>
                                    <SelectContent>{bankTopics.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={bankFilterDifficulty} onValueChange={setBankFilterDifficulty}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="easy">Easy</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="hard">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={bankFilterType} onValueChange={setBankFilterType}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="multiple_choice">MCQ</SelectItem>
                                        <SelectItem value="text">Short Answer</SelectItem>
                                        <SelectItem value="essay">Essay</SelectItem>
                                        <SelectItem value="true_false">True/False</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Question list with checkboxes */}
                        <div className="border rounded-lg">
                            <div className="p-2 bg-muted/50 flex items-center justify-between rounded-t-lg">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox"
                                        checked={bankItems.length > 0 && selectedBankItems.size === bankItems.length}
                                        onChange={toggleAllBankItems}
                                        className="w-4 h-4" />
                                    <span className="text-sm font-medium">
                                        {loadingBankItems ? 'Loading...' : `${bankItems.length} question${bankItems.length !== 1 ? 's' : ''} available`}
                                    </span>
                                </div>
                                {selectedBankItems.size > 0 && (
                                    <Badge>{selectedBankItems.size} selected</Badge>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y">
                                {bankItems.length === 0 && !loadingBankItems && (
                                    <div className="p-6 text-center text-sm text-muted-foreground">
                                        <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        No questions found. Try adjusting filters.
                                    </div>
                                )}
                                {bankItems.map((q: any) => (
                                    <div key={q.id}
                                        className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors ${selectedBankItems.has(q.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleBankItem(q.id)}
                                    >
                                        <input type="checkbox"
                                            checked={selectedBankItems.has(q.id)}
                                            onChange={() => toggleBankItem(q.id)}
                                            className="w-4 h-4 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {q.questionType === 'multiple_choice' ? 'MCQ' : q.questionType}
                                                </Badge>
                                                <Badge className={`text-[10px] ${getDifficultyColor(q.difficulty)}`}>{q.difficulty}</Badge>
                                                <Badge variant="secondary" className="text-[10px]">{q.points}pt</Badge>
                                            </div>
                                            <p className="text-sm line-clamp-2">{q.questionText}</p>
                                            {q.options?.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {q.options.slice(0, 4).map((o: any, i: number) => (
                                                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${o.isCorrect ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {o.isCorrect ? '✓' : ''} {o.optionText}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={() => importBankMutation.mutate(Array.from(selectedBankItems))}
                                disabled={selectedBankItems.size === 0 || importBankMutation.isPending}>
                                {importBankMutation.isPending ? 'Importing...' : `Import ${selectedBankItems.size} Question${selectedBankItems.size !== 1 ? 's' : ''}`}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
