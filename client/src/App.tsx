import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getSharedSocket } from "@/hooks/useSocketIORealtime";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROLE_IDS } from "@/lib/roles";
import { MinimalRouteFallback } from "@/components/ui/skeletons";
import { SyncIndicator } from "@/components/SyncIndicator";
import ScrollToTop from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StudentPortalShell, TeacherPortalShell, AdminPortalShell, ParentPortalShell } from "@/components/layout/PortalShells";
import SuperAdminLayout from "@/components/SuperAdminLayout";

// Public pages - eagerly loaded for instant navigation
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Gallery from "@/pages/Gallery";
import News from "@/pages/News";
import Admissions from "@/pages/Admissions";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import JobVacancy from "@/pages/JobVacancy";
import PaymentCallback from "@/pages/PaymentCallback";

// Super Admin pages - lazy loaded
const SuperAdminDashboard = lazy(() => import("@/pages/portal/SuperAdminDashboard"));
const SuperAdminManagement = lazy(() => import("@/pages/portal/SuperAdminManagement"));
const SuperAdminSettings = lazy(() => import("@/pages/portal/SuperAdminSettings"));
const SuperAdminProfile = lazy(() => import("@/pages/portal/SuperAdminProfile"));
const SuperAdminLogs = lazy(() => import("@/pages/portal/SuperAdminLogs"));
const SuperAdminAllUsers = lazy(() => import("@/pages/portal/SuperAdminAllUsers"));
const SuperAdminRolesPermissions = lazy(() => import("@/pages/portal/SuperAdminRolesPermissions"));
const SuperAdminUserAccessControl = lazy(() => import("@/pages/portal/SuperAdminUserAccessControl"));
const SuperAdminAuthenticationSettings = lazy(() => import("@/pages/portal/SuperAdminAuthenticationSettings"));
const SuperAdminPlaceholder = lazy(() => import("@/pages/portal/SuperAdminPlaceholder"));
const AdminRecoveryTools = lazy(() => import("@/pages/portal/AdminRecoveryTools"));

// Super Admin Subject Manager pages (used in Super Admin routes)
const SubjectsManagement = lazy(() => import("@/pages/portal/SubjectsManagement"));
const UnifiedSubjectAssignment = lazy(() => import("@/pages/portal/UnifiedSubjectAssignment"));
const AssignSubjectTeachers = lazy(() => import("@/pages/portal/AssignSubjectTeachers"));

// Profile Onboarding (used for all authenticated users)
const ProfileOnboarding = lazy(() => import("@/pages/ProfileOnboarding"));

// Real-time updates are now handled by Socket.IO on the backend
function ActivityHeartbeat() {
  const { user, isAuthenticated } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Attempt to emit heartbeat — creates socket if it doesn't exist yet
    const sendHeartbeat = () => {
      try {
        const socket = getSharedSocket();
        if (socket.connected) {
          socket.emit('user:heartbeat');
        }
      } catch {
        // socket not ready yet — connection will fire trackUserConnect on server
      }
    };

    // 1. Connect immediately so the server tracks this user as online right away
    try { getSharedSocket(); } catch { /* ignore */ }

    // 2. Periodic heartbeat every 20s keeps lastActive fresh and status accurate
    intervalRef.current = setInterval(sendHeartbeat, 20000);

    // 3. On socket connect / reconnect: send heartbeat immediately so the user
    //    is marked online again after a network drop without waiting 20s
    let socket: ReturnType<typeof getSharedSocket>;
    try {
      socket = getSharedSocket();
      socket.on('connect', sendHeartbeat);
    } catch { /* ignore */ }

    // 4. Tab visibility: when user switches back to this tab, ping immediately
    const onVisible = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      try {
        const s = getSharedSocket();
        s.off('connect', sendHeartbeat);
      } catch { /* ignore */ }
    };
  }, [isAuthenticated, user]);

  return null;
}

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ActivityHeartbeat />
      {children}
    </>
  );
}
const SuperAdminSecurityPolicies = lazy(() => import("@/pages/portal/SuperAdminSecurityPolicies"));
const SuperAdminBrandingTheme = lazy(() => import("@/pages/portal/SuperAdminBrandingTheme"));
const SuperAdminIntegrations = lazy(() => import("@/pages/portal/SuperAdminIntegrations"));
const SuperAdminBackupRestore = lazy(() => import("@/pages/portal/SuperAdminBackupRestore"));
const SuperAdminApiAccess = lazy(() => import("@/pages/portal/SuperAdminApiAccess"));
const ExamPaymentManagement = lazy(() => import("@/pages/portal/ExamPaymentManagement"));
const SuperAdminCurriculumTemplates = lazy(() => import("@/pages/portal/SuperAdminCurriculumTemplates"));
const HomepageManagement = lazy(() => import("@/pages/portal/HomepageManagement"));
const GalleryManagement = lazy(() => import("@/pages/portal/website/GalleryManagement"));
const NewsManagement = lazy(() => import("@/pages/portal/website/NewsManagement"));
const FaqManagement = lazy(() => import("@/pages/portal/website/FaqManagement"));
const AboutPageManagement = lazy(() => import("@/pages/portal/website/AboutPageManagement"));
const ContactInbox = lazy(() => import("@/pages/portal/website/ContactInbox"));
const AdmissionsManagement = lazy(() => import("@/pages/portal/website/AdmissionsManagement"));

