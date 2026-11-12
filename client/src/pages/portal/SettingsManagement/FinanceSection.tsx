import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCard, Save, Loader2, Key,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, SwitchRow, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Finance
// ─────────────────────────────────────────────
export default function FinanceSection() {
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
      <SettingCard title="Exam Fee Configuration" description="Set whether exam payment is required and the fee amount" icon={CreditCard}>
        <div className="space-y-4">
          <SwitchRow id="financeRequirePayment" label="Require Exam Fee Payment" description="Students cannot access exams until the fee is paid" checked={requirePayment} onCheckedChange={setRequirePayment} />
          {requirePayment && (
            <div className="space-y-1.5">
              <Label htmlFor="financeFeeAmount">Exam Fee Amount</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input id="financeFeeAmount" type="number" min="0" value={feeAmount} onChange={e => setFeeAmount(parseInt(e.target.value) || 0)} data-testid="input-finance-fee-amount" />
              </div>
            </div>
          )}
          <Button size="sm" onClick={() => save.mutate({ requireExamPayment: requirePayment, examFeeAmount: feeAmount })} disabled={save.isPending} data-testid="button-save-finance">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Payment Records" description="View, verify, and manage all exam fee payments" icon={CreditCard}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Payments" description="View and manage payment records" icon={CreditCard} href="/portal/admin/exam-payments" />
          <QuickLinkCard title="Integrations" description="Configure Paystack and Monnify keys" icon={Key} href="/portal/superadmin/settings/integrations" />
        </div>
      </SettingCard>
    </div>
  );
}
