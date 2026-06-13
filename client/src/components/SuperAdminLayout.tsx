import { ReactNode, useState, useEffect, useCallback, useTransition } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Settings, User, LogOut, Menu, ChevronDown,
  Building, DollarSign, MessageSquare, FileText, Activity, Terminal,
  CreditCard, BookOpen, Globe, ImageIcon, Newspaper, HelpCircle,
  Inbox, GraduationCap, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useUserActivityTracker } from "@/hooks/useUserActivityTracker";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderSearch } from "@/components/HeaderSearch";
import schoolLogo from "@assets/1000025432-removebg-preview (1)_1757796555126.png";

// ── Constants ────────────────────────────────────────────────────────────────
const SIDEBAR_EXPANDED_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 60;
const HEADER_HEIGHT = 52;

// ── Types ────────────────────────────────────────────────────────────────────
interface NavChild {
  label: string;
  path: string;
  icon?: any;
}

interface NavItem {
  label: string;
  path?: string;
  icon: any;
  children?: NavChild[];
}

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolLogo?: string;
}

// ── Nav definitions ──────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/portal/superadmin", icon: LayoutDashboard },
  {
    label: "User Management", icon: Users,
    children: [
      { label: "All Users",           path: "/portal/superadmin/all-users" },
      { label: "Admins",              path: "/portal/superadmin/admins" },
      { label: "Roles & Permissions", path: "/portal/superadmin/users/roles" },
      { label: "User Access Control", path: "/portal/superadmin/users/access-control" },
    ],
  },
  {
    label: "System Architecture", icon: Building,
    children: [
      { label: "Departments Setup", path: "/portal/superadmin/placeholder?page=departments" },
      { label: "Sessions & Terms",   path: "/portal/superadmin/placeholder?page=sessions" },
      { label: "Promotion Rules",    path: "/portal/superadmin/placeholder?page=promotions" },
      { label: "Grading Structure",  path: "/portal/superadmin/placeholder?page=grading" },
    ],
  },
  {
    label: "Financial Policies", icon: DollarSign,
    children: [
      { label: "Exam Payments",    path: "/portal/superadmin/exam-payments", icon: CreditCard },
      { label: "Fee Structure",    path: "/portal/superadmin/placeholder?page=fees" },
      { label: "Fee Categories",   path: "/portal/superadmin/placeholder?page=fee-categories" },
      { label: "Discounts & Waivers", path: "/portal/superadmin/placeholder?page=discounts" },
      { label: "Payment Gateway",  path: "/portal/superadmin/placeholder?page=gateway" },
    ],
  },
  {
    label: "Communication Setup", icon: MessageSquare,
    children: [
      { label: "SMS Configuration",   path: "/portal/superadmin/placeholder?page=sms" },
      { label: "Email Configuration", path: "/portal/superadmin/placeholder?page=email" },
      { label: "Notification Rules",  path: "/portal/superadmin/placeholder?page=notifications" },
      { label: "Message Templates",   path: "/portal/superadmin/placeholder?page=templates" },
    ],
  },
  {
    label: "Curriculum Library", icon: BookOpen,
    children: [
      { label: "Curriculum Templates", path: "/portal/superadmin/curriculum-templates" },
      { label: "Lesson Note Library",  path: "/portal/superadmin/lesson-note-library" },
    ],
  },
  {
    label: "System Settings", icon: Settings,
    children: [
      { label: "General Configuration",        path: "/portal/superadmin/settings" },
      { label: "AI Configuration",             path: "/portal/superadmin/settings/ai-config" },
      { label: "Authentication",               path: "/portal/superadmin/settings/authentication" },
      { label: "Security Policies",            path: "/portal/superadmin/settings/security" },
      { label: "Branding & Theme",             path: "/portal/superadmin/settings/branding" },
      { label: "Integrations",                 path: "/portal/superadmin/settings/integrations" },
      { label: "Backup & Restore",             path: "/portal/superadmin/settings/backup" },
      { label: "API & Access Tokens",          path: "/portal/superadmin/settings/api" },
    ],
  },
  {
    label: "Security & Audit", icon: Activity,
    children: [
      { label: "Recovery Tools",    path: "/portal/superadmin/recovery-tools" },
      { label: "System Logs",       path: "/portal/superadmin/logs" },
      { label: "Login History",     path: "/portal/superadmin/placeholder?page=login-history" },
      { label: "Activity Tracking", path: "/portal/superadmin/placeholder?page=activity" },
      { label: "Error Logs",        path: "/portal/superadmin/placeholder?page=errors" },
      { label: "Access Violations", path: "/portal/superadmin/placeholder?page=violations" },
    ],
  },
  {
    label: "Developer Tools", icon: Terminal,
    children: [
      { label: "Database Schema",    path: "/portal/superadmin/placeholder?page=schema" },
      { label: "API Playground",     path: "/portal/superadmin/placeholder?page=api" },
      { label: "Webhooks",           path: "/portal/superadmin/placeholder?page=webhooks" },
      { label: "Environment Variables", path: "/portal/superadmin/placeholder?page=environment" },
    ],
  },
  {
    label: "Website Management", icon: Globe,
    children: [
      { label: "Homepage",      path: "/portal/superadmin/homepage-management", icon: ImageIcon },
      { label: "Gallery",       path: "/portal/superadmin/website/gallery",     icon: ImageIcon },
      { label: "News & Blog",   path: "/portal/superadmin/website/news",        icon: Newspaper },
      { label: "FAQ",           path: "/portal/superadmin/website/faq",         icon: HelpCircle },
      { label: "About Page",    path: "/portal/superadmin/website/about",       icon: BookOpen },
      { label: "Contact Inbox", path: "/portal/superadmin/website/contact-inbox", icon: Inbox },
      { label: "Admissions",    path: "/portal/superadmin/website/admissions",  icon: GraduationCap },
    ],
  },
  {
    label: "Account", icon: User,
    children: [
      { label: "Profile",         path: "/portal/superadmin/profile" },
      { label: "Change Password", path: "/portal/superadmin/placeholder?page=password" },
    ],
  },
];

