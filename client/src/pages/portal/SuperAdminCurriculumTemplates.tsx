import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, Plus, Edit2, Trash2, Eye, Globe, Lock, Search,
  ChevronDown, ChevronRight, Layers, BookMarked, FileText,
  Clock, Loader2, CheckCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Level = "primary" | "jss" | "ss" | "custom";
type Term = "first" | "second" | "third";

interface Template {
  id: number;
  title: string;
  level: Level;
  className: string;
  subjectName: string;
  description: string | null;
  isPublished: boolean;
  topicCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Topic {
  id: number;
  templateId: number;
  term: Term;
  weekNumber: number;
  orderNumber: number;
  name: string;
  description: string | null;
}

interface TemplateDetail extends Template {
  topics: Topic[];
  grouped: Record<Term, Topic[]>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LEVEL_LABELS: Record<Level, string> = { primary: "Primary", jss: "JSS", ss: "SS", custom: "Custom" };

const LEVEL_COLORS: Record<Level, string> = {
  primary: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  jss: "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60",
  ss: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  custom: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

const TERM_LABELS: Record<Term, string> = { first: "First Term", second: "Second Term", third: "Third Term" };

const BLANK_TPL = { title: "", level: "jss" as Level, className: "", subjectName: "", description: "" };
const BLANK_TOPIC = { term: "first" as Term, weekNumber: 1, name: "", description: "" };

// ── Shared sub-components ─────────────────────────────────────────────────────

/** Minimal icon-only ghost button */
function IconBtn({
  icon: Icon,
  onClick,
  className = "",
  title,
  testId,
  disabled,
}: {
  icon: React.ElementType;
  onClick: () => void;
  className?: string;
  title?: string;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground
        hover:text-foreground hover:bg-accent transition-colors disabled:pointer-events-none
        disabled:opacity-50 ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Shared form fields for creating/editing a template */
function TemplateFormFields({
  form,
  onChange,
}: {
  form: typeof BLANK_TPL;
  onChange: (patch: Partial<typeof BLANK_TPL>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input
          placeholder="e.g. JSS 1 – Mathematics"
          value={form.title}
          onChange={e => onChange({ title: e.target.value })}
          data-testid="input-template-title"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Level</Label>
          <Select value={form.level} onValueChange={v => onChange({ level: v as Level })}>
            <SelectTrigger data-testid="select-template-level"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="jss">JSS</SelectItem>
              <SelectItem value="ss">SS</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class</Label>
          <Input
            placeholder="e.g. JSS 1"
            value={form.className}
            onChange={e => onChange({ className: e.target.value })}
            data-testid="input-template-class"
          />
        </div>
      </div>
      <div>
        <Label>Subject</Label>
        <Input
          placeholder="e.g. Mathematics"
          value={form.subjectName}
          onChange={e => onChange({ subjectName: e.target.value })}
          data-testid="input-template-subject"
        />
      </div>
      <div>
        <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea
          rows={2}
          value={form.description}
          onChange={e => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Shared form fields for creating/editing a topic */
function TopicFormFields({
  form,
  onChange,
}: {
  form: typeof BLANK_TOPIC;
  onChange: (patch: Partial<typeof BLANK_TOPIC>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Term</Label>
          <Select value={form.term} onValueChange={v => onChange({ term: v as Term })}>
            <SelectTrigger data-testid="select-topic-term"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first">First Term</SelectItem>
              <SelectItem value="second">Second Term</SelectItem>
              <SelectItem value="third">Third Term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Week</Label>
          <Input
            type="number"
            min={1}
            max={16}
            value={form.weekNumber}
            onChange={e => onChange({ weekNumber: parseInt(e.target.value) || 1 })}
            data-testid="input-topic-week"
          />
        </div>
      </div>
      <div>
        <Label>Topic Name</Label>
        <Input
          placeholder="e.g. Introduction to Algebra"
          value={form.name}
          onChange={e => onChange({ name: e.target.value })}
          data-testid="input-topic-name"
        />
      </div>
      <div>
        <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea
          rows={2}
          value={form.description}
          onChange={e => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Generic confirm-delete dialog — guards against double-fire via a ref */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  isPending,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  isPending: boolean;
  confirmLabel?: string;
}) {
  const firedRef = useRef(false);

  // Reset the guard whenever the dialog opens/closes
  useEffect(() => {
    if (open) firedRef.current = false;
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (firedRef.current || isPending) return;
    firedRef.current = true;
    onConfirm();
  }, [isPending, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Optimistic update helpers ─────────────────────────────────────────────────

/** Update every matching template list cache */
function patchTemplatesCache(
  qc: ReturnType<typeof useQueryClient>,
  updater: (old: Template[]) => Template[]
) {
  qc.setQueriesData<Template[]>({ queryKey: ["/api/curriculum-templates"] }, old => {
    if (!Array.isArray(old)) return old;
    return updater(old);
  });
}

/** Update the topics inside a detail cache */
function patchDetailCache(
  qc: ReturnType<typeof useQueryClient>,
  templateId: number,
  updater: (old: TemplateDetail) => TemplateDetail
) {
  qc.setQueryData<TemplateDetail>(["/api/curriculum-templates", templateId], old => {
    if (!old) return old;
    return updater(old);
  });
}

function reGroupTopics(topics: Topic[]): Record<Term, Topic[]> {
  return {
    first: topics.filter(t => t.term === "first"),
    second: topics.filter(t => t.term === "second"),
    third: topics.filter(t => t.term === "third"),
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SuperAdminCurriculumTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<Term>("first");

  // Dialog visibility
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [addTopicTemplateId, setAddTopicTemplateId] = useState<number | null>(null);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);

  // Forms
  const [tplForm, setTplForm] = useState(BLANK_TPL);
  const [topicForm, setTopicForm] = useState(BLANK_TOPIC);

  const patchTpl = (p: Partial<typeof BLANK_TPL>) => setTplForm(f => ({ ...f, ...p }));
  const patchTopic = (p: Partial<typeof BLANK_TOPIC>) => setTopicForm(f => ({ ...f, ...p }));

  // ── Infinite scroll ─────────────────────────────────────────────────────────
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);
  const totalRef = useRef(0);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    isBusyRef.current = false;
  }, [search, levelFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    isBusyRef.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || isBusyRef.current) return;
        isBusyRef.current = true;
        setVisibleCount(c => {
          if (c >= totalRef.current) { isBusyRef.current = false; return c; }
          return c + PAGE_SIZE;
        });
      },
      { threshold: 0, rootMargin: "0px 0px 160px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<{ total: number; published: number; draft: number; totalTopics: number }>({
    queryKey: ["/api/curriculum-templates/stats"],
    queryFn: () => apiRequest("GET", "/api/curriculum-templates/stats").then(r => r.json()),
  });

  const { data: rawTemplates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/curriculum-templates", search, levelFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (levelFilter !== "all") p.set("level", levelFilter);
      return apiRequest("GET", `/api/curriculum-templates?${p}`).then(r => r.json());
    },
  });
  const templates: Template[] = Array.isArray(rawTemplates) ? rawTemplates : [];

  const { data: detail, isLoading: detailLoading } = useQuery<TemplateDetail>({
    queryKey: ["/api/curriculum-templates", detailId],
    queryFn: () => apiRequest("GET", `/api/curriculum-templates/${detailId}`).then(r => r.json()),
    enabled: detailId !== null,
  });

  // ── Mutations with optimistic updates ───────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: typeof tplForm) => apiRequest("POST", "/api/curriculum-templates", data),
    onSuccess: () => {
      toast({ title: "Template created" });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates/stats"] });
      setShowCreateTemplate(false);
      setTplForm(BLANK_TPL);
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof tplForm }) =>
      apiRequest("PUT", `/api/curriculum-templates/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates"] });
      const snapshot = queryClient.getQueriesData<Template[]>({ queryKey: ["/api/curriculum-templates"] });
      patchTemplatesCache(queryClient, old => old.map(t =>
        t.id === id ? { ...t, ...data } : t
      ));
      setEditTemplate(null);
      return { snapshot };
    },
    onError: (_, __, ctx) => {
      ctx?.snapshot.forEach(([key, val]) => queryClient.setQueryData(key, val));
      toast({ title: "Failed to update template", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/curriculum-templates/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates"] });
      const snapshot = queryClient.getQueriesData<Template[]>({ queryKey: ["/api/curriculum-templates"] });
      patchTemplatesCache(queryClient, old => old.filter(t => t.id !== id));
      setDeleteTemplate(null);
      if (detailId === id) setDetailId(null);
      return { snapshot };
    },
    onError: (_, __, ctx) => {
      ctx?.snapshot.forEach(([key, val]) => queryClient.setQueryData(key, val));
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates/stats"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      apiRequest("PATCH", `/api/curriculum-templates/${id}/publish`, { isPublished }),
    onMutate: async ({ id, isPublished }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates"] });
      const snapshot = queryClient.getQueriesData<Template[]>({ queryKey: ["/api/curriculum-templates"] });
      patchTemplatesCache(queryClient, old => old.map(t => t.id === id ? { ...t, isPublished } : t));
      // Also patch the detail cache if open
      patchDetailCache(queryClient, id, old => ({ ...old, isPublished }));
      return { snapshot };
    },
    onError: (_, v, ctx) => {
      ctx?.snapshot.forEach(([key, val]) => queryClient.setQueryData(key, val));
      patchDetailCache(queryClient, v.id, old => ({ ...old, isPublished: !v.isPublished }));
      toast({ title: "Failed to update publish status", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates/stats"] });
    },
  });

  const addTopicMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data: typeof topicForm }) =>
      apiRequest("POST", `/api/curriculum-templates/${templateId}/topics`, data),
    onMutate: async ({ templateId, data }) => {
      const tempId = -Date.now();
      const optimistic: Topic = {
        id: tempId,
        templateId,
        term: data.term,
        weekNumber: data.weekNumber,
        orderNumber: 9999,
        name: data.name,
        description: data.description || null,
      };
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates", templateId] });
      const snapshot = queryClient.getQueryData<TemplateDetail>(["/api/curriculum-templates", templateId]);
      patchDetailCache(queryClient, templateId, old => {
        const topics = [...old.topics, optimistic];
        return { ...old, topics, grouped: reGroupTopics(topics), topicCount: topics.length };
      });
      patchTemplatesCache(queryClient, old =>
        old.map(t => t.id === templateId ? { ...t, topicCount: t.topicCount + 1 } : t)
      );
      setAddTopicTemplateId(null);
      setTopicForm(BLANK_TOPIC);
      return { snapshot, tempId, templateId };
    },
    onError: (_, v, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["/api/curriculum-templates", ctx.templateId], ctx.snapshot);
      patchTemplatesCache(queryClient, old =>
        old.map(t => t.id === v.templateId ? { ...t, topicCount: t.topicCount - 1 } : t)
      );
      toast({ title: "Failed to add topic", variant: "destructive" });
    },
    onSettled: (_, __, v) => {
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", v.templateId] });
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof topicForm }) =>
      apiRequest("PUT", `/api/curriculum-templates/topics/${id}`, data),
    onMutate: async ({ id, data }) => {
      if (!detailId) return;
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates", detailId] });
      const snapshot = queryClient.getQueryData<TemplateDetail>(["/api/curriculum-templates", detailId]);
      patchDetailCache(queryClient, detailId, old => {
        const topics = old.topics.map(t =>
          t.id === id ? { ...t, ...data } : t
        );
        return { ...old, topics, grouped: reGroupTopics(topics) };
      });
      setEditTopic(null);
      return { snapshot };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshot && detailId) queryClient.setQueryData(["/api/curriculum-templates", detailId], ctx.snapshot);
      toast({ title: "Failed to update topic", variant: "destructive" });
    },
    onSettled: () => {
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] });
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/curriculum-templates/topics/${id}`),
    onMutate: async (id) => {
      if (!detailId) return;
      await queryClient.cancelQueries({ queryKey: ["/api/curriculum-templates", detailId] });
      const snapshot = queryClient.getQueryData<TemplateDetail>(["/api/curriculum-templates", detailId]);
      patchDetailCache(queryClient, detailId, old => {
        const topics = old.topics.filter(t => t.id !== id);
        return { ...old, topics, grouped: reGroupTopics(topics), topicCount: topics.length };
      });
      patchTemplatesCache(queryClient, old =>
        old.map(t => t.id === detailId ? { ...t, topicCount: Math.max(0, t.topicCount - 1) } : t)
      );
      setDeleteTopic(null);
      return { snapshot };
    },
    onError: (_, __, ctx) => {
      if (ctx?.snapshot && detailId) queryClient.setQueryData(["/api/curriculum-templates", detailId], ctx.snapshot);
      toast({ title: "Failed to delete topic", variant: "destructive" });
    },
    onSettled: () => {
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] });
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openEditTemplate = (t: Template) => {
    setTplForm({ title: t.title, level: t.level, className: t.className, subjectName: t.subjectName, description: t.description ?? "" });
    setEditTemplate(t);
  };

  const openAddTopic = (templateId: number) => {
    setTopicForm(BLANK_TOPIC);
    setAddTopicTemplateId(templateId);
  };

  const openEditTopic = (t: Topic) => {
    setTopicForm({ term: t.term, weekNumber: t.weekNumber, name: t.name, description: t.description ?? "" });
    setEditTopic(t);
  };

  const openDetail = (id: number) => { setDetailId(id); setActiveDetailTab("first"); };

  const filtered = templates.filter(t =>
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subjectName.toLowerCase().includes(search.toLowerCase()) ||
      t.className.toLowerCase().includes(search.toLowerCase())) &&
    (levelFilter === "all" || t.level === levelFilter)
  );

  totalRef.current = filtered.length;
  const visibleFiltered = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-primary" />
            Curriculum Template Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage reusable Nigerian curriculum templates for all school levels
          </p>
        </div>
        <Button onClick={() => { setTplForm(BLANK_TPL); setShowCreateTemplate(true); }} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Templates", value: stats.total, icon: Layers, color: "text-primary" },
            { label: "Published", value: stats.published, icon: Globe, color: "text-green-600" },
            { label: "Drafts", value: stats.draft, icon: Clock, color: "text-amber-600" },
            { label: "Total Topics", value: stats.totalTopics, icon: FileText, color: "text-purple-600" },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-templates" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-level-filter">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="jss">JSS</SelectItem>
            <SelectItem value="ss">SS</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Template List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No templates found</p>
            <p className="text-sm">Create your first curriculum template to get started</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground pb-1">
              Showing {visibleFiltered.length} of {filtered.length} templates
            </p>
            {visibleFiltered.map(t => (
              <Card key={t.id} className="overflow-hidden" data-testid={`card-template-${t.id}`}>
                <div className="flex items-center gap-3 p-3 sm:p-4">

                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    data-testid={`button-expand-${t.id}`}
                  >
                    {expandedId === t.id
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{t.title}</span>
                      <Badge className={`text-xs ${LEVEL_COLORS[t.level]}`}>{LEVEL_LABELS[t.level]}</Badge>
                      <Badge variant="outline" className="text-xs">{t.className}</Badge>
                      {t.isPublished
                        ? <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />Published
                          </Badge>
                        : <Badge variant="outline" className="text-xs text-muted-foreground">
                            <Lock className="h-3 w-3 mr-1" />Draft
                          </Badge>
                      }
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.subjectName} · {t.topicCount} topics</p>
                  </div>

                  {/* Actions — icon-only except the primary CTA */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Primary CTA: View Topics */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2.5 gap-1.5"
                      onClick={() => openDetail(t.id)}
                      data-testid={`button-view-${t.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Topics</span>
                    </Button>

                    <IconBtn
                      icon={Edit2}
                      title="Edit template"
                      onClick={() => openEditTemplate(t)}
                      testId={`button-edit-${t.id}`}
                    />

                    <IconBtn
                      icon={t.isPublished ? Lock : Globe}
                      title={t.isPublished ? "Unpublish" : "Publish"}
                      onClick={() => publishMutation.mutate({ id: t.id, isPublished: !t.isPublished })}
                      testId={`button-publish-${t.id}`}
                      className={t.isPublished ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}
                    />

                    <IconBtn
                      icon={Trash2}
                      title="Delete template"
                      onClick={() => setDeleteTemplate(t)}
                      testId={`button-delete-${t.id}`}
                      className="text-destructive hover:text-destructive"
                    />
                  </div>
                </div>

                {/* Expanded quick-topic strip */}
                {expandedId === t.id && (
                  <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t.topicCount} Topics
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddTopic(t.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Add Topic
                      </Button>
                      <Button variant="link" className="text-xs p-0 h-auto" onClick={() => openDetail(t.id)}>
                        View all →
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
            {hasMore && (
              <div className="py-4 flex justify-center">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading more templates…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={detailId !== null} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {detailLoading ? "Loading…" : detail?.title}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={LEVEL_COLORS[detail.level]}>{LEVEL_LABELS[detail.level]}</Badge>
                <Badge variant="outline">{detail.className}</Badge>
                <Badge variant="outline">{detail.subjectName}</Badge>
                {detail.isPublished
                  ? <Badge className="bg-green-100 text-green-800"><Globe className="h-3 w-3 mr-1" />Published</Badge>
                  : <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Draft</Badge>
                }
              </div>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{detail.topicCount} Topics</span>
                <Button
                  size="sm"
                  onClick={() => { setDetailId(null); openAddTopic(detail.id); }}
                  data-testid="button-detail-add-topic"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Topic
                </Button>
              </div>

              <Tabs value={activeDetailTab} onValueChange={v => setActiveDetailTab(v as Term)}>
                <TabsList className="w-full">
                  {(["first", "second", "third"] as Term[]).map(term => (
                    <TabsTrigger key={term} value={term} className="flex-1 text-xs">
                      {TERM_LABELS[term]} ({detail.grouped[term]?.length ?? 0})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {(["first", "second", "third"] as Term[]).map(term => (
                  <TabsContent key={term} value={term} className="mt-3 space-y-1">
                    {(detail.grouped[term] ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No topics for this term yet</p>
                    ) : (
                      (detail.grouped[term] ?? []).map(topic => (
                        <div
                          key={topic.id}
                          className="flex items-start gap-2 p-2 rounded-lg bg-background border group"
                          data-testid={`topic-row-${topic.id}`}
                        >
                          <div className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">Wk {topic.weekNumber}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{topic.name}</p>
                            {topic.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                            )}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <IconBtn
                              icon={Edit2}
                              title="Edit topic"
                              onClick={() => openEditTopic(topic)}
                              testId={`button-edit-topic-${topic.id}`}
                              className="h-7 w-7"
                            />
                            <IconBtn
                              icon={Trash2}
                              title="Delete topic"
                              onClick={() => setDeleteTopic(topic)}
                              testId={`button-delete-topic-${topic.id}`}
                              className="h-7 w-7 text-destructive hover:text-destructive"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>
            {detail && (
              <Button
                variant={detail.isPublished ? "outline" : "default"}
                onClick={() => publishMutation.mutate({ id: detail.id, isPublished: !detail.isPublished })}
                disabled={publishMutation.isPending}
              >
                {detail.isPublished
                  ? <><Lock className="h-4 w-4 mr-2" />Unpublish</>
                  : <><Globe className="h-4 w-4 mr-2" />Publish</>
                }
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Template Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Curriculum Template</DialogTitle></DialogHeader>
          <TemplateFormFields form={tplForm} onChange={patchTpl} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(tplForm)}
              disabled={createMutation.isPending || !tplForm.title || !tplForm.className || !tplForm.subjectName}
              data-testid="button-submit-create-template"
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Template Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          <TemplateFormFields form={tplForm} onChange={patchTpl} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancel</Button>
            <Button
              onClick={() => editTemplate && updateMutation.mutate({ id: editTemplate.id, data: tplForm })}
              disabled={updateMutation.isPending || !tplForm.title || !tplForm.className || !tplForm.subjectName}
              data-testid="button-submit-edit-template"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Topic Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={addTopicTemplateId !== null} onOpenChange={() => setAddTopicTemplateId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Topic</DialogTitle></DialogHeader>
          <TopicFormFields form={topicForm} onChange={patchTopic} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTopicTemplateId(null)}>Cancel</Button>
            <Button
              onClick={() => addTopicTemplateId && addTopicMutation.mutate({ templateId: addTopicTemplateId, data: topicForm })}
              disabled={addTopicMutation.isPending || !topicForm.name}
              data-testid="button-submit-add-topic"
            >
              {addTopicMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</> : "Add Topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Topic Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editTopic} onOpenChange={() => setEditTopic(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Topic</DialogTitle></DialogHeader>
          <TopicFormFields form={topicForm} onChange={patchTopic} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTopic(null)}>Cancel</Button>
            <Button
              onClick={() => editTopic && updateTopicMutation.mutate({ id: editTopic.id, data: topicForm })}
              disabled={updateTopicMutation.isPending || !topicForm.name}
              data-testid="button-submit-edit-topic"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Template Confirm ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTemplate}
        onClose={() => setDeleteTemplate(null)}
        onConfirm={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)}
        title="Delete Template?"
        body={<>This will permanently delete <strong>{deleteTemplate?.title}</strong> and all its topics. This cannot be undone.</>}
        isPending={deleteMutation.isPending}
        confirmLabel="Delete Template"
      />

      {/* ── Delete Topic Confirm ───────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={() => deleteTopic && deleteTopicMutation.mutate(deleteTopic.id)}
        title="Delete Topic?"
        body={<>Remove <strong>{deleteTopic?.name}</strong> from this template?</>}
        isPending={deleteTopicMutation.isPending}
        confirmLabel="Delete Topic"
      />
    </div>
  );
}
