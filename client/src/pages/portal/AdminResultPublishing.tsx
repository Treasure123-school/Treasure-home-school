import { useState, useRef, useCallback, MutableRefObject } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { toCanvas } from 'html-to-image';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { ProfessionalReportCard } from '@/components/ui/professional-report-card';

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
  const [statusFilter, setStatusFilter] = useState<string>('finalized');
  const [selectedReportCards, setSelectedReportCards] = useState<number[]>([]);
  const [viewingReportCard, setViewingReportCard] = useState<FinalizedReportCard | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const reportCardRef = useRef<HTMLDivElement>(null);
  const baileysTemplateRef = useRef<HTMLDivElement>(null);

  const handleDownloadAsImage = async () => {
    if (!baileysTemplateRef.current || !viewingReportCard) return;

    setIsDownloading(true);
    try {
      await exportToImage(baileysTemplateRef.current, {
        filename: `report-card-${viewingReportCard.studentName?.replace(/\s+/g, '-')}`,
        scale: 2,
      });

      toast({ title: "Success", description: "Report card downloaded as image" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download report card", variant: "destructive" });
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
    } catch (error) {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
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

  const { data: terms = [] } = useQuery({
    queryKey: ['/api/terms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/terms');
      return await response.json();
    },
  });

  const { data: reportCardsData, isLoading, refetch } = useQuery({
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
  // This ensures the UI updates instantly when any admin changes a report card status
  // Real-time stays enabled - optimistic state takes precedence via query cache
  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, statusFilter],
    enabled: true,
    fallbackPollingInterval: 30000,
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
      const filterViews = ['finalized', 'published', 'all'];
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

      return { previousDataMap, reportCardId };
    },
    onSuccess: (_data, reportCardId) => {
      removeFromSet(publishingIdsRef, reportCardId);
      toast({ title: "Success", description: "Report card published successfully" });
    },
    onError: (error: Error, reportCardId, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(publishingIdsRef, reportCardId);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['finalized', 'published', 'all'];
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
      const filterViews = ['finalized', 'published', 'all'];
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

      return { previousDataMap };
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
    },
    onError: (error: Error, _reportCardIds, context) => {
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['finalized', 'published', 'all'];
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
      const filterViews = ['finalized', 'published', 'all'];
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

      return { previousDataMap, reportCardId };
    },
    onSuccess: (_data, reportCardId) => {
      removeFromSet(unpublishingIdsRef, reportCardId);
      toast({ title: "Success", description: "Report card unpublished successfully. Students can no longer view it." });
    },
    onError: (error: Error, reportCardId, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(unpublishingIdsRef, reportCardId);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['finalized', 'published', 'all'];
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
      const filterViews = ['finalized', 'published', 'all'];
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

      return { previousDataMap };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Selected report cards unpublished successfully" });
    },
    onError: (error: Error, _reportCardIds, context) => {
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['finalized', 'published', 'all'];
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
      const filterViews = ['finalized', 'published', 'all'];
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

      // Optimistically update ALL filter views - remove from all since it goes to draft
      filterViews.forEach(filter => {
        queryClient.setQueryData(
          ['/api/admin/report-cards/finalized', selectedClass, selectedTerm, filter],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              reportCards: old.reportCards.filter((rc: FinalizedReportCard) => rc.id !== id),
              statistics: newStats
            };
          }
        );
      });

      // Close dialog immediately for instant feedback
      setIsRejectDialogOpen(false);
      setRejectingId(null);
      setRejectReason('');

      return { previousDataMap, id };
    },
    onSuccess: (_data, { id }) => {
      removeFromSet(rejectingIdsRef, id);
      toast({ title: "Report Card Rejected", description: "The report card has been reverted to draft for teacher revision" });
    },
    onError: (error: Error, { id }, context) => {
      // Silently ignore duplicate blocked errors (no toast, no cleanup needed)
      if (error.message === 'DUPLICATE_BLOCKED') return;
      removeFromSet(rejectingIdsRef, id);
      // Rollback ALL filter views
      if (context?.previousDataMap) {
        const filterViews = ['finalized', 'published', 'all'];
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

  // Backfill default comments mutation
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (statusFilter === 'published') {
        const publishedIds = reportCards.filter(rc => rc.status === 'published').map(rc => rc.id);
        setSelectedReportCards(publishedIds);
      } else {
        const finalizedIds = reportCards.filter(rc => rc.status === 'finalized').map(rc => rc.id);
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

  const finalizedCount = reportCards.filter(rc => rc.status === 'finalized').length;
  const publishedCount = reportCards.filter(rc => rc.status === 'published').length;
  const allFinalizedSelected = finalizedCount > 0 && selectedReportCards.length === finalizedCount;
  const allPublishedSelected = publishedCount > 0 && selectedReportCards.length === publishedCount;
  const isPublishedView = statusFilter === 'published';

  const pendingCount = publishingIdsRef.current.size + unpublishingIdsRef.current.size + rejectingIdsRef.current.size;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6" data-testid="page-admin-result-publishing">
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="aria-live-status">
        {pendingCount > 0 ? `Processing ${pendingCount} report card${pendingCount > 1 ? 's' : ''}...` : ''}
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            Result Publishing
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and publish finalized report cards
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">Awaiting</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-600" data-testid="stat-finalized">{statistics.finalized}</p>
                </div>
                <FileCheck className="hidden sm:block w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">Published</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600" data-testid="stat-published">{statistics.published}</p>
                </div>
                <CheckCircle className="hidden sm:block w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground">In Draft</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-600" data-testid="stat-draft">{statistics.draft}</p>
                </div>
                <Clock className="hidden sm:block w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
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
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsBackfillDialogOpen(true)}
                  className="sm:hidden"
                  aria-label="Generate comments"
                  data-testid="button-generate-comments-mobile"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBackfillDialogOpen(true)}
                  className="hidden sm:flex"
                  data-testid="button-generate-comments"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Comments
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  aria-label="Refresh report cards"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-class">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[calc(50%-4px)] sm:w-[140px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finalized">Awaiting</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          {selectedReportCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-2 sm:p-3 bg-muted rounded-md">
              <span className="text-xs sm:text-sm font-medium">{selectedReportCards.length} selected</span>
              <div className="flex gap-2 ml-auto">
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
                {statusFilter === 'finalized'
                  ? 'No report cards awaiting approval'
                  : 'No report cards found'}
              </p>
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
                    {reportCards.map((rc) => (
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
                {reportCards.map((rc) => (
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
                      {fullReportCard.status === 'finalized' ? 'Ready for publishing' :
                        fullReportCard.status === 'published' ? 'Visible to students and parents' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
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
                      admissionNumber: fullReportCard.studentUsername || fullReportCard.admissionNumber,
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
                    canEditRemarks={false}
                    canEditSkills={false}
                    isLoading={false}
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

      {/* Hidden Bailey's Style Template for Export/Print */}
      {fullReportCard && isViewDialogOpen && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">
          <BaileysReportTemplate
            ref={baileysTemplateRef}
            reportCard={{
              studentName: fullReportCard.studentName,
              admissionNumber: fullReportCard.studentUsername || fullReportCard.admissionNumber || 'N/A',
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
              dateIssued: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              affectiveTraits: fullReportCard.affectiveTraits,
              psychomotorSkills: fullReportCard.psychomotorSkills
            }}
            testWeight={40}
            examWeight={60}
          />
        </div>
      )}
    </div>
  );
}
