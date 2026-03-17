import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Camera, Upload, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageCropDialog } from './image-crop-dialog';

interface ImageCaptureProps {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  required?: boolean;
  className?: string;
  shape?: 'circle' | 'square';
  existingImageUrl?: string | null;
  onRemove?: () => void;
}
export function ImageCapture({
  value,
  onChange,
  label = 'Upload Image',
  required = false,
  className = '',
  shape = 'circle',
  existingImageUrl = null,
  onRemove
}: ImageCaptureProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage preview URL lifecycle
  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      // Create a URL for cropping
      const imageUrl = URL.createObjectURL(file);
      setSelectedImageUrl(imageUrl);
      setShowDialog(false);
      setShowCropDialog(true);
      
      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    try {
      // Create a proper File object from the cropped blob
      const timestamp = Date.now();
      const file = new File(
        [croppedBlob], 
        `profile-image-${timestamp}.jpg`, 
        { type: 'image/jpeg', lastModified: timestamp }
      );
      
      // Update the parent component with the new file
      onChange(file);
      setShowCropDialog(false);
      
      // Clean up URL
      if (selectedImageUrl) {
        URL.revokeObjectURL(selectedImageUrl);
        setSelectedImageUrl(null);
      }
      toast({
        title: "✅ Photo Ready",
        description: "Your photo has been captured and cropped successfully.",
      });
    } catch (error) {
      toast({
        title: "Process Failed",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCropCancel = () => {
    setShowCropDialog(false);
    if (selectedImageUrl) {
      URL.revokeObjectURL(selectedImageUrl);
      setSelectedImageUrl(null);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className={`${
            shape === 'circle' ? 'rounded-full' : 'rounded-xl'
          } h-32 w-32 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700`}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover animate-in fade-in duration-300"
                data-testid="image-preview"
              />
            ) : existingImageUrl ? (
               <img
                src={existingImageUrl}
                alt="Existing"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera className="h-8 w-8 text-slate-400" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">No Photo</span>
              </div>
            )}
          </div>
          {(value || existingImageUrl) && (
            <button
              onClick={() => {
                if (value) onChange(null);
                else onRemove?.();
              }}
              className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-all scale-100 hover:scale-110 active:scale-95"
              data-testid="button-remove-image"
              title="Remove Photo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setShowDialog(true)}
            variant="outline"
            size="sm"
            className="rounded-full px-4 hover:border-primary/50 transition-colors"
            data-testid="button-upload-image"
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture / Upload
          </Button>
        </div>

        {value && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in slide-in-from-top-1 duration-200">
            <Check className="h-4 w-4" />
            <span>Ready to Save</span>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xs border-none shadow-2xl overflow-hidden p-0 dark:bg-slate-900">
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold tracking-tight">Add {label}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-3">
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="h-20 flex flex-col items-center justify-center gap-2 border-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50 transition-all bg-transparent"
                variant="outline"
                data-testid="button-start-camera"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">Take Photo</span>
              </Button>
              
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 flex flex-col items-center justify-center gap-2 border-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50 transition-all bg-transparent"
                variant="outline"
                data-testid="button-choose-file"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">Upload from Device</span>
              </Button>
            </div>
            
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowDialog(false)} className="text-slate-500 text-xs">
                Cancel
              </Button>
            </div>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="camera-input"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="file-input"
          />
        </DialogContent>
      </Dialog>

      {selectedImageUrl && (
        <ImageCropDialog
          open={showCropDialog}
          onClose={handleCropCancel}
          imageSrc={selectedImageUrl}
          onCropComplete={handleCropComplete}
          aspectRatio={shape === 'circle' ? 1 : 4 / 3}
          shape={shape === 'circle' ? 'round' : 'rect'}
        />
      )}
    </div>
  );
}
