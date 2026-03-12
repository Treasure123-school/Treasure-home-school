import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/config/api';

interface FileUploadProps {
  type: 'profile' | 'gallery';
  userId?: string;
  categoryId?: number;
  onUploadSuccess?: (result: any) => void;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
}
export function FileUpload({ 
  type, 
  userId, 
  categoryId, 
  onUploadSuccess, 
  maxSizeMB = 5,
  accept = "image/*",
  className = ""
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please select a file smaller than ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    
    // Standardize field name to 'file' for centralized API
    formData.append('file', selectedFile);
    formData.append('uploadType', type);
    
    if (type === 'profile') {
      formData.append('userId', userId || '');
    } else {
      formData.append('caption', caption);
      if (categoryId) {
        formData.append('categoryId', categoryId.toString());
      }
      if (userId) {
        formData.append('uploadedBy', userId);
      }
    }

    try {
      const token = localStorage.getItem('token');
      console.log(`📤 [UPLOAD] Starting ${type} upload...`);
      
      const response = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        body: formData,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'The server was unable to process your upload. Please check your connection and try again.');
      }
      
      toast({
        title: "Success",
        description: `${type === 'profile' ? 'Profile image' : 'Gallery image'} has been updated successfully.`,
      });

      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess?.(result);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              Upload {type === 'profile' ? 'Profile Image' : 'Gallery Image'}
            </Label>
            <span className="text-sm text-muted-foreground">
              Max size: {maxSizeMB}MB
            </span>
          </div>

          {!selectedFile ? (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="file-upload-dropzone"
            >
              <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Click to upload image
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG, GIF up to {maxSizeMB}MB
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                data-testid="file-upload-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={preview!}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                  data-testid="file-preview"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemove}
                  data-testid="file-remove-button"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-sm text-gray-600">
                <p><strong>File:</strong> {selectedFile.name}</p>
                <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              {type === 'gallery' && (
                <div className="space-y-2">
                  <Label htmlFor="caption">Caption (optional)</Label>
                  <Textarea
                    id="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Enter a caption for this image..."
                    className="min-h-[80px]"
                    data-testid="gallery-caption-input"
                  />
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
                data-testid="upload-submit-button"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {type === 'profile' ? 'Profile Image' : 'to Gallery'}
                  </>
                )}
              </Button>
            </div>
          )}

          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            data-testid="file-input"
          />
        </div>
      </CardContent>
    </Card>
  );
}