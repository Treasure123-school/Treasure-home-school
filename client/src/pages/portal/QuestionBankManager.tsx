import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    Plus, Trash2, Edit, Database, Filter, BookOpen, BarChart3,
    CheckCircle2, XCircle, Upload, Download, AlertTriangle, Eye,
    Send, Clock, CheckCheck, Ban, Globe, RotateCcw, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
    draft:     { label: 'Draft',          className: 'bg-gray-100 text-gray-700 border-gray-200',         icon: Edit },
    submitted: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800 border-yellow-200',   icon: Clock },
    approved:  { label: 'Approved',       className: 'bg-blue-100 text-blue-800 border-blue-200',         icon: CheckCircle2 },
    rejected:  { label: 'Rejected',       className: 'bg-red-100 text-red-800 border-red-200',            icon: Ban },
    published: { label: 'Published',      className: 'bg-green-100 text-green-800 border-green-200',      icon: Globe },
    active:    { label: 'Published',      className: 'bg-green-100 text-green-800 border-green-200',      icon: Globe },
    archived:  { label: 'Archived',       className: 'bg-slate-100 text-slate-600 border-slate-200',      icon: Database },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

// ─── Question form helpers ─────────────────────────────────────────────────────
function getDifficultyColor(d: string) {
    switch (d) { case 'easy': return 'bg-green-100 text-green-800'; case 'hard': return 'bg-red-100 text-red-800'; default: return 'bg-yellow-100 text-yellow-800'; }
}
function getTypeLabel(t: string) {
    switch (t) { case 'multiple_choice': return 'MCQ'; case 'essay': return 'Essay'; case 'true_false': return 'T/F'; case 'fill_blank': return 'Fill'; default: return 'Text'; }
}

