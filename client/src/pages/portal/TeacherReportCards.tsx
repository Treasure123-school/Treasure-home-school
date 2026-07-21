import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { BaileysReportTemplate } from '@/components/ui/report-card-template';
import { exportToPDF, exportToImage, printElement } from '@/lib/report-export-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FileText, GraduationCap, RefreshCw, Loader2, Send, FileCheck, Clock, MoreVertical, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { STANDARD_GRADING_SCALE } from '@shared/grading-utils';
import { calculateAge } from '@/lib/report-card-utils';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { ContactUtils } from '@shared/contact-utils';
import { ReportCardFilters } from '@/components/portal/ReportCardFilters';
import { ReportCardStatsBar } from '@/components/portal/ReportCardStatsBar';
import { EditScoreDialog } from '@/components/portal/EditScoreDialog';
import { ReportCardStudentTable } from '@/components/portal/ReportCardStudentTable';
import { ReportCardPreviewDialog } from '@/components/portal/ReportCardPreviewDialog';
import { ReportCardAnalyticsTab } from '@/components/portal/ReportCardAnalyticsTab';
import { useReportCardMutations } from '@/hooks/useReportCardMutations';

type SortField = 'position' | 'studentName' | 'averagePercentage' | 'overallGrade' | 'status';
type SortDir   = 'asc' | 'desc';

