/**
 * LessonNoteEditorPage — full-page Google Docs-style lesson note editor.
 *
 * Architecture (image generation):
 *   TipTap's ProseMirror schema strips unknown block elements like
 *   <figure><div class="ai-img-skeleton"> — so skeleton placeholders can't
 *   live in TipTap during generation. Instead we use a two-phase approach:
 *
 *   Phase 1 (isGeneratingImages === true):
 *     A plain dangerouslySetInnerHTML div renders the full skeleton HTML with
 *     working shimmer CSS + per-image progress bars updated via direct DOM
 *     manipulation (zero React re-renders during progress ticks).
 *
 *   Phase 2 (images done / user clicks Edit):
 *     liveHtmlRef now contains only real <img> tags (no divs), which TipTap's
 *     Image extension handles perfectly. DocEditor receives this HTML.
 *
 *   Single-diagram regen (regenSingle):
 *     replaceFigWithSkeleton uses a loading SVG as <img src> so TipTap renders
 *     a visible placeholder without stripping it.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/config/api';
import { useAuth } from '@/lib/auth';
import { ROLE_IDS } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge, EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';
import DocEditor from '@/components/lesson-notes/DocEditor';
import { StartScreen } from '@/components/lesson-notes/StartScreen';
import {
  SaveIndicator,
  AIProgressBanner,
  RegenPanel,
} from '@/components/lesson-notes/LessonNoteComponents';
import {
  ImgJob,
  RegenFig,
  SHIMMER_CSS,
  addImagePlaceholders,
  replacePlaceholder,
  markPlaceholderFailed,
  replaceFigWithSkeleton,
  updatePlaceholderProgress,
} from '@/components/lesson-notes/diagramHelpers';
import {
  Save, Send, Eye, AlertCircle, Info,
  Sparkles, ChevronLeft, Loader2, GraduationCap, BookMarked, Calendar,
  Copy, Check, ImagePlus, X, RefreshCw, DownloadCloud, ClipboardEdit,
} from 'lucide-react';
import PasteEnhancePanel from '@/components/lesson-notes/PasteEnhancePanel';
import { formatLessonNote, fixUnicodeChemistryInHtml } from '@/lib/lessonNoteFormatter';

// ── Pure helpers ───────────────────────────────────────────────────────────────

function shortAiError(msg: string): string {
  const first = msg.split('\n')[0].split('*')[0].trim();
  return first.length > 120 ? first.slice(0, 120) + '…' : first;
}

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

/**
 * Strip <figure> elements that don't contain an <img> tag (failed or skeleton diagrams).
 * Failed diagrams contain only a <div> placeholder — no <img>. Skeleton diagrams also lack <img>.
 * Prevents TipTap from converting these placeholder divs into garbled paragraph text.
 */
function stripFailedFigures(html: string): string {
  if (!html) return html;
  return html.replace(/<figure[\s\S]*?<\/figure>/gi, (match) => {
    // Keep figure only if it contains an <img> tag (any src is fine)
    if (/<img\s/i.test(match)) return match;
    return '';
  });
}

function migrateContent(rawContent: string | null, rawObjectives: string | null): string {
  if (!rawContent) return rawObjectives ? `<p>${rawObjectives}</p>` : '';
  let html = '';
  try {
    const j = JSON.parse(rawContent);
    if (j._v === 3) {
      html = stripFailedFigures(j.html || '');
    } else if (j._v === 2) {
      const LABELS: Record<string, string> = {
        objectives: 'Learning Objectives', previousKnowledge: 'Previous Knowledge',
        materials: 'Instructional Materials', introduction: 'Introduction / Set Induction',
        content: 'Lesson Content', teacherActivities: "Teacher's Activities",
        studentActivities: "Students' Activities", evaluation: 'Evaluation',
        assignment: 'Assignment / Homework', references: 'References',
      };
      const ORDER = ['objectives','previousKnowledge','materials','introduction','content',
        'teacherActivities','studentActivities','evaluation','assignment','references'];
      ORDER.forEach((key, idx) => {
        const val = j[key];
        if (!val || !val.trim()) return;
        html += `<h2>${idx + 1}. ${LABELS[key] || key.toUpperCase()}</h2>${val}`;
      });
    }
  } catch {
    html = stripFailedFigures(rawContent || '');
  }
  return fixUnicodeChemistryInHtml(html);
}

function serializeContent(html: string): string {
  return JSON.stringify({ _v: 3, html });
}

function applyNoteStyles(html: string): string {
  return html
    .replace(/<h3>/g, '<h3 style="color:#1d4ed8;margin-top:1.2em">')
    .replace(/<strong>/g, '<strong style="background:#fef9c3;padding:0 2px;border-radius:2px;color:#1e3a5f">');
}

// ── Section extractor (streaming) ──────────────────────────────────────────────

const SECTION_KEYS = ['objectives', 'introduction', 'content', 'evaluation', 'assignment', 'summary'] as const;
type SectionKey = typeof SECTION_KEYS[number];

