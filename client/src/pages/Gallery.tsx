import PublicLayout from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import heroStudents from "@/assets/hero-students.png";
import gallery1 from "@/assets/gallery-1.png";
import gallery2 from "@/assets/gallery-2.png";
import gallery3 from "@/assets/gallery-3.png";
import gallery4 from "@/assets/gallery-4.png";
import gallery5 from "@/assets/gallery-5.png";
import gallery6 from "@/assets/gallery-6.png";

interface SettingsData {
  schoolName: string;
}

export default function Gallery() {
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";

  const images = [
    { id: 1, src: gallery1, alt: 'School Activity 1' },
    { id: 2, src: gallery2, alt: 'School Activity 2' },
    { id: 3, src: gallery3, alt: 'School Activity 3' },
    { id: 4, src: gallery4, alt: 'School Activity 4' },
    { id: 5, src: gallery5, alt: 'School Activity 5' },
    { id: 6, src: gallery6, alt: 'School Activity 6' },
    { id: 7, src: gallery2, alt: 'School Activity 7' },
    { id: 8, src: gallery3, alt: 'School Activity 8' },
    { id: 9, src: gallery1, alt: 'School Activity 9' },
    { id: 10, src: gallery4, alt: 'School Activity 10' },
    { id: 11, src: gallery5, alt: 'School Activity 11' },
    { id: 12, src: gallery6, alt: 'School Activity 12' },
  ];

  return (
    <PublicLayout>
      {/* Page Header with School Background */}
      <section className="relative h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroStudents}
            alt="School Banner"
            className="w-full h-full object-cover object-center"
          />
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
            Here are some of the pictures of our students.
          </motion.p>
        </div>
      </section>

      <div className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Gallery Grid - Responsive grid layout matching sample */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {images.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index % 4) * 0.1 }}
                data-testid={`gallery-image-${image.id}`}
              >
                <Card className="overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-500 rounded-none">
                  <CardContent className="p-0">
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Bottom Call to Action Section */}
          <section className="mt-24 py-16 border-t border-gray-100">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 w-full lg:w-1/2 rounded-lg overflow-hidden shadow-md">
                {/* Mock Map Placeholder matching sample */}
                <div className="bg-gray-50 h-[300px] flex items-center justify-center relative">
                  <div className="absolute inset-0 opacity-40 grayscale pointer-events-none">
                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Map pattern" className="w-full h-full object-cover" />
                  </div>
                  <div className="relative z-10 text-center p-8">
                     <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-4 h-4 bg-primary rounded-full animate-ping" />
                     </div>
                     <p className="font-semibold text-gray-900">Treasure-Home School Location</p>
                     <p className="text-sm text-gray-500">Seriki, Ogun State, Nigeria</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 text-left space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Need more information<br />about our school?
                </h2>
                <p className="text-gray-600">
                  Do you want to know more about us, get across to us via the contact page.
                </p>
                <Button asChild className="btn-primary rounded-none px-8 py-6 h-auto text-sm font-bold bg-[#D946EF] hover:bg-[#C026D3] uppercase tracking-wider">
                  <Link href="/contact">
                    Contact Us &rarr;
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
