import { useState, useEffect, useRef, useMemo } from 'react';
import type { HomePageContent } from '@shared/schema';

interface HeroCarouselProps {
  images: HomePageContent[];
  isLoading: boolean;
  autoRotateInterval?: number;
  transitionDuration?: number;
}

const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

const HeroSkeleton = () => (
  <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-white/20">
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="space-y-3">
        <h3 className="text-3xl lg:text-4xl font-bold text-white animate-pulse">
          School Management System
        </h3>
        <p className="text-xl lg:text-2xl text-yellow-300 font-semibold animate-pulse" style={{ animationDelay: '0.2s' }}>
          Excellence in Education
        </p>
        <p className="text-lg lg:text-xl text-blue-100 animate-pulse" style={{ animationDelay: '0.4s' }}>
          &amp; Moral Excellence
        </p>
      </div>
      <div className="flex space-x-2 mt-4">
        <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" />
        <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
        <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
      </div>
    </div>
  </div>
);

const NavigationDots = ({
  count,
  currentIndex,
  onDotClick
}: {
  count: number;
  currentIndex: number;
  onDotClick: (index: number) => void;
}) => {
  if (count <= 1) return null;

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick(index)}
          className={`transition-all duration-300 rounded-full ${
            currentIndex === index
              ? 'w-6 h-2 bg-white shadow-lg'
              : 'w-2 h-2 bg-white/50 hover:bg-white/75'
          }`}
          aria-label={`Go to image ${index + 1}`}
          data-testid={`button-hero-dot-${index}`}
          type="button"
        />
      ))}
    </div>
  );
};

const CaptionOverlay = ({ caption }: { caption: string | null }) => {
  if (!caption) return null;

  return (
    <div className="absolute bottom-16 left-6 right-6 text-white pointer-events-none">
      <p className="text-sm lg:text-base font-medium bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
        {caption}
      </p>
    </div>
  );
};

export function HeroCarousel({
  images,
  isLoading,
  autoRotateInterval = 5000,
  transitionDuration = 1000
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const validImages = useMemo(
    () => images.filter(img => img.isActive && img.imageUrl),
    [images]
  );

  const currentImage = validImages[currentIndex];
  const nextImage = nextIndex !== null ? validImages[nextIndex] : validImages[currentIndex];

  const preloadNextImage = (index: number) => {
    if (validImages.length <= 1) return;
    const nextIdx = (index + 1) % validImages.length;
    const img = validImages[nextIdx];
    if (img?.imageUrl) {
      preloadImage(img.imageUrl).catch(() => {
        console.warn(`Failed to preload image: ${img.imageUrl}`);
      });
    }
  };

  const advanceCarousel = (targetIndex: number) => {
    if (targetIndex === currentIndex || nextIndex !== null) return;
    setNextIndex(targetIndex);
    preloadNextImage(targetIndex);
    setTimeout(() => {
      setCurrentIndex(targetIndex);
      setNextIndex(null);
    }, transitionDuration);
  };

  useEffect(() => {
    if (!isLoading && validImages.length > 1) {
      autoRotateTimerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const nextIdx = (prev + 1) % validImages.length;
          setNextIndex(nextIdx);
          preloadNextImage(nextIdx);
          setTimeout(() => {
            setCurrentIndex(nextIdx);
            setNextIndex(null);
          }, transitionDuration);
          return prev;
        });
      }, autoRotateInterval);

      return () => {
        if (autoRotateTimerRef.current) {
          clearInterval(autoRotateTimerRef.current);
        }
      };
    }
  }, [validImages.length, isLoading, autoRotateInterval, transitionDuration]);

  if (isLoading || validImages.length === 0) {
    return <HeroSkeleton />;
  }

  return (
    <div className="relative max-w-lg mx-auto lg:max-w-none">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-500/20 to-blue-600/20">
          {/* Current image - always visible */}
          {currentImage?.imageUrl && (
            <img
              src={currentImage.imageUrl}
              alt={currentImage.altText || 'School hero image'}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          )}

          {/* Next image - mixes into current */}
          {nextImage?.imageUrl && (
            <img
              src={nextImage.imageUrl}
              alt={nextImage.altText || 'School hero image'}
              className={`
                absolute inset-0 w-full h-full object-cover
                transition-opacity duration-1000 ease-in-out
                ${nextIndex !== null ? 'opacity-100' : 'opacity-0'}
              `}
              loading="eager"
              decoding="async"
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        <NavigationDots
          count={validImages.length}
          currentIndex={currentIndex}
          onDotClick={advanceCarousel}
        />

        <div>
          {currentImage && <CaptionOverlay caption={currentImage.caption} />}
        </div>
      </div>
    </div>
  );
}

export default HeroCarousel;
