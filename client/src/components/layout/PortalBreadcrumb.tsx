import { useLocation, useSearch } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'wouter';

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

type RouteEntry = {
  pattern: RegExp | string;
  crumbs: BreadcrumbSegment[];
};

function buildRouteTable(): RouteEntry[] {
  return [
    // ── Student ──────────────────────────────────────────────────────
    { pattern: '/portal/student', crumbs: [{ label: 'Dashboard' }] },
    { pattern: '/portal/student/grades', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Gradebook' }] },
    { pattern: '/portal/student/exam-results', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Exam Results' }] },
    { pattern: '/portal/student/announcements', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Announcements' }] },
    { pattern: '/portal/student/attendance', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Attendance' }] },
    { pattern: '/portal/student/messages', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Messages' }] },
    { pattern: '/portal/student/report-card', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Report Card' }] },
    { pattern: '/portal/student/profile', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Profile' }] },
    { pattern: '/portal/student/gallery', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Gallery' }] },
    { pattern: '/portal/student/study-resources', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Study Resources' }] },
    { pattern: '/portal/student/subjects', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Subjects' }] },
    { pattern: '/portal/student/scheme-of-work', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Scheme of Work' }] },
    { pattern: '/portal/student/timetable', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Timetable' }] },
    { pattern: '/portal/student/assignments', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Assignments' }] },
    { pattern: '/portal/student/library', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Library' }] },
    { pattern: '/portal/student/help', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Help & Support' }] },
    { pattern: '/portal/student/extracurricular', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Extracurricular' }] },
    { pattern: '/portal/student/forum', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Discussion Forum' }] },
    { pattern: '/portal/student/calendar', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'School Calendar' }] },
    { pattern: '/portal/student/events', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Events' }] },
    { pattern: '/portal/student/exams', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Exams' }] },
    { pattern: '/portal/student/exam-payment', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Exam Fee Payment' }] },
    { pattern: '/portal/student/notifications', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Notifications' }] },
    { pattern: '/portal/student/change-password', crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Profile', href: '/portal/student/profile' }, { label: 'Change Password' }] },
    { pattern: /^\/portal\/student\/lesson-notes\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/student' }, { label: 'Scheme of Work', href: '/portal/student/scheme-of-work' }, { label: 'Lesson Note' }] },

    // ── Teacher ──────────────────────────────────────────────────────
    { pattern: '/portal/teacher', crumbs: [{ label: 'Dashboard' }] },
    { pattern: /^\/portal\/teacher\/classes\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Classes', href: '/portal/teacher/classes' }, { label: 'Class Detail' }] },
    { pattern: '/portal/teacher/classes', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Classes' }] },
    { pattern: '/portal/teacher/attendance', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Attendance' }] },
    { pattern: '/portal/teacher/profile', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Profile' }] },
    { pattern: '/portal/teacher/profile-assignments', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Assignment Overview' }] },
    { pattern: '/portal/teacher/exams', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Exam System' }] },
    { pattern: '/portal/teacher/exams/manage', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Exams', href: '/portal/teacher/exams' }, { label: 'Manage Exams' }] },
    { pattern: '/portal/teacher/grading-queue', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Assessment Review' }] },
    { pattern: '/portal/teacher/exam-analytics', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Exam Analytics' }] },
    { pattern: '/portal/teacher/question-bank', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Question Bank' }] },
    { pattern: '/portal/teacher/syllabus-topics', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Syllabus Topics' }] },
    { pattern: '/portal/teacher/report-cards', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Report Cards' }] },
    { pattern: '/portal/teacher/recent-exam-results', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Recent Exam Results' }] },
    { pattern: '/portal/teacher/timetable', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Timetable' }] },
    { pattern: '/portal/teacher/messages', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Messages' }] },
    { pattern: '/portal/teacher/announcements', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Announcements' }] },
    { pattern: '/portal/teacher/calendar', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'School Calendar' }] },
    { pattern: '/portal/teacher/events', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Events' }] },
    { pattern: /^\/portal\/teacher\/results\/class\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Results', href: '/portal/teacher/classes' }, { label: 'Class Results' }] },
    { pattern: /^\/portal\/teacher\/results\/exam\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Results' }, { label: 'Exam Results' }] },
    { pattern: '/portal/teacher/notifications', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Notifications' }] },
    { pattern: '/portal/teacher/change-password', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'Profile', href: '/portal/teacher/profile' }, { label: 'Change Password' }] },
    { pattern: '/portal/teacher/lesson-notes', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes' }] },
    { pattern: '/portal/teacher/lesson-notes/editor/new', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes', href: '/portal/teacher/lesson-notes' }, { label: 'New Note' }] },
    { pattern: '/portal/teacher/lesson-notes/create', crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes', href: '/portal/teacher/lesson-notes' }, { label: 'Create Note' }] },
    { pattern: /^\/portal\/teacher\/lesson-notes\/edit\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes', href: '/portal/teacher/lesson-notes' }, { label: 'Edit Note' }] },
    { pattern: /^\/portal\/teacher\/lesson-notes\/view\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes', href: '/portal/teacher/lesson-notes' }, { label: 'View Note' }] },
    { pattern: /^\/portal\/teacher\/lesson-notes\/preview\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/teacher' }, { label: 'My Lesson Notes', href: '/portal/teacher/lesson-notes' }, { label: 'Preview Note' }] },

    // ── Admin ────────────────────────────────────────────────────────
    { pattern: '/portal/admin', crumbs: [{ label: 'Dashboard' }] },
    { pattern: '/portal/admin/students', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Students' }] },
    { pattern: '/portal/admin/parents', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Parents' }] },
    { pattern: '/portal/admin/attendance', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Attendance' }] },
    { pattern: '/portal/admin/teachers', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Teachers' }] },
    { pattern: '/portal/admin/classes', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Classes' }] },
    { pattern: '/portal/admin/subjects', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Subjects' }] },
    { pattern: '/portal/admin/student-subjects', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Students', href: '/portal/admin/students' }, { label: 'Subject Assignment' }] },
    { pattern: '/portal/admin/teacher-assignments', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Teachers', href: '/portal/admin/teachers' }, { label: 'Assignments' }] },
    { pattern: '/portal/admin/announcements', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Announcements' }] },
    { pattern: '/portal/admin/reports', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Reports' }] },
    { pattern: '/portal/admin/settings', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Settings' }] },
    { pattern: '/portal/admin/profile', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Profile' }] },
    { pattern: '/portal/admin/academic-terms', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Academic Terms' }] },
    { pattern: '/portal/admin/exam-payments', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exam Payments' }] },
    { pattern: '/portal/admin/exams/overview', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exams', href: '/portal/admin/exams' }, { label: 'Overview' }] },
    { pattern: '/portal/admin/exams/analysis', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exams', href: '/portal/admin/exams' }, { label: 'Analysis' }] },
    { pattern: '/portal/admin/exams/manage', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exams', href: '/portal/admin/exams' }, { label: 'Manage' }] },
    { pattern: '/portal/admin/exams', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exams' }] },
    { pattern: '/portal/admin/results/publishing', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Results' }, { label: 'Publishing' }] },
    { pattern: '/portal/admin/academics/timetable', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Academics' }, { label: 'Timetable' }] },
    { pattern: '/portal/admin/academics/curriculum', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Academics' }, { label: 'Curriculum' }] },
    { pattern: '/portal/admin/subject-manager/unified-assignment', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Subject Manager' }, { label: 'Unified Assignment' }] },
    { pattern: '/portal/admin/subject-manager/assign-teachers', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Subject Manager' }, { label: 'Assign Teachers' }] },
    { pattern: '/portal/admin/subject-manager/subjects', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Subject Manager' }, { label: 'Subjects' }] },
    { pattern: '/portal/admin/comment-templates', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Report Cards' }, { label: 'Comment Templates' }] },
    { pattern: '/portal/admin/question-bank', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Exams', href: '/portal/admin/exams' }, { label: 'Question Bank' }] },
    { pattern: '/portal/admin/syllabus-topics', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Academics' }, { label: 'Syllabus Topics' }] },
    { pattern: '/portal/admin/lesson-notes', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review' }] },
    { pattern: '/portal/admin/lesson-notes/create', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review', href: '/portal/admin/lesson-notes' }, { label: 'Create Note' }] },
    { pattern: '/portal/admin/lesson-notes/editor/new', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review', href: '/portal/admin/lesson-notes' }, { label: 'New Note' }] },
    { pattern: /^\/portal\/admin\/lesson-notes\/edit\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review', href: '/portal/admin/lesson-notes' }, { label: 'Edit Note' }] },
    { pattern: /^\/portal\/admin\/lesson-notes\/preview\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review', href: '/portal/admin/lesson-notes' }, { label: 'Preview Note' }] },
    { pattern: /^\/portal\/admin\/lesson-notes\/[^/]+$/, crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Lesson Notes Review', href: '/portal/admin/lesson-notes' }, { label: 'View Note' }] },
    { pattern: '/portal/admin/notifications', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Notifications' }] },
    { pattern: '/portal/admin/change-password', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Profile', href: '/portal/admin/profile' }, { label: 'Change Password' }] },
    { pattern: '/portal/admin/recovery-tools', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Settings', href: '/portal/admin/settings' }, { label: 'Recovery Tools' }] },
    { pattern: '/portal/admin/audit-logs', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Audit Logs' }] },
    { pattern: '/portal/admin/users', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'User Management' }] },
    { pattern: '/portal/admin/online-users', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Online Users' }] },
    { pattern: '/portal/admin/performance', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Performance' }] },
    { pattern: '/portal/admin/homepage-management', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'Homepage' }] },
    { pattern: '/portal/admin/gallery', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Gallery' }] },
    { pattern: '/portal/admin/job-vacancies', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Job Vacancies' }] },
    { pattern: '/portal/admin/messages', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Messages' }] },
    { pattern: '/portal/admin/calendar', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Calendar' }] },
    { pattern: '/portal/admin/events', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Events' }] },
    { pattern: '/portal/admin/website/gallery', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'Gallery' }] },
    { pattern: '/portal/admin/website/news', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'News' }] },
    { pattern: '/portal/admin/website/faq', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'FAQ' }] },
    { pattern: '/portal/admin/website/about', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'About Page' }] },
    { pattern: '/portal/admin/website/contact-inbox', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'Contact Inbox' }] },
    { pattern: '/portal/admin/website/admissions', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website', href: '/portal/admin/website' }, { label: 'Admissions' }] },
    { pattern: '/portal/admin/website', crumbs: [{ label: 'Dashboard', href: '/portal/admin' }, { label: 'Website' }] },
    { pattern: '/portal/exam-sessions', crumbs: [{ label: 'Dashboard' }, { label: 'Exam Sessions' }] },
    { pattern: '/portal/exam-reports', crumbs: [{ label: 'Dashboard' }, { label: 'Exam Reports' }] },

    // ── Parent ───────────────────────────────────────────────────────
    { pattern: '/portal/parent', crumbs: [{ label: 'Dashboard' }] },
    { pattern: '/portal/parent/children', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'My Children' }] },
    { pattern: '/portal/parent/reports', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Report Cards' }] },
    { pattern: '/portal/parent/attendance', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Attendance' }] },
    { pattern: '/portal/parent/grades', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Grades' }] },
    { pattern: '/portal/parent/profile', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Profile' }] },
    { pattern: '/portal/parent/calendar', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'School Calendar' }] },
    { pattern: '/portal/parent/events', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Events' }] },
    { pattern: '/portal/parent/messages', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Messages' }] },
    { pattern: '/portal/parent/change-password', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Profile', href: '/portal/parent/profile' }, { label: 'Change Password' }] },
    { pattern: '/portal/parent/notifications', crumbs: [{ label: 'Dashboard', href: '/portal/parent' }, { label: 'Notifications' }] },

    // ── Super Admin ──────────────────────────────────────────────────
    { pattern: '/portal/superadmin/change-password', crumbs: [{ label: 'Dashboard', href: '/portal/superadmin' }, { label: 'Profile', href: '/portal/superadmin/profile' }, { label: 'Change Password' }] },
    { pattern: '/portal/superadmin/notifications', crumbs: [{ label: 'Dashboard', href: '/portal/superadmin' }, { label: 'Notifications' }] },
  ];
}

function matchRoute(pathname: string): BreadcrumbSegment[] | null {
  const table = buildRouteTable();
  for (const entry of table) {
    if (entry.pattern instanceof RegExp) {
      if (entry.pattern.test(pathname)) return entry.crumbs;
    } else {
      if (pathname === entry.pattern) return entry.crumbs;
    }
  }
  return null;
}

function getParentHref(crumbs: BreadcrumbSegment[]): string | null {
  for (let i = crumbs.length - 2; i >= 0; i--) {
    if (crumbs[i].href) return crumbs[i].href!;
  }
  return null;
}

export default function PortalBreadcrumb() {
  const [location] = useLocation();
  const search = useSearch();

  // Dynamically override preview-note crumbs when reached from the editor
  function resolvecrumbs(): BreadcrumbSegment[] | null {
    const base = matchRoute(location);
    if (!base) return null;

    const params = new URLSearchParams(search);
    const from = params.get('from');

    // /portal/(admin|teacher)/lesson-notes/preview/:id?from=edit
    const previewMatch = location.match(/^(\/portal\/(?:admin|teacher))\/lesson-notes\/preview\/([^/?]+)/);
    if (previewMatch && from === 'edit') {
      const portalBase = previewMatch[1];
      const noteId = previewMatch[2];
      const listLabel = portalBase.includes('admin') ? 'Lesson Notes Review' : 'My Lesson Notes';
      const listHref  = `${portalBase}/lesson-notes`;
      const editHref  = `${portalBase}/lesson-notes/edit/${noteId}`;
      return [
        { label: 'Dashboard', href: portalBase },
        { label: listLabel,   href: listHref },
        { label: 'Edit Note', href: editHref },
        { label: 'Preview Note' },
      ];
    }

    return base;
  }

  const crumbs = resolvecrumbs();
  if (!crumbs || crumbs.length <= 1) return null;

  const parentHref = getParentHref(crumbs);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 mb-4 sm:mb-5"
      data-testid="breadcrumb-nav"
    >
      {/* Breadcrumb trail */}
      <ol className="flex items-center gap-1 overflow-hidden min-w-0" aria-label="breadcrumb">
        <li className="flex-shrink-0 hidden sm:flex items-center">
          <Home className="h-3.5 w-3.5 text-muted-foreground" />
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const isFirst = index === 0;
          return (
            <li key={index} className={`flex items-center gap-1 ${isLast ? 'min-w-0' : 'flex-shrink-0'} ${isFirst ? 'hidden sm:flex' : 'flex'}`}>
              {(index > 0 || !isFirst) && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
              )}
              {isLast || !crumb.href ? (
                <span
                  className={`text-xs font-medium truncate ${isLast ? 'text-foreground' : 'text-muted-foreground'}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-2 flex-shrink-0"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
