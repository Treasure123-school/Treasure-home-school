import {
  FileText, Send, CheckCircle, XCircle, Eye, Clock,
  Target, Package, Brain, Rocket, BookText, UserCog, Users,
  ClipboardCheck, FileCheck, ExternalLink, EyeOff, Lock,
  BookOpen, Calendar, User, GraduationCap, Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import RichTextViewer from './RichTextViewer';

// ── Status badge ─────────────────────────────────────────────────────────────

export const STATUS_CFG = {
  draft:     { label: 'Draft',               cls: 'bg-muted text-muted-foreground border border-border',                                                     icon: FileText,    canEdit: true,  canDelete: true,  canSubmit: true  },
  submitted: { label: 'Submitted',           cls: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70',                                       icon: Send,        canEdit: false, canDelete: false, canSubmit: false },
  approved:  { label: 'Approved',            cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',                                    icon: CheckCircle, canEdit: false, canDelete: false, canSubmit: false },
  rejected:  { label: 'Rejected',            cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                                            icon: XCircle,     canEdit: true,  canDelete: false, canSubmit: true  },
  returned:  { label: 'Returned for Revision', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200',          icon: Clock,       canEdit: true,  canDelete: false, canSubmit: true  },
  published: { label: 'Published',           cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',                            icon: Eye,         canEdit: false, canDelete: false, canSubmit: false },
  archived:  { label: 'Archived',            cls: 'bg-muted text-muted-foreground border border-border',                                                     icon: Clock,       canEdit: false, canDelete: false, canSubmit: false },
} as const;

export type StatusKey = keyof typeof STATUS_CFG;

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CFG[status as StatusKey] ?? STATUS_CFG.draft;
  const Icon = cfg.icon;
  if (size === 'md') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
        <Icon className="w-3.5 h-3.5" />{cfg.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── Shared types ──────────────────────────────────────────────────────────────

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export type EnrichedNote = {
  id: number; topicId: number; classId: number; subjectId: number; termId: number;
  title: string; content: string | null; objectives: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  status: string; rejectionReason: string | null;
  createdBy: string | null; submittedBy?: string | null; approvedBy?: string | null;
  rejectedBy?: string | null; publishedBy?: string | null;
  creatorName: string | null; subjectName: string | null;
  className: string | null; topicName: string | null; termName: string | null;
  submittedAt: string | null; approvedAt: string | null;
  rejectedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
  hiddenSections?: string[] | null;
};

// ── NotePageHeader — unified header for all note view pages ──────────────────
//
// Shows: Subject · Class (brand-coloured, prominent) on the first line
//        By [creator] · Term / Date in small muted text below
// One component, used by admin, teacher, student and preview pages.

interface NotePageHeaderProps {
  note: Pick<EnrichedNote, 'subjectName' | 'className' | 'termName' | 'creatorName'>;
  brandColor: string;
  date?: string | null;
  printButton?: boolean;
}

export function NotePageHeader({ note, brandColor, date, printButton = false }: NotePageHeaderProps) {
  return (
    <div className="flex rounded-lg border overflow-hidden">
      <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: brandColor }} />
      <div className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5 min-w-0">
        <div className="min-w-0">
          {(note.subjectName || note.className) && (
            <p className="text-base font-bold leading-snug" style={{ color: brandColor }}>
              {[note.subjectName, note.className].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            By{' '}
            <span className="font-medium text-foreground">
              {note.creatorName || 'School Admin'}
            </span>
            {note.termName && <span> · {note.termName}</span>}
            {date && <span> / {fmtDate(date)}</span>}
          </p>
        </div>
        {printButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="shrink-0 gap-1.5 h-8 text-xs px-2 text-muted-foreground hover:text-foreground print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── MetaChip — shared metadata pill ──────────────────────────────────────────

export function MetaChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── NoteMetaStrip — shared meta chips row used by all role views ──────────────
//
// Renders the standard set of metadata pills for a lesson note.
// Pass `showPublished` for the student view which also shows the publish date.
// Pass `printButton` to embed a print button in the top-right corner of the strip.

interface NoteMetaStripProps {
  note: Pick<EnrichedNote, 'className' | 'subjectName' | 'topicName' | 'termName' | 'creatorName' | 'publishedAt'>;
  showPublished?: boolean;
  printButton?: boolean;
}

export function NoteMetaStrip({ note, showPublished = false, printButton = false }: NoteMetaStripProps) {
  return (
    <div className="space-y-2">
      {printButton && (
        <div className="flex items-center justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {note.className   && <MetaChip icon={GraduationCap} label="Class"   value={note.className} />}
        {note.subjectName && <MetaChip icon={BookOpen}      label="Subject" value={note.subjectName} />}
        {note.topicName   && <MetaChip icon={FileText}      label="Topic"   value={note.topicName} />}
        {note.termName    && <MetaChip icon={Calendar}      label="Term"    value={note.termName} />}
        {note.creatorName && <MetaChip icon={User}          label="Teacher" value={note.creatorName} />}
        {showPublished && note.publishedAt && (
          <MetaChip
            icon={Calendar}
            label="Published"
            value={new Date(note.publishedAt).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
      </div>
    </div>
  );
}

// ── Structured sections viewer (v2 notes) ────────────────────────────────────

export const SECTION_VIEW_DEFS = [
  { key: 'objectives',        label: 'Learning Objectives',    icon: Target,        iconBg: 'bg-primary/10',   iconColor: 'text-primary',   borderColor: 'border-primary/30',   headerBg: 'bg-primary/5'   },
  { key: 'materials',         label: 'Instructional Materials',icon: Package,       iconBg: 'bg-purple-100', iconColor: 'text-purple-700', borderColor: 'border-purple-200', headerBg: 'bg-purple-50' },
  { key: 'previousKnowledge', label: 'Previous Knowledge',     icon: Brain,         iconBg: 'bg-cyan-100',   iconColor: 'text-cyan-700',   borderColor: 'border-cyan-200',   headerBg: 'bg-cyan-50'   },
  { key: 'introduction',      label: 'Introduction',           icon: Rocket,        iconBg: 'bg-green-100',  iconColor: 'text-green-700',  borderColor: 'border-green-200',  headerBg: 'bg-green-50'  },
  { key: 'content',           label: 'Lesson Content',         icon: BookText,      iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700', borderColor: 'border-indigo-200', headerBg: 'bg-indigo-50' },
  { key: 'teacherActivities', label: "Teacher's Activities",   icon: UserCog,       iconBg: 'bg-orange-100', iconColor: 'text-orange-700', borderColor: 'border-orange-200', headerBg: 'bg-orange-50' },
  { key: 'studentActivities', label: "Students' Activities",   icon: Users,         iconBg: 'bg-emerald-100',iconColor: 'text-emerald-700',borderColor: 'border-emerald-200',headerBg: 'bg-emerald-50'},
  { key: 'evaluation',        label: 'Evaluation',             icon: ClipboardCheck,iconBg: 'bg-rose-100',   iconColor: 'text-rose-700',   borderColor: 'border-rose-200',   headerBg: 'bg-rose-50'   },
  { key: 'assignment',        label: 'Assignment / Homework',  icon: FileCheck,     iconBg: 'bg-amber-100',  iconColor: 'text-amber-700',  borderColor: 'border-amber-200',  headerBg: 'bg-amber-50'  },
  { key: 'references',        label: 'References',             icon: ExternalLink,  iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',   borderColor: 'border-gray-200',   headerBg: 'bg-gray-50'   },
] as const;

interface NoteContentRendererProps {
  note: Pick<EnrichedNote, 'content' | 'objectives' | 'hiddenSections'>;
  brandColor?: string;
  /** Show the hide/show toggle buttons (teacher & admin only) */
  canToggle?: boolean;
  onToggleSection?: (key: string) => void;
  toggling?: boolean;
}

/**
 * Renders the body of a lesson note.
 * - v2 structured notes → coloured section cards with optional hide/show toggles
 * - v3 / legacy notes   → RichTextViewer (sanitised HTML)
 * Used by teacher/admin view page, student view page, and parent view page.
 */
export function NoteContentRenderer({
  note,
  brandColor = '#3b82f6',
  canToggle,
  onToggleSection,
  toggling,
}: NoteContentRendererProps) {
  const sections = isV2Sections(note.content);
  const hidden   = note.hiddenSections ?? [];

  if (sections) {
    const visibleDefs = SECTION_VIEW_DEFS.filter((d) => {
      const html = sections[d.key];
      if (!html?.trim()) return false;
      // Students see only non-hidden sections (canToggle=false = student/parent mode)
      if (!canToggle && hidden.includes(d.key)) return false;
      return true;
    });

    if (visibleDefs.length === 0) {
      return (
        <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
          <FileText className="w-5 h-5 shrink-0" />
          <p className="text-sm">No content has been added yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {canToggle && (
          <p className="text-xs text-muted-foreground pb-1">
            <Lock className="inline w-3 h-3 mr-1" />
            Click the eye icon on any section to hide or show it for students.
          </p>
        )}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
          {visibleDefs.map((def) => {
            const html     = sections[def.key];
            const isHidden = hidden.includes(def.key);
            const Icon     = def.icon;
            return (
              <div key={def.key} className={isHidden ? 'opacity-60' : ''}>
                <div className={`flex items-center gap-2.5 px-5 py-3 border-b ${def.borderColor} dark:border-gray-700 ${def.headerBg} dark:bg-transparent`}>
                  <div className={`flex items-center justify-center w-7 h-7 ${def.iconBg} dark:bg-gray-700 rounded-lg shrink-0`}>
                    <Icon className={`h-4 w-4 ${def.iconColor} dark:text-gray-300`} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${def.iconColor} dark:text-gray-300 flex-1`}>
                    {def.label}
                  </span>
                  {isHidden && canToggle && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 px-1.5 py-0.5 rounded-full font-medium">
                      <EyeOff className="w-2.5 h-2.5" />Hidden from students
                    </span>
                  )}
                  {canToggle && (
                    <button
                      onClick={() => onToggleSection?.(def.key)}
                      disabled={toggling}
                      title={isHidden ? 'Show section to students' : 'Hide section from students'}
                      className={`ml-2 p-1 rounded transition-colors ${isHidden
                        ? 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                {/* Use RichTextViewer so images inside sections get proper
                    DOMPurify sanitisation and broken-image fallbacks */}
                <div className="px-5 py-4 bg-white dark:bg-gray-900/40">
                  <RichTextViewer html={html} brandColor={brandColor} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // v3 / legacy HTML
  const parsedHtml = parseNoteContent(note.content, note.objectives);
  if (!parsedHtml) {
    return (
      <div className="flex items-center gap-3 p-6 rounded-xl bg-muted/30 border border-dashed text-muted-foreground">
        <FileText className="w-5 h-5 shrink-0" />
        <p className="text-sm">No content has been added yet.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lesson Content</h2>
      </div>
      <RichTextViewer html={parsedHtml} className="min-h-[200px]" brandColor={brandColor} />
    </section>
  );
}

// ── Section metadata for _v:2 format ────────────────────────────────────────

const SECTION_V2_LABELS: Record<string, string> = {
  objectives:        'Learning Objectives',
  previousKnowledge: 'Previous Knowledge',
  materials:         'Instructional Materials',
  introduction:      'Introduction / Set Induction',
  content:           'Lesson Content',
  teacherActivities: "Teacher's Activities",
  studentActivities: "Students' Activities",
  evaluation:        'Evaluation',
  assignment:        'Assignment / Homework',
  references:        'References',
};

const SECTION_V2_ORDER = [
  'objectives', 'previousKnowledge', 'materials', 'introduction', 'content',
  'teacherActivities', 'studentActivities', 'evaluation', 'assignment', 'references',
];

/**
 * Parse a lesson note's raw `content` field into renderable HTML.
 *
 * Handles:
 *  - `{ "_v": 3, "html": "..." }` — current editor format
 *  - `{ "_v": 2, objectives: "...", content: "...", ... }` — structured sections format
 *  - Plain HTML string — legacy notes written before JSON wrapping
 *  - null / empty string — returns empty string
 *
 * Also accepts a legacy `objectives` string (old notes stored objectives separately).
 */
export function parseNoteContent(
  rawContent: string | null | undefined,
  rawObjectives?: string | null,
  hiddenSections?: string[] | null,
): string {
  if (!rawContent || !rawContent.trim()) {
    return rawObjectives ? `<p>${rawObjectives}</p>` : '';
  }

  // Only try JSON parse if the string starts with `{`
  if (rawContent.trimStart().startsWith('{')) {
    try {
      const j = JSON.parse(rawContent);

      // v3: flat HTML wrapper — current format
      if (j._v === 3) {
        return j.html || '';
      }

      // v2: structured sections — older format
      if (j._v === 2) {
        let html = '';
        SECTION_V2_ORDER.forEach((key, idx) => {
          if (hiddenSections?.includes(key)) return;
          const val = j[key];
          if (!val || !String(val).trim()) return;
          html += `<h2>${idx + 1}. ${SECTION_V2_LABELS[key] || key}</h2>${val}`;
        });
        if (!html && rawObjectives) return `<p>${rawObjectives}</p>`;
        return html;
      }
    } catch {
      // Not valid JSON — fall through to treat as plain HTML
    }
  }

  // Plain HTML (legacy notes)
  return rawContent;
}

/**
 * Returns the parsed _v:2 sections object if rawContent is in that format,
 * otherwise null. Used by view pages that render the fancy section-card UI.
 */
export function isV2Sections(rawContent: string | null | undefined): Record<string, string> | null {
  if (!rawContent || !rawContent.trimStart().startsWith('{')) return null;
  try {
    const j = JSON.parse(rawContent);
    if (j._v === 2) return j as Record<string, string>;
  } catch {}
  return null;
}
