import { Button } from '@/components/ui/button';
import { Save, Loader2, Info } from 'lucide-react';

interface SaveBarProps {
  pendingCount: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ pendingCount, isSaving, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 shadow-xl shadow-black/10 dark:shadow-black/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Unsaved changes</p>
            <p className="text-xs text-muted-foreground">
              {pendingCount} modification{pendingCount !== 1 ? 's' : ''} pending
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={isSaving} className="h-8 px-3 text-xs">
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving} className="h-8 px-4 text-xs gap-1.5 shadow-sm">
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
