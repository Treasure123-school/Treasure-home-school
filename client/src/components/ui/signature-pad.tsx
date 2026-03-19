import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Eraser, Check, Pen, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel?: () => void;
  initialSignature?: string | null;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  title?: string;
  saveButtonText?: string;
  isLoading?: boolean;
}

export function SignaturePad({
  onSave,
  onCancel,
  initialSignature,
  width = 400,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  title = 'Draw Your Signature',
  saveButtonText = 'Save Signature',
  isLoading = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  }, [penColor]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, [getContext, backgroundColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature, backgroundColor]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setLastPoint(coords);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = getContext();
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    setLastPoint(coords);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pen className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-md overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full cursor-crosshair touch-none"
            style={{ maxWidth: '100%', height: 'auto' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            data-testid="signature-canvas"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Use your mouse or finger to draw your signature above
        </p>
        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={isLoading}
            data-testid="button-clear-signature"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
              data-testid="button-cancel-signature"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!hasSignature || isLoading}
            data-testid="button-save-signature"
          >
            <Check className="w-4 h-4 mr-1" />
            {saveButtonText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SignatureDialogProps {
  trigger: React.ReactNode;
  onSave: (signatureDataUrl: string) => void;
  initialSignature?: string | null;
  title?: string;
  isLoading?: boolean;
}

export function SignatureDialog({
  trigger,
  onSave,
  initialSignature,
  title = 'Draw Your Signature',
  isLoading = false,
}: SignatureDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSave = (dataUrl: string) => {
    onSave(dataUrl);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <SignaturePad
          onSave={handleSave}
          onCancel={() => setOpen(false)}
          initialSignature={initialSignature}
          title=""
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SignatureDisplayProps {
  signatureUrl?: string | null;
  signerName?: string;
  signedAt?: string | Date | null;
  label?: string;
  showPlaceholder?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SignatureDisplay({
  signatureUrl,
  signerName,
  signedAt,
  label = 'Signature',
  showPlaceholder = true,
  size = 'md',
}: SignatureDisplayProps) {
  const sizeClasses = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-20',
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="text-center">
      <div className={`border-b-2 border-dashed border-muted-foreground/30 mb-2 ${sizeClasses[size]} flex items-end justify-center pb-1`}>
        {signatureUrl ? (
          <img 
            src={signatureUrl} 
            alt={`${label}`} 
            className="max-h-full object-contain"
            data-testid={`img-signature-${label.toLowerCase().replace(/\s+/g, '-')}`}
          />
        ) : showPlaceholder ? (
          <span className="text-lg font-serif italic text-muted-foreground/50">________________</span>
        ) : null}
      </div>
      <p className="text-sm font-medium">{label}</p>
      {signerName && (
        <p className="text-xs text-muted-foreground">{signerName}</p>
      )}
      {signedAt && (
        <p className="text-xs text-muted-foreground">{formatDate(signedAt)}</p>
      )}
    </div>
  );
}
