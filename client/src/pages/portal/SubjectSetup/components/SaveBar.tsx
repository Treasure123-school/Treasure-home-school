import { Button } from '@/components/ui/button';
import { Save, Loader2, X, Circle } from 'lucide-react';

interface SaveBarProps {
  pendingCount: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ pendingCount, isSaving, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 sm:px-0">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg shadow-black/8 dark:shadow-black/30">
        {/* Dot indicator */}
        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />

        {/* Label */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={isSaving}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Discard</span>
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-7 px-3 text-xs gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Saving…</span>
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
