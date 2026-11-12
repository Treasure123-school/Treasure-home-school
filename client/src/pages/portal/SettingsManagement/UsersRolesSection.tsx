import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings, Users, Shield, Save, Loader2, Info, Hash, Key,
} from 'lucide-react';
import { useAdminSettings } from './useSettings';
import { SettingCard, QuickLinkCard, SectionSkeleton } from './components';
// SECTION: Users & Roles
// ─────────────────────────────────────────────
export default function UsersRolesSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    usernameStudentPrefix: 'THS-STU',
    usernameParentPrefix: 'THS-PAR',
    usernameTeacherPrefix: 'THS-TCH',
    usernameAdminPrefix: 'THS-ADM',
    tempPasswordFormat: 'THS@{year}#{random4}',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        usernameStudentPrefix: settings.usernameStudentPrefix || 'THS-STU',
        usernameParentPrefix: settings.usernameParentPrefix || 'THS-PAR',
        usernameTeacherPrefix: settings.usernameTeacherPrefix || 'THS-TCH',
        usernameAdminPrefix: settings.usernameAdminPrefix || 'THS-ADM',
        tempPasswordFormat: settings.tempPasswordFormat || 'THS@{year}#{random4}',
      });
    }
  }, [settings]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Username Prefixes" description="Prefix prepended to auto-generated usernames for each role" icon={Hash}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'usernameStudentPrefix' as const, label: 'Student Prefix', example: 'THS-STU-001' },
            { key: 'usernameTeacherPrefix' as const, label: 'Teacher Prefix', example: 'THS-TCH-001' },
            { key: 'usernameParentPrefix' as const, label: 'Parent Prefix', example: 'THS-PAR-001' },
            { key: 'usernameAdminPrefix' as const, label: 'Admin Prefix', example: 'THS-ADM-001' },
          ].map(({ key, label, example }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} {...field(key)} data-testid={`input-${key}`} />
              <p className="text-xs text-muted-foreground">e.g. {form[key]}-001 → <strong>{example.replace('THS', form[key].split('-')[0] || 'THS')}</strong></p>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Temporary Password Format" description="Format used when a new account is created and a temporary password is generated" icon={Key}>
        <div className="space-y-2">
          <Input value={form.tempPasswordFormat} onChange={e => setForm(p => ({ ...p, tempPasswordFormat: e.target.value }))} data-testid="input-temp-password-format" />
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Available placeholders:</p>
              <p><code>{'{year}'}</code> → current year &nbsp;|&nbsp; <code>{'{random4}'}</code> → 4 random digits &nbsp;|&nbsp; <code>{'{random6}'}</code> → 6 random digits</p>
              <p className="mt-1">Example: <code>THS@{'{year}'}#{'{random4}'}</code> → <strong>THS@2025#7342</strong></p>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="User Management" description="Manage users, teachers, students, and parents" icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Student Management" description="Add, edit, block students" icon={Users} href="/portal/admin/students" />
          <QuickLinkCard title="Teacher Management" description="Add, verify, manage teachers" icon={Users} href="/portal/admin/teachers" />
          <QuickLinkCard title="Parent Management" description="Link parents to students" icon={Users} href="/portal/admin/parents" />
          <QuickLinkCard title="Roles & Permissions" description="Super admin manages global roles" icon={Shield} href="/portal/admin/dashboard" />
        </div>
      </SettingCard>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="button-save-users">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save User Settings
        </Button>
      </div>
    </div>
  );
}