export default function TeacherReportCards() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedClass, setSelectedClass]   = useState('');
  const [selectedTerm,  setSelectedTerm]    = useState('');
  const [selectedReportCard, setSelectedReportCard] = useState<any>(null);
  const [selectedGradingScale, setSelectedGradingScale] = useState('standard');
  const [isViewDialogOpen,    setIsViewDialogOpen]    = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [selectedItem,  setSelectedItem]    = useState<any>(null);
  const [searchTerm,    setSearchTerm]      = useState('');
  const [statusFilter,  setStatusFilter]    = useState('all');
  const [activeTab,     setActiveTab]       = useState('students');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortField,     setSortField]       = useState<SortField>('position');
  const [sortDirection, setSortDirection]   = useState<SortDir>('asc');
  const [currentPage,   setCurrentPage]     = useState(1);
  const [isDownloading, setIsDownloading]   = useState(false);

  const reportCardRef     = useRef<HTMLDivElement>(null);
  const baileysTemplateRef = useRef<HTMLDivElement>(null);
  const selectedRCRef = useRef<any>(null);
  selectedRCRef.current = selectedReportCard;

  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });
  const { data: gradingConfig } = useQuery({
    queryKey: ['/api/grading-config', selectedGradingScale],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/grading-config?scale=${selectedGradingScale}`);
      return r.ok ? r.json() : null;
    },
  });
  const { data: assignmentData } = useQuery({
    queryKey: ['/api/my-assignments'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/my-assignments');
      return r.ok ? r.json() : { isAdmin: false, classes: [], subjects: [], assignments: [] };
    },
  });
  const { data: terms = [] } = useQuery({
    queryKey: ['/api/terms'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/terms'); return r.json(); },
  });
  const { data: reportCards = [], isLoading: loadingReportCards, refetch: refetchReportCards } = useQuery({
    queryKey: ['/api/reports/class-term', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];
      const r = await apiRequest('GET', `/api/reports/class-term/${selectedClass}/${selectedTerm}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!selectedClass && !!selectedTerm,
  });
  const { data: fullReportCard, isLoading: loadingFullReport, isFetching: fetchingFullReport, refetch: refetchFullReport } = useQuery({
    queryKey: ['/api/reports', selectedReportCard?.id, 'full'],
    queryFn: async () => {
      if (!selectedReportCard?.id) return null;
      const r = await apiRequest('GET', `/api/reports/${selectedReportCard.id}/full`);
      return r.ok ? r.json() : null;
    },
    enabled: !!selectedReportCard?.id && isViewDialogOpen,
  });

  const classes = assignmentData?.classes || [];
  const isAdmin = assignmentData?.isAdmin || false;
  const testWeight = gradingConfig?.dbSettings?.testWeight ?? STANDARD_GRADING_SCALE.testWeight;
  const examWeight = gradingConfig?.dbSettings?.examWeight ?? STANDARD_GRADING_SCALE.examWeight;

  useEffect(() => {
    if (gradingConfig?.currentConfig?.name && selectedGradingScale === 'standard')
      setSelectedGradingScale(gradingConfig.currentConfig.name);
  }, [gradingConfig?.currentConfig?.name]);

  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/reports/class-term', selectedClass, selectedTerm],
    enabled: !!selectedClass && !!selectedTerm,
    classId: selectedClass,
    skipCacheInvalidation: true,
  });

  const mutations = useReportCardMutations({
    selectedClass, selectedTerm,
    getSelectedReportCard: () => selectedRCRef.current,
    setSelectedReportCard,
    refetchReportCards,
    refetchFullReport,
  });

  // ── Filtering, sorting, pagination ──────────────────────────────────────
  const filtered = reportCards
    .filter((rc: any) => {
      const q = searchTerm.toLowerCase();
      return (rc.studentName?.toLowerCase().includes(q) || rc.admissionNumber?.toLowerCase().includes(q) || rc.studentUsername?.toLowerCase().includes(q))
        && (statusFilter === 'all' || rc.status === statusFilter);
    })
    .sort((a: any, b: any) => {
      const statusOrder: Record<string, number> = { draft: 1, finalized: 2, published: 3 };
      const vals: Record<string, [any, any]> = {
        position: [a.position || 999, b.position || 999],
        studentName: [(a.studentName || '').toLowerCase(), (b.studentName || '').toLowerCase()],
        averagePercentage: [a.averagePercentage || 0, b.averagePercentage || 0],
        overallGrade: [a.overallGrade || 'Z', b.overallGrade || 'Z'],
        status: [statusOrder[a.status] || 4, statusOrder[b.status] || 4],
      };
      const [av, bv] = vals[sortField] || [0, 0];
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDirection === 'asc' ? 1 : -1);
    });

  const itemsPerPage = 10;
  const totalPages   = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated    = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [filtered.length, totalPages]);

  // Scored cards: exclude null/undefined AND 0 to avoid unscored students skewing stats
  const scoredCards = reportCards.filter((rc: any) => rc.averagePercentage !== null && rc.averagePercentage !== undefined && rc.averagePercentage > 0);
  const statistics = reportCards.length > 0 ? {
    totalStudents: reportCards.length,
    passedStudents: reportCards.filter((rc: any) => (rc.averagePercentage || 0) >= 50).length,
    failedStudents: reportCards.filter((rc: any) => (rc.averagePercentage || 0) < 50).length,
    classAverage: scoredCards.length > 0 ? Math.round((scoredCards.reduce((s: number, rc: any) => s + (rc.averagePercentage || 0), 0) / scoredCards.length) * 10) / 10 : 0,
    classHighest: scoredCards.length > 0 ? Math.max(...scoredCards.map((rc: any) => rc.averagePercentage || 0)) : 0,
    classLowest:  scoredCards.length > 0 ? Math.min(...scoredCards.map((rc: any) => rc.averagePercentage || 0)) : 0,
    draftCount:   reportCards.filter((rc: any) => rc.status === 'draft').length,
    finalizedCount: reportCards.filter((rc: any) => rc.status === 'finalized').length,
    publishedCount: reportCards.filter((rc: any) => rc.status === 'published').length,
  } : null;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field as SortField); setSortDirection('asc'); }
  };

  const handleBulkStatus = (status: string) => {
    const ids = reportCards.filter((rc: any) => rc.status === (status === 'finalized' ? 'draft' : 'finalized')).map((rc: any) => rc.id);
    if (!ids.length) { toast({ title: 'No Report Cards to Update', description: `No ${status === 'finalized' ? 'draft' : 'finalized'} report cards found.`, variant: 'destructive' }); return; }
    mutations.bulkStatusMutation.mutate({ reportCardIds: ids, status });
  };

  const handleExportPDF = async () => {
    if (!baileysTemplateRef.current || !selectedReportCard) return;
    setIsDownloading(true);
    try { await exportToPDF(baileysTemplateRef.current, { filename: `report-card-${(fullReportCard as any)?.studentName?.replace(/\s+/g, '-') || 'student'}`, scale: 2 }); toast({ title: 'Success', description: 'Report card PDF downloaded' }); }
    catch (e: any) { toast({ title: 'Download Failed', description: e?.message || 'Could not download PDF.', variant: 'destructive' }); }
    finally { setIsDownloading(false); }
  };
  const handleExportImage = async () => {
    if (!baileysTemplateRef.current || !selectedReportCard) return;
    setIsDownloading(true);
    try { await exportToImage(baileysTemplateRef.current, { filename: `report-card-${(fullReportCard as any)?.studentName?.replace(/\s+/g, '-') || 'student'}`, scale: 2 }); toast({ title: 'Success', description: 'Report card downloaded as image' }); }
    catch (e: any) { toast({ title: 'Download Failed', description: e?.message || 'Could not download image.', variant: 'destructive' }); }
    finally { setIsDownloading(false); }
  };
  const handlePrint = () => baileysTemplateRef.current ? printElement(baileysTemplateRef.current) : window.print();

  if (!user) return <div>Loading...</div>;

  return (
    <div className="space-y-4" data-testid="teacher-report-cards">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <div className="flex items-center">
            <div className="p-2 rounded-lg"><FileText className="h-6 w-6 text-primary" /></div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="heading-report-cards">Report Cards</h1>
          </div>
          <p className="text-sm text-muted-foreground">View and manage auto-generated student report cards</p>
        </div>
      </div>

      <ReportCardFilters
        classes={classes} terms={terms} selectedClass={selectedClass} onClassChange={setSelectedClass}
        selectedTerm={selectedTerm} onTermChange={setSelectedTerm} statusFilter={statusFilter}
        onStatusFilterChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
        showAdvancedFilters={showAdvancedFilters} onToggleAdvancedFilters={() => setShowAdvancedFilters(v => !v)}
        selectedGradingScale={selectedGradingScale} onGradingScaleChange={setSelectedGradingScale}
        availableGradingScales={gradingConfig?.availableScales ?? []} testWeight={testWeight} examWeight={examWeight}
      />

      {!selectedClass || !selectedTerm ? (
        <Card><CardContent className="text-center py-12"><FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">Select Class and Term</h3><p className="text-muted-foreground">Please select a class and academic term to view report cards.</p></CardContent></Card>
      ) : loadingReportCards ? (
        <Card><CardContent className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" /><p>Loading report cards...</p></CardContent></Card>
      ) : (
        <>
          {statistics && reportCards.length > 0 && <ReportCardStatsBar statistics={statistics} />}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" />Class Report Cards</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="flex sm:hidden items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-yellow-600"><Clock className="w-3 h-3" />{statistics?.draftCount || 0}</span>
                        <span className="flex items-center gap-1 text-primary"><FileCheck className="w-3 h-3" />{statistics?.finalizedCount || 0}</span>
                        <span className="flex items-center gap-1 text-green-600"><Send className="w-3 h-3" />{statistics?.publishedCount || 0}</span>
                      </div>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-report-card-options">
                              {mutations.bulkRecalculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => mutations.bulkRecalculateMutation.mutate()} disabled={mutations.bulkRecalculateMutation.isPending || !selectedClass || !selectedTerm} data-testid="menu-bulk-recalculate">
                              <RefreshCw className="w-4 h-4 mr-2" />Recalculate All{selectedClass && selectedTerm ? ' (this class & term)' : ''}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleBulkStatus('finalized')} disabled={mutations.bulkStatusMutation.isPending}>
                              <FileCheck className="w-4 h-4 mr-2" />Finalize All Drafts
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatus('published')} disabled={mutations.bulkStatusMutation.isPending}>
                              <Send className="w-4 h-4 mr-2" />Publish All Finalized
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reportCards.length === 0 ? (
                    <div className="text-center py-8"><Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No Report Cards Yet</h3><p className="text-muted-foreground mb-2">Report cards will appear here automatically as students complete their exams.</p></div>
                  ) : (
                    <ReportCardStudentTable
                      paginatedCards={paginated} filteredCount={filtered.length} totalCount={reportCards.length} reportCardCount={reportCards.length}
                      searchTerm={searchTerm} onSearchChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
                      sort={{ field: sortField, direction: sortDirection }} onSort={handleSort}
                      currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
                      onView={(rc) => { setSelectedReportCard(rc); setIsViewDialogOpen(true); }}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <ReportCardAnalyticsTab reportCards={reportCards} statistics={statistics} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <ReportCardPreviewDialog
        open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}
        fullReportCard={fullReportCard} loadingFullReport={loadingFullReport} fetchingFullReport={fetchingFullReport}
        isDownloading={isDownloading} autoPopulatePending={mutations.autoPopulateMutation.isPending}
        updateStatusPending={mutations.updateStatusMutation.isPending} updateRemarksPending={mutations.updateRemarksMutation.isPending}
        testWeight={testWeight} examWeight={examWeight}
        classes={classes} selectedClass={selectedClass} selectedTerm={selectedTerm}
        statistics={statistics} isAdmin={isAdmin} user={user}
        onPrint={handlePrint} onExportPDF={handleExportPDF} onExportImage={handleExportImage}
        onRefresh={() => fullReportCard && mutations.autoPopulateMutation.mutate(fullReportCard.id)}
        onFinalize={() => fullReportCard && mutations.updateStatusMutation.mutate({ reportCardId: fullReportCard.id, status: 'finalized', classId: selectedClass, termId: selectedTerm })}
        onRevertDraft={() => fullReportCard && mutations.updateStatusMutation.mutate({ reportCardId: fullReportCard.id, status: 'draft', classId: selectedClass, termId: selectedTerm })}
        onEditSubject={(item) => { setSelectedItem(item); setIsOverrideDialogOpen(true); }}
        onSaveRemarks={(teacher, principal) => {
          const classInfo = classes.find((c: any) => c.id === Number(selectedClass));
          const payload: any = { reportCardId: fullReportCard.id };
          if (isAdmin || classInfo?.classTeacherId === user?.id) payload.teacherRemarks = teacher;
          if (user?.role?.toLowerCase() === 'admin') payload.principalRemarks = principal;
          mutations.updateRemarksMutation.mutate(payload);
        }}
        onSaveSkills={async (skills) => { await mutations.saveSkillsMutation.mutateAsync({ reportCardId: fullReportCard.id, skills }); }}
        onGenerateComments={async () => {
          const r = await apiRequest('GET', `/api/reports/${fullReportCard.id}/default-comments`);
          if (!r.ok) throw new Error('Failed to generate comments');
          return r.json();
        }}
        reportCardRef={reportCardRef}
      />

      <EditScoreDialog
        open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}
        item={selectedItem} reportCardQueryKey={['/api/reports', selectedReportCard?.id, 'full']}
        gradingConfig={gradingConfig} showRemarks={true}
        onSaveSuccess={(serverData) => {
          if (serverData.reportCardTotals?.position !== undefined) {
            queryClient.setQueryData(['/api/reports/class-term', selectedClass, selectedTerm], (old: any) =>
              Array.isArray(old) ? old.map((rc: any) => rc.id === selectedReportCard?.id ? { ...rc, averagePercentage: serverData.reportCardTotals?.averagePercentage ?? rc.averagePercentage, overallGrade: serverData.reportCardTotals?.overallGrade ?? rc.overallGrade, position: serverData.reportCardTotals?.position ?? rc.position } : rc) : old);
          }
        }}
      />

      {/* Off-screen Baileys template for PDF/image export */}
      {fullReportCard && isViewDialogOpen && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">
          <BaileysReportTemplate
            ref={baileysTemplateRef}
            reportCard={{
              studentName: fullReportCard.studentName,
              admissionNumber: fullReportCard.admissionNumber || fullReportCard.studentUsername || 'N/A',
              className: fullReportCard.className, classArm: fullReportCard.classArm,
              department: fullReportCard.department, isSSS: fullReportCard.isSSS,
              termName: fullReportCard.termName, academicSession: fullReportCard.academicSession || fullReportCard.sessionYear || '2024/2025',
              averagePercentage: fullReportCard.averagePercentage || 0, overallGrade: fullReportCard.overallGrade || '-',
              position: fullReportCard.position || 0, totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
              items: (fullReportCard.items || []).map((item: any) => ({ subjectName: item.subjectName, testScore: item.testScore ?? item.testWeightedScore ?? null, examScore: item.examScore ?? item.examWeightedScore ?? null, obtainedMarks: item.obtainedMarks ?? item.totalScore ?? 0, grade: item.grade || '-', remarks: item.remarks || item.teacherRemarks || '', subjectPosition: item.subjectPosition || null })),
              teacherRemarks: fullReportCard.teacherRemarks, principalRemarks: fullReportCard.principalRemarks,
              attendance: { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0 },
              studentPhoto: fullReportCard.studentPhoto, teacherSignatureUrl: fullReportCard.teacherSignatureUrl || null,
              principalSignatureUrl: fullReportCard.principalSignatureUrl || null,
              teacherName: fullReportCard.teacherName || '', principalName: fullReportCard.principalName || '',
              gender: fullReportCard.gender || '', dateOfBirth: fullReportCard.dateOfBirth ? format(new Date(fullReportCard.dateOfBirth), 'dd-MMM-yyyy') : '',
              age: calculateAge(fullReportCard.dateOfBirth), dateIssued: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              nextTermBegins: (fullReportCard as any).nextTermBegins || 'To be announced',
              affectiveTraits: fullReportCard.affectiveTraits || { punctuality: 0, neatness: 0, attentiveness: 0, teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0 },
              psychomotorSkills: fullReportCard.psychomotorSkills || { sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0 },
            }}
            testWeight={testWeight} examWeight={examWeight}
          />
        </div>
      )}
    </div>
  );
}
