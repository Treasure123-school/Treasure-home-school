import {
  Database, RefreshCw, Download, Upload,
} from 'lucide-react';
import { SettingCard, QuickLinkCard } from './components';
// SECTION: Data Management
// ─────────────────────────────────────────────
export default function DataManagementSection() {
  return (
    <div className="space-y-4">
      <SettingCard title="Data Import" description="Bulk import students, teachers, classes, and results" icon={Upload}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Import Students" description="Upload CSV to bulk-create students" icon={Upload} href="/portal/admin/students" />
          <QuickLinkCard title="Import Results" description="Upload exam results via CSV" icon={Upload} href="/portal/admin/reports" />
        </div>
      </SettingCard>

      <SettingCard title="Data Export" description="Download reports and records as files" icon={Download}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Export Students" description="Download student list as CSV" icon={Download} href="/portal/admin/students" />
          <QuickLinkCard title="Export Attendance" description="Download attendance records" icon={Download} href="/portal/admin/attendance" />
          <QuickLinkCard title="Export Results" description="Download exam results" icon={Download} href="/portal/admin/exam-results" />
          <QuickLinkCard title="Export Report Cards" description="Download report cards as PDF" icon={Download} href="/portal/admin/reports" />
        </div>
      </SettingCard>

      <SettingCard title="Backup & Restore" description="Database backup and restore operations (Super Admin)" icon={Database}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Backup & Restore" description="Create and restore database backups" icon={Database} href="/portal/superadmin/settings/backup" />
          <QuickLinkCard title="Audit Logs" description="View system-wide activity logs" icon={RefreshCw} href="/portal/admin/audit-logs" />
        </div>
      </SettingCard>
    </div>
  );
}
