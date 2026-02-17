import { useState, useEffect } from "react";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, User } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import girlsImage from "@/assets/girls-image.png";
import gallery1 from "@/assets/gallery-1.png";
import gallery2 from "@/assets/gallery-2.png";
import gallery3 from "@/assets/gallery-3.png";
import gallery4 from "@/assets/gallery-4.png";
import gallery5 from "@/assets/gallery-5.png";
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

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmails: string;
  schoolPhones: string;
  schoolAddress: string;
  schoolLogo?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

export default function Home() {
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
  });

  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -80]);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    return scrollY.onChange((latest) => {
      if (latest <= 5) {
        setIsAtTop(true);
      } else {
        setIsAtTop(false);
      }
    });
  }, [scrollY]);

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolAddress = settings?.schoolAddress || "Seriki, Ogun State";
  const schoolLogo = settings?.schoolLogo || "";

  let schoolPhones: Array<{ countryCode: string; number: string }> = [];
  let schoolEmails: string[] = [];
  try {
    schoolPhones = JSON.parse(settings?.schoolPhones || "[]");
    schoolEmails = JSON.parse(settings?.schoolEmails || "[]");
  } catch (e) {
    console.error("Error parsing settings JSON", e);
  }

  const features = [
    {
      title: "Uprightness",
      desc: "Promoting honesty, integrity, and moral values in all aspects of school life.",
      icon: "/images/01.png",
    },
    {
      title: "Academic Excellence",
      desc: "Striving for high academic standards and continuous improvement in teaching and learning.",
      icon: "/images/02.png",
    },
    {
      title: "Innovation",
      desc: "Encouraging creativity, critical thinking, and problem-solving skills among students.",
      icon: "/images/03.png",
    },
    {
      title: "Inclusivity",
      desc: "Embracing diversity and ensuring that all students have equal access to quality education.",
      icon: "/images/04.png",
    },
    {
      title: "Community Engagement",
      desc: "Fostering a sense of social responsibility and active involvement in the local community.",
      icon: "/images/05.png",
    },
    {
      title: "Lifelong Learning",
      desc: "Instilling a passion for learning that extends beyond the classroom.",
      icon: "/images/06.png",
    },
  ];

  const stats = [
    { label: "Satisfied Parents", value: "100%" },
    { label: "Experienced Teachers", value: "20+" },
    { label: "Enrolled Students", value: "900+" },
    { label: "Pass Rate", value: "99%" },
  ];

  const testimonials = [
    {
      name: "Adebayo Daniel",
      role: "Student",
      text: `${schoolName} has not only prepared me academically but has also taught me important life skills. The school's focus on values and ethics has shaped my perspective on the world.`,
      img: "",
    },
    {
      name: "Abubakar Korede",
      role: "Student",
      text: `At ${schoolName}, I've learned the value of leadership and teamwork. The school's emphasis on character development has empowered me to take on responsibilities.`,
      img: "",
    },
  ];

  const galleryImages = [
    gallery1,
    gallery2,
    gallery3,
    gallery4,
    gallery5,
    gallery6,
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
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
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
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-start">
            <motion.div {...fadeIn} className="flex-1 text-left">
              <div className="flex flex-col items-start gap-4 mb-8">
                <h2 className="text-3xl md:text-5xl font-bold mb-2">
                  {schoolName}
                </h2>
                <div className="w-12 h-[2px] bg-gradient-to-r from-[#0000FF] to-[#00BFFF]" />
              </div>
              <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-6">
                Treasure Home School is a private educational institution
                committed to providing quality education and strong moral
                upbringing. We believe every child is unique and deserves
                careful guidance to discover their full potential.
              </p>
              <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-8">
                Our teaching approach combines sound academics, discipline,
                creativity, and life skills to prepare pupils for future
                challenges.
              </p>
              <Button asChild className="btn-primary">
                <Link href="/about" className="flex items-center gap-2">
                  <span>Learn More</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </motion.div>

            <motion.div {...fadeIn} className="flex-1 w-full lg:w-1/2">
              <img
                src={schoolBuilding}
                alt="Treasure Home School Building"
                className="rounded-lg shadow-lg w-full h-[300px] md:h-[400px] lg:h-[450px] object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 bg-white">
        <div className="container px-4 max-w-6xl mx-auto text-center">
          <h2 className="section-title">{schoolName} Core Values</h2>
          <p className="section-subtitle">
            At {schoolName}, we are guided by six core values that form the
            foundation of our educational philosophy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div key={i} {...fadeIn}>
                <div className="card-value h-full">
                  <div
                    className="icon-gradient mb-6"
                    style={{
                      WebkitMaskImage: `url(${f.icon})`,
                      maskImage: `url(${f.icon})`,
                    }}
                  />
                  <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,191,255,0.05),transparent_70%),radial-gradient(circle_at_bottom_left,rgba(0,0,255,0.03),transparent_70%)] pointer-events-none" />

        <div className="container px-4 max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="space-y-8 lg:sticky lg:top-32 text-left">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-[#1a1a1a]">
                  Why Choose
                  <br />
                  <span className="bg-gradient-to-r from-[#0000FF] to-[#00BFFF] bg-clip-text text-transparent">
                    Treasure-Home
                  </span>
                  <br />
                  School?
                </h2>
                <div className="w-16 h-1 bg-[#0000FF] rounded-full" />
              </div>

              <div className="space-y-6">
                <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed">
                  At Treasure-Home School, Seriki-Soyinka, we don't just
                  teach—we inspire academic excellence and deep-rooted moral
                  values. Our vision is to be a sanctuary of brilliance and
                  character development in Ogun State and beyond.
                </p>
                <p className="text-[15px] md:text-[16px] text-gray-600 leading-relaxed">
                  We are dedicated to equipping our students with the critical
                  thinking skills, technological savvy, and unwavering integrity
                  needed to thrive. By choosing us, you place your child in an
                  environment that fosters leadership, ensuring they emerge as
                  confident trailblazers of tomorrow.
                </p>
              </div>

              <div className="pt-4 flex justify-start">
                <Button 
                  asChild 
                  className="enroll-button-custom h-12 md:h-14 px-8 md:px-10 transition-all duration-300 rounded-lg flex items-center gap-3 w-full sm:w-auto shadow-lg hover:shadow-blue-500/25"
                >
                  <Link href="/login">
                    <span>
                      ENROLL YOUR CHILD
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-12 lg:pt-0">
              {stats.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="group relative p-8 md:p-10 bg-white border border-gray-100 rounded-xl shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 text-center"
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#0000FF]/10 group-hover:bg-[#0000FF] transition-colors duration-500 rounded-b-full" />
                  <div className="text-4xl md:text-5xl font-black mb-3 text-gray-900 group-hover:bg-gradient-to-r group-hover:from-[#0000FF] group-hover:to-[#00BFFF] group-hover:bg-clip-text group-hover:text-transparent transition-all duration-500">
                    {s.value}
                  </div>
                  <div className="w-8 h-[2px] bg-gray-100 mx-auto mb-4 group-hover:bg-[#0000FF]/30 transition-colors" />
                  <div className="text-[11px] text-gray-400 uppercase tracking-[0.2em] font-extrabold">
                    {s.label}
                  </div>
                  {s.label === "Pass Rate" && (
                    <div className="text-[12px] text-gray-300 mt-1 italic">
                      to Universities
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(0,0,255,0.02)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(0,191,255,0.02)_0px,transparent_50%)] pointer-events-none" />
        <div className="container px-4 max-w-4xl mx-auto text-center relative z-10">
          <h2 className="section-title">School Testimonial</h2>
          <div className="w-12 h-[2px] bg-[#0000FF] mx-auto mb-6" />
          <p className="section-subtitle mb-12">
            Our education brings satisfaction to our students. Here are a few
            testimonials.
          </p>

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
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21M14.017 21H21.017M14.017 21C12.9124 21 12.017 20.1046 12.017 19V15C12.017 13.8954 12.9124 13 14.017 13H15.017C15.017 10.2386 12.7784 8 10.017 8V5C14.4353 5 18.017 8.58172 18.017 13V13.017"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <path
                        d="M5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21M5.017 21H12.017M5.017 21C3.91243 21 3.017 20.1046 3.017 19V15C3.017 13.8954 3.91243 13 5.017 13H6.017C6.017 10.2386 3.77843 8 1.017 8V5C5.43528 5 9.017 8.58172 9.017 13V13.017"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                  <p className="text-[16px] md:text-[18px] text-gray-600 leading-relaxed mb-8">
                    {testimonials[currentTestimonial].text}
                  </p>
                  <div className="flex items-center gap-4">
                    {testimonials[currentTestimonial].img ? (
                      <img
                        src={testimonials[currentTestimonial].img}
                        alt={testimonials[currentTestimonial].name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-md">
                        <User className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <div className="w-8 h-[2px] bg-[#0000FF] mb-2" />
                      <h4 className="font-bold text-base text-gray-900">
                        {testimonials[currentTestimonial].name}
                      </h4>
                      <p className="text-[12px] text-gray-400 uppercase tracking-widest">
                        {testimonials[currentTestimonial].role}
                      </p>
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
                  currentTestimonial === i ? "bg-[#0000FF] w-6" : "bg-gray-300"
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
      <section className="py-24 bg-gray-50">
        <div className="container px-4 max-w-4xl mx-auto">
          <h2 className="section-title text-center">Frequently Asked Questions</h2>
          <p className="section-subtitle text-center">Find answers to common questions about Treasure-Home School.</p>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="border border-gray-200 rounded-lg bg-white px-6">
              <AccordionTrigger className="text-left font-bold py-6 hover:no-underline">What is the school curriculum?</AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-6">
                We follow a comprehensive curriculum that blends national standards with international best practices, focusing on academic excellence and character development.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border border-gray-200 rounded-lg bg-white px-6">
              <AccordionTrigger className="text-left font-bold py-6 hover:no-underline">How do I enroll my child?</AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-6">
                You can start the enrollment process by visiting our Admissions page or clicking the "ENROLL" button on the home page to fill out the registration form.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border border-gray-200 rounded-lg bg-white px-6">
              <AccordionTrigger className="text-left font-bold py-6 hover:no-underline">What are the school hours?</AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-6">
                Our standard school hours are from 8:00 AM to 3:30 PM, Monday through Friday. Extracurricular activities may extend these hours for participating students.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </PublicLayout>
  );
}
