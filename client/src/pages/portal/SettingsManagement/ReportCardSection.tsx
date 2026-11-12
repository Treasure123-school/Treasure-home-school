import { useState, useEffect } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Settings, FileText, FileBarChart2, Shield, Save, Loader2, Lock, Stamp,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, SwitchRow, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Report Card Settings
// ─────────────────────────────────────────────
export default function ReportCardSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(true);
  const [autoCreate, setAutoCreate] = useState(true);

  useEffect(() => {
    if (settings) {
      setShowGradeBreakdown(settings.showGradeBreakdown ?? true);
      setAutoCreate(settings.autoCreateReportCard ?? true);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Report Card Configuration" description="How report cards are generated and displayed to students and parents" icon={FileBarChart2}>
        <div className="space-y-1">
          <SwitchRow id="rc-autoCreate" label="Auto-create Report Cards" description="Automatically generate report cards when a term is configured" checked={autoCreate} onCheckedChange={setAutoCreate} />
          <SwitchRow id="rc-gradeBreakdown" label="Show CA / Exam Breakdown" description="Display separate CA and exam scores alongside the total score" checked={showGradeBreakdown} onCheckedChange={setShowGradeBreakdown} />
        </div>
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={() => save.mutate({ showGradeBreakdown, autoCreateReportCard: autoCreate })} disabled={save.isPending} data-testid="button-save-report-card">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Signature & Stamp" description="Principal signature and school stamp are configured by Super Admin in Branding" icon={Shield}>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
          <Lock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Managed by Super Admin</p>
            <p className="text-xs text-muted-foreground mt-0.5">School logo, principal signature, and school stamp are uploaded and managed in the Super Admin Branding section. The Designated Principal is set in Super Admin Settings.</p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Report Card Actions" description="View, publish, and manage student report cards" icon={FileBarChart2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Report Cards" description="View and publish report cards" icon={FileBarChart2} href="/portal/admin/reports" />
          <QuickLinkCard title="Report Comments" description="Manage comment templates" icon={FileText} href="/portal/admin/report-comments" />
        </div>
      </SettingCard>
    </div>
  );
}
