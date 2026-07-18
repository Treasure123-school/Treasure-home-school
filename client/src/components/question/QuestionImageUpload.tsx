import { useRef, useState } from "react";
import { getApiUrl } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, RefreshCw, Loader2 } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface QuestionImageUploadProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function QuestionImageUpload({ value, onChange, disabled }: QuestionImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const openPicker = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after removal
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum allowed size is 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadType", "question");

      const token = localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }

      const { url } = await res.json();
      onChange(url);
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/70">
        Question Image{" "}
        <span className="text-muted-foreground font-normal">(optional — JPG, PNG, WebP · max 5 MB)</span>
      </Label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || uploading}
        data-testid="question-image-input"
      />

      {value ? (
        /* Preview */
        <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30 max-h-56">
          <img
            src={value}
            alt="Question image preview"
            className="w-full max-h-56 object-contain"
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs shadow"
              onClick={openPicker}
              disabled={disabled || uploading}
              title="Replace image"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs shadow"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
              title="Remove image"
              data-testid="question-image-remove"
            >
              <X className="w-3 h-3 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        /* Upload button */
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || uploading}
          data-testid="question-image-upload-btn"
          className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors py-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">Click to attach an image</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
