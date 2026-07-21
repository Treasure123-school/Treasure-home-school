/**
 * Teacher / Admin report cards page.
 * State, queries, handlers → useTeacherReportCardPage
 * Filtering, sorting, pagination, stats → useReportCardFilters
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FileText, GraduationCap, RefreshCw, Loader2, Send, FileCheck, Clock, MoreVertical, Sparkles } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useTeacherReportCardPage } from '@/hooks/useTeacherReportCardPage';
import { useReportCardFilters } from '@/hooks/useReportCardFilters';
import { ReportCardFilters } from '@/components/portal/ReportCardFilters';
import { ReportCardStatsBar } from '@/components/portal/ReportCardStatsBar';
import { EditScoreDialog } from '@/components/portal/EditScoreDialog';
import { ReportCardStudentTable } from '@/components/portal/ReportCardStudentTable';
import { ReportCardPreviewDialog } from '@/components/portal/ReportCardPreviewDialog';
import { ReportCardAnalyticsTab } from '@/components/portal/ReportCardAnalyticsTab';
import { BaileysExportContainer } from '@/components/report-card/BaileysExportContainer';

export default function TeacherReportCards() {
  const p = useTeacherReportCardPage();
  const { paginated, filtered, totalPages, statistics } = useReportCardFilters({
    reportCards: p.reportCards, searchTerm: p.searchTerm, statusFilter: p.statusFilter,
    sortField: p.sortField, sortDirection: p.sortDirection,
    currentPage: p.currentPage, setCurrentPage: p.setCurrentPage,
  });

  if (!p.user) return <div>Loading...</div>;

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
        classes={p.classes} terms={p.terms} selectedClass={p.selectedClass} onClassChange={p.setSelectedClass}
        selectedTerm={p.selectedTerm} onTermChange={p.setSelectedTerm} statusFilter={p.statusFilter}
        onStatusFilterChange={(v) => { p.setStatusFilter(v); p.setCurrentPage(1); }}
        showAdvancedFilters={p.showAdvancedFilters} onToggleAdvancedFilters={() => p.setShowAdvancedFilters(v => !v)}
        selectedGradingScale={p.selectedGradingScale} onGradingScaleChange={p.setSelectedGradingScale}
        availableGradingScales={p.gradingConfig?.availableScales ?? []} testWeight={p.testWeight} examWeight={p.examWeight}
      />

      {!p.selectedClass || !p.selectedTerm ? (
        <Card><CardContent className="text-center py-12"><FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">Select Class and Term</h3><p className="text-muted-foreground">Please select a class and academic term to view report cards.</p></CardContent></Card>
      ) : p.loadingReportCards ? (
        <Card><CardContent className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" /><p>Loading report cards...</p></CardContent></Card>
      ) : (
        <>
          {statistics && p.reportCards.length > 0 && <ReportCardStatsBar statistics={statistics} />}
          <Tabs value={p.activeTab} onValueChange={p.setActiveTab} className="space-y-4">
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
                      {p.isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-report-card-options">
                              {p.mutations.bulkRecalculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => p.mutations.bulkRecalculateMutation.mutate()} disabled={p.mutations.bulkRecalculateMutation.isPending || !p.selectedClass || !p.selectedTerm} data-testid="menu-bulk-recalculate">
                              <RefreshCw className="w-4 h-4 mr-2" />Recalculate All{p.selectedClass && p.selectedTerm ? ' (this class & term)' : ''}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => p.handleBulkStatus('finalized')} disabled={p.mutations.bulkStatusMutation.isPending}>
                              <FileCheck className="w-4 h-4 mr-2" />Finalize All Drafts
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => p.handleBulkStatus('published')} disabled={p.mutations.bulkStatusMutation.isPending}>
                              <Send className="w-4 h-4 mr-2" />Publish All Finalized
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {p.reportCards.length === 0 ? (
                    <div className="text-center py-8"><Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No Report Cards Yet</h3><p className="text-muted-foreground mb-2">Report cards will appear here automatically as students complete their exams.</p></div>
                  ) : (
                    <ReportCardStudentTable
                      paginatedCards={paginated} filteredCount={filtered.length} totalCount={p.reportCards.length} reportCardCount={p.reportCards.length}
                      searchTerm={p.searchTerm} onSearchChange={(v) => { p.setSearchTerm(v); p.setCurrentPage(1); }}
                      sort={{ field: p.sortField, direction: p.sortDirection }} onSort={p.handleSort}
                      currentPage={p.currentPage} totalPages={totalPages} onPageChange={p.setCurrentPage}
                      onView={(rc) => { p.setSelectedReportCard(rc); p.setIsViewDialogOpen(true); }}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="analytics" className="space-y-4">
              <ReportCardAnalyticsTab reportCards={p.reportCards} statistics={statistics} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <ReportCardPreviewDialog
        open={p.isViewDialogOpen} onOpenChange={p.setIsViewDialogOpen}
        fullReportCard={p.fullReportCard} loadingFullReport={p.loadingFullReport} fetchingFullReport={p.fetchingFullReport}
        isDownloading={p.isDownloading} autoPopulatePending={p.mutations.autoPopulateMutation.isPending}
        updateStatusPending={p.mutations.updateStatusMutation.isPending} updateRemarksPending={p.mutations.updateRemarksMutation.isPending}
        testWeight={p.testWeight} examWeight={p.examWeight}
        classes={p.classes} selectedClass={p.selectedClass} selectedTerm={p.selectedTerm}
        isAdmin={p.isAdmin} user={p.user}
        onPrint={() => p.handlePrint(p.baileysTemplateRef.current)}
        onExportPDF={p.handleExportPDF} onExportImage={p.handleExportImage}
        onRefresh={() => p.fullReportCard && p.mutations.autoPopulateMutation.mutate(p.fullReportCard.id)}
        onFinalize={() => p.fullReportCard && p.mutations.updateStatusMutation.mutate({ reportCardId: p.fullReportCard.id, status: 'finalized', classId: p.selectedClass, termId: p.selectedTerm })}
        onRevertDraft={() => p.fullReportCard && p.mutations.updateStatusMutation.mutate({ reportCardId: p.fullReportCard.id, status: 'draft', classId: p.selectedClass, termId: p.selectedTerm })}
        onEditSubject={(item) => { p.setSelectedItem(item); p.setIsOverrideDialogOpen(true); }}
        onSaveRemarks={p.handleSaveRemarks}
        onSaveSkills={async (skills) => { await p.mutations.saveSkillsMutation.mutateAsync({ reportCardId: p.fullReportCard.id, skills }); }}
        onGenerateComments={p.handleGenerateComments}
        reportCardRef={p.reportCardRef}
      />

      <EditScoreDialog
        open={p.isOverrideDialogOpen} onOpenChange={p.setIsOverrideDialogOpen}
        item={p.selectedItem} reportCardQueryKey={['/api/reports', p.selectedReportCard?.id, 'full']}
        gradingConfig={p.gradingConfig} showRemarks={true}
        onSaveSuccess={(serverData) => {
          if (serverData.reportCardTotals?.position !== undefined) {
            queryClient.setQueryData(['/api/reports/class-term', p.selectedClass, p.selectedTerm], (old: any) =>
              Array.isArray(old) ? old.map((rc: any) => rc.id === p.selectedReportCard?.id
                ? { ...rc, averagePercentage: serverData.reportCardTotals?.averagePercentage ?? rc.averagePercentage, overallGrade: serverData.reportCardTotals?.overallGrade ?? rc.overallGrade, position: serverData.reportCardTotals?.position ?? rc.position }
                : rc) : old);
          }
        }}
      />

      {p.fullReportCard && p.isViewDialogOpen && (
        <BaileysExportContainer ref={p.baileysTemplateRef} fullReportCard={p.fullReportCard} testWeight={p.testWeight} examWeight={p.examWeight} />
      )}
    </div>
  );
}
