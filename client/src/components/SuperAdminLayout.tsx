import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Settings,
  User,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building,
  DollarSign,
  MessageSquare,
  FileText,
  Activity,
  LifeBuoy,
  Terminal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import schoolLogo from '@assets/1000025432-removebg-preview (1)_1757796555126.png';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderSearch } from '@/components/HeaderSearch';

interface SuperAdminLayoutProps {
  children: ReactNode;
}
import { useQuery } from "@tanstack/react-query";

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolLogo?: string;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Qualitative Education & Moral Excellence";
  const schoolLogoUrl = settings?.schoolLogo || schoolLogo;

  useEffect(() => {
    const savedState = localStorage.getItem('superadmin-sidebar-collapsed');
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('superadmin-sidebar-collapsed', String(newState));
  };

  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section) 
        : [...prev, section]
    );
  };

  interface NavItem {
    label: string;
    path?: string;
    icon: any;
    children?: { label: string; path: string }[];
  }

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      path: "/portal/superadmin",
      icon: LayoutDashboard,
    },
    {
      label: "User Management",
      icon: Users,
      children: [
        { label: "All Users", path: "/portal/superadmin/all-users" },
        { label: "Admins", path: "/portal/superadmin/admins" },
        { label: "Roles & Permissions", path: "/portal/superadmin/users/roles" },
        { label: "User Access Control", path: "/portal/superadmin/users/access-control" },
      ],
    },
    {
      label: "System Architecture",
      icon: Building,
      children: [
        { label: "Departments Setup", path: "/portal/superadmin/placeholder?page=departments" },
        { label: "Sessions & Terms", path: "/portal/superadmin/placeholder?page=sessions" },
        { label: "Promotion Rules", path: "/portal/superadmin/placeholder?page=promotions" },
        { label: "Grading Structure", path: "/portal/superadmin/placeholder?page=grading" },
      ],
    },
    {
      label: "Financial Policies",
      icon: DollarSign,
      children: [
        { label: "Fee Structure", path: "/portal/superadmin/placeholder?page=fees" },
        { label: "Fee Categories", path: "/portal/superadmin/placeholder?page=fee-categories" },
        { label: "Discounts & Waivers", path: "/portal/superadmin/placeholder?page=discounts" },
        { label: "Payment Gateway", path: "/portal/superadmin/placeholder?page=gateway" },
      ],
    },
    {
      label: "Communication Setup",
      icon: MessageSquare,
      children: [
        { label: "SMS Configuration", path: "/portal/superadmin/placeholder?page=sms" },
        { label: "Email Configuration", path: "/portal/superadmin/placeholder?page=email" },
        { label: "Notification Rules", path: "/portal/superadmin/placeholder?page=notifications" },
        { label: "Message Templates", path: "/portal/superadmin/placeholder?page=templates" },
      ],
    },
    {
      label: "System Settings",
      icon: Settings,
      children: [
        { label: "General Configuration", path: "/portal/superadmin/settings" },
        { label: "Authentication", path: "/portal/superadmin/settings/authentication" },
        { label: "Security Policies", path: "/portal/superadmin/settings/security" },
        { label: "Branding & Theme", path: "/portal/superadmin/settings/branding" },
        { label: "Integrations", path: "/portal/superadmin/settings/integrations" },
        { label: "Backup & Restore", path: "/portal/superadmin/settings/backup" },
        { label: "API & Access Tokens (Advanced)", path: "/portal/superadmin/settings/api" },
      ],
    },
    {
      label: "Security & Audit",
      icon: Activity,
      children: [
        { label: "Recovery Tools", path: "/portal/superadmin/recovery-tools" },
        { label: "System Logs", path: "/portal/superadmin/logs" },
        { label: "Login History", path: "/portal/superadmin/placeholder?page=login-history" },
        { label: "Activity Tracking", path: "/portal/superadmin/placeholder?page=activity" },
        { label: "Error Logs", path: "/portal/superadmin/placeholder?page=errors" },
        { label: "Access Violations", path: "/portal/superadmin/placeholder?page=violations" },
      ],
    },
    {
      label: "Developer Tools",
      icon: Terminal,
      children: [
        { label: "Database Schema", path: "/portal/superadmin/placeholder?page=schema" },
        { label: "API Playground", path: "/portal/superadmin/placeholder?page=api" },
        { label: "Webhooks", path: "/portal/superadmin/placeholder?page=webhooks" },
        { label: "Environment Variables", path: "/portal/superadmin/placeholder?page=environment" },
      ],
    },
    {
      label: "Account",
      icon: User,
      children: [
        { label: "Profile", path: "/portal/superadmin/profile" },
        { label: "Change Password", path: "/portal/superadmin/placeholder?page=password" },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/portal/superadmin") {
      return location === path;
    }
    return location === path || location.startsWith(path + '/');
  };

  // Reusable Sidebar Content Component aligned with PortalLayout
  const SidebarContent = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => {
    const isChildActive = (children?: { label: string; path: string }[]) => {
      return children?.some(child => isActive(child.path)) ?? false;
    };
    
    // Handle navigation with immediate sidebar close
    const handleNavigation = (path: string) => {
      onNavigate?.();
      navigate(path);
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 h-[100px] flex items-center border-b border-gray-200 dark:border-gray-700 px-4 bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-900">
          <div className={`flex items-center w-full transition-all duration-300 ease-in-out ${collapsed ? 'justify-center' : 'space-x-3'}`}>
            <img 
              src={schoolLogoUrl} 
              alt={`${schoolName} Logo`} 
              className={`${collapsed ? 'h-10 w-10' : 'h-16 w-16'} object-contain transition-all duration-300 ease-in-out drop-shadow-md`}
            />
            {!collapsed && (
              <div className="transition-all duration-300 ease-in-out opacity-100 min-w-0 flex-1">
                <h1 className="font-bold text-base lg:text-lg bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent truncate leading-tight">{schoolName}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">{schoolMotto}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mt-0.5 text-left">Super Admin Portal</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`flex-1 min-h-0 p-3 space-y-1.5 transition-all duration-300 ease-in-out ${collapsed ? 'px-2' : ''} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedSections.includes(item.label);
            const childActive = isChildActive(item.children);
            const navItemActive = item.path ? isActive(item.path) : childActive;

            if (hasChildren) {
              return (
                <div key={item.label} className="space-y-0.5">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (collapsed) {
                        if (item.children?.[0]) {
                          handleNavigation(item.children![0].path);
                        }
                      } else {
                        // Exclusive dropdown behavior (Accordion style)
                        if (isExpanded) {
                          setExpandedSections(prev => prev.filter(s => s !== item.label));
                        } else {
                          setExpandedSections([item.label]);
                        }
                      }
                    }}
                    className={`w-full text-sm font-semibold rounded-xl ${
                      collapsed ? 'justify-center px-2' : 'justify-start px-3'
                    } ${
                      childActive 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:text-blue-700 dark:hover:text-blue-300'
                    } transition-all duration-300 ease-in-out`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`h-4 w-4 transition-all duration-300 ease-in-out ${collapsed ? '' : 'mr-3'}`} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left opacity-100 transition-opacity duration-300 ease-in-out">{item.label}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </Button>
                  {!collapsed && isExpanded && (
                    <div className="space-y-1 ml-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      {item.children?.map((child) => (
                        <button
                          key={child.path}
                          type="button"
                          onClick={() => handleNavigation(child.path)}
                          className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full text-left ${
                            isActive(child.path)
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30' 
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => item.path && handleNavigation(item.path)}
                className={`flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-in-out w-full ${
                  navItemActive 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30 scale-105' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:text-blue-700 dark:hover:text-blue-300 hover:scale-102'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 transition-all duration-300 ease-in-out" />
                {!collapsed && <span className="transition-opacity duration-300 ease-in-out">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout button at the bottom */}
        <div className={`mt-auto p-3 border-t border-gray-200 dark:border-gray-700 ${collapsed ? 'px-2' : ''}`}>
          <button
            key="logout"
            type="button"
            onClick={() => {
              onNavigate?.();
              handleLogout();
            }}
            className={`flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-in-out w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300`}
            data-testid="nav-logout"
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className={`h-4 w-4 transition-all duration-300 ease-in-out text-red-600 dark:text-red-400`} />
            {!collapsed && <span className="transition-opacity duration-300 ease-in-out">Logout</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex">
      {!isMobile && (
        <div className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-900 shadow-xl border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 transition-all duration-300 ease-in-out`}>
          <SidebarContent collapsed={sidebarCollapsed} />
          <div className={`absolute bottom-6 ${sidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-4'}`}>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSidebar}
              className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-white dark:bg-gray-800 hover:scale-105"
              data-testid="button-toggle-sidebar"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md h-[100px] flex items-center px-4 sm:px-5 md:px-6">
          <div className="flex justify-between items-center gap-2 sm:gap-3 w-full max-w-7xl mx-auto">
            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 flex-1 min-w-0">
              {isMobile && (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="md:hidden h-9 w-9 flex-shrink-0 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-700"
                      data-testid="button-mobile-menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 bg-white dark:bg-gray-900">
                    <div className="h-full overflow-y-auto">
                      <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <div className="flex flex-col ml-2 min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent leading-tight">
                  {schoolName}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm truncate font-medium">
                  {schoolMotto}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3 flex-shrink-0">
              <ThemeToggle />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 rounded-full px-2 sm:px-3 py-1.5 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 outline-none group">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-white dark:ring-gray-800 group-hover:ring-blue-100 dark:group-hover:ring-blue-900 transition-all">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs sm:text-sm font-bold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start min-w-0">
                      <span className="text-xs sm:text-sm font-semibold truncate max-w-[100px] lg:max-w-none text-gray-700 dark:text-gray-300" data-testid="text-username">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">Super Admin</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-gray-900 dark:text-gray-100">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs leading-none text-gray-500 dark:text-gray-400">superadmin@treasurehome.com</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                  <DropdownMenuItem onClick={() => navigate("/portal/superadmin/profile")} className="p-2.5 cursor-pointer focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300 rounded-lg mx-1 transition-colors">
                    <User className="mr-2.5 h-4 w-4" />
                    <span>My Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/portal/superadmin/settings")} className="p-2.5 cursor-pointer focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300 rounded-lg mx-1 transition-colors">
                    <Settings className="mr-2.5 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/portal/superadmin/logs")} className="p-2.5 cursor-pointer focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300 rounded-lg mx-1 transition-colors">
                    <Activity className="mr-2.5 h-4 w-4" />
                    <span>Activity Log</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                  <DropdownMenuItem onClick={handleLogout} className="p-2.5 cursor-pointer focus:bg-red-50 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 rounded-lg mx-1 transition-colors font-medium">
                    <LogOut className="mr-2.5 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
