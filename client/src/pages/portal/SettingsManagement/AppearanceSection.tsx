import { useQuery } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import {
  Building2, FileText, Palette, Edit, Globe,
} from 'lucide-react';
import { SystemSettings } from './types';
import { SettingCard, QuickLinkCard } from './components';
// SECTION: Appearance
// ─────────────────────────────────────────────
export default function AppearanceSection() {
  const { data: settings } = useQuery<SystemSettings>({ queryKey: ['/api/admin/settings'] });

  return (
    <div className="space-y-4">
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-purple-800 dark:text-purple-300">Branding managed by Super Admin</p>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Logo, favicon, theme colour and full branding customization are controlled in the Super Admin Branding section for consistency across the platform.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Current Branding" description="Active branding configuration for this school" icon={Palette}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            {settings?.schoolLogo ? (
              <img src={settings.schoolLogo} alt="School Logo" className="h-12 w-12 object-contain rounded" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center"><Building2 className="w-6 h-6 text-muted-foreground" /></div>
            )}
            <span className="text-xs text-muted-foreground">School Logo</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `var(--primary)` }}>
              <Palette className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-muted-foreground">Theme Colour</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {settings?.schoolShortName || 'THS'}
            </div>
            <span className="text-xs text-muted-foreground">Short Name</span>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Branding Controls" description="Access Super Admin branding settings" icon={Palette}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Branding & Theme" description="Logo, favicon, theme colour" icon={Palette} href="/portal/superadmin/settings/branding" />
          <QuickLinkCard title="Homepage Management" description="Edit the public homepage content" icon={Globe} href="/portal/admin/homepage" />
          <QuickLinkCard title="Gallery" description="Manage the public photo gallery" icon={Building2} href="/portal/admin/gallery" />
          <QuickLinkCard title="About Page" description="Edit the About Us page content" icon={FileText} href="/portal/admin/about-page" />
        </div>
      </SettingCard>
    </div>
  );
}
