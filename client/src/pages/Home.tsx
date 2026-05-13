import { useState, useEffect } from "react";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, User, ShieldCheck, BookOpen, Lightbulb, Users, Globe, GraduationCap } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import girlsImage from "@/assets/girls-image.png";
import gallery1 from "@/assets/gallery-1.png";
import gallery2 from "@/assets/gallery-2.png";
import gallery3 from "@/assets/gallery-3.png";
import gallery4 from "@/assets/gallery-4.png";
import gallery6 from "@/assets/gallery-6.png";
import heroImage from "@/assets/hero-image.png";
import schoolBuilding from "@/assets/school-building.png";
import heroStudents from "@/assets/hero-students.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { ContactUtils } from "@shared/contact-utils";

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmails: any;
  schoolPhones: any;
  schoolAddress: string;
  schoolLogo?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function Home() {
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
  });

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -80]);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      if (latest <= 5) {
        setIsAtTop(true);
      } else {
        setIsAtTop(false);
      }
    });
  }, [scrollY]);

  const schoolName = settings?.schoolName || "";
  const schoolAddress = settings?.schoolAddress || "";
  const schoolLogo = settings?.schoolLogo || "";

  const schoolPhones = ContactUtils.getPhones(settings);
  const schoolEmails = ContactUtils.getEmails(settings);

  const features = [
    {
      title: "Uprightness",
      desc: "Promoting honesty, integrity, and moral values in all aspects of school life.",
      Icon: ShieldCheck,
    },
    {
      title: "Academic Excellence",
      desc: "Striving for high academic standards and continuous improvement in teaching.",
      Icon: BookOpen,
    },
    {
      title: "Innovation",
      desc: "Encouraging creativity, critical thinking, and advanced problem-solving skills.",
      Icon: Lightbulb,
    },
    {
      title: "Inclusivity",
      desc: "Embracing diversity and ensuring that all students have equal access to quality education.",
      Icon: Users,
    },
    {
      title: "Community Engagement",
      desc: "Fostering a sense of social responsibility and active involvement in the local community.",
      Icon: Globe,
    },
    {
      title: "Lifelong Learning",
      desc: "Instilling a passion for learning that extends beyond the classroom.",
      Icon: GraduationCap,
    },
  ];

  const stats = [
    { label: "Satisfied Parents", value: "100%" },
    { label: "Expert Teachers", value: "20+" },
    { label: "Avg. Class Size", value: "15" },
    { label: "Uni Acceptance", value: "98%" },
  ];

  const testimonials = [
    {
      name: "Mrs. Sarah Williams",
      role: "Parent of 3",
      initials: "SW",
      text: "Choosing Treasure-Home School was the best decision we ever made for our children's education. The progress in their confidence and academic scores is just remarkable.",
    },
    {
      name: "Adebayo Daniel",
      role: "Satisfied Parent",
      initials: "AD",
      text: "Choosing Treasure-Home School was the best decision for our family. The teachers are dedicated, the environment is nurturing, and my son has grown tremendously both academically and in character.",
    },
    {
      name: "Folake Ogundimu",
      role: "Satisfied Parent",
      initials: "FO",
      text: "The level of care and attention each child receives here is exceptional. My children look forward to going to school every day, and their results speak for themselves.",
    },
  ];

  const galleryImages = [
    gallery1,
    gallery2,
    gallery3,
    gallery4,
    gallery6,
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative h-[70vh] lg:h-screen flex items-center justify-center overflow-hidden">
        <AnimatePresence>
          {isAtTop && (
            <motion.div
              key="hero-bg"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{ y }}
              className="absolute inset-0 z-0"
            >
              <img
                src={heroStudents}
                alt="Hero"
                className="w-full h-full object-cover object-[center_20%]"
              />
              <div className="absolute inset-0 bg-black/50" />
            </motion.div>
          )}
          {!isAtTop && (
            <motion.div
              key="hero-bg-scrolled"
              style={{ y }}
              className="absolute inset-0 z-0"
            >
              <img
                src={heroStudents}
                alt="Hero"
                className="w-full h-full object-cover object-[center_20%]"
              />
              <div className="absolute inset-0 bg-black/50" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="container relative z-10 text-center text-white px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              We Nurture{" "}
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-[#00BFFF] inline-block"
              >
                Young Minds.
              </motion.span>
              <br />
              We Build{" "}
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-[#00BFFF] inline-block"
              >
                Character.
              </motion.span>
              <br />
              We Shape the{" "}
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="text-[#00BFFF] inline-block"
              >
                Future.
              </motion.span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="text-sm md:text-base mb-8 text-gray-200 italic font-medium max-w-2xl mx-auto"
            >
              Treasure Home School is a school where qualitative education and
              moral excellence shape confident learners.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }} className="flex flex-row gap-3 justify-center items-center">
              <Button asChild className="btn-hero-about h-10 px-6 text-sm hover-elevate active-elevate-2"><Link href="/admission">ENROLL</Link></Button>
              <Button asChild className="btn-hero-contact h-10 px-6 text-sm hover-elevate active-elevate-2"><Link href="/contact">CONTACT US</Link></Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container px-6 max-w-3xl mx-auto">
          <motion.div {...fadeIn}>
            {/* Label */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-[2px] bg-[#0000FF]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0000FF]">About Our School</span>
            </div>

            {/* Heading */}
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
              Qualitative Education and moral excellence
            </h2>

            {/* Body text */}
            <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed mb-5 font-normal">
              Treasure Home School is a sanctuary of brilliance committed to providing quality education and strong
              moral upbringing. We believe every child is unique and deserves careful guidance to discover their full
              potential.
            </p>
            <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed mb-8 font-normal">
              Our holistic teaching approach combines sound academics, discipline, creativity, and life skills to
              prepare pupils for the global stage.
            </p>

            {/* Text link CTA */}
            <Link href="/about" className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.15em] text-[#0000FF] hover:opacity-75 transition-opacity mb-10">
              Discover Our Mission
              <ArrowRight className="w-4 h-4" />
            </Link>

            {/* Building image */}
            <div className="w-full">
              <img
                src={schoolBuilding}
                alt="Treasure Home School Building"
                className="rounded-xl w-full h-[280px] md:h-[380px] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container px-6 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Our Core Pillars
            </h2>
            <p className="text-[14px] md:text-[15px] text-gray-500 font-normal leading-relaxed">
              These foundational values guide every interaction and lesson at Treasure-Home School.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
              >
                <div className="group bg-white border border-gray-100 rounded-2xl shadow-sm p-7 md:p-9 hover:border-blue-600 transition-all duration-300 cursor-default">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors duration-300">
                    <f.Icon className="w-6 h-6 text-[#0000FF] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-[17px] font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed font-normal">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[#0033CC] py-14 md:py-20">
        <div className="container px-6 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:gap-x-16 md:gap-y-12">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-black text-white mb-2 leading-none">
                  {s.value}
                </div>
                <div className="text-[10px] md:text-[11px] text-blue-200 uppercase tracking-[0.22em] font-bold">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container px-6 max-w-3xl mx-auto">
          {/* Header — left-aligned */}
          <div className="mb-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0000FF] mb-3 block">
              Testimonials
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Voices from Our Community
            </h2>
            <p className="text-[14px] md:text-[15px] text-gray-500 font-normal leading-relaxed">
              Hear from parents and alumni about how Treasure-Home School has made a difference in their lives.
            </p>
          </div>

          {/* Card */}
          <div className="relative mb-6">
            {/* Ghost spacer — sizes container to tallest card */}
            <div aria-hidden="true" className="invisible pointer-events-none">
              <div className="bg-white rounded-2xl p-7 md:p-9">
                <div className="flex gap-1 mb-5">{"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}</div>
                <p className="text-[15px] md:text-[16px] leading-relaxed italic font-normal mb-7">
                  "{testimonials.reduce((a, b) => a.text.length >= b.text.length ? a : b).text}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-[15px] mb-0.5">Name</h4>
                    <p className="text-[13px]">Role</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 md:p-9 h-full">
                  {/* Five stars */}
                  <div className="flex gap-1 mb-5 text-[#0033CC] text-xl">
                    {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
                  </div>

                  {/* Quote */}
                  <p className="text-[15px] md:text-[16px] text-gray-700 leading-relaxed italic font-normal mb-7">
                    "{testimonials[currentTestimonial].text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[13px] font-black text-[#0033CC]">
                        {testimonials[currentTestimonial].initials}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[15px] text-gray-900 mb-0.5">
                        {testimonials[currentTestimonial].name}
                      </h4>
                      <p className="text-[13px] text-gray-500 font-normal">
                        {testimonials[currentTestimonial].role}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentTestimonial === i ? "bg-[#0033CC] w-7" : "bg-gray-300 w-2.5"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-24 bg-white text-center">
        <div className="container px-4 max-w-6xl mx-auto">
          <h2 className="section-title">School Gallery</h2>
          <p className="section-subtitle">
            Check out some pictures of our students.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {galleryImages.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-500"
              >
                <img
                  src={typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('/') ? `/images/${img}` : img}
                  alt="Gallery"
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                />
              </motion.div>
            ))}
          </div>
          <Button asChild className="btn-primary mx-auto">
            <Link href="/gallery" className="flex items-center gap-2">
              <span>View More</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="container px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-10">
            Frequently Asked Questions
          </h2>

          <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-3">
            <AccordionItem value="item-1" className="border border-gray-200 rounded-2xl bg-white px-6 shadow-sm">
              <AccordionTrigger className="text-left font-semibold text-[15px] text-gray-900 py-5 hover:no-underline">
                What is the enrollment process?
              </AccordionTrigger>
              <AccordionContent className="text-[14px] text-gray-500 leading-relaxed pb-5">
                The process begins with an inquiry form, followed by a campus tour and a student assessment to ensure we are the right fit for your child's learning style.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border border-gray-200 rounded-2xl bg-white px-6 shadow-sm">
              <AccordionTrigger className="text-left font-semibold text-[15px] text-gray-900 py-5 hover:no-underline">
                Do you offer extracurricular activities?
              </AccordionTrigger>
              <AccordionContent className="text-[14px] text-gray-500 leading-relaxed pb-5">
                Yes! We offer a wide range of extracurricular activities including sports, arts, music, debate clubs, and STEM programs to support students' all-round development.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border border-gray-200 rounded-2xl bg-white px-6 shadow-sm">
              <AccordionTrigger className="text-left font-semibold text-[15px] text-gray-900 py-5 hover:no-underline">
                Is your curriculum accredited?
              </AccordionTrigger>
              <AccordionContent className="text-[14px] text-gray-500 leading-relaxed pb-5">
                Absolutely. Our curriculum is fully accredited and aligned with national standards while incorporating internationally recognised best practices in education.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </PublicLayout>
  );
}
