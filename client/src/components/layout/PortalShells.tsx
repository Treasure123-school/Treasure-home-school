import { lazy, Suspense } from 'react';
import { Switch, Route, useLocation } from 'wouter';
import PortalLayout from './PortalLayout';
import { useAuth } from '@/lib/auth';
import { PortalLayoutSkeleton } from '@/components/ui/skeletons';
import { MinimalLoadingFallback } from '@/components/ui/page-skeletons';

const StudentDashboard = lazy(() => import('@/pages/portal/StudentDashboard'));
const StudentGrades = lazy(() => import('@/pages/portal/StudentGrades'));
const StudentAnnouncements = lazy(() => import('@/pages/portal/StudentAnnouncements'));
const StudentAttendance = lazy(() => import('@/pages/portal/StudentAttendance'));
const StudentMessages = lazy(() => import('@/pages/portal/StudentMessages'));
const StudentProfile = lazy(() => import('@/pages/portal/StudentProfile'));
const StudentExams = lazy(() => import('@/pages/portal/StudentExams'));
const StudentExamResults = lazy(() => import('@/pages/portal/StudentExamResults'));
const StudentStudyResources = lazy(() => import('@/pages/portal/StudentStudyResources'));
const StudentReportCard = lazy(() => import('@/pages/portal/StudentReportCard'));
const StudentSubjects = lazy(() => import('@/pages/portal/StudentSubjects'));
const PortalGallery = lazy(() => import('@/pages/portal/Gallery'));
const PortalComingSoon = lazy(() => import('@/pages/portal/PortalComingSoon'));

const TeacherDashboard = lazy(() => import('@/pages/portal/TeacherDashboard'));
const TeacherProfile = lazy(() => import('@/pages/portal/TeacherProfile'));
const TeacherProfileAssignmentDashboard = lazy(() => import('@/pages/portal/TeacherProfileAssignmentDashboard'));
const TeacherGradingQueue = lazy(() => import('@/pages/portal/TeacherGradingQueue'));
const TeacherClassResults = lazy(() => import('@/pages/portal/TeacherClassResults'));
const TeacherExamResults = lazy(() => import('@/pages/portal/TeacherExamResults'));
const ExamManagement = lazy(() => import('@/pages/portal/ExamManagement'));
const CreateExam = lazy(() => import('@/pages/portal/CreateExam'));
const TeacherExamAnalytics = lazy(() => import('@/pages/portal/TeacherExamAnalytics'));
const TeacherReportCards = lazy(() => import('@/pages/portal/TeacherReportCards'));
const TeacherRecentExamResults = lazy(() => import('@/pages/portal/TeacherRecentExamResults'));
const ExamReports = lazy(() => import('@/pages/portal/ExamReports'));

const AdminDashboard = lazy(() => import('@/pages/portal/AdminDashboard'));
const VacancyManagement = lazy(() => import('@/pages/portal/VacancyManagement'));
const UserManagement = lazy(() => import('@/pages/portal/UserManagement'));
const AuditLogs = lazy(() => import('@/pages/portal/AuditLogs'));
const ProfileCompletionMonitoring = lazy(() => import('@/pages/portal/ProfileCompletionMonitoring'));
const StudentManagement = lazy(() => import('@/pages/portal/StudentManagement'));
const TeachersManagement = lazy(() => import('@/pages/portal/TeachersManagement'));
const TeacherProfileVerification = lazy(() => import('@/pages/portal/TeacherProfileVerification'));
const ClassesManagement = lazy(() => import('@/pages/portal/ClassesManagement'));
const SubjectsManagement = lazy(() => import('@/pages/portal/SubjectsManagement'));
const StudentSubjectAssignment = lazy(() => import('@/pages/portal/StudentSubjectAssignment'));
const TeacherAssignmentManagement = lazy(() => import('@/pages/portal/TeacherAssignmentManagement'));
const AnnouncementsManagement = lazy(() => import('@/pages/portal/AnnouncementsManagement'));
const ReportsManagement = lazy(() => import('@/pages/portal/ReportsManagement'));
const PerformanceMonitoring = lazy(() => import('@/pages/portal/PerformanceMonitoring'));
const HomepageManagement = lazy(() => import('@/pages/portal/HomepageManagement'));
const AcademicTermsManagement = lazy(() => import('@/pages/portal/AcademicTermsManagement'));
const SettingsManagement = lazy(() => import('@/pages/portal/SettingsManagement'));
const AdminExamOverview = lazy(() => import('@/pages/portal/AdminExamOverview'));
const ExamSessions = lazy(() => import('@/pages/portal/ExamSessions'));
const UnifiedSubjectAssignment = lazy(() => import('@/pages/portal/UnifiedSubjectAssignment'));
const AssignSubjectTeachers = lazy(() => import('@/pages/portal/AssignSubjectTeachers'));
const AdminResultPublishing = lazy(() => import('@/pages/portal/AdminResultPublishing'));
const AdminRecoveryTools = lazy(() => import('@/pages/portal/AdminRecoveryTools'));
const AdminProfile = lazy(() => import('@/pages/portal/AdminProfile'));
const ReportCommentTemplates = lazy(() => import('@/pages/portal/ReportCommentTemplates'));

const ParentDashboard = lazy(() => import('@/pages/portal/ParentDashboard'));
const ParentReportCards = lazy(() => import('@/pages/portal/ParentReportCards'));

export function StudentPortalShell() {
  return <PortalShell role="student" />;
}

export function TeacherPortalShell() {
  return <PortalShell role="teacher" />;
}

export function AdminPortalShell() {
  return <PortalShell role="admin" />;
}

export function ParentPortalShell() {
  return <PortalShell role="parent" />;
}

