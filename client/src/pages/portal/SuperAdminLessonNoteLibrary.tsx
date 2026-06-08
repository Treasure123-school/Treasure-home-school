import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Search, Eye, Edit, Trash2, CheckCircle, XCircle,
  FileText, GraduationCap, Clock, X, Library, BookMarked, ChevronLeft, ChevronRight,
} from "lucide-react";

const LEVELS = ["primary", "jss", "ss", "custom"];
const TERMS = ["first", "second", "third"];
const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

interface Template {
  id: number;
  title: string;
  level: string;
  className: string;
  subjectName: string;
  term: string;
  weekNumber: number;
  topic: string;
  duration?: string;
  objectives?: string;
  entryBehaviour?: string;
  instructionalMaterials?: string;
  content?: string;
  teacherActivities?: string;
  studentActivities?: string;
  evaluationQuestions?: string;
  assignments?: string;
  references?: string;
  isPublished: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  title: "", level: "jss", className: "", subjectName: "",
  term: "first", weekNumber: 1, topic: "", duration: "40 minutes",
  objectives: "", entryBehaviour: "", instructionalMaterials: "",
  content: "", teacherActivities: "", studentActivities: "",
  evaluationQuestions: "", assignments: "", references: "",
};

const levelLabel = (l: string) =>
  ({ primary: "Primary", jss: "JSS", ss: "SS", custom: "Custom" }[l] ?? l.toUpperCase());

const termLabel = (t: string) =>
  ({ first: "First Term", second: "Second Term", third: "Third Term" }[t] ?? t);

