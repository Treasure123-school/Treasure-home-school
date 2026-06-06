import { FileText, Send, CheckCircle, XCircle, Eye, Clock } from 'lucide-react';

export const STATUS_CFG = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground border border-border',                                      icon: FileText,    canEdit: true,  canDelete: true,  canSubmit: true  },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',                        icon: Send,        canEdit: false, canDelete: false, canSubmit: false },
  approved:  { label: 'Approved',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',                    icon: CheckCircle, canEdit: false, canDelete: false, canSubmit: false },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                            icon: XCircle,     canEdit: true,  canDelete: false, canSubmit: true  },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',            icon: Eye,         canEdit: false, canDelete: false, canSubmit: false },
  archived:  { label: 'Archived',  cls: 'bg-muted text-muted-foreground border border-border',                                      icon: Clock,       canEdit: false, canDelete: false, canSubmit: false },
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
};

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
 * Returns true if rawContent is the _v:2 structured sections format.
 * Used by view pages that render the fancy section-card UI for v2 notes.
 */
export function isV2Sections(rawContent: string | null | undefined): Record<string, string> | null {
  if (!rawContent || !rawContent.trimStart().startsWith('{')) return null;
  try {
    const j = JSON.parse(rawContent);
    if (j._v === 2) return j as Record<string, string>;
  } catch {}
  return null;
}
