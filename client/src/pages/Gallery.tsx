import { useState } from 'react';
import PublicLayout from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Images, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import heroStudents from "@/assets/hero-students.png";

interface GalleryImage {
  id: number;
  imageUrl: string;
  title?: string;
  eventName?: string;
  altText?: string;
  caption?: string;
  categoryId?: number;
  displayOrder: number;
}

interface GalleryCategory {
  id: number;
  name: string;
}

interface SettingsData {
  schoolName: string;
  schoolAddress: string;
}

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: settings } = useQuery<SettingsData>({ queryKey: ['/api/public/settings'] });
  const { data: categories = [] } = useQuery<GalleryCategory[]>({ queryKey: ['/api/public/gallery/categories'] });
  const { data: images = [], isLoading } = useQuery<GalleryImage[]>({ queryKey: ['/api/public/gallery'] });

  const schoolName = settings?.schoolName || '';

  const filtered = selectedCategory
    ? images.filter(img => img.categoryId === selectedCategory)
    : images;

  const sorted = [...filtered].sort((a, b) => a.displayOrder - b.displayOrder);

  function openLightbox(idx: number) {
    setLightboxIndex(idx);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function prevImage() {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + sorted.length) % sorted.length);
  }

  function nextImage() {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % sorted.length);
  }

  return (
    <PublicLayout>
      {/* Page Header */}
      <section className="relative h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroStudents} alt="School Banner" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="container relative z-10 text-center text-white px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-4"
            data-testid="text-gallery-title"
          >
            School Gallery
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-gray-200"
            data-testid="text-gallery-description"
          >
            Moments captured from our school community
          </motion.p>
        </div>
      </section>

      <div className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setSelectedCategory(null)}
              >
                All Photos
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setSelectedCategory(cat.id)}
                  data-testid={`filter-category-${cat.id}`}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}

          {/* Gallery Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Images className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No photos available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {sorted.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index % 4) * 0.1 }}
                  data-testid={`gallery-image-${image.id}`}
                >
                  <Card
                    className="overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-500 rounded-none cursor-pointer group"
                    onClick={() => openLightbox(index)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                        <img
                          src={image.imageUrl}
                          alt={image.altText || image.title || 'Gallery photo'}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                      </div>
                      {(image.title || image.eventName) && (
                        <div className="p-2 bg-white">
                          {image.title && <p className="text-xs font-medium text-gray-800 truncate">{image.title}</p>}
                          {image.eventName && <p className="text-xs text-gray-500 truncate">{image.eventName}</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Bottom Call to Action */}
          <section className="mt-24 py-16 border-t border-gray-100">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 w-full lg:w-1/2 rounded-lg overflow-hidden shadow-md h-[400px]">
                <iframe
                  src="https://maps.google.com/maps?q=Treasure-Home+School,+Seriki,+Ifo+112104,+Ogun+State,+Nigeria&output=embed&z=15"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${schoolName} Location`}
                />
              </div>
              <div className="flex-1 text-left space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Need more information<br />about our school?
                </h2>
                <p className="text-gray-600">
                  Do you want to know more about us? Get in touch via our contact page.
                </p>
                <Button asChild className="btn-primary rounded-none px-8 py-6 h-auto text-sm font-bold bg-primary hover:bg-primary/90 uppercase tracking-wider">
                  <Link href="/contact">Contact Us &rarr;</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && sorted[lightboxIndex] && (
        <Dialog open onOpenChange={closeLightbox}>
          <DialogContent className="max-w-4xl p-0 bg-black border-none overflow-hidden">
            <button
              className="absolute top-3 right-3 z-50 p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white"
              onClick={closeLightbox}
              data-testid="button-close-lightbox"
            >
              <X className="h-5 w-5" />
            </button>
            {sorted.length > 1 && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white"
                  onClick={prevImage}
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white"
                  onClick={nextImage}
                  data-testid="button-next-image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <div className="flex flex-col items-center">
              <img
                src={sorted[lightboxIndex].imageUrl}
                alt={sorted[lightboxIndex].altText || sorted[lightboxIndex].title || 'Gallery photo'}
                className="max-h-[80vh] w-full object-contain"
                data-testid="lightbox-image"
              />
              {(sorted[lightboxIndex].title || sorted[lightboxIndex].caption) && (
                <div className="w-full p-4 text-white text-center">
                  {sorted[lightboxIndex].title && <p className="font-semibold">{sorted[lightboxIndex].title}</p>}
                  {sorted[lightboxIndex].caption && <p className="text-sm text-gray-300 mt-1">{sorted[lightboxIndex].caption}</p>}
                </div>
              )}
              <p className="text-gray-500 text-xs pb-3">{lightboxIndex + 1} / {sorted.length}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PublicLayout>
  );
}
