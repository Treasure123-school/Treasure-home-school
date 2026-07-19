import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toCanvas } from "html-to-image";
import { useSocketIORealtime } from "@/hooks/useSocketIORealtime";
import { BaileysReportTemplate } from "@/components/ui/report-card-template";
import {
  exportToPDF,
  exportToImage,
  printElement,
} from "@/lib/report-export-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  GraduationCap,
  RefreshCw,
  Eye,
  Edit,
  CheckCircle,
  AlertCircle,
  Search,
  Award,
  Printer,
  Download,
  Save,
  Send,
  Clock,
  PenTool,
  Loader2,
  Undo2,
  Unlock,
  MoreVertical,
  FileCheck,
  FileClock,
  FilePen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  STANDARD_GRADING_SCALE,
  formatPosition,
} from "@shared/grading-utils";
import { calculateAge } from "@/lib/report-card-utils";
import { ProfessionalReportCard } from "@/components/ui/professional-report-card";
import { ContactUtils } from "@shared/contact-utils";
import { ReportCardFilters } from "@/components/portal/ReportCardFilters";
import { ReportCardStatsBar } from "@/components/portal/ReportCardStatsBar";
import { EditScoreDialog } from "@/components/portal/EditScoreDialog";

interface ReportCardItem {
  id: number;
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  testExamId?: number | null;
  testExamCreatedBy?: string | null;
  testScore: number | null;
  testMaxScore: number | null;
  testWeightedScore: number | null;
  examExamId?: number | null;
  examExamCreatedBy?: string | null;
  examScore: number | null;
  examMaxScore: number | null;
  examWeightedScore: number | null;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  remarks: string;
  teacherRemarks: string | null;
  isOverridden: boolean;
  overriddenAt: string | null;
  overriddenBy?: string | null;
  canEditTest?: boolean;
  canEditExam?: boolean;
  canEditRemarks?: boolean;
}

interface AffectiveTraits {
  punctuality: number;
  neatness: number;
  attentiveness: number;
  teamwork: number;
  leadership: number;
  assignments: number;
  classParticipation: number;
  honesty?: number;
  politeness?: number;
  selfControl?: number;
  obedience?: number;
  reliability?: number;
  senseOfResponsibility?: number;
  relationshipWithOthers?: number;
}

interface PsychomotorSkills {
  sports: number;
  handwriting: number;
  musicalSkills: number;
  creativity: number;
  handlingOfTools?: number;
  drawingPainting?: number;
  publicSpeaking?: number;
  speechFluency?: number;
}

interface ReportCard {
  id: number;
  studentId: string;
  studentName: string;
  studentUsername?: string;
  studentPhoto?: string;
  admissionNumber: string;
  className: string;
  classLevel?: string;
  department?: string | null;
  isSSS?: boolean;
  termName: string;
  averagePercentage: number;
  overallGrade: string;
  position: number;
  totalStudentsInClass: number;
  status: string;
  gradingScale: string;
  teacherRemarks: string | null;
  principalRemarks: string | null;
  generatedAt: string;
  items: ReportCardItem[];
  affectiveTraits?: AffectiveTraits;
  psychomotorSkills?: PsychomotorSkills;
}

type SortField =
  | "position"
  | "studentName"
  | "averagePercentage"
  | "overallGrade"
  | "status";
type SortDirection = "asc" | "desc";

