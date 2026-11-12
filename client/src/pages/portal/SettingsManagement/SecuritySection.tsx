import { useLocation } from 'wouter';

import { Card, CardContent } from '@/components/ui/card';
import {
  Settings, Users, Shield, Database, Key, AlertTriangle, Lock,
} from 'lucide-react';
import { SettingCard, QuickLinkCard } from './components';
// SECTION: Security
// ─────────────────────────────────────────────
export default function SecuritySection() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-4">
      <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-red-800 dark:text-red-300">Platform security managed by Super Admin</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">Password policies, session timeouts, MFA settings, and global access controls are platform-level and managed by the Super Admin.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Security Recommendations" description="Best practices for your school portal" icon={Shield}>
        <div className="space-y-3">
          {[
            { icon: Key, title: 'Strong Passwords', desc: 'Ensure all staff use the provided temp password on first login and change it immediately.' },
            { icon: Users, title: 'Regular User Audits', desc: 'Periodically review active accounts and suspend students who have left.' },
            { icon: Lock, title: 'Block Inactive Accounts', desc: 'Block student accounts after the exam season to prevent unauthorized access.' },
            { icon: AlertTriangle, title: 'Review Audit Logs', desc: 'Check audit logs regularly for any suspicious activity.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
              <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Security Controls" description="Access security settings and audit logs" icon={Shield}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Audit Logs" description="View all system activity logs" icon={Database} href="/portal/admin/audit-logs" />
          <QuickLinkCard title="Security Policies" description="Super Admin security configuration" icon={Shield} href="/portal/superadmin/settings/security" />
          <QuickLinkCard title="User Management" description="Block, suspend, or delete users" icon={Users} href="/portal/admin/students" />
          <QuickLinkCard title="Auth Settings" description="MFA and authentication options" icon={Key} href="/portal/superadmin/settings/authentication" />
        </div>
      </SettingCard>
    </div>
  );
}
