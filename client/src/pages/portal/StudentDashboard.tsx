import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, Trophy, MessageSquare, BookOpen, ClipboardList, Star, FileText, Play, AlertCircle, ChevronRight, Award, Target, Clock } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useEffect } from 'react';
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

export default function StudentDashboard() {
  const { user, updateUser } = useAuth();
  const [, navigate] = useLocation();
  
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

  const { data: profileStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/student/profile/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/student/profile/status');
      return await response.json();
    },
    enabled: !!user
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

  const calculateGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    return 'F';
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

  // Calculate average GPA
  const averageScore = formattedGrades.length > 0
    ? formattedGrades.reduce((sum: number, g: any) => sum + g.score, 0) / formattedGrades.length
    : 0;
  const gpa = (averageScore / 100 * 4).toFixed(2);

  // Sample GPA trend data (last 6 assessments)
  const gpaTrendData = formattedGrades.slice(-6).map((g: any) => (g.score / 100 * 4));
  const hasGpaData = gpaTrendData.length > 0;

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
      {!statusLoading && profileStatus && !profileStatus.completed && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500" data-testid="profile-incomplete-banner">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1">
              <div className="bg-yellow-100 dark:bg-yellow-900/50 rounded-lg p-1.5 sm:p-2 flex-shrink-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-yellow-800 dark:text-yellow-200">
                  Complete Your Profile
                </h3>
                <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 line-clamp-2 sm:line-clamp-none">
                  Complete it to unlock exams, grades, and study resources.
                  {profileStatus.percentage > 0 && (
                    <span className="ml-1 font-medium">({profileStatus.percentage}% done)</span>
                  )}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/portal/student/profile')}
              variant="default"
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm w-full sm:w-auto text-xs sm:text-sm"
              data-testid="button-complete-profile"
            >
              Complete Profile
            </Button>
          </div>
        </div>
      )}

      {/* Smart Dashboard Welcome Box */}
      <div className="mb-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white shadow-lg" data-testid="student-dashboard-header">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                Welcome back, {user.lastName}!
              </h1>
              <p className="text-blue-100 text-sm">
                Here's what's happening with your academics today
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* GPA Card with Mini Chart */}
        <Card className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="card-gpa">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current GPA</p>
                <div className="flex items-baseline gap-2">
                  <AnimatedCounter 
                    value={parseFloat(gpa)} 
                    className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"
                  />
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            {hasGpaData && <MiniLineChart data={gpaTrendData} color="#6C63FF" height={40} />}
          </CardContent>
        </Card>

        {/* Attendance Card with Circular Progress */}
        <Card className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-700" data-testid="card-attendance">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Attendance</p>
                <div className="flex items-center gap-2">
                  <AnimatedCounter 
                    value={attendancePercentage} 
                    suffix="%" 
                    className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"
                  />
                  {attendancePercentage >= 90 && (
                    <Award className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  ↗ +2% this week
                </p>
              </div>
              <div className="flex-shrink-0">
                {isLoadingAttendance ? (
                  <Skeleton className="h-16 w-16 rounded-full" />
                ) : (
                  <div className="scale-75">
                    <CircularProgress 
                      value={attendancePercentage} 
                      size={80} 
                      strokeWidth={6}
                      color="#10b981"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Rank Card */}
        <Card className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-900" data-testid="card-rank">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Class Rank</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                    5th
                  </span>
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Top 10% of class
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg animate-bounce">
                <Trophy className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages Card */}
        <Card className="relative overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-1000" data-testid="card-messages">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Messages</p>
                <AnimatedCounter 
                  value={3} 
                  className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"
                />
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  3 unread
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <MessageSquare className="h-6 w-6" />
              </div>
            </div>
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
                          grade.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                          grade.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
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
                    <div className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full inline-block mb-3">
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
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
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
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                Latest Announcements
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="hover:bg-blue-500/10">
                <Link href="/portal/student/announcements" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAnnouncements ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : announcements && announcements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.slice(0, 4).map((announcement: any, index: number) => {
                  const colors = [
                    'from-blue-500/10 border-blue-200 dark:border-blue-800/30',
                    'from-purple-500/10 border-purple-200 dark:border-purple-800/30',
                    'from-green-500/10 border-green-200 dark:border-green-800/30',
                    'from-orange-500/10 border-orange-200 dark:border-orange-800/30'
                  ];
                  return (
                    <div 
                      key={announcement.id} 
                      className={`p-4 rounded-xl bg-gradient-to-br ${colors[index % 4]} to-transparent border hover:shadow-md transition-all duration-200`}
                    >
                      <h3 className="font-semibold text-sm mb-2 line-clamp-1">{announcement.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </p>
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