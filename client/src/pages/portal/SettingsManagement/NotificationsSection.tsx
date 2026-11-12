import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  CalendarCheck, Bell, Save, Loader2, Info,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, SwitchRow, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Notifications
// ─────────────────────────────────────────────
export default function NotificationsSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableSms, setEnableSms] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnableEmail(settings.enableEmailNotifications ?? true);
      setEnableSms(settings.enableSmsNotifications ?? false);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Notification Channels" description="Control which channels are active for sending alerts to students, teachers, and parents" icon={Bell}>
        <div className="space-y-1">
          <SwitchRow
            id="enableEmail"
            label="Email Notifications"
            description="Send result alerts, payment confirmations, and announcements via email (requires RESEND_API_KEY)"
            checked={enableEmail}
            onCheckedChange={setEnableEmail}
          />
          <SwitchRow
            id="enableSms"
            label="SMS Notifications"
            description="Send result alerts and payment confirmations via SMS (requires Twilio credentials)"
            checked={enableSms}
            onCheckedChange={setEnableSms}
          />
        </div>
        {(enableEmail || enableSms) && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground border">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>API keys for email (RESEND_API_KEY) and SMS (Twilio credentials) must be configured in the Secrets tab by the Super Admin for notifications to send.</span>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={() => save.mutate({ enableEmailNotifications: enableEmail, enableSmsNotifications: enableSms })} disabled={save.isPending} data-testid="button-save-notifications">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Announcement Distribution" description="Send announcements to specific audiences" icon={Bell}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Announcements" description="Create and publish announcements" icon={Bell} href="/portal/admin/announcements" />
          <QuickLinkCard title="Events Calendar" description="Schedule school events" icon={CalendarCheck} href="/portal/admin/events" />
        </div>
      </SettingCard>
    </div>
  );
}
