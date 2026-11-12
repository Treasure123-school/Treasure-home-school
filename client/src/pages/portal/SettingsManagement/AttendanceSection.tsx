
import { Card, CardContent } from '@/components/ui/card';
import {
  Settings, Building2, CalendarCheck,
} from 'lucide-react';
import { SettingCard, QuickLinkCard } from './components';
// SECTION: Attendance Settings
// ─────────────────────────────────────────────
export default function AttendanceSection() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30 dark:border-primary/30 bg-primary/5 dark:bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/5">
              <CalendarCheck className="w-4 h-4 text-primary dark:text-primary/70" />
            </div>
            <div>
              <p className="font-medium text-sm text-primary dark:text-primary/60">Attendance is module-managed</p>
              <p className="text-xs text-primary dark:text-primary/70 mt-1">Attendance status types (Present, Absent, Late, Excused) are built-in. Recording permissions and visibility are controlled per-teacher via the Attendance management page.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Attendance Management" description="Record, review, and export attendance data" icon={CalendarCheck}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Attendance Overview" description="School-wide attendance dashboard" icon={CalendarCheck} href="/portal/admin/attendance" />
          <QuickLinkCard title="Class Management" description="Configure classes and teachers" icon={Building2} href="/portal/admin/classes" />
        </div>
      </SettingCard>
    </div>
  );
}
