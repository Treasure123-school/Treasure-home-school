import { useState, useRef, useCallback, useEffect, useMemo, MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { toCanvas, toPng } from 'html-to-image';
import { BaileysReportTemplate } from '@/components/ui/baileys-report-template';
import { exportToPDF, exportToImage, printElement } from '@/lib/report-export-utils';

const STATUS_BADGE_TRANSITION = "transition-all duration-300 ease-in-out";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/shared/SearchInput';
import {
  FileText,
  CheckCircle,
  Clock,
  Send,
  Eye,
  XCircle,
  Loader2,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  GraduationCap,
  MoreVertical,
  Printer,
  Download,
  Undo2,
  Filter,
  ArrowUpDown,
  SearchX,
  Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import { calculateAge } from '@/lib/report-card-utils';
import { ProfessionalReportCard } from '@/components/ui/professional-report-card';
import { EditScoreDialog } from '@/components/portal/EditScoreDialog';
import { ReportCardMaintenanceDialog } from '@/components/portal/ReportCardMaintenanceDialog';
import { MiniStatCardGrid } from '@/components/ui/mini-stat-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FinalizedReportCard {
  id: number;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: number;
  className: string;
  termId: number;
  termName: string;
  sessionYear: string;
  averagePercentage: number | null;
  overallGrade: string | null;
  status: string;
  finalizedAt: string | null;
  publishedAt: string | null;
  generatedAt: string;
}

interface Statistics {
  draft: number;
  finalized: number;
  published: number;
}

export default function AdminResultPublishing() {
  const { toast } = useToast();
  const { data: settings } = useQuery<any>({
    queryKey: ['/api/public/settings'],
  });
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [selectedReportCards, setSelectedReportCards] = useState<number[]>([]);
  const [viewingReportCard, setViewingReportCard] = useState<FinalizedReportCard | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  // Score override state (admin editing)
  const [selectedOverrideItem, setSelectedOverrideItem] = useState<any>(null);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const reportCardRef = useRef<HTMLDivElement>(null);
  const baileysTemplateRef = useRef<HTMLDivElement>(null);

  // Bulk export state
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState(0);
  const [bulkExportTotal, setBulkExportTotal] = useState(0);
  const [bulkExportType, setBulkExportType] = useState<'pdf' | 'zip' | 'print'>('zip');
  const [bulkRenderData, setBulkRenderData] = useState<any>(null);
  const bulkTemplateRef = useRef<HTMLDivElement>(null);

  const handleDownloadAsImage = async () => {
    if (!baileysTemplateRef.current || !viewingReportCard) return;

    setIsDownloading(true);
    try {
      await exportToImage(baileysTemplateRef.current, {
        filename: `report-card-${viewingReportCard.studentName?.replace(/\s+/g, '-')}`,
        scale: 2,
      });

      toast({ title: "Success", description: "Report card downloaded as image" });
    } catch (error: any) {
      toast({ title: "Download Failed", description: error?.message || "Could not download the report card image. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAsPDF = async () => {
    if (!baileysTemplateRef.current || !viewingReportCard) return;

    setIsDownloading(true);
    try {
      await exportToPDF(baileysTemplateRef.current, {
        filename: `report-card-${viewingReportCard.studentName?.replace(/\s+/g, '-')}`,
        scale: 2,
      });

      toast({ title: "Success", description: "Report card PDF downloaded" });
    } catch (error: any) {
      toast({ title: "Download Failed", description: error?.message || "Could not download the PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintReport = () => {
    if (!baileysTemplateRef.current) {
      window.print();
      return;
    }
    printElement(baileysTemplateRef.current);
  };

  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/classes');
      return await response.json();
    },
  });

  const { currentTerm, allTerms: terms } = useAcademicCalendar();

  // Auto-select current term on load
  useEffect(() => {
    if (currentTerm && selectedTerm === 'all') {
      setSelectedTerm(String(currentTerm.id));
    }
  }, [currentTerm]);

  const { data: reportCardsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClass !== 'all') params.append('classId', selectedClass);
      if (selectedTerm !== 'all') params.append('termId', selectedTerm);
      params.append('status', statusFilter === 'all' ? 'all' : statusFilter);

      const response = await apiRequest('GET', `/api/admin/report-cards/finalized?${params}`);
      if (!response.ok) throw new Error('Failed to fetch report cards');
      return await response.json();
    },
  });

  const reportCards: FinalizedReportCard[] = reportCardsData?.reportCards || [];
  const statistics: Statistics = reportCardsData?.statistics || { draft: 0, finalized: 0, published: 0 };

  // Client-side search + sort — safe since this endpoint returns the full unpaginated list.
  const displayedReportCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? reportCards.filter((rc) =>
          rc.studentName?.toLowerCase().includes(q) ||
          rc.admissionNumber?.toLowerCase().includes(q)
        )
      : reportCards;

    const sorted = [...filtered];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
        break;
      case 'name-desc':
        sorted.sort((a, b) => (b.studentName || '').localeCompare(a.studentName || ''));
        break;
      case 'average-desc':
        sorted.sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));
        break;
      case 'average-asc':
        sorted.sort((a, b) => (a.averagePercentage ?? -1) - (b.averagePercentage ?? -1));
        break;
      case 'class-asc':
        sorted.sort((a, b) => (a.className || '').localeCompare(b.className || '') || (a.studentName || '').localeCompare(b.studentName || ''));
        break;
      case 'status-asc':
        sorted.sort((a, b) => (a.status || '').localeCompare(b.status || '') || (a.studentName || '').localeCompare(b.studentName || ''));
        break;
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.finalizedAt || b.generatedAt).getTime() - new Date(a.finalizedAt || a.generatedAt).getTime());
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.finalizedAt || a.generatedAt).getTime() - new Date(b.finalizedAt || b.generatedAt).getTime());
        break;
    }
    return sorted;
  }, [reportCards, searchQuery, sortBy]);

  const { data: fullReportCard, isLoading: loadingFullReport } = useQuery({
    queryKey: ['/api/reports', viewingReportCard?.id, 'full'],
    queryFn: async () => {
      if (!viewingReportCard?.id) return null;
      const response = await apiRequest('GET', `/api/reports/${viewingReportCard.id}/full`);
      if (!response.ok) return null;
      return await response.json();
    },
    enabled: !!viewingReportCard?.id && isViewDialogOpen,
  });

  // Track mutation in progress to prevent double-clicks without showing spinners
  // Using refs to track in-progress IDs to avoid race conditions with setState
  const publishingIdsRef = useRef<Set<number>>(new Set());
  const unpublishingIdsRef = useRef<Set<number>>(new Set());
  const rejectingIdsRef = useRef<Set<number>>(new Set());
  const finalizingIdsRef = useRef<Set<number>>(new Set());
  const [, forceUpdate] = useState(0);

  // Helper to update the ref and trigger re-render
  const addToSet = (ref: MutableRefObject<Set<number>>, id: number) => {
    ref.current = new Set(ref.current).add(id);
    forceUpdate(n => n + 1);
  };
  const removeFromSet = (ref: MutableRefObject<Set<number>>, id: number) => {
    const next = new Set(ref.current);
    next.delete(id);
    ref.current = next;
    forceUpdate(n => n + 1);
  };

  // Real-time updates for report card status changes (publish/unpublish/reject)
  // skipCacheInvalidation: true prevents the socket from calling refetchQueries after any
  // report_cards table event. Without this, the server-emitted socket event (triggered by
  // our own mutation) races against onSuccess: the hard refetch may fetch stale data and
  // overwrite the optimistic cache, causing the item to momentarily reappear.
  // Cache reconciliation is handled explicitly in each mutation's onSuccess instead.
  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, statusFilter],
    enabled: true,
    fallbackPollingInterval: 30000,
    skipCacheInvalidation: true,
  });

  // Real-time updates for score/remarks changes on the open report card preview.
  // skipCacheInvalidation prevents the socket from triggering a raw refetch that
  // would race against—and potentially overwrite—the optimistic cache update
  // applied by EditScoreDialog. Reconciliation is handled in EditScoreDialog.onSuccess.
  useSocketIORealtime({
    table: 'report_card_items',
    queryKey: ['/api/reports', viewingReportCard?.id, 'full'],
    enabled: !!viewingReportCard?.id && isViewDialogOpen,
    skipCacheInvalidation: true,
  });

  // Helper to get base stats from any available filter cache
  const getBaseStats = (previousDataMap: Record<string, any>) => {
    // Try each filter in order of preference
    const filters = ['all', 'finalized', 'published'];
    for (const filter of filters) {
      if (previousDataMap[filter]?.statistics) {
        return previousDataMap[filter].statistics;
      }
    }
    // Fallback - compute from current reportCardsData if available
    if (reportCardsData?.statistics) {
      return reportCardsData.statistics;
    }
    return { finalized: 0, published: 0, draft: 0 };
  };

  const publishMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const response = await apiRequest('PATCH', `/api/reports/${reportCardId}/status`, { status: 'published' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to publish');
      }
      return response.json();
    },
    onMutate: async (reportCardId: number) => {
      // Check if already in progress to prevent double-clicks - throw to stop mutationFn
      if (publishingIdsRef.current.has(reportCardId)) {
        throw new Error('DUPLICATE_BLOCKED');
      }
      // Mark as in-progress
      addToSet(publishingIdsRef, reportCardId);

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Get the report card being published for cross-filter updates
      const reportCardToPublish = reportCards.find(rc => rc.id === reportCardId);

      // Calculate new statistics ONCE using helper to get from any available cache
      const baseStats = getBaseStats(previousDataMap);
      const newStats = {
        ...baseStats,
        finalized: Math.max(0, baseStats.finalized - 1),
        published: baseStats.published + 1
      };

      // Optimistically update ALL filter views for instant UI feedback across filter switches
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;

            if (filter === 'finalized') {
              return {
                ...old,
                reportCards: old.reportCards.filter((rc: FinalizedReportCard) => rc.id !== reportCardId),
                statistics: newStats
              };
            } else if (filter === 'published') {
              const alreadyExists = old.reportCards.some((rc: FinalizedReportCard) => rc.id === reportCardId);
              if (alreadyExists) {
                return {
                  ...old,
                  reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                    rc.id === reportCardId ? { ...rc, status: 'published', publishedAt: new Date().toISOString() } : rc
                  ),
                  statistics: newStats
                };
              }
              if (reportCardToPublish) {
                return {
                  ...old,
                  reportCards: [...old.reportCards, { ...reportCardToPublish, status: 'published', publishedAt: new Date().toISOString() }],
                  statistics: newStats
                };
              }
              return old;
            } else {
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === reportCardId ? { ...rc, status: 'published', publishedAt: new Date().toISOString() } : rc
                ),
                statistics: newStats
              };
            }
          }
        );
      });

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: "Approved & Published", description: "Report card published and visible to students." });

      return { previousDataMap, reportCardId };
    },
    onSuccess: (data, reportCardId) => {
      removeFromSet(publishingIdsRef, reportCardId);
      // Silent cache reconciliation — merge authoritative server data (e.g. publishedAt timestamp)
      // without triggering a refetch or badge flicker
      const reportCard = data?.reportCard;
      if (reportCard && typeof reportCard === 'object') {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          queryClient.setQueryData(
            ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === reportCardId ? { ...rc, ...reportCard } : rc
                ),
              };
            }
          );
        });
      }
    },
    onError: (error: Error, reportCardId, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(publishingIdsRef, reportCardId);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (reportCardIds: number[]) => {
      const response = await apiRequest('POST', '/api/admin/report-cards/bulk-publish', { reportCardIds });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to bulk publish');
      }
      return response.json();
    },
    onMutate: async (reportCardIds: number[]) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Get the report cards being published for cross-filter updates
      const reportCardsToPublish = reportCards.filter(rc => reportCardIds.includes(rc.id));

      // Calculate new statistics ONCE using helper
      const baseStats = getBaseStats(previousDataMap);
      const publishedCount = reportCardIds.length;
      const newStats = {
        ...baseStats,
        finalized: Math.max(0, baseStats.finalized - publishedCount),
        published: baseStats.published + publishedCount
      };

      // Optimistically update ALL filter views
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;

            if (filter === 'finalized') {
              return {
                ...old,
                reportCards: old.reportCards.filter((rc: FinalizedReportCard) => !reportCardIds.includes(rc.id)),
                statistics: newStats
              };
            } else if (filter === 'published') {
              const existingIds = new Set(old.reportCards.map((rc: FinalizedReportCard) => rc.id));
              const newCards = reportCardsToPublish
                .filter(rc => !existingIds.has(rc.id))
                .map(rc => ({ ...rc, status: 'published', publishedAt: new Date().toISOString() }));
              return {
                ...old,
                reportCards: [
                  ...old.reportCards.map((rc: FinalizedReportCard) =>
                    reportCardIds.includes(rc.id) ? { ...rc, status: 'published', publishedAt: new Date().toISOString() } : rc
                  ),
                  ...newCards
                ],
                statistics: newStats
              };
            } else {
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  reportCardIds.includes(rc.id) ? { ...rc, status: 'published', publishedAt: new Date().toISOString() } : rc
                ),
                statistics: newStats
              };
            }
          }
        );
      });

      // Clear selection immediately for instant feedback
      setSelectedReportCards([]);

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: "Published", description: `${reportCardIds.length} report card${reportCardIds.length !== 1 ? 's' : ''} approved & published.` });

      return { previousDataMap };
    },
    onSuccess: () => {
      // Toast already fired in onMutate — no additional action needed
    },
    onError: (error: Error, _reportCardIds, context) => {
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const response = await apiRequest('PATCH', `/api/reports/${reportCardId}/status`, { status: 'finalized' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unpublish');
      }
      return response.json();
    },
    onMutate: async (reportCardId: number) => {
      // Check if already in progress to prevent double-clicks - throw to stop mutationFn
      if (unpublishingIdsRef.current.has(reportCardId)) {
        throw new Error('DUPLICATE_BLOCKED');
      }
      // Mark as in-progress
      addToSet(unpublishingIdsRef, reportCardId);

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Get the report card being unpublished for cross-filter updates
      const reportCardToUnpublish = reportCards.find(rc => rc.id === reportCardId);

      // Calculate new statistics ONCE using helper to get from any available cache
      const baseStats = getBaseStats(previousDataMap);
      const newStats = {
        ...baseStats,
        published: Math.max(0, baseStats.published - 1),
        finalized: baseStats.finalized + 1
      };

      // Optimistically update ALL filter views for instant UI feedback across filter switches
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;

            if (filter === 'published') {
              return {
                ...old,
                reportCards: old.reportCards.filter((rc: FinalizedReportCard) => rc.id !== reportCardId),
                statistics: newStats
              };
            } else if (filter === 'finalized') {
              const alreadyExists = old.reportCards.some((rc: FinalizedReportCard) => rc.id === reportCardId);
              if (alreadyExists) {
                return {
                  ...old,
                  reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                    rc.id === reportCardId ? { ...rc, status: 'finalized', publishedAt: null } : rc
                  ),
                  statistics: newStats
                };
              }
              if (reportCardToUnpublish) {
                return {
                  ...old,
                  reportCards: [...old.reportCards, { ...reportCardToUnpublish, status: 'finalized', publishedAt: null }],
                  statistics: newStats
                };
              }
              return old;
            } else {
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === reportCardId ? { ...rc, status: 'finalized', publishedAt: null } : rc
                ),
                statistics: newStats
              };
            }
          }
        );
      });

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: "Unpublished", description: "Report card unpublished. Students can no longer view it." });

      return { previousDataMap, reportCardId };
    },
    onSuccess: (data, reportCardId) => {
      removeFromSet(unpublishingIdsRef, reportCardId);
      // Silent cache reconciliation — merge authoritative server data (timestamps, etc.)
      // without triggering a refetch that would cause badge flickering
      const reportCard = data?.reportCard;
      if (reportCard && typeof reportCard === 'object') {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          queryClient.setQueryData(
            ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === reportCardId ? { ...rc, ...reportCard } : rc
                ),
              };
            }
          );
        });
      }
    },
    onError: (error: Error, reportCardId, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(unpublishingIdsRef, reportCardId);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkUnpublishMutation = useMutation({
    mutationFn: async (reportCardIds: number[]) => {
      const results = await Promise.all(
        reportCardIds.map(async (id) => {
          const response = await apiRequest('PATCH', `/api/reports/${id}/status`, { status: 'finalized' });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to unpublish report card ${id}`);
          }
          return response.json();
        })
      );
      return results;
    },
    onMutate: async (reportCardIds: number[]) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Get the report cards being unpublished for cross-filter updates
      const reportCardsToUnpublish = reportCards.filter(rc => reportCardIds.includes(rc.id));

      // Calculate new statistics ONCE using helper
      const baseStats = getBaseStats(previousDataMap);
      const unpublishedCount = reportCardIds.length;
      const newStats = {
        ...baseStats,
        published: Math.max(0, baseStats.published - unpublishedCount),
        finalized: baseStats.finalized + unpublishedCount
      };

      // Optimistically update ALL filter views
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;

            if (filter === 'published') {
              return {
                ...old,
                reportCards: old.reportCards.filter((rc: FinalizedReportCard) => !reportCardIds.includes(rc.id)),
                statistics: newStats
              };
            } else if (filter === 'finalized') {
              const existingIds = new Set(old.reportCards.map((rc: FinalizedReportCard) => rc.id));
              const newCards = reportCardsToUnpublish
                .filter(rc => !existingIds.has(rc.id))
                .map(rc => ({ ...rc, status: 'finalized', publishedAt: null }));
              return {
                ...old,
                reportCards: [
                  ...old.reportCards.map((rc: FinalizedReportCard) =>
                    reportCardIds.includes(rc.id) ? { ...rc, status: 'finalized', publishedAt: null } : rc
                  ),
                  ...newCards
                ],
                statistics: newStats
              };
            } else {
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  reportCardIds.includes(rc.id) ? { ...rc, status: 'finalized', publishedAt: null } : rc
                ),
                statistics: newStats
              };
            }
          }
        );
      });

      // Clear selection immediately for instant feedback
      setSelectedReportCards([]);

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: "Unpublished", description: `${reportCardIds.length} report card${reportCardIds.length !== 1 ? 's' : ''} unpublished successfully.` });

      return { previousDataMap };
    },
    onSuccess: () => {
      // Toast already fired in onMutate — no additional action needed
    },
    onError: (error: Error, _reportCardIds, context) => {
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/admin/report-cards/${id}/reject`, { reason });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject');
      }
      return response.json();
    },
    onMutate: async ({ id }: { id: number; reason: string }) => {
      // Check if already in progress to prevent double-clicks - throw to stop mutationFn
      if (rejectingIdsRef.current.has(id)) {
        throw new Error('DUPLICATE_BLOCKED');
      }
      // Mark as in-progress
      addToSet(rejectingIdsRef, id);

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Calculate new statistics ONCE using helper to get from any available cache
      const baseStats = getBaseStats(previousDataMap);
      const newStats = {
        ...baseStats,
        finalized: Math.max(0, baseStats.finalized - 1),
        draft: baseStats.draft + 1
      };

      // Find the card data from any available snapshot so we can re-insert it into draft
      const rejectedCard: FinalizedReportCard | undefined =
        previousDataMap['finalized']?.reportCards?.find((rc: FinalizedReportCard) => rc.id === id) ||
        previousDataMap['all']?.reportCards?.find((rc: FinalizedReportCard) => rc.id === id) ||
        previousDataMap['published']?.reportCards?.find((rc: FinalizedReportCard) => rc.id === id);

      const rejectedAsDraft = rejectedCard
        ? { ...rejectedCard, status: 'draft' as const, finalizedAt: null, publishedAt: null }
        : null;

      // Optimistically update each filter view correctly:
      //   finalized / published — remove the card (it left these states)
      //   draft                 — insert it at the top (it is now draft)
      //   all                   — update its status in-place (keep it visible)
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;

            if (filter === 'finalized' || filter === 'published') {
              // Remove — no longer belongs to either of these states
              return {
                ...old,
                reportCards: old.reportCards.filter((rc: FinalizedReportCard) => rc.id !== id),
                statistics: newStats,
              };
            }

            if (filter === 'draft') {
              // Insert at top — card is now draft; avoid duplicates
              const alreadyPresent = old.reportCards.some((rc: FinalizedReportCard) => rc.id === id);
              return {
                ...old,
                reportCards: alreadyPresent
                  ? old.reportCards.map((rc: FinalizedReportCard) =>
                      rc.id === id ? { ...rc, status: 'draft', finalizedAt: null, publishedAt: null } : rc
                    )
                  : rejectedAsDraft
                    ? [rejectedAsDraft, ...old.reportCards]
                    : old.reportCards,
                statistics: newStats,
              };
            }

            // 'all' — update status in-place so the card stays visible with the new badge
            return {
              ...old,
              reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                rc.id === id
                  ? { ...rc, status: 'draft', finalizedAt: null, publishedAt: null }
                  : rc
              ),
              statistics: newStats,
            };
          }
        );
      });

      // Close dialog immediately for instant feedback
      setIsRejectDialogOpen(false);
      setRejectingId(null);
      setRejectReason('');

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: "Rejected", description: "Report card reverted to draft for teacher revision." });

      return { previousDataMap, id };
    },
    onSuccess: (data, { id }) => {
      removeFromSet(rejectingIdsRef, id);
      // Silent reconciliation — merge authoritative server data into draft and all views
      const reportCard = data?.reportCard;
      if (reportCard && typeof reportCard === 'object') {
        const reconcileFilters = ['draft', 'all'];
        reconcileFilters.forEach(filter => {
          queryClient.setQueryData(
            ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === id ? { ...rc, ...reportCard } : rc
                ),
              };
            }
          );
        });
      }
    },
    onError: (error: Error, { id }, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(rejectingIdsRef, id);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Finalize mutation — Admin moves a draft report card directly to finalized
  const finalizeMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const response = await apiRequest('PATCH', `/api/reports/${reportCardId}/status`, { status: 'finalized' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to finalize');
      }
      return response.json();
    },
    onMutate: async (reportCardId: number) => {
      // Prevent duplicate clicks — silently block without re-toasting
      if (finalizingIdsRef.current.has(reportCardId)) {
        throw new Error('DUPLICATE_BLOCKED');
      }
      addToSet(finalizingIdsRef, reportCardId);

      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/admin/report-cards/finalized'] });

      // Snapshot ALL filter views for complete rollback
      const filterViews = ['draft', 'finalized', 'published', 'all'];
      const previousDataMap: Record<string, any> = {};
      filterViews.forEach(filter => {
        previousDataMap[filter] = queryClient.getQueryData(['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter]);
      });

      // Optimistically update: move card from draft to finalized in all cached views
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                rc.id === reportCardId ? { ...rc, status: 'finalized', finalizedAt: new Date().toISOString() } : rc
              ),
              statistics: {
                ...old.statistics,
                draft: Math.max(0, (old.statistics?.draft || 0) - 1),
                finalized: (old.statistics?.finalized || 0) + 1,
              },
            };
          }
        );
      });

      // Immediate toast — fires before server responds for instant feedback
      toast({ title: 'Finalized', description: 'Report card finalized. Ready for publishing.' });

      return { previousDataMap, reportCardId };
    },
    onSuccess: (data, reportCardId) => {
      removeFromSet(finalizingIdsRef, reportCardId);
      // Silent cache reconciliation — merge authoritative server data (e.g. finalizedAt timestamp)
      // without triggering a refetch that would cause badge flickering
      const reportCard = data?.reportCard;
      if (reportCard && typeof reportCard === 'object') {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          queryClient.setQueryData(
            ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                reportCards: old.reportCards.map((rc: FinalizedReportCard) =>
                  rc.id === reportCardId ? { ...rc, ...reportCard } : rc
                ),
              };
            }
          );
        });
      }
    },
    onError: (error: Error, reportCardId, context) => {
      // Silently ignore duplicate blocked errors — no toast, no cleanup
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(finalizingIdsRef, reportCardId);
      // Rollback ALL filter views to previous state
      if (context?.previousDataMap) {
        const filterViews = ['draft', 'finalized', 'published', 'all'];
        filterViews.forEach(filter => {
          if (context.previousDataMap[filter]) {
            queryClient.setQueryData(
              ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
              context.previousDataMap[filter]
            );
          }
        });
      }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: invalidate all report-card cache keys for a fresh refetch
  const realtimeService_invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
  };

  // Backfill default comments mutation
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [backfillOverwrite, setBackfillOverwrite] = useState(false);

  const backfillCommentsMutation = useMutation({
    mutationFn: async ({ termId, classId, overwrite }: { termId?: number; classId?: number; overwrite: boolean }) => {
      const response = await apiRequest('POST', '/api/reports/backfill-comments', { termId, classId, overwrite });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to backfill comments');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Comments Generated",
        description: `Updated ${data.updated} report cards with default comments. ${data.skipped} already had comments.`,
      });
      setIsBackfillDialogOpen(false);
      // Refresh the report cards list
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // ─── Recalculate Mutation ─────────────────────────────────────────────────

  const handleRecalculate = async () => {
    if (!viewingReportCard?.id || isRecalculating) return;
    setIsRecalculating(true);
    try {
      const response = await apiRequest('POST', `/api/reports/${viewingReportCard.id}/recalculate`);
      if (!response.ok) {
        const err = await response.json();
        toast({ title: 'Recalculate Failed', description: err.message || 'Could not recalculate scores.', variant: 'destructive' });
        return;
      }
      // Invalidate the full report cache so the dialog re-fetches fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/reports', viewingReportCard.id, 'full'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({ title: 'Recalculated', description: 'Scores, grades and positions have been recalculated.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Recalculate failed.', variant: 'destructive' });
    } finally {
      setIsRecalculating(false);
    }
  };

  // ─── Admin Editing Mutations ───────────────────────────────────────────────

  // Admin: update report card remarks (teacher + principal)
  const updateRemarksMutation = useMutation({
    mutationFn: async ({ reportCardId, teacherRemarks, principalRemarks }: { reportCardId: number; teacherRemarks?: string; principalRemarks?: string }) => {
      const response = await apiRequest('PATCH', `/api/reports/${reportCardId}/remarks`, { teacherRemarks, principalRemarks });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save remarks');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports', viewingReportCard?.id, 'full'] });
      toast({ title: 'Saved', description: 'Remarks updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Admin: save psychomotor/affective skills
  const saveSkillsMutation = useMutation({
    mutationFn: async ({ reportCardId, skills }: { reportCardId: number; skills: any }) => {
      const response = await apiRequest('POST', `/api/reports/${reportCardId}/skills`, skills);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save skills');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports', viewingReportCard?.id, 'full'] });
      toast({ title: 'Saved', description: 'Skills updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });


  // Admin: generate missing report cards for students with assessment data
  const generateMissingMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (selectedClass !== 'all') params.append('classId', selectedClass);
      if (selectedTerm !== 'all') params.append('termId', selectedTerm);
      const response = await apiRequest('POST', `/api/admin/report-cards/generate-missing?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate report cards');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/report-cards/finalized'] });
      toast({ title: 'Done', description: data.message || `${data.created} report cards generated` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ─── Bulk Export helpers ───────────────────────────────────────────────────

  const mapToReportCardProps = (d: any) => ({
    studentName: d.studentName,
    admissionNumber: d.admissionNumber || d.studentUsername || 'N/A',
    className: d.className,
    classArm: d.classArm,
    department: d.department,
    isSSS: d.isSSS,
    termName: d.termName,
    academicSession: d.academicSession || d.sessionYear || '2024/2025',
    averagePercentage: d.averagePercentage || 0,
    overallGrade: d.overallGrade || '-',
    position: d.position || 0,
    totalStudentsInClass: d.totalStudentsInClass || 0,
    items: (d.items || []).map((item: any) => ({
      subjectName: item.subjectName,
      testScore: item.testScore ?? item.testWeightedScore ?? null,
      examScore: item.examScore ?? item.examWeightedScore ?? null,
      obtainedMarks: item.obtainedMarks ?? item.totalScore ?? 0,
      grade: item.grade || '-',
      remarks: item.remarks || item.teacherRemarks || '',
      subjectPosition: item.subjectPosition || null,
    })),
    teacherRemarks: d.teacherRemarks,
    principalRemarks: d.principalRemarks,
    attendance: {
      timesSchoolOpened: d.attendance?.timesSchoolOpened || 0,
      timesPresent: d.attendance?.timesPresent || 0,
      timesAbsent: d.attendance?.timesAbsent || 0,
    },
    studentPhoto: d.studentPhoto,
    teacherSignatureUrl: d.teacherSignatureUrl || null,
    principalSignatureUrl: d.principalSignatureUrl || null,
    teacherName: d.teacherName || '',
    principalName: d.principalName || '',
    gender: d.gender || '',
    dateOfBirth: d.dateOfBirth ? format(new Date(d.dateOfBirth), 'dd-MMM-yyyy') : '',
    age: calculateAge(d.dateOfBirth),
    dateIssued: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    affectiveTraits: d.affectiveTraits,
    psychomotorSkills: d.psychomotorSkills,
  });

  const openBulkPrintWindow = (htmlParts: string[], filename: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast({ title: 'Popup Blocked', description: 'Please allow popups to print all report cards.', variant: 'destructive' });
      return;
    }
    const inlineStyles = Array.from(document.styleSheets)
      .map(ss => { try { return Array.from(ss.cssRules).map(r => r.cssText).join('\n'); } catch { return ''; } })
      .join('\n');
    const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.outerHTML).join('\n');
    const pagesHtml = htmlParts.map((html, i) =>
      `<div style="page-break-after:${i < htmlParts.length - 1 ? 'always' : 'avoid'};break-after:${i < htmlParts.length - 1 ? 'page' : 'avoid'}">${html}</div>`
    ).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>${filename}</title>
      ${fontLinks}
      <style>
        @page{size:A4 portrait;margin:0}
        @media print{html,body{margin:0;padding:0;background:white}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
        ${inlineStyles}
      </style></head><body>${pagesHtml}</body></html>`);
    printWindow.document.close();
    const imgs = printWindow.document.querySelectorAll('img');
    Promise.all(Array.from(imgs).map(img =>
      new Promise<void>(r => { if (img.complete) r(); else { img.onload = () => r(); img.onerror = () => r(); } })
    )).then(() => setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500));
  };

  /**
   * Wait for all <img> elements inside a node to be fully loaded.
   *
   * Strategy:
   *  1. Always pause at least `minMs` ms so React's useEffect base64
   *     conversions (studentPhoto + logo in BaileysReportTemplate) have time
   *     to fetch, convert, and re-render.
   *  2. After minMs, check which images are still loading (complete=false).
   *     Images with src="" or data: URLs are already complete — skip them.
   *  3. For any still-loading images, listen for load/error events.
   *  4. Hard ceiling `maxMs` prevents hanging if an image never responds.
   */
  const waitForImages = (node: HTMLElement, minMs = 1800, maxMs = 7000): Promise<void> => {
    return new Promise(resolve => {
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };

      // Hard ceiling — never block longer than maxMs total
      const ceiling = setTimeout(done, maxMs);

      setTimeout(() => {
        // Only consider network-loading images (src is a real URL, not complete yet)
        const imgs = Array.from(node.querySelectorAll<HTMLImageElement>('img'))
          .filter(img => img.src && !img.src.startsWith('data:') && img.src !== window.location.href);

        const stillLoading = imgs.filter(img => !img.complete);

        if (stillLoading.length === 0) {
          // All network images are already complete (or there are none)
          clearTimeout(ceiling);
          done();
        } else {
          let pending = stillLoading.length;
          const cb = () => {
            pending--;
            if (pending <= 0) { clearTimeout(ceiling); done(); }
          };
          stillLoading.forEach(img => {
            img.addEventListener('load', cb, { once: true });
            img.addEventListener('error', cb, { once: true }); // error still counts as "done"
          });
        }
      }, minMs);
    });
  };

  /**
   * Capture the currently-rendered off-screen template as a PNG data URL.
   * Waits for ALL images (photo + logo) to be fully loaded before capturing.
   */
  const captureOffscreenTemplate = async (): Promise<string | null> => {
    if (!bulkTemplateRef.current) return null;
    // Wait for React's useEffect image-to-base64 conversions + img load events
    await waitForImages(bulkTemplateRef.current, 1500, 6000);
    try {
      return await toPng(bulkTemplateRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (node: HTMLElement) => node.tagName !== 'SCRIPT',
      });
    } catch (e) {
      console.error('Capture failed:', e);
      return null;
    }
  };

  /**
   * Main bulk export driver.
   * Uses flushSync to force each card into the DOM synchronously before capture.
   * This is the only reliable way to sequence React renders with async capture.
   */
  const handleBulkExport = async (ids: number[], type: 'pdf' | 'zip' | 'print') => {
    if (ids.length === 0 || isBulkExporting) return;

    const classLabel = selectedClass !== 'all'
      ? (classes as any[]).find((c: any) => c.id.toString() === selectedClass)?.name || 'Class'
      : 'All-Classes';
    const termLabel = selectedTerm !== 'all'
      ? (terms as any[]).find((t: any) => t.id.toString() === selectedTerm)?.name || 'Term'
      : 'All-Terms';
    const baseFilename = `Report-Cards-${classLabel}-${termLabel}`.replace(/\s+/g, '-');

    setBulkExportType(type);
    setIsBulkExporting(true);
    setBulkExportProgress(0);
    setBulkExportTotal(ids.length);

    const pdf = type === 'pdf' ? new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) : null;
    const zip = type === 'zip' ? new JSZip() : null;
    const htmlParts: string[] = [];
    let pdfIsFirst = true;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];

      try {
        // 1. Fetch the full report card data
        const response = await apiRequest('GET', `/api/reports/${id}/full`);
        if (!response.ok) { errorCount++; setBulkExportProgress(i + 1); continue; }
        const data = await response.json();

        // 2. Force a synchronous React render of the off-screen template
        flushSync(() => setBulkRenderData(data));

        // 3. Capture the rendered DOM element
        if (type === 'print') {
          // For print: wait for images then grab outerHTML (images will be base64 by then)
          if (bulkTemplateRef.current) {
            await waitForImages(bulkTemplateRef.current, 1800, 7000);
            htmlParts.push(bulkTemplateRef.current.outerHTML);
            successCount++;
          } else {
            errorCount++;
          }
        } else {
          // For PDF / ZIP: capture as high-res PNG
          const dataUrl = await captureOffscreenTemplate();
          if (!dataUrl) { errorCount++; setBulkExportProgress(i + 1); continue; }

          if (type === 'zip' && zip) {
            const studentName = (data.studentName || `student-${id}`).replace(/\s+/g, '-');
            const termName = (data.termName || 'term').replace(/\s+/g, '-');
            const fname = `${studentName}_${termName}.png`;
            zip.file(fname, dataUrl.split(',')[1], { base64: true });
            successCount++;
          } else if (type === 'pdf' && pdf) {
            const img = new Image();
            img.src = dataUrl;
            await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
            const imgWidthMm = 210;
            const imgHeightMm = (img.height * imgWidthMm) / img.width;
            if (!pdfIsFirst) pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidthMm, imgHeightMm);
            pdfIsFirst = false;
            successCount++;
          }
        }
      } catch (e) {
        console.error(`Error processing report card ${id}:`, e);
        errorCount++;
      }

      setBulkExportProgress(i + 1);
    }

    // 4. Finalise output
    flushSync(() => setBulkRenderData(null));

    const errSuffix = errorCount > 0 ? ` (${errorCount} failed)` : '';

    if (type === 'zip' && zip && successCount > 0) {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: 'Success', description: `${successCount} report card image(s) downloaded in ZIP${errSuffix}.` });
    } else if (type === 'pdf' && pdf && successCount > 0) {
      pdf.save(`${baseFilename}.pdf`);
      toast({ title: 'Success', description: `${successCount} report card(s) saved as PDF${errSuffix}.` });
    } else if (type === 'print' && htmlParts.length > 0) {
      openBulkPrintWindow(htmlParts, baseFilename);
      toast({ title: 'Success', description: `${htmlParts.length} report card(s) sent to print${errSuffix}.` });
    } else {
      toast({ title: 'Nothing to export', description: 'No report cards could be processed.', variant: 'destructive' });
    }

    setIsBulkExporting(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select from the currently visible (searched/sorted) list only — not rows hidden by search
      if (statusFilter === 'published') {
        const publishedIds = displayedReportCards.filter(rc => rc.status === 'published').map(rc => rc.id);
        setSelectedReportCards(publishedIds);
      } else {
        const finalizedIds = displayedReportCards.filter(rc => rc.status === 'finalized').map(rc => rc.id);
        setSelectedReportCards(finalizedIds);
      }
    } else {
      setSelectedReportCards([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedReportCards(prev => [...prev, id]);
    } else {
      setSelectedReportCards(prev => prev.filter(rcId => rcId !== id));
    }
  };

  const handleViewReportCard = (rc: FinalizedReportCard) => {
    setViewingReportCard(rc);
    setIsViewDialogOpen(true);
  };

  const handleReject = (id: number) => {
    setRejectingId(id);
    setIsRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (rejectingId) {
      rejectMutation.mutate({ id: rejectingId, reason: rejectReason });
    }
  };

  const getStatusBadge = useCallback((status: string, reportCardId?: number) => {
    const isPending = reportCardId && (
      publishingIdsRef.current.has(reportCardId) ||
      unpublishingIdsRef.current.has(reportCardId) ||
      rejectingIdsRef.current.has(reportCardId)
    );

    const baseClasses = `text-xs ${STATUS_BADGE_TRANSITION}`;
    const pendingOpacity = isPending ? 'opacity-70' : '';

    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className={`${baseClasses} ${pendingOpacity}`}><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
      case 'finalized':
        return <Badge className={`bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 ${baseClasses} ${pendingOpacity}`}><FileCheck className="w-3 h-3 mr-1" /> Awaiting Approval</Badge>;
      case 'published':
        return <Badge className={`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ${baseClasses} ${pendingOpacity}`}><CheckCircle className="w-3 h-3 mr-1" /> Published</Badge>;
      default:
        return <Badge variant="secondary" className={`${baseClasses} ${pendingOpacity}`}>{status}</Badge>;
    }
  }, []);

  const finalizedCount = displayedReportCards.filter(rc => rc.status === 'finalized').length;
  const publishedCount = displayedReportCards.filter(rc => rc.status === 'published').length;
  const allFinalizedSelected = finalizedCount > 0 && selectedReportCards.length === finalizedCount;
  const allPublishedSelected = publishedCount > 0 && selectedReportCards.length === publishedCount;
  const isPublishedView = statusFilter === 'published';

  const pendingCount = publishingIdsRef.current.size + unpublishingIdsRef.current.size + rejectingIdsRef.current.size;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6" data-testid="page-admin-result-publishing">
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="aria-live-status">
        {pendingCount > 0 ? `Processing ${pendingCount} report card${pendingCount > 1 ? 's' : ''}...` : ''}
      </div>
      <div className="flex flex-col gap-4 -mt-3 sm:-mt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 leading-none" data-testid="text-page-title">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Report Card
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            View and manage all student report cards — always accessible, regardless of teacher submission status
          </p>
        </div>

        <MiniStatCardGrid
          items={[
            { label: 'Awaiting Approval', value: statistics.finalized, icon: FileCheck, color: 'amber', testId: 'stat-finalized' },
            { label: 'Published', value: statistics.published, icon: CheckCircle, color: 'green', testId: 'stat-published' },
            { label: 'In Draft', value: statistics.draft, icon: Clock, color: 'gray', testId: 'stat-draft' },
          ]}
        />
      </div>

      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Report Cards</CardTitle>
                <CardDescription className="text-xs sm:text-sm truncate">
                  {statusFilter === 'finalized' ? 'Awaiting your approval' :
                    statusFilter === 'published' ? 'Published report cards' : 'All report cards'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Generate Missing, Generate Comments and Download/Print grouped under one "more actions" menu on both mobile and desktop */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="More report card actions"
                      data-testid="button-more-actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => generateMissingMutation.mutate()}
                      disabled={generateMissingMutation.isPending}
                      data-testid="menu-generate-missing"
                    >
                      {generateMissingMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                      Generate Missing
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsBackfillDialogOpen(true)}
                      data-testid="menu-generate-comments"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Comments
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsMaintenanceOpen(true)}
                      data-testid="menu-maintenance"
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Repair / Maintenance
                    </DropdownMenuItem>
                    {displayedReportCards.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleBulkExport(displayedReportCards.map(rc => rc.id), 'zip')}
                          disabled={isBulkExporting}
                          data-testid="menu-download-all-zip"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download All as ZIP ({displayedReportCards.length} images)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleBulkExport(displayedReportCards.map(rc => rc.id), 'pdf')}
                          disabled={isBulkExporting}
                          data-testid="menu-download-all-pdf"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Download All as PDF ({displayedReportCards.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleBulkExport(displayedReportCards.map(rc => rc.id), 'print')}
                          disabled={isBulkExporting}
                          data-testid="menu-print-all"
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Print All ({displayedReportCards.length})
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => refetch()}
                      disabled={isFetching}
                      aria-label="Refresh report cards"
                      data-testid="button-refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search */}
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by student name or admission number..."
              data-testid="input-search-report-cards"
            />

            {/* Class / Term filters + Status filter icon + Sort icon */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]" data-testid="select-class">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c: { id: number; name: string }) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]" data-testid="select-term">
                  <SelectValue placeholder="All Terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {terms.map((t: { id: number; name: string }) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status filter — icon button opens a dropdown of status choices */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={statusFilter !== 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    aria-label="Filter by status"
                    data-testid="button-filter-status"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {statusFilter === 'all' ? 'Status' :
                        statusFilter === 'draft' ? 'Draft' :
                        statusFilter === 'finalized' ? 'Awaiting Approval' : 'Published'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                    <DropdownMenuRadioItem value="all" data-testid="filter-status-all">All Status</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="draft" data-testid="filter-status-draft">Draft</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="finalized" data-testid="filter-status-finalized">Awaiting Approval</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="published" data-testid="filter-status-published">Published</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort — icon button opens a dropdown of sort choices */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={sortBy !== 'name-asc' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    aria-label="Sort report cards"
                    data-testid="button-sort"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                    <DropdownMenuRadioItem value="name-asc" data-testid="sort-name-asc">Name (A → Z)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name-desc" data-testid="sort-name-desc">Name (Z → A)</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem value="average-desc" data-testid="sort-average-desc">Average (High → Low)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="average-asc" data-testid="sort-average-asc">Average (Low → High)</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem value="class-asc" data-testid="sort-class">Class</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="status-asc" data-testid="sort-status">Status</DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem value="date-desc" data-testid="sort-date-desc">Finalized (Newest)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="date-asc" data-testid="sort-date-asc">Finalized (Oldest)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-muted-foreground"
                  data-testid="button-clear-search"
                >
                  Clear search
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          {/* Bulk export progress banner */}
          {isBulkExporting && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 dark:bg-primary/5 border border-primary/30 dark:border-primary/30 rounded-md" data-testid="bulk-export-progress">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-primary dark:text-primary/60">
                  {bulkExportType === 'pdf' ? 'Generating PDF' : bulkExportType === 'zip' ? 'Building ZIP' : 'Preparing Print'}… {bulkExportProgress} of {bulkExportTotal} report cards
                </p>
                <div className="mt-1 w-full bg-primary/20 dark:bg-primary/5 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${bulkExportTotal > 0 ? (bulkExportProgress / bulkExportTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-primary dark:text-primary/70 shrink-0 font-medium">
                {bulkExportTotal > 0 ? Math.round((bulkExportProgress / bulkExportTotal) * 100) : 0}%
              </span>
            </div>
          )}

          {selectedReportCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-2 sm:p-3 bg-muted rounded-md">
              <span className="text-xs sm:text-sm font-medium">{selectedReportCards.length} selected</span>
              <div className="flex gap-2 ml-auto flex-wrap">
                {/* Download selected dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBulkExporting}
                      className="text-xs sm:text-sm"
                      data-testid="button-bulk-download-selected"
                    >
                      {isBulkExporting ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" /> : <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />}
                      <span className="hidden sm:inline">Download Selected</span>
                      <span className="sm:hidden">Download</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkExport(selectedReportCards, 'zip')} data-testid="menu-bulk-zip-selected">
                      <Download className="w-4 h-4 mr-2" />
                      Download as ZIP ({selectedReportCards.length} images)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport(selectedReportCards, 'pdf')} data-testid="menu-bulk-pdf-selected">
                      <FileText className="w-4 h-4 mr-2" />
                      Download as PDF ({selectedReportCards.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkExport(selectedReportCards, 'print')} data-testid="menu-bulk-print-selected">
                      <Printer className="w-4 h-4 mr-2" />
                      Print All Selected ({selectedReportCards.length})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isPublishedView ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkUnpublishMutation.mutate(selectedReportCards)}
                    className="text-xs sm:text-sm"
                    data-testid="button-bulk-unpublish"
                  >
                    <Undo2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Unpublish Selected</span>
                    <span className="sm:hidden">Unpublish</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => bulkPublishMutation.mutate(selectedReportCards)}
                    className="text-xs sm:text-sm"
                    data-testid="button-bulk-publish"
                  >
                    <Send className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Publish Selected</span>
                    <span className="sm:hidden">Publish</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedReportCards([])}
                  className="text-xs sm:text-sm"
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : reportCards.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                {statusFilter === 'draft'
                  ? 'No draft report cards found'
                  : statusFilter === 'finalized'
                  ? 'No finalized report cards found'
                  : statusFilter === 'published'
                  ? 'No published report cards found'
                  : 'No report cards found for the selected filters'}
              </p>
            </div>
          ) : displayedReportCards.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-search-results">
              <SearchX className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                No report cards match "{searchQuery}"
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearchQuery('')}
                data-testid="button-clear-search-empty"
              >
                Clear search
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(statusFilter === 'finalized' || statusFilter === 'published') && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isPublishedView ? allPublishedSelected : allFinalizedSelected}
                            onCheckedChange={handleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                      )}
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Finalized</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedReportCards.map((rc) => (
                      <TableRow key={rc.id} data-testid={`row-report-${rc.id}`}>
                        {(statusFilter === 'finalized' || statusFilter === 'published') && (
                          <TableCell>
                            {(rc.status === 'finalized' || rc.status === 'published') && (
                              <Checkbox
                                checked={selectedReportCards.includes(rc.id)}
                                onCheckedChange={(checked) => handleSelectOne(rc.id, !!checked)}
                                data-testid={`checkbox-select-${rc.id}`}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{rc.studentName}</p>
                            <p className="text-xs text-muted-foreground">{rc.admissionNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{rc.className}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{rc.termName}</p>
                            <p className="text-xs text-muted-foreground">{rc.sessionYear}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${(rc.averagePercentage || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {rc.averagePercentage || 0}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{rc.overallGrade || '-'}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(rc.status, rc.id)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rc.finalizedAt ? format(new Date(rc.finalizedAt), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Report card actions" data-testid={`button-actions-${rc.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewReportCard(rc)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              {rc.status === 'draft' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => finalizeMutation.mutate(rc.id)}>
                                    <FileCheck className="w-4 h-4 mr-2" />
                                    Finalize
                                  </DropdownMenuItem>
                                </>
                              )}
                              {rc.status === 'finalized' && !publishingIdsRef.current.has(rc.id) && !rejectingIdsRef.current.has(rc.id) && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => publishMutation.mutate(rc.id)}
                                  >
                                    <Send className="w-4 h-4 mr-2" />
                                    Approve & Publish
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleReject(rc.id)}
                                    className="text-red-600"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {rc.status === 'published' && !unpublishingIdsRef.current.has(rc.id) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => unpublishMutation.mutate(rc.id)}
                                    className="text-amber-600"
                                  >
                                    <Undo2 className="w-4 h-4 mr-2" />
                                    Unpublish
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {((statusFilter === 'finalized' && finalizedCount > 0) || (statusFilter === 'published' && publishedCount > 0)) && (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <Checkbox
                      checked={isPublishedView ? allPublishedSelected : allFinalizedSelected}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all-mobile"
                    />
                    <span className="text-xs text-muted-foreground">Select all</span>
                  </div>
                )}
                {displayedReportCards.map((rc) => (
                  <Card key={rc.id} className="overflow-hidden" data-testid={`card-report-${rc.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {((statusFilter === 'finalized' && rc.status === 'finalized') || (statusFilter === 'published' && rc.status === 'published')) && (
                          <Checkbox
                            checked={selectedReportCards.includes(rc.id)}
                            onCheckedChange={(checked) => handleSelectOne(rc.id, !!checked)}
                            className="mt-1"
                            data-testid={`checkbox-select-mobile-${rc.id}`}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{rc.studentName}</p>
                              <p className="text-xs text-muted-foreground">{rc.admissionNumber}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Report card actions" className="shrink-0 -mt-1 -mr-1">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewReportCard(rc)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Preview
                                </DropdownMenuItem>
                                {rc.status === 'draft' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => finalizeMutation.mutate(rc.id)}>
                                      <FileCheck className="w-4 h-4 mr-2" />
                                      Finalize
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {rc.status === 'finalized' && !publishingIdsRef.current.has(rc.id) && !rejectingIdsRef.current.has(rc.id) && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => publishMutation.mutate(rc.id)}
                                    >
                                      <Send className="w-4 h-4 mr-2" />
                                      Approve & Publish
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleReject(rc.id)}
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {rc.status === 'published' && !unpublishingIdsRef.current.has(rc.id) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => unpublishMutation.mutate(rc.id)}
                                      className="text-amber-600"
                                    >
                                      <Undo2 className="w-4 h-4 mr-2" />
                                      Unpublish
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs">{rc.className}</Badge>
                            <Badge variant="outline" className="text-xs">{rc.termName}</Badge>
                            <span className={`text-xs font-semibold ${(rc.averagePercentage || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                              {rc.averagePercentage || 0}% ({rc.overallGrade || '-'})
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            {getStatusBadge(rc.status, rc.id)}
                            <span className="text-xs text-muted-foreground">
                              {rc.finalizedAt ? format(new Date(rc.finalizedAt), 'MMM d') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog - Fully Responsive for all screen sizes */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent
          className="w-[98vw] sm:w-[95vw] md:w-[90vw] lg:w-[85vw] max-w-5xl max-h-[85dvh] sm:max-h-[88dvh] md:max-h-[90dvh] p-0 flex flex-col overflow-hidden"
          style={{ margin: 'auto' }}
        >
          <DialogHeader className="px-3 py-2 sm:px-4 sm:py-3 border-b shrink-0 bg-background">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">Report Card Preview</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm truncate mt-0.5">
                  {viewingReportCard?.studentName} - {viewingReportCard?.className} - {viewingReportCard?.termName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingFullReport ? (
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
            </div>
          ) : fullReportCard ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Action Bar - Responsive */}
              <div className="px-2 py-2 sm:px-4 sm:py-3 border-b bg-muted/30 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {getStatusBadge(fullReportCard.status)}
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {fullReportCard.status === 'draft' ? 'Draft — admin can finalize and publish' :
                        fullReportCard.status === 'finalized' ? 'Ready for publishing' :
                        fullReportCard.status === 'published' ? 'Visible to students and parents' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* Recalculate — re-syncs scores, grades & positions from source exams */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRecalculate}
                      disabled={isRecalculating}
                      aria-label="Recalculate scores and grades"
                      title="Recalculate scores, grades & positions"
                      data-testid="button-recalculate"
                    >
                      {isRecalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                    {/* Print/Download icons */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrintReport}
                      aria-label="Print report card"
                      data-testid="button-print"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isDownloading}
                          aria-label="Export report card"
                          data-testid="button-download"
                        >
                          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleDownloadAsPDF} data-testid="menu-export-pdf">
                          <FileText className="w-4 h-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDownloadAsImage} data-testid="menu-export-image">
                          <Download className="w-4 h-4 mr-2" />
                          Export as Image
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {fullReportCard.status === 'draft' && (
                      <Button
                        onClick={() => {
                          finalizeMutation.mutate(fullReportCard.id);
                          setIsViewDialogOpen(false);
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs sm:text-sm h-9 text-amber-600 hover:text-amber-700"
                        data-testid="button-finalize-dialog"
                      >
                        <FileCheck className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Finalize</span>
                      </Button>
                    )}
                    {fullReportCard.status === 'finalized' && (
                      <>
                        <Button
                          onClick={() => {
                            publishMutation.mutate(fullReportCard.id);
                            setIsViewDialogOpen(false);
                          }}
                          size="sm"
                          className="text-xs sm:text-sm h-9"
                          data-testid="button-publish-dialog"
                        >
                          <Send className="w-4 h-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Publish</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setIsViewDialogOpen(false);
                            handleReject(fullReportCard.id);
                          }}
                          aria-label="Reject report card"
                          className="text-red-600 hover:text-red-700"
                          data-testid="button-reject-dialog"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {fullReportCard.status === 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          unpublishMutation.mutate(fullReportCard.id);
                          setIsViewDialogOpen(false);
                        }}
                        className="text-xs sm:text-sm h-9 text-amber-600 hover:text-amber-700"
                        data-testid="button-unpublish-dialog"
                      >
                        <Undo2 className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Unpublish</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Report Card - Uses native overflow for better mobile support */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div ref={reportCardRef} className="p-2 sm:p-3 md:p-4 bg-background">
                  <ProfessionalReportCard
                    reportCard={{
                      id: fullReportCard.id,
                      studentId: fullReportCard.studentId,
                      studentName: fullReportCard.studentName,
                      studentPhoto: fullReportCard.studentPhoto,
                      admissionNumber: fullReportCard.admissionNumber || fullReportCard.studentUsername,
                      className: fullReportCard.className,
                      department: fullReportCard.department,
                      isSSS: fullReportCard.isSSS,
                      termName: fullReportCard.termName,
                      academicSession: fullReportCard.academicSession || fullReportCard.sessionYear || '2024/2025',
                      averagePercentage: fullReportCard.averagePercentage || 0,
                      overallGrade: fullReportCard.overallGrade || '-',
                      position: fullReportCard.position || 0,
                      totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
                      totalScore: fullReportCard.totalScore,
                      items: fullReportCard.items || [],
                      teacherRemarks: fullReportCard.teacherRemarks,
                      principalRemarks: fullReportCard.principalRemarks,
                      status: fullReportCard.status,
                      generatedAt: fullReportCard.generatedAt,
                      teacherSignatureUrl: fullReportCard.teacherSignatureUrl,
                      teacherSignedAt: fullReportCard.teacherSignedAt,
                      teacherSignedBy: fullReportCard.teacherSignedBy,
                      principalSignatureUrl: fullReportCard.principalSignatureUrl,
                      principalSignedAt: fullReportCard.principalSignedAt,
                      principalSignedBy: fullReportCard.principalSignedBy,
                      classStatistics: {
                        highestScore: fullReportCard.classStatistics?.highestScore || 0,
                        lowestScore: fullReportCard.classStatistics?.lowestScore || 0,
                        classAverage: fullReportCard.classStatistics?.classAverage || 0,
                        totalStudents: fullReportCard.classStatistics?.totalStudents || fullReportCard.totalStudentsInClass || 0
                      },
                      attendance: {
                        timesSchoolOpened: fullReportCard.attendance?.timesSchoolOpened || 0,
                        timesPresent: fullReportCard.attendance?.timesPresent || 0,
                        timesAbsent: fullReportCard.attendance?.timesAbsent || 0,
                        attendancePercentage: fullReportCard.attendance?.attendancePercentage || 0
                      },
                      affectiveTraits: fullReportCard.affectiveTraits,
                      psychomotorSkills: fullReportCard.psychomotorSkills
                    }}
                    testWeight={40}
                    examWeight={60}
                    canEditTeacherRemarks={true}
                    canEditPrincipalRemarks={true}
                    canEditSkills={true}
                    onSaveRemarks={(teacher, principal) => {
                      if (!fullReportCard) return;
                      updateRemarksMutation.mutate({ reportCardId: fullReportCard.id, teacherRemarks: teacher, principalRemarks: principal });
                    }}
                    onSaveSkills={async (skills: any) => {
                      if (!fullReportCard) return;
                      await saveSkillsMutation.mutateAsync({ reportCardId: fullReportCard.id, skills });
                    }}
                    onEditSubject={(item) => {
                      setSelectedOverrideItem(item);
                      setIsOverrideDialogOpen(true);
                    }}
                    onGenerateDefaultComments={async () => {
                      if (!fullReportCard) throw new Error('No report card loaded');
                      const response = await apiRequest('GET', `/api/reports/${fullReportCard.id}/default-comments`);
                      if (!response.ok) throw new Error('Failed to generate comments');
                      return response.json();
                    }}
                    isLoading={updateRemarksMutation.isPending || saveSkillsMutation.isPending}
                    hideActionButtons={true}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[200px]">
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">Failed to load report card details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Report Card
            </DialogTitle>
            <DialogDescription className="text-sm">
              This will revert the report card back to draft status so the teacher can make corrections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason" className="text-sm">Reason for Rejection (Optional)</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter feedback for the teacher..."
                className="mt-2"
                data-testid="input-reject-reason"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectingId(null);
                setRejectReason('');
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              className="w-full sm:w-auto"
              data-testid="button-confirm-reject"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject & Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backfill Comments Dialog */}
      <Dialog open={isBackfillDialogOpen} onOpenChange={setIsBackfillDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Default Comments
            </DialogTitle>
            <DialogDescription className="text-sm">
              Automatically generate encouraging teacher and principal comments based on each student's academic performance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-2">This will generate comments for:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{selectedClass === 'all' ? 'All classes' : `Class: ${classes.find((c: any) => c.id.toString() === selectedClass)?.name || selectedClass}`}</li>
                <li>{selectedTerm === 'all' ? 'All terms' : `Term: ${terms.find((t: any) => t.id.toString() === selectedTerm)?.name || selectedTerm}`}</li>
              </ul>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwrite-comments"
                checked={backfillOverwrite}
                onCheckedChange={(checked) => setBackfillOverwrite(Boolean(checked))}
                data-testid="checkbox-overwrite-comments"
              />
              <Label htmlFor="overwrite-comments" className="text-sm">
                Overwrite existing comments (if any)
              </Label>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsBackfillDialogOpen(false);
                setBackfillOverwrite(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => backfillCommentsMutation.mutate({
                termId: selectedTerm !== 'all' ? parseInt(selectedTerm) : undefined,
                classId: selectedClass !== 'all' ? parseInt(selectedClass) : undefined,
                overwrite: backfillOverwrite
              })}
              disabled={backfillCommentsMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-confirm-generate-comments"
            >
              {backfillCommentsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4 mr-2" />
              )}
              Generate Comments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Score Dialog — shared with teachers, clean UI with optimistic updates */}
      <EditScoreDialog
        open={isOverrideDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsOverrideDialogOpen(false);
            setSelectedOverrideItem(null);
          }
        }}
        item={selectedOverrideItem}
        reportCardQueryKey={['/api/reports', viewingReportCard?.id, 'full']}
        showRemarks={false}
      />

      {/* Hidden Bailey's Template for BULK Export/Print - off-screen, mounted when exporting */}
      {bulkRenderData && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -10, pointerEvents: 'none', width: '210mm' }}
        >
          <BaileysReportTemplate
            ref={bulkTemplateRef}
            reportCard={mapToReportCardProps(bulkRenderData)}
            testWeight={40}
            examWeight={60}
          />
        </div>
      )}

      {/* Hidden Bailey's Style Template for Export/Print */}
      {fullReportCard && isViewDialogOpen && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">
          <BaileysReportTemplate
            ref={baileysTemplateRef}
            reportCard={{
              studentName: fullReportCard.studentName,
              admissionNumber: fullReportCard.admissionNumber || fullReportCard.studentUsername || 'N/A',
              className: fullReportCard.className,
              classArm: fullReportCard.classArm,
              department: fullReportCard.department,
              isSSS: fullReportCard.isSSS,
              termName: fullReportCard.termName,
              academicSession: fullReportCard.academicSession || fullReportCard.sessionYear || '2024/2025',
              averagePercentage: fullReportCard.averagePercentage || 0,
              overallGrade: fullReportCard.overallGrade || '-',
              position: fullReportCard.position || 0,
              totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
              items: (fullReportCard.items || []).map((item: any) => ({
                subjectName: item.subjectName,
                testScore: item.testScore ?? item.testWeightedScore ?? null,
                examScore: item.examScore ?? item.examWeightedScore ?? null,
                obtainedMarks: item.obtainedMarks ?? item.totalScore ?? 0,
                grade: item.grade || '-',
                remarks: item.remarks || item.teacherRemarks || '',
                subjectPosition: item.subjectPosition || null,
              })),
              teacherRemarks: fullReportCard.teacherRemarks,
              principalRemarks: fullReportCard.principalRemarks,
              attendance: {
                timesSchoolOpened: fullReportCard.attendance?.timesSchoolOpened || 0,
                timesPresent: fullReportCard.attendance?.timesPresent || 0,
                timesAbsent: fullReportCard.attendance?.timesAbsent || 0,
              },
              studentPhoto: fullReportCard.studentPhoto,
              teacherSignatureUrl: fullReportCard.teacherSignatureUrl || null,
              principalSignatureUrl: fullReportCard.principalSignatureUrl || null,
              teacherName: fullReportCard.teacherName || '',
              principalName: fullReportCard.principalName || '',
              gender: fullReportCard.gender || '',
              dateOfBirth: fullReportCard.dateOfBirth
                ? format(new Date(fullReportCard.dateOfBirth), 'dd-MMM-yyyy')
                : '',
              age: calculateAge(fullReportCard.dateOfBirth),
              dateIssued: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              affectiveTraits: fullReportCard.affectiveTraits,
              psychomotorSkills: fullReportCard.psychomotorSkills
            }}
            testWeight={40}
            examWeight={60}
          />
        </div>
      )}
      <ReportCardMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        selectedClass={selectedClass}
        selectedTerm={selectedTerm}
      />
    </div>
  );
}