import StudentExams from "@/pages/portal/StudentExams";
const ExamFeePayment = lazy(() => import("@/pages/portal/ExamFeePayment"));
const ChangePasswordPage = lazy(() => import("@/pages/portal/ChangePasswordPage"));
const NotificationsPage = lazy(() => import("@/pages/portal/NotificationsPage"));

function Router() {
  return (
    <Suspense fallback={<MinimalRouteFallback />}>
      <Switch>
        {/* Public pages */}
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/news" component={News} />
        <Route path="/admissions" component={Admissions} />
        <Route path="/job-vacancy" component={JobVacancy} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Payment callback — no auth required, Paystack redirects here after payment */}
        <Route path="/payment/callback" component={PaymentCallback} />

        {/* Super Admin Portal Routes */}
        <Route path="/portal/superadmin">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/admins">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminManagement />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/logs">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLogs />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/recovery-tools">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <AdminRecoveryTools />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminSettings />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/profile">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminProfile />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/all-users">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminAllUsers />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/security">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminSecurityPolicies />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/branding">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminBrandingTheme />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/integrations">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminIntegrations />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/backup">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminBackupRestore />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/api">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminApiAccess />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/authentication">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminAuthenticationSettings />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Users Management Routes */}
        <Route path="/portal/superadmin/users/students">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Student Management" category="Users" description="Manage all student accounts and records" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/users/teachers">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Teacher Management" category="Users" description="Manage all teacher accounts and profiles" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/users/parents">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Parent Management" category="Users" description="Manage all parent/guardian accounts" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/users/roles">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminRolesPermissions />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/users/access-control">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminUserAccessControl />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Academics Routes */}
        <Route path="/portal/superadmin/academics/classes">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Classes & Levels" category="Academics" description="Configure class structure and academic levels" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/academics/subjects">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Subjects" category="Academics" description="Manage academic subjects and curriculum areas" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/academics/timetable">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Timetable" category="Academics" description="Configure school timetable and schedules" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/academics/attendance">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Attendance Setup" category="Academics" description="Configure attendance tracking settings" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/academics/curriculum">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Curriculum" category="Academics" description="Manage curriculum and scheme of work" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Subject Manager Routes */}
        <Route path="/portal/superadmin/subject-manager/subjects">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <SubjectsManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/subject-manager/unified-assignment">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <UnifiedSubjectAssignment />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/subject-manager/assign-teachers">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <AssignSubjectTeachers />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Super Admin Results Routes */}
        <Route path="/portal/superadmin/results/exams">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Exam Setup" category="Results" description="Configure exam types and settings" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/results/ca">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Continuous Assessment" category="Results" description="Configure CA rules and weightings" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/results/grades">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Grade Boundaries" category="Results" description="Set grade boundaries and grading scales" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/results/processing">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Result Processing" category="Results" description="Configure result processing rules" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/results/publishing">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Result Publishing" category="Results" description="Control result publication settings" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin School Operations Routes */}
        <Route path="/portal/superadmin/operations/departments">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Departments" category="Operations" description="Manage school departments" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/operations/calendar">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="School Calendar" category="Operations" description="Manage academic calendar and holidays" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/operations/events">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Events & Notices" category="Operations" description="Manage school events and announcements" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/operations/sessions">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Sessions & Terms" category="Operations" description="Configure academic sessions and terms" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/operations/promotions">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Promotion Settings" category="Operations" description="Configure student promotion rules" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Finance Routes */}
        <Route path="/portal/superadmin/finance/fees">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Fees Setup" category="Finance" description="Configure fee structures and amounts" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/finance/payments">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Payment Records" category="Finance" description="View and manage payment records" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/finance/categories">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Fee Categories" category="Finance" description="Manage fee categories and types" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/finance/discounts">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Discounts & Waivers" category="Finance" description="Configure discounts and fee waivers" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/finance/transactions">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Transactions" category="Finance" description="View all financial transactions" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/exam-payments">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <ExamPaymentManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Super Admin Communication Routes */}
        <Route path="/portal/superadmin/communication/sms">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="SMS Settings" category="Communication" description="Configure SMS gateway and templates" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/communication/email">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Email Settings" category="Communication" description="Configure email server and templates" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/communication/notifications">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Notifications" category="Communication" description="Manage notification broadcasts" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/communication/logs">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Messaging Logs" category="Communication" description="View all messaging activity logs" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/communication/templates">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Templates" category="Communication" description="Manage message templates" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Website / Homepage Management */}
        <Route path="/portal/superadmin/homepage-management">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <HomepageManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/gallery">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <GalleryManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/news">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <NewsManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/faq">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <FaqManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/about">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <AboutPageManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/contact-inbox">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <ContactInbox />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/website/admissions">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <AdmissionsManagement />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Super Admin Content Routes */}
        <Route path="/portal/superadmin/content/assignments">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Assignments" category="Content" description="Manage school assignments" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/content/lessons">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Lesson Notes" category="Content" description="Manage lesson notes and materials" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/content/library">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="E-Library" category="Content" description="Manage digital library resources" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/content/files">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="File Manager" category="Content" description="Manage uploaded files and media" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin System Settings Routes */}
        <Route path="/portal/superadmin/settings/security">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Security Policies" category="Settings" description="Configure security policies and rules" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/branding">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Branding" category="Settings" description="Customize school branding and appearance" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/api-keys">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="API Keys" category="Settings" description="Manage API keys and integrations" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/backup">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Backup & Restore" category="Settings" description="Manage data backups and restoration" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/settings/integrations">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Integrations" category="Settings" description="Manage third-party integrations" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Audit Routes */}
        <Route path="/portal/superadmin/audit/login-history">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Login History" category="Audit" description="View user login history and sessions" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/audit/activity">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Activity Tracking" category="Audit" description="Track user activity across the system" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/audit/errors">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Error Logs" category="Audit" description="View system error logs" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/audit/violations">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Access Violations" category="Audit" description="Monitor security violations and attempts" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Support Routes */}
        <Route path="/portal/superadmin/support/requests">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Help Requests" category="Support" description="View and manage help requests" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/support/tickets">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Tickets" category="Support" description="Manage support tickets" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/support/docs">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Documentation" category="Support" description="Access system documentation" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/support/faq">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="FAQ" category="Support" description="Manage frequently asked questions" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Developer Tools Routes */}
        <Route path="/portal/superadmin/developer/schema">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Database Schema" category="Developer" description="View database schema and tables" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/developer/api">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="API Playground" category="Developer" description="Test API endpoints" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/developer/webhooks">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Webhooks" category="Developer" description="Configure webhook integrations" />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/developer/environment">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminPlaceholder title="Environment" category="Developer" description="View environment configuration" />
          </ProtectedRoute>
        </Route>

        {/* Super Admin Account Routes */}
        <Route path="/portal/superadmin/curriculum-templates">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminCurriculumTemplates />
          </ProtectedRoute>
        </Route>

        <Route path="/portal/superadmin/account/password">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <ChangePasswordPage />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/change-password">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <ChangePasswordPage />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/superadmin/notifications">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
            <SuperAdminLayout>
              <NotificationsPage />
            </SuperAdminLayout>
          </ProtectedRoute>
        </Route>

        {/* Profile Onboarding - Available to all authenticated users */}
        <Route path="/portal/onboarding">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT, ROLE_IDS.TEACHER, ROLE_IDS.PARENT, ROLE_IDS.ADMIN]}>
            <ProfileOnboarding />
          </ProtectedRoute>
        </Route>

        {/* Student Exam Fee Payment */}
        <Route path="/portal/student/exam-payment">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT]}>
            <ExamFeePayment />
          </ProtectedRoute>
        </Route>

        {/* Student Portal - Persistent Layout Shell */}
        <Route path="/portal/student/exams/:rest*">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT]}>
            <StudentExams />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/student/exams">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT]}>
            <StudentExams />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/student/*">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT]}>
            <StudentPortalShell />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/student">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.STUDENT]}>
            <StudentPortalShell />
          </ProtectedRoute>
        </Route>

        {/* Teacher Portal - Persistent Layout Shell */}
        <Route path="/portal/teacher/*">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.TEACHER]}>
            <TeacherPortalShell />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/teacher">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.TEACHER]}>
            <TeacherPortalShell />
          </ProtectedRoute>
        </Route>

        {/* Admin Portal - Persistent Layout Shell */}
        <Route path="/portal/admin/*">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.ADMIN]}>
            <AdminPortalShell />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/admin">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.ADMIN]}>
            <AdminPortalShell />
          </ProtectedRoute>
        </Route>

        {/* Parent Portal - Persistent Layout Shell */}
        <Route path="/portal/parent/*">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.PARENT]}>
            <ParentPortalShell />
          </ProtectedRoute>
        </Route>
        <Route path="/portal/parent">
          <ProtectedRoute allowedRoleIds={[ROLE_IDS.PARENT]}>
            <ParentPortalShell />
          </ProtectedRoute>
        </Route>

        {/* Fallback to 404 for non-portal pages */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <RealtimeProvider>
              <ScrollToTop />
              <SyncIndicator />
              <Toaster />
              <Router />
            </RealtimeProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
export default App;