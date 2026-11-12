import { Switch } from '@/components/ui/switch';
import { Bot, Check, Info } from 'lucide-react';

interface AutomationBannerProps {
  enabled: boolean;
  isAdmin: boolean;
  isPending: boolean;
  onToggle: (v: boolean) => void;
}

export function AutomationBanner({ enabled, isAdmin, isPending, onToggle }: AutomationBannerProps) {
  return (
    <div className={`rounded-xl border-2 transition-colors overflow-hidden ${
      enabled ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'
    }`} data-testid="banner-automation">
      {/* Header row */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${
        enabled ? 'bg-amber-50/80 dark:bg-amber-900/10' : 'bg-slate-50/80 dark:bg-slate-800/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${enabled ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-200 dark:bg-slate-700/50'}`}>
          <Bot className={`h-5 w-5 ${enabled ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${enabled ? 'text-amber-900 dark:text-amber-300' : 'text-foreground'}`}>
            Academic Calendar Automation — {enabled ? 'Auto Mode' : 'Manual Mode'}
          </p>
          <p className={`text-xs mt-0.5 ${enabled ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {enabled
              ? 'Sessions and terms activate automatically when their start date is reached (checked daily at midnight).'
              : 'No automatic switching. You control which session and term are active at all times.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">{enabled ? 'Auto' : 'Manual'}</span>
            <Switch data-testid="switch-auto-detect" checked={enabled} onCheckedChange={onToggle} disabled={isPending} />
          </div>
        )}
      </div>
      {/* Detail bullets */}
      <div className={`border-t px-4 py-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs ${
        enabled ? 'border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/5'
                : 'border-slate-100 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/20'
      }`}>
        {enabled ? (
          <>
            <div className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span className="text-muted-foreground">Status transitions run at midnight daily</span></div>
            <div className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span className="text-muted-foreground">Term/session becomes active on its start date</span></div>
            <div className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span className="text-muted-foreground">Completed items are archived when their end date passes</span></div>
            <div className="flex items-start gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /><span className="text-muted-foreground">Admins can still override manually at any time</span></div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2"><Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="text-muted-foreground">Use <strong className="text-foreground">Set as Current</strong> on a session to make it active</span></div>
            <div className="flex items-start gap-2"><Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="text-muted-foreground">Use <strong className="text-foreground">Set as Current</strong> on a term to make it active</span></div>
            <div className="flex items-start gap-2"><Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="text-muted-foreground">Use <strong className="text-foreground">Deactivate</strong> to clear the active state</span></div>
            <div className="flex items-start gap-2"><Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span className="text-muted-foreground">No automatic transitions will occur until re-enabled</span></div>
          </>
        )}
      </div>
    </div>
  );
}
