import { useLocation } from 'wouter';
import {
  GraduationCap, Home, Users, Calendar, BookOpen, MessageSquare, User, Settings,
  Bell, LogOut, ImageIcon, FileText, Menu, ChevronLeft, ChevronRight, ClipboardCheck,
  ClipboardList, ChevronDown, History, UserCheck, Eye, Briefcase, Shield, Activity,
  Clock, PenTool, CheckSquare, Award, Star, Library, DollarSign, Trophy, HelpCircle,
  Inbox, Megaphone, MessagesSquare, ClipboardPen, BarChart3, FolderOpen, RotateCcw,
  Layers, Database, CreditCard, Receipt, ListChecks, PanelLeftClose, PanelLeftOpen,
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
import { useState, useEffect, useTransition, useCallback } from 'react';
import schoolLogo from '@assets/1000025432-removebg-preview (1)_1757796555126.png';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderSearch } from '@/components/HeaderSearch';
import { useQuery } from '@tanstack/react-query';
import { useUserActivityTracker } from '@/hooks/useUserActivityTracker';

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
  items: Array<{ href: string; icon: any; label: string }>;
}
type NavigationItem = NavItem | NavGroup;

interface PortalLayoutProps {
  children: React.ReactNode;
  userRole: 'student' | 'teacher' | 'admin' | 'parent';
  userName: string;
  userInitials: string;
}

const SIDEBAR_EXPANDED_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 60;
const HEADER_HEIGHT = 52;

