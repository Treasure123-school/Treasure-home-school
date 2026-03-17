import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Slider } from './slider';
import { getCroppedImg } from '@/lib/cropImage';
import { Crop, ZoomIn, RotateCw } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
  shape?: 'rect' | 'round';
}
export function ImageCropDialog({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  shape = 'rect'
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteCallback = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) {
      alert('Please select a crop area');
      return;
    }
    try {
      setIsProcessing(true);
      
      // Validate crop area
      if (croppedAreaPixels.width <= 0 || croppedAreaPixels.height <= 0) {
        throw new Error('Invalid crop dimensions');
      }
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      
      if (!croppedBlob || croppedBlob.size === 0) {
        throw new Error('Failed to create cropped image blob');
      }
      onCropComplete(croppedBlob);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to crop image: ${errorMessage}\n\nPlease try:\n1. Selecting a larger crop area\n2. Using a different image\n3. Reloading the page`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] max-w-3xl p-4 sm:p-6 max-h-[95vh] flex flex-col gap-0" 
        data-testid="dialog-crop-image"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Crop Image
          </DialogTitle>
        </DialogHeader>

        <div 
          className="relative bg-gray-900 rounded-lg mb-4 w-full" 
          style={{ 
            height: 'clamp(300px, 55vh, 500px)'
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            cropShape={shape}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropCompleteCallback}
            showGrid={true}
            objectFit="contain"
          />
        </div>

        <div className="space-y-3 sm:space-y-4 pb-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                Zoom
              </label>
              <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
              data-testid="slider-zoom"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <RotateCw className="h-4 w-4" />
                Rotation
              </label>
              <span className="text-sm text-muted-foreground">{rotation}°</span>
            </div>
            <Slider
              value={[rotation]}
              onValueChange={(value) => setRotation(value[0])}
              min={0}
              max={360}
              step={1}
              className="w-full"
              data-testid="slider-rotation"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto"
            data-testid="button-cancel-crop"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCropConfirm}
            disabled={isProcessing || !croppedAreaPixels}
            className="w-full sm:w-auto transition-all duration-200 hover:scale-105 active:scale-95"
            data-testid="button-confirm-crop"
          >
            {isProcessing ? 'Processing...' : 'Crop & Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
