import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3, ClipboardList, FileBarChart2, CreditCard, Database, Save, Loader2, Eye,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, SwitchRow, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Exams & CBT
// ─────────────────────────────────────────────
export default function ExamsCBTSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [requirePayment, setRequirePayment] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);

  useEffect(() => {
    if (settings) {
      setRequirePayment(settings.requireExamPayment ?? false);
      setFeeAmount(settings.examFeeAmount ?? 0);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Exam Fee Payment" description="Control whether students must pay before they can access exams" icon={CreditCard}>
        <div className="space-y-4">
          <SwitchRow id="requireExamPayment" label="Require Exam Fee Payment" description="Students must pay the exam fee before their exams are unlocked" checked={requirePayment} onCheckedChange={setRequirePayment} />
          {requirePayment && (
            <div className="space-y-1.5 pl-1">
              <Label htmlFor="examFeeAmount">Exam Fee Amount (₦)</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input id="examFeeAmount" type="number" min="0" value={feeAmount} onChange={e => setFeeAmount(parseInt(e.target.value) || 0)} data-testid="input-exam-fee-amount" />
              </div>
            </div>
          )}
          <Button size="sm" onClick={() => save.mutate({ requireExamPayment: requirePayment, examFeeAmount: feeAmount })} disabled={save.isPending} data-testid="button-save-exam-payment">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Exam Management" description="Configure exams, CBT sessions, and results" icon={ClipboardList}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Management" description="Create and manage exams" icon={ClipboardList} href="/portal/admin/exams" />
          <QuickLinkCard title="Exam Sessions" description="Monitor active CBT sessions" icon={Eye} href="/portal/admin/exam-sessions" />
          <QuickLinkCard title="Payment Records" description="View and manage exam fee payments" icon={CreditCard} href="/portal/admin/exam-payments" />
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
