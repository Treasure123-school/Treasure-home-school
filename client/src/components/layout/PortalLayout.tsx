import { useLocation } from 'wouter';
import {
  GraduationCap, Home, Users, Calendar, BookOpen, MessageSquare, User, Settings,
  Bell, LogOut, ImageIcon, FileText, Menu, ChevronLeft, ChevronRight, ClipboardCheck,
  ClipboardList, ChevronDown, UserCheck, Briefcase, Shield, Activity,
  Clock, PenTool, CheckSquare, Award, Star, Library, DollarSign, Trophy, HelpCircle,
  Inbox, Megaphone, MessagesSquare, ClipboardPen, BarChart3, FolderOpen, RotateCcw,
  Layers, Database, CreditCard, Receipt, ListChecks, PanelLeftClose, PanelLeftOpen,
  Globe, Newspaper, Images, BookMarked, Wrench,
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
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { Badge } from '@/components/ui/badge';
import PortalBreadcrumb from './PortalBreadcrumb';

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
  /** When true, hide the portal header + sidebar (used for the full-screen exam-taking view). */
  examActive?: boolean;
}

const SIDEBAR_EXPANDED_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 60;
const HEADER_HEIGHT = 52;

export default function PortalLayout({ children, userRole, userName, userInitials, examActive = false }: PortalLayoutProps) {
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

  const { user } = useAuth();
  const { data: unreadMessagesCount = 0 } = useQuery<number>({
    queryKey: ['messages', 'unread', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/messages/user/${user?.id}`, { credentials: 'include' });
      if (!response.ok) return 0;
      const messages = await response.json();
      return messages.filter((m: any) => !m.isRead).length;
    },
    enabled: !!user,
  });

  useSocketIORealtime({
    queryKey: ['messages', 'unread', user?.id],
  });

  const schoolName = settings?.schoolName || '';
  const schoolMotto = settings?.schoolMotto || '';
  const displayLogo = settings?.schoolLogo || schoolLogo;

  // Auto-open the correct sidebar group based on the current route
  useEffect(() => {
    if (userRole === 'admin') {
      const academicRoutes = ['/classes', '/subjects', '/subject-manager', '/academic-terms', '/syllabus-topics', '/academics/curriculum', '/lesson-notes', '/lesson-note-library', '/academics/timetable'];
      const studentRoutes = ['/students', '/parents', '/attendance'];
      const staffRoutes = ['/teachers', '/users', '/job-vacancies', '/recovery-tools'];
      const examRoutes = ['/exams', '/grading-queue', '/exam-analytics', '/question-bank', '/results'];
      const financeRoutes = ['/billing-items', '/billing-payments', '/billing-outstanding', '/billing-reports'];
      if (academicRoutes.some(p => location.includes(p))) { setOpenMenuKey('admin-academics'); return; }
      if (studentRoutes.some(p => location.includes(p))) { setOpenMenuKey('admin-students'); return; }
      if (staffRoutes.some(p => location.includes(p))) { setOpenMenuKey('admin-staff'); return; }
      if (examRoutes.some(p => location.includes(p))) { setOpenMenuKey('admin-exams'); return; }
      if (financeRoutes.some(p => location.includes(p))) { setOpenMenuKey('admin-finance'); return; }
    }
  }, [location, userRole]);

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
              { href: `/portal/${userRole}/timetable`, icon: Clock, label: 'Timetable' },
              { href: `/portal/${userRole}/subjects`, icon: BookOpen, label: 'Subjects' },
              { href: `/portal/${userRole}/scheme-of-work`, icon: ListChecks, label: 'Scheme of Work' },
              { href: `/portal/${userRole}/assignments`, icon: ClipboardPen, label: 'Assignments' },
              { href: `/portal/${userRole}/exams`, icon: PenTool, label: 'Assessments' },
              { href: `/portal/${userRole}/grades`, icon: BarChart3, label: 'Gradebook' },
              { href: `/portal/${userRole}/report-card`, icon: FileText, label: 'Report Card' },
            ],
          },
          { name: 'Attendance', href: `/portal/${userRole}/attendance`, icon: Calendar },
          { name: 'School Calendar', href: `/portal/${userRole}/calendar`, icon: Calendar },
          { name: 'Events', href: `/portal/${userRole}/events`, icon: Bell },
          {
            type: 'group',
            label: 'Communication',
            icon: MessageSquare,
            isOpen: openMenuKey === 'student-communication',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'student-communication' : null),
            items: [
              { href: `/portal/${userRole}/messages`, icon: Inbox, label: 'Messages', unreadCount: unreadMessagesCount },
              { href: `/portal/${userRole}/announcements`, icon: Megaphone, label: 'Announcements' },
              { href: `/portal/${userRole}/forum`, icon: MessagesSquare, label: 'Discussion Forum' },
            ],
          },
          { name: 'Library', href: `/portal/${userRole}/library`, icon: Library },
          { name: 'Extracurricular', href: `/portal/${userRole}/extracurricular`, icon: Trophy },
          { name: 'Help & Support', href: `/portal/${userRole}/help`, icon: HelpCircle },
          { name: 'Logout', href: '#logout', icon: LogOut },
        ];
      case 'teacher':
        return [
          ...baseNav,
          { name: 'My Classes', href: `/portal/${userRole}/classes`, icon: Users },
          { name: 'My Timetable', href: `/portal/${userRole}/timetable`, icon: Clock },
          { name: 'Attendance', href: `/portal/${userRole}/attendance`, icon: Calendar },
          {
            type: 'group',
            label: 'Assessment Management',
            icon: ClipboardList,
            isOpen: openMenuKey === 'teacher-exam',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'teacher-exam' : null),
            items: [
              { href: '/portal/teacher/exams', icon: PenTool, label: 'Assessments' },
              { href: '/portal/teacher/grading-queue', icon: CheckSquare, label: 'Assessment Review' },
              { href: '/portal/teacher/exam-analytics', icon: Award, label: 'Assessment Analytics' },
              { href: '/portal/teacher/question-bank', icon: Database, label: 'Question Bank' },
            ],
          },
          { name: 'Report Cards', href: `/portal/${userRole}/report-cards`, icon: FileText },
          { name: 'Lesson Notes', href: `/portal/${userRole}/lesson-notes`, icon: BookOpen },
          { name: 'Note Library', href: `/portal/${userRole}/lesson-note-library`, icon: Library },
          { name: 'School Calendar', href: `/portal/${userRole}/calendar`, icon: Calendar },
          { name: 'Events', href: `/portal/${userRole}/events`, icon: Bell },
          { name: 'Announcements', href: `/portal/${userRole}/announcements`, icon: Megaphone },
          { name: 'Messages', href: `/portal/${userRole}/messages`, icon: MessageSquare, unreadCount: unreadMessagesCount },
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
              { href: `/portal/${userRole}/parents`, icon: Users, label: 'Parents' },
              { href: `/portal/${userRole}/attendance`, icon: Calendar, label: 'Attendance' },
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
              { href: `/portal/${userRole}/academic-terms`, icon: Calendar, label: 'Academic Terms' },
              { href: `/portal/${userRole}/syllabus-topics`, icon: Layers, label: 'Syllabus Topics' },
              { href: `/portal/${userRole}/academics/curriculum`, icon: BookMarked, label: 'Curriculum Library' },
              { href: `/portal/${userRole}/lesson-notes`, icon: ClipboardCheck, label: 'Lesson Notes' },
              { href: `/portal/${userRole}/lesson-note-library`, icon: Library, label: 'Note Library' },
              { href: `/portal/${userRole}/academics/timetable`, icon: Clock, label: 'Timetable' },
            ],
          },
          {
            type: 'group', label: 'Assessments & Results', icon: ClipboardList,
            isOpen: openMenuKey === 'admin-exams',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-exams' : null),
            items: [
              { href: '/portal/admin/exams/manage', icon: PenTool, label: 'Assessment Management' },
              { href: '/portal/admin/exams/overview', icon: BarChart3, label: 'Assessment Analytics' },
              { href: '/portal/admin/question-bank', icon: Database, label: 'Question Bank' },
              { href: '/portal/admin/results/publishing', icon: FileText, label: 'Report Card' },
              { href: '/portal/admin/results/maintenance', icon: Wrench, label: 'RC Maintenance' },
            ],
          },
          {
            type: 'group', label: 'Billing & Payments', icon: DollarSign,
            isOpen: openMenuKey === 'admin-finance',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-finance' : null),
            items: [
              { href: `/portal/${userRole}/billing-items`, icon: Receipt, label: 'Billing Items' },
              { href: `/portal/${userRole}/billing-payments`, icon: CreditCard, label: 'Payments' },
              { href: `/portal/${userRole}/billing-outstanding`, icon: Clock, label: 'Outstanding' },
              { href: `/portal/${userRole}/billing-reports`, icon: BarChart3, label: 'Financial Reports' },
            ],
          },
          {
            type: 'group', label: 'Communication & Events', icon: Calendar,
            isOpen: openMenuKey === 'admin-events',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-events' : null),
            items: [
              { href: `/portal/${userRole}/calendar`, icon: Calendar, label: 'School Calendar' },
              { href: `/portal/${userRole}/events`, icon: Bell, label: 'Events' },
              { href: `/portal/${userRole}/announcements`, icon: Megaphone, label: 'Announcements' },
              { href: `/portal/${userRole}/messages`, icon: MessageSquare, label: 'Messages', unreadCount: unreadMessagesCount },
            ],
          },
          {
            type: 'group', label: 'Website Management', icon: Globe,
            isOpen: openMenuKey === 'admin-content',
            setIsOpen: (open: boolean) => setOpenMenuKey(open ? 'admin-content' : null),
            items: [
              { href: `/portal/${userRole}/website`, icon: Globe, label: 'Overview' },
              { href: `/portal/${userRole}/homepage-management`, icon: ImageIcon, label: 'Homepage' },
              { href: `/portal/${userRole}/website/gallery`, icon: Images, label: 'Gallery' },
              { href: `/portal/${userRole}/website/news`, icon: Newspaper, label: 'News & Blog' },
              { href: `/portal/${userRole}/website/faq`, icon: HelpCircle, label: 'FAQ' },
              { href: `/portal/${userRole}/website/about`, icon: BookOpen, label: 'About Page' },
              { href: `/portal/${userRole}/website/contact-inbox`, icon: Inbox, label: 'Contact Inbox' },
              { href: `/portal/${userRole}/website/admissions`, icon: GraduationCap, label: 'Admissions' },
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
          { name: 'School Calendar', href: `/portal/${userRole}/calendar`, icon: Calendar },
          { name: 'Events', href: `/portal/${userRole}/events`, icon: Bell },
          { name: 'Messages', href: `/portal/${userRole}/messages`, icon: MessageSquare, unreadCount: unreadMessagesCount },
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

  const isExamPage = userRole === 'student' && examActive;

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
                } ${groupActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid={`nav-group-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className={`flex-1 text-left text-[13px] font-medium ${labelCls(collapsed)}`}>
                  {item.label}
                </span>
                {!collapsed && item.items.some((sub: any) => sub.unreadCount > 0) && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] flex items-center justify-center font-bold">
                    {item.items.reduce((sum: number, sub: any) => sum + (sub.unreadCount || 0), 0)}
                  </Badge>
                )}
                <ChevronDown
                  className={`flex-shrink-0 transition-[opacity,width,height,transform] duration-300 ease-in-out ${
                    collapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : 'opacity-100 w-3.5 h-3.5'
                  } ${item.isOpen ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="ml-3 mt-0.5 mb-0.5 pl-2.5 border-l border-border space-y-0.5">
                {item.items.map((sub: any) => {
                  const SubIcon = sub.icon;
                  // Active only if this is the best (most specific) match among siblings.
                  // Prevents a parent path like /website being highlighted when on /website/gallery.
                  const siblingBetter = item.items.some((other: any) =>
                    other.href !== sub.href &&
                    other.href.length > sub.href.length &&
                    (location === other.href || location.startsWith(other.href + '/'))
                  );
                  const active = isActive(sub.href) && !siblingBetter;
                  return (
                    <button
                      key={sub.href}
                      type="button"
                      onClick={() => goTo(sub.href, onNavigate)}
                      className={`flex items-center gap-2 w-full px-2 h-8 rounded-md text-[12.5px] font-medium transition-colors duration-150 ${
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`nav-${sub.label.toLowerCase().replace(/\s+/g, '-')}`}
                      title={sub.label}
                    >
                      <SubIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{sub.label}</span>
                      {sub.unreadCount > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] flex items-center justify-center font-bold">
                          {sub.unreadCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      }
 
      // ── Regular item ──
      const navItem = item as any;
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
          } ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid={`nav-${navItem.name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="relative">
            <Icon className="h-4 w-4 flex-shrink-0" />
            {collapsed && navItem.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
              </span>
            )}
          </div>
          <span className={`text-[13px] font-medium flex-1 text-left ${labelCls(collapsed)}`}>
            {navItem.name}
          </span>
          {!collapsed && navItem.unreadCount > 0 && (
            <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] flex items-center justify-center font-bold">
              {navItem.unreadCount}
            </Badge>
          )}
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
                <p className="font-display text-[13px] font-bold text-primary leading-tight truncate">{schoolName}</p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">{getRoleTitle()} Portal</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 border border-gray-300 dark:border-gray-600 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800" data-testid="button-mobile-menu">
                    <Menu className="h-[18px] w-[18px]" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] p-0 [&>button]:hidden">
                  <div className="flex flex-col h-full bg-background">
                    <div className="flex-shrink-0 h-14 flex items-center gap-3 px-4 border-b border-border">
                      <img src={displayLogo} alt="School logo" className="h-9 w-9 object-contain flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-bold text-primary leading-tight truncate">{schoolName}</p>
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
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-primary leading-tight truncate">{schoolName}</p>
                {schoolMotto && <p className="text-[9px] text-muted-foreground uppercase tracking-wide truncate leading-tight">{schoolMotto}</p>}
              </div>
            </div>
          )}

          {/* Search (desktop only) */}
          {!isMobile && (
            <div className="flex-1 min-w-0 px-4">
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
          className={`flex-1 overflow-x-hidden min-w-0 ${isExamPage ? 'p-0 overflow-hidden' : 'p-2 sm:p-4 md:p-6'}`}
        >
          <div className={isExamPage ? 'max-w-none h-full w-full' : 'max-w-5xl mx-auto'}>
            {!isExamPage && <PortalBreadcrumb />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
