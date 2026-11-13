import {
  BarChart3, ClipboardList, FileBarChart2, Database, Eye,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Exams & CBT
// ─────────────────────────────────────────────
export default function ExamsCBTSection() {
  const { isLoading } = useAdminSettings();

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Exam Management" description="Configure exams, CBT sessions, and results" icon={ClipboardList}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Management" description="Create and manage exams" icon={ClipboardList} href="/portal/admin/exams" />
          <QuickLinkCard title="Exam Sessions" description="Monitor active CBT sessions" icon={Eye} href="/portal/admin/exam-sessions" />
          <QuickLinkCard title="Question Banks" description="Manage question bank items" icon={Database} href="/portal/admin/question-bank" />
        </div>
      </SettingCard>

      <SettingCard title="Result Controls" description="Control how results are released and reported" icon={FileBarChart2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Results" description="View and publish exam results" icon={BarChart3} href="/portal/admin/exam-results" />
          <QuickLinkCard title="Report Cards" description="Manage student report cards" icon={FileBarChart2} href="/portal/admin/reports" />
        </div>
      </SettingCard>
    </div>
  );
}
