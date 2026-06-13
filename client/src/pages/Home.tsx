import { useState, useEffect } from "react";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, BookOpen, Lightbulb, Users, Globe, GraduationCap } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import heroStudents from "@/assets/hero-students.png";
import schoolBuilding from "@/assets/school-building.png";
import gallery1 from "@/assets/gallery-1.png";
import gallery2 from "@/assets/gallery-2.png";
import gallery3 from "@/assets/gallery-3.png";
import gallery4 from "@/assets/gallery-4.png";
import gallery6 from "@/assets/gallery-6.png";
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

interface HomepageSection {
  sectionKey: string;
  isEnabled: boolean;
  content: Record<string, any> | null;
}

interface HomePageContent {
  id: number;
  contentType: string;
  imageUrl: string | null;
  isActive: boolean;
}

const PILLAR_ICONS: Record<string, React.ElementType> = {
  Uprightness: ShieldCheck,
  'Academic Excellence': BookOpen,
  Innovation: Lightbulb,
  Inclusivity: Users,
  'Community Engagement': Globe,
  'Lifelong Learning': GraduationCap,
};

const DEFAULT_PILLAR_ICONS = [ShieldCheck, BookOpen, Lightbulb, Users, Globe, GraduationCap];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const staticGallery = [gallery1, gallery2, gallery3, gallery4, gallery6];

