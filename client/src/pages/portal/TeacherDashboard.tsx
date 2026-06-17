import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Users, ClipboardList, UserCheck, Bell, MessageSquare, TrendingUp, Clock, ClipboardCheck, GraduationCap, AlertCircle } from 'lucide-react';
import { DashboardHeader, GradientStatCard, QuickAction } from "@/components/shared";
import ProfileIncompleteBanner from '@/components/ProfileIncompleteBanner';
import { Link, useLocation } from 'wouter';
import { useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { TeacherDashboardSkeleton } from '@/components/ui/page-skeletons';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useLoginSuccess } from '@/hooks/use-login-success';


// Component for displaying recent exam result card
function RecentExamResultCard({ exam, index }: { exam: any, index: number }) {
  const { data: examResults = [], isLoading } = useQuery({
    queryKey: [`/api/exam-results/exam/${exam.id}`],
    enabled: !!exam.id,
  });

  const results = examResults as any[];
  const totalSubmissions = results.length;
  const averageScore = totalSubmissions > 0 
    ? Math.round((results.reduce((sum: number, r: any) => sum + (r.score || r.marksObtained || 0), 0) / totalSubmissions))
    : 0;

  const examDate = new Date(exam.date || exam.createdAt).toLocaleDateString();

  if (isLoading) {
    return (
      <Card className="overflow-visible" data-testid={`exam-result-loading-${index}`}>
        <CardContent className="p-4">
          <div className="animate-pulse flex-1">
            <div className="h-4 bg-muted rounded mb-2"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card 
      className="overflow-visible"
      data-testid={`card-exam-result-${index}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight mb-1" data-testid={`text-exam-name-${index}`}>
              {exam.name}
            </h4>
            <p className="text-xs text-muted-foreground" data-testid={`text-exam-details-${index}`}>
              {exam.subjectName || 'Subject'} • {examDate}
            </p>
          </div>
          <Badge 
            variant={exam.isPublished ? "default" : "outline"} 
            className="text-xs flex-shrink-0" 
            data-testid={`badge-status-${index}`}
          >
            {exam.isPublished ? 'Published' : 'Unpublished'}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between gap-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Badge 
              variant={totalSubmissions > 0 ? "default" : "secondary"} 
              className="text-xs" 
              data-testid={`badge-submission-count-${index}`}
            >
              {totalSubmissions} submissions
            </Badge>
            {totalSubmissions > 0 && (
              <span className="text-xs text-primary font-medium" data-testid={`text-exam-average-${index}`}>
                {averageScore}% avg
              </span>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            asChild
            data-testid={`button-view-exam-results-${index}`}
          >
            <Link href={`/portal/teacher/results/exam/${exam.id}`}>
              View Results
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  useLoginSuccess();

  // Check teacher profile status
  const { data: profileStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/teacher/profile/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teacher/profile/status');
      return await response.json();
    },
    enabled: !!user
  });

  // Fetch dashboard data from SCOPED API endpoints - only teacher's assigned data
  // Use scoped endpoint for teacher's assigned classes only
  const { data: myClasses = [], isLoading: classesLoading } = useQuery({
    queryKey: ['/api/teacher/my-classes'],
    enabled: !!user,
  });

  // Use scoped endpoint for teacher's assigned subjects only
  const { data: mySubjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/teacher/my-subjects'],
    enabled: !!user,
  });

  // Use scoped endpoint for students in teacher's assigned classes only
  const { data: myStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['/api/teacher/my-all-students'],
    enabled: !!user,
  });

  // Exams endpoint already filters for teachers (returns only created/assigned exams)
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ['/api/exams'],
    enabled: !!user,
  });

  const { data: pendingGradingTasks = [], isLoading: gradingTasksLoading } = useQuery({
    queryKey: ['/api/grading-tasks'],
    enabled: !!user,
  });

  // Get teacher dashboard stats from scoped endpoint
  const { data: dashboardStats } = useQuery<{ totalStudents?: number; totalClasses?: number }>({
    queryKey: ['/api/teacher/my-dashboard-stats'],
    enabled: !!user,
  });

  const { data: teacherProfile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['/api/teacher/profile/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/teacher/profile/me');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch profile');
      }
      const data = await response.json();
      return data;
    },
    enabled: !!user, // Always fetch - endpoint returns synthetic profile for new teachers
    staleTime: 0,
    gcTime: 0,
    retry: 2,
    retryDelay: 1000
  });

  // Subscribe to exams table for realtime exam updates
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Teacher Dashboard: Exam update received', event.eventType);
    }
  });

  // Subscribe to grading tasks for realtime pending grades updates
  useSocketIORealtime({
    table: 'grading_tasks',
    queryKey: ['/api/grading-tasks'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Teacher Dashboard: Grading task update received', event.eventType);
    }
  });

  // Subscribe to teacher's classes for realtime updates
  useSocketIORealtime({
    table: 'teacher_class_assignments',
    queryKey: ['/api/teacher/my-classes'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Teacher Dashboard: Assignment update received', event.eventType);
      // Also refresh stats and students when assignments change
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/my-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/my-all-students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/my-subjects'] });
    }
  });

  // Subscribe to exam sessions for live exam monitoring
  useSocketIORealtime({
    table: 'exam_sessions',
    queryKey: ['/api/exam-sessions'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Teacher Dashboard: Exam session update received', event.eventType);
      // Also refresh grading tasks and exams when sessions change
      queryClient.invalidateQueries({ queryKey: ['/api/grading-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
    }
  });

  // Show profile completion banner if incomplete, but don't redirect
  useEffect(() => {
    if (!statusLoading && profileStatus) {
      // Profile status updated
    }
  }, [profileStatus, statusLoading, teacherProfile, profileLoading, profileError]);

  // Profile data effect
  useEffect(() => {
    if (teacherProfile) {
      // Profile data available
    }
  }, [teacherProfile]);

  if (!user) {
    return <div>Please log in to access the teacher dashboard.</div>;
  }
  
  // Show contextual skeleton during initial data loading
  if (statusLoading || profileLoading || classesLoading || examsLoading) {
    return <TeacherDashboardSkeleton />;
  }
  const isLoading = classesLoading || studentsLoading || examsLoading || gradingTasksLoading;

  // Teacher's assigned classes from scoped endpoint (limit to first 3 for dashboard display)
  const teacherClasses = (myClasses as any[]).slice(0, 3);

  // Get recent exams created by this teacher (limit to 5 for dashboard)
  const recentExams = (exams as any[])
    .filter((exam: any) => exam.createdBy === user.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Calculate statistics from scoped data (prefer server-side stats if available)
  const totalStudents = dashboardStats?.totalStudents ?? (myStudents as any[]).length;
  const totalClasses = dashboardStats?.totalClasses ?? (myClasses as any[]).length;
  const pendingGradesCount = (pendingGradingTasks as any[]).length;

  return (
    <>
      {/* Profile Completion Notice */}
      {!statusLoading && profileStatus && !profileStatus.profileCompleted && (
        <ProfileIncompleteBanner
          message="Complete your profile to unlock: Exams, Grading, Attendance, and more."
          percentage={profileStatus.percentage}
          profilePath="/portal/teacher/profile"
        />
      )}

      {/* Teacher Role Header - Clean Welcome */}
      <DashboardHeader
        name={user.lastName}
        subtitle="Ready to inspire minds today?"
        icon={GraduationCap}
        data-testid="teacher-role-header"
      />


      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up">
        <GradientStatCard
          label="Total Students"
          value={isLoading ? 0 : totalStudents}
          sublabel="Across all classes"
          icon={Users}
          iconGradient="from-primary/85 to-primary"
          glowColor="from-primary/10 to-transparent"
          textGradient="from-primary to-primary/90"
          loading={isLoading}
          data-testid="stat-total-students"
        />
        <GradientStatCard
          label="Classes"
          value={isLoading ? 0 : totalClasses}
          sublabel="Teaching assignments"
          icon={BookOpen}
          iconGradient="from-emerald-500 to-teal-600"
          glowColor="from-emerald-500/10 to-transparent"
          textGradient="from-emerald-600 to-teal-600"
          loading={isLoading}
          data-testid="stat-classes"
        />
        <GradientStatCard
          label="Total Exams"
          value={isLoading ? 0 : (exams as any[]).filter((e: any) => e.createdBy === user.id).length}
          sublabel="Exams created"
          icon={ClipboardList}
          iconGradient="from-purple-500 to-violet-600"
          glowColor="from-purple-500/10 to-transparent"
          textGradient="from-purple-600 to-violet-600"
          loading={isLoading}
          data-testid="stat-total-exams"
        />
        <GradientStatCard
          label="Pending Grades"
          value={isLoading ? 0 : pendingGradesCount}
          sublabel="Awaiting review"
          icon={MessageSquare}
          iconGradient="from-orange-500 to-red-600"
          glowColor="from-orange-500/10 to-transparent"
          textGradient="from-orange-600 to-red-600"
          loading={isLoading}
          data-testid="stat-pending-grades"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6">
        {/* Quick Actions - Fully Responsive */}
        <Card>
          <CardHeader className="p-4 sm:p-5 md:p-6">
            <CardTitle className="flex items-center text-sm sm:text-base">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <QuickAction title="Create Exam" icon={ClipboardList} href="/portal/teacher/exams" />
              <QuickAction title="Take Attendance" icon={UserCheck} href="/portal/teacher/attendance" />
              <QuickAction title="Create Announcement" icon={Bell} href="/portal/announcements" />
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Recent Exam Results - New Section */}
      {recentExams.length > 0 && (
        <Card className="mt-6 shadow-sm border border-border" data-testid="card-recent-exam-results">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Recent Exam Results</span>
            </CardTitle>
            <Button variant="outline" size="sm" asChild data-testid="button-see-all-exams">
              <Link href="/portal/teacher/recent-exam-results">
                See All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExams.map((exam: any, index: number) => (
                <RecentExamResultCard key={exam.id} exam={exam} index={index} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}