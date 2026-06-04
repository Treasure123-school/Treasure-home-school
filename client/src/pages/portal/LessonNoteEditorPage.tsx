/**
 * LessonNoteEditorPage — full-page Google Docs-style lesson note editor.
 * Uses DocEditor (Tiptap v3) for the document canvas.
 * Supports: AI generation, auto-save (2s debounce), preview/print mode,
 * drag-and-drop images, rich formatting toolbar.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import DocEditor from '@/components/lesson-notes/DocEditor';
import {
  Save, Send, Eye, EyeOff, AlertCircle, Info, BookOpen, Sparkles, Pencil,
  ChevronLeft, Loader2, GraduationCap, BookMarked, Calendar, Printer,
  CheckCircle2, Clock, CloudOff,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseQuery(search: string) {
  const p = new URLSearchParams(search);
  return {
    topicId:     p.get('topicId') || '',
    classId:     p.get('classId') || '',
    subjectId:   p.get('subjectId') || '',
    termId:      p.get('termId') || '',
    topicName:   p.get('topicName')   ? decodeURIComponent(p.get('topicName')!)   : '',
    className:   p.get('className')   ? decodeURIComponent(p.get('className')!)   : '',
    subjectName: p.get('subjectName') ? decodeURIComponent(p.get('subjectName')!) : '',
    termName:    p.get('termName')    ? decodeURIComponent(p.get('termName')!)    : '',
  };
}

/** Convert old section-based content (v2 JSON) to single HTML for the new editor */
function migrateContent(rawContent: string | null, rawObjectives: string | null): string {
  if (!rawContent) return rawObjectives ? `<p>${rawObjectives}</p>` : '';
  try {
    const j = JSON.parse(rawContent);
    if (j._v === 3) return j.html || '';

    // v2: sections object → merge into single HTML document
    if (j._v === 2) {
      const LABELS: Record<string, string> = {
        objectives: 'Learning Objectives',
        previousKnowledge: 'Previous Knowledge',
        materials: 'Instructional Materials',
        introduction: 'Introduction / Set Induction',
        content: 'Lesson Content',
        teacherActivities: "Teacher's Activities",
        studentActivities: "Students' Activities",
        evaluation: 'Evaluation',
        assignment: 'Assignment / Homework',
        references: 'References',
      };
      const ORDER = ['objectives','previousKnowledge','materials','introduction','content','teacherActivities','studentActivities','evaluation','assignment','references'];
      let html = '';
      ORDER.forEach((key, idx) => {
        const val = j[key];
        if (!val || !val.trim()) return;
        html += `<h2>${idx + 1}. ${LABELS[key] || key.toUpperCase()}</h2>${val}`;
      });
      return html || '';
    }
  } catch {}
  // Plain HTML from old editor
  return rawContent || '';
}

function serializeContent(html: string): string {
  return JSON.stringify({ _v: 3, html });
}

// ── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saved') return (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />Saved
    </span>
  );
  if (status === 'saving') return (
    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <CloudOff className="h-3.5 w-3.5" />Error saving
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
      <Clock className="h-3.5 w-3.5" />Unsaved
    </span>
  );
}

// ── Start / choose screen ────────────────────────────────────────────────────