export default function Home() {
  const { data: settings } = useQuery<SettingsData>({ queryKey: ["/api/public/settings"] });
  const { data: sectionsRaw = [] } = useQuery<HomepageSection[]>({ queryKey: ["/api/public/homepage-sections"] });
  const { data: dbImages = [] } = useQuery<HomePageContent[]>({ queryKey: ["/api/public/homepage-content"] });

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -80]);
  const [isAtTop, setIsAtTop] = useState(true);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => scrollY.on("change", v => setIsAtTop(v <= 5)), [scrollY]);

  // Build a lookup of section content by key
  const sections = Object.fromEntries(sectionsRaw.map(s => [s.sectionKey, s]));

  const sec = (key: string) => sections[key];
  const isEnabled = (key: string) => sec(key)?.isEnabled !== false; // default enabled if not in DB yet
  const content = (key: string): Record<string, any> => sec(key)?.content ?? {};

  // ─── Hero ─────────────────────────────────────────────────────────────────
  const heroContent = content('hero');
  const line1White   = heroContent.line1White   ?? 'We Nurture ';
  const line1Colored = heroContent.line1Colored ?? 'Young Minds.';
  const line2White   = heroContent.line2White   ?? 'We Build ';
  const line2Colored = heroContent.line2Colored ?? 'Character.';
  const line3White   = heroContent.line3White   ?? 'We Shape the ';
  const line3Colored = heroContent.line3Colored ?? 'Future.';
  const accentColor  = heroContent.accentColor  ?? '#00BFFF';
  const subheading   = heroContent.subheading   ?? 'Treasure Home School is a school where qualitative education and moral excellence shape confident learners.';
  const primaryBtnText    = heroContent.primaryBtnText    ?? 'ENROLL';
  const primaryBtnLink    = heroContent.primaryBtnLink    ?? '/admissions';
  const secondaryBtnText  = heroContent.secondaryBtnText  ?? 'CONTACT US';
  const secondaryBtnLink  = heroContent.secondaryBtnLink  ?? '/contact';

  // Hero background image — use DB hero_image if available
  const heroDbImage = dbImages.find(i => i.contentType === 'hero_image' && i.isActive);
  const heroBgSrc = heroDbImage?.imageUrl || heroStudents;

  // ─── About ────────────────────────────────────────────────────────────────
  const aboutContent = content('about');
  const aboutLabel   = aboutContent.label   ?? 'About Our School';
  const aboutHeading = aboutContent.heading ?? 'Qualitative Education and moral excellence';
  const aboutBody1   = aboutContent.body1   ?? 'Treasure Home School is a sanctuary of brilliance committed to providing quality education and strong moral upbringing. We believe every child is unique and deserves careful guidance to discover their full potential.';
  const aboutBody2   = aboutContent.body2   ?? 'Our holistic teaching approach combines sound academics, discipline, creativity, and life skills to prepare pupils for the global stage.';
  const aboutCtaText = aboutContent.ctaText ?? 'Discover Our Mission';
  const aboutCtaLink = aboutContent.ctaLink ?? '/about';

  // About section image — use DB about_section image if available
  const aboutDbImage = dbImages.find(i => i.contentType === 'about_section' && i.isActive);
  const aboutImgSrc  = aboutDbImage?.imageUrl || schoolBuilding;

  // ─── Pillars ──────────────────────────────────────────────────────────────
  const pillarsContent = content('pillars');
  const pillarsHeading    = pillarsContent.heading    ?? 'Our Core Pillars';
  const pillarsSubheading = pillarsContent.subheading ?? 'These foundational values guide every interaction and lesson at Treasure-Home School.';
  const pillarsItems: { title: string; desc: string }[] = pillarsContent.pillars ?? [
    { title: 'Uprightness', desc: 'Promoting honesty, integrity, and moral values in all aspects of school life.' },
    { title: 'Academic Excellence', desc: 'Striving for high academic standards and continuous improvement in teaching.' },
    { title: 'Innovation', desc: 'Encouraging creativity, critical thinking, and advanced problem-solving skills.' },
    { title: 'Inclusivity', desc: 'Embracing diversity and ensuring that all students have equal access to quality education.' },
    { title: 'Community Engagement', desc: 'Fostering a sense of social responsibility and active involvement in the community.' },
    { title: 'Lifelong Learning', desc: 'Instilling a passion for learning that extends beyond the classroom.' },
  ];

  // ─── Stats ────────────────────────────────────────────────────────────────
  const statsContent = content('stats');
  const statsItems: { value: string; label: string }[] = statsContent.items ?? [
    { value: '100%', label: 'Satisfied Parents' },
    { value: '20+', label: 'Expert Teachers' },
    { value: '15', label: 'Avg. Class Size' },
    { value: '98%', label: 'Uni Acceptance' },
  ];

  // ─── Testimonials ─────────────────────────────────────────────────────────
  const testimonialContent = content('testimonials');
  const testimonialHeading    = testimonialContent.heading    ?? 'Voices from Our Community';
  const testimonialSubheading = testimonialContent.subheading ?? 'Hear from parents and alumni about how Treasure-Home School has made a difference in their lives.';
  const testimonialItems: { name: string; role: string; initials: string; text: string }[] = testimonialContent.items ?? [
    { name: 'Mrs. Sarah Williams', role: 'Parent of 3', initials: 'SW', text: 'Choosing Treasure-Home School was the best decision we ever made for our children\'s education. The progress in their confidence and academic scores is just remarkable.' },
    { name: 'Adebayo Daniel', role: 'Satisfied Parent', initials: 'AD', text: 'Choosing Treasure-Home School was the best decision for our family. The teachers are dedicated, the environment is nurturing, and my son has grown tremendously both academically and in character.' },
    { name: 'Folake Ogundimu', role: 'Satisfied Parent', initials: 'FO', text: 'The level of care and attention each child receives here is exceptional. My children look forward to going to school every day, and their results speak for themselves.' },
  ];

  // ─── Gallery images ───────────────────────────────────────────────────────
  const galleryDbImages = dbImages.filter(i => i.contentType.startsWith('gallery_preview') && i.isActive).map(i => i.imageUrl!);
  const galleryImages = galleryDbImages.length > 0 ? galleryDbImages : staticGallery as any[];

  // ─── FAQ ──────────────────────────────────────────────────────────────────
  const faqContent = content('faq');
  const faqHeading = faqContent.heading ?? 'Frequently Asked Questions';
  const faqItems: { question: string; answer: string }[] = faqContent.items ?? [
    { question: 'What is the enrollment process?', answer: 'The process begins with an inquiry form, followed by a campus tour and a student assessment to ensure we are the right fit for your child\'s learning style.' },
    { question: 'Do you offer extracurricular activities?', answer: 'Yes! We offer a wide range of extracurricular activities including sports, arts, music, debate clubs, and STEM programs to support students\' all-round development.' },
    { question: 'Is your curriculum accredited?', answer: 'Absolutely. Our curriculum is fully accredited and aligned with national standards while incorporating internationally recognised best practices in education.' },
  ];

  // Rotate testimonials
  useEffect(() => {
    if (testimonialItems.length <= 1) return;
    const timer = setInterval(() => setCurrentTestimonial(p => (p + 1) % testimonialItems.length), 7000);
    return () => clearInterval(timer);
  }, [testimonialItems.length]);

  const safeCurrentTestimonial = Math.min(currentTestimonial, testimonialItems.length - 1);

  return (
    <PublicLayout>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      {isEnabled('hero') && (
        <section className="relative h-[70vh] lg:h-screen flex items-center justify-center overflow-hidden">
          <AnimatePresence>
            {isAtTop ? (
              <motion.div key="hero-bg" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 1 }} transition={{ duration: 1.5, ease: "easeOut" }} style={{ y }} className="absolute inset-0 z-0">
                <img src={heroBgSrc} alt="Hero" className="w-full h-full object-cover object-[center_20%]" />
                <div className="absolute inset-0 bg-black/50" />
              </motion.div>
            ) : (
              <motion.div key="hero-bg-scrolled" style={{ y }} className="absolute inset-0 z-0">
                <img src={heroBgSrc} alt="Hero" className="w-full h-full object-cover object-[center_20%]" />
                <div className="absolute inset-0 bg-black/50" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="container relative z-10 text-center text-white px-4">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                {line1White}
                <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="inline-block" style={{ color: accentColor }}>
                  {line1Colored}
                </motion.span>
                <br />
                {line2White}
                <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.5 }} className="inline-block" style={{ color: accentColor }}>
                  {line2Colored}
                </motion.span>
                <br />
                {line3White}
                <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.5 }} className="inline-block" style={{ color: accentColor }}>
                  {line3Colored}
                </motion.span>
              </h1>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} className="text-sm md:text-base mb-8 text-gray-200 italic font-light max-w-2xl mx-auto tracking-wide">
                {subheading}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }} className="flex flex-row gap-3 justify-center items-center">
                <Button asChild className="btn-hero-about h-10 px-6 text-sm hover-elevate active-elevate-2">
                  <Link href={primaryBtnLink}>{primaryBtnText}</Link>
                </Button>
                <Button asChild className="btn-hero-contact h-10 px-6 text-sm hover-elevate active-elevate-2">
                  <Link href={secondaryBtnLink}>{secondaryBtnText}</Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── About ────────────────────────────────────────────────────────── */}
      {isEnabled('about') && (
        <section className="py-16 md:py-24 bg-white">
          <div className="container px-6 max-w-3xl mx-auto">
            <motion.div {...fadeIn}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-[2px] bg-primary" />
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{aboutLabel}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">{aboutHeading}</h2>
              {aboutBody1 && <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed mb-5 font-normal">{aboutBody1}</p>}
              {aboutBody2 && <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed mb-8 font-normal">{aboutBody2}</p>}
              <Link href={aboutCtaLink} className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.15em] text-primary hover:opacity-75 transition-opacity mb-10">
                {aboutCtaText}<ArrowRight className="w-4 h-4" />
              </Link>
              <div className="w-full">
                <img src={aboutImgSrc} alt="School" className="rounded-xl w-full h-[280px] md:h-[380px] object-cover" />
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── Core Pillars ─────────────────────────────────────────────────── */}
      {isEnabled('pillars') && (
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="container px-6 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{pillarsHeading}</h2>
              <p className="text-[14px] md:text-[15px] text-gray-500 font-normal leading-relaxed">{pillarsSubheading}</p>
            </div>
            <div className="flex flex-col gap-4">
              {pillarsItems.map((f, i) => {
                const Icon = PILLAR_ICONS[f.title] ?? DEFAULT_PILLAR_ICONS[i % DEFAULT_PILLAR_ICONS.length];
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}>
                    <div className="group bg-white border border-gray-100 rounded-2xl shadow-sm p-7 md:p-9 hover:border-primary transition-all duration-300 cursor-default">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary transition-colors duration-300">
                        <Icon className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
                      </div>
                      <h3 className="text-[17px] font-bold text-gray-900 mb-3">{f.title}</h3>
                      <p className="text-[14px] text-gray-500 leading-relaxed font-normal">{f.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Stats ────────────────────────────────────────────────────────── */}
      {isEnabled('stats') && statsItems.length > 0 && (
        <section className="py-14 md:py-20 bg-primary">
          <div className="container px-6 max-w-3xl mx-auto">
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:gap-x-16 md:gap-y-12">
              {statsItems.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }} className="text-center">
                  <div className="font-display text-4xl md:text-5xl font-black text-white mb-2 leading-none">{s.value}</div>
                  <div className="font-display text-[10px] md:text-[11px] text-white/70 uppercase tracking-[0.22em] font-bold">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Testimonials ─────────────────────────────────────────────────── */}
      {isEnabled('testimonials') && testimonialItems.length > 0 && (
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="container px-6 max-w-3xl mx-auto">
            <div className="mb-10">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Testimonials</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{testimonialHeading}</h2>
              <p className="text-[14px] md:text-[15px] text-gray-500 font-normal leading-relaxed">{testimonialSubheading}</p>
            </div>
            <div className="relative mb-6">
              {/* Ghost spacer */}
              <div aria-hidden="true" className="invisible pointer-events-none">
                <div className="bg-white rounded-2xl p-7 md:p-9">
                  <div className="flex gap-1 mb-5">{"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}</div>
                  <p className="text-[15px] md:text-[16px] leading-relaxed italic font-normal mb-7">
                    "{testimonialItems.reduce((a, b) => a.text.length >= b.text.length ? a : b).text}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex-shrink-0" />
                    <div><h4 className="font-bold text-[15px] mb-0.5">Name</h4><p className="text-[13px]">Role</p></div>
                  </div>
                </div>
              </div>
              {/* Animated card */}
              <AnimatePresence mode="wait">
                <motion.div key={safeCurrentTestimonial} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 md:p-9 h-full">
                    <div className="flex gap-1 mb-5 text-primary text-xl">{"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}</div>
                    <p className="text-[15px] md:text-[16px] text-gray-700 leading-relaxed italic font-normal mb-7">"{testimonialItems[safeCurrentTestimonial]?.text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[13px] font-black text-primary">{testimonialItems[safeCurrentTestimonial]?.initials}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-[15px] text-gray-900 mb-0.5">{testimonialItems[safeCurrentTestimonial]?.name}</h4>
                        <p className="text-[13px] text-gray-500 font-normal">{testimonialItems[safeCurrentTestimonial]?.role}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            {testimonialItems.length > 1 && (
              <div className="flex justify-center gap-2">
                {testimonialItems.map((_, i) => (
                  <button key={i} onClick={() => setCurrentTestimonial(i)} className={`h-2 rounded-full transition-all duration-300 ${i === safeCurrentTestimonial ? "bg-primary w-7" : "bg-gray-300 w-2.5"}`} aria-label={`Go to testimonial ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Gallery ──────────────────────────────────────────────────────── */}
      {isEnabled('gallery') && (
        <section className="py-24 bg-white text-center">
          <div className="container px-4 max-w-6xl mx-auto">
            <h2 className="section-title">School Gallery</h2>
            <p className="section-subtitle">Check out some pictures of our students.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              {galleryImages.slice(0, 6).map((img, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-500">
                  <img src={img} alt="Gallery" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                </motion.div>
              ))}
            </div>
            <Button asChild className="btn-primary mx-auto">
              <Link href="/gallery" className="flex items-center gap-2"><span>View More</span><ArrowRight className="w-3 h-3" /></Link>
            </Button>
          </div>
        </section>
      )}

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      {isEnabled('faq') && faqItems.length > 0 && (
        <section className="py-20 md:py-28 bg-white">
          <div className="container px-6 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-10">{faqHeading}</h2>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {faqItems.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-gray-200 rounded-2xl bg-white px-6 shadow-sm">
                  <AccordionTrigger className="text-left font-semibold text-[15px] text-gray-900 py-5 hover:no-underline">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-[14px] text-gray-500 leading-relaxed pb-5">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