function extractStreamingState(accum: string): {
  completed: Partial<Record<SectionKey, string>>;
  currentKey: SectionKey | null;
  currentPartial: string;
} {
  const completed: Partial<Record<SectionKey, string>> = {};
  let currentKey: SectionKey | null = null;
  let currentPartial = '';
  for (const key of SECTION_KEYS) {
    const startRe = new RegExp(`"${key}"\\s*:\\s*"`);
    const startMatch = startRe.exec(accum);
    if (!startMatch) continue;
    let i = startMatch.index + startMatch[0].length;
    let str = '';
    let complete = false;
    while (i < accum.length) {
      const ch = accum[i];
      if (ch === '\\' && i + 1 < accum.length) {
        const ESC: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
        str += ESC[accum[i + 1]] ?? accum[i + 1];
        i += 2;
      } else if (ch === '"') { complete = true; break; }
      else { str += ch; i++; }
    }
    if (complete && str.trim()) { completed[key] = str; }
    else if (!complete && str.length > 20) { currentKey = key; currentPartial = str; break; }
  }
  return { completed, currentKey, currentPartial };
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
  const query      = parseQuery(window.location.search);

  // ── Draft key for localStorage ─────────────────────────────────────────────
  const draftKey = isEdit && id
    ? `lesson-note-draft-${id}`
    : `lesson-note-draft-new-${query.topicId || query.topicName || 'untitled'}`;

  // ── Core state ─────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(query.topicName || '');
  const [content,     setContent]     = useState('');
  const [initialized, setInitialized] = useState(false);
  const [mode,        setMode]        = useState<'choose' | 'editing'>(isEdit ? 'editing' : 'choose');
  const [saveStatus,  setSaveStatus]  = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [draftBanner, setDraftBanner] = useState<{ title: string; content: string; savedAt: number } | null>(null);

  // AI text generation state
  const [aiLoading,            setAiLoading]            = useState(false);
  const [aiElapsed,            setAiElapsed]            = useState(0);
  const [aiCompletedSections,  setAiCompletedSections]  = useState(0);
  const [aiDone,               setAiDone]               = useState(false);

  // AI image generation state — shown as a plain HTML overlay (NOT in TipTap)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [generatingHtml,     setGeneratingHtml]     = useState('');
  const [aiImgTotal,         setAiImgTotal]         = useState(0);
  const [aiImgDone,          setAiImgDone]          = useState(0);

  // Misc editor state
  const [copied,          setCopied]          = useState(false);
  const [regenFig,        setRegenFig]        = useState<RegenFig | null>(null);
  const [regenBusy,       setRegenBusy]       = useState(false);

  // Inline AI image generation state
  const [imgGenLoading,   setImgGenLoading]   = useState(false);
  const [imgGenPanel,     setImgGenPanel]     = useState(false);
  const [imgGenUrl,       setImgGenUrl]       = useState<string | null>(null);
  const [imgGenMeta,      setImgGenMeta]      = useState('');
  const [imgGenDescription, setImgGenDescription] = useState('');

  // Paste & Enhance state
  const [pastePanel,         setPastePanel]         = useState(false);
  const [pasteText,          setPasteText]          = useState('');
  const [enhanceLoading,     setEnhanceLoading]     = useState(false);
  const [smartConvertLoading, setSmartConvertLoading] = useState(false);

  // Refs
  const liveHtmlRef     = useRef('');
  const userEditedRef   = useRef(false);
  const imgGenActiveRef = useRef(false);
  const editorWrapRef   = useRef<HTMLDivElement>(null);
  const generatingDiv   = useRef<HTMLDivElement>(null);   // plain HTML overlay div
  const autoSaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNoteId     = useRef<number | null>(isEdit && id ? parseInt(id) : null);
  const rafRef          = useRef<number | null>(null);
  const accumRef        = useRef('');

  // Per-image progress simulation
  const progressTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const progressValues = useRef<Map<string, number>>(new Map());

  // Registry: figId → { prompt, heading } — survives TipTap attribute stripping
  const diagramsRef = useRef<Map<string, { prompt: string; heading: string }>>(new Map());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: note, isLoading: noteLoading } = useQuery<EnrichedNote>({
    queryKey: ['/api/lesson-notes', id],
    queryFn: async () => (await apiRequest('GET', `/api/lesson-notes/${id}`)).json(),
    enabled: isEdit,
  });
  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });

  // ── Init from existing note + check for localStorage draft ────────────────
  useEffect(() => {
    if (initialized) return;
    if (isEdit && note) {
      const html = migrateContent(note.content, note.objectives);
      const serverUpdated = note.updatedAt ? new Date(note.updatedAt).getTime() : 0;
      // Check for a newer local draft
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.savedAt > serverUpdated && (draft.content || draft.title !== note.title)) {
            setDraftBanner(draft);
          }
        }
      } catch { /* ignore */ }
      setTitle(note.title || '');
      setContent(html);
      liveHtmlRef.current = html;
      setInitialized(true);
      setSaveStatus('saved');
    }
    if (!isEdit) {
      // Check for a saved draft for this new note
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.content || draft?.title) setDraftBanner(draft);
        }
      } catch { /* ignore */ }
      setTitle(query.topicName || '');
      setInitialized(true);
    }
  }, [note, isEdit, initialized]);

  // ── Derived permissions ────────────────────────────────────────────────────
  const currentStatus = note?.status;
  // Editable statuses for teachers: draft, rejected, returned. Admins can always edit.
  const TEACHER_EDITABLE = ['draft', 'rejected', 'returned'] as const;
  const canEdit = !currentStatus || (TEACHER_EDITABLE as readonly string[]).includes(currentStatus) || isAdmin;

  // ── Per-image progress helpers ─────────────────────────────────────────────

  const syncAllProgress = useCallback(() => {
    for (const [figId, pct] of progressValues.current) {
      updatePlaceholderProgress(generatingDiv.current, figId, pct);
    }
  }, []);

  // Re-sync DOM after React re-renders the generating div (state update resets DOM)
  useEffect(() => {
    if (isGeneratingImages) {
      // Give the browser one tick to paint the new HTML, then restore progress
      const id = setTimeout(syncAllProgress, 30);
      return () => clearTimeout(id);
    }
  }, [generatingHtml, isGeneratingImages, syncAllProgress]);

  function startProgressTimer(figId: string) {
    progressValues.current.set(figId, 0);
    const timer = setInterval(() => {
      const cur  = progressValues.current.get(figId) ?? 0;
      const next = Math.min(88, cur + Math.max(0.4, (88 - cur) * 0.028));
      progressValues.current.set(figId, next);
      updatePlaceholderProgress(generatingDiv.current, figId, next);
    }, 350);
    progressTimers.current.set(figId, timer);
  }

  function stopProgressTimer(figId: string, finalPct: number) {
    const timer = progressTimers.current.get(figId);
    if (timer) { clearInterval(timer); progressTimers.current.delete(figId); }
    progressValues.current.set(figId, finalPct);
    updatePlaceholderProgress(generatingDiv.current, figId, finalPct);
  }

  function clearAllProgressTimers() {
    for (const timer of progressTimers.current.values()) clearInterval(timer);
    progressTimers.current.clear();
    progressValues.current.clear();
  }

  // ── Clipboard copy ────────────────────────────────────────────────────────
  const copyToClipboard = useCallback(() => {
    const plain = content.replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  // ── LocalStorage draft helpers ─────────────────────────────────────────────
  const saveDraft = useCallback((html: string, noteTitle: string) => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ title: noteTitle, content: html, savedAt: Date.now() }));
    } catch { /* storage full or disabled — ignore */ }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [draftKey]);

  // ── Content change handler + auto-save ────────────────────────────────────
  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    liveHtmlRef.current = html;
    setSaveStatus('unsaved');
    if (imgGenActiveRef.current) userEditedRef.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => triggerAutoSave(html), 2000);
    // Always mirror to localStorage for crash recovery
    saveDraft(html, title);
  }, [title, saveDraft]);

  // ── Click on diagram → Regenerate panel ───────────────────────────────────
  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target  = e.target as HTMLElement;
    const carrier = target.getAttribute('data-fig-id')
      ? target
      : (target.closest('[data-fig-id]') as HTMLElement | null);
    if (!carrier) { setRegenFig(null); return; }
    const figId = carrier.getAttribute('data-fig-id')!;
    const rawPr = carrier.getAttribute('data-regen-prompt');
    const rawHd = carrier.getAttribute('data-regen-heading');
    const reg   = diagramsRef.current.get(figId);
    const prompt  = rawPr ? decodeURIComponent(rawPr) : (reg?.prompt  ?? '');
    const heading = rawHd ? decodeURIComponent(rawHd) : (reg?.heading ?? 'Diagram');
    if (!prompt) { setRegenFig(null); return; }
    const wrap = editorWrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rect     = carrier.getBoundingClientRect();
    setRegenFig({
      figId, heading, prompt,
      top:  rect.top  - wrapRect.top  + 8,
      left: rect.left - wrapRect.left + rect.width / 2 - 128,
    });
    e.stopPropagation();
  }, []);

  // ── Regenerate a single diagram ───────────────────────────────────────────
  const regenSingle = useCallback(async (figId: string, prompt: string, heading: string) => {
    setRegenFig(null);
    setRegenBusy(true);
    // replaceFigWithSkeleton uses a loading SVG <img> so TipTap renders it
    const withSkeleton = replaceFigWithSkeleton(liveHtmlRef.current, figId, heading, prompt);
    liveHtmlRef.current = withSkeleton;
    setContent(withSkeleton);
    const token = localStorage.getItem('token');
    try {
      const r = await fetch(getApiUrl('/api/lesson-notes/generate-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const { imageUrl } = await r.json();
      const updated = replacePlaceholder(liveHtmlRef.current, figId, imageUrl, heading);
      liveHtmlRef.current = updated;
      setContent(updated);
      toast({ title: '✅ Diagram regenerated', description: heading });
    } catch {
      const failed = markPlaceholderFailed(liveHtmlRef.current, figId, heading);
      liveHtmlRef.current = failed;
      setContent(failed);
      toast({ title: '❌ Diagram failed', description: 'Could not regenerate. Click diagram to retry.', variant: 'destructive' });
    } finally {
      setRegenBusy(false);
    }
  }, [toast]);

  // ── Save mutations ─────────────────────────────────────────────────────────
  const buildPayload = (html: string, extra?: Record<string, any>) => ({
    title: title.trim() || 'Untitled',
    content: serializeContent(html),
    objectives: '',
    ...extra,
  });

  const doSave = useCallback(async (html: string): Promise<number> => {
    const body = buildPayload(html);
    const nid  = savedNoteId.current;
    if (nid) { await apiRequest('PUT', `/api/lesson-notes/${nid}`, body); return nid; }
    const res = await apiRequest('POST', '/api/lesson-notes', {
      ...body,
      topicId:   parseInt(query.topicId),
      classId:   parseInt(query.classId),
      subjectId: parseInt(query.subjectId),
      termId:    parseInt(query.termId),
    });
    if (res.status === 409) {
      const { existingId } = await res.json();
      if (!existingId) throw new Error('A note already exists for this topic');
      savedNoteId.current = existingId;
      return existingId;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Save failed' }));
      throw new Error(err.message || 'Save failed');
    }
    const created: EnrichedNote = await res.json();
    savedNoteId.current = created.id;
    return created.id;
  }, [title, query]);

  // ── Inline AI image generation ─────────────────────────────────────────────
  // Declared AFTER doSave to avoid the TDZ crash ("cannot access before init")
  const handleGenerateCoverImage = useCallback(async (description?: string) => {
    const desc = (description ?? imgGenDescription).trim();
    if (!desc) {
      toast({ title: 'Description required', description: 'Enter a description of the image you want to generate.', variant: 'destructive' });
      return;
    }
    setImgGenLoading(true);
    setImgGenUrl(null);
    setImgGenMeta('');
    try {
      let noteId = savedNoteId.current;
      if (!noteId) {
        if (!title.trim()) {
          toast({ title: 'Title required', description: 'Enter a note title before generating an image.', variant: 'destructive' });
          setImgGenLoading(false);
          return;
        }
        noteId = await doSave(liveHtmlRef.current || content);
      }
      const token = localStorage.getItem('token');
      const r = await fetch(getApiUrl(`/api/lesson-notes/${noteId}/generate-image-cf`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ prompt: desc, subject: query.subjectName, className: query.className }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Status ${r.status}`);
      }
      const result = await r.json();
      setImgGenUrl(result.imageUrl);
      setImgGenMeta([result.provider, result.model].filter(Boolean).join(' · '));
    } catch (err: any) {
      toast({ title: 'Image generation failed', description: err.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setImgGenLoading(false);
    }
  }, [title, doSave, content, query, toast, imgGenDescription]);

  const handleInsertImage = useCallback(() => {
    if (!imgGenUrl) return;
    const caption = [title, query.subjectName].filter(Boolean).join(' — ');
    const imgHtml = `<figure style="text-align:center;margin:1.5em 0"><img src="${imgGenUrl}" alt="${caption}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.12)" /><figcaption style="font-size:0.85em;color:#6b7280;margin-top:0.5em">${caption}</figcaption></figure>`;
    const updated = /<h1[\s\S]*?<\/h1>/i.test(content)
      ? content.replace(/(<\/h1>)/i, `$1${imgHtml}`)
      : imgHtml + content;
    setContent(updated);
    liveHtmlRef.current = updated;
    setSaveStatus('unsaved');
    setImgGenPanel(false);
    setImgGenUrl(null);
    toast({ title: '✅ Image inserted', description: 'AI-generated image added to your lesson note.' });
  }, [imgGenUrl, content, title, query]);

  const triggerAutoSave = useCallback(async (html: string) => {
    if (!title.trim()) return;
    setSaveStatus('saving');
    try {
      const nid = await doSave(html);
      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] });
      if (!isEdit && savedNoteId.current) {
        const params = new URLSearchParams(query as any).toString();
        window.history.replaceState({}, '', `${basePortal}/lesson-notes/edit/${nid}?${params}`);
      }
    } catch { setSaveStatus('error'); }
  }, [doSave, isEdit, query, basePortal, title]);

  const saveMutation = useMutation({
    mutationFn: () => doSave(content),
    onMutate:   () => setSaveStatus('saving'),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); setSaveStatus('saved'); clearDraft(); toast({ title: 'Saved', description: 'Draft saved successfully.' }); },
    onError:    (e: any) => { setSaveStatus('error'); toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const nid = await doSave(content);
      return (await apiRequest('POST', `/api/lesson-notes/${nid}/submit`)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Submitted for review' }); navigate(listUrl); },
    onError:   (e: any) => toast({ title: 'Submit failed', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const nid = await doSave(content);
      return (await apiRequest('POST', `/api/lesson-notes/${nid}/approve-publish`)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/lesson-notes'] }); toast({ title: 'Published!', description: 'Lesson note is now visible to students.' }); navigate(listUrl); },
    onError:   (e: any) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  // ── Build HTML from streaming sections ────────────────────────────────────
  const buildNoteHtml = useCallback((
    sections: Record<string, string>,
    currentKey?: SectionKey | null,
    currentPartial?: string,
  ) => {
    const BLUE   = '#1d4ed8';
    const LABELS: Record<string, string> = {
      objectives: '1. Learning Objectives', introduction: '2. Introduction',
      content: '3. Detailed Lesson Note', evaluation: '4. Evaluation / Classwork',
      assignment: '5. Assignment', summary: '6. Summary',
    };
    const ORDER = ['objectives', 'introduction', 'content', 'evaluation', 'assignment', 'summary'];
    const metaRows = [
      query.className   && `<tr><td><strong>Class:</strong></td><td>${query.className}</td></tr>`,
      query.subjectName && `<tr><td><strong>Subject:</strong></td><td>${query.subjectName}</td></tr>`,
      query.termName    && `<tr><td><strong>Term:</strong></td><td>${query.termName}</td></tr>`,
      `<tr><td><strong>Duration:</strong></td><td>40 minutes</td></tr>`,
    ].filter(Boolean).join('');
    const header = metaRows
      ? `<table style="border:none;width:auto;margin-bottom:1em"><tbody>${metaRows}</tbody></table>`
      : '';
    let html = `<h1 style="color:${BLUE};border-bottom:3px solid #dbeafe;padding-bottom:0.3em">${title}</h1>${header}`;
    ORDER.forEach(key => {
      const val = sections[key];
      const h2  = `<h2 style="color:${BLUE};border-bottom:2px solid #dbeafe;padding-bottom:0.2em;margin-top:1.5em">${LABELS[key]}</h2>`;
      if (val?.trim()) {
        html += h2 + applyNoteStyles(val);
      } else if (key === currentKey && currentPartial) {
        html += h2 + `<div style="border-left:3px solid #3b82f6;padding-left:1em;color:#374151;min-height:2em">${currentPartial}<span class="ai-cursor"></span></div>`;
      }
    });
    return html;
  }, [title, query]);

  // ── AI Generation ─────────────────────────────────────────────────────────
  const generateWithAI = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: 'Topic required', description: 'Enter a topic before generating.', variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    setAiElapsed(0);
    setAiCompletedSections(0);
    setAiDone(false);
    setIsGeneratingImages(false);
    accumRef.current = '';
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    clearAllProgressTimers();

    setMode('editing');
    setContent(`<h1 style="color:#1d4ed8;border-bottom:3px solid #dbeafe;padding-bottom:0.3em">${title}</h1><p style="color:#6b7280;font-style:italic">✨ AI is writing your lesson note — content appears instantly as it generates…</p>`);

    const startTime = Date.now();
    const ticker    = setInterval(() => setAiElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    try {
      const token = localStorage.getItem('token');
      const resp  = await fetch(getApiUrl('/api/lesson-notes/generate/stream-live'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          topic: title,
          className:   query.className,
          subjectName: query.subjectName,
          termName:    query.termName,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || `Server error ${resp.status}`);
      }

      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          try {
            const evt = JSON.parse(payload);
            if (evt.error) throw new Error(evt.error);

            if (evt.done) {
              if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
              if (evt.sections) {
                const baseHtml = buildNoteHtml(evt.sections);
                const { html: htmlWithPlaceholders, imgJobs } = addImagePlaceholders(
                  baseHtml, title, query.subjectName,
                );

                liveHtmlRef.current = htmlWithPlaceholders;
                userEditedRef.current = false;
                setAiCompletedSections(6);
                setAiDone(true);

                if (imgJobs.length > 0) {
                  // Populate registry
                  diagramsRef.current.clear();
                  for (const { id: fid, prompt, heading } of imgJobs) {
                    diagramsRef.current.set(fid, { prompt, heading });
                  }

                  setAiImgTotal(imgJobs.length);
                  setAiImgDone(0);
                  imgGenActiveRef.current = true;

                  // ── Phase 1: show plain HTML overlay with shimmer skeletons ──
                  setGeneratingHtml(htmlWithPlaceholders);
                  setIsGeneratingImages(true);
                  // DO NOT call setContent/DocEditor yet — skeletons would be stripped

                  // Start progress simulations for all images
                  for (const { id: fid } of imgJobs) startProgressTimer(fid);

                  toast({
                    title: '✨ Note ready — diagrams loading',
                    description: `${imgJobs.length} diagram${imgJobs.length > 1 ? 's' : ''} generating via AI.`,
                  });

                  const tok = localStorage.getItem('token');
                  let imgSuccessCount = 0;
                  let imgFailCount = 0;
                  const imgErrors: string[] = [];

                  Promise.all(imgJobs.map(async ({ id: fid, prompt, heading }) => {
                    try {
                      const r = await fetch(getApiUrl('/api/lesson-notes/generate-image'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
                        credentials: 'include',
                        body: JSON.stringify({ prompt }),
                      });
                      if (!r.ok) {
                        const errBody = await r.json().catch(() => ({}));
                        throw new Error(errBody?.error || `Server error ${r.status}`);
                      }
                      const { imageUrl } = await r.json();

                      if (!imageUrl) throw new Error('No image URL returned');

                      stopProgressTimer(fid, 100);
                      imgSuccessCount++;

                      if (!userEditedRef.current) {
                        liveHtmlRef.current = replacePlaceholder(liveHtmlRef.current, fid, imageUrl, heading);
                        setGeneratingHtml(liveHtmlRef.current);
                      }
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      console.error(`[diagram] failed for "${heading}":`, msg);
                      imgFailCount++;
                      imgErrors.push(msg);
                      stopProgressTimer(fid, 0);
                      if (!userEditedRef.current) {
                        liveHtmlRef.current = markPlaceholderFailed(liveHtmlRef.current, fid, heading);
                        setGeneratingHtml(liveHtmlRef.current);
                      }
                    } finally {
                      setAiImgDone(prev => prev + 1);
                    }
                  })).finally(() => {
                    imgGenActiveRef.current = false;
                    clearAllProgressTimers();

                    // ── Phase 2: hand final HTML to TipTap ──
                    const cleanHtml = stripFailedFigures(liveHtmlRef.current);
                    liveHtmlRef.current = cleanHtml;
                    setContent(cleanHtml);
                    setIsGeneratingImages(false);
                    setSaveStatus('unsaved');

                    // Show result toast
                    const total = imgJobs.length;
                    if (imgSuccessCount === total) {
                      toast({ title: `✅ All ${total} diagram${total > 1 ? 's' : ''} generated`, description: 'Note is ready to save.' });
                    } else if (imgSuccessCount > 0) {
                      toast({
                        title: `⚠️ ${imgSuccessCount} of ${total} diagrams generated`,
                        description: `${imgFailCount} failed. Click any failed diagram to retry.`,
                        variant: 'destructive',
                        duration: 8000,
                      });
                    } else {
                      const firstErr = imgErrors[0] || 'AI image provider not configured';
                      toast({
                        title: '❌ Diagrams could not be generated',
                        description: `${firstErr}. Go to AI Settings → Image Generation to configure.`,
                        variant: 'destructive',
                        duration: 10000,
                      });
                    }
                  });

                } else {
                  // No images — pass text directly to TipTap
                  setContent(htmlWithPlaceholders);
                  setSaveStatus('unsaved');
                  toast({
                    title: '✨ AI generation complete',
                    description: `Generated by ${evt.provider || 'AI'} (${evt.model || ''}).`,
                  });
                }
              } else {
                toast({ title: '⚠️ No content returned', description: 'AI returned an empty response. Try again.', variant: 'destructive', duration: 8000 });
              }
              break outer;
            }

            if (evt.t) {
              accumRef.current += evt.t;
              if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(() => {
                  rafRef.current = null;
                  const { completed, currentKey, currentPartial } = extractStreamingState(accumRef.current);
                  setAiCompletedSections(Object.keys(completed).length);
                  setContent(buildNoteHtml(completed as Record<string, string>, currentKey, currentPartial));
                });
              }
            }
          } catch (e: any) {
            if (e?.message) throw e;
          }
        }
      }
    } catch (err: any) {
      toast({ title: '⚠️ AI Generation Failed', description: shortAiError(err?.message || 'Unknown error'), variant: 'destructive', duration: 8000 });
    } finally {
      clearInterval(ticker);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAiLoading(false);
    }
  }, [title, query, toast, buildNoteHtml]);

  // ── Paste & Enhance with AI ────────────────────────────────────────────────
  const enhanceWithAI = useCallback(async () => {
    if (!pasteText.trim()) return;
    setEnhanceLoading(true);
    setAiLoading(true);
    setAiElapsed(0);
    setAiCompletedSections(0);
    setAiDone(false);
    setIsGeneratingImages(false);
    accumRef.current = '';
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    clearAllProgressTimers();

    setMode('editing');
    setContent(`<h1 style="color:#0f766e;border-bottom:3px solid #ccfbf1;padding-bottom:0.3em">${title || 'Lesson Note'}</h1><p style="color:#6b7280;font-style:italic">✨ AI is enhancing your note — content appears instantly as it generates…</p>`);

    const startTime = Date.now();
    const ticker    = setInterval(() => setAiElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    try {
      const token = localStorage.getItem('token');
      const resp  = await fetch(getApiUrl('/api/lesson-notes/generate/enhance-paste'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          rawNote:     pasteText,
          topic:       title,
          className:   query.className,
          subjectName: query.subjectName,
          termName:    query.termName,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || `Server error ${resp.status}`);
      }

      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          try {
            const evt = JSON.parse(payload);
            if (evt.error) throw new Error(evt.error);

            if (evt.done) {
              if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
              clearAllProgressTimers();
              setAiCompletedSections(6);
              setAiDone(true);

              const baseHtml = buildNoteHtml(evt.sections);
              const placeholderCount = (baseHtml.match(/data-fig-id=/g) || []).length;

              if (placeholderCount > 0) {
                const withSkeleton = baseHtml;
                liveHtmlRef.current = withSkeleton;
                setIsGeneratingImages(true);
                setAiImgTotal(placeholderCount);
                setAiImgDone(0);
                setGeneratingHtml(withSkeleton);
                setAiLoading(false);
              } else {
                liveHtmlRef.current = baseHtml;
                setContent(baseHtml);
                setAiLoading(false);
              }

              // Close the panel and clear paste text after successful enhancement
              setPastePanel(false);
              setPasteText('');
              break outer;
            }

            if (evt.t) {
              accumRef.current += evt.t;
              try {
                const { completed, currentKey, currentPartial } = extractStreamingState(accumRef.current);
                const keys = Object.keys(completed);
                setAiCompletedSections(keys.length);
                setContent(buildNoteHtml(completed as Record<string, string>, currentKey, currentPartial));
              } catch {
                // partial JSON — keep waiting
              }
            }
          } catch (e: any) {
            if (e?.message) throw e;
          }
        }
      }
    } catch (err: any) {
      toast({ title: '⚠️ AI Enhancement Failed', description: shortAiError(err?.message || 'Unknown error'), variant: 'destructive', duration: 8000 });
    } finally {
      clearInterval(ticker);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAiLoading(false);
      setEnhanceLoading(false);
    }
  }, [pasteText, title, query, toast, buildNoteHtml]);

  // ── Smart Convert (instant local markdown/structured → HTML) ─────────────
  const smartConvert = useCallback(() => {
    if (!pasteText.trim()) return;
    setSmartConvertLoading(true);
    try {
      const { html, stats } = formatLessonNote(pasteText);
      if (!html.trim()) {
        toast({ title: 'Nothing to convert', description: 'The pasted text produced no formatted output.', variant: 'destructive' });
        return;
      }
      const totalItems = stats.headings + stats.tables + stats.equations + stats.orderedLists + stats.unorderedLists + stats.chemFormulas + stats.callouts;
      const titleHtml = title
        ? `<h1 style="font-size:1.6rem;font-weight:700;color:#0f766e;border-bottom:3px solid #ccfbf1;padding-bottom:0.3em">${title}</h1>`
        : '';
      liveHtmlRef.current = titleHtml + html;
      setContent(titleHtml + html);
      setMode('editing');
      setPastePanel(false);
      setPasteText('');
      toast({
        title: '⚡ Smart Convert complete',
        description: `Formatted ${totalItems} element${totalItems !== 1 ? 's' : ''} instantly — headings, tables, equations and more.`,
        duration: 4000,
      });
    } catch (err: any) {
      toast({ title: 'Conversion failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSmartConvertLoading(false);
    }
  }, [pasteText, title, toast]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => { clearAllProgressTimers(); }, []);

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
        context={{ className: query.className, subjectName: query.subjectName, termName: query.termName }}
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

          {note && <StatusBadge status={note.status} />}
          <SaveIndicator status={saveStatus} />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {canEdit && (
              <Button size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 rounded border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 font-semibold"
                onClick={generateWithAI} disabled={aiLoading || isGeneratingImages || busy}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{aiLoading ? 'Generating…' : 'AI Generate'}</span>
              </Button>
            )}

            {canEdit && (
              <Button size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 rounded border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400 font-semibold"
                onClick={() => { setPastePanel(p => !p); }}
                disabled={aiLoading || isGeneratingImages || busy}
                title="Paste your own lesson note text and let AI rewrite it professionally">
                <ClipboardEdit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{pastePanel ? 'Hide Paste' : 'Paste & Enhance'}</span>
              </Button>
            )}

            {canEdit && (
              <Button size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 rounded border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 font-semibold"
                onClick={() => { setImgGenPanel(p => !p); setImgGenUrl(null); }}
                disabled={aiLoading || isGeneratingImages || busy || imgGenLoading}
                data-testid="button-generate-image">
                {imgGenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{imgGenLoading ? 'Generating…' : imgGenPanel ? 'Hide Image' : 'AI Image'}</span>
              </Button>
            )}

            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded"
              onClick={copyToClipboard} disabled={!content}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>

            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded"
              onClick={async () => {
                if (!title.trim()) {
                  toast({ title: 'Title required', description: 'Enter a note title before previewing.', variant: 'destructive' });
                  return;
                }
                try {
                  const nid = await doSave(liveHtmlRef.current || content);
                  navigate(`${basePortal}/lesson-notes/preview/${nid}?from=${isEdit ? 'edit' : 'create'}`);
                } catch (err: any) {
                  toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
                }
              }}>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </Button>

            {canEdit && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded font-semibold"
                onClick={() => saveMutation.mutate()} disabled={busy || isGeneratingImages}>
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{saveMutation.isPending ? 'Saving…' : 'Save'}</span>
              </Button>
            )}

            {isTeacher && canEdit && (
              <Button size="sm" className="h-8 text-xs gap-1.5 rounded bg-primary hover:bg-primary/90 font-semibold"
                onClick={() => submitMutation.mutate()} disabled={busy || isGeneratingImages}>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{submitMutation.isPending ? 'Submitting…' : 'Submit'}</span>
              </Button>
            )}

            {isAdmin && (
              <Button size="sm" className="h-8 text-xs gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
                onClick={() => publishMutation.mutate()} disabled={busy || isGeneratingImages}>
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
          <div className="mx-4 mb-2 flex gap-2 p-2.5 bg-primary/5 dark:bg-primary/5 border border-primary/30 dark:border-primary/30 text-xs text-primary dark:text-primary/70 rounded">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>This note is <strong>{currentStatus}</strong> and cannot be edited.</span>
          </div>
        )}
      </div>

      {/* ── Local draft restore banner ── */}
      {draftBanner && canEdit && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <span className="text-xs text-amber-800 dark:text-amber-300 flex-1">
            📝 You have an unsaved local draft from {new Date(draftBanner.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Restore it?
          </span>
          <button
            className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded transition-colors"
            onClick={() => {
              if (draftBanner.title) setTitle(draftBanner.title);
              if (draftBanner.content) { setContent(draftBanner.content); liveHtmlRef.current = draftBanner.content; setSaveStatus('unsaved'); }
              setDraftBanner(null);
              toast({ title: 'Draft restored', description: 'Your unsaved work has been recovered.' });
            }}
          >
            Restore
          </button>
          <button
            className="shrink-0 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            onClick={() => { clearDraft(); setDraftBanner(null); }}
          >
            Discard
          </button>
        </div>
      )}

      {/* ── Paste & Enhance panel ── */}
      {pastePanel && canEdit && (
        <PasteEnhancePanel
          text={pasteText}
          onChange={setPasteText}
          onEnhance={enhanceWithAI}
          onSmartConvert={smartConvert}
          onClose={() => { setPastePanel(false); setPasteText(''); }}
          loading={enhanceLoading || aiLoading}
          smartConverting={smartConvertLoading}
        />
      )}

      {/* ── AI Image panel ── */}
      {imgGenPanel && (
        <div className="shrink-0 border-b border-orange-100 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 px-4 py-3 space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">AI-Generated Image</span>
              {imgGenMeta && (
                <span className="text-[10px] text-orange-400 dark:text-orange-500">{imgGenMeta}</span>
              )}
            </div>
            <button
              className="text-orange-400 hover:text-orange-600 p-0.5"
              onClick={() => { setImgGenPanel(false); setImgGenUrl(null); setImgGenDescription(''); }}
              data-testid="button-dismiss-image">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body: description input → result */}
          {imgGenUrl ? (
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-28 h-20 rounded-lg border border-orange-200 dark:border-orange-800 overflow-hidden bg-white dark:bg-gray-900">
                <img src={imgGenUrl} alt="AI generated" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-orange-600 dark:text-orange-400">Image ready. Insert it into your note or generate a new one.</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm"
                    className="h-7 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    onClick={handleInsertImage}
                    data-testid="button-insert-image">
                    <DownloadCloud className="h-3 w-3" />
                    Insert into note
                  </Button>
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => { setImgGenUrl(null); }}
                    data-testid="button-regenerate-image">
                    <RefreshCw className="h-3 w-3" />
                    Change description
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Describe the image you want to generate — e.g. <em>a labeled diagram of the human digestive system</em>.
              </p>
              <div className="flex gap-2">
                <textarea
                  className="flex-1 text-xs rounded-md border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-gray-800 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
                  rows={2}
                  placeholder="Describe the image or diagram you want…"
                  value={imgGenDescription}
                  onChange={e => setImgGenDescription(e.target.value)}
                  disabled={imgGenLoading}
                  data-testid="input-image-description"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateCoverImage(); } }}
                />
                <Button size="sm"
                  className="h-auto px-3 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold self-stretch"
                  onClick={() => handleGenerateCoverImage()}
                  disabled={imgGenLoading || !imgGenDescription.trim()}
                  data-testid="button-do-generate-image">
                  {imgGenLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><ImagePlus className="h-3.5 w-3.5" /><span className="ml-1">Generate</span></>
                  }
                </Button>
              </div>
              {imgGenLoading && (
                <p className="text-[11px] text-orange-500 dark:text-orange-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating your image…
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AI progress banner ── */}
      {(aiLoading || isGeneratingImages || (aiDone && aiImgTotal > 0)) && (
        <AIProgressBanner
          elapsed={aiElapsed}
          completedSections={aiCompletedSections}
          isDone={aiDone}
          imgTotal={aiImgTotal}
          imgDone={aiImgDone}
        />
      )}

      {/* ── Image generation overlay (Phase 1) ── */}
      {isGeneratingImages && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-100 dark:bg-gray-950">
          {/* Shimmer + pulse keyframes — only needed in this overlay */}
          <style>{SHIMMER_CSS}</style>
          <div className="min-h-full py-8 px-4 flex justify-center">
            <div
              ref={generatingDiv}
              className="w-full max-w-4xl bg-white dark:bg-gray-900 shadow-md border border-gray-200 dark:border-gray-700 min-h-[1056px] px-16 py-14"
              style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', lineHeight: '1.75' }}
              dangerouslySetInnerHTML={{ __html: generatingHtml }}
            />
          </div>
        </div>
      )}

      {/* ── Document editor (Phase 2 / edit mode) ── */}
      {!isGeneratingImages && (
        <div
          ref={editorWrapRef}
          className="flex-1 min-h-0 overflow-hidden relative"
          onClick={handleEditorClick}
        >
          {(isEdit && noteLoading) ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : (
            <DocEditor
              content={content}
              onChange={canEdit && !aiLoading ? handleContentChange : () => {}}
              disabled={!canEdit || busy || aiLoading}
              brandColor={settings?.primaryColor || '#3b82f6'}
              placeholder={
                canEdit
                  ? 'Start writing your lesson note here, or click "AI Generate" above to fill it automatically…'
                  : undefined
              }
            />
          )}

          {/* Floating regen panel */}
          {regenFig && (
            <RegenPanel
              fig={regenFig}
              busy={regenBusy}
              onClose={() => setRegenFig(null)}
              onRegen={regenSingle}
            />
          )}
        </div>
      )}


    </div>
  );
}