const BLANK_OPTIONS = [
    { text: '', isCorrect: false }, { text: '', isCorrect: false },
    { text: '', isCorrect: false }, { text: '', isCorrect: false },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function QuestionBankManager() {
    const { toast } = useToast();
    const { user } = useAuth();

    const userRoleId = user?.roleId ?? 0;
    const isAdmin = userRoleId === 1 || userRoleId === 2;
    const isTeacher = userRoleId === 3;

    // ── Shared filter state ──
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [filterClassId, setFilterClassId] = useState<string>('');
    const [filterSubjectId, setFilterSubjectId] = useState<string>('');
    const [filterTermId, setFilterTermId] = useState<string>('');
    const [filterTopicId, setFilterTopicId] = useState<string>('');
    const [filterDifficulty, setFilterDifficulty] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    // ── Pending filter (admin) ──
    const [pendingSubjectId, setPendingSubjectId] = useState<string>('');
    const [pendingClassId, setPendingClassId] = useState<string>('');

    // ── Dialog state ──
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);
    const [questionToDelete, setQuestionToDelete] = useState<any>(null);
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [bankToDelete, setBankToDelete] = useState<any>(null);
    const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
    const [rejectDialogQ, setRejectDialogQ] = useState<any>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [previewQuestion, setPreviewQuestion] = useState<any>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // ── Active tab ──
    const [activeTab, setActiveTab] = useState(isAdmin ? 'browse' : 'mine');

    // ── Question form ──
    const [questionText, setQuestionText] = useState('');
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [difficulty, setDifficulty] = useState('medium');
    const [points, setPoints] = useState('1');
    const [formClassId, setFormClassId] = useState('');
    const [formTermId, setFormTermId] = useState('');
    const [formTopicId, setFormTopicId] = useState('');
    const [explanationText, setExplanationText] = useState('');
    const [options, setOptions] = useState([...BLANK_OPTIONS]);
    const [expectedAnswer, setExpectedAnswer] = useState('');

    // ── Bank form ──
    const [bankName, setBankName] = useState('');
    const [bankDescription, setBankDescription] = useState('');
    const [bankSubjectId, setBankSubjectId] = useState('');

    // ── CSV ──
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [csvInputMode, setCsvInputMode] = useState<'file' | 'paste'>('file');
    const [csvPasteText, setCsvPasteText] = useState('');

    // ─── Reference data ────────────────────────────────────────────────────────
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
            try { const r = await apiRequest('GET', '/api/question-banks'); return r.ok ? r.json() : []; } catch { return []; }
        },
    });

    const selectedBankSubjectId = selectedBankId
        ? String((banks as any[]).find(b => b.id === parseInt(selectedBankId))?.subjectId || '')
        : '';

    // ─── Topics ─────────────────────────────────────────────────────────────────
    const { data: filterTopics = [] } = useQuery({
        queryKey: ['/api/syllabus-topics', 'filter', filterClassId, filterSubjectId, filterTermId],
        queryFn: async () => {
            const p = new URLSearchParams();
            if (filterClassId) p.set('classId', filterClassId);
            if (filterSubjectId) p.set('subjectId', filterSubjectId);
            if (filterTermId) p.set('termId', filterTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${p}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!(filterClassId && filterSubjectId && filterTermId),
    });
    const formSubjectId = selectedBankSubjectId || bankSubjectId;
    const { data: formTopics = [] } = useQuery({
        queryKey: ['/api/syllabus-topics', 'form', formClassId, formSubjectId, formTermId],
        queryFn: async () => {
            const p = new URLSearchParams();
            if (formClassId) p.set('classId', formClassId);
            if (formSubjectId) p.set('subjectId', formSubjectId);
            if (formTermId) p.set('termId', formTermId);
            const r = await apiRequest('GET', `/api/syllabus-topics?${p}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!(formClassId && formSubjectId && formTermId),
    });
    const syllabusTopics = [...(filterTopics as any[]), ...(formTopics as any[])].filter(
        (t, i, arr) => arr.findIndex(x => x.id === t.id) === i
    );
    const getTopicName = (id: number | null) => {
        if (!id) return '—';
        return syllabusTopics.find(t => t.id === id)?.name || `Topic #${id}`;
    };
    const getSubjectName = (id: number | null) => {
        if (!id) return '—';
        return (subjects as any[]).find(s => s.id === id)?.name || '—';
    };

    // ─── Browse questions (admin: all; teacher: published only) ─────────────────
    const { data: browseQuestions = [], isLoading: loadingBrowse } = useQuery({
        queryKey: ['/api/question-bank/items', 'browse', selectedBankId, filterClassId, filterSubjectId, filterTermId, filterTopicId, filterDifficulty, filterType, filterStatus, isAdmin],
        queryFn: async () => {
            const p = new URLSearchParams();
            if (selectedBankId) p.set('bankId', selectedBankId);
            if (filterClassId) p.set('classId', filterClassId);
            if (filterSubjectId) p.set('subjectId', filterSubjectId);
            if (filterTermId) p.set('termId', filterTermId);
            if (filterTopicId) p.set('topicId', filterTopicId);
            if (filterDifficulty) p.set('difficulty', filterDifficulty);
            if (filterType) p.set('questionType', filterType);
            if (filterStatus) p.set('status', filterStatus);
            const r = await apiRequest('GET', `/api/question-bank/items?${p}`);
            return r.ok ? r.json() : [];
        },
        enabled: !!selectedBankId || isAdmin,
    });

    // ─── Teacher: My questions ───────────────────────────────────────────────────
    const { data: myQuestions = [], isLoading: loadingMine } = useQuery({
        queryKey: ['/api/question-bank/items', 'mine', filterStatus],
        queryFn: async () => {
            const p = new URLSearchParams();
            p.set('myOnly', 'true');
            if (filterStatus) p.set('status', filterStatus);
            const r = await apiRequest('GET', `/api/question-bank/items?${p}`);
            return r.ok ? r.json() : [];
        },
        enabled: isTeacher,
    });

    // ─── Admin: Pending approval queue ──────────────────────────────────────────
    const { data: pendingItems = [], isLoading: loadingPending } = useQuery({
        queryKey: ['/api/question-bank/pending', pendingSubjectId, pendingClassId],
        queryFn: async () => {
            const p = new URLSearchParams();
            if (pendingSubjectId) p.set('subjectId', pendingSubjectId);
            if (pendingClassId) p.set('classId', pendingClassId);
            const r = await apiRequest('GET', `/api/question-bank/pending?${p}`);
            return r.ok ? r.json() : [];
        },
        enabled: isAdmin,
    });

    // ─── Mutations ──────────────────────────────────────────────────────────────
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['/api/question-bank/items'] });
        queryClient.invalidateQueries({ queryKey: ['/api/question-bank/pending'] });
    };

    const createBankMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/question-banks', data);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: 'Bank created' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-banks'] });
            setSelectedBankId(String(result.id));
            setIsBankDialogOpen(false);
            setBankName(''); setBankDescription(''); setBankSubjectId('');
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const createQuestionMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/question-bank/items', data);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: (result) => {
            const statusLabel = result.status === 'draft' ? ' (saved as Draft)' : '';
            toast({ title: 'Question saved' + statusLabel });
            invalidateAll();
            resetQuestionForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const updateQuestionMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const r = await apiRequest('PUT', `/api/question-bank/items/${id}`, data);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Question updated' });
            invalidateAll();
            resetQuestionForm();
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const deleteQuestionMutation = useMutation({
        mutationFn: async (id: number) => {
            const r = await apiRequest('DELETE', `/api/question-bank/items/${id}`);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Question deleted' });
            invalidateAll();
            setQuestionToDelete(null);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const deleteBankMutation = useMutation({
        mutationFn: async (id: number) => {
            const r = await apiRequest('DELETE', `/api/question-banks/${id}`);
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: () => {
            toast({ title: 'Bank deleted' });
            queryClient.invalidateQueries({ queryKey: ['/api/question-banks'] });
            if (bankToDelete && String(bankToDelete.id) === selectedBankId) setSelectedBankId('');
            setBankToDelete(null);
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const workflowMutation = useMutation({
        mutationFn: async ({ id, action, reason }: { id: number; action: string; reason?: string }) => {
            const body = reason ? { reason } : {};
            const r = await apiRequest('POST', `/api/question-bank/items/${id}/${action}`, body);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || e.message || 'Failed'); }
            return r.json();
        },
        onSuccess: (_data, vars) => {
            const labels: Record<string, string> = {
                submit: 'Submitted for review', withdraw: 'Withdrawn to draft',
                approve: 'Question approved', reject: 'Question rejected',
                publish: 'Question published',
            };
            toast({ title: labels[vars.action] || 'Done' });
            invalidateAll();
            setRejectDialogQ(null);
            setRejectReason('');
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const csvUploadMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest('POST', '/api/question-bank/items/bulk-csv', data);
            if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
            return r.json();
        },
        onSuccess: (result) => {
            toast({ title: `${result.created} question${result.created !== 1 ? 's' : ''} imported` });
            invalidateAll();
            if (!result.errors?.length) { setIsCsvDialogOpen(false); setCsvPreview([]); setCsvErrors([]); }
            else setCsvErrors(result.errors);
        },
        onError: (e: any) => toast({ title: 'Upload error', description: e.message, variant: 'destructive' }),
    });

    // ─── Form helpers ────────────────────────────────────────────────────────────
    const resetQuestionForm = () => {
        setQuestionText(''); setQuestionType('multiple_choice'); setDifficulty('medium');
        setPoints('1'); setFormClassId(''); setFormTermId(''); setFormTopicId('');
        setExplanationText(''); setExpectedAnswer('');
        setOptions([...BLANK_OPTIONS]);
        setIsAddDialogOpen(false); setEditingQuestion(null);
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
        setExpectedAnswer('');
        setOptions(q.options?.length
            ? q.options.map((o: any) => ({ text: o.optionText, isCorrect: o.isCorrect }))
            : [...BLANK_OPTIONS]);
        setIsAddDialogOpen(true);
    };

    const handleSubmitQuestion = () => {
        if (!selectedBankId && !editingQuestion)
            return toast({ title: 'Error', description: 'Select a question bank first', variant: 'destructive' });
        if (!questionText.trim())
            return toast({ title: 'Error', description: 'Question text is required', variant: 'destructive' });

        const data: any = {
            bankId: editingQuestion ? editingQuestion.bankId : parseInt(selectedBankId),
            questionText: questionText.trim(), questionType, difficulty,
            points: parseInt(points) || 1,
            classId: formClassId ? parseInt(formClassId) : null,
            termId: formTermId ? parseInt(formTermId) : null,
            topicId: formTopicId ? parseInt(formTopicId) : null,
            explanationText: explanationText || null,
        };

        if (questionType === 'multiple_choice') {
            const valid = options.filter(o => o.text.trim());
            if (valid.length < 2) return toast({ title: 'Error', description: 'At least 2 options required', variant: 'destructive' });
            if (!valid.some(o => o.isCorrect)) return toast({ title: 'Error', description: 'Mark at least one correct option', variant: 'destructive' });
            data.options = valid.map((o, i) => ({ optionText: o.text.trim(), isCorrect: o.isCorrect, orderNumber: i + 1 }));
        } else {
            if (expectedAnswer) data.expectedAnswers = JSON.stringify([expectedAnswer]);
        }

        if (editingQuestion) updateQuestionMutation.mutate({ id: editingQuestion.id, data });
        else createQuestionMutation.mutate(data);
    };

    const clearFilters = () => {
        setFilterClassId(''); setFilterSubjectId(''); setFilterTermId('');
        setFilterTopicId(''); setFilterDifficulty(''); setFilterType(''); setFilterStatus('');
    };

    // ─── CSV helpers ─────────────────────────────────────────────────────────────
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        result.push(cur.trim());
        return result;
    };

    const parseCSVContent = (csv: string): { questions: any[]; errors: string[] } => {
        const lines = csv.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
        const isSimple = headers.includes('question') || (headers.includes('optiona') && !headers.includes('questiontext'));
        const questions: any[] = []; const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);
            const get = (name: string) => { const idx = headers.indexOf(name.toLowerCase().replace(/\s+/g, '')); return idx >= 0 ? (row[idx] || '').trim() : ''; };

            if (isSimple) {
                const qText = get('question');
                if (!qText || qText.length < 3) { errors.push(`Row ${i+1}: Question text missing`); continue; }
                const optA = get('optiona'), optB = get('optionb'), optC = get('optionc'), optD = get('optiond');
                const ca = get('correctanswer').toUpperCase();
                if (!optA) { errors.push(`Row ${i+1}: Missing option A`); continue; }
                if (!optB) { errors.push(`Row ${i+1}: Missing option B`); continue; }
                if (!['A','B','C','D'].includes(ca)) { errors.push(`Row ${i+1}: Invalid correct answer "${ca}"`); continue; }
                const allOpts = [
                    { optionText: optA, isCorrect: ca==='A' }, { optionText: optB, isCorrect: ca==='B' },
                    ...(optC ? [{ optionText: optC, isCorrect: ca==='C' }] : []),
                    ...(optD ? [{ optionText: optD, isCorrect: ca==='D' }] : []),
                ];
                questions.push({ questionText: qText, questionType: 'multiple_choice', points: 1, difficulty: 'medium', options: allOpts, _preview: { optA, optB, optC, optD, ca } });
            } else {
                const qText = get('questiontext');
                if (!qText || qText.length < 3) { errors.push(`Row ${i+1}: Question text missing`); continue; }
                const qType = (get('type') || 'multiple_choice').toLowerCase().replace(/[-\s]/g, '_');
                if (!['multiple_choice','text','essay','true_false','fill_blank'].includes(qType)) {
                    errors.push(`Row ${i+1}: Invalid type "${qType}"`); continue;
                }
                const optA = get('optiona'), optB = get('optionb'), optC = get('optionc'), optD = get('optiond');
                const ca = get('correctanswer').toUpperCase();
                const q: any = { questionText: qText, questionType: qType, points: parseInt(get('points')) || 1, difficulty: get('difficulty') || 'medium' };
                if (qType === 'multiple_choice') {
                    if (!optA) { errors.push(`Row ${i+1}: Missing option A`); continue; }
                    if (!optB) { errors.push(`Row ${i+1}: Missing option B`); continue; }
                    if (!['A','B','C','D'].includes(ca)) { errors.push(`Row ${i+1}: Invalid correct answer "${ca}"`); continue; }
                    q.options = [
                        { optionText: optA, isCorrect: ca==='A' }, { optionText: optB, isCorrect: ca==='B' },
                        ...(optC ? [{ optionText: optC, isCorrect: ca==='C' }] : []),
                        ...(optD ? [{ optionText: optD, isCorrect: ca==='D' }] : []),
                    ];
                } else if (ca) q.expectedAnswer = ca;
                questions.push(q);
            }
        }
        return { questions, errors };
    };

    const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
        if (!file.name.toLowerCase().endsWith('.csv'))
            return toast({ title: 'Invalid file', description: 'Please select a .csv file', variant: 'destructive' });
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const { questions, errors } = parseCSVContent(ev.target?.result as string);
                setCsvPreview(questions); setCsvErrors(errors);
                if (questions.length > 0) toast({ title: `${questions.length} questions parsed`, description: errors.length ? `${errors.length} rows skipped` : 'All valid' });
            } catch (err: any) { toast({ title: 'CSV error', description: err.message, variant: 'destructive' }); }
        };
        reader.readAsText(file);
    };

    const downloadTemplate = () => {
        const csv = `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Difficulty\n"What is 2+2?",multiple_choice,"2","3","4","5","C",1,easy\n"Explain photosynthesis.",essay,"","","","","",5,medium`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'question_bank_template.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    // ─── Question card ───────────────────────────────────────────────────────────
    const canTeacherEdit = (q: any) => isTeacher && q.createdBy === user?.id && ['draft','rejected'].includes(q.status);
    const canTeacherDelete = (q: any) => isTeacher && q.createdBy === user?.id && ['draft','rejected'].includes(q.status);
    const canTeacherSubmit = (q: any) => isTeacher && q.createdBy === user?.id && ['draft','rejected'].includes(q.status);
    const canTeacherWithdraw = (q: any) => isTeacher && q.createdBy === user?.id && q.status === 'submitted';

    function QuestionCard({ q, idx, showActions = true }: { q: any; idx: number; showActions?: boolean }) {
        const isExpanded = expandedId === q.id;
        return (
            <div className={`border rounded-lg p-4 transition-colors ${q.status === 'submitted' ? 'border-yellow-200 bg-yellow-50/30' : q.status === 'rejected' ? 'border-red-200 bg-red-50/30' : 'hover:bg-muted/30'}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                            <Badge variant="outline" className="text-xs">{getTypeLabel(q.questionType)}</Badge>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDifficultyColor(q.difficulty)}`}>{q.difficulty}</span>
                            <Badge variant="secondary" className="text-xs">{q.points}pt</Badge>
                            <StatusBadge status={q.status} />
                            {q.topicId && <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">{getTopicName(q.topicId)}</Badge>}
                            {(q.usageCount || 0) > 0 && (
                                <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20">
                                    <BarChart3 className="w-3 h-3 mr-1" />Used {q.usageCount}×
                                </Badge>
                            )}
                        </div>
                        <p className={`text-sm font-medium ${isExpanded ? '' : 'line-clamp-2'}`}>{q.questionText}</p>

                        {isExpanded && (
                            <div className="mt-3 space-y-2">
                                {q.options?.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {q.options.map((o: any, i: number) => (
                                            <div key={i} className={`text-xs px-2 py-1 rounded ${o.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600'}`}>
                                                {o.isCorrect ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1 opacity-30" />}
                                                {o.optionText}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {q.explanationText && (
                                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                                        <span className="font-medium">Explanation: </span>{q.explanationText}
                                    </div>
                                )}
                                {q.rejectionReason && (
                                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded flex items-start gap-1.5">
                                        <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span><span className="font-medium">Rejection reason: </span>{q.rejectionReason}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : q.id)}>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                            {showActions && (
                                <>
                                    {(isAdmin || canTeacherEdit(q)) && (
                                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => handleEditQuestion(q)}>
                                            <Edit className="w-3 h-3" />
                                        </Button>
                                    )}
                                    {(isAdmin || canTeacherDelete(q)) && (
                                        <Button variant="destructive" size="sm" className="h-7 px-2" onClick={() => setQuestionToDelete(q)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>

                        {showActions && isTeacher && (
                            <div className="flex gap-1">
                                {canTeacherSubmit(q) && (
                                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => workflowMutation.mutate({ id: q.id, action: 'submit' })}>
                                        <Send className="w-3 h-3" />Submit
                                    </Button>
                                )}
                                {canTeacherWithdraw(q) && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => workflowMutation.mutate({ id: q.id, action: 'withdraw' })}>
                                        <RotateCcw className="w-3 h-3" />Withdraw
                                    </Button>
                                )}
                            </div>
                        )}

                        {showActions && isAdmin && (
                            <div className="flex gap-1 flex-wrap justify-end">
                                {q.status === 'submitted' && (
                                    <>
                                        <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => workflowMutation.mutate({ id: q.id, action: 'approve' })}>
                                            <CheckCheck className="w-3 h-3" />Approve
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectDialogQ(q)}>
                                            <Ban className="w-3 h-3" />Reject
                                        </Button>
                                    </>
                                )}
                                {q.status === 'approved' && (
                                    <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => workflowMutation.mutate({ id: q.id, action: 'publish' })}>
                                        <Globe className="w-3 h-3" />Publish
                                    </Button>
                                )}
                                {['approved','active','published'].includes(q.status) && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectDialogQ(q)}>
                                        <Ban className="w-3 h-3" />Reject
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Filter bar ──────────────────────────────────────────────────────────────
    function FilterBar({ showStatus = true }: { showStatus?: boolean }) {
        return (
            <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium flex items-center gap-1.5"><Filter className="w-4 h-4" />Filters</span>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>Clear All</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <Select value={filterClassId} onValueChange={v => { setFilterClassId(v); setFilterTermId(''); setFilterTopicId(''); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Class" /></SelectTrigger>
                        <SelectContent>{(classes as any[]).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Subject" /></SelectTrigger>
                        <SelectContent>{(subjects as any[]).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterTermId} onValueChange={v => { setFilterTermId(v); setFilterTopicId(''); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Term" /></SelectTrigger>
                        <SelectContent>{(terms as any[]).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterTopicId} onValueChange={setFilterTopicId} disabled={!(filterClassId && filterSubjectId && filterTermId)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder={!(filterClassId && filterSubjectId && filterTermId) ? 'Set class,subject,term' : 'Topic'} /></SelectTrigger>
                        <SelectContent>{(filterTopics as any[]).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
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
                {showStatus && isAdmin && (
                    <div className="mt-2">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="submitted">Pending Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="active">Active (legacy)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        );
    }

    // ─── Question form dialog ────────────────────────────────────────────────────
    function QuestionFormDialog() {
        return (
            <Dialog open={isAddDialogOpen} onOpenChange={v => { if (!v) resetQuestionForm(); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Question Text *</Label>
                            <Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} rows={3} placeholder="Enter your question here..." />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <Label>Type</Label>
                                <Select value={questionType} onValueChange={setQuestionType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="multiple_choice">MCQ</SelectItem>
                                        <SelectItem value="text">Short Text</SelectItem>
                                        <SelectItem value="essay">Essay</SelectItem>
                                        <SelectItem value="true_false">True/False</SelectItem>
                                        <SelectItem value="fill_blank">Fill Blank</SelectItem>
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
                                <Input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} />
                            </div>
                            <div>
                                <Label>Class</Label>
                                <Select value={formClassId} onValueChange={v => { setFormClassId(v); setFormTermId(''); setFormTopicId(''); }}>
                                    <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                                    <SelectContent>{(classes as any[]).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Term</Label>
                                <Select value={formTermId} onValueChange={v => { setFormTermId(v); setFormTopicId(''); }}>
                                    <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
                                    <SelectContent>{(terms as any[]).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Topic</Label>
                                <Select value={formTopicId} onValueChange={setFormTopicId} disabled={!formClassId || !formSubjectId || !formTermId}>
                                    <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
                                    <SelectContent>{(formTopics as any[]).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        {questionType === 'multiple_choice' && (
                            <div>
                                <Label>Answer Options</Label>
                                <div className="space-y-2 mt-1">
                                    {options.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="checkbox" checked={opt.isCorrect}
                                                onChange={() => setOptions(prev => prev.map((o, j) => j === i ? { ...o, isCorrect: !o.isCorrect } : o))}
                                                className="accent-green-600"
                                                title="Mark as correct"
                                            />
                                            <Input
                                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                value={opt.text}
                                                onChange={e => setOptions(prev => prev.map((o, j) => j === i ? { ...o, text: e.target.value } : o))}
                                                className={opt.isCorrect ? 'border-green-400' : ''}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Check the box next to correct option(s)</p>
                            </div>
                        )}

                        {questionType !== 'multiple_choice' && (
                            <div>
                                <Label>Expected Answer (optional)</Label>
                                <Input value={expectedAnswer} onChange={e => setExpectedAnswer(e.target.value)} placeholder="Model answer or key phrase" />
                            </div>
                        )}

                        <div>
                            <Label>Explanation (optional)</Label>
                            <Textarea value={explanationText} onChange={e => setExplanationText(e.target.value)} rows={2} placeholder="Explain the correct answer..." />
                        </div>

                        {isTeacher && !editingQuestion && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
                                <Clock className="w-4 h-4 inline mr-1.5" />
                                This question will be saved as a <strong>Draft</strong>. You can submit it for admin review when ready.
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={resetQuestionForm}>Cancel</Button>
                            <Button onClick={handleSubmitQuestion} disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}>
                                {editingQuestion ? 'Save Changes' : (isTeacher ? 'Save as Draft' : 'Add Question')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // ─── RENDER ──────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Database className="w-7 h-7 text-primary shrink-0" />
                        Question Bank
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {isAdmin ? 'Manage reusable questions with approval workflow' : 'Create and submit questions for review'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <Button variant="outline" onClick={() => setIsBankDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-1.5" />New Bank
                        </Button>
                    )}
                    {(isAdmin && selectedBankId) && (
                        <Button variant="outline" onClick={() => { setCsvPreview([]); setCsvErrors([]); setIsCsvDialogOpen(true); }}>
                            <Upload className="w-4 h-4 mr-1.5" />CSV Upload
                        </Button>
                    )}
                    {isTeacher && (
                        <Button variant="outline" onClick={() => { setCsvPreview([]); setCsvErrors([]); setIsCsvDialogOpen(true); }} disabled={!selectedBankId}>
                            <Upload className="w-4 h-4 mr-1.5" />CSV Upload
                        </Button>
                    )}
                    <Button onClick={() => { resetQuestionForm(); setIsAddDialogOpen(true); }} disabled={!selectedBankId && isTeacher}>
                        <Plus className="w-4 h-4 mr-1.5" />Add Question
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex-wrap h-auto gap-1">
                    {isAdmin && <TabsTrigger value="browse">Browse All</TabsTrigger>}
                    {isAdmin && (
                        <TabsTrigger value="pending" className="relative">
                            Approval Queue
                            {(pendingItems as any[]).length > 0 && (
                                <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                    {(pendingItems as any[]).length}
                                </span>
                            )}
                        </TabsTrigger>
                    )}
                    {isTeacher && <TabsTrigger value="mine">My Questions</TabsTrigger>}
                    {isTeacher && <TabsTrigger value="browse">Browse Bank</TabsTrigger>}
                </TabsList>

                {/* ── ADMIN: Browse All ── */}
                {isAdmin && (
                    <TabsContent value="browse" className="space-y-4 mt-4">
                        <Card>
                            <CardContent className="py-4 space-y-4">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Label>Question Bank</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                                <SelectTrigger><SelectValue placeholder="Select a bank..." /></SelectTrigger>
                                                <SelectContent>
                                                    {(banks as any[]).map(b => (
                                                        <SelectItem key={b.id} value={String(b.id)}>
                                                            {b.name} ({getSubjectName(b.subjectId)})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {selectedBankId && (
                                                <Button variant="destructive" size="icon" className="shrink-0"
                                                    onClick={() => setBankToDelete((banks as any[]).find(b => String(b.id) === selectedBankId))}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <FilterBar showStatus={true} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><BookOpen className="w-5 h-5" />Questions</span>
                                    <Badge variant="secondary">{(browseQuestions as any[]).length} found</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!selectedBankId ? (
                                    <div className="text-center py-12">
                                        <Database className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="text-lg font-semibold mb-1">Select a Question Bank</p>
                                        <p className="text-muted-foreground text-sm">Choose a bank from the dropdown to view its questions.</p>
                                    </div>
                                ) : loadingBrowse ? (
                                    <div className="flex justify-center py-8 text-muted-foreground">Loading questions...</div>
                                ) : (browseQuestions as any[]).length === 0 ? (
                                    <div className="text-center py-12">
                                        <Database className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="text-muted-foreground">No questions found. Add the first one!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(browseQuestions as any[]).map((q, idx) => (
                                            <QuestionCard key={q.id} q={q} idx={idx} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* ── ADMIN: Approval Queue ── */}
                {isAdmin && (
                    <TabsContent value="pending" className="space-y-4 mt-4">
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium flex items-center gap-1.5"><Filter className="w-4 h-4" />Filter pending</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs">Subject</Label>
                                        <Select value={pendingSubjectId} onValueChange={setPendingSubjectId}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="All subjects" /></SelectTrigger>
                                            <SelectContent>
                                                {(subjects as any[]).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Class</Label>
                                        <Select value={pendingClassId} onValueChange={setPendingClassId}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="All classes" /></SelectTrigger>
                                            <SelectContent>
                                                {(classes as any[]).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {(pendingSubjectId || pendingClassId) && (
                                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setPendingSubjectId(''); setPendingClassId(''); }}>Clear filters</Button>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-yellow-600" />
                                        Pending Approval
                                    </span>
                                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                        {(pendingItems as any[]).length} waiting
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingPending ? (
                                    <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>
                                ) : (pendingItems as any[]).length === 0 ? (
                                    <div className="text-center py-12">
                                        <CheckCheck className="w-12 h-12 mx-auto text-green-400 mb-3" />
                                        <p className="text-lg font-semibold mb-1">All clear!</p>
                                        <p className="text-muted-foreground text-sm">No questions waiting for approval.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(pendingItems as any[]).map((q, idx) => (
                                            <QuestionCard key={q.id} q={q} idx={idx} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* ── TEACHER: My Questions ── */}
                {isTeacher && (
                    <TabsContent value="mine" className="space-y-4 mt-4">
                        <Card>
                            <CardContent className="py-4 space-y-3">
                                <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-sm text-blue-800 space-y-1">
                                    <p className="font-medium">Workflow</p>
                                    <p className="text-xs text-blue-700">Create questions as <strong>Draft</strong> → Submit for admin review → Admin <strong>Approves/Rejects</strong> → Published to official bank</p>
                                </div>

                                <div className="flex gap-3 flex-wrap">
                                    <div>
                                        <Label className="text-xs">Filter by status</Label>
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="h-9 w-48 mt-1"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="submitted">Pending Review</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                                <SelectItem value="published">Published</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {filterStatus && <Button variant="ghost" size="sm" className="self-end mb-0.5" onClick={() => setFilterStatus('')}><X className="w-3 h-3 mr-1" />Clear</Button>}
                                </div>

                                {/* Status summary chips */}
                                {!loadingMine && (myQuestions as any[]).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {['draft','submitted','approved','rejected','published'].map(s => {
                                            const count = (myQuestions as any[]).filter(q => q.status === s).length;
                                            if (count === 0) return null;
                                            return <StatusBadge key={s} status={s} />;
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><BookOpen className="w-5 h-5" />My Questions</span>
                                    <Badge variant="secondary">{(myQuestions as any[]).length} total</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingMine ? (
                                    <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>
                                ) : (myQuestions as any[]).length === 0 ? (
                                    <div className="text-center py-12">
                                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="text-lg font-semibold mb-1">No questions yet</p>
                                        <p className="text-muted-foreground text-sm mb-4">Select a bank and create your first question.</p>
                                        <Button onClick={() => { resetQuestionForm(); setIsAddDialogOpen(true); }} disabled={!selectedBankId}>
                                            <Plus className="w-4 h-4 mr-1.5" />Add Question
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(myQuestions as any[]).map((q, idx) => (
                                            <QuestionCard key={q.id} q={q} idx={idx} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* ── TEACHER: Browse Bank ── */}
                {isTeacher && (
                    <TabsContent value="browse" className="space-y-4 mt-4">
                        <Card>
                            <CardContent className="py-4 space-y-4">
                                <div>
                                    <Label>Question Bank</Label>
                                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select a bank..." /></SelectTrigger>
                                        <SelectContent>
                                            {(banks as any[]).map(b => (
                                                <SelectItem key={b.id} value={String(b.id)}>
                                                    {b.name} ({getSubjectName(b.subjectId)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FilterBar showStatus={false} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Globe className="w-5 h-5 text-green-600" />Published Questions</span>
                                    {selectedBankId && <Badge variant="secondary">{(browseQuestions as any[]).length} found</Badge>}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!selectedBankId ? (
                                    <div className="text-center py-12">
                                        <Database className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="font-semibold mb-1">Select a Question Bank</p>
                                        <p className="text-muted-foreground text-sm">Choose a bank to browse published questions.</p>
                                    </div>
                                ) : loadingBrowse ? (
                                    <div className="flex justify-center py-8 text-muted-foreground">Loading...</div>
                                ) : (browseQuestions as any[]).length === 0 ? (
                                    <div className="text-center py-12">
                                        <Globe className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                                        <p className="text-muted-foreground">No published questions in this bank yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(browseQuestions as any[]).map((q, idx) => (
                                            <QuestionCard key={q.id} q={q} idx={idx} showActions={false} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* ── Teacher bank selector note (used for adding questions) ── */}
                {isTeacher && activeTab === 'mine' && !selectedBankId && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                        Select a Question Bank to add questions.
                        <div className="mt-2">
                            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Select a bank..." /></SelectTrigger>
                                <SelectContent>
                                    {(banks as any[]).map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name} ({getSubjectName(b.subjectId)})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </Tabs>

            {/* ─── Dialogs ─────────────────────────────────────────────────────────── */}
            <QuestionFormDialog />

            {/* Create Bank Dialog (admin only) */}
            {isAdmin && (
                <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Create Question Bank</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div><Label>Bank Name *</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. JSS1 English Questions" className="mt-1" /></div>
                            <div><Label>Description</Label><Input value={bankDescription} onChange={e => setBankDescription(e.target.value)} placeholder="Brief description" className="mt-1" /></div>
                            <div>
                                <Label>Subject *</Label>
                                <Select value={bankSubjectId} onValueChange={setBankSubjectId}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                                    <SelectContent>{(subjects as any[]).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button>
                                <Button disabled={!bankName.trim() || !bankSubjectId || createBankMutation.isPending}
                                    onClick={() => createBankMutation.mutate({ name: bankName.trim(), description: bankDescription || null, subjectId: parseInt(bankSubjectId) })}>
                                    Create Bank
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Question Dialog */}
            <Dialog open={!!questionToDelete} onOpenChange={v => { if (!v) setQuestionToDelete(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Question</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete this question? This cannot be undone.</p>
                    <div className="bg-muted rounded p-3 text-sm mt-2 line-clamp-3">{questionToDelete?.questionText}</div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setQuestionToDelete(null)}>Cancel</Button>
                        <Button variant="destructive" disabled={deleteQuestionMutation.isPending}
                            onClick={() => deleteQuestionMutation.mutate(questionToDelete.id)}>
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Bank Dialog */}
            <Dialog open={!!bankToDelete} onOpenChange={v => { if (!v) setBankToDelete(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Question Bank</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">Delete <strong>"{bankToDelete?.name}"</strong>? All questions in this bank will also be deleted.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setBankToDelete(null)}>Cancel</Button>
                        <Button variant="destructive" disabled={deleteBankMutation.isPending}
                            onClick={() => deleteBankMutation.mutate(bankToDelete.id)}>
                            Delete Bank
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject Question Dialog */}
            <Dialog open={!!rejectDialogQ} onOpenChange={v => { if (!v) { setRejectDialogQ(null); setRejectReason(''); } }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reject Question</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Provide a reason so the teacher knows what to fix.</p>
                        <div className="bg-muted rounded p-3 text-sm line-clamp-3">{rejectDialogQ?.questionText}</div>
                        <div>
                            <Label>Rejection Reason *</Label>
                            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="e.g. Options are unclear, please revise..." className="mt-1" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setRejectDialogQ(null); setRejectReason(''); }}>Cancel</Button>
                            <Button variant="destructive" disabled={!rejectReason.trim() || workflowMutation.isPending}
                                onClick={() => workflowMutation.mutate({ id: rejectDialogQ.id, action: 'reject', reason: rejectReason })}>
                                Reject Question
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* CSV Upload Dialog */}
            <Dialog open={isCsvDialogOpen} onOpenChange={v => { if (!v) { setIsCsvDialogOpen(false); setCsvPreview([]); setCsvErrors([]); setCsvPasteText(''); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Bulk Import Questions (CSV)</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button variant={csvInputMode === 'file' ? 'default' : 'outline'} size="sm" onClick={() => setCsvInputMode('file')}>Upload File</Button>
                            <Button variant={csvInputMode === 'paste' ? 'default' : 'outline'} size="sm" onClick={() => setCsvInputMode('paste')}>Paste CSV</Button>
                            <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="w-3.5 h-3.5 mr-1" />Template</Button>
                        </div>

                        {csvInputMode === 'file' ? (
                            <div className="border-2 border-dashed rounded-md p-6 text-center">
                                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mb-3">Select a CSV file</p>
                                <label className="cursor-pointer">
                                    <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm">Choose File</span>
                                    <input type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
                                </label>
                            </div>
                        ) : (
                            <div>
                                <Textarea value={csvPasteText} onChange={e => setCsvPasteText(e.target.value)} rows={6} placeholder="Paste CSV content here..." className="font-mono text-xs" />
                                <Button size="sm" className="mt-2" onClick={() => {
                                    try {
                                        const { questions, errors } = parseCSVContent(csvPasteText);
                                        setCsvPreview(questions); setCsvErrors(errors);
                                    } catch (e: any) { toast({ title: 'Parse error', description: e.message, variant: 'destructive' }); }
                                }}>Parse</Button>
                            </div>
                        )}

                        {csvErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                {csvErrors.map((e, i) => <p key={i}><AlertTriangle className="w-3 h-3 inline mr-1" />{e}</p>)}
                            </div>
                        )}

                        {csvPreview.length > 0 && (
                            <div>
                                <p className="text-sm font-medium mb-2">{csvPreview.length} questions ready to import</p>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {csvPreview.map((q, i) => (
                                        <div key={i} className="text-xs bg-muted px-3 py-2 rounded flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs shrink-0">{getTypeLabel(q.questionType)}</Badge>
                                            <span className="line-clamp-1">{q.questionText}</span>
                                        </div>
                                    ))}
                                </div>
                                {isTeacher && (
                                    <p className="text-xs text-muted-foreground mt-2"><Clock className="w-3 h-3 inline mr-1" />Imported questions will be saved as <strong>Draft</strong>.</p>
                                )}
                                <div className="flex justify-end gap-2 mt-3">
                                    <Button variant="outline" onClick={() => { setCsvPreview([]); setCsvErrors([]); }}>Clear</Button>
                                    <Button disabled={!selectedBankId || csvUploadMutation.isPending}
                                        onClick={() => csvUploadMutation.mutate({ bankId: parseInt(selectedBankId), questions: csvPreview })}>
                                        Import {csvPreview.length} Questions
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!selectedBankId && (
                            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />Please select a question bank first.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
