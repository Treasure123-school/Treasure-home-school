import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, Plus, Edit2, Trash2, Eye, Globe, Lock, Search,
  ChevronDown, ChevronRight, Layers, BookMarked, FileText,
  BarChart3, CheckCircle, Clock,
} from "lucide-react";

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

const LEVEL_LABELS: Record<Level, string> = {
  primary: "Primary",
  jss: "JSS",
  ss: "SS",
  custom: "Custom",
};

const LEVEL_COLORS: Record<Level, string> = {
  primary: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  jss: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ss: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  custom: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

const TERM_LABELS: Record<Term, string> = { first: "First Term", second: "Second Term", third: "Third Term" };

export default function SuperAdminCurriculumTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<Term>("first");

  // Dialogs
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [addTopicTemplateId, setAddTopicTemplateId] = useState<number | null>(null);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);

  // Forms
  const [tplForm, setTplForm] = useState({ title: "", level: "jss" as Level, className: "", subjectName: "", description: "" });
  const [topicForm, setTopicForm] = useState({ term: "first" as Term, weekNumber: 1, name: "", description: "" });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<{ total: number; published: number; draft: number; totalTopics: number }>({
    queryKey: ["/api/curriculum-templates/stats"],
  });

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/curriculum-templates", search, levelFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (levelFilter !== "all") p.set("level", levelFilter);
      return fetch(`/api/curriculum-templates?${p}`).then(r => r.json());
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery<TemplateDetail>({
    queryKey: ["/api/curriculum-templates", detailId],
    queryFn: () => fetch(`/api/curriculum-templates/${detailId}`).then(r => r.json()),
    enabled: detailId !== null,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates/stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof tplForm) => apiRequest("POST", "/api/curriculum-templates", data),
    onSuccess: () => { toast({ title: "Template created" }); invalidate(); setShowCreateTemplate(false); resetTplForm(); },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof tplForm }) => apiRequest("PUT", `/api/curriculum-templates/${id}`, data),
    onSuccess: () => { toast({ title: "Template updated" }); invalidate(); setEditTemplate(null); },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/curriculum-templates/${id}`),
    onSuccess: () => { toast({ title: "Template deleted" }); invalidate(); setDeleteTemplate(null); if (detailId === deleteTemplate?.id) setDetailId(null); },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      apiRequest("PATCH", `/api/curriculum-templates/${id}/publish`, { isPublished }),
    onSuccess: (_d, v) => { toast({ title: v.isPublished ? "Template published" : "Template unpublished" }); invalidate(); if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] }); },
    onError: () => toast({ title: "Failed to update publish status", variant: "destructive" }),
  });

  const addTopicMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data: typeof topicForm }) =>
      apiRequest("POST", `/api/curriculum-templates/${templateId}/topics`, data),
    onSuccess: () => { toast({ title: "Topic added" }); if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] }); invalidate(); setAddTopicTemplateId(null); resetTopicForm(); },
    onError: () => toast({ title: "Failed to add topic", variant: "destructive" }),
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof topicForm }) =>
      apiRequest("PUT", `/api/curriculum-templates/topics/${id}`, data),
    onSuccess: () => { toast({ title: "Topic updated" }); if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] }); setEditTopic(null); },
    onError: () => toast({ title: "Failed to update topic", variant: "destructive" }),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/curriculum-templates/topics/${id}`),
    onSuccess: () => { toast({ title: "Topic deleted" }); if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/curriculum-templates", detailId] }); invalidate(); setDeleteTopic(null); },
    onError: () => toast({ title: "Failed to delete topic", variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resetTplForm = () => setTplForm({ title: "", level: "jss", className: "", subjectName: "", description: "" });
  const resetTopicForm = () => setTopicForm({ term: "first", weekNumber: 1, name: "", description: "" });

  const openEdit = (t: Template) => {
    setTplForm({ title: t.title, level: t.level, className: t.className, subjectName: t.subjectName, description: t.description ?? "" });
    setEditTemplate(t);
  };

  const openAddTopic = (templateId: number) => {
    resetTopicForm();
    setAddTopicTemplateId(templateId);
  };

  const openEditTopic = (t: Topic) => {
    setTopicForm({ term: t.term, weekNumber: t.weekNumber, name: t.name, description: t.description ?? "" });
    setEditTopic(t);
  };

  const filtered = templates.filter(t =>
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subjectName.toLowerCase().includes(search.toLowerCase()) ||
      t.className.toLowerCase().includes(search.toLowerCase())) &&
    (levelFilter === "all" || t.level === levelFilter)
  );

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
        <Button onClick={() => { resetTplForm(); setShowCreateTemplate(true); }} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Templates", value: stats.total, icon: Layers, color: "text-blue-600" },
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
          <Input placeholder="Search templates..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-templates" />
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

      {/* Templates List */}
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
          filtered.map(t => (
            <Card key={t.id} className="overflow-hidden" data-testid={`card-template-${t.id}`}>
              <div className="flex items-center gap-3 p-4">
                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`button-expand-${t.id}`}
                >
                  {expandedId === t.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm truncate">{t.title}</span>
                    <Badge className={`text-xs ${LEVEL_COLORS[t.level]}`}>{LEVEL_LABELS[t.level]}</Badge>
                    <Badge variant="outline" className="text-xs">{t.className}</Badge>
                    {t.isPublished
                      ? <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground"><Lock className="h-3 w-3 mr-1" />Draft</Badge>
                    }
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.subjectName} · {t.topicCount} topics</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setDetailId(t.id); setActiveDetailTab("first"); }} data-testid={`button-view-${t.id}`}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-${t.id}`}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => publishMutation.mutate({ id: t.id, isPublished: !t.isPublished })} data-testid={`button-publish-${t.id}`}>
                    {t.isPublished ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTemplate(t)} data-testid={`button-delete-${t.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded quick-topic list */}
              {expandedId === t.id && (
                <div className="border-t bg-muted/30 px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topics Preview</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAddTopic(t.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Topic
                    </Button>
                  </div>
                  <Button variant="link" className="text-xs p-0 h-auto" onClick={() => { setDetailId(t.id); setActiveDetailTab("first"); }}>
                    View all {t.topicCount} topics →
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ── Detail Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={detailId !== null} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {detailLoading ? "Loading..." : detail?.title}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="flex-1 overflow-y-auto space-y-4">
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
                <Button size="sm" onClick={() => { setDetailId(null); openAddTopic(detail.id); }} data-testid="button-detail-add-topic">
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
                        <div key={topic.id} className="flex items-start gap-2 p-2 rounded-lg bg-background border group" data-testid={`topic-row-${topic.id}`}>
                          <div className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">Wk {topic.weekNumber}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{topic.name}</p>
                            {topic.description && <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditTopic(topic)} data-testid={`button-edit-topic-${topic.id}`}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteTopic(topic)} data-testid={`button-delete-topic-${topic.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>
            {detail && (
              <Button onClick={() => publishMutation.mutate({ id: detail.id, isPublished: !detail.isPublished })} disabled={publishMutation.isPending}>
                {detail.isPublished ? <><Lock className="h-4 w-4 mr-2" />Unpublish</> : <><Globe className="h-4 w-4 mr-2" />Publish</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Template Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Curriculum Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input placeholder="e.g. JSS 1 – Mathematics (First Term)" value={tplForm.title}
                onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))} data-testid="input-template-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level</Label>
                <Select value={tplForm.level} onValueChange={v => setTplForm(f => ({ ...f, level: v as Level }))}>
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
                <Input placeholder="e.g. JSS 1" value={tplForm.className}
                  onChange={e => setTplForm(f => ({ ...f, className: e.target.value }))} data-testid="input-template-class" />
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input placeholder="e.g. Mathematics" value={tplForm.subjectName}
                onChange={e => setTplForm(f => ({ ...f, subjectName: e.target.value }))} data-testid="input-template-subject" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={tplForm.description}
                onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} data-testid="textarea-template-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(tplForm)} disabled={createMutation.isPending || !tplForm.title || !tplForm.className || !tplForm.subjectName} data-testid="button-submit-create-template">
              {createMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Template Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={tplForm.title} onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level</Label>
                <Select value={tplForm.level} onValueChange={v => setTplForm(f => ({ ...f, level: v as Level }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input value={tplForm.className} onChange={e => setTplForm(f => ({ ...f, className: e.target.value }))} data-testid="input-edit-class" />
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={tplForm.subjectName} onChange={e => setTplForm(f => ({ ...f, subjectName: e.target.value }))} data-testid="input-edit-subject" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={tplForm.description} onChange={e => setTplForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancel</Button>
            <Button onClick={() => editTemplate && updateMutation.mutate({ id: editTemplate.id, data: tplForm })} disabled={updateMutation.isPending} data-testid="button-submit-edit-template">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Topic Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={addTopicTemplateId !== null} onOpenChange={() => setAddTopicTemplateId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Topic</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Term</Label>
                <Select value={topicForm.term} onValueChange={v => setTopicForm(f => ({ ...f, term: v as Term }))}>
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
                <Input type="number" min={1} max={16} value={topicForm.weekNumber}
                  onChange={e => setTopicForm(f => ({ ...f, weekNumber: parseInt(e.target.value) || 1 }))} data-testid="input-topic-week" />
              </div>
            </div>
            <div>
              <Label>Topic Name</Label>
              <Input placeholder="e.g. Introduction to Algebra" value={topicForm.name}
                onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))} data-testid="input-topic-name" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={topicForm.description}
                onChange={e => setTopicForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTopicTemplateId(null)}>Cancel</Button>
            <Button onClick={() => addTopicTemplateId && addTopicMutation.mutate({ templateId: addTopicTemplateId, data: topicForm })}
              disabled={addTopicMutation.isPending || !topicForm.name} data-testid="button-submit-add-topic">
              {addTopicMutation.isPending ? "Adding..." : "Add Topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Topic Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editTopic} onOpenChange={() => setEditTopic(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Topic</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Term</Label>
                <Select value={topicForm.term} onValueChange={v => setTopicForm(f => ({ ...f, term: v as Term }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First Term</SelectItem>
                    <SelectItem value="second">Second Term</SelectItem>
                    <SelectItem value="third">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Week</Label>
                <Input type="number" min={1} max={16} value={topicForm.weekNumber}
                  onChange={e => setTopicForm(f => ({ ...f, weekNumber: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <Label>Topic Name</Label>
              <Input value={topicForm.name} onChange={e => setTopicForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={topicForm.description} onChange={e => setTopicForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTopic(null)}>Cancel</Button>
            <Button onClick={() => editTopic && updateTopicMutation.mutate({ id: editTopic.id, data: topicForm })} disabled={updateTopicMutation.isPending} data-testid="button-submit-edit-topic">
              {updateTopicMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialogs ─────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Template?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{deleteTemplate?.title}</strong> and all its topics. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-template">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTopic} onOpenChange={() => setDeleteTopic(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Topic?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTopic?.name}</strong> from this template?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTopic(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTopic && deleteTopicMutation.mutate(deleteTopic.id)} disabled={deleteTopicMutation.isPending} data-testid="button-confirm-delete-topic">
              {deleteTopicMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