export default function PortalLayout({ children, userRole, userName, userInitials }: PortalLayoutProps) {
  const [location, navigate] = useLocation();
  const { logout } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useUserActivityTracker(true);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) setSidebarCollapsed(saved === 'true');
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ['/api/public/settings'],
    staleTime: 1000,
    gcTime: 5000,
    refetchInterval: 10000,
  });

  const schoolName = settings?.schoolName || '';
  const schoolMotto = settings?.schoolMotto || '';
  const displayLogo = settings?.schoolLogo || schoolLogo;

  useEffect(() => {
    if (settings?.favicon) {
      const faviconUrl = settings.favicon;
      const links = document.querySelectorAll("link[rel*='icon']");
      links.forEach(l => { (l as HTMLLinkElement).href = faviconUrl; });
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = faviconUrl;
        document.head.appendChild(link);
      }
    }
  }, [settings?.favicon]);

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
              { href: `/portal/${userRole}/scheme-of-work`, icon: ListChecks, label: 'Scheme of Work' },
              { href: `/portal/${userRole}/assignments`, icon: ClipboardPen, label: 'Assignments' },
              { href: `/portal/${userRole}/exams`, icon: PenTool, label: 'Exams / Tests' },
              { href: `/portal/${userRole}/grades`, icon: BarChart3, label: 'Gradebook' },
              { href: `/portal/${userRole}/report-card`, icon: FileText, label: 'Report Card' },
            ],
          },
          { name: 'Attendance', href: `/portal/${userRole}/attendance`, icon: Calendar },
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
            ],
          },
          { name: 'Exam Fee Payment', href: `/portal/${userRole}/exam-payment`, icon: CreditCard },
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
              { href: '/portal/teacher/question-bank', icon: Database, label: 'Question Bank' },
            ],
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
            type: 'group', label: 'Student Management', icon: GraduationCap,
            isOpen: openMenuKey === 'admin-students',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-students' : null),
            items: [
              { href: `/portal/${userRole}/students`, icon: Users, label: 'All Students' },
              { href: `/portal/${userRole}/coming-soon?page=enrollment`, icon: UserCheck, label: 'Student Enrollment' },
              { href: `/portal/${userRole}/coming-soon?page=parents`, icon: Users, label: 'Parent Linking' },
              { href: `/portal/${userRole}/coming-soon?page=attendance`, icon: Calendar, label: 'Attendance' },
            ],
          },
          {
            type: 'group', label: 'Staff Management', icon: Users,
            isOpen: openMenuKey === 'admin-staff',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-staff' : null),
            items: [
              { href: `/portal/${userRole}/teachers`, icon: Users, label: 'Teachers' },
              { href: `/portal/${userRole}/users`, icon: Users, label: 'All Users' },
              { href: `/portal/${userRole}/job-vacancies`, icon: Briefcase, label: 'Job Vacancies' },
              { href: `/portal/${userRole}/profile-completion`, icon: UserCheck, label: 'Profile Verification' },
              { href: `/portal/${userRole}/recovery-tools`, icon: RotateCcw, label: 'Recovery Tools' },
            ],
          },
          {
            type: 'group', label: 'Academic Operations', icon: BookOpen,
            isOpen: openMenuKey === 'admin-academics',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-academics' : null),
            items: [
              { href: `/portal/${userRole}/classes`, icon: BookOpen, label: 'Classes' },
              { href: `/portal/${userRole}/subjects`, icon: BookOpen, label: 'Subjects' },
              { href: `/portal/${userRole}/subject-manager/unified-assignment`, icon: ClipboardList, label: 'Subject Setup' },
              { href: `/portal/${userRole}/subject-assignment`, icon: Users, label: 'Teacher Assignments' },
              { href: `/portal/${userRole}/academic-terms`, icon: Calendar, label: 'Academic Terms' },
              { href: `/portal/${userRole}/syllabus-topics`, icon: Layers, label: 'Syllabus Topics' },
              { href: `/portal/${userRole}/coming-soon?page=timetable`, icon: Clock, label: 'Timetable' },
            ],
          },
          {
            type: 'group', label: 'Exams & Results', icon: ClipboardList,
            isOpen: openMenuKey === 'admin-exams',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-exams' : null),
            items: [
              { href: '/portal/admin/exams', icon: PenTool, label: 'Exam Management' },
              { href: '/portal/admin/exam-payments', icon: CreditCard, label: 'Exam Payments' },
              { href: '/portal/admin/question-bank', icon: Database, label: 'Question Bank' },
              { href: '/portal/admin/results/publishing', icon: Eye, label: 'Result Publishing' },
              { href: `/portal/${userRole}/coming-soon?page=ca`, icon: ClipboardList, label: 'Continuous Assessment' },
              { href: `/portal/${userRole}/coming-soon?page=processing`, icon: Activity, label: 'Result Processing' },
            ],
          },
          {
            type: 'group', label: 'Finance Operations', icon: DollarSign,
            isOpen: openMenuKey === 'admin-finance',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-finance' : null),
            items: [
              { href: `/portal/${userRole}/coming-soon?page=payments`, icon: DollarSign, label: 'Fee Collection' },
              { href: `/portal/${userRole}/coming-soon?page=records`, icon: FileText, label: 'Payment Records' },
              { href: `/portal/${userRole}/coming-soon?page=outstanding`, icon: Clock, label: 'Outstanding Fees' },
            ],
          },
          {
            type: 'group', label: 'School Events', icon: Calendar,
            isOpen: openMenuKey === 'admin-events',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-events' : null),
            items: [
              { href: `/portal/${userRole}/coming-soon?page=calendar`, icon: Calendar, label: 'School Calendar' },
              { href: `/portal/${userRole}/coming-soon?page=events`, icon: Bell, label: 'Events & Notices' },
              { href: `/portal/${userRole}/announcements`, icon: Megaphone, label: 'Announcements' },
            ],
          },
          {
            type: 'group', label: 'Content Management', icon: ImageIcon,
            isOpen: openMenuKey === 'admin-content',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-content' : null),
            items: [
              { href: `/portal/${userRole}/homepage-management`, icon: ImageIcon, label: 'Homepage' },
              { href: `/portal/${userRole}/gallery`, icon: ImageIcon, label: 'Gallery' },
              { href: `/portal/${userRole}/coming-soon?page=assignments`, icon: ClipboardPen, label: 'Assignments' },
              { href: `/portal/${userRole}/coming-soon?page=lessons`, icon: BookOpen, label: 'Lesson Notes' },
              { href: `/portal/${userRole}/coming-soon?page=library`, icon: Library, label: 'E-Library' },
            ],
          },
          {
            type: 'group', label: 'Reports', icon: FileText,
            isOpen: openMenuKey === 'admin-reports',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-reports' : null),
            items: [
              { href: `/portal/${userRole}/reports`, icon: BarChart3, label: 'Academic Reports' },
              { href: `/portal/${userRole}/performance`, icon: Activity, label: 'Performance Analytics' },
              { href: `/portal/${userRole}/online-users`, icon: Users, label: 'Live Activity' },
              { href: `/portal/${userRole}/comment-templates`, icon: MessageSquare, label: 'Comment Templates' },
            ],
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
    if (path === `/portal/${userRole}`) return location === path;
    return location === path || location.startsWith(path + '/');
  };

  const isGroupActive = (items: Array<{ href: string }>) =>
    items.some(i => isActive(i.href));

  const getRoleTitle = () => {
    switch (userRole) {
      case 'student': return 'Student';
      case 'teacher': return 'Teacher';
      case 'admin': return 'Admin';
      case 'parent': return 'Parent';
      default: return '';
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const isExamPage = userRole === 'student' && location.startsWith('/portal/student/exams');

  // ── Navigation helper (plain function, NOT a React component) ──────────────
  // This is called directly in JSX — React sees the same element tree on every
  // render, so CSS transitions on labels/chevrons always fire correctly.
  const goTo = useCallback((href: string, onNavigate?: () => void) => {
    onNavigate?.();
    startTransition(() => navigate(href));
  }, [navigate, startTransition]);

  const labelCls = (collapsed: boolean) =>
    `overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-in-out ${
      collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[160px]'
    }`;

  const renderNavItems = (collapsed: boolean, onNavigate?: () => void) =>
    navigation.map((item) => {
      const Icon = item.icon;

      // ── Group (collapsible section) ──
      if ('type' in item && item.type === 'group') {
        const groupActive = isGroupActive(item.items);
        return (
          <Collapsible
            key={item.label}
            open={!collapsed && item.isOpen}
            onOpenChange={(open) => { if (!collapsed) item.setIsOpen(open); }}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (collapsed) {
                    setSidebarCollapsed(false);
                    localStorage.setItem('sidebarCollapsed', 'false');
                    item.setIsOpen(true);
                  }
                }}
                className={`flex items-center w-full h-9 rounded-lg transition-colors duration-200 ease-in-out ${
                  collapsed ? 'justify-center px-0' : 'px-2.5 gap-2.5'
                } ${groupActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                data-testid={`nav-group-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={`flex-1 text-left text-[13px] font-medium ${labelCls(collapsed)}`}>
                  {item.label}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 flex-shrink-0 transition-[opacity,transform] duration-300 ease-in-out ${
                    collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                  } ${item.isOpen ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="ml-3 mt-0.5 mb-0.5 pl-2.5 border-l border-border space-y-0.5">
                {item.items.map((sub) => {
                  const SubIcon = sub.icon;
                  const active = isActive(sub.href);
                  return (
                    <button
                      key={sub.href}
                      type="button"
                      onClick={() => goTo(sub.href, onNavigate)}
                      className={`flex items-center gap-2 w-full px-2 h-8 rounded-md text-[12.5px] font-medium transition-colors duration-150 ${
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                      data-testid={`nav-${sub.label.toLowerCase().replace(/\s+/g, '-')}`}
                      title={sub.label}
                    >
                      <SubIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      }

      // ── Regular item ──
      const navItem = item as NavItem;
      if (navItem.href === '#logout') return null;
      const active = isActive(navItem.href);
      return (
        <button
          key={navItem.name}
          type="button"
          onClick={() => goTo(navItem.href, onNavigate)}
          title={collapsed ? navItem.name : undefined}
          className={`flex items-center w-full h-9 rounded-lg transition-colors duration-200 ease-in-out ${
            collapsed ? 'justify-center px-0' : 'px-2.5 gap-2.5'
          } ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
          data-testid={`nav-${navItem.name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className={`text-[13px] font-medium ${labelCls(collapsed)}`}>
            {navItem.name}
          </span>
        </button>
      );
    });

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      {!isExamPage && (
        <header
          style={{ height: HEADER_HEIGHT }}
          className="sticky top-0 z-50 bg-background border-b border-border flex items-center flex-shrink-0"
          data-testid="portal-header"
        >
          {/* Brand section — width mirrors the sidebar */}
          {!isMobile ? (
            <div
              style={{
                width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
                minWidth: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
              }}
              className="flex-shrink-0 h-full flex items-center gap-2.5 px-3 border-r border-border transition-[width,min-width] duration-300 ease-in-out overflow-hidden"
            >
              <img
                src={displayLogo}
                alt="School logo"
                className={`object-contain flex-shrink-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'h-7 w-7' : 'h-8 w-8'}`}
              />
              <div className={`min-w-0 flex-1 transition-opacity duration-300 ease-in-out ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <p className="text-[13px] font-bold text-primary leading-tight truncate">{schoolName}</p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">{getRoleTitle()} Portal</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid="button-mobile-menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] p-0 [&>button]:hidden">
                  <div className="flex flex-col h-full bg-background">
                    <div className="flex-shrink-0 h-14 flex items-center gap-3 px-4 border-b border-border">
                      <img src={displayLogo} alt="School logo" className="h-9 w-9 object-contain flex-shrink-0" />
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
              <img src={displayLogo} alt="logo" className="h-7 w-7 object-contain flex-shrink-0" />
              <span className="text-sm font-bold text-primary truncate">{schoolName}</span>
            </div>
          )}

          {/* Search (desktop only) */}
          {!isMobile && (
            <div className="flex-1 min-w-0 px-4 max-w-sm">
              <HeaderSearch userRole={userRole} />
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
                    <span className="text-[10px] text-muted-foreground capitalize leading-tight">{userRole}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 mt-1">
                <DropdownMenuLabel className="font-normal px-3 py-2">
                  <p className="text-sm font-semibold">{userName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userRole} Account</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.location.href = `/portal/${userRole}/profile`} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = `/portal/${userRole}/settings`} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      {/* ── Body: Sidebar + Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop sidebar — rendered inline (no nested component) so React updates
            class/style attributes rather than unmounting, keeping transitions alive */}
        {!isMobile && !isExamPage && (
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
                className={`flex items-center gap-2 w-full px-3 h-10 text-xs text-muted-foreground hover:text-primary-foreground hover:bg-primary transition-all duration-200 ease-in-out ${sidebarCollapsed ? 'justify-center' : ''}`}
                data-testid="button-toggle-sidebar"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

        <main
          className={`flex-1 overflow-x-hidden min-w-0 ${isExamPage ? 'p-0 overflow-hidden' : 'p-4 sm:p-5 md:p-6'}`}
        >
          <div className={isExamPage ? 'max-w-none h-full w-full' : 'max-w-5xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
