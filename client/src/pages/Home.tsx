import PublicLayout from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Phone, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmail: string;
  schoolPhone: string;
  schoolAddress: string;
  schoolLogo?: string;
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
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolAddress = settings?.schoolAddress || "Egbedi, Osun State";
  const schoolLogo = settings?.schoolLogo || "/images/logo.png";

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
    { name: "Tijani Abdulbasit", role: "Student", text: `${schoolName} has not only prepared me academically but has also taught me important life skills. The school's focus on values and ethics has shaped my perspective on the world.`, img: "/images/Tijani Abdulbasit.jpg" },
    { name: "Yisa Balikis", role: "Student", text: `At ${schoolName}, I've learned the value of leadership and teamwork. The school's emphasis on character development has empowered me to take on responsibilities.`, img: "/images/Yisa Balakis.jpg" }
  ];

  const galleryImages = [
    "banner 1.jpeg", "group of students.jpg", "students 2.jpeg", 
    "students 1.jpeg", "student studying.jpeg", "students in class.jpg"
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/student studying.jpeg" alt="Hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="container relative z-10 text-center text-white px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              We Nurture <span className="text-[#00BFFF]">Young Minds.</span><br />
              We Build <span className="text-[#0000FF]">Character.</span><br />
              We Shape the <span className="text-[#00BFFF]">Future.</span>
            </h1>
            <p className="text-base md:text-lg mb-10 text-gray-200 italic font-medium">
              Treasure Home School is a school where qualitative education and moral excellence shape confident learners.
            </p>
            <div className="flex flex-row gap-4 justify-center items-center">
              <Button asChild className="btn-hero-about h-11 px-8"><Link href="/portal/login">ENROLL</Link></Button>
              <Button asChild className="btn-hero-contact h-11 px-8"><Link href="/contact">CONTACT</Link></Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section - TEXT FIRST THEN IMAGE (As per user feedback) */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto text-center">
          <motion.div {...fadeIn} className="max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{schoolName}</h2>
            <div className="w-12 h-[2px] bg-gradient-to-r from-[#0000FF] to-[#00BFFF] mx-auto mb-8" />
            <p className="text-[14px] md:text-[15px] text-gray-600 leading-relaxed mb-6">
              Treasure Home School is a private educational institution committed to providing quality education and strong moral upbringing. We believe every child is unique and deserves careful guidance to discover their full potential.
            </p>
            <p className="text-[14px] md:text-[15px] text-gray-600 leading-relaxed mb-8">
              Our teaching approach combines sound academics, discipline, creativity, and life skills to prepare pupils for future challenges.
            </p>
            <Button asChild className="btn-primary">
              <Link href="/about" className="flex items-center gap-2">
                <span>Learn More</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </motion.div>
          
          <motion.div {...fadeIn}>
            <img 
              src="/images/group of students.jpg" 
              alt="Glory Schools Students" 
              className="rounded-lg shadow-lg w-full max-w-4xl mx-auto h-[400px] object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto text-center">
          <h2 className="section-title">{schoolName} Egbedi Core Values</h2>
          <p className="section-subtitle">At {schoolName}, we are guided by six core values that form the foundation of our educational philosophy.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div key={i} {...fadeIn}>
                <div className="card-value h-full">
                  <div 
                    className="icon-gradient mb-6" 
                    style={{ WebkitMaskImage: `url(${f.icon})`, maskImage: `url(${f.icon})` }}
                  />
                  <h3 className="text-base font-bold mb-3">{f.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Why Choose {schoolName}?</h2>
              <p className="text-[13px] text-gray-600 leading-relaxed">At {schoolName}, Seriki, our vision is to be a beacon of educational excellence in rural Ogun state and beyond.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {stats.map((s, i) => (
                <div key={i} className="p-8 border border-gray-100 rounded-xl shadow-sm text-center">
                  <div className="text-3xl font-bold mb-1">{s.value}</div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50">
        <div className="container px-4 max-w-6xl mx-auto text-center">
          <h2 className="section-title">School Testimonial</h2>
          <p className="section-subtitle">Our education brings satisfaction to our students.</p>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((t, i) => (
              <Card key={i} className="p-8 text-left bg-white border-none shadow-sm rounded-xl">
                <p className="text-[13px] text-gray-500 italic mb-8">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className="font-bold text-xs">{t.name}</h4>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-24 bg-white text-center">
        <div className="container px-4 max-w-6xl mx-auto">
          <h2 className="section-title">School Gallery</h2>
          <p className="section-subtitle">Check out some pictures of our students.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {galleryImages.map((img, i) => (
              <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden"><img src={`/images/${img}`} alt="Gallery" className="w-full h-full object-cover" /></div>
            ))}
          </div>
          <Button asChild className="btn-primary mx-auto"><Link href="/gallery" className="flex items-center gap-2"><span>View More</span><ArrowRight className="w-3 h-3" /></Link></Button>
        </div>
      </section>

      {/* Contact & FAQ */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-4xl mx-auto text-center">
          <h2 className="section-title">Contact Us</h2>
          <p className="section-subtitle">Let us know your thoughts.</p>
          <form className="space-y-6 text-left mb-24">
            <div className="grid md:grid-cols-2 gap-6">
              <input type="text" placeholder="First Name" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-pink-500" />
              <input type="text" placeholder="Last Name" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-pink-500" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <input type="email" placeholder="Email" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-pink-500" />
              <input type="tel" placeholder="Phone" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-pink-500" />
            </div>
            <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-pink-500" />
            <Button type="submit" className="btn-primary mx-auto">Send Message</Button>
          </form>
          
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="text-left space-y-4">
            {[{q:"When established?",a:"2012"},{q:"Curriculum?",a:"Approved curriculum"},{q:"Location?",a:"Egbedi, Osun State"},{q:"Boarding?",a:"Both"}].map((faq, i) => (
              <Accordion type="single" collapsible key={i} className="bg-white px-6 rounded-lg shadow-sm border border-gray-50">
                <AccordionItem value={`i-${i}`} className="border-none">
                  <AccordionTrigger className="text-[11px] font-bold py-5 hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-[11px] text-gray-500 pb-5">{faq.a}</AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
