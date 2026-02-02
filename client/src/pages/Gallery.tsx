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
              <div className="flex-1 w-full lg:w-1/2 rounded-lg overflow-hidden shadow-md h-[400px]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15848.48911295384!2d3.220197479532822!3d6.75510688632612!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103b987621c166d1%3A0xcb1b5e5899c7c25c!2sSeriki%20Sotinka%2C%20Ogun%20State%2C%20Nigeria!5e0!3m2!1sen!2sng!4v1706886326120!5m2!1sen!2sng"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Treasure-Home School Location"
                ></iframe>
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