function TemplateForm({ form, onChange }: { form: typeof EMPTY_FORM; onChange: (k: string, v: string | number) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Lesson Note Title *</Label>
          <Input value={form.title} onChange={e => onChange("title", e.target.value)} placeholder="e.g. JSS 1 Mathematics – Whole Numbers" />
        </div>
        <div>
          <Label>Level *</Label>
          <Select value={form.level} onValueChange={v => onChange("level", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map(l => <SelectItem key={l} value={l}>{levelLabel(l)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class *</Label>
          <Input value={form.className} onChange={e => onChange("className", e.target.value)} placeholder="e.g. JSS 1, SS 2, Primary 4" />
        </div>
        <div>
          <Label>Subject *</Label>
          <Input value={form.subjectName} onChange={e => onChange("subjectName", e.target.value)} placeholder="e.g. Mathematics, English Language" />
        </div>
        <div>
          <Label>Term *</Label>
          <Select value={form.term} onValueChange={v => onChange("term", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TERMS.map(t => <SelectItem key={t} value={t}>{termLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Week Number *</Label>
          <Select value={String(form.weekNumber)} onValueChange={v => onChange("weekNumber", parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WEEKS.map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Duration</Label>
          <Input value={form.duration} onChange={e => onChange("duration", e.target.value)} placeholder="e.g. 40 minutes" />
        </div>
        <div className="md:col-span-2">
          <Label>Topic *</Label>
          <Input value={form.topic} onChange={e => onChange("topic", e.target.value)} placeholder="e.g. Introduction to Computers" />
        </div>
      </div>
      <div><Label>Learning Objectives</Label><Textarea rows={4} value={form.objectives} onChange={e => onChange("objectives", e.target.value)} placeholder="By the end of this lesson, students should be able to..." /></div>
      <div><Label>Entry Behaviour (Prior Knowledge)</Label><Textarea rows={2} value={form.entryBehaviour} onChange={e => onChange("entryBehaviour", e.target.value)} placeholder="What students should already know..." /></div>
      <div><Label>Instructional Materials</Label><Textarea rows={2} value={form.instructionalMaterials} onChange={e => onChange("instructionalMaterials", e.target.value)} placeholder="Textbook, chart, whiteboard, specimens..." /></div>
      <div><Label>Lesson Content (Main Body)</Label><Textarea rows={8} value={form.content} onChange={e => onChange("content", e.target.value)} placeholder="Main lesson content — definitions, explanations, examples..." /></div>
      <div><Label>Teacher's Activities (Step-by-Step)</Label><Textarea rows={5} value={form.teacherActivities} onChange={e => onChange("teacherActivities", e.target.value)} placeholder="Step 1 (5 min): ...\nStep 2 (10 min): ..." /></div>
      <div><Label>Students' Activities</Label><Textarea rows={3} value={form.studentActivities} onChange={e => onChange("studentActivities", e.target.value)} placeholder="• Listen and take notes\n• Answer questions..." /></div>
      <div><Label>Evaluation Questions</Label><Textarea rows={4} value={form.evaluationQuestions} onChange={e => onChange("evaluationQuestions", e.target.value)} placeholder="1. Define...\n2. Explain...\n3. Calculate..." /></div>
      <div><Label>Assignment / Homework</Label><Textarea rows={3} value={form.assignments} onChange={e => onChange("assignments", e.target.value)} placeholder="1. Write...\n2. Draw..." /></div>
      <div><Label>References</Label><Textarea rows={2} value={form.references} onChange={e => onChange("references", e.target.value)} placeholder="1. Author (year). Title. Publisher.\n2. ..." /></div>
    </div>
  );
}

function ContentSection({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="mb-4">
      <h4 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">{label}</h4>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-700">
        {value}
      </div>
    </div>
  );
}

const subjectColors = [
  "bg-primary/10 text-primary border-primary/30",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
];
const subjectColorMap: Record<string, string> = {};
let colorIdx = 0;
function getSubjectColor(subjectName: string) {
  if (!subjectColorMap[subjectName]) {
    subjectColorMap[subjectName] = subjectColors[colorIdx % subjectColors.length];
    colorIdx++;
  }
  return subjectColorMap[subjectName];
}

export default function SuperAdminLessonNoteLibrary() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterTerm, setFilterTerm] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });

  const onChange = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const params = new URLSearchParams({
    page: String(page), limit: "12",
    ...(search && { search }),
    ...(filterLevel !== "all" && { level: filterLevel }),
    ...(filterClass !== "all" && { className: filterClass }),
    ...(filterSubject !== "all" && { subjectName: filterSubject }),
    ...(filterTerm !== "all" && { term: filterTerm }),
  });

  const { data: statsData } = useQuery<any>({ queryKey: ["/api/lesson-note-library/stats"] });
  const { data: templatesData, isLoading } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/templates", params.toString()],
    queryFn: () => apiRequest("GET", `/api/lesson-note-library/templates?${params}`).then(r => r.json()),
  });
  const { data: filterOpts } = useQuery<any>({ queryKey: ["/api/lesson-note-library/filter-options"] });
  const { data: previewData } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/templates", previewId],
    queryFn: () => previewId ? apiRequest("GET", `/api/lesson-note-library/templates/${previewId}`).then(r => r.json()) : null,
    enabled: !!previewId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lesson-note-library/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/filter-options"] });
      toast({ title: "Template created successfully" });
      setShowCreate(false); setForm({ ...EMPTY_FORM });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/lesson-note-library/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/templates"] });
      toast({ title: "Template updated successfully" }); setEditingId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to update", variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      apiRequest("PATCH", `/api/lesson-note-library/templates/${id}/publish`, { isPublished }),
    onSuccess: (_, { isPublished }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/stats"] });
      toast({ title: isPublished ? "Template published" : "Template unpublished" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const publishAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/lesson-note-library/templates/publish-all", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/filter-options"] });
      toast({ title: "All templates published", description: `${data?.updated ?? ""} templates are now visible.` });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lesson-note-library/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/stats"] });
      toast({ title: "Template deleted" }); setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const templates: Template[] = templatesData?.templates ?? [];
  const pagination = templatesData?.pagination ?? { page: 1, pages: 1, total: 0 };
  const stats = statsData ?? {};
  const opts = filterOpts ?? {};

  const openEdit = (t: Template) => {
    setForm({
      title: t.title, level: t.level, className: t.className,
      subjectName: t.subjectName, term: t.term, weekNumber: t.weekNumber,
      topic: t.topic, duration: t.duration ?? "40 minutes",
      objectives: t.objectives ?? "", entryBehaviour: t.entryBehaviour ?? "",
      instructionalMaterials: t.instructionalMaterials ?? "",
      content: t.content ?? "", teacherActivities: t.teacherActivities ?? "",
      studentActivities: t.studentActivities ?? "",
      evaluationQuestions: t.evaluationQuestions ?? "",
      assignments: t.assignments ?? "", references: t.references ?? "",
    });
    setEditingId(t.id);
  };

  const clearFilters = () => {
    setSearch(""); setFilterLevel("all"); setFilterClass("all");
    setFilterSubject("all"); setFilterTerm("all"); setPage(1);
  };
  const hasFilters = search || filterLevel !== "all" || filterClass !== "all" || filterSubject !== "all" || filterTerm !== "all";
  const previewTemplate: Template | null = previewData ?? null;

  const statCards = [
    { label: "Total Templates", value: stats.total ?? 0, icon: BookOpen, iconBg: "bg-primary/10", iconColor: "text-primary", numColor: "text-primary" },
    { label: "Published", value: stats.published ?? 0, icon: CheckCircle, iconBg: "bg-green-100", iconColor: "text-green-600", numColor: "text-green-600" },
    { label: "Drafts", value: stats.draft ?? 0, icon: FileText, iconBg: "bg-amber-100", iconColor: "text-amber-600", numColor: "text-amber-600" },
    { label: "Classes Covered", value: stats.classesCovered ?? 0, icon: GraduationCap, iconBg: "bg-purple-100", iconColor: "text-purple-600", numColor: "text-purple-600" },
    { label: "School Copies", value: stats.totalSchoolNotes ?? 0, icon: BookMarked, iconBg: "bg-rose-100", iconColor: "text-rose-600", numColor: "text-rose-600" },
  ];

  return (
    <SuperAdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Library className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Lesson Note Library</h1>
                <p className="text-sm text-muted-foreground">Master library of curriculum-aligned lesson note templates</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(stats.draft ?? 0) > 0 && (
                <Button
                  onClick={() => publishAllMutation.mutate()}
                  disabled={publishAllMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {publishAllMutation.isPending ? "Publishing..." : `Publish All (${stats.draft})`}
                </Button>
              )}
              <Button
                onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}
                className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> New Template
              </Button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {statCards.map(s => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${s.iconBg} dark:bg-opacity-20`}>
                    <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">{s.label}</span>
                </div>
                <p className={`text-3xl font-bold ${s.numColor}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, topic, subject..."
                  className="pl-9 rounded-xl"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-36 rounded-xl"><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{levelLabel(l)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={v => { setFilterClass(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-36 rounded-xl"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(opts.classNames ?? []).map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={v => { setFilterSubject(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-44 rounded-xl"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {(opts.subjectNames ?? []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTerm} onValueChange={v => { setFilterTerm(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-36 rounded-xl"><SelectValue placeholder="Term" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {TERMS.map(t => <SelectItem key={t} value={t}>{termLabel(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters" className="rounded-xl">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {pagination.total > 0 && (
              <p className="text-xs text-gray-400 mt-2 ml-1">{pagination.total} template{pagination.total !== 1 ? "s" : ""} found</p>
            )}
          </div>

          {/* Template Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl shadow-sm animate-pulse h-52" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl shadow-sm p-14 text-center">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-semibold text-base">No templates found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or create a new template.</p>
              <Button className="mt-4 bg-primary hover:bg-primary/90 text-white rounded-xl" onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Create Template
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col">
                    {/* Card Top Bar */}
                    <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-2">
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                          {levelLabel(t.level)}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${t.isPublished ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"}`}>
                          {t.isPublished ? "Published" : "Draft"}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors" onClick={() => setPreviewId(t.id)} title="Preview">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors" onClick={() => openEdit(t)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors" onClick={() => setDeleteId(t.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="px-4 py-3 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2 mb-2">{t.title}</h3>
                      <p className="text-xs font-medium text-primary dark:text-primary/70 italic line-clamp-1 mb-3">{t.topic}</p>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <GraduationCap className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{t.className}</span>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-xs font-medium border ${getSubjectColor(t.subjectName)}`}>{t.subjectName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>Week {t.weekNumber} &middot; {termLabel(t.term)}</span>
                          {t.duration && <><span className="text-gray-300 dark:text-gray-600">·</span><span>{t.duration}</span></>}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs rounded-xl border-gray-200 dark:border-gray-700"
                        onClick={() => setPreviewId(t.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`flex-1 h-8 text-xs rounded-xl ${t.isPublished ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20" : "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"}`}
                        onClick={() => publishMutation.mutate({ id: t.id, isPublished: !t.isPublished })}
                        disabled={publishMutation.isPending}
                      >
                        {t.isPublished
                          ? <><XCircle className="h-3 w-3 mr-1" /> Unpublish</>
                          : <><CheckCircle className="h-3 w-3 mr-1" /> Publish</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-center items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="rounded-xl border-gray-200 dark:border-gray-700 gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <div className="bg-card border border-border rounded-xl px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
                    Page {page} of {pagination.pages} <span className="text-gray-400 dark:text-gray-600">({pagination.total} total)</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                    className="rounded-xl border-gray-200 dark:border-gray-700 gap-1"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}

        {/* ── DIALOGS ─────────────────────────────────────────── */}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Create Lesson Note Template</DialogTitle>
              <DialogDescription>Add a new original lesson note template to the master library.</DialogDescription>
            </DialogHeader>
            <TemplateForm form={form} onChange={onChange} />
            <DialogFooter className="sticky bottom-0 bg-card pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" /> Edit Lesson Note Template</DialogTitle>
            </DialogHeader>
            <TemplateForm form={form} onChange={onChange} />
            <DialogFooter className="sticky bottom-0 bg-card pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => editingId && updateMutation.mutate({ id: editingId, data: form })} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewId} onOpenChange={() => setPreviewId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Lesson Note Preview</DialogTitle>
            </DialogHeader>
            {previewTemplate && (
              <div>
                <div className="bg-primary/5 dark:bg-primary/5 rounded-2xl p-4 mb-4 border border-primary/20 dark:border-primary/30">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{previewTemplate.title}</h2>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <span><strong>Class:</strong> {previewTemplate.className}</span>
                    <span><strong>Subject:</strong> {previewTemplate.subjectName}</span>
                    <span><strong>Term:</strong> {termLabel(previewTemplate.term)}</span>
                    <span><strong>Week:</strong> {previewTemplate.weekNumber}</span>
                    {previewTemplate.duration && <span><strong>Duration:</strong> {previewTemplate.duration}</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-primary dark:text-primary/60">{previewTemplate.topic}</p>
                </div>
                <ContentSection label="Learning Objectives" value={previewTemplate.objectives} />
                <ContentSection label="Entry Behaviour" value={previewTemplate.entryBehaviour} />
                <ContentSection label="Instructional Materials" value={previewTemplate.instructionalMaterials} />
                <ContentSection label="Lesson Content" value={previewTemplate.content} />
                <ContentSection label="Teacher's Activities" value={previewTemplate.teacherActivities} />
                <ContentSection label="Students' Activities" value={previewTemplate.studentActivities} />
                <ContentSection label="Evaluation Questions" value={previewTemplate.evaluationQuestions} />
                <ContentSection label="Assignment" value={previewTemplate.assignments} />
                <ContentSection label="References" value={previewTemplate.references} />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewId(null)}>Close</Button>
              {previewTemplate && (
                <Button className="bg-primary hover:bg-primary/90" onClick={() => { openEdit(previewTemplate); setPreviewId(null); }}>
                  <Edit className="h-4 w-4 mr-1" /> Edit Template
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Template</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this template? This action cannot be undone. Any school notes imported from this template will retain their content.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </SuperAdminLayout>
  );
}
