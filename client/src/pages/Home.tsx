import PublicLayout from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Users, Award, GraduationCap, Star, MapPin, Phone, Mail, CheckCircle, ArrowRight, Plus, Minus } from 'lucide-react';
import type { HomePageContent } from '@shared/schema';
import Typed from 'typed.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    { name: "Yisa Balikis", role: "Student", text: "At Glory Schools, I've learned the value of leadership and teamwork character development.", img: "/images/Yisa Balakis.jpg" },
    { name: "Nafiu Barakat", role: "Student", text: "The school's focus on values has shaped my perspective, ready to face the future with confidence.", img: "/images/Nafiu Barakat.jpg" }
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
          <div className="absolute inset-0 bg-black/60" />
        </div>
        
        <div className="container relative z-10 text-center text-white px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
              We invest in <span className="text-[#d946ef]" ref={typedElementRef}></span>
            </h1>
            <p className="text-xl md:text-2xl mb-10 text-gray-200 max-w-2xl mx-auto">
              {schoolName} is the school your ward needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 rounded-md px-8 h-12 font-bold uppercase tracking-wider text-xs">
                <Link href="/about">About</Link>
              </Button>
              <Button asChild size="lg" className="bg-[#d946ef] hover:bg-[#c026d3] text-white border-none rounded-md px-8 h-12 font-bold uppercase tracking-wider text-xs">
                <Link href="/contact">Contact</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="container px-4 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn}>
              <img 
                src="/images/students 2.jpeg" 
                alt="Glory Schools Students" 
                className="rounded-lg shadow-xl w-full object-cover h-[350px]"
              />
            </motion.div>
            <motion.div {...fadeIn} className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">{schoolName}</h2>
              <p className="text-base text-gray-600 leading-relaxed">
                At {schoolName}, Egbedi, our vision is to be a beacon of educational excellence in rural Osun State and beyond. We aspire to empower our students with the knowledge, skills, and values that will not only equip them for success in a rapidly evolving world but also inspire them to be compassionate, innovative, and socially responsible leaders.
              </p>
              <Button asChild className="bg-[#d946ef] hover:bg-[#c026d3] text-white rounded-md px-6 py-2 uppercase text-xs font-bold">
                <Link href="/about">Learn More</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 bg-gray-50/50">
        <div className="container px-4 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{schoolName} Core Values</h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm mb-20">
            At {schoolName}, we are guided by six core values that form the foundation of our educational philosophy. These values shape the experiences of our students and define our commitment to providing a holistic and enriching learning environment.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {features.map((value, i) => (
              <motion.div key={i} {...fadeIn}>
                <Card className="text-center p-10 h-full border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl relative pt-16">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white shadow-sm p-4 border border-gray-100 flex items-center justify-center">
                    <img src={value.icon} alt={value.title} className="w-10 h-10 object-contain" />
                  </div>
                  <h3 className="text-lg font-bold mb-4 text-gray-900">{value.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{value.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us & Stats */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/bg_01.png" className="w-full h-full object-cover" alt="Background" />
        </div>
        
        <div className="container relative z-10 px-4 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div {...fadeIn}>
              <h2 className="text-3xl font-bold mb-8 text-gray-900">Why Choose {schoolName}?</h2>
              <p className="text-base text-gray-600 leading-relaxed mb-10">
                At {schoolName}, Egbedi, our vision is to be a beacon of educational excellence in rural Osun State and beyond. We aspire to empower our students with the knowledge, skills, and values that will not only equip them for success in a rapidly evolving world but also inspire them to be compassionate, innovative, and socially responsible leaders.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-2 gap-8">
              {stats.map((stat, i) => (
                <motion.div key={i} {...fadeIn}>
                  <Card className="bg-white p-10 rounded-xl text-center border-none shadow-sm">
                    <div className="text-4xl font-bold mb-2 text-gray-900">{stat.value}</div>
                    <div className="text-gray-400 text-xs uppercase tracking-widest">{stat.label}</div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/bg_03.png" className="w-full h-full object-cover" alt="Background" />
        </div>
        <div className="container relative z-10 px-4 max-w-7xl mx-auto text-center">
          <motion.div {...fadeIn} className="mb-16">
            <h2 className="text-3xl font-bold mb-4">School Testimonial</h2>
            <p className="text-gray-500 text-sm">Our education brings satisfaction to our students. Here are a few testimonials.</p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div key={i} {...fadeIn}>
                <Card className="p-10 h-full text-left bg-white border-none shadow-sm rounded-xl">
                  <p className="text-gray-500 text-sm leading-relaxed mb-8 italic">At Glory Schools, I've learned the value of leadership and teamwork. The school's emphasis on character development has empowered me to take on responsibilities and become a better version of myself. I am grateful for the opportunities this school has provided me.</p>
                  <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
                    <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{t.name}</h4>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">School Gallery</h2>
          <p className="text-gray-500 text-sm mb-16">Check out some pictures of our students.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {galleryImages.map((img, i) => (
              <motion.div key={i} {...fadeIn} className="overflow-hidden rounded-lg shadow-sm">
                <img 
                  src={`/images/${img}`} 
                  alt="Gallery" 
                  className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
                />
              </motion.div>
            ))}
          </div>
          <Button asChild size="lg" className="bg-[#d946ef] hover:bg-[#c026d3] text-white rounded-md px-10 h-12 font-bold uppercase tracking-wider text-xs">
            <Link href="/gallery">View More</Link>
          </Button>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/contact-bg.png" className="w-full h-full object-cover opacity-10" alt="Background" />
        </div>
        <div className="container relative z-10 px-4 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Contact Us</h2>
          <p className="text-gray-500 text-sm mb-16">Let us know your thoughts.</p>
          
          <form className="space-y-6 text-left">
            <div className="grid md:grid-cols-2 gap-6">
              <input type="text" placeholder="First Name" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d946ef]/20" />
              <input type="text" placeholder="Last Name" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d946ef]/20" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <input type="email" placeholder="Your Email" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d946ef]/20" />
              <input type="tel" placeholder="Your Phone Number" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d946ef]/20" />
            </div>
            <textarea placeholder="Type your message" rows={6} className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d946ef]/20" />
            <div className="text-center">
              <Button type="submit" size="lg" className="bg-[#d946ef] hover:bg-[#c026d3] text-white rounded-md px-10 h-12 font-bold uppercase tracking-wider text-xs">
                Send Message
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 relative overflow-hidden bg-gray-50/50">
        <div className="container relative z-10 px-4 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm mb-16">Want to know more about us?</p>
          
          <div className="text-left space-y-4">
            {[
              { q: "When was the school established?", a: "The school was established in September, 2012." },
              { q: "What is the curriculum of the school?", a: "We follow an approved & accredited curriculum that balances academic excellence with strong moral training." },
              { q: "Where is the school located?", a: "We are located at Egbedi, Osun State." },
              { q: "Is Glory Schools a boarding or day school?", a: "We offer both day and boarding facilities for our students." }
            ].map((faq, i) => (
              <Accordion type="single" collapsible key={i} className="bg-white rounded-lg shadow-sm px-6">
                <AccordionItem value={`item-${i}`} className="border-none">
                  <AccordionTrigger className="text-sm font-semibold py-6 hover:no-underline text-gray-900">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-500 text-sm pb-6">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
