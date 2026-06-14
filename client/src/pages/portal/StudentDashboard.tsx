import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, Trophy, MessageSquare, BookOpen, ClipboardList, Star, FileText, Play, AlertCircle, ChevronRight, Award, Target, Clock, X, ClipboardCheck } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { CircularProgress } from '@/components/ui/circular-progress';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { MiniLineChart } from '@/components/ui/mini-line-chart';
import { StatsCardSkeleton, AnnouncementCardSkeleton, SkeletonTransition, ContentFadeIn, SkeletonShimmer } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentDashboardSkeleton } from '@/components/ui/page-skeletons';
import type { Exam } from '@shared/schema';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useLoginSuccess } from '@/hooks/use-login-success';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import ProfileIncompleteBanner from '@/components/ProfileIncompleteBanner';

export default function StudentDashboard() {
  const { user, updateUser } = useAuth();
  const [, navigate] = useLocation();

  const bannerKey = `profile_banner_dismissed_${user?.id}`;
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    sessionStorage.getItem(bannerKey) === 'true'
  );
  const dismissBanner = () => {
    sessionStorage.setItem(bannerKey, 'true');
    setBannerDismissed(true);
  };
  
  useLoginSuccess();

  if (!user) {
    return <div>Please log in to access the student portal.</div>;
  }
  // Fetch fresh user data to sync AuthContext with database
  const { data: freshUserData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/me');
      return await response.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (freshUserData && freshUserData.id === user.id) {
      updateUser({
        profileCompleted: freshUserData.profileCompleted,
        profileCompletionPercentage: freshUserData.profileCompletionPercentage,
        profileSkipped: freshUserData.profileSkipped,
        phone: freshUserData.phone,
        address: freshUserData.address,
        dateOfBirth: freshUserData.dateOfBirth,
        gender: freshUserData.gender,
        recoveryEmail: freshUserData.recoveryEmail,
      });
    }
  }, [freshUserData, user.id, updateUser]);

  // Completion is computed locally from cached student data — instantly reflects
  // any save, no separate server round-trip needed.
  const profileCompletion = useProfileCompletion();


  const { data: studentData } = useQuery({
    queryKey: ['student', user.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/students/${user.id}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user,
  });

  const { data: examResults, isLoading: isLoadingGrades } = useQuery({
    queryKey: ['examResults', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/exam-results/${user.id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch exam results');
      return response.json();
    }
  });

  const { data: announcements, isLoading: isLoadingAnnouncements } = useQuery({
    queryKey: ['announcements', 'Student'],
    queryFn: async () => {
      const response = await fetch('/api/announcements?role=Student', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch announcements');
      return response.json();
    }
  });

  const { data: attendance, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['/api/student/attendance'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/student/attendance', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch attendance');
      return response.json();
    }
  });

  const { data: classRankData } = useQuery({
    queryKey: ['/api/student/class-rank'],
    queryFn: async () => {
      const response = await fetch('/api/student/class-rank', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch class rank');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: messagesData = [] } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/messages/user/${user!.id}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: exams = [], isLoading: isLoadingExams } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => {
      const response = await fetch('/api/exams', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch exams');
      return response.json();
    }
  });

  const { data: assignmentsData = [] } = useQuery({
    queryKey: ['/api/student/assignments'],
    queryFn: async () => {
      const response = await fetch('/api/student/assignments', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    },
    enabled: !!user,
  });

  // Subscribe to exam results for live grade updates
  useSocketIORealtime({
    table: 'exam_results',
    queryKey: ['examResults', user?.id],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Exam result update received', event.eventType);
    }
  });

  // Subscribe to announcements for live updates
  useSocketIORealtime({
    table: 'announcements',
    queryKey: ['announcements', 'Student'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Announcement update received', event.eventType);
    }
  });

  // Subscribe to attendance for live updates
  useSocketIORealtime({
    table: 'attendance',
    queryKey: ['/api/student/attendance'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Attendance update received', event.eventType);
    }
  });

  // Subscribe to exams for live exam availability updates
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['exams'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Exam update received', event.eventType);
    }
  });

  // Subscribe to report cards for live report card updates
  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/student/report-cards'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Report card update received', event.eventType);
    }
  });

  // Subscribe to assignments for live pending count updates
  useSocketIORealtime({
    table: 'assignments',
    queryKey: ['/api/student/assignments'],
    enabled: !!user,
    onEvent: (event) => {
      console.log('📥 Student Dashboard: Assignment update received', event.eventType);
    }
  });

  const calculateGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    return 'F';
  };

  const getOrdinalSuffix = (n: number): string => {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  };

  const formattedGrades = examResults?.map((result: any) => ({
    subject: result.subjectName || result.subject,
    assessment: result.examType || 'Assessment',
    score: result.score || result.marks || 0,
    maxScore: result.maxScore || result.totalMarks || 100,
    grade: result.grade || calculateGrade(result.score || result.marks),
    date: result.date || result.createdAt
  })) || [];

  // Calculate attendance percentage
  const attendanceStats = attendance?.reduce((stats: any, record: any) => {
    stats.total++;
    if (record.status === 'Present' || record.status === 'present') stats.present++;
    return stats;
  }, { total: 0, present: 0 }) || { total: 0, present: 0 };

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
    : 95;

  // Calculate average score as percentage
  const averageScore = formattedGrades.length > 0
    ? formattedGrades.reduce((sum: number, g: any) => sum + g.score, 0) / formattedGrades.length
    : 0;
  const displayScore = parseFloat(averageScore.toFixed(1));

  // Trend data based on last 6 assessment scores (as percentages)
  const scoreTrendData = formattedGrades.slice(-6).map((g: any) => g.score);
  const hasScoreData = scoreTrendData.length > 0;

  // Pending assignments: active assignments with no submission yet
  const pendingAssignmentsCount = Array.isArray(assignmentsData)
    ? assignmentsData.filter((a: any) => !a.submissionId).length
    : 0;

  // Absent count derived from attendance
  const absentCount = attendanceStats.total - attendanceStats.present;

  // Grade letter for academic average
  const averageGrade = calculateGrade(displayScore);

  // Class position formatted (e.g. "5th")
  const classPositionLabel = classRankData?.rank != null
    ? `${classRankData.rank}${getOrdinalSuffix(classRankData.rank)}`
    : '—';

  // Streak calculation (simple version based on attendance)
  const attendanceImprovement = attendancePercentage >= 90;

  // Show contextual skeleton during initial data loading
  const isInitialLoading = isLoadingGrades && isLoadingAnnouncements && isLoadingAttendance && isLoadingExams;
  
  if (isInitialLoading) {
    return <StudentDashboardSkeleton />;
  }

  return (
    <>
      {/* Profile Completion Banner */}
      {!profileCompletion.isLoading && !profileCompletion.isComplete && !bannerDismissed && (
        <ProfileIncompleteBanner
          message="Complete your profile to unlock exams, report cards, and other academic features."
          percentage={profileCompletion.percentage > 0 ? profileCompletion.percentage : undefined}
          profilePath="/portal/student/profile"
          onDismiss={dismissBanner}
        />
      )}

      {/* Smart Dashboard Welcome Box */}
      <div className="mb-8 bg-gradient-to-r from-primary to-primary/90 rounded-lg p-6 text-white shadow-lg" data-testid="student-dashboard-header">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                Welcome back, {user.lastName}!
              </h1>
              <p className="text-white/70 text-sm">
                Here's what's happening with your academics today
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards — Class Position · Pending Assignments · Academic Average · Attendance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">

        {/* 1 — Class Position */}
        <Card
          className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500"
          data-testid="card-rank"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-yellow-400/15 to-transparent rounded-full -mr-14 -mt-14 pointer-events-none" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class Position</p>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-md">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-extrabold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent leading-none" data-testid="text-class-position">
                {classPositionLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2" data-testid="text-class-rank-detail">
              {classRankData?.rank != null && classRankData?.total != null
                ? `of ${classRankData.total} students`
                : 'No class data yet'}
            </p>
          </CardContent>
        </Card>

        {/* 2 — Pending Assignments */}
        <Link href="/portal/student/assignments">
          <Card
            className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-600 cursor-pointer"
            data-testid="card-pending-assignments"
          >
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-violet-500/15 to-transparent rounded-full -mr-14 -mt-14 pointer-events-none" />
            <CardContent className="p-5 relative z-10">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending Assignments</p>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <AnimatedCounter
                  value={pendingAssignmentsCount}
                  className="text-4xl font-extrabold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent leading-none"
                />
              </div>
              <p className="text-xs mt-2">
                {pendingAssignmentsCount === 0 ? (
                  <span className="text-green-600 font-medium">All caught up!</span>
                ) : pendingAssignmentsCount === 1 ? (
                  <span className="text-orange-500 font-medium">1 awaiting submission</span>
                ) : (
                  <span className="text-orange-500 font-medium">{pendingAssignmentsCount} awaiting submission</span>
                )}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 3 — Academic Average */}
        <Card
          className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-700"
          data-testid="card-gpa"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-primary/15 to-transparent rounded-full -mr-14 -mt-14 pointer-events-none" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Academic Average</p>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-md">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <AnimatedCounter
                value={displayScore}
                suffix="%"
                className="text-4xl font-extrabold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent leading-none"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Grade:{' '}
              <span className={`font-semibold ${
                averageGrade.startsWith('A') ? 'text-green-600' :
                averageGrade.startsWith('B') ? 'text-primary' :
                averageGrade === 'C' ? 'text-yellow-600' : 'text-red-500'
              }`}>
                {averageGrade}
              </span>
            </p>
            {hasScoreData && (
              <div className="mt-3">
                <MiniLineChart data={scoreTrendData} color="#6C63FF" height={36} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4 — Attendance */}
        <Card
          className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-800"
          data-testid="card-attendance"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-emerald-500/15 to-transparent rounded-full -mr-14 -mt-14 pointer-events-none" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
              <div className="flex-shrink-0">
                {isLoadingAttendance ? (
                  <Skeleton className="h-12 w-12 rounded-full" />
                ) : (
                  <CircularProgress
                    value={attendancePercentage}
                    size={52}
                    strokeWidth={5}
                    color="#10b981"
                  />
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <AnimatedCounter
                value={attendancePercentage}
                suffix="%"
                className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent leading-none"
              />
              {attendanceImprovement && (
                <Award className="h-4 w-4 text-emerald-600 mb-0.5" />
              )}
            </div>
            {attendanceStats.total > 0 ? (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Present: {attendanceStats.present}
                </span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  Absent: {absentCount}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No records yet</p>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades */}
        <Card className="shadow-lg border-none animate-in fade-in slide-in-from-left-4 duration-700" data-testid="card-recent-grades">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                Recent Grades
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="hover:bg-primary/10">
                <Link href="/portal/student/grades" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingGrades ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : formattedGrades.length > 0 ? (
              <div className="space-y-3">
                {formattedGrades.slice(0, 4).map((grade: any, index: number) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/50 to-transparent border border-border/50 hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">{grade.subject}</p>
                      <p className="text-xs text-muted-foreground">{grade.assessment}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">
                          {grade.score}/{grade.maxScore}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          grade.grade.startsWith('A') ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                          grade.grade.startsWith('B') ? 'bg-primary/10 dark:bg-primary/5 text-primary dark:text-primary/70' :
                          'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {grade.grade}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No grades available yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Exams */}
        <Card className="shadow-lg border-none animate-in fade-in slide-in-from-right-4 duration-700" data-testid="card-upcoming-exams">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                </div>
                Upcoming Exams
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="hover:bg-purple-500/10">
                <Link href="/portal/student/exams" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingExams ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : exams.filter(exam => exam.isPublished).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No upcoming exams scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exams.filter((exam: Exam) => exam.isPublished).slice(0, 3).map((exam: Exam) => (
                  <div 
                    key={exam.id} 
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-base mb-1">{exam.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(exam.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full inline-block mb-3">
                      Available
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4" />
                        <span>{exam.totalMarks || 60} marks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{exam.timeLimit} min</span>
                      </div>
                    </div>
                    <Link to="/portal/student/exams">
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                        <Play className="w-4 h-4 mr-2" />
                        Start Exam
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Announcements */}
        <Card className="lg:col-span-2 shadow-lg border-none animate-in fade-in slide-in-from-bottom-4 duration-900" data-testid="card-announcements">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                Latest Announcements
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="hover:bg-primary/10">
                <Link href="/portal/student/announcements" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAnnouncements ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 py-3 border-b border-border last:border-0">
                    <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : announcements && announcements.length > 0 ? (
              <div className="divide-y divide-border">
                {announcements.slice(0, 4).map((announcement: any) => {
                  const priority: string = announcement.priority || 'normal';
                  const dotColor =
                    priority === 'urgent'    ? 'bg-red-500' :
                    priority === 'important' ? 'bg-amber-500' :
                    'bg-slate-300 dark:bg-slate-600';
                  return (
                    <div key={announcement.id} className="flex gap-3 py-3 group">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {announcement.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {announcement.content}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(announcement.createdAt || announcement.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No announcements yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer Message */}
      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 text-center animate-in fade-in duration-1000">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Keep attendance above 90% to maintain your rank!
        </p>
      </div>
    </>
  );
}