export default function TeacherReportCards() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = settings?.schoolName || "";
  const schoolAddress = settings?.schoolAddress || "";
  const schoolMotto = settings?.schoolMotto || "";
  const schoolPhone = ContactUtils.getFormattedPrimaryPhone(settings);
  const schoolEmail = ContactUtils.getPrimaryEmail(settings);

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedReportCard, setSelectedReportCard] =
    useState<ReportCard | null>(null);
  const [selectedGradingScale, setSelectedGradingScale] =
    useState<string>("standard");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReportCardItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("students");
  const [remarks, setRemarks] = useState({ teacher: "", principal: "" });
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const reportCardRef = useRef<HTMLDivElement>(null);
  const baileysTemplateRef = useRef<HTMLDivElement>(null);

  const handleDownloadAsImage = async () => {
    if (!baileysTemplateRef.current || !selectedReportCard) return;

    setIsDownloading(true);
    try {
      const studentName =
        (fullReportCard as { studentName?: string })?.studentName || "student";
      await exportToImage(baileysTemplateRef.current, {
        filename: `report-card-${studentName.replace(/\s+/g, "-")}`,
        scale: 2,
      });

      toast({
        title: "Success",
        description: "Report card downloaded as image",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description:
          error?.message ||
          "Could not download the report card image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAsPDF = async () => {
    if (!baileysTemplateRef.current || !selectedReportCard) return;

    setIsDownloading(true);
    try {
      const studentName =
        (fullReportCard as { studentName?: string })?.studentName || "student";
      await exportToPDF(baileysTemplateRef.current, {
        filename: `report-card-${studentName.replace(/\s+/g, "-")}`,
        scale: 2,
      });

      toast({ title: "Success", description: "Report card PDF downloaded" });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description:
          error?.message || "Could not download the PDF. Please try again.",
        variant: "destructive",
      });
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
  const [sortField, setSortField] = useState<SortField>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: gradingConfig } = useQuery({
    queryKey: ["/api/grading-config", selectedGradingScale],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/grading-config?scale=${selectedGradingScale}`,
      );
      if (!response.ok) return null;
      return await response.json();
    },
  });

  const testWeight =
    gradingConfig?.dbSettings?.testWeight ?? STANDARD_GRADING_SCALE.testWeight;
  const examWeight =
    gradingConfig?.dbSettings?.examWeight ?? STANDARD_GRADING_SCALE.examWeight;

  // The grading-scale select's value must match one of the option values it
  // renders, or the trigger shows blank. Sync to the server's active scale
  // name once it loads, since our initial state ('standard') is just a key.
  useEffect(() => {
    if (
      gradingConfig?.currentConfig?.name &&
      selectedGradingScale === "standard"
    ) {
      setSelectedGradingScale(gradingConfig.currentConfig.name);
    }
  }, [gradingConfig?.currentConfig?.name]);

  // Real-time subscription for report card updates - scoped to class
  // Skip cache invalidation because we use optimistic updates in mutations
  // which handle cache updates directly from server response
  const { isConnected: realtimeConnected } = useSocketIORealtime({
    table: "report_cards",
    queryKey: ["/api/reports/class-term", selectedClass, selectedTerm],
    enabled: !!selectedClass && !!selectedTerm,
    classId: selectedClass,
    skipCacheInvalidation: true, // Prevents flicker by not invalidating cache on socket events
  });

  if (!user) {
    return <div>Loading...</div>;
  }

  const userName = `${user.firstName} ${user.lastName}`;
  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
  const userRole = (user.role?.toLowerCase() || "teacher") as
    | "admin"
    | "teacher"
    | "student"
    | "parent";

  // Use /api/my-assignments to get only teacher's assigned classes (or all classes for admins)
  const { data: assignmentData } = useQuery({
    queryKey: ["/api/my-assignments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/my-assignments");
      if (!response.ok)
        return { isAdmin: false, classes: [], subjects: [], assignments: [] };
      return await response.json();
    },
  });

  // Extract classes from assignment data - teachers only see their assigned classes
  const classes = assignmentData?.classes || [];
  const isAdmin = assignmentData?.isAdmin || false;

  const { data: terms = [] } = useQuery({
    queryKey: ["/api/terms"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/terms");
      return await response.json();
    },
  });

  const {
    data: reportCards = [],
    isLoading: loadingReportCards,
    refetch: refetchReportCards,
  } = useQuery({
    queryKey: ["/api/reports/class-term", selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];
      const response = await apiRequest(
        "GET",
        `/api/reports/class-term/${selectedClass}/${selectedTerm}`,
      );
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const {
    data: fullReportCard,
    isLoading: loadingFullReport,
    isFetching: fetchingFullReport,
    refetch: refetchFullReport,
  } = useQuery({
    queryKey: ["/api/reports", selectedReportCard?.id, "full"],
    queryFn: async () => {
      if (!selectedReportCard?.id) return null;
      const response = await apiRequest(
        "GET",
        `/api/reports/${selectedReportCard.id}/full`,
      );
      if (!response.ok) return null;
      return await response.json();
    },
    enabled: !!selectedReportCard?.id && isViewDialogOpen,
  });

  // Bulk status update mutation for finalizing/publishing multiple report cards
  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { reportCardIds: number[]; status: string }) => {
      const results = await Promise.all(
        data.reportCardIds.map(async (reportCardId) => {
          const response = await apiRequest(
            "PATCH",
            `/api/reports/${reportCardId}/status`,
            { status: data.status },
          );
          if (!response.ok) {
            const error = await response.json();
            throw new Error(
              error.message || `Failed to update report card ${reportCardId}`,
            );
          }
          return response.json();
        }),
      );
      return results;
    },
    onSuccess: (_, { status }) => {
      const statusLabel =
        status === "published"
          ? "published"
          : status === "finalized"
            ? "finalized"
            : "reverted to draft";
      toast({
        title: "Success",
        description: `Report cards ${statusLabel} successfully`,
      });
      refetchReportCards();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update report cards",
        variant: "destructive",
      });
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async (reportCardId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/reports/${reportCardId}/auto-populate`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to auto-populate scores");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Scores populated successfully",
      });
      refetchFullReport();
      refetchReportCards();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to auto-populate scores",
        variant: "destructive",
      });
    },
  });


  const updateStatusMutation = useMutation({
    mutationFn: async (data: {
      reportCardId: number;
      status: string;
      classId: string;
      termId: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/reports/${data.reportCardId}/status`,
        { status: data.status },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }
      return response.json();
    },
    onMutate: async ({ reportCardId, status, classId, termId }) => {
      // Cancel any outgoing refetches immediately
      queryClient.cancelQueries({
        queryKey: ["/api/reports", reportCardId, "full"],
      });
      queryClient.cancelQueries({
        queryKey: ["/api/reports/class-term", classId, termId],
      });

      // Snapshot previous values for rollback (full objects to restore all fields)
      const previousFullReport = queryClient.getQueryData([
        "/api/reports",
        reportCardId,
        "full",
      ]);
      const previousReportCards = queryClient.getQueryData([
        "/api/reports/class-term",
        classId,
        termId,
      ]);
      const previousSelectedReportCard = selectedReportCard;

      // Determine locked state based on new status
      const locked = status !== "draft";

      // Optimistically update the full report (instant UI update)
      queryClient.setQueryData(
        ["/api/reports", reportCardId, "full"],
        (old: any) => {
          if (!old || typeof old !== "object") return old;
          return { ...old, status, locked };
        },
      );

      // Optimistically update the report cards list (instant UI update)
      queryClient.setQueryData(
        ["/api/reports/class-term", classId, termId],
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((rc: any) =>
            rc.id === reportCardId ? { ...rc, status, locked } : rc,
          );
        },
      );

      // Update the selected report card state immediately for instant visual feedback
      setSelectedReportCard((prev) =>
        prev?.id === reportCardId ? { ...prev, status, locked } : prev,
      );

      // Immediate toast — fires before server responds for instant user feedback
      const statusLabel =
        status === "published"
          ? "Published"
          : status === "finalized"
            ? "Finalized"
            : "Reverted to Draft";
      toast({
        title: "Success",
        description: `Report card ${statusLabel.toLowerCase()} successfully`,
      });

      return {
        previousFullReport,
        previousReportCards,
        previousSelectedReportCard,
        classId,
        termId,
      };
    },
    onSuccess: (data, { reportCardId, classId, termId }) => {
      // Silent cache reconciliation — merge authoritative server data (timestamps, etc.)
      // without triggering a refetch that would cause badge flickering
      const reportCard = data?.reportCard;
      if (reportCard && typeof reportCard === "object") {
        queryClient.setQueryData(
          ["/api/reports", reportCardId, "full"],
          (old: any) => {
            if (!old || typeof old !== "object") return { ...reportCard };
            return { ...old, ...reportCard };
          },
        );
        queryClient.setQueryData(
          ["/api/reports/class-term", classId, termId],
          (old: any) => {
            if (!old || !Array.isArray(old)) return old;
            return old.map((rc: any) =>
              rc.id === reportCardId ? { ...rc, ...reportCard } : rc,
            );
          },
        );
        setSelectedReportCard((prev) =>
          prev?.id === reportCardId ? { ...prev, ...reportCard } : prev,
        );
      }
    },
    onError: (error: any, { reportCardId }, context: any) => {
      // Rollback to previous values on error (restore full objects)
      if (context?.previousFullReport) {
        queryClient.setQueryData(
          ["/api/reports", reportCardId, "full"],
          context.previousFullReport,
        );
      }
      if (context?.previousReportCards && context?.classId && context?.termId) {
        queryClient.setQueryData(
          ["/api/reports/class-term", context.classId, context.termId],
          context.previousReportCards,
        );
      }
      // Rollback selected report card state to full previous object
      if (context?.previousSelectedReportCard) {
        setSelectedReportCard(context.previousSelectedReportCard);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const updateRemarksMutation = useMutation({
    mutationFn: async (data: {
      reportCardId: number;
      teacherRemarks?: string;
      principalRemarks?: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/reports/${data.reportCardId}/remarks`,
        data,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update remarks");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Remarks updated successfully",
      });
      refetchFullReport();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update remarks",
        variant: "destructive",
      });
    },
  });

  // Skills mutation with optimistic updates - merges with existing values
  const saveSkillsMutation = useMutation({
    mutationFn: async (data: { reportCardId: number; skills: any }) => {
      const response = await apiRequest(
        "POST",
        `/api/reports/${data.reportCardId}/skills`,
        data.skills,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save skills");
      }
      return response.json();
    },
    onMutate: async ({ reportCardId, skills }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/reports", reportCardId, "full"],
      });

      // Snapshot previous data
      const previousFullReport = queryClient.getQueryData<any>([
        "/api/reports",
        reportCardId,
        "full",
      ]);

      // Merge new skills with existing values
      // Only update fields that are provided in the payload (allows 0s for clears)
      const mergeSkill = (key: string, existingVal: number) => {
        const newVal = skills[key];
        return newVal !== undefined ? newVal : (existingVal ?? 0);
      };

      queryClient.setQueryData(
        ["/api/reports", reportCardId, "full"],
        (old: any) => {
          if (!old) return old;

          const existingAffective = old.affectiveTraits || {};
          const existingPsychomotor = old.psychomotorSkills || {};

          return {
            ...old,
            affectiveTraits: {
              punctuality: mergeSkill("punctuality", existingAffective.punctuality),
              neatness: mergeSkill("neatness", existingAffective.neatness),
              attentiveness: mergeSkill("attentiveness", existingAffective.attentiveness),
              teamwork: mergeSkill("teamwork", existingAffective.teamwork),
              leadership: mergeSkill("leadership", existingAffective.leadership),
              assignments: mergeSkill("assignments", existingAffective.assignments),
              classParticipation: mergeSkill("classParticipation", existingAffective.classParticipation),
              honesty: mergeSkill("honesty", existingAffective.honesty ?? 0),
              politeness: mergeSkill("politeness", existingAffective.politeness ?? 0),
              selfControl: mergeSkill("selfControl", existingAffective.selfControl ?? 0),
              obedience: mergeSkill("obedience", existingAffective.obedience ?? 0),
              reliability: mergeSkill("reliability", existingAffective.reliability ?? 0),
              senseOfResponsibility: mergeSkill("senseOfResponsibility", existingAffective.senseOfResponsibility ?? 0),
              relationshipWithOthers: mergeSkill("relationshipWithOthers", existingAffective.relationshipWithOthers ?? 0),
            },
            psychomotorSkills: {
              sports: mergeSkill("sports", existingPsychomotor.sports),
              handwriting: mergeSkill("handwriting", existingPsychomotor.handwriting),
              musicalSkills: mergeSkill("musicalSkills", existingPsychomotor.musicalSkills),
              creativity: mergeSkill("creativity", existingPsychomotor.creativity),
              handlingOfTools: mergeSkill("handlingOfTools", existingPsychomotor.handlingOfTools ?? 0),
              drawingPainting: mergeSkill("drawingPainting", existingPsychomotor.drawingPainting ?? 0),
              publicSpeaking: mergeSkill("publicSpeaking", existingPsychomotor.publicSpeaking ?? 0),
              speechFluency: mergeSkill("speechFluency", existingPsychomotor.speechFluency ?? 0),
            },
          };
        },
      );

      // Toast fires here — instant, no waiting for server
      toast({ title: "Saved", description: "Skills updated" });

      return { previousFullReport, reportCardId };
    },
    onSuccess: () => {
      // Cache is already correct from onMutate optimistic update.
      // Do NOT invalidate — that triggers a refetch which overwrites localSkills and causes flicker.
    },
    onError: (error: any, _variables, context) => {
      // Rollback cache to snapshot taken before the mutation
      if (context?.previousFullReport && context?.reportCardId) {
        queryClient.setQueryData(
          ["/api/reports", context.reportCardId, "full"],
          context.previousFullReport,
        );
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save skills",
        variant: "destructive",
      });
    },
  });

  const handleViewReportCard = (reportCard: any) => {
    setSelectedReportCard(reportCard);
    setRemarks({
      teacher: reportCard.teacherRemarks || "",
      principal: reportCard.principalRemarks || "",
    });
    setIsViewDialogOpen(true);
  };

  const handleOverrideScore = (item: ReportCardItem) => {
    setSelectedItem(item);
    setIsOverrideDialogOpen(true);
  };

  // Handle bulk status updates
  const handleBulkStatusUpdate = (status: string) => {
    let targetIds: number[] = [];

    if (status === "finalized") {
      // Finalize all draft report cards
      targetIds = reportCards
        .filter((rc: any) => rc.status === "draft")
        .map((rc: any) => rc.id);
    } else if (status === "published") {
      // Publish all finalized report cards
      targetIds = reportCards
        .filter((rc: any) => rc.status === "finalized")
        .map((rc: any) => rc.id);
    }

    if (targetIds.length === 0) {
      toast({
        title: "No Report Cards to Update",
        description:
          status === "finalized"
            ? "No draft report cards found to finalize."
            : "No finalized report cards found to publish.",
        variant: "destructive",
      });
      return;
    }

    bulkStatusMutation.mutate({ reportCardIds: targetIds, status });
  };

  const getGradeColor = (grade: string) => {
    if (!grade)
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    const gradeUpper = grade.toUpperCase();
    if (gradeUpper.startsWith("A"))
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (gradeUpper.startsWith("B"))
      return "bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/50";
    if (gradeUpper.startsWith("C"))
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (gradeUpper.startsWith("D") || gradeUpper.startsWith("E"))
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" /> Draft
          </Badge>
        );
      case "finalized":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <Clock className="w-3 h-3 mr-1" /> Awaiting Admin Approval
          </Badge>
        );
      case "published":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Published
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  const filteredReportCards = reportCards
    .filter((rc: any) => {
      const matchesSearch =
        rc.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rc.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rc.studentUsername?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || rc.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "position":
          aVal = a.position || 999;
          bVal = b.position || 999;
          break;
        case "studentName":
          aVal = a.studentName?.toLowerCase() || "";
          bVal = b.studentName?.toLowerCase() || "";
          break;
        case "averagePercentage":
          aVal = a.averagePercentage || 0;
          bVal = b.averagePercentage || 0;
          break;
        case "overallGrade":
          aVal = a.overallGrade || "Z";
          bVal = b.overallGrade || "Z";
          break;
        case "status":
          const statusOrder = { draft: 1, finalized: 2, published: 3 };
          aVal = statusOrder[a.status as keyof typeof statusOrder] || 4;
          bVal = statusOrder[b.status as keyof typeof statusOrder] || 4;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // Pagination logic with clamping to prevent empty results
  const totalPages = Math.max(
    1,
    Math.ceil(filteredReportCards.length / itemsPerPage),
  );

  // Clamp currentPage to valid range when filtered results change
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredReportCards.length, totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReportCards = filteredReportCards.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const statistics =
    reportCards.length > 0
      ? {
          totalStudents: reportCards.length,
          passedStudents: reportCards.filter(
            (rc: any) => (rc.averagePercentage || 0) >= 50,
          ).length,
          failedStudents: reportCards.filter(
            (rc: any) => (rc.averagePercentage || 0) < 50,
          ).length,
          classAverage:
            Math.round(
              (reportCards.reduce(
                (sum: number, rc: any) => sum + (rc.averagePercentage || 0),
                0,
              ) /
                reportCards.length) *
                10,
            ) / 10,
          classHighest: Math.max(
            ...reportCards.map((rc: any) => rc.averagePercentage || 0),
          ),
          classLowest: Math.min(
            ...reportCards.map((rc: any) => rc.averagePercentage || 0),
          ),
          draftCount: reportCards.filter((rc: any) => rc.status === "draft")
            .length,
          finalizedCount: reportCards.filter(
            (rc: any) => rc.status === "finalized",
          ).length,
          publishedCount: reportCards.filter(
            (rc: any) => rc.status === "published",
          ).length,
        }
      : null;

  return (
    <div className="space-y-4" data-testid="teacher-report-cards">
      {/* Compact Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <div className="flex items-center">
            <div className="p-2 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              data-testid="heading-report-cards"
            >
              Report Cards
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            View and manage auto-generated student report cards
          </p>
        </div>
      </div>

      <ReportCardFilters
        classes={classes}
        terms={terms}
        selectedClass={selectedClass}
        onClassChange={setSelectedClass}
        selectedTerm={selectedTerm}
        onTermChange={setSelectedTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() =>
          setShowAdvancedFilters(!showAdvancedFilters)
        }
        selectedGradingScale={selectedGradingScale}
        onGradingScaleChange={setSelectedGradingScale}
        availableGradingScales={gradingConfig?.availableScales ?? []}
        testWeight={testWeight}
        examWeight={examWeight}
      />

      {!selectedClass || !selectedTerm ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Class and Term</h3>
            <p className="text-muted-foreground">
              Please select a class and academic term to view or generate report
              cards.
            </p>
          </CardContent>
        </Card>
      ) : loadingReportCards ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading report cards...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid - Only visible when report cards exist, matches other portal pages */}
          {statistics && reportCards.length > 0 && (
            <ReportCardStatsBar statistics={statistics} />
          )}

          {/* Two tabs only: Students and Analytics */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Class Report Cards
                    </CardTitle>
                    {/* Mobile status indicators */}
                    <div className="flex sm:hidden items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Clock className="w-3 h-3" />
                        {statistics?.draftCount || 0}
                      </span>
                      <span className="flex items-center gap-1 text-primary">
                        <FileCheck className="w-3 h-3" />
                        {statistics?.finalizedCount || 0}
                      </span>
                      <span className="flex items-center gap-1 text-green-600">
                        <Send className="w-3 h-3" />
                        {statistics?.publishedCount || 0}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reportCards.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        No Report Cards Yet
                      </h3>
                      <p className="text-muted-foreground mb-2">
                        Report cards will appear here automatically as students
                        complete their exams.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Search students..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="pl-10 h-9"
                          data-testid="input-search-students"
                        />
                      </div>

                      {/* Simplified Mobile Card View */}
                      <div className="block sm:hidden space-y-2">
                        {paginatedReportCards.map((rc: any) => (
                          <div
                            key={rc.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate cursor-pointer"
                            onClick={() => handleViewReportCard(rc)}
                            data-testid={`mobile-row-${rc.id}`}
                          >
                            {/* Position Badge */}
                            <div
                              className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold"
                              aria-label={`Position ${rc.position || "unknown"}`}
                            >
                              {rc.position || "-"}
                            </div>

                            {/* Student Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {rc.studentName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {rc.averagePercentage || 0}% avg
                              </div>
                            </div>

                            {/* Grade & Status with accessible labels */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Badge
                                className={`text-xs px-2 ${getGradeColor(rc.overallGrade)}`}
                              >
                                {rc.overallGrade || "-"}
                              </Badge>
                              {rc.status === "published" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                >
                                  <CheckCircle
                                    className="w-3 h-3 mr-0.5"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">Published</span>
                                </Badge>
                              )}
                              {rc.status === "finalized" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/30 dark:bg-primary/5 dark:text-primary/70 dark:border-primary/30"
                                >
                                  <FileCheck
                                    className="w-3 h-3 mr-0.5"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">Finalized</span>
                                </Badge>
                              )}
                              {rc.status === "draft" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
                                >
                                  <Clock
                                    className="w-3 h-3 mr-0.5"
                                    aria-hidden="true"
                                  />
                                  <span className="sr-only">Draft</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("position")}
                                data-testid="sort-position"
                              >
                                <div className="flex items-center">
                                  Pos
                                  {getSortIcon("position")}
                                </div>
                              </TableHead>
                              <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("studentName")}
                                data-testid="sort-name"
                              >
                                <div className="flex items-center">
                                  Student
                                  {getSortIcon("studentName")}
                                </div>
                              </TableHead>
                              <TableHead>Username</TableHead>
                              <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("averagePercentage")}
                                data-testid="sort-average"
                              >
                                <div className="flex items-center">
                                  Average
                                  {getSortIcon("averagePercentage")}
                                </div>
                              </TableHead>
                              <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("overallGrade")}
                                data-testid="sort-grade"
                              >
                                <div className="flex items-center">
                                  Grade
                                  {getSortIcon("overallGrade")}
                                </div>
                              </TableHead>
                              <TableHead
                                className="cursor-pointer select-none"
                                onClick={() => handleSort("status")}
                                data-testid="sort-status"
                              >
                                <div className="flex items-center">
                                  Status
                                  {getSortIcon("status")}
                                </div>
                              </TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedReportCards.map((rc: any) => (
                              <TableRow
                                key={rc.id}
                                data-testid={`row-report-${rc.id}`}
                              >
                                <TableCell className="font-medium">
                                  {rc.position
                                    ? formatPosition(rc.position)
                                    : "-"}{" "}
                                  of{" "}
                                  {rc.totalStudentsInClass ||
                                    reportCards.length}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      {rc.studentPhoto ? (
                                        <AvatarImage
                                          src={rc.studentPhoto}
                                          alt={rc.studentName}
                                        />
                                      ) : null}
                                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {rc.studentName
                                          ?.split(" ")
                                          .map((n: string) => n[0])
                                          .join("")
                                          .substring(0, 2)
                                          .toUpperCase() || (
                                          <User className="w-4 h-4" />
                                        )}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">
                                      {rc.studentName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground font-mono">
                                    {rc.studentUsername || "-"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      (rc.averagePercentage || 0) >= 50
                                        ? "text-green-600 font-semibold"
                                        : "text-red-600 font-semibold"
                                    }
                                  >
                                    {rc.averagePercentage || 0}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={getGradeColor(rc.overallGrade)}
                                  >
                                    {rc.overallGrade || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(rc.status)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleViewReportCard(rc)}
                                    data-testid={`button-view-${rc.id}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Showing {startIndex + 1}-
                            {Math.min(
                              startIndex + itemsPerPage,
                              filteredReportCards.length,
                            )}{" "}
                            of {filteredReportCards.length}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                              className="h-8 w-8"
                              data-testid="pagination-prev"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs sm:text-sm font-medium px-2">
                              {currentPage} / {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setCurrentPage((p) =>
                                  Math.min(totalPages, p + 1),
                                )
                              }
                              disabled={currentPage === totalPages}
                              className="h-8 w-8"
                              data-testid="pagination-next"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reportCards.length > 0 && (
                      <div className="space-y-3">
                        {["A", "B", "C", "D", "E", "F"].map((gradePrefix) => {
                          const count = reportCards.filter((rc: any) =>
                            rc.overallGrade
                              ?.toUpperCase()
                              .startsWith(gradePrefix),
                          ).length;
                          const percentage =
                            reportCards.length > 0
                              ? Math.round((count / reportCards.length) * 100)
                              : 0;
                          return (
                            <div
                              key={gradePrefix}
                              className="flex items-center gap-3"
                            >
                              <Badge
                                className={`w-12 justify-center ${getGradeColor(gradePrefix)}`}
                              >
                                {gradePrefix}
                              </Badge>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4">
                                <div
                                  className={`h-4 rounded-full ${gradePrefix === "A" ? "bg-green-500" : gradePrefix === "B" ? "bg-primary/85" : gradePrefix === "C" ? "bg-yellow-500" : gradePrefix === "D" || gradePrefix === "E" ? "bg-orange-500" : "bg-red-500"}`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm w-12 text-right">
                                {count} ({percentage}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Status Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statistics && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-500" />
                            Draft
                          </span>
                          <span className="font-medium">
                            {statistics.draftCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            Finalized
                          </span>
                          <span className="font-medium">
                            {statistics.finalizedCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Send className="w-4 h-4 text-green-500" />
                            Published
                          </span>
                          <span className="font-medium">
                            {statistics.publishedCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* View Report Card Dialog - Fully Responsive for all screen sizes */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent
          className="w-[98vw] sm:w-[95vw] md:w-[90vw] lg:w-[85vw] max-w-5xl max-h-[85dvh] sm:max-h-[88dvh] md:max-h-[90dvh] p-0 flex flex-col overflow-hidden"
          style={{ margin: "auto" }}
        >
          <DialogHeader className="px-3 py-2 sm:px-4 sm:py-3 border-b shrink-0 bg-background">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">Report Card Preview</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm truncate mt-0.5">
                  {fullReportCard?.studentName} - {fullReportCard?.className} -{" "}
                  {fullReportCard?.termName}
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
                    {/* Status Badge */}
                    {fullReportCard.status === "draft" && (
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 text-xs"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Draft
                      </Badge>
                    )}
                    {fullReportCard.status === "finalized" && (
                      <Badge
                        variant="outline"
                        className="bg-primary/5 text-primary border-primary/30 dark:bg-primary/5 dark:text-primary/70 dark:border-primary/30 text-xs"
                      >
                        <FileCheck className="w-3 h-3 mr-1" />
                        Awaiting Approval
                      </Badge>
                    )}
                    {fullReportCard.status === "published" && (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Published
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {fullReportCard.status === "draft"
                        ? "Editing enabled"
                        : fullReportCard.status === "finalized"
                          ? "Awaiting admin approval"
                          : "Visible to students and parents"}
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
                          {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={handleDownloadAsPDF}
                          data-testid="menu-export-pdf"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleDownloadAsImage}
                          data-testid="menu-export-image"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export as Image
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Refresh Scores */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        autoPopulateMutation.mutate(fullReportCard.id)
                      }
                      disabled={
                        autoPopulateMutation.isPending ||
                        fullReportCard.status !== "draft"
                      }
                      aria-label="Refresh scores"
                      data-testid="button-refresh-scores"
                    >
                      {autoPopulateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>

                    {/* Status Change Actions */}
                    {fullReportCard.status === "draft" && (
                      <Button
                        onClick={() =>
                          updateStatusMutation.mutate({
                            reportCardId: fullReportCard.id,
                            status: "finalized",
                            classId: selectedClass,
                            termId: selectedTerm,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        size="sm"
                        className="text-xs sm:text-sm h-9"
                        data-testid="button-finalize"
                      >
                        <Send className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Finalize</span>
                      </Button>
                    )}
                    {fullReportCard.status === "finalized" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            reportCardId: fullReportCard.id,
                            status: "draft",
                            classId: selectedClass,
                            termId: selectedTerm,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        className="text-xs sm:text-sm h-9 text-amber-600 hover:text-amber-700"
                        data-testid="button-revert-draft"
                      >
                        <Undo2 className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">
                          Revert to Draft
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Report Card - Uses native overflow for better mobile support */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div
                  ref={reportCardRef}
                  className="p-2 sm:p-3 md:p-4 bg-background"
                >
                  {/* Professional Report Card Component */}
                  <ProfessionalReportCard
                    reportCard={{
                      id: fullReportCard.id,
                      studentId: fullReportCard.studentId,
                      studentName: fullReportCard.studentName,
                      studentPhoto: fullReportCard.studentPhoto,
                      admissionNumber:
                        fullReportCard.admissionNumber ||
                        fullReportCard.studentUsername,
                      className: fullReportCard.className,
                      department: fullReportCard.department,
                      isSSS: fullReportCard.isSSS,
                      termName: fullReportCard.termName,
                      academicSession:
                        fullReportCard.academicSession ||
                        fullReportCard.sessionYear ||
                        "2024/2025",
                      averagePercentage: fullReportCard.averagePercentage || 0,
                      overallGrade: fullReportCard.overallGrade || "-",
                      position: fullReportCard.position || 0,
                      totalStudentsInClass:
                        fullReportCard.totalStudentsInClass || 0,
                      totalScore: fullReportCard.totalScore,
                      items: fullReportCard.items || [],
                      teacherRemarks: fullReportCard.teacherRemarks,
                      principalRemarks: fullReportCard.principalRemarks,
                      status: fullReportCard.status,
                      generatedAt: fullReportCard.generatedAt,
                      teacherSignatureUrl: fullReportCard.teacherSignatureUrl,
                      teacherSignedAt: fullReportCard.teacherSignedAt,
                      teacherSignedBy: fullReportCard.teacherSignedBy,
                      principalSignatureUrl:
                        fullReportCard.principalSignatureUrl,
                      principalSignedAt: fullReportCard.principalSignedAt,
                      principalSignedBy: fullReportCard.principalSignedBy,
                      classStatistics: {
                        highestScore: statistics?.classHighest || 0,
                        lowestScore: statistics?.classLowest || 0,
                        classAverage: statistics?.classAverage || 0,
                        totalStudents: fullReportCard.totalStudentsInClass || 0,
                      },
                      attendance: {
                        timesSchoolOpened: 0,
                        timesPresent: 0,
                        timesAbsent: 0,
                        attendancePercentage: 0,
                      },
                      affectiveTraits: fullReportCard.affectiveTraits || {
                        punctuality: 0,
                        neatness: 0,
                        attentiveness: 0,
                        teamwork: 0,
                        leadership: 0,
                        assignments: 0,
                        classParticipation: 0,
                      },
                      psychomotorSkills: fullReportCard.psychomotorSkills || {
                        sports: 0,
                        handwriting: 0,
                        musicalSkills: 0,
                        creativity: 0,
                      },
                    }}
                    testWeight={testWeight}
                    examWeight={examWeight}
                    onEditSubject={(item) =>
                      handleOverrideScore(item as ReportCardItem)
                    }
                    onSaveRemarks={(teacher, principal) => {
                      // Determine edit permissions based on role
                      // Admin and SuperAdmin can edit teacher remarks
                      // ONLY Admin (not SuperAdmin) can edit principal remarks
                      const classInfo = classes.find(
                        (c: any) => c.id === Number(selectedClass),
                      );
                      const isPrincipal = user?.role?.toLowerCase() === "admin";
                      const canEditTeacher =
                        isAdmin || classInfo?.classTeacherId === user?.id;
                      const canEditPrincipal = isPrincipal;

                      // Only send the fields the user is authorized to edit
                      const payload: {
                        reportCardId: number;
                        teacherRemarks?: string;
                        principalRemarks?: string;
                      } = {
                        reportCardId: fullReportCard.id,
                      };
                      if (canEditTeacher) {
                        payload.teacherRemarks = teacher;
                      }
                      if (canEditPrincipal) {
                        payload.principalRemarks = principal;
                      }

                      updateRemarksMutation.mutate(payload);
                    }}
                    onSaveSkills={async (skills: any) => {
                      await saveSkillsMutation.mutateAsync({
                        reportCardId: fullReportCard.id,
                        skills,
                      });
                    }}
                    canEditTeacherRemarks={
                      fullReportCard.status === "draft" &&
                      (isAdmin ||
                        classes.find((c: any) => c.id === Number(selectedClass))
                          ?.classTeacherId === user?.id)
                    }
                    canEditPrincipalRemarks={
                      fullReportCard.status === "draft" &&
                      user?.role?.toLowerCase() === "admin"
                    }
                    canEditSkills={
                      (fullReportCard.status === "draft" ||
                        fullReportCard.status === "teacher_signed") &&
                      (isAdmin ||
                        classes.find((c: any) => c.id === Number(selectedClass))
                          ?.classTeacherId === user?.id)
                    }
                    onGenerateDefaultComments={async () => {
                      const response = await apiRequest(
                        "GET",
                        `/api/reports/${fullReportCard.id}/default-comments`,
                      );
                      if (!response.ok)
                        throw new Error("Failed to generate comments");
                      return await response.json();
                    }}
                    isLoading={updateRemarksMutation.isPending}
                    isFullReportReady={
                      !loadingFullReport &&
                      !fetchingFullReport &&
                      !!fullReportCard
                    }
                    hideActionButtons={true}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[200px]">
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Failed to load report card details
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Score Dialog — shared with admin, clean UI with optimistic updates */}
      <EditScoreDialog
        open={isOverrideDialogOpen}
        onOpenChange={setIsOverrideDialogOpen}
        item={selectedItem}
        reportCardQueryKey={["/api/reports", selectedReportCard?.id, "full"]}
        gradingConfig={gradingConfig}
        showRemarks={true}
        onSaveSuccess={(serverData) => {
          // Keep the class-term list in sync (position, averages) after a score override
          if (serverData.reportCardTotals?.position !== undefined) {
            queryClient.setQueryData(
              ["/api/reports/class-term", selectedClass, selectedTerm],
              (old: any) => {
                if (!old || !Array.isArray(old)) return old;
                return old.map((rc: any) =>
                  rc.id === selectedReportCard?.id
                    ? {
                        ...rc,
                        averagePercentage:
                          serverData.reportCardTotals?.averagePercentage ??
                          rc.averagePercentage,
                        overallGrade:
                          serverData.reportCardTotals?.overallGrade ??
                          rc.overallGrade,
                        position:
                          serverData.reportCardTotals?.position ?? rc.position,
                      }
                    : rc,
                );
              },
            );
          }
        }}
      />

      {/* Hidden Bailey's Style Template for Export/Print */}
      {fullReportCard && isViewDialogOpen && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">
          <BaileysReportTemplate
            ref={baileysTemplateRef}
            reportCard={{
              studentName: fullReportCard.studentName,
              admissionNumber:
                fullReportCard.admissionNumber ||
                fullReportCard.studentUsername ||
                "N/A",
              className: fullReportCard.className,
              classArm: fullReportCard.classArm,
              department: fullReportCard.department,
              isSSS: fullReportCard.isSSS,
              termName: fullReportCard.termName,
              academicSession:
                fullReportCard.academicSession ||
                fullReportCard.sessionYear ||
                "2024/2025",
              averagePercentage: fullReportCard.averagePercentage || 0,
              overallGrade: fullReportCard.overallGrade || "-",
              position: fullReportCard.position || 0,
              totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
              items: (fullReportCard.items || []).map((item: any) => ({
                subjectName: item.subjectName,
                testScore: item.testScore ?? item.testWeightedScore ?? null,
                examScore: item.examScore ?? item.examWeightedScore ?? null,
                obtainedMarks: item.obtainedMarks ?? item.totalScore ?? 0,
                grade: item.grade || "-",
                remarks: item.remarks || item.teacherRemarks || "",
                subjectPosition: item.subjectPosition || null,
              })),
              teacherRemarks: fullReportCard.teacherRemarks,
              principalRemarks: fullReportCard.principalRemarks,
              attendance: {
                timesSchoolOpened: 0,
                timesPresent: 0,
                timesAbsent: 0,
              },
              studentPhoto: fullReportCard.studentPhoto,
              teacherSignatureUrl: fullReportCard.teacherSignatureUrl || null,
              principalSignatureUrl:
                fullReportCard.principalSignatureUrl || null,
              teacherName: fullReportCard.teacherName || "",
              principalName: fullReportCard.principalName || "",
              gender: fullReportCard.gender || "",
              dateOfBirth: fullReportCard.dateOfBirth
                ? format(new Date(fullReportCard.dateOfBirth), "dd-MMM-yyyy")
                : "",
              age: calculateAge(fullReportCard.dateOfBirth),
              dateIssued: new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              affectiveTraits: fullReportCard.affectiveTraits || {
                punctuality: 0,
                neatness: 0,
                attentiveness: 0,
                teamwork: 0,
                leadership: 0,
                assignments: 0,
                classParticipation: 0,
              },
              psychomotorSkills: fullReportCard.psychomotorSkills || {
                sports: 0,
                handwriting: 0,
                musicalSkills: 0,
                creativity: 0,
              },
            }}
            testWeight={testWeight}
            examWeight={examWeight}
          />
        </div>
      )}
    </div>
  );
}
