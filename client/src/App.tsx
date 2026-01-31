import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ROLE_IDS } from "@/lib/roles";
import { MinimalRouteFallback } from "@/components/ui/skeletons";
import { StudentPortalShell, TeacherPortalShell, AdminPortalShell, ParentPortalShell } from "@/components/layout/PortalShells";
import { SuperAdminLayoutWrapper } from "@/components/layout/SuperAdminLayoutWrapper";

// Public pages
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Gallery from "@/pages/Gallery";
import Admissions from "@/pages/Admissions";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import JobVacancy from "@/pages/JobVacancy";

// Portal components - lazy loaded
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
const SubjectsManagement = lazy(() => import("@/pages/portal/SubjectsManagement"));
const UnifiedSubjectAssignment = lazy(() => import("@/pages/portal/UnifiedSubjectAssignment"));
const AssignSubjectTeachers = lazy(() => import("@/pages/portal/AssignSubjectTeachers"));
const ProfileOnboarding = lazy(() => import("@/pages/ProfileOnboarding"));
const SuperAdminSecurityPolicies = lazy(() => import("@/pages/portal/SuperAdminSecurityPolicies"));
const SuperAdminBrandingTheme = lazy(() => import("@/pages/portal/SuperAdminBrandingTheme"));
const SuperAdminIntegrations = lazy(() => import("@/pages/portal/SuperAdminIntegrations"));
const SuperAdminBackupRestore = lazy(() => import("@/pages/portal/SuperAdminBackupRestore"));
const SuperAdminApiAccess = lazy(() => import("@/pages/portal/SuperAdminApiAccess"));

function Router() {
  return (
    <Suspense fallback={<MinimalRouteFallback />}>
      <Switch>
        {/* Public pages */}
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/admissions" component={Admissions} />
        <Route path="/job-vacancy" component={JobVacancy} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Super Admin Portal Routes */}
        <Route path="/portal/superadmin">
          <SuperAdminLayoutWrapper><SuperAdminDashboard /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/admins">
          <SuperAdminLayoutWrapper><SuperAdminManagement /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/logs">
          <SuperAdminLayoutWrapper><SuperAdminLogs /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/recovery-tools">
          <SuperAdminLayoutWrapper><AdminRecoveryTools /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings">
          <SuperAdminLayoutWrapper><SuperAdminSettings /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/profile">
          <SuperAdminLayoutWrapper><SuperAdminProfile /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/all-users">
          <SuperAdminLayoutWrapper><SuperAdminAllUsers /></SuperAdminLayoutWrapper>
        </Route>
        
        {/* System Settings Sub-routes */}
        <Route path="/portal/superadmin/settings/security">
          <SuperAdminLayoutWrapper><SuperAdminSecurityPolicies /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings/branding">
          <SuperAdminLayoutWrapper><SuperAdminBrandingTheme /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings/integrations">
          <SuperAdminLayoutWrapper><SuperAdminIntegrations /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings/backup">
          <SuperAdminLayoutWrapper><SuperAdminBackupRestore /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings/api">
          <SuperAdminLayoutWrapper><SuperAdminApiAccess /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/settings/authentication">
          <SuperAdminLayoutWrapper><SuperAdminAuthenticationSettings /></SuperAdminLayoutWrapper>
        </Route>

        {/* User Management Placeholders */}
        <Route path="/portal/superadmin/users/students">
          <SuperAdminLayoutWrapper>
            <SuperAdminPlaceholder title="Student Management" category="Users" description="Manage all student accounts" />
          </SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/users/teachers">
          <SuperAdminLayoutWrapper>
            <SuperAdminPlaceholder title="Teacher Management" category="Users" description="Manage all teacher accounts" />
          </SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/users/parents">
          <SuperAdminLayoutWrapper>
            <SuperAdminPlaceholder title="Parent Management" category="Users" description="Manage all parent accounts" />
          </SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/users/roles">
          <SuperAdminLayoutWrapper><SuperAdminRolesPermissions /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/users/access-control">
          <SuperAdminLayoutWrapper><SuperAdminUserAccessControl /></SuperAdminLayoutWrapper>
        </Route>

        {/* Academics Placeholders */}
        <Route path="/portal/superadmin/academics/classes">
          <SuperAdminLayoutWrapper><SuperAdminPlaceholder title="Classes" category="Academics" /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/academics/subjects">
          <SuperAdminLayoutWrapper><SuperAdminPlaceholder title="Subjects" category="Academics" /></SuperAdminLayoutWrapper>
        </Route>

        {/* Subject Manager (Core Features) */}
        <Route path="/portal/superadmin/subject-manager/subjects">
          <SuperAdminLayoutWrapper><SubjectsManagement /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/subject-manager/unified-assignment">
          <SuperAdminLayoutWrapper><UnifiedSubjectAssignment /></SuperAdminLayoutWrapper>
        </Route>
        <Route path="/portal/superadmin/subject-manager/assign-teachers">
          <SuperAdminLayoutWrapper><AssignSubjectTeachers /></SuperAdminLayoutWrapper>
        </Route>

        {/* Portals Shells */}
        <Route path="/portal/student/*"><StudentPortalShell /></Route>
        <Route path="/portal/teacher/*"><TeacherPortalShell /></Route>
        <Route path="/portal/admin/*"><AdminPortalShell /></Route>
        <Route path="/portal/parent/*"><ParentPortalShell /></Route>
        
        <Route path="/portal/onboarding" component={ProfileOnboarding} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
