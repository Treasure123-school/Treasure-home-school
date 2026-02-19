import { useLocation } from 'wouter';
import { 
  GraduationCap, Home, Users, Calendar, BookOpen, MessageSquare, User, Settings, 
  Bell, LogOut, ImageIcon, FileText, Menu, ChevronLeft, ChevronRight, ClipboardCheck, 
  ClipboardList, ChevronDown, History, UserCheck, Eye, Briefcase, Shield, Activity,
  Clock, PenTool, CheckSquare, Award, Star, Library, DollarSign, Trophy, HelpCircle,
  Inbox, Megaphone, MessagesSquare, ClipboardPen, BarChart3, FolderOpen, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useEffect, useTransition } from 'react';
import schoolLogo from '@assets/1000025432-removebg-preview (1)_1757796555126.png';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderSearch } from '@/components/HeaderSearch';


import { useQuery } from '@tanstack/react-query';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolLogo?: string;
  favicon?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
}
interface NavGroup {
  type: 'group';
  label: string;
  icon: any;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  items: Array<{
    href: string;
    icon: any;
    label: string;
  }>;
}
type NavigationItem = NavItem | NavGroup;

interface PortalLayoutProps {
  children: React.ReactNode;
  userRole: 'student' | 'teacher' | 'admin' | 'parent';
  userName: string;
  userInitials: string;
}
export default function PortalLayout({ children, userRole, userName, userInitials }: PortalLayoutProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);


  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
  }, []);

  // Save sidebar state to localStorage
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  const getNavigation = () => {
    const baseNav = [
      { name: 'Dashboard', href: `/portal/${userRole}`, icon: Home },
    ];

    switch (userRole) {
      case 'student':
        return [
          ...baseNav,
          { name: 'Profile', href: `/portal/${userRole}/profile`, icon: User },
          {
            type: 'group',
            label: 'Academic',
            icon: GraduationCap,
            isOpen: openMenuKey === 'student-academic',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'student-academic' : null),
            items: [
              { href: `/portal/${userRole}/timetable`, icon: Clock, label: 'Class Schedule' },
              { href: `/portal/${userRole}/subjects`, icon: BookOpen, label: 'Subjects' },
              { href: `/portal/${userRole}/assignments`, icon: ClipboardPen, label: 'Assignments' },
              { href: `/portal/${userRole}/exams`, icon: PenTool, label: 'Exams / Tests' },
              { href: `/portal/${userRole}/grades`, icon: BarChart3, label: 'Gradebook' },
              { href: `/portal/${userRole}/report-card`, icon: FileText, label: 'Report Card' },
            ]
          },
          { name: 'Attendance', href: `/portal/${userRole}/attendance`, icon: Calendar },
          { name: 'Learning Materials', href: `/portal/${userRole}/study-resources`, icon: FolderOpen },
          {
            type: 'group',
            label: 'Communication',
            icon: MessageSquare,
            isOpen: openMenuKey === 'student-communication',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'student-communication' : null),
            items: [
              { href: `/portal/${userRole}/messages`, icon: Inbox, label: 'Messages' },
              { href: `/portal/${userRole}/announcements`, icon: Megaphone, label: 'Announcements' },
              { href: `/portal/${userRole}/forum`, icon: MessagesSquare, label: 'Discussion Forum' },
            ]
          },
          { name: 'Fees & Payments', href: `/portal/${userRole}/fees`, icon: DollarSign },
          { name: 'Library', href: `/portal/${userRole}/library`, icon: Library },
          { name: 'Extracurricular', href: `/portal/${userRole}/extracurricular`, icon: Trophy },
          { name: 'Help & Support', href: `/portal/${userRole}/help`, icon: HelpCircle },
          { name: 'Logout', href: '#logout', icon: LogOut },
        ];
      case 'teacher':
        return [
          ...baseNav,
          { name: 'My Classes', href: `/portal/${userRole}/classes`, icon: Users },
          { name: 'Attendance', href: `/portal/${userRole}/coming-soon`, icon: Calendar },
          { 
            type: 'group',
            label: 'Exam Management',
            icon: ClipboardList,
            isOpen: openMenuKey === 'teacher-exam',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'teacher-exam' : null),
            items: [
              { href: '/portal/teacher/exams', icon: PenTool, label: 'Exam System' },
              { href: '/portal/teacher/grading-queue', icon: CheckSquare, label: 'Grading Queue' },
              { href: '/portal/teacher/exam-analytics', icon: Award, label: 'Exam Analytics' },
            ]
          },
          { name: 'Report Cards', href: `/portal/${userRole}/report-cards`, icon: FileText },
          { name: 'Announcements', href: `/portal/${userRole}/announcements`, icon: MessageSquare },
          { name: 'Messages', href: `/portal/${userRole}/messages`, icon: MessageSquare },
          { name: 'Profile', href: `/portal/${userRole}/profile`, icon: User },
        ];
      case 'admin':
        return [
          ...baseNav,
          {
            type: 'group',
            label: 'Student Management',
            icon: GraduationCap,
            isOpen: openMenuKey === 'admin-students',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-students' : null),
            items: [
              { href: `/portal/${userRole}/students`, icon: Users, label: 'All Students' },
              { href: `/portal/${userRole}/coming-soon?page=enrollment`, icon: UserCheck, label: 'Student Enrollment' },
              { href: `/portal/${userRole}/coming-soon?page=parents`, icon: Users, label: 'Parent Linking' },
              { href: `/portal/${userRole}/coming-soon?page=attendance`, icon: Calendar, label: 'Attendance' },
            ]
          },
          {
            type: 'group',
            label: 'Staff Management',
            icon: Users,
            isOpen: openMenuKey === 'admin-staff',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-staff' : null),
            items: [
              { href: `/portal/${userRole}/teachers`, icon: Users, label: 'Teachers' },
              { href: `/portal/${userRole}/users`, icon: Users, label: 'All Users' },
              { href: `/portal/${userRole}/job-vacancies`, icon: Briefcase, label: 'Job Vacancies' },
              { href: `/portal/${userRole}/profile-completion`, icon: UserCheck, label: 'Profile Verification' },
              { href: `/portal/${userRole}/recovery-tools`, icon: RotateCcw, label: 'Recovery Tools' },
            ]
          },
          {
            type: 'group',
            label: 'Academic Operations',
            icon: BookOpen,
            isOpen: openMenuKey === 'admin-academics',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-academics' : null),
            items: [
              { href: `/portal/${userRole}/classes`, icon: BookOpen, label: 'Classes' },
              { href: `/portal/${userRole}/subjects`, icon: BookOpen, label: 'Subjects' },
              { href: `/portal/${userRole}/subject-manager/unified-assignment`, icon: ClipboardList, label: 'Class Level Assignment' },
              { href: `/portal/${userRole}/subject-assignment`, icon: Users, label: 'Teacher Assignments' },
              { href: `/portal/${userRole}/academic-terms`, icon: Calendar, label: 'Academic Terms' },
              { href: `/portal/${userRole}/coming-soon?page=timetable`, icon: Clock, label: 'Timetable' },
            ]
          },
          {
            type: 'group',
            label: 'Exams & Results',
            icon: ClipboardList,
            isOpen: openMenuKey === 'admin-exams',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-exams' : null),
            items: [
              { href: '/portal/admin/exams', icon: PenTool, label: 'Exam Management' },
              { href: '/portal/admin/results/publishing', icon: Eye, label: 'Result Publishing' },
              { href: `/portal/${userRole}/coming-soon?page=ca`, icon: ClipboardList, label: 'Continuous Assessment' },
              { href: `/portal/${userRole}/coming-soon?page=processing`, icon: Activity, label: 'Result Processing' },
            ]
          },
          {
            type: 'group',
            label: 'Finance Operations',
            icon: DollarSign,
            isOpen: openMenuKey === 'admin-finance',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-finance' : null),
            items: [
              { href: `/portal/${userRole}/coming-soon?page=payments`, icon: DollarSign, label: 'Fee Collection' },
              { href: `/portal/${userRole}/coming-soon?page=records`, icon: FileText, label: 'Payment Records' },
              { href: `/portal/${userRole}/coming-soon?page=outstanding`, icon: Clock, label: 'Outstanding Fees' },
            ]
          },
          {
            type: 'group',
            label: 'School Events',
            icon: Calendar,
            isOpen: openMenuKey === 'admin-events',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-events' : null),
            items: [
              { href: `/portal/${userRole}/coming-soon?page=calendar`, icon: Calendar, label: 'School Calendar' },
              { href: `/portal/${userRole}/coming-soon?page=events`, icon: Bell, label: 'Events & Notices' },
              { href: `/portal/${userRole}/announcements`, icon: Megaphone, label: 'Announcements' },
            ]
          },
          {
            type: 'group',
            label: 'Content Management',
            icon: ImageIcon,
            isOpen: openMenuKey === 'admin-content',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-content' : null),
            items: [
              { href: `/portal/${userRole}/homepage-management`, icon: ImageIcon, label: 'Homepage' },
              { href: `/portal/${userRole}/gallery`, icon: ImageIcon, label: 'Gallery' },
              { href: `/portal/${userRole}/coming-soon?page=assignments`, icon: ClipboardPen, label: 'Assignments' },
              { href: `/portal/${userRole}/coming-soon?page=lessons`, icon: BookOpen, label: 'Lesson Notes' },
              { href: `/portal/${userRole}/coming-soon?page=library`, icon: Library, label: 'E-Library' },
            ]
          },
          {
            type: 'group',
            label: 'Reports',
            icon: FileText,
            isOpen: openMenuKey === 'admin-reports',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-reports' : null),
            items: [
              { href: `/portal/${userRole}/reports`, icon: BarChart3, label: 'Academic Reports' },
              { href: `/portal/${userRole}/performance`, icon: Activity, label: 'Performance Analytics' },
              { href: `/portal/${userRole}/comment-templates`, icon: MessageSquare, label: 'Comment Templates' },
            ]
          },
          { name: 'Settings', href: `/portal/${userRole}/settings`, icon: Settings },
          { name: 'Profile', href: `/portal/${userRole}/profile`, icon: User },
        ];
      case 'parent':
        return [
          ...baseNav,
          { name: 'My Children', href: `/portal/${userRole}/children`, icon: Users },
          { name: 'Report Cards', href: `/portal/${userRole}/reports`, icon: FileText },
          { name: 'Attendance', href: `/portal/${userRole}/attendance`, icon: Calendar },
          { name: 'Grades', href: `/portal/${userRole}/grades`, icon: BookOpen },
          { name: 'Messages', href: `/portal/${userRole}/messages`, icon: MessageSquare },
          { name: 'Profile', href: `/portal/${userRole}/profile`, icon: User },
        ];
      default:
        return baseNav;
    }
  };

  const navigation = getNavigation();
  const isActive = (path: string) => {
    // Exact match for the main dashboard
    if (path === `/portal/${userRole}`) {
      return location === path;
    }
    // For other paths, check if current location starts with the path
    return location === path || location.startsWith(path + '/');
  };

  const getRoleTitle = () => {
    switch (userRole) {
      case 'student': return 'Student Portal';
      case 'teacher': return 'Teacher Portal';
      case 'admin': return 'Admin Portal';
      case 'parent': return 'Parent Portal';
      default: return 'Portal';
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 1000,
    gcTime: 5000,
    refetchInterval: 10000,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Qualitative Education & Moral Excellence";
  const displayLogo = settings?.schoolLogo || schoolLogo;

  useEffect(() => {
    if (settings?.favicon) {
      const faviconUrl = settings.favicon;
      const links = document.querySelectorAll("link[rel*='icon']");
      links.forEach(link => {
        (link as HTMLLinkElement).href = faviconUrl;
      });
      
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = faviconUrl;
        document.head.appendChild(link);
      }
    }
  }, [settings?.favicon]);

  // Reusable Sidebar Content Component with Modern Design
  const SidebarContent = ({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) => {
    const [, navigate] = useLocation();
    const [isPending, startTransition] = useTransition();

    const handleNavigation = (href: string, label: string) => {
      onNavigate?.();
      startTransition(() => navigate(href));
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 h-[100px] flex items-center border-b border-gray-200 dark:border-gray-700 px-4 bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-900">
          <div className={`flex items-center w-full transition-all duration-300 ease-in-out ${collapsed ? 'justify-center' : 'space-x-3'}`}>
            <img 
              src={displayLogo} 
              alt={`${schoolName} Logo`} 
              className={`${collapsed ? 'h-10 w-10' : 'h-16 w-16'} object-contain transition-all duration-300 ease-in-out drop-shadow-md`}
            />
            {!collapsed && (
              <div className="transition-all duration-300 ease-in-out opacity-100 min-w-0 flex-1">
                <h1 className="font-bold text-lg lg:text-xl text-blue-700 dark:text-blue-400 truncate leading-tight">{schoolName}</h1>
                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-semibold tracking-wide uppercase truncate">{schoolMotto}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mt-0.5">{getRoleTitle()}</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`flex-1 min-h-0 p-3 space-y-1.5 transition-all duration-300 ease-in-out ${collapsed ? 'px-2' : ''} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500`}>
          {navigation.map((item) => {
            const Icon = item.icon;
            if ('type' in item && item.type === 'group') {
              return (
                <Collapsible 
                  key={item.label} 
                  open={item.isOpen} 
                  onOpenChange={(open) => item.setIsOpen(open)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`w-full text-sm font-semibold rounded-xl ${
                        collapsed ? 'justify-center px-2' : 'justify-start px-3'
                      } text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 ease-in-out`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`h-4 w-4 transition-all duration-300 ease-in-out ${collapsed ? '' : 'mr-3'}`} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left opacity-100 transition-opacity duration-300 ease-in-out">{item.label}</span>
                          {item.isOpen ? (
                            <ChevronDown className="h-4 w-4 transition-transform" />
                          ) : (
                            <ChevronRight className="h-4 w-4 transition-transform" />
                          )}
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent className="space-y-1 ml-2 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const subItemActive = isActive(subItem.href);
                        return (
                          <button
                            key={subItem.href}
                            type="button"
                            onClick={() => handleNavigation(subItem.href, subItem.label)}
                            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full text-left ${
                              subItemActive 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                            data-testid={`nav-${subItem.label.toLowerCase().replace(/\s+/g, '-')}`}
                            title={subItem.label}
                          >
                            <SubIcon className="h-4 w-4 mr-3" />
                            {subItem.label}
                          </button>
                        );
                      })}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              );
            }
            const navItem = item as NavItem;
            const navItemActive = isActive(navItem.href);
            const isLogout = navItem.href === '#logout';
            if (isLogout) return null;

            return (
              <button
                key={navItem.name}
                type="button"
                onClick={() => handleNavigation(navItem.href, navItem.name)}
                className={`flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-in-out w-full ${
                  navItemActive 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/50 dark:shadow-blue-500/30 scale-105' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:text-blue-700 dark:hover:text-blue-300 hover:scale-102'
                }`}
                data-testid={`nav-${navItem.name.toLowerCase().replace(/\s+/g, '-')}`}
                title={collapsed ? navItem.name : undefined}
              >
                <Icon className={`h-4 w-4 transition-all duration-300 ease-in-out`} />
                {!collapsed && <span className="transition-opacity duration-300 ease-in-out">{navItem.name}</span>}
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

        {!isMobile && <div className="flex-shrink-0 h-20" />}
      </div>
    );
  };

  const isTakingExam = location.includes('/portal/student/exams/') && (location.endsWith('/take') || location.split('/').length > 4);
  // Hide layout for students when on ANY exam subpage
  const isExamPage = userRole === 'student' && location.startsWith('/portal/student/exams');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex">
      {/* Desktop Sidebar - Modern Design */}
      {!isMobile && !isExamPage && (
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Modern Responsive Design - Fixed at Top */}
        {!isExamPage && (
          <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md h-[100px] flex items-center px-4 sm:px-5 md:px-6">
            <div className="flex justify-between items-center gap-2 sm:gap-3 w-full max-w-7xl mx-auto">
              <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 flex-1 min-w-0">
                {/* Modern Mobile Menu Trigger */}
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
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden md:flex flex-col items-start min-w-0 text-left">
                        <span className="text-xs sm:text-sm font-semibold truncate max-w-[100px] lg:max-w-none text-gray-700 dark:text-gray-300" data-testid="text-username">
                          {userName}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none capitalize">{userRole}</span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
                    <DropdownMenuLabel className="font-normal p-3">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold leading-none text-gray-900 dark:text-gray-100">{userName}</p>
                        <p className="text-xs leading-none text-gray-500 dark:text-gray-400 capitalize">{userRole} Account</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                    <DropdownMenuItem onClick={() => window.location.href = `/portal/${userRole}/profile`} className="p-2.5 cursor-pointer focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300 rounded-lg mx-1 transition-colors">
                      <User className="mr-2.5 h-4 w-4" />
                      <span>My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = `/portal/${userRole}/settings`} className="p-2.5 cursor-pointer focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-700 dark:focus:text-blue-300 rounded-lg mx-1 transition-colors">
                      <Settings className="mr-2.5 h-4 w-4" />
                      <span>Account Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                    <DropdownMenuItem onClick={handleLogout} className="px-3 py-2.5 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold transition-all">
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        )}

        {/* Page Content - Modern Responsive Layout */}
        <main className={`flex-1 overflow-x-hidden ${isExamPage ? 'p-0 h-screen overflow-hidden' : 'p-3 sm:p-4 md:p-6 lg:p-8'}`}>
          <div className={`${isExamPage ? 'max-w-none h-full w-full' : 'max-w-7xl mx-auto'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}