import PublicLayout from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Users, Award, GraduationCap, Star, MapPin, Phone, Mail, CheckCircle, ArrowRight } from 'lucide-react';
import type { HomePageContent } from '@shared/schema';
import Typed from 'typed.js';
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

  const schoolName = settings?.schoolName || "Glory Schools";
  const schoolMotto = settings?.schoolMotto || "Nurturing Bright Minds";
  const schoolAddress = settings?.schoolAddress || "Egbedi, Osun State";
  const websiteTitle = settings?.websiteTitle || schoolName;

  useEffect(() => {
    if (websiteTitle) {
      document.title = websiteTitle;
    }
  }, [websiteTitle]);

  const typedElementRef = useRef<HTMLSpanElement>(null);
  const typedInstance = useRef<Typed | null>(null);

  useEffect(() => {
    if (typedElementRef.current) {
      if (typedInstance.current) {
        typedInstance.current.destroy();
      }
      typedInstance.current = new Typed(typedElementRef.current, {
        strings: ["Students.", "Lives.", "the Future."],
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

  const features = [
    { title: "Uprightness", desc: "Promoting honesty, integrity, and moral values in all aspects of school life.", icon: "/images/01.png" },
    { title: "Academic Excellence", desc: "Striving for high academic standards and continuous improvement in teaching and learning.", icon: "/images/02.png" },
    { title: "Innovation", desc: "Encouraging creativity, critical thinking, and problem-solving skills among students.", icon: "/images/03.png" },
    { title: "Inclusivity", desc: "Embracing diversity and ensuring that all students have equal access to quality education.", icon: "/images/04.png" },
    { title: "Community Engagement", desc: "Fostering a sense of social responsibility and active involvement in the local community.", icon: "/images/05.png" },
    { title: "Lifelong Learning", desc: "Instilling a passion for learning that extends beyond the classroom.", icon: "/images/06.png" }
  ];

  const stats = [
    { label: "Satisfied Parents", value: "100%" },
    { label: "Experienced Teachers", value: "20+" },
    { label: "Enrolled Students", value: "900+" },
    { label: "Pass Rate", value: "99%" }
  ];

  const testimonials = [
    { name: "Tijani Abdulbasit", role: "Student", text: "Glory Schools has prepared me academically and taught me important life skills focus on values and ethics.", img: "/images/Tijani Abdulbasit.jpg" },
    { name: "Yisa Balikis", role: "Student", text: "At Glory Schools, I've learned the value of leadership and teamwork character development.", img: "/images/Yisa Balakis.jpg" },
    { name: "Nafiu Barakat", role: "Student", text: "The school's focus on values has shaped my perspective, ready to face the future with confidence.", img: "/images/Nafiu Barakat.jpg" },
    { name: "Akinyemi Charis", role: "Student", text: "Extracurricular activities and supportive staff have made my school experience truly enriching.", img: "/images/Akinyemi Charis.jpg" }
  ];

  const galleryImages = [
    "banner 1.jpeg", 
    "group of students.jpg", 
    "students 2.jpeg", 
    "students 1.jpeg", 
    "student studying.jpeg", 
    "students in class.jpg"
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/student studying.jpeg" 
            alt="Students studying" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        
        <div className="container relative z-10 text-center text-white px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
              We invest in <span className="text-blue-400" ref={typedElementRef}></span>
            </h1>
            <p className="text-xl md:text-2xl mb-10 text-gray-200 max-w-2xl mx-auto">
              {schoolName} is the school your ward needs. Providing excellence in rural education.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-12">
                <Link href="/about">About Us</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 backdrop-blur-md text-white border-white/50 hover:bg-white/20 rounded-full px-8 h-12">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="container px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeIn}>
              <img 
                src="/images/students 2.jpeg" 
                alt="Glory Schools Students" 
                className="rounded-2xl shadow-2xl w-full object-cover h-[400px]"
              />
            </motion.div>
            <motion.div {...fadeIn} className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">{schoolName}</h2>
              <div className="w-20 h-1.5 bg-blue-600 rounded-full" />
              <p className="text-lg text-gray-600 leading-relaxed">
                At {schoolName}, Egbedi, our vision is to be a beacon of educational excellence in rural Osun State and beyond. We aspire to empower our students with the knowledge, skills, and values that will not only equip them for success in a rapidly evolving world but also inspire them to be compassionate, innovative, and socially responsible leaders.
              </p>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/about">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 bg-gray-50">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{schoolName} Core Values</h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Guided by six core values that form the foundation of our educational philosophy.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((value, i) => (
              <motion.div key={i} {...fadeIn}>
                <Card className="text-center p-8 h-full hover:shadow-lg transition-shadow border-none bg-white rounded-2xl relative pt-12">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white shadow-md p-4">
                    <img src={value.icon} alt={value.title} className="w-full h-full object-contain" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 mt-4">{value.title}</h3>
                  <p className="text-gray-600">{value.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us & Stats */}
      <section className="py-20 relative text-white">
        <div className="absolute inset-0 z-0">
          <img src="/images/bg_01.png" className="w-full h-full object-cover" alt="Background" />
          <div className="absolute inset-0 bg-blue-900/80" />
        </div>
        
        <div className="container relative z-10 px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn}>
              <h2 className="text-4xl font-bold mb-6">Why Choose {schoolName}?</h2>
              <p className="text-lg text-gray-200 leading-relaxed mb-8">
                We empower our students with knowledge, skills, and values. Our graduates are at the forefront of positive change, contributing to the betterment of their communities while upholding the principles of uprightness and academic integrity.
              </p>
              <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-gray-100 rounded-full px-8">
                <Link href="/admissions">Enroll Your Child</Link>
              </Button>
            </motion.div>
            
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, i) => (
                <motion.div key={i} {...fadeIn}>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-8 rounded-2xl text-center">
                    <div className="text-4xl font-bold mb-2">{stat.value}</div>
                    <div className="text-gray-300 text-sm uppercase tracking-wider">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50 overflow-hidden">
        <div className="container px-4 text-center">
          <motion.div {...fadeIn} className="mb-16">
            <h2 className="text-4xl font-bold mb-4">School Testimonials</h2>
            <p className="text-gray-600 text-lg">Our education brings satisfaction to our students.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {testimonials.map((t, i) => (
              <motion.div key={i} {...fadeIn}>
                <Card className="p-8 h-full text-left bg-white border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                  <p className="text-gray-600 italic mb-6">"{t.text}"</p>
                  <div className="flex items-center gap-4">
                    <img src={t.img} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <h4 className="font-bold text-gray-900">{t.name}</h4>
                      <p className="text-sm text-blue-600">{t.role}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Preview */}
      <section className="py-20 bg-white">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">School Gallery</h2>
            <p className="text-gray-600 text-lg">Check out some pictures of our students.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {galleryImages.map((img, i) => (
              <motion.div key={i} {...fadeIn} className="overflow-hidden rounded-2xl aspect-video group">
                <img 
                  src={`/images/${img}`} 
                  alt="Gallery" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button asChild size="lg" variant="outline" className="rounded-full px-10">
              <Link href="/gallery">View Full Gallery</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white relative overflow-hidden">
        <div className="container px-4 text-center relative z-10">
          <motion.div {...fadeIn}>
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to Shape Your Child's Future?</h2>
            <p className="text-xl mb-10 text-blue-100 max-w-2xl mx-auto">
              Join the {schoolName} family today and give your child the foundation they deserve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 rounded-full px-10 h-14 font-bold">
                <Link href="/admissions">Apply Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10 rounded-full px-10 h-14 font-bold">
                <Link href="/contact">Inquiry</Link>
              </Button>
            </div>
          </motion.div>
        </div>
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
      </section>
    </PublicLayout>
  );
}
