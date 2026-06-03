import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Search, Eye, Download, Plus, Trash2, Edit, X,
  Library, BookMarked, GraduationCap, Clock, CheckCircle, FileText, RefreshCw,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const TERMS = ["first", "second", "third"];
const termLabel = (t: string) =>
  ({ first: "First Term", second: "Second Term", third: "Third Term" }[t] ?? t);

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
}

interface SchoolNote {
  id: number;
  templateId?: number;
  title: string;
  className?: string;
  subjectName?: string;
  term?: string;
  weekNumber?: number;
  topic?: string;
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
  status: string;
  createdAt: string;
  updatedAt: string;
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

function NoteEditor({ note, onSave, onCancel, isSaving }: {
  note: Partial<SchoolNote>;
  onSave: (data: Partial<SchoolNote>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(note);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Title *</Label>
          <Input value={form.title ?? ""} onChange={e => set("title", e.target.value)} />
        </div>
        <div><Label>Class</Label><Input value={form.className ?? ""} onChange={e => set("className", e.target.value)} /></div>
        <div><Label>Subject</Label><Input value={form.subjectName ?? ""} onChange={e => set("subjectName", e.target.value)} /></div>
        <div>
          <Label>Term</Label>
          <Select value={form.term ?? "first"} onValueChange={v => set("term", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TERMS.map(t => <SelectItem key={t} value={t}>{termLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Week Number</Label>
          <Input type="number" min="1" max="16" value={form.weekNumber ?? 1} onChange={e => set("weekNumber", parseInt(e.target.value))} />
        </div>
        <div className="md:col-span-2"><Label>Topic</Label><Input value={form.topic ?? ""} onChange={e => set("topic", e.target.value)} /></div>
        <div><Label>Duration</Label><Input value={form.duration ?? ""} onChange={e => set("duration", e.target.value)} placeholder="e.g. 40 minutes" /></div>
      </div>
      <div><Label>Learning Objectives</Label><Textarea rows={4} value={form.objectives ?? ""} onChange={e => set("objectives", e.target.value)} /></div>
      <div><Label>Entry Behaviour</Label><Textarea rows={2} value={form.entryBehaviour ?? ""} onChange={e => set("entryBehaviour", e.target.value)} /></div>
      <div><Label>Instructional Materials</Label><Textarea rows={2} value={form.instructionalMaterials ?? ""} onChange={e => set("instructionalMaterials", e.target.value)} /></div>
      <div><Label>Lesson Content</Label><Textarea rows={8} value={form.content ?? ""} onChange={e => set("content", e.target.value)} /></div>
      <div><Label>Teacher's Activities</Label><Textarea rows={5} value={form.teacherActivities ?? ""} onChange={e => set("teacherActivities", e.target.value)} /></div>
      <div><Label>Students' Activities</Label><Textarea rows={3} value={form.studentActivities ?? ""} onChange={e => set("studentActivities", e.target.value)} /></div>
      <div><Label>Evaluation Questions</Label><Textarea rows={4} value={form.evaluationQuestions ?? ""} onChange={e => set("evaluationQuestions", e.target.value)} /></div>
      <div><Label>Assignment / Homework</Label><Textarea rows={3} value={form.assignments ?? ""} onChange={e => set("assignments", e.target.value)} /></div>
      <div><Label>References</Label><Textarea rows={2} value={form.references ?? ""} onChange={e => set("references", e.target.value)} /></div>
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 pt-4 border-t flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => onSave(form)} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </div>
  );
}

const subjectColors = [
  "bg-blue-100 text-blue-700 border-blue-200",
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

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700" },
  approved:  { label: "Approved",  cls: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" },
  published: { label: "Published", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" },
  archived:  { label: "Archived",  cls: "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
};

export default function AdminLessonNoteLibrary() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("library");

  const [libSearch, setLibSearch] = useState("");
  const [libClass, setLibClass] = useState("all");
  const [libSubject, setLibSubject] = useState("all");
  const [libTerm, setLibTerm] = useState("all");
  const [libPage, setLibPage] = useState(1);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [importClassId, setImportClassId] = useState("");
  const [importSubjectId, setImportSubjectId] = useState("");
  const [importTermId, setImportTermId] = useState("");

  const [snSearch, setSnSearch] = useState("");
  const [snStatus, setSnStatus] = useState("all");
  const [snPage, setSnPage] = useState(1);
  const [editingNote, setEditingNote] = useState<SchoolNote | null>(null);
  const [createNote, setCreateNote] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);
  const [viewNoteId, setViewNoteId] = useState<number | null>(null);

  const libParams = new URLSearchParams({
    page: String(libPage), limit: "12",
    ...(libSearch && { search: libSearch }),
    ...(libClass !== "all" && { className: libClass }),
    ...(libSubject !== "all" && { subjectName: libSubject }),
    ...(libTerm !== "all" && { term: libTerm }),
  });
  const { data: libData, isLoading: libLoading } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/templates", libParams.toString()],
    queryFn: () => apiRequest("GET", `/api/lesson-note-library/templates?${libParams}`).then(r => r.json()),
  });
  const { data: filterOpts } = useQuery<any>({ queryKey: ["/api/lesson-note-library/filter-options"] });
  const { data: previewData } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/templates", previewId],
    queryFn: () => previewId ? apiRequest("GET", `/api/lesson-note-library/templates/${previewId}`).then(r => r.json()) : null,
    enabled: !!previewId,
  });
  const { data: classesData } = useQuery<any>({ queryKey: ["/api/classes"] });
  const { data: subjectsData } = useQuery<any>({ queryKey: ["/api/subjects"] });
  const { data: termsData } = useQuery<any>({ queryKey: ["/api/academic-terms"] });

  const snParams = new URLSearchParams({
    page: String(snPage), limit: "12",
    ...(snSearch && { search: snSearch }),
    ...(snStatus !== "all" && { status: snStatus }),
  });
  const { data: snData, isLoading: snLoading } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/school-notes", snParams.toString()],
    queryFn: () => apiRequest("GET", `/api/lesson-note-library/school-notes?${snParams}`).then(r => r.json()),
  });
  const { data: viewNoteData } = useQuery<any>({
    queryKey: ["/api/lesson-note-library/school-notes", viewNoteId],
    queryFn: () => viewNoteId ? apiRequest("GET", `/api/lesson-note-library/school-notes/${viewNoteId}`).then(r => r.json()) : null,
    enabled: !!viewNoteId,
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/lesson-note-library/templates/${importId}/import`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/school-notes"] });
      toast({ title: "Template imported", description: "A school copy has been created. View it in the School Notes tab." });
      setImportId(null); setImportClassId(""); setImportSubjectId(""); setImportTermId("");
      setActiveTab("school-notes");
    },
    onError: (err: any) => toast({ title: "Import failed", description: err?.message ?? "An error occurred", variant: "destructive" }),
  });

  const createNoteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lesson-note-library/school-notes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/school-notes"] });
      toast({ title: "Lesson note created" }); setCreateNote(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/lesson-note-library/school-notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/school-notes"] });
      toast({ title: "Lesson note updated" }); setEditingNote(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lesson-note-library/school-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-note-library/school-notes"] });
      toast({ title: "Lesson note deleted" }); setDeleteNoteId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const templates: Template[] = libData?.templates ?? [];
  const libPag = libData?.pagination ?? { page: 1, pages: 1, total: 0 };
  const opts = filterOpts ?? {};
  const previewTemplate: Template | null = previewData ?? null;
  const importTemplate: Template | null = importId ? templates.find(t => t.id === importId) ?? null : null;
  const schoolNotes: SchoolNote[] = snData?.notes ?? [];
  const snPag = snData?.pagination ?? { page: 1, pages: 1, total: 0 };
  const viewNote: SchoolNote | null = viewNoteData ?? null;
  const classes = classesData?.data ?? classesData ?? [];
  const subjects = subjectsData?.data ?? subjectsData ?? [];
  const terms = termsData?.data ?? termsData ?? [];
  const libHasFilters = libSearch || libClass !== "all" || libSubject !== "all" || libTerm !== "all";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Library className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Lesson Note Library</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Browse, preview, and import curriculum-aligned lesson note templates</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* Tab Bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-1.5 mb-5 flex gap-1 w-fit">
            <button
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "library" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              <Library className="h-4 w-4" /> Browse Library
            </button>
            <button
              onClick={() => setActiveTab("school-notes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "school-notes" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              <BookMarked className="h-4 w-4" /> School Notes
              {snPag.total > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === "school-notes" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                  {snPag.total}
                </span>
              )}
            </button>
          </div>

          {/* ── LIBRARY TAB ─────────────────────────────────── */}
          <TabsContent value="library" className="space-y-4 mt-0">

            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search topic, subject, class..."
                    className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
                    value={libSearch}
                    onChange={e => { setLibSearch(e.target.value); setLibPage(1); }}
                  />
                </div>
                <Select value={libClass} onValueChange={v => { setLibClass(v); setLibPage(1); }}>
                  <SelectTrigger className="w-full md:w-36 rounded-xl border-gray-200 dark:border-gray-700"><SelectValue placeholder="Class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {(opts.classNames ?? []).map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={libSubject} onValueChange={v => { setLibSubject(v); setLibPage(1); }}>
                  <SelectTrigger className="w-full md:w-44 rounded-xl border-gray-200 dark:border-gray-700"><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {(opts.subjectNames ?? []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={libTerm} onValueChange={v => { setLibTerm(v); setLibPage(1); }}>
                  <SelectTrigger className="w-full md:w-36 rounded-xl border-gray-200 dark:border-gray-700"><SelectValue placeholder="Term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {TERMS.map(t => <SelectItem key={t} value={t}>{termLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {libHasFilters && (
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setLibSearch(""); setLibClass("all"); setLibSubject("all"); setLibTerm("all"); setLibPage(1); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {libPag.total > 0 && (
                <p className="text-xs text-gray-400 mt-2 ml-1">{libPag.total} template{libPag.total !== 1 ? "s" : ""} found</p>
              )}
            </div>

            {libLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm animate-pulse h-52" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-14 text-center">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold text-base">No templates found</p>
                <p className="text-gray-400 text-sm mt-1">Try different filters or contact the Super Admin to publish templates.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col"
                      onClick={() => setPreviewId(t.id)}
                    >
                      {/* Top bar */}
                      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 uppercase">
                            {t.level}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5" /> Published
                          </span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="px-4 py-3 flex-1">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1.5">{t.title}</h3>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 italic line-clamp-1 mb-3">{t.topic}</p>
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

                      {/* Footer */}
                      <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-xl border-gray-200 dark:border-gray-700" onClick={() => setPreviewId(t.id)}>
                          <Eye className="h-3 w-3 mr-1" /> Preview
                        </Button>
                        <Button size="sm" className="flex-1 h-8 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => { setImportId(t.id); setImportClassId(""); setImportSubjectId(""); setImportTermId(""); }}>
                          <Download className="h-3 w-3 mr-1" /> Import
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {libPag.pages > 1 && (
                  <div className="flex justify-center items-center gap-3 pt-2">
                    <Button variant="outline" size="sm" disabled={libPage <= 1} onClick={() => setLibPage(p => p - 1)} className="rounded-xl border-gray-200 dark:border-gray-700 gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 shadow-sm">
                      Page {libPage} of {libPag.pages}
                    </div>
                    <Button variant="outline" size="sm" disabled={libPage >= libPag.pages} onClick={() => setLibPage(p => p + 1)} className="rounded-xl border-gray-200 dark:border-gray-700 gap-1">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── SCHOOL NOTES TAB ────────────────────────────── */}
          <TabsContent value="school-notes" className="space-y-4 mt-0">

            {/* Filters + Actions */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search school lesson notes..."
                    className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
                    value={snSearch}
                    onChange={e => { setSnSearch(e.target.value); setSnPage(1); }}
                  />
                </div>
                <Select value={snStatus} onValueChange={v => { setSnStatus(v); setSnPage(1); }}>
                  <SelectTrigger className="w-full md:w-36 rounded-xl border-gray-200 dark:border-gray-700"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {["draft", "approved", "published", "archived"].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setCreateNote(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> New Note
                </Button>
              </div>
            </div>

            {snLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm animate-pulse h-44" />
                ))}
              </div>
            ) : schoolNotes.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-14 text-center">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
                  <BookMarked className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold text-base">No school lesson notes yet</p>
                <p className="text-gray-400 text-sm mt-1 mb-5">Import templates from the library or create your own.</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setActiveTab("library")}>
                    <Library className="h-4 w-4 mr-1" /> Browse Library
                  </Button>
                  <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCreateNote(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create Note
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schoolNotes.map(n => {
                    const sc = statusConfig[n.status] ?? statusConfig.draft;
                    return (
                      <div key={n.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all group flex flex-col">
                        {/* Top bar */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {n.templateId && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 flex items-center gap-1">
                                <RefreshCw className="h-2.5 w-2.5" /> Imported
                              </span>
                            )}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${sc.cls}`}>
                              {sc.label}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors" onClick={() => setViewNoteId(n.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors" onClick={() => setEditingNote(n)}>
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors" onClick={() => setDeleteNoteId(n.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="px-4 py-3 flex-1">
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug mb-1">{n.title}</h3>
                          {n.topic && <p className="text-xs font-medium text-blue-600 dark:text-blue-400 italic line-clamp-1 mb-2">{n.topic}</p>}
                          <div className="space-y-1.5">
                            {(n.className || n.subjectName) && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <GraduationCap className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                {n.className && <span>{n.className}</span>}
                                {n.subjectName && (
                                  <>
                                    {n.className && <span className="text-gray-300 dark:text-gray-600">·</span>}
                                    <span className={`px-1.5 py-0.5 rounded-md text-xs font-medium border ${getSubjectColor(n.subjectName)}`}>{n.subjectName}</span>
                                  </>
                                )}
                              </div>
                            )}
                            {n.term && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>Week {n.weekNumber} &middot; {termLabel(n.term)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-xl border-gray-200 dark:border-gray-700" onClick={() => setViewNoteId(n.id)}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-xl border-gray-200 dark:border-gray-700" onClick={() => setEditingNote(n)}>
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {snPag.pages > 1 && (
                  <div className="flex justify-center items-center gap-3 pt-2">
                    <Button variant="outline" size="sm" disabled={snPage <= 1} onClick={() => setSnPage(p => p - 1)} className="rounded-xl border-gray-200 dark:border-gray-700 gap-1">
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 shadow-sm">
                      Page {snPage} of {snPag.pages}
                    </div>
                    <Button variant="outline" size="sm" disabled={snPage >= snPag.pages} onClick={() => setSnPage(p => p + 1)} className="rounded-xl border-gray-200 dark:border-gray-700 gap-1">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── DIALOGS ─────────────────────────────────────────── */}

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={() => setPreviewId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" /> Lesson Note Preview</DialogTitle>
            <DialogDescription>Review the full content of this template before importing.</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-4 border border-blue-100 dark:border-blue-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{previewTemplate.title}</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                  <span><strong>Class:</strong> {previewTemplate.className}</span>
                  <span><strong>Subject:</strong> {previewTemplate.subjectName}</span>
                  <span><strong>Term:</strong> {termLabel(previewTemplate.term)}</span>
                  <span><strong>Week:</strong> {previewTemplate.weekNumber}</span>
                  {previewTemplate.duration && <span><strong>Duration:</strong> {previewTemplate.duration}</span>}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">{previewTemplate.topic}</p>
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
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPreviewId(null)}>Close</Button>
            {previewId && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setImportId(previewId); setPreviewId(null); setImportClassId(""); setImportSubjectId(""); setImportTermId(""); }}>
                <Download className="h-4 w-4 mr-1" /> Import This Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={!!importId && !previewId} onOpenChange={() => setImportId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-blue-600" /> Import Lesson Note Template</DialogTitle>
            <DialogDescription>
              A school-specific copy will be created. The master template remains unchanged. You can edit the copy freely after importing.
            </DialogDescription>
          </DialogHeader>
          {importTemplate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-2 text-sm border border-blue-100 dark:border-blue-800">
              <p className="font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">{importTemplate.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{importTemplate.className} · {importTemplate.subjectName} · Wk {importTemplate.weekNumber}</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <Label>Map to Class *</Label>
              <Select value={importClassId} onValueChange={setImportClassId}>
                <SelectTrigger><SelectValue placeholder="Select a class..." /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(classes) ? classes : []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Map to Subject *</Label>
              <Select value={importSubjectId} onValueChange={setImportSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select a subject..." /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(subjects) ? subjects : []).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Map to Academic Term *</Label>
              <Select value={importTermId} onValueChange={setImportTermId}>
                <SelectTrigger><SelectValue placeholder="Select a term..." /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(terms) ? terms : []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">After importing, go to the School Notes tab to view and edit your copy.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportId(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!importClassId || !importSubjectId || !importTermId || importMutation.isPending}
              onClick={() => importMutation.mutate({ classId: parseInt(importClassId), subjectId: parseInt(importSubjectId), termId: parseInt(importTermId) })}
            >
              {importMutation.isPending ? "Importing..." : "Import Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View School Note Dialog */}
      <Dialog open={!!viewNoteId} onOpenChange={() => setViewNoteId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> School Lesson Note</DialogTitle>
          </DialogHeader>
          {viewNote && (
            <div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-4 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{viewNote.title}</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${(statusConfig[viewNote.status] ?? statusConfig.draft).cls}`}>
                    {viewNote.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                  {viewNote.className && <span><strong>Class:</strong> {viewNote.className}</span>}
                  {viewNote.subjectName && <span><strong>Subject:</strong> {viewNote.subjectName}</span>}
                  {viewNote.term && <span><strong>Term:</strong> {termLabel(viewNote.term)}</span>}
                  {viewNote.weekNumber && <span><strong>Week:</strong> {viewNote.weekNumber}</span>}
                  {viewNote.duration && <span><strong>Duration:</strong> {viewNote.duration}</span>}
                </div>
                {viewNote.topic && <p className="mt-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">{viewNote.topic}</p>}
              </div>
              <ContentSection label="Learning Objectives" value={viewNote.objectives} />
              <ContentSection label="Entry Behaviour" value={viewNote.entryBehaviour} />
              <ContentSection label="Instructional Materials" value={viewNote.instructionalMaterials} />
              <ContentSection label="Lesson Content" value={viewNote.content} />
              <ContentSection label="Teacher's Activities" value={viewNote.teacherActivities} />
              <ContentSection label="Students' Activities" value={viewNote.studentActivities} />
              <ContentSection label="Evaluation Questions" value={viewNote.evaluationQuestions} />
              <ContentSection label="Assignment" value={viewNote.assignments} />
              <ContentSection label="References" value={viewNote.references} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewNoteId(null)}>Close</Button>
            {viewNote && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingNote(viewNote); setViewNoteId(null); }}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit School Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-blue-600" /> Edit School Lesson Note</DialogTitle>
            <DialogDescription>Customise this lesson note for your school. The original library template is not affected.</DialogDescription>
          </DialogHeader>
          {editingNote && (
            <NoteEditor
              note={editingNote}
              isSaving={updateNoteMutation.isPending}
              onCancel={() => setEditingNote(null)}
              onSave={data => updateNoteMutation.mutate({ id: editingNote.id, data })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create School Note Dialog */}
      <Dialog open={createNote} onOpenChange={setCreateNote}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /> Create School Lesson Note</DialogTitle>
            <DialogDescription>Create a new lesson note from scratch for your school.</DialogDescription>
          </DialogHeader>
          <NoteEditor
            note={{ title: "", status: "draft" }}
            isSaving={createNoteMutation.isPending}
            onCancel={() => setCreateNote(false)}
            onSave={data => createNoteMutation.mutate(data)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Lesson Note</DialogTitle>
            <DialogDescription>Are you sure you want to delete this school lesson note? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNoteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)} disabled={deleteNoteMutation.isPending}>
              {deleteNoteMutation.isPending ? "Deleting..." : "Delete Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
