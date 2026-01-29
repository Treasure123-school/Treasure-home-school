import PublicLayout from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Users, Award, GraduationCap, Star } from 'lucide-react';
import type { HomePageContent } from '@shared/schema';
import Typed from 'typed.js';
import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { motion } from 'framer-motion';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolAddress: string;
  websiteTitle?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.2
    }
  },
  viewport: { once: true, margin: "-100px" }
};

export default function Home() {
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    staleTime: 0,
    gcTime: 0,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Qualitative Education & Moral Excellence";
  const schoolAddress = settings?.schoolAddress || "Seriki-Soyinka, Ifo, Ogun State";
  const websiteTitle = settings?.websiteTitle || schoolName;

  useEffect(() => {
    if (websiteTitle) {
      document.title = websiteTitle;
    }
  }, [websiteTitle]);

  const { data: allHomePageContent = [], isLoading: contentLoading } = useQuery<HomePageContent[]>({
    queryKey: ['/api', 'public', 'homepage-content'],
    staleTime: 5 * 60 * 1000, 
  });

  const heroImages = allHomePageContent.filter(content => content.contentType === 'hero_image');
  const galleryPreviewImages = allHomePageContent.filter(content => 
    content.contentType === 'gallery_preview_1' || 
    content.contentType === 'gallery_preview_2' || 
    content.contentType === 'gallery_preview_3'
  );

  const { data: allAnnouncements = [] } = useQuery<any[]>({
    queryKey: ['/api', 'announcements'],
    staleTime: 2 * 60 * 1000,
  });

  const recentAnnouncements = allAnnouncements
    .filter((ann: any) => ann.isPublished && ann.publishedAt)
    .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 3);

  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  const features = [
    {
      icon: GraduationCap,
      title: 'Experienced & Qualified Teachers',
      description: 'Our dedicated educators provide personalized attention, nurturing every child’s unique potential through proven teaching methods.',
      color: 'primary'
    },
    {
      icon: Award,
      title: 'Approved & Accredited Curriculum',
      description: 'We follow a robust, modern curriculum that balances academic excellence with strong moral and character training.',
      color: 'secondary'
    },
    {
      icon: Star,
      title: 'Safe & Secure Learning Environment',
      description: 'A child-friendly campus designed for comfort, focus, and safety, ensuring your child learns in a protected space.',
      color: 'green'
    }
  ];

  const stats = [
    { value: '15+', label: 'Years of Excellence' },
    { value: '500+', label: 'Successful Graduates' },
    { value: '50+', label: 'Dedicated Staff' },
    { value: '100%', label: 'Safety Commitment' }
  ];

  const dynamicGalleryImages = galleryPreviewImages
    .filter(img => img.isActive && img.imageUrl)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 4)
    .map(img => ({
      src: img.imageUrl!,
      alt: img.altText || img.caption || 'School gallery image'
    }));

  const fallbackGalleryImages = [
    {
      src: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300',
      alt: 'Students engaged in classroom learning'
    },
    {
      src: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300',
      alt: 'Students participating in sports activities'
    },
    {
      src: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300',
      alt: 'Students conducting science experiments'
    },
    {
      src: 'https://pixabay.com/get/g4b5de1b17360e7341ea05b3642f661cdaf69148acab371a0683000806209ef4e0fe83b5de589985b71b982913fd361ff36cf54100f89a9b6599375dc964cbe4e_1280.jpg',
      alt: 'Graduation ceremony with students and families'
    }
  ];

  const galleryImages = dynamicGalleryImages.length > 0 ? dynamicGalleryImages : fallbackGalleryImages;

  const nextGalleryImage = () => {
    setCurrentGalleryIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevGalleryImage = () => {
    setCurrentGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  useEffect(() => {
    if (galleryImages.length > 1) {
      const timer = setInterval(nextGalleryImage, 5000);
      return () => clearInterval(timer);
    }
  }, [galleryImages.length]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const typedElementRef = useRef<HTMLSpanElement>(null);
  const typedInstance = useRef<Typed | null>(null);

  useEffect(() => {
    if (typedElementRef.current) {
      if (typedInstance.current) {
        typedInstance.current.destroy();
      }
      typedInstance.current = new Typed(typedElementRef.current, {
        strings: ["Integrity", "Excellence", "Confidence", "Creativity", "Compassion"],
        typeSpeed: 80,
        backSpeed: 50,
        loop: true,
        backDelay: 2000,
        startDelay: 500,
        showCursor: true,
        cursorChar: "|",
        smartBackspace: true
      });
    }
    return () => {
      if (typedInstance.current) {
        typedInstance.current.destroy();
      }
    };
  }, []);

  return (
    <PublicLayout>
      <section className="relative min-h-[85vh] lg:min-h-[90vh] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 z-0"></div>
        <div className="absolute inset-0 opacity-10 z-0">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[75vh]">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-white order-2 lg:order-1 text-center lg:text-left space-y-8"
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-white leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal" data-testid="text-hero-tagline">
                <span className="block">
                  <span className="inline">Nurturing Bright Minds with</span>{' '}
                  <span className="inline-block align-baseline min-w-[200px] sm:min-w-[240px] lg:min-w-[300px]">
                    <span ref={typedElementRef} className="changing-text font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent"></span>
                  </span>
                </span>
              </h1>

              <p className="text-base sm:text-lg text-blue-100/90 leading-relaxed max-w-2xl mx-auto lg:mx-0" data-testid="text-hero-description">
                At {schoolName}, we provide qualitative education anchored on moral values and lifelong learning. Located in {schoolAddress}, we offer comprehensive education from Playgroup to Senior Secondary School — shaping confident, responsible, and successful learners.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center lg:justify-start pt-4">
                <Button 
                  asChild 
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 hover:from-yellow-500 hover:via-orange-500 hover:to-orange-600 text-gray-900 font-bold h-14 px-10 text-lg rounded-full shadow-2xl hover:shadow-3xl transform transition-all duration-300 hover:scale-105 border-0"
                  data-testid="button-apply-admission"
                >
                  <Link href="/admissions">Apply for Admission</Link>
                </Button>
                <Button 
                  asChild
                  size="lg"
                  variant="outline" 
                  className="border-2 border-white/80 bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-blue-600 hover:border-white font-bold h-14 px-10 text-lg rounded-full shadow-xl transition-all duration-300 hover:scale-105"
                  data-testid="button-contact-us"
                >
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="order-1 lg:order-2"
            >
              <HeroCarousel
                images={heroImages}
                isLoading={contentLoading}
                autoRotateInterval={5000}
                transitionDuration={700}
              />
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-16 lg:h-24 fill-current text-white" viewBox="0 0 1440 74" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,32L48,37.3C96,43,192,53,288,48C384,43,480,21,576,16C672,11,768,21,864,26.7C960,32,1056,32,1152,26.7C1248,21,1344,11,1392,5.3L1440,0L1440,74L1392,74C1344,74,1248,74,1152,74C1056,74,960,74,864,74C768,74,672,74,576,74C480,74,384,74,288,74C192,74,96,74,48,74L0,74Z"></path>
          </svg>
        </div>
      </section>

      <section className="section-gradient-light py-20 md:py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            {...fadeIn}
            className="text-center mb-16 lg:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 lg:mb-8" data-testid="text-features-title">
              Why Parents Trust {schoolName}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto text-lg sm:text-xl leading-relaxed" data-testid="text-features-description">
              "Your child’s future deserves the best foundation." We provide a nurturing environment where academic excellence meets strong moral values.
            </p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="card-hover bg-white/80 backdrop-blur-sm border-0 shadow-xl h-full" data-testid={`card-feature-${index}`}>
                  <CardContent className="p-8 lg:p-10 text-center">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center mb-6 mx-auto transform transition-all duration-300 ${
                      feature.color === 'primary' ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25' :
                      feature.color === 'secondary' ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/25' :
                      'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25'
                    }`}>
                      <feature.icon className="text-white h-8 w-8 lg:h-10 lg:w-10" />
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold mb-4 text-gray-900" data-testid={`text-feature-title-${index}`}>
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-base lg:text-lg leading-relaxed" data-testid={`text-feature-description-${index}`}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-white to-blue-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
          >
            {stats.map((stat, index) => (
              <motion.div key={index} variants={fadeIn} className="group" data-testid={`stat-${index}`}>
                <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300" data-testid={`text-stat-value-${index}`}>
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium text-sm lg:text-base" data-testid={`text-stat-label-${index}`}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section-gradient-accent py-20 lg:py-28 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeIn} className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold gradient-text mb-6">Who We Are</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-teal-500 mx-auto rounded-full mb-8"></div>
            <p className="text-gray-600 text-lg lg:text-xl max-w-4xl mx-auto leading-relaxed mb-10">
              {schoolName} is a leading educational institution committed to nurturing well-rounded pupils through quality teaching, discipline, creativity, and character development. We believe that every child can excel when given the right guidance, encouragement, and learning environment.
            </p>
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/about">Learn More About Our Vision</Link>
            </Button>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 mt-20">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center md:text-left"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 lg:p-10 shadow-xl card-hover h-full">
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 border-b border-blue-100 pb-2 flex items-center gap-3">
                  <GraduationCap className="h-8 w-8 text-blue-600" />
                  Academic Excellence
                </h3>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  Our academic program is designed to help students think critically, communicate confidently, and excel in examinations while developing lifelong learning skills.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Small class sizes', 'Continuous assessment', 'Individual student attention', 'Strong exam preparation'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-700">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" asChild className="rounded-full w-full sm:w-auto">
                  <Link href="/admissions">Explore Our Academic Programs</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center md:text-left"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 lg:p-10 shadow-xl card-hover h-full">
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 border-b border-green-100 pb-2 flex items-center gap-3">
                  <Star className="h-8 w-8 text-green-600" />
                  School Life & Activities
                </h3>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  Learning goes beyond textbooks at {schoolName}. We help children discover their talents, confidence, and creativity through diverse extracurricular activities.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Sports & physical education', 'Excursions & educational trips', 'Cultural & social events', 'ICT & practical learning'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-700">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" asChild className="rounded-full w-full sm:w-auto">
                  <Link href="/gallery">See School Life in Action</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn} className="space-y-8">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">A Safe, Modern & Child-Friendly Campus</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Your child learns in a space designed for comfort, focus, and safety. Our modern facilities support every aspect of your child's educational journey.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { title: 'Ventilated Classrooms', desc: 'Space designed for focus' },
                  { title: 'ICT-Enabled Learning', desc: 'Modern technology integration' },
                  { title: 'Science Labs', desc: 'Practical hands-on learning' },
                  { title: 'Reading Spaces', desc: 'Comfortable library environment' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Award className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square sm:aspect-video lg:aspect-square rounded-3xl overflow-hidden shadow-2xl"
            >
              <img 
                src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Modern School Campus" 
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-blue-600 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 border-4 border-white rounded-full"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 border-4 border-white rounded-full"></div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div {...fadeIn} className="space-y-8">
            <h2 className="text-4xl lg:text-6xl font-bold">Admission Now Open</h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Give your child the advantage of a strong educational foundation. Join our community of excellence today.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-lg font-medium">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 py-2 px-4 rounded-full">Creche</Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 py-2 px-4 rounded-full">Nursery</Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 py-2 px-4 rounded-full">Primary</Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 py-2 px-4 rounded-full">Secondary</Badge>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-6 pt-8">
              <Button asChild size="lg" className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold h-16 px-12 text-xl rounded-full shadow-2xl">
                <Link href="/admissions">Apply Now</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-2 border-white bg-transparent hover:bg-white hover:text-blue-600 text-white font-bold h-16 px-12 text-xl rounded-full">
                <Link href="/contact">Speak to Admission Officer</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeIn} className="space-y-8">
            <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
              <Users className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 italic">"What Parents Say About Us"</h2>
            <div className="space-y-6">
              <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
                “My child’s academic performance and confidence improved greatly after enrolling at {schoolName}. The teachers are caring and dedicated.”
              </p>
              <div className="font-bold text-lg text-blue-600">— A Happy Parent</div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-announcements-title">
              Latest School News
            </h2>
            <p className="text-muted-foreground" data-testid="text-announcements-description">
              Stay informed with our latest updates and important announcements
            </p>
          </motion.div>

          {recentAnnouncements.length > 0 ? (
            <motion.div 
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {recentAnnouncements.map((announcement: any, index: number) => (
                <motion.div key={announcement.id} variants={fadeIn}>
                  <Card className="card-hover h-full" data-testid={`card-announcement-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="secondary" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(announcement.publishedAt)}
                        </Badge>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-3 line-clamp-2" data-testid={`text-announcement-title-${index}`}>
                        {announcement.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3" data-testid={`text-announcement-content-${index}`}>
                        {truncateText(announcement.content, 120)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">School Administration</span>
                        <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary/80">
                          Read more →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recent announcements available</p>
            </div>
          )}

          <div className="text-center mt-8">
            <Button asChild data-testid="button-view-announcements" className="rounded-full">
              <Link href="/login">View School News & Events</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeIn} className="text-center mb-16 lg:mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6" data-testid="text-gallery-title">
              School Life Gallery
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-gallery-description">
              Capturing moments of learning, growth, and achievement
            </p>
          </motion.div>

          {galleryImages.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative max-w-5xl mx-auto"
            >
              <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl group bg-gradient-to-br from-gray-200 to-gray-300">
                <img
                  src={galleryImages[currentGalleryIndex]?.src}
                  alt={galleryImages[currentGalleryIndex]?.alt}
                  className="w-full h-full object-cover transition-all duration-700 ease-in-out"
                  data-testid={`img-gallery-main-${currentGalleryIndex}`}
                  loading="lazy"
                />

                <div className="absolute inset-0 flex items-center justify-between px-4 sm:px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 sm:h-14 sm:w-14 bg-white/30 hover:bg-white/50 text-white rounded-full backdrop-blur-md border border-white/30 transition-all duration-300 hover:scale-110 shadow-lg"
                    onClick={prevGalleryImage}
                    data-testid="button-gallery-prev"
                  >
                    <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 sm:h-14 sm:w-14 bg-white/30 hover:bg-white/50 text-white rounded-full backdrop-blur-md border border-white/30 transition-all duration-300 hover:scale-110 shadow-lg"
                    onClick={nextGalleryImage}
                    data-testid="button-gallery-next"
                  >
                    <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Gallery images will be available soon</p>
            </div>
          )}

          <div className="text-center mt-8">
            <Button asChild data-testid="button-view-gallery">
              <Link href="/gallery">Explore Full Gallery</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
