/**
 * PasteEnhanceDialog — wraps PasteEnhancePanel in a reusable Dialog modal.
 * Opens as a centred overlay; does not expand the editor layout.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PasteEnhancePanel from './PasteEnhancePanel';

interface PasteEnhanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onChange: (v: string) => void;
  onEnhance: () => void;
  onSmartConvert: () => void;
  loading: boolean;
  smartConverting: boolean;
}

export default function PasteEnhanceDialog({
  open,
  onOpenChange,
  text,
  onChange,
  onEnhance,
  onSmartConvert,
  loading,
  smartConverting,
}: PasteEnhanceDialogProps) {
  const busy = loading || smartConverting;

  const handleClose = () => {
    if (busy) return;
    onChange('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => { if (!v) handleClose(); else onOpenChange(true); }}
    >
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Paste &amp; Enhance</DialogTitle>
        </DialogHeader>

        <PasteEnhancePanel
          text={text}
          onChange={onChange}
          onEnhance={onEnhance}
          onSmartConvert={onSmartConvert}
          onClose={handleClose}
          loading={loading}
          smartConverting={smartConverting}
          showCloseButton={false}
        />
      </DialogContent>
    </Dialog>
  );
}
