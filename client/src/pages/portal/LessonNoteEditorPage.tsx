import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import SectionEditor from '@/components/lesson-notes/SectionEditor';
import {
  Save, Send, Eye, AlertCircle, Info, BookOpen, Sparkles, Pencil,
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Heading3,
  Link as LinkIcon, Link2Off, Image as ImageIcon, Minus, Undo, Redo,
  Table as TableIcon, Rows, Columns, Trash2, Pilcrow, CheckCircle2,
  GraduationCap, BookMarked, Calendar, Clock, Hash, ChevronLeft, Loader2,
  Target, Package, Brain, Rocket, BookText, UserCog, Users, ClipboardCheck,
  FileCheck, ExternalLink,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

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

const EMPTY_SECTIONS = {
  objectives: '', previousKnowledge: '', materials: '',
  introduction: '', content: '', teacherActivities: '',
  studentActivities: '',
};
type Sections = typeof EMPTY_SECTIONS;
type SectionKey = keyof Sections;

function parseContent(rawContent: string | null, rawObjectives: string | null): Sections {
  if (rawContent) {
    try {
      const j = JSON.parse(rawContent);
      if (j._v === 2) return { ...EMPTY_SECTIONS, ...j };
    } catch {}
  }
  // Legacy: single HTML content + separate objectives field
  return {
    ...EMPTY_SECTIONS,
    objectives: rawObjectives || '',
    content: rawContent || '',
  };
}

function serializeContent(s: Sections): string {
  return JSON.stringify({ _v: 2, ...s });
}

// ── Section definitions ─────────────────────────────────────────────────────

const SECTION_DEFS = [
  {
    key: 'objectives' as SectionKey,
    label: 'Learning Objectives',
    icon: Target,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    headingBg: 'bg-blue-600',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    placeholder: 'By the end of this lesson, students should be able to:\n• Define…\n• Explain…\n• Apply…',
    hint: 'Specific, measurable outcomes',
    enableTable: false, enableImage: false,
  },
  {
    key: 'materials' as SectionKey,
    label: 'Instructional Materials',
    icon: Package,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    headingBg: 'bg-purple-600',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    placeholder: 'Textbooks, charts, models, specimens, whiteboard, markers…',
    hint: 'Physical and digital resources',
    enableTable: false, enableImage: false,
  },
  {
    key: 'previousKnowledge' as SectionKey,
    label: 'Previous Knowledge',
    icon: Brain,
    color: 'cyan',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    headingBg: 'bg-cyan-600',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-700',
    placeholder: 'Students are expected to already know about…',
    hint: 'Entry behaviour / prior learning',
    enableTable: false, enableImage: false,
  },
  {
    key: 'introduction' as SectionKey,
    label: 'Introduction',
    icon: Rocket,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    headingBg: 'bg-green-600',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-700',
    placeholder: 'How will you open the lesson and hook students?\nLink to prior knowledge, pose a question, show a scenario…',
    hint: 'Lesson opener / set induction',
    enableTable: false, enableImage: true,
  },
  {
    key: 'content' as SectionKey,
    label: 'Lesson Content',
    icon: BookText,
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    headingBg: 'bg-indigo-600',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-700',
    placeholder: 'Write the main lesson content here — definitions, explanations, worked examples, diagrams, and key concepts…',
    hint: 'Core instructional content',
    enableTable: true, enableImage: true,
    minHeight: '220px',
  },
  {
    key: 'teacherActivities' as SectionKey,
    label: "Teacher's Activities",
    icon: UserCog,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    headingBg: 'bg-orange-500',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-700',
    placeholder: 'Step 1 (5 min): Introduce the topic by…\nStep 2 (10 min): Explain and demonstrate…\nStep 3 (15 min): Guide practice…',
    hint: 'Step-by-step teacher actions',
    enableTable: false, enableImage: false,
  },
  {
    key: 'studentActivities' as SectionKey,
    label: "Students' Activities",
    icon: Users,
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    headingBg: 'bg-emerald-600',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    placeholder: '• Listen attentively and take notes\n• Answer oral questions\n• Participate in group activity\n• Complete practice exercises…',
    hint: 'Student tasks and participation',
    enableTable: false, enableImage: false,
  },
  {
    key: 'evaluation' as SectionKey,
    label: 'Evaluation',
    icon: ClipboardCheck,
    color: 'rose',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    headingBg: 'bg-rose-600',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    placeholder: '1. What is…?\n2. Explain the difference between… and…\n3. Give two examples of…\n4. Calculate…',
    hint: 'Questions to check understanding',
    enableTable: false, enableImage: false,
  },
  {
    key: 'assignment' as SectionKey,
    label: 'Assignment / Homework',
    icon: FileCheck,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    headingBg: 'bg-amber-500',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    placeholder: '1. Write a short note on…\n2. Draw and label…\n3. Solve the following…\n4. Research and present…',
    hint: 'Take-home tasks',
    enableTable: false, enableImage: false,
  },
  {
    key: 'references' as SectionKey,
    label: 'References',
    icon: ExternalLink,
    color: 'slate',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    headingBg: 'bg-gray-500',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    placeholder: '1. Author, A. (Year). Book Title. Publisher.\n2. Website Name. (Year). Article title. URL',
    hint: 'Books, websites, other sources',
    enableTable: false, enableImage: false,
  },
] as const;

// ── Shared Toolbar ───────────────────────────────────────────────────────────

function TBtn({ title, onClick, active, disabled, children }: {
  title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClick(); }}
          disabled={disabled}
          className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors shrink-0
            ${active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed'}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

function TSep() {
  return <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5 shrink-0" />;
}

function SharedToolbar({
  activeEditor,
  activeSectionLabel,
  onImageUpload,
  imageInputRef,
  disabled,
}: {
  activeEditor: any;
  activeSectionLabel: string;
  onImageUpload: () => void;
  imageInputRef: React.RefObject<HTMLInputElement>;
  disabled: boolean;
}) {
  // Guard against stale/destroyed editor references — in Tiptap v3, when an
  // editor is destroyed its commandManager is set to null, so any call to
  // editor.can() / editor.chain() / editor.commands would crash.
  const e = (activeEditor && !activeEditor.isDestroyed) ? activeEditor : null;
  const hasTable = e?.isActive('table');
  const showImageBtn = activeSectionLabel === 'Lesson Content' || activeSectionLabel === 'Introduction';
  const showTableBtn = activeSectionLabel === 'Lesson Content';

  const setLink = () => {
    if (!e) return;
    const prev = e.getAttributes('link').href || '';
    const url = window.prompt('Enter URL:', prev);
    if (url === null) return;
    if (url === '') { e.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    e.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm px-3 py-2 flex flex-wrap items-center gap-0.5">
      {!e || disabled ? (
        <span className="text-xs text-gray-400 italic px-2 py-1 select-none">
          {disabled ? 'Read-only mode' : '← Click any section below to start editing'}
        </span>
      ) : (
        <>
          {/* Section label */}
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-1 whitespace-nowrap hidden sm:inline">
            {activeSectionLabel}
          </span>
          <TSep />

          {/* History */}
          <TBtn title="Undo (Ctrl+Z)" onClick={() => e.chain().focus().undo().run()} disabled={!e.can().undo()}>
            <Undo className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Redo (Ctrl+Y)" onClick={() => e.chain().focus().redo().run()} disabled={!e.can().redo()}>
            <Redo className="w-3.5 h-3.5" />
          </TBtn>
          <TSep />

          {/* Paragraph styles */}
          <TBtn title="Paragraph" onClick={() => e.chain().focus().setParagraph().run()} active={e.isActive('paragraph') && !e.isActive('heading')}>
            <Pilcrow className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Heading 1" onClick={() => e.chain().focus().toggleHeading({ level: 1 }).run()} active={e.isActive('heading', { level: 1 })}>
            <Heading1 className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Heading 2" onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()} active={e.isActive('heading', { level: 2 })}>
            <Heading2 className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Heading 3" onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()} active={e.isActive('heading', { level: 3 })}>
            <Heading3 className="w-3.5 h-3.5" />
          </TBtn>
          <TSep />

          {/* Inline marks */}
          <TBtn title="Bold (Ctrl+B)" onClick={() => e.chain().focus().toggleBold().run()} active={e.isActive('bold')}>
            <Bold className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Italic (Ctrl+I)" onClick={() => e.chain().focus().toggleItalic().run()} active={e.isActive('italic')}>
            <Italic className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Underline (Ctrl+U)" onClick={() => e.chain().focus().toggleUnderline().run()} active={e.isActive('underline')}>
            <Underline className="w-3.5 h-3.5" />
          </TBtn>
          <TSep />

          {/* Lists */}
          <TBtn title="Bullet List" onClick={() => e.chain().focus().toggleBulletList().run()} active={e.isActive('bulletList')}>
            <List className="w-3.5 h-3.5" />
          </TBtn>
          <TBtn title="Numbered List" onClick={() => e.chain().focus().toggleOrderedList().run()} active={e.isActive('orderedList')}>
            <ListOrdered className="w-3.5 h-3.5" />
          </TBtn>
          <TSep />

          {/* Link */}
          <TBtn title="Insert / Edit Link" onClick={setLink} active={e.isActive('link')}>
            <LinkIcon className="w-3.5 h-3.5" />
          </TBtn>
          {e.isActive('link') && (
            <TBtn title="Remove Link" onClick={() => e.chain().focus().unsetLink().run()}>
              <Link2Off className="w-3.5 h-3.5" />
            </TBtn>
          )}

          {/* Horizontal rule */}
          <TBtn title="Horizontal Divider" onClick={() => e.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-3.5 h-3.5" />
          </TBtn>

          {/* Image — only for content/intro sections */}
          {showImageBtn && (
            <>
              <TSep />
              <TBtn title="Insert Image" onClick={onImageUpload}>
                <ImageIcon className="w-3.5 h-3.5" />
              </TBtn>
            </>
          )}

          {/* Table — only for content section */}
          {showTableBtn && (
            <>
              <TSep />
              <TBtn title="Insert Table" onClick={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <TableIcon className="w-3.5 h-3.5" />
              </TBtn>
              {hasTable && (
                <>
                  <TBtn title="Add Row" onClick={() => e.chain().focus().addRowAfter().run()}>
                    <Rows className="w-3.5 h-3.5" />
                  </TBtn>
                  <TBtn title="Add Column" onClick={() => e.chain().focus().addColumnAfter().run()}>
                    <Columns className="w-3.5 h-3.5" />
                  </TBtn>
                  <TBtn title="Delete Table" onClick={() => e.chain().focus().deleteTable().run()}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </TBtn>
                </>
              )}
            </>
          )}
        </>
      )}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(ev) => {
        const file = ev.target.files?.[0];
        if (!file || !e) return;
        if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return; }
        const reader = new FileReader();
        reader.onload = (re) => {
          const src = re.target?.result as string;
          if (src) e.chain().focus().setImage({ src, alt: file.name }).run();
        };
        reader.readAsDataURL(file);
        ev.target.value = '';
      }} />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

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

  // ── State ─────────────────────────────────────────────────────────────────

  const [title,       setTitle]       = useState(query.topicName || '');
  const [sections,    setSections]    = useState<Sections>({ ...EMPTY_SECTIONS });
  const [initialized, setInitialized] = useState(false);
  // mode: 'choose' (start screen) | 'editing' (document editor)
  const [mode, setMode] = useState<'choose' | 'editing'>(isEdit ? 'editing' : 'choose');
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiDialog,  setAiDialog]      = useState(false);

  // Shared toolbar
  const [activeEditor, setActiveEditor]     = useState<any>(null);
  const [activeSectionLabel, setActiveSectionLabel] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null!);

  // ── Load existing note ────────────────────────────────────────────────────

  const { data: note, isLoading: noteLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
    enabled: isEdit,
  });

  useEffect(() => {
    if (initialized) return;
    if (isEdit && note) {
      setTitle(note.title || '');
      setSections(parseContent(note.content, note.objectives));
      setInitialized(true);
    }
    if (!isEdit) {
      setTitle(query.topicName || '');
      setInitialized(true);
    }
  }, [note, isEdit, initialized]);

  // ── Settings for school branding ──────────────────────────────────────────

  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });

  // ── Section handlers ──────────────────────────────────────────────────────

  const updateSection = useCallback((key: SectionKey, html: string) => {
    setSections(s => ({ ...s, [key]: html }));
  }, []);

  const handleSectionFocus = useCallback((key: SectionKey, editor: any) => {
    // Only store editor if it's alive
    if (editor && !editor.isDestroyed) {
      setActiveEditor(editor);
      const def = SECTION_DEFS.find(d => d.key === key);
      setActiveSectionLabel(def?.label ?? '');
    }
  }, []);

  const handleSectionBlur = useCallback(() => {
    // Small delay so clicking toolbar buttons doesn't clear the active editor
    // before the toolbar's onMouseDown (which uses preventDefault) fires
    setTimeout(() => {
      setActiveEditor((prev: any) => {
        if (prev && prev.isDestroyed) return null;
        return prev;
      });
    }, 150);
  }, []);

  // ── Save / Submit / Publish ───────────────────────────────────────────────

  const buildPayload = (extra?: Record<string, any>) => ({
    title: title.trim(),
    content: serializeContent(sections),
    objectives: sections.objectives,
    ...extra,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = buildPayload();
      if (isEdit) return (await apiRequest('PUT', `/api/lesson-notes/${id}`, body)).json();
      return (await apiRequest('POST', '/api/lesson-notes', {
        ...body,
        topicId:   parseInt(query.topicId),
        classId:   parseInt(query.classId),
        subjectId: parseInt(query.subjectId),
        termId:    parseInt(query.termId),
      })).json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: isEdit ? 'Changes saved' : 'Note created', description: 'Saved as draft.' });
      if (!isEdit) navigate(`${basePortal}/lesson-notes/edit/${data.id}?${new URLSearchParams(query as any).toString()}`);
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      let noteId = id ? parseInt(id) : null;
      const body = buildPayload();
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          ...body, topicId: parseInt(query.topicId), classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId), termId: parseInt(query.termId),
        })).json();
        noteId = created.id;
      } else {
        await apiRequest('PUT', `/api/lesson-notes/${noteId}`, body);
      }
      return (await apiRequest('POST', `/api/lesson-notes/${noteId}/submit`)).json();
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
      let noteId = id ? parseInt(id) : null;
      const body = buildPayload();
      if (!noteId) {
        const created: EnrichedNote = await (await apiRequest('POST', '/api/lesson-notes', {
          ...body, topicId: parseInt(query.topicId), classId: parseInt(query.classId),
          subjectId: parseInt(query.subjectId), termId: parseInt(query.termId),
        })).json();
        noteId = created.id;
      } else {
        await apiRequest('PUT', `/api/lesson-notes/${noteId}`, body);
      }
      return (await apiRequest('POST', `/api/lesson-notes/${noteId}/approve-publish`)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      toast({ title: 'Published!', description: 'Lesson note is now visible to students.' });
      navigate(listUrl);
    },
    onError: (e: any) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  // ── AI Generation ─────────────────────────────────────────────────────────

  const generateWithAI = async () => {
    if (!title.trim()) {
      toast({ title: 'Topic required', description: 'Please enter a topic before generating.', variant: 'destructive' });
      return;
    }
    setAiDialog(false);
    setAiLoading(true);
    setMode('editing');
    try {
      const res = await apiRequest('POST', '/api/lesson-notes/generate', {
        topic:       title,
        className:   query.className,
        subjectName: query.subjectName,
        termName:    query.termName,
        weekNumber:  '',
      });
      const data = await res.json();
      if (data.sections) {
        setSections({ ...EMPTY_SECTIONS, ...data.sections });
        toast({
          title: data.aiGenerated ? '✨ AI generation complete' : '📋 Template applied',
          description: data.aiGenerated
            ? 'All sections have been filled in. Review and customise as needed.'
            : 'A structured template has been applied. Edit each section to match your lesson.',
        });
      }
    } catch {
      toast({ title: 'Generation failed', description: 'Could not generate content. Please try again.', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const busy = saveMutation.isPending || submitMutation.isPending || publishMutation.isPending;
  const canSave     = !!(title.trim());
  const currentStatus = note?.status;
  const canEdit     = !currentStatus || ['draft', 'rejected'].includes(currentStatus) || isAdmin;
  const schoolName  = settings?.schoolName ?? 'School';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Start screen (choose mode) ────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Back */}
          <button onClick={() => navigate(listUrl)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back to Lesson Notes
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
              <BookOpen className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Lesson Note</h1>
            {(query.topicName || query.className) && (
              <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
                {[query.className, query.subjectName, query.termName].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Topic input */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 mb-5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Topic <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Whole Numbers"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* AI */}
            <button
              onClick={() => { if (title.trim()) generateWithAI(); else toast({ title: 'Enter a topic first', variant: 'destructive' }); }}
              disabled={aiLoading}
              className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl p-6 text-left shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/5 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  {aiLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                  <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <h3 className="text-lg font-bold mb-1">Generate with AI</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Instantly fill all lesson note sections with AI-generated content based on your topic and subject.
                </p>
              </div>
            </button>

            {/* Manual */}
            <button
              onClick={() => setMode('editing')}
              className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 text-gray-800 dark:text-gray-200 rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <Pencil className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-bold mb-1">Write Manually</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                Start with an empty template and write each section yourself with full formatting tools.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Document Editor ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950">

      {/* ── Sticky top action bar ── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2 flex-wrap">
          {/* Back */}
          <button
            onClick={() => navigate(listUrl)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-1 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Lesson Notes</span>
          </button>

          {/* Title & meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {title || 'Untitled Lesson Note'}
              </h1>
              {note && <StatusBadge status={note.status} />}
            </div>
            <p className="text-xs text-gray-400 truncate hidden sm:block">
              {[query.className, query.subjectName, query.termName].filter(Boolean).join(' → ')}
            </p>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* AI generate */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 gap-1.5 text-xs font-semibold"
                onClick={generateWithAI}
                disabled={aiLoading || busy}
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiLoading ? 'Generating…' : 'Generate with AI'}
              </Button>

              {/* Save draft */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs font-semibold gap-1.5"
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || busy}
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
              </Button>

              {/* Submit / Publish */}
              {isTeacher && (
                <Button
                  size="sm"
                  className="h-8 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 gap-1.5"
                  onClick={() => submitMutation.mutate()}
                  disabled={!canSave || busy}
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  className="h-8 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  onClick={() => publishMutation.mutate()}
                  disabled={!canSave || busy}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">

        {/* Rejection banner */}
        {note?.rejectionReason && (
          <div className="flex gap-2.5 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong>Rejected:</strong> {note.rejectionReason}</div>
          </div>
        )}
        {!canEdit && isTeacher && (
          <div className="flex gap-2.5 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400 shadow-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>This note is <strong>{currentStatus}</strong> and cannot be edited.</div>
          </div>
        )}

        {/* AI loading overlay */}
        {aiLoading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">AI is generating your lesson note…</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Filling all sections based on topic, class, and subject</p>
            </div>
          </div>
        )}

        {/* Shared toolbar */}
        <div className="sticky top-[57px] z-20">
          <SharedToolbar
            activeEditor={activeEditor}
            activeSectionLabel={activeSectionLabel}
            onImageUpload={() => imageInputRef.current?.click()}
            imageInputRef={imageInputRef}
            disabled={!canEdit || busy || aiLoading}
          />
        </div>

        {/* ── Document ── */}
        {(isEdit && noteLoading) ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 space-y-5 animate-pulse">
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">

            {/* ── School letterhead ── */}
            <div className="bg-blue-700 px-6 py-5 text-white text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-75 mb-0.5">
                {settings?.schoolAddress || ''}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-wide uppercase">
                {schoolName}
              </h2>
              <div className="mt-2 inline-block bg-white/20 rounded-full px-5 py-1 text-sm font-bold tracking-widest uppercase">
                Lesson Note
              </div>
            </div>

            {/* ── Meta grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
              {[
                { icon: GraduationCap, label: 'Class',   value: query.className   || '—' },
                { icon: BookMarked,    label: 'Subject', value: query.subjectName || '—' },
                { icon: Calendar,      label: 'Term',    value: query.termName    || '—' },
                { icon: Hash,          label: 'Date',    value: today },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex items-start gap-2">
                  <Icon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Topic ── */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-md shrink-0">
                  <BookOpen className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Topic</span>
              </div>
              {canEdit ? (
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter lesson topic…"
                  className="w-full text-xl sm:text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:ring-0 p-0"
                />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{title}</p>
              )}
            </div>

            {/* ── Lesson sections ── */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {SECTION_DEFS.map((def) => {
                const Icon = def.icon;
                return (
                  <div key={def.key} className={`${def.bgColor} dark:bg-transparent`}>
                    {/* Section header */}
                    <div className={`flex items-center gap-2.5 px-6 py-3 border-b ${def.borderColor} dark:border-gray-700`}>
                      <div className={`flex items-center justify-center w-7 h-7 ${def.iconBg} dark:bg-gray-700 rounded-lg shrink-0`}>
                        <Icon className={`h-4 w-4 ${def.iconColor} dark:text-gray-300`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold uppercase tracking-widest ${def.iconColor} dark:text-gray-300`}>
                          {def.label}
                        </span>
                        <span className="text-xs text-gray-400 ml-2 hidden sm:inline">{def.hint}</span>
                      </div>
                      {sections[def.key] && !canEdit && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      )}
                    </div>

                    {/* Section content */}
                    <div className={`px-6 py-4 bg-white dark:bg-gray-900/40 ${!canEdit ? 'pointer-events-none opacity-80' : ''}`}>
                      {canEdit ? (
                        <SectionEditor
                          content={sections[def.key]}
                          onChange={(html) => updateSection(def.key, html)}
                          onFocused={(editor) => handleSectionFocus(def.key, editor)}
                          onBlurred={handleSectionBlur}
                          placeholder={def.placeholder}
                          disabled={!canEdit || busy}
                          minHeight={(def as any).minHeight || '72px'}
                          enableTable={def.enableTable}
                          enableImage={def.enableImage}
                        />
                      ) : (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                          dangerouslySetInnerHTML={{ __html: sections[def.key] || `<p class="text-gray-400 italic">No content</p>` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Document footer ── */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last updated: {note ? new Date(note.updatedAt).toLocaleDateString() : today}</span>
                  {note?.creatorName && <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> {note.creatorName}</span>}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl text-xs gap-1.5"
                      onClick={() => saveMutation.mutate()}
                      disabled={!canSave || busy}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
                    </Button>
                    {isTeacher && (
                      <Button
                        size="sm"
                        className="h-8 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 gap-1.5"
                        onClick={() => submitMutation.mutate()}
                        disabled={!canSave || busy}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit for Review
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                        onClick={() => publishMutation.mutate()}
                        disabled={!canSave || busy}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Save & Publish
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
