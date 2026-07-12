import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZoomIn, X } from "lucide-react";

interface QuestionImageDisplayProps {
  imageUrl: string;
  alt?: string;
  /** Faint watermark text shown on the loading skeleton (school acronym) */
  schoolAcronym?: string;
}

/**
 * Renders a question image with:
 * - Lazy loading via IntersectionObserver
 * - Faint school-acronym watermark on the skeleton placeholder
 * - Click-to-expand lightbox
 * - Preserves aspect ratio, responsive on all screen sizes
 * - Works offline: once loaded, image stays in browser cache
 */
export function QuestionImageDisplay({ imageUrl, alt = "Question image", schoolAcronym }: QuestionImageDisplayProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver-based lazy loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: load immediately
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Image container */}
      <div
        ref={containerRef}
        className="relative my-3 rounded-lg overflow-hidden border border-border/50 bg-muted/20 cursor-pointer group"
        onClick={() => !error && setLightboxOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !error && setLightboxOpen(true)}
        aria-label="Tap to enlarge image"
        data-testid="question-image-container"
      >
        {/* Skeleton placeholder shown while not in view or loading */}
        {(!loaded || !inView) && !error && (
          <div className="flex items-center justify-center min-h-[120px] sm:min-h-[160px] animate-pulse bg-muted/40 rounded-lg">
            {schoolAcronym && (
              <span
                className="absolute select-none pointer-events-none text-4xl sm:text-5xl font-black tracking-widest text-foreground/5 uppercase"
                aria-hidden="true"
              >
                {schoolAcronym}
              </span>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center min-h-[100px] text-muted-foreground gap-2 p-4">
            <span className="text-xs">Image could not be loaded</span>
            {schoolAcronym && (
              <span className="text-xs font-semibold opacity-30 uppercase tracking-widest">{schoolAcronym}</span>
            )}
          </div>
        )}

        {/* Actual image — rendered as soon as in-view */}
        {inView && !error && (
          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className={`w-full max-h-72 sm:max-h-80 object-contain rounded-lg transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0 absolute inset-0 w-0 h-0"
            }`}
            data-testid="question-image"
          />
        )}

        {/* Zoom hint overlay on hover */}
        {loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-black/10 rounded-lg pointer-events-none">
            <div className="bg-black/60 rounded-full p-2">
              <ZoomIn className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-3xl p-2 sm:p-3 flex flex-col items-center"
          data-testid="question-image-lightbox"
        >
          {/* Close button */}
          <button
            className="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image preview"
          >
            <X className="w-4 h-4" />
          </button>
          <img
            src={imageUrl}
            alt={alt}
            className="max-h-[85vh] w-full object-contain rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
