/**
 * Page-level hook for TeacherReportCards.
 * Owns all state, queries, refs, and event handlers — no JSX.
 * Export/print logic is delegated to useReportCardExport.
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { STANDARD_GRADING_SCALE } from '@shared/grading-utils';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useReportCardMutations } from '@/hooks/useReportCardMutations';
import { useReportCardExport } from '@/hooks/useReportCardExport';

export type SortField = 'position' | 'studentName' | 'averagePercentage' | 'overallGrade' | 'status';
export type SortDir   = 'asc' | 'desc';

export function useTeacherReportCardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedClass,        setSelectedClass]        = useState('');
  const [selectedTerm,         setSelectedTerm]         = useState('');
  const [selectedReportCard,   setSelectedReportCard]   = useState<any>(null);
  const [selectedGradingScale, setSelectedGradingScale] = useState('standard');
  const [isViewDialogOpen,     setIsViewDialogOpen]     = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [selectedItem,         setSelectedItem]         = useState<any>(null);
  const [searchTerm,           setSearchTerm]           = useState('');
  const [statusFilter,         setStatusFilter]         = useState('all');
  const [activeTab,            setActiveTab]            = useState('students');
  const [showAdvancedFilters,  setShowAdvancedFilters]  = useState(false);
  const [sortField,            setSortField]            = useState<SortField>('position');
  const [sortDirection,        setSortDirection]        = useState<SortDir>('asc');
  const [currentPage,          setCurrentPage]          = useState(1);

  const reportCardRef      = useRef<HTMLDivElement>(null);
  const exportTemplateRef = useRef<HTMLDivElement>(null);
  const selectedRCRef      = useRef<any>(null);
  selectedRCRef.current    = selectedReportCard;

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

  const classes    = assignmentData?.classes || [];
  const isAdmin    = assignmentData?.isAdmin || false;
  const testWeight = gradingConfig?.dbSettings?.testWeight ?? STANDARD_GRADING_SCALE.testWeight;
  const examWeight = gradingConfig?.dbSettings?.examWeight ?? STANDARD_GRADING_SCALE.examWeight;

  useEffect(() => {
    if (gradingConfig?.currentConfig?.name && selectedGradingScale === 'standard')
      setSelectedGradingScale(gradingConfig.currentConfig.name);
  }, [gradingConfig?.currentConfig?.name]);

  useSocketIORealtime({
    table: 'report_cards', queryKey: ['/api/reports/class-term', selectedClass, selectedTerm],
    enabled: !!selectedClass && !!selectedTerm, classId: selectedClass, skipCacheInvalidation: true,
  });

  const mutations = useReportCardMutations({
    selectedClass, selectedTerm,
    getSelectedReportCard: () => selectedRCRef.current,
    setSelectedReportCard, refetchReportCards, refetchFullReport,
  });

  const exportHook = useReportCardExport(
    () => selectedRCRef.current,
    () => exportTemplateRef.current,
  );

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field as SortField); setSortDirection('asc'); }
  };

  const handleBulkStatus = (status: string) => {
    const fromStatus = status === 'finalized' ? 'draft' : 'finalized';
    const ids = reportCards.filter((rc: any) => rc.status === fromStatus).map((rc: any) => rc.id);
    if (!ids.length) {
      toast({ title: 'No Report Cards to Update', description: `No ${fromStatus} report cards found.`, variant: 'destructive' });
      return;
    }
    mutations.bulkStatusMutation.mutate({ reportCardIds: ids, status });
  };

  const handleSaveRemarks = (teacher: string, principal: string) => {
    if (!fullReportCard) return;
    const classInfo = classes.find((c: any) => c.id === Number(selectedClass));
    const payload: any = { reportCardId: fullReportCard.id };
    if (isAdmin || classInfo?.classTeacherId === user?.id) payload.teacherRemarks = teacher;
    if (user?.role?.toLowerCase() === 'admin') payload.principalRemarks = principal;
    mutations.updateRemarksMutation.mutate(payload);
  };

  const handleGenerateComments = async () => {
    const r = await apiRequest('GET', `/api/reports/${fullReportCard.id}/default-comments`);
    if (!r.ok) throw new Error('Failed to generate comments');
    return r.json();
  };

  return {
    user,
    selectedClass, setSelectedClass, selectedTerm, setSelectedTerm,
    selectedReportCard, setSelectedReportCard,
    selectedGradingScale, setSelectedGradingScale,
    isViewDialogOpen, setIsViewDialogOpen,
    isOverrideDialogOpen, setIsOverrideDialogOpen,
    selectedItem, setSelectedItem,
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    activeTab, setActiveTab, showAdvancedFilters, setShowAdvancedFilters,
    sortField, sortDirection, handleSort,
    currentPage, setCurrentPage,
    reportCardRef, exportTemplateRef,
    gradingConfig, terms, reportCards, loadingReportCards,
    fullReportCard, loadingFullReport, fetchingFullReport, refetchFullReport,
    classes, isAdmin, testWeight, examWeight,
    mutations,
    handleBulkStatus, handleSaveRemarks, handleGenerateComments,
    ...exportHook,
  };
}
