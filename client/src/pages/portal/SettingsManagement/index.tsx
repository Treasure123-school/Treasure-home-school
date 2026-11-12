import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings, Building2, GraduationCap, BarChart3, Users, ClipboardList, FileText, FileBarChart2, CalendarCheck, Bell, CreditCard, Palette, Shield, Database, ChevronRight, ChevronDown, Search, Scale, Crown,
} from 'lucide-react';
import { SectionSkeleton } from './components';
import SchoolProfileSection from './SchoolProfileSection';
import AcademicSettingsSection from './AcademicSettingsSection';
import GradingScaleSection from './GradingScale';
import UsersRolesSection from './UsersRolesSection';
import ExamsCBTSection from './ExamsCBTSection';
import LessonNotesSection from './LessonNotesSection';
import ReportCardSection from './ReportCardSection';
import AttendanceSection from './AttendanceSection';
import NotificationsSection from './NotificationsSection';
import FinanceSection from './FinanceSection';
import AppearanceSection from './AppearanceSection';
import SecuritySection from './SecuritySection';
import DataManagementSection from './DataManagementSection';
import SchoolLeadershipSection from './SchoolLeadershipSection';

// ─────────────────────────────────────────────
// Nav config
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'school', label: 'School Profile', icon: Building2, description: 'Name, contact, address, motto' },
  { id: 'leadership', label: 'School Leadership', icon: Crown, description: 'Principal assignment & signature' },
  { id: 'academic', label: 'Academic', icon: GraduationCap, description: 'Weights, report cards, overrides' },
  { id: 'grading', label: 'Grading Scale', icon: BarChart3, description: 'Grade boundaries & class ranking' },
  { id: 'users', label: 'Users & Roles', icon: Users, description: 'Username formats & permissions' },
  { id: 'exams', label: 'Exams & CBT', icon: ClipboardList, description: 'Exam config, payment, CBT rules' },
  { id: 'lessons', label: 'Lesson Notes', icon: FileText, description: 'Approval & visibility rules' },
  { id: 'reports', label: 'Report Cards', icon: FileBarChart2, description: 'Report card config & signatures' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Status types & permissions' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & SMS alert settings' },
  { id: 'finance', label: 'Finance', icon: CreditCard, description: 'Fee & payment configuration' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, branding & display' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Access & password policies' },
  { id: 'data', label: 'Data & Backup', icon: Database, description: 'Import, export & backups' },
];

function renderSection(id: string) {
  switch (id) {
    case 'school': return <SchoolProfileSection />;
    case 'leadership': return <SchoolLeadershipSection />;
    case 'academic': return <AcademicSettingsSection />;
    case 'grading': return <GradingScaleSection />;
    case 'users': return <UsersRolesSection />;
    case 'exams': return <ExamsCBTSection />;
    case 'lessons': return <LessonNotesSection />;
    case 'reports': return <ReportCardSection />;
    case 'attendance': return <AttendanceSection />;
    case 'notifications': return <NotificationsSection />;
    case 'finance': return <FinanceSection />;
    case 'appearance': return <AppearanceSection />;
    case 'security': return <SecuritySection />;
    case 'data': return <DataManagementSection />;
    default: return null;
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function SettingsManagement() {
  const [activeSection, setActiveSection] = useState('school');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileNavOpen]);

  const filteredNav = NAV_ITEMS.filter(item =>
    !search || item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const activeItem = NAV_ITEMS.find(i => i.id === activeSection);
  const ActiveIcon = activeItem?.icon ?? Settings;

  const handleNavClick = useCallback((id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    setSearch('');
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0" data-testid="settings-management">

      {/* ── Mobile nav dropdown (floating overlay) ── */}
      <div className="lg:hidden relative z-30" ref={mobileNavRef}>
        <Button
          variant="outline"
          onClick={() => setMobileNavOpen(v => !v)}
          className="w-full justify-between"
          data-testid="button-mobile-nav"
        >
          <span className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4" />
            {activeItem?.label}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', mobileNavOpen && 'rotate-180')} />
        </Button>
        {mobileNavOpen && (
          <Card className="absolute top-full left-0 right-0 mt-1 shadow-xl border z-50">
            <CardContent className="p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search settings…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-settings-search-mobile"
                />
              </div>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {filteredNav.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-sm transition-colors',
                      activeSection === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                    data-testid={`nav-mobile-${item.id}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
                {filteredNav.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No settings found</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-settings-search"
                />
              </div>
              <div className="space-y-0.5">
                {filteredNav.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors group',
                      activeSection === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-foreground'
                    )}
                    data-testid={`nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className={cn('text-xs truncate leading-tight', activeSection === item.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={cn('w-3.5 h-3.5 shrink-0', activeSection === item.id ? 'text-primary-foreground/60' : 'text-muted-foreground/60')} />
                  </button>
                ))}
                {filteredNav.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No settings found</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h1 className="text-xl font-bold flex items-center gap-2 truncate">
            <ActiveIcon className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">{activeItem?.label}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeItem?.description}</p>
        </div>
        {renderSection(activeSection)}
      </div>
    </div>
  );
}
