import { useLocation } from 'wouter';

import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, Users, FileText, Database, Info, Upload,
} from 'lucide-react';
import { SettingCard, QuickLinkCard } from './components';
// SECTION: Lesson Notes
// ─────────────────────────────────────────────
export default function LessonNotesSection() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Configuration via Management Pages</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Lesson note approval workflows, topic visibility, and submission rules are managed per-teacher and per-class via the Lesson Note management pages below.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Lesson & Scheme Management" description="Manage lesson notes, topics, and scheme of work" icon={FileText}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Lesson Notes" description="View and approve teacher lesson notes" icon={FileText} href="/portal/admin/lesson-notes" />
          <QuickLinkCard title="Syllabus & Topics" description="Manage scheme of work and topics" icon={GraduationCap} href="/portal/admin/syllabus" />
          <QuickLinkCard title="Teacher Assignments" description="Assign teachers to subjects and classes" icon={Users} href="/portal/admin/teacher-assignments" />
          <QuickLinkCard title="Study Resources" description="Upload and manage study materials" icon={Database} href="/portal/admin/study-resources" />
        </div>
      </SettingCard>
    </div>
  );
}
