import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BookMarked, Search, Eye, Download, BookOpen, ChevronRight,
  CheckCircle, AlertCircle, Globe, Layers, FileText, Info,
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

interface AcademicTerm {
  id: number;
  name: string;
  term: number;
  isActive: boolean;
}

interface ClassItem { id: number; name: string; level: string; }
interface SubjectItem { id: number; name: string; }

const LEVEL_LABELS: Record<Level, string> = { primary: "Primary", jss: "JSS", ss: "SS", custom: "Custom" };
const LEVEL_COLORS: Record<Level, string> = {
  primary: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  jss: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ss: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  custom: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};
const TERM_LABELS: Record<Term, string> = { first: "First Term", second: "Second Term", third: "Third Term" };
const TERMS: Term[] = ["first", "second", "third"];

interface ImportResult {
  message: string;
  created: number;
  skipped: number;
  skippedNames: string[];
  errors: string[];
}

export default function AdminCurriculumLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<Term>("first");

  // Import wizard
  const [importTemplate, setImportTemplate] = useState<Template | null>(null);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importClassId, setImportClassId] = useState("");
  const [importSubjectId, setImportSubjectId] = useState("");
  const [importTerms, setImportTerms] = useState<Term[]>(["first"]);
  const [importTermIds, setImportTermIds] = useState<Record<Term, string>>({ first: "", second: "", third: "" });
  const [publishOnImport, setPublishOnImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: rawTemplates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/curriculum-templates", search, levelFilter, "admin"],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (levelFilter !== "all") p.set("level", levelFilter);
      return apiRequest("GET", `/api/curriculum-templates?${p}`).then(r => r.json());
    },
  });
  const templates: Template[] = Array.isArray(rawTemplates) ? rawTemplates : [];

  const { data: detail, isLoading: detailLoading } = useQuery<TemplateDetail>({
    queryKey: ["/api/curriculum-templates", previewId],
    queryFn: () => apiRequest("GET", `/api/curriculum-templates/${previewId}`).then(r => r.json()),
    enabled: previewId !== null,
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({ queryKey: ["/api/classes"] });
  const { data: subjects = [] } = useQuery<SubjectItem[]>({ queryKey: ["/api/subjects"] });
  const { data: terms = [] } = useQuery<AcademicTerm[]>({ queryKey: ["/api/terms"] });

  // ── Import mutation ───────────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: (data: {
      classId: number; subjectId: number;
      termIds: Record<string, number>; terms: Term[];
      publishOnImport: boolean;
    }) => apiRequest("POST", `/api/curriculum-templates/${importTemplate!.id}/import`, data),
    onSuccess: async (res) => {
      const result: ImportResult = await res.json();
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/syllabus-topics"] });
      toast({ title: result.created > 0 ? "Import successful!" : "Import complete", description: result.message });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const openImport = (t: Template) => {
    setImportTemplate(t);
    setImportStep(1);
    setImportClassId("");
    setImportSubjectId("");
    setImportTerms(["first"]);
    setImportTermIds({ first: "", second: "", third: "" });
    setPublishOnImport(false);
    setImportResult(null);
  };

  const toggleTerm = (term: Term) => {
    setImportTerms(prev => prev.includes(term) ? prev.filter(t => t !== term) : [...prev, term]);
  };

  const canProceedStep1 = importClassId && importSubjectId && importTerms.length > 0;
  const canSubmit = importTerms.every(t => importTermIds[t]);

  const handleImport = () => {
    if (!importTemplate || !canSubmit) return;
    const termIds: Record<string, number> = {};
    for (const term of importTerms) {
      termIds[term] = parseInt(importTermIds[term]);
    }
    importMutation.mutate({
      classId: parseInt(importClassId),
      subjectId: parseInt(importSubjectId),
      termIds,
      terms: importTerms,
      publishOnImport,
    });
  };

  const filteredTemplates = templates.filter(t =>
    t.isPublished &&
    (!search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.subjectName.toLowerCase().includes(search.toLowerCase()) ||
      t.className.toLowerCase().includes(search.toLowerCase())) &&
    (levelFilter === "all" || t.level === levelFilter)
  );

  // Group templates by level then class
  const grouped: Record<string, Template[]> = {};
  for (const t of filteredTemplates) {
    const key = `${LEVEL_LABELS[t.level]} — ${t.className}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  const termOptions = terms.filter(t => !t.name.toLowerCase().includes("mock"));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          Curriculum Template Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and import Nigerian curriculum templates into your school's scheme of work
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How importing works</p>
          <p className="mt-0.5 text-blue-700 dark:text-blue-400">
            After importing, topics are added to your school's scheme of work as fully editable copies.
            Editing them won't affect the global template. You can add, edit, or delete topics freely after import.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by subject, class or title..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-library" />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-library-level">
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

      {/* Template list grouped */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates available</p>
          <p className="text-sm">Published curriculum templates will appear here</p>
        </div>
      ) : (
        Object.entries(grouped).map(([groupKey, groupTemplates]) => (
          <div key={groupKey} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{groupKey}</h3>
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{groupTemplates.length}</span>
            </div>
            <div className="grid gap-2">
              {groupTemplates.map(t => (
                <Card key={t.id} className="hover:border-primary/50 transition-colors" data-testid={`card-library-${t.id}`}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{t.title}</span>
                        <Badge className={`text-xs ${LEVEL_COLORS[t.level]}`}>{LEVEL_LABELS[t.level]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.subjectName} · {t.topicCount} topics across 3 terms
                      </p>
                      {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => { setPreviewId(t.id); setActivePreviewTab("first"); }} data-testid={`button-preview-${t.id}`}>
                        <Eye className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <Button size="sm" onClick={() => openImport(t)} data-testid={`button-import-${t.id}`}>
                        <Download className="h-4 w-4 mr-1" /> Import
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Preview Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={previewId !== null} onOpenChange={() => setPreviewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {detailLoading ? "Loading..." : detail?.title}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={LEVEL_COLORS[detail.level]}>{LEVEL_LABELS[detail.level]}</Badge>
                <Badge variant="outline">{detail.className}</Badge>
                <Badge variant="outline">{detail.subjectName}</Badge>
                <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />{detail.topicCount} Topics</Badge>
              </div>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}

              <Tabs value={activePreviewTab} onValueChange={v => setActivePreviewTab(v as Term)}>
                <TabsList className="w-full">
                  {TERMS.map(term => (
                    <TabsTrigger key={term} value={term} className="flex-1 text-xs">
                      {TERM_LABELS[term]} ({detail.grouped[term]?.length ?? 0})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {TERMS.map(term => (
                  <TabsContent key={term} value={term} className="mt-3 space-y-1">
                    {(detail.grouped[term] ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No topics for this term</p>
                    ) : (
                      (detail.grouped[term] ?? []).map(topic => (
                        <div key={topic.id} className="flex items-start gap-2 p-2 rounded bg-muted/40">
                          <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">Wk {topic.weekNumber}</span>
                          <div>
                            <p className="text-sm">{topic.name}</p>
                            {topic.description && <p className="text-xs text-muted-foreground">{topic.description}</p>}
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
            <Button variant="outline" onClick={() => setPreviewId(null)}>Close</Button>
            {detail && (
              <Button onClick={() => { setPreviewId(null); openImport(detail); }} data-testid="button-preview-import">
                <Download className="h-4 w-4 mr-2" /> Import This Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Wizard Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!importTemplate && !importResult} onOpenChange={() => { setImportTemplate(null); setImportResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Import: {importTemplate?.title}
            </DialogTitle>
          </DialogHeader>

          {importStep === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Select the class, subject and terms you want to import topics for.
              </p>

              {/* Class */}
              <div>
                <Label>Target Class <span className="text-destructive">*</span></Label>
                <Select value={importClassId} onValueChange={setImportClassId}>
                  <SelectTrigger data-testid="select-import-class"><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div>
                <Label>Target Subject <span className="text-destructive">*</span></Label>
                <Select value={importSubjectId} onValueChange={setImportSubjectId}>
                  <SelectTrigger data-testid="select-import-subject"><SelectValue placeholder="Select subject..." /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Template: <strong>{importTemplate?.subjectName}</strong> — pick the matching subject in your school
                </p>
              </div>

              {/* Terms */}
              <div>
                <Label className="mb-2 block">Terms to Import <span className="text-destructive">*</span></Label>
                <div className="space-y-2">
                  {TERMS.map(term => (
                    <div key={term} className="flex items-center gap-2">
                      <Checkbox id={`term-${term}`} checked={importTerms.includes(term)} onCheckedChange={() => toggleTerm(term)} data-testid={`checkbox-term-${term}`} />
                      <Label htmlFor={`term-${term}`} className="cursor-pointer font-normal">{TERM_LABELS[term]}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Publish option */}
              <div className="flex items-center gap-2">
                <Checkbox id="publish-on-import" checked={publishOnImport} onCheckedChange={v => setPublishOnImport(!!v)} data-testid="checkbox-publish-on-import" />
                <Label htmlFor="publish-on-import" className="cursor-pointer font-normal text-sm">
                  Publish topics immediately after import
                </Label>
              </div>
            </div>
          )}

          {importStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map each selected term to an academic term in your school.
              </p>
              {importTerms.map(term => (
                <div key={term}>
                  <Label>{TERM_LABELS[term]} <span className="text-destructive">*</span></Label>
                  <Select value={importTermIds[term]} onValueChange={v => setImportTermIds(prev => ({ ...prev, [term]: v }))}>
                    <SelectTrigger data-testid={`select-term-id-${term}`}><SelectValue placeholder="Select academic term..." /></SelectTrigger>
                    <SelectContent>
                      {termOptions.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {importStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setImportTemplate(null)}>Cancel</Button>
                <Button onClick={() => setImportStep(2)} disabled={!canProceedStep1} data-testid="button-import-next">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportStep(1)}>Back</Button>
                <Button onClick={handleImport} disabled={!canSubmit || importMutation.isPending} data-testid="button-import-submit">
                  {importMutation.isPending ? "Importing..." : `Import ${importTerms.length} Term(s)`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Result Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!importResult} onOpenChange={() => { setImportTemplate(null); setImportResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult && importResult.created > 0
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-amber-600" />}
              Import Complete
            </DialogTitle>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600">Topics Added</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped (Duplicates)</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{importResult.message}</p>

              {importResult.skippedNames.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Skipped topics:</p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {importResult.skippedNames.map((name, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {name}</p>
                    ))}
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-destructive/10 p-3 rounded-lg">
                  <p className="text-xs font-medium text-destructive mb-1">Errors:</p>
                  {importResult.errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                </div>
              )}

              {importResult.created > 0 && (
                <p className="text-sm text-muted-foreground">
                  Go to <strong>Syllabus Topics</strong> to view, edit, and manage your imported topics.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => { setImportTemplate(null); setImportResult(null); }} data-testid="button-import-done">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