// Routes that auto-expand a section
const ROUTE_TO_SECTION: Record<string, string> = {
  "/portal/superadmin/curriculum-templates":         "Curriculum Library",
  "/portal/superadmin/lesson-note-library":          "Curriculum Library",
  "/portal/superadmin/settings":                     "System Settings",
  "/portal/superadmin/settings/authentication":      "System Settings",
  "/portal/superadmin/settings/security":            "System Settings",
  "/portal/superadmin/settings/branding":            "System Settings",
  "/portal/superadmin/settings/integrations":        "System Settings",
  "/portal/superadmin/settings/ai-config":           "System Settings",
  "/portal/superadmin/integrations":                 "System Settings",
  "/portal/superadmin/all-users":                    "User Management",
  "/portal/superadmin/admins":                       "User Management",
  "/portal/superadmin/recovery-tools":               "Security & Audit",
  "/portal/superadmin/logs":                         "Security & Audit",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [, startTransition] = useTransition();

  const [mobileMenuOpen, setMobileMenuOpen]   = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSection, setOpenSection]          = useState<string | null>(null);

  useUserActivityTracker(true);

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 5000,
  });

  const schoolName   = settings?.schoolName  || "";
  const schoolMotto  = settings?.schoolMotto  || "";
  const schoolLogoUrl = settings?.schoolLogo || schoolLogo;

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem("superadmin-sidebar-collapsed");
    if (saved !== null) setSidebarCollapsed(saved === "true");
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("superadmin-sidebar-collapsed", String(next));
  };

  // Auto-expand the section that owns the current route
  useEffect(() => {
    const section = ROUTE_TO_SECTION[location];
    if (section) setOpenSection(section);
  }, [location]);

  const goTo = useCallback((path: string, onNavigate?: () => void) => {
    onNavigate?.();
    startTransition(() => navigate(path));
  }, [navigate, startTransition]);

  const isActive = (path: string) =>
    path === "/portal/superadmin"
      ? location === path
      : location === path || location.startsWith(path + "/");

  const isGroupActive = (children: NavChild[]) =>
    children.some((c) => isActive(c.path));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const labelCls = (collapsed: boolean) =>
    `overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out ${
      collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[160px]"
    }`;

  // ── Sidebar nav renderer ─────────────────────────────────────────────────
  const renderNavItems = (collapsed: boolean, onNavigate?: () => void) =>
    NAV_ITEMS.map((item) => {
      const Icon = item.icon;

      // ── Group ──
      if (item.children) {
        const groupActive = isGroupActive(item.children);
        const isOpen      = !collapsed && openSection === item.label;

        return (
          <Collapsible
            key={item.label}
            open={isOpen}
            onOpenChange={(open) => {
              if (!collapsed) setOpenSection(open ? item.label : null);
            }}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (collapsed) {
                    setSidebarCollapsed(false);
                    localStorage.setItem("superadmin-sidebar-collapsed", "false");
                    setOpenSection(item.label);
                  }
                }}
                className={`flex items-center w-full h-9 rounded-lg transition-colors duration-200 ease-in-out ${
                  collapsed ? "justify-center px-0" : "px-2.5 gap-2.5"
                } ${groupActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`nav-group-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={`flex-1 text-left text-[13px] font-medium ${labelCls(collapsed)}`}>
                  {item.label}
                </span>
                <ChevronDown
                  className={`flex-shrink-0 transition-[opacity,width,height,transform] duration-300 ease-in-out ${
                    collapsed ? "opacity-0 w-0 h-0 overflow-hidden" : "opacity-100 w-3.5 h-3.5"
                  } ${isOpen ? "rotate-180" : "rotate-0"}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="ml-3 mt-0.5 mb-0.5 pl-2.5 border-l border-border space-y-0.5">
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const active    = location === child.path;
                  return (
                    <button
                      key={child.path}
                      type="button"
                      onClick={() => goTo(child.path, onNavigate)}
                      className={`flex items-center gap-2 w-full px-2 h-8 rounded-md text-[12.5px] font-medium transition-colors duration-150 ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`nav-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                      title={child.label}
                    >
                      {ChildIcon && <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                      <span className="truncate flex-1 text-left">{child.label}</span>
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      }

      // ── Leaf item ──
      const active = item.path ? isActive(item.path) : false;
      return (
        <button
          key={item.path}
          type="button"
          onClick={() => item.path && goTo(item.path, onNavigate)}
          title={collapsed ? item.label : undefined}
          className={`flex items-center w-full h-9 rounded-lg transition-colors duration-200 ease-in-out ${
            collapsed ? "justify-center px-0" : "px-2.5 gap-2.5"
          } ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className={`text-[13px] font-medium flex-1 text-left ${labelCls(collapsed)}`}>
            {item.label}
          </span>
        </button>
      );
    });

  const userInitials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  const userName     = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{ height: HEADER_HEIGHT }}
        className="sticky top-0 z-50 bg-background border-b border-border flex items-center flex-shrink-0"
        data-testid="portal-header"
      >
        {/* Brand section — width mirrors the sidebar on desktop */}
        {!isMobile ? (
          <div
            style={{
              width:    sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
              minWidth: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
            }}
            className="flex-shrink-0 h-full flex items-center gap-2.5 px-3 border-r border-border transition-[width,min-width] duration-300 ease-in-out overflow-hidden"
          >
            <img
              src={schoolLogoUrl}
              alt="School logo"
              className={`object-contain flex-shrink-0 transition-all duration-300 ease-in-out ${
                sidebarCollapsed ? "h-7 w-7" : "h-8 w-8"
              }`}
            />
            <div
              className={`min-w-0 flex-1 transition-opacity duration-300 ease-in-out ${
                sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <p className="text-[13px] font-bold text-primary leading-tight truncate">{schoolName}</p>
              <p className="text-[10px] text-muted-foreground truncate">Super Admin Portal</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg" data-testid="button-mobile-menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 [&>button]:hidden">
                <div className="flex flex-col h-full bg-background">
                  <div className="flex-shrink-0 h-14 flex items-center gap-3 px-4 border-b border-border">
                    <img src={schoolLogoUrl} alt="School logo" className="h-9 w-9 object-contain flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary leading-tight truncate">{schoolName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{schoolMotto}</p>
                    </div>
                  </div>
                  <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {renderNavItems(false, () => setMobileMenuOpen(false))}
                  </nav>
                  <div className="flex-shrink-0 border-t border-border p-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-2.5 h-9 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      data-testid="nav-logout"
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <img src={schoolLogoUrl} alt="logo" className="h-7 w-7 object-contain flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-primary leading-tight truncate">{schoolName}</p>
              {schoolMotto && <p className="text-[9px] text-muted-foreground uppercase tracking-wide truncate leading-tight">{schoolMotto}</p>}
            </div>
          </div>
        )}

        {/* Search (desktop only) */}
        {!isMobile && (
          <div className="flex-1 min-w-0 px-4">
            <HeaderSearch userRole="superadmin" />
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-1 px-3 ml-auto flex-shrink-0">
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors outline-none"
                data-testid="button-user-menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-xs font-semibold leading-tight text-foreground max-w-[100px] truncate" data-testid="text-username">
                    {userName}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Super Admin</span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 mt-1">
              <DropdownMenuLabel className="font-normal px-3 py-2">
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground">Super Admin Account</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/portal/superadmin/profile")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" /> My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/portal/superadmin/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/portal/superadmin/logs")} className="cursor-pointer">
                <Activity className="mr-2 h-4 w-4" /> Activity Log
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop sidebar */}
        {!isMobile && (
          <aside
            style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
            className="flex-shrink-0 bg-background border-r border-border sticky top-[52px] h-[calc(100vh-52px)] flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden"
            data-testid="desktop-sidebar"
          >
            <div className="flex-shrink-0 h-4" />

            <nav
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              data-testid="sidebar-nav"
            >
              {renderNavItems(sidebarCollapsed)}
            </nav>

            <div className="flex-shrink-0 border-t border-border">
              <button
                onClick={toggleSidebar}
                className={`flex items-center gap-2 w-full px-3 h-10 text-xs text-muted-foreground hover:text-primary-foreground hover:bg-primary transition-all duration-200 ease-in-out ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
                data-testid="button-toggle-sidebar"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4" />
                    <span className="font-medium overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out opacity-100 max-w-[120px]">
                      Collapse
                    </span>
                  </>
                )}
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-x-hidden min-w-0 p-2 sm:p-4 md:p-6">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
