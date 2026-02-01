import { useState, useEffect } from 'react';
import PublicLayout from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const schoolAddress = settings?.schoolAddress || "Seriki, Ogun State";
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
    { name: "Adebayo Daniel", role: "Student", text: `${schoolName} has not only prepared me academically but has also taught me important life skills. The school's focus on values and ethics has shaped my perspective on the world.`, img: "/images/Tijani Abdulbasit.jpg" },
    { name: "Abubakar Korede", role: "Student", text: `At ${schoolName}, I've learned the value of leadership and teamwork. The school's emphasis on character development has empowered me to take on responsibilities.`, img: "/images/Yisa Balakis.jpg" }
  ];

  const galleryImages = [
    "banner 1.jpeg", "group of students.jpg", "students 2.jpeg", 
    "students 1.jpeg", "student studying.jpeg", "students in class.jpg"
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/student studying.jpeg" alt="Hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="container relative z-10 text-center text-white px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              We Nurture <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="text-[#00BFFF] inline-block">Young Minds.</motion.span><br />
              We Build <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.5 }} className="text-[#00BFFF] inline-block">Character.</motion.span><br />
              We Shape the <motion.span initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.5 }} className="text-[#00BFFF] inline-block">Future.</motion.span>
            </h1>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} className="text-base md:text-lg mb-10 text-gray-200 italic font-medium">
              Treasure Home School is a school where qualitative education and moral excellence shape confident learners.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }} className="flex flex-row gap-4 justify-center items-center">
              <Button asChild className="btn-hero-about h-11 px-8 hover-elevate active-elevate-2"><Link href="/portal/login">ENROLL</Link></Button>
              <Button asChild className="btn-hero-contact h-11 px-8 hover-elevate active-elevate-2"><Link href="/contact">CONTACT</Link></Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Section - TEXT FIRST THEN IMAGE (As per user feedback) */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto text-center">
          <motion.div {...fadeIn} className="max-w-3xl mx-auto mb-12">
            <div className="flex flex-col items-center gap-4 mb-8">
              <h2 className="text-3xl md:text-5xl font-bold mb-2">{schoolName}</h2>
              <div className="w-12 h-[2px] bg-gradient-to-r from-[#0000FF] to-[#00BFFF]" />
            </div>
            <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-6">
              Treasure Home School is a private educational institution committed to providing quality education and strong moral upbringing. We believe every child is unique and deserves careful guidance to discover their full potential.
            </p>
            <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-8">
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
          <h2 className="section-title">{schoolName} Core Values</h2>
          <p className="section-subtitle">At {schoolName}, we are guided by six core values that form the foundation of our educational philosophy.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div key={i} {...fadeIn}>
                <div className="card-value h-full">
                  <div 
                    className="icon-gradient mb-6" 
                    style={{ WebkitMaskImage: `url(${f.icon})`, maskImage: `url(${f.icon})` }}
                  />
                  <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container px-4 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8 sticky top-32">
              <div className="space-y-4">
                <h2 className="text-5xl md:text-6xl font-bold leading-tight text-[#1a1a1a]">
                  Why Choose<br />
                  <span className="text-[#0000FF]">Treasure-Home</span><br />
                  School?
                </h2>
                <div className="w-16 h-1 bg-[#0000FF] rounded-full" />
              </div>
              
              <div className="space-y-6">
                <p className="text-[15px] text-gray-600 leading-relaxed font-medium">
                  At Treasure-Home School, Seriki-Soyinka, we don't just teach—we inspire. Our vision is to be a sanctuary of academic brilliance and a cornerstone of moral development in Ogun State and beyond.
                </p>
                <p className="text-[14px] text-gray-500 leading-relaxed">
                  We are dedicated to equipping our students with the critical thinking skills, technological savvy, and unwavering integrity needed to thrive in a globalized world. By choosing us, you are placing your child in an environment that fosters compassion, innovation, and leadership, ensuring they emerge as confident trailblazers of tomorrow.
                </p>
                <p className="text-[14px] text-gray-500 leading-relaxed">
                  Join our community of excellence where we uphold the highest standards of academic integrity and character building, shaping a future where our graduates lead with purpose and excellence.
                </p>
              </div>

              <div className="pt-8 flex flex-col items-center">
                <Button 
                  asChild 
                  variant="outline" 
                  className="group relative h-14 px-10 border-2 border-[#0000FF] text-[#0000FF] hover:bg-[#0000FF] hover:text-white transition-all duration-300 rounded-lg overflow-hidden flex items-center gap-3 bg-white"
                >
                  <Link href="/portal/login" className="flex items-center gap-3">
                    <span className="font-bold tracking-wide uppercase text-sm">Enroll Your Child</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-24 lg:pt-0">
              {stats.map((s, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="group relative p-10 bg-white border border-gray-50 rounded-2xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] transition-all duration-500 hover:-translate-y-2 text-center"
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#0000FF]/10 group-hover:bg-[#0000FF] transition-colors duration-500 rounded-b-full" />
                  <div className="text-4xl md:text-5xl font-black mb-3 text-gray-900 group-hover:text-[#0000FF] transition-colors duration-500">{s.value}</div>
                  <div className="w-8 h-[2px] bg-gray-100 mx-auto mb-4 group-hover:bg-[#0000FF]/30 transition-colors" />
                  <div className="text-[11px] text-gray-400 uppercase tracking-[0.2em] font-extrabold">{s.label}</div>
                  {s.label === "Pass Rate" && <div className="text-[12px] text-gray-300 mt-1 italic">to Universities</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50 overflow-hidden">
        <div className="container px-4 max-w-4xl mx-auto text-center">
          <h2 className="section-title">School Testimonial</h2>
          <div className="w-12 h-[2px] bg-[#0000FF] mx-auto mb-6" />
          <p className="section-subtitle mb-12">Our education brings satisfaction to our students. Here are a few testimonials.</p>
          
          <div className="relative h-[400px] md:h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                <Card className="p-10 text-left bg-white border-none shadow-xl rounded-2xl h-full flex flex-col justify-center">
                  <div className="text-[#0000FF] mb-6">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21M14.017 21H21.017M14.017 21C12.9124 21 12.017 20.1046 12.017 19V15C12.017 13.8954 12.9124 13 14.017 13H15.017C15.017 10.2386 12.7784 8 10.017 8V5C14.4353 5 18.017 8.58172 18.017 13V13.017" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <path d="M5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21M5.017 21H12.017M5.017 21C3.91243 21 3.017 20.1046 3.017 19V15C3.017 13.8954 3.91243 13 5.017 13H6.017C6.017 10.2386 3.77843 8 1.017 8V5C5.43528 5 9.017 8.58172 9.017 13V13.017" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                  <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-8">
                    {testimonials[currentTestimonial].text}
                  </p>
                  <div className="flex items-center gap-4">
                    <img src={testimonials[currentTestimonial].img} alt={testimonials[currentTestimonial].name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" />
                    <div>
                      <div className="w-8 h-[2px] bg-[#0000FF] mb-2" />
                      <h4 className="font-bold text-base text-gray-900">{testimonials[currentTestimonial].name}</h4>
                      <p className="text-[12px] text-gray-400 uppercase tracking-widest">{testimonials[currentTestimonial].role}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  currentTestimonial === i ? 'bg-[#0000FF] w-6' : 'bg-gray-300'
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
          <p className="section-subtitle">Check out some pictures of our students.</p>
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
                <img src={`/images/${img}`} alt="Gallery" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
              </motion.div>
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
              <input type="text" placeholder="First Name" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="text" placeholder="Last Name" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <input type="email" placeholder="Email" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="tel" placeholder="Phone" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