function PortalShell({ role }: { role: 'student' | 'teacher' | 'admin' | 'parent' }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading || !user) return <PortalLayoutSkeleton />;
  
  const userName = user.lastName;
  const userInitials = `${user.firstName[0]}${user.lastName[0]}`;
  
  return (
    <PortalLayout userRole={role} userName={userName} userInitials={userInitials}>
      <Suspense fallback={<MinimalLoadingFallback />}>
        {role === 'student' && (
          <Switch>
            <Route path="/portal/student" component={StudentDashboard} />
            <Route path="/portal/student/exam-results" component={StudentExamResults} />
            <Route path="/portal/student/grades" component={StudentGrades} />
            <Route path="/portal/student/announcements" component={StudentAnnouncements} />
            <Route path="/portal/student/attendance" component={StudentAttendance} />
            <Route path="/portal/student/messages" component={StudentMessages} />
            <Route path="/portal/student/report-card" component={StudentReportCard} />
            <Route path="/portal/student/profile" component={StudentProfile} />
            <Route path="/portal/student/gallery" component={PortalGallery} />
            <Route path="/portal/student/study-resources" component={StudentStudyResources} />
            <Route path="/portal/student/subjects" component={StudentSubjects} />
            <Route path="/portal/student/*" component={PortalComingSoon} />
          </Switch>
        )}
        {role === 'teacher' && (
          <Switch>
            <Route path="/portal/teacher" component={TeacherDashboard} />
            <Route path="/portal/teacher/profile" component={TeacherProfile} />
            <Route path="/portal/teacher/profile-assignments" component={TeacherProfileAssignmentDashboard} />
            <Route path="/portal/teacher/coming-soon" component={PortalComingSoon} />
            <Route path="/portal/teacher/grading-queue" component={TeacherGradingQueue} />
            <Route path="/portal/teacher/results/class/:classId" component={TeacherClassResults} />
            <Route path="/portal/teacher/results/exam/:examId" component={TeacherExamResults} />
            <Route path="/portal/teacher/exams/create" component={CreateExam} />
            <Route path="/portal/teacher/exams/manage" component={ExamManagement} />
            <Route path="/portal/teacher/exams" component={ExamManagement} />
            <Route path="/portal/teacher/exam-analytics" component={TeacherExamAnalytics} />
            <Route path="/portal/teacher/report-cards" component={TeacherReportCards} />
            <Route path="/portal/teacher/recent-exam-results" component={TeacherRecentExamResults} />
            <Route path="/portal/teacher/*" component={PortalComingSoon} />
          </Switch>
        )}
        {role === 'admin' && (
          <Switch>
            <Route path="/portal/admin" component={AdminDashboard} />
            <Route path="/portal/admin/job-vacancies" component={VacancyManagement} />
            <Route path="/portal/admin/users" component={UserManagement} />
            <Route path="/portal/admin/audit-logs" component={AuditLogs} />
            <Route path="/portal/admin/profile-completion" component={ProfileCompletionMonitoring} />
            <Route path="/portal/admin/students" component={StudentManagement} />
            <Route path="/portal/admin/teachers" component={TeachersManagement} />
            <Route path="/portal/admin/teacher-verification" component={TeacherProfileVerification} />
            <Route path="/portal/admin/classes" component={ClassesManagement} />
            <Route path="/portal/admin/subjects" component={SubjectsManagement} />
            <Route path="/portal/admin/student-subjects" component={StudentSubjectAssignment} />
            <Route path="/portal/admin/teacher-assignments" component={TeacherAssignmentManagement} />
            <Route path="/portal/admin/announcements" component={AnnouncementsManagement} />
            <Route path="/portal/admin/reports" component={ReportsManagement} />
            <Route path="/portal/admin/performance" component={PerformanceMonitoring} />
            <Route path="/portal/admin/homepage-management" component={HomepageManagement} />
            <Route path="/portal/admin/gallery" component={PortalGallery} />
            <Route path="/portal/admin/academic-terms" component={AcademicTermsManagement} />
            <Route path="/portal/admin/settings" component={SettingsManagement} />
            <Route path="/portal/admin/recovery-tools" component={AdminRecoveryTools} />
            <Route path="/portal/admin/exams" component={AdminExamOverview} />
            <Route path="/portal/exam-sessions" component={ExamSessions} />
            <Route path="/portal/exam-reports" component={ExamReports} />
            <Route path="/portal/admin/subject-manager/subjects" component={SubjectsManagement} />
            <Route path="/portal/admin/subject-manager/unified-assignment" component={UnifiedSubjectAssignment} />
            <Route path="/portal/admin/subject-manager/assign-teachers" component={AssignSubjectTeachers} />
            <Route path="/portal/admin/results/exams" component={PortalComingSoon} />
            <Route path="/portal/admin/results/ca" component={PortalComingSoon} />
            <Route path="/portal/admin/results/grades" component={PortalComingSoon} />
            <Route path="/portal/admin/results/processing" component={PortalComingSoon} />
            <Route path="/portal/admin/results/publishing" component={AdminResultPublishing} />
            <Route path="/portal/admin/academics/timetable" component={PortalComingSoon} />
            <Route path="/portal/admin/academics/curriculum" component={PortalComingSoon} />
            <Route path="/portal/admin/profile" component={AdminProfile} />
            <Route path="/portal/admin/comment-templates" component={ReportCommentTemplates} />
            <Route path="/portal/admin/*" component={PortalComingSoon} />
          </Switch>
        )}
        {role === 'parent' && (
          <Switch>
            <Route path="/portal/parent" component={ParentDashboard} />
            <Route path="/portal/parent/reports" component={ParentReportCards} />
            <Route path="/portal/parent/*" component={PortalComingSoon} />
          </Switch>
        )}
      </Suspense>
    </PortalLayout>
  );
}