function StartScreen({
  title, onTitleChange, onManual, onAI, aiLoading, listUrl, context,
}: {
  title: string; onTitleChange: (t: string) => void;
  onManual: () => void; onAI: () => void; aiLoading: boolean;
  listUrl: string; context: { className: string; subjectName: string; termName: string };
}) {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <button onClick={() => navigate(listUrl)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-8 transition-colors">
          <ChevronLeft className="h-4 w-4" />Back to Lesson Notes
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
            <BookOpen className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Lesson Note</h1>
          {context.className && (
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
              {[context.className, context.subjectName, context.termName].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Topic <span className="text-rose-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onManual(); }}
            autoFocus
            placeholder="e.g. Fishery: Types of Fish and Fishing Methods"
            className="w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => { if (title.trim()) onAI(); }}
            disabled={aiLoading || !title.trim()}
            className="group relative bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl p-5 text-left transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-2.5">
              {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Recommended</span>
            </div>
            <h3 className="text-base font-bold mb-1">Generate with AI</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Instantly fill the document with AI-generated, curriculum-aligned content.
            </p>
          </button>

          <button
            onClick={onManual}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 text-gray-800 dark:text-gray-200 rounded-xl p-5 text-left transition-all shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <Pencil className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-base font-bold mb-1">Write Manually</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Open the full-page editor and write your lesson note from scratch.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview / Print overlay ──────────────────────────────────────────────────

function PreviewOverlay({
  title, content, settings, meta, note, onClose,
}: {
  title: string; content: string; settings: any; meta: any; note: EnrichedNote | undefined; onClose: () => void;
}) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="fixed inset-0 z-50 bg-gray-200 dark:bg-gray-900 overflow-auto print:bg-white">
      {/* Print action bar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3">
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
          <EyeOff className="h-4 w-4" />Close Preview
        </button>
        <div className="flex-1" />
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors">
          <Printer className="h-4 w-4" />Print / Export PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="py-8 px-4 flex justify-center print:p-0 print:block">
        <div className="w-full max-w-3xl bg-white shadow-md print:shadow-none" style={{ fontFamily: 'Georgia, serif' }}>

          {/* Letterhead */}
          <div className="border-b-2 border-blue-700 px-12 py-6 text-center">
            {settings?.schoolLogoUrl && (
              <img src={settings.schoolLogoUrl} alt="logo" className="h-14 mx-auto mb-2 object-contain" />
            )}
            <p className="text-lg font-bold uppercase tracking-widest text-blue-700">
              {settings?.schoolName || 'School'}
            </p>
            {settings?.schoolAddress && (
              <p className="text-xs text-gray-500 mt-0.5">{settings.schoolAddress}</p>
            )}
            <div className="mt-3 inline-block border border-blue-700 text-blue-700 text-xs font-bold uppercase tracking-widest px-8 py-1">
              Lesson Note
            </div>
          </div>

          {/* Meta strip */}
          <div className="border-b border-gray-200 px-12 py-3 flex flex-wrap gap-x-8 gap-y-1 text-xs">
            {meta.className && <span><strong>Class:</strong> {meta.className}</span>}
            {meta.subjectName && <span><strong>Subject:</strong> {meta.subjectName}</span>}
            {meta.termName && <span><strong>Term:</strong> {meta.termName}</span>}
            <span><strong>Date:</strong> {today}</span>
            {note?.creatorName && <span><strong>Teacher:</strong> {note.creatorName}</span>}
          </div>

          {/* Topic */}
          <div className="border-b border-gray-100 px-12 py-4 bg-gray-50">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Topic</p>
            <p className="text-xl font-bold text-gray-900">{title}</p>
          </div>

          {/* Content */}
          <div
            className="px-12 py-8 prose prose-sm max-w-none print-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Footer */}
          <div className="border-t border-gray-100 px-12 py-4 flex items-center justify-between text-xs text-gray-400">
            <span>{settings?.schoolName || ''}</span>
            <span>{today}</span>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body > *:not(.fixed) { display: none !important; }
          .fixed { position: static !important; inset: auto !important; }
        }
        .print-content h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.4em; }
        .print-content h2 { font-size: 1.2rem; font-weight: 700; margin: 0.9em 0 0.3em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
        .print-content h3 { font-size: 1.05rem; font-weight: 600; margin: 0.75em 0 0.25em; }
        .print-content p  { margin: 0.35em 0; line-height: 1.7; }
        .print-content ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .print-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .print-content li { margin: 0.15em 0; }
        .print-content table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.875rem; }
        .print-content th { background: #f8fafc; font-weight: 600; border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; }
        .print-content td { border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; }
        .print-content strong { font-weight: 700; }
        .print-content em { font-style: italic; }
        .print-content a { color: #2563eb; text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LessonNoteEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit    = !!id;
  const isAdmin   = user?.roleId === ROLE_IDS.ADMIN || user?.roleId === ROLE_IDS.SUPER_ADMIN;
  const isTeacher = user?.roleId === ROLE_IDS.TEACHER;
  const basePortal = isAdmin ? '/portal/admin' : '/portal/teacher';
  const listUrl    = `${basePortal}/lesson-notes`;

  const query = parseQuery(window.location.search);

  // ── State ──────────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(query.topicName || '');
  const [content,     setContent]     = useState('');
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<'choose' | 'editing'>(isEdit ? 'editing' : 'choose');
  const [preview, setPreview]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [saveStatus, setSaveStatus]   = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  // Auto-save timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNoteId   = useRef<number | null>(isEdit && id ? parseInt(id) : null);

  // ── Load existing note ─────────────────────────────────────────────────────
  const { data: note, isLoading: noteLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
    enabled: isEdit,
  });

  useEffect(() => {
    if (initialized) return;
    if (isEdit && note) {
      setTitle(note.title || '');
      setContent(migrateContent(note.content, note.objectives));
      setInitialized(true);
      setSaveStatus('saved');
    }
    if (!isEdit) {
      setTitle(query.topicName || '');
      setInitialized(true);
    }
  }, [note, isEdit, initialized]);

  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });

  // ── Derived permissions ────────────────────────────────────────────────────
  const currentStatus = note?.status;
  const canEdit = !currentStatus || ['draft', 'rejected'].includes(currentStatus) || isAdmin;

  // ── Content change handler + auto-save ────────────────────────────────────
  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    setSaveStatus('unsaved');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      triggerAutoSave(html);
    }, 2000);
  }, [title]);

  // ── Save mutations ─────────────────────────────────────────────────────────
  const buildPayload = (html: string, extra?: Record<string, any>) => ({
    title: title.trim() || 'Untitled',
    content: serializeContent(html),
    objectives: '',
    ...extra,
  });

  const doSave = useCallback(async (html: string): Promise<number> => {
    const body = buildPayload(html);
    const nid = savedNoteId.current;
    if (nid) {
      await apiRequest('PUT', `/api/lesson-notes/${nid}`, body);
      return nid;
    }
    const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
      ...body,
      topicId:   parseInt(query.topicId),
      classId:   parseInt(query.classId),
      subjectId: parseInt(query.subjectId),
      termId:    parseInt(query.termId),
    })).json();
    savedNoteId.current = created.id;
    return created.id;
  }, [title, query]);

  const triggerAutoSave = useCallback(async (html: string) => {
    if (!title.trim()) return;
    setSaveStatus('saving');
    try {
      const nid = await doSave(html);
      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      // Update URL to edit route on first save
      if (!isEdit && savedNoteId.current) {
        const params = new URLSearchParams(query as any).toString();
        window.history.replaceState({}, '', `${basePortal}/lesson-notes/edit/${nid}?${params}`);
      }
    } catch {
      setSaveStatus('error');
    }
  }, [doSave, isEdit, query, basePortal, title]);

  const saveMutation = useMutation({
    mutationFn: () => doSave(content),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      setSaveStatus('saved');
      toast({ title: 'Saved', description: 'Draft saved successfully.' });
    },
    onError: (e: any) => {
      setSaveStatus('error');
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const nid = await doSave(content);
      return (await apiRequest('POST', `/api/lesson-notes/${nid}/submit`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Submitted for review', description: 'The admin will review your lesson note.' });
      navigate(listUrl);
    },
    onError: (e: any) => toast({ title: 'Submit failed', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const nid = await doSave(content);
      return (await apiRequest('POST', `/api/lesson-notes/${nid}/approve-publish`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Published!', description: 'Lesson note is now visible to students.' });
      navigate(listUrl);
    },
    onError: (e: any) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  // ── AI Generation ──────────────────────────────────────────────────────────
  const generateWithAI = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic before generating.', variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    setMode('editing');
    try {
      const res = await apiRequest('POST', '/api/lesson-notes/generate', {
        topic: title, className: query.className, subjectName: query.subjectName,
        termName: query.termName, weekNumber: '',
      });
      const data = await res.json();
      if (data.sections) {
        // Convert sections to a single HTML document
        const LABELS: Record<string, string> = {
          objectives: '1. Learning Objectives',
          previousKnowledge: '2. Previous Knowledge',
          materials: '3. Instructional Materials',
          introduction: '4. Introduction / Set Induction',
          content: '5. Lesson Content',
          teacherActivities: "6. Teacher's Activities",
          studentActivities: "7. Students' Activities",
        };
        const ORDER = ['objectives','previousKnowledge','materials','introduction','content','teacherActivities','studentActivities'];
        let html = `<h1>${title}</h1>`;
        ORDER.forEach(key => {
          const val = data.sections[key];
          if (val?.trim()) html += `<h2>${LABELS[key]}</h2>${val}`;
        });
        setContent(html);
        setSaveStatus('unsaved');
        toast({
          title: data.aiGenerated ? '✨ AI generation complete' : '📋 Template applied',
          description: data.aiGenerated ? 'Document filled. Review and customise as needed.' : 'Template applied. Edit to match your lesson.',
        });
      }
    } catch {
      toast({ title: 'Generation failed', description: 'Could not generate. Try again.', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }, [title, query, toast]);

  const busy = saveMutation.isPending || submitMutation.isPending || publishMutation.isPending;

  // ── Start screen ───────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <StartScreen
        title={title}
        onTitleChange={setTitle}
        onManual={() => setMode('editing')}
        onAI={generateWithAI}
        aiLoading={aiLoading}
        listUrl={listUrl}
        context={{ className: query.className, subjectName: query.subjectName, termName: query.termName }}
      />
    );
  }

  // ── Preview overlay ────────────────────────────────────────────────────────
  if (preview) {
    return (
      <PreviewOverlay
        title={title}
        content={content}
        settings={settings}
        meta={{ className: query.className, subjectName: query.subjectName, termName: query.termName }}
        note={note}
        onClose={() => setPreview(false)}
      />
    );
  }

  // ── Full-page editor ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">

      {/* ── Top action bar ── */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30">
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
          {/* Back */}
          <button onClick={() => navigate(listUrl)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors shrink-0">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Notes</span>
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {/* Editable title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled"
            className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 truncate"
          />

          {/* Status badge */}
          {note && <StatusBadge status={note.status} />}

          {/* Save indicator */}
          <SaveIndicator status={saveStatus} />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {canEdit && (
              <Button size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 rounded border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 font-semibold"
                onClick={generateWithAI} disabled={aiLoading || busy}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{aiLoading ? 'Generating…' : 'AI Generate'}</span>
              </Button>
            )}

            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded"
              onClick={() => setPreview(true)}>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </Button>

            {canEdit && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded font-semibold"
                onClick={() => saveMutation.mutate()} disabled={busy}>
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{saveMutation.isPending ? 'Saving…' : 'Save'}</span>
              </Button>
            )}

            {isTeacher && canEdit && (
              <Button size="sm" className="h-8 text-xs gap-1.5 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
                onClick={() => submitMutation.mutate()} disabled={busy}>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{submitMutation.isPending ? 'Submitting…' : 'Submit'}</span>
              </Button>
            )}

            {isAdmin && (
              <Button size="sm" className="h-8 text-xs gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
                onClick={() => publishMutation.mutate()} disabled={busy}>
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{publishMutation.isPending ? 'Publishing…' : 'Publish'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Meta context strip */}
        {(query.className || query.subjectName || query.termName) && (
          <div className="flex items-center gap-4 px-4 pb-2 flex-wrap">
            {query.className && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <GraduationCap className="h-3 w-3" />{query.className}
              </span>
            )}
            {query.subjectName && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <BookMarked className="h-3 w-3" />{query.subjectName}
              </span>
            )}
            {query.termName && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Calendar className="h-3 w-3" />{query.termName}
              </span>
            )}
          </div>
        )}

        {/* Notices */}
        {note?.rejectionReason && (
          <div className="mx-4 mb-2 flex gap-2 p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 rounded">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Rejected:</strong> {note.rejectionReason}</span>
          </div>
        )}
        {!canEdit && isTeacher && (
          <div className="mx-4 mb-2 flex gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 rounded">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>This note is <strong>{currentStatus}</strong> and cannot be edited.</span>
          </div>
        )}
        {aiLoading && (
          <div className="mx-4 mb-2 flex items-center gap-2 p-2.5 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300 rounded">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            AI is generating your lesson note — this takes 10–20 seconds…
          </div>
        )}
      </div>

      {/* ── Document editor (fills remaining height) ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {(isEdit && noteLoading) ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : (
          <DocEditor
            content={content}
            onChange={canEdit ? handleContentChange : () => {}}
            disabled={!canEdit || busy}
            placeholder={
              canEdit
                ? 'Start writing your lesson note here, or click "AI Generate" above to fill it automatically…'
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
