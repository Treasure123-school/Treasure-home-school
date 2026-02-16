import PublicLayout from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Mail, Clock, Car, Calendar } from 'lucide-react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import heroStudents from "@/assets/hero-students.png";

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmails: string;
  schoolPhones: string;
  schoolAddress: string;
  websiteTitle?: string;
}

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolAddress = settings?.schoolAddress || "Seriki-Soyinka, Ifo, Ogun State, Nigeria";
  const websiteTitle = settings?.websiteTitle || `${schoolName} - Contact Us`;

  let schoolPhones: Array<{ countryCode: string; number: string }> = [];
  let schoolEmails: string[] = [];
  try {
    schoolPhones = JSON.parse(settings?.schoolPhones || "[]");
    schoolEmails = JSON.parse(settings?.schoolEmails || "[]");
  } catch (e) {
    console.error("Error parsing settings JSON", e);
  }

  const displayPhones = schoolPhones.length > 0 
    ? schoolPhones.map(p => `${p.countryCode}${p.number}`).join(', ') 
    : "080-1734-5676";
  const displayEmails = schoolEmails.length > 0 
    ? schoolEmails.join(', ') 
    : "info@treasurehomeschool.com";

  useEffect(() => {
    if (websiteTitle) {
      document.title = websiteTitle;
    }
  }, [websiteTitle]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  const contactMutation = useMutation({
    mutationFn: (data: ContactForm) => apiRequest('POST', '/api/contact', data),
    onSuccess: () => {
      toast({
        title: 'Message Sent!',
        description: 'Thank you for your message. We will get back to you soon.',
      });
      reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ContactForm) => {
    contactMutation.mutate(data);
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Address',
      content: schoolAddress,
      color: 'primary'
    },
    {
      icon: Phone,
      title: 'Phone',
      content: displayPhones,
      color: 'secondary'
    },
    {
      icon: Mail,
      title: 'Email',
      content: displayEmails,
      color: 'green'
    },
    {
      icon: Clock,
      title: 'Office Hours',
      content: 'Monday - Friday: 8:00 AM - 4:00 PM',
      color: 'blue'
    }
  ];

  return (
    <PublicLayout>
      {/* Hero Section with School Background */}
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
            data-testid="text-contact-title"
          >
            Get in Touch
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-gray-200"
            data-testid="text-contact-subtitle"
          >
            We're here to answer your questions and help you discover the Treasure-Home difference
          </motion.p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((info, index) => (
              <Card key={index} className="hover-elevate shadow-sm border border-border" data-testid={`card-contact-info-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 ${
                    info.color === 'primary' ? 'bg-primary/10' :
                    info.color === 'secondary' ? 'bg-secondary/10' :
                    info.color === 'green' ? 'bg-green-100' :
                    'bg-blue-100'
                  }`}>
                    <info.icon className={`${
                      info.color === 'primary' ? 'text-primary' :
                      info.color === 'secondary' ? 'text-secondary' :
                      info.color === 'green' ? 'text-green-600' :
                      'text-blue-600'
                    } w-8 h-8`} />
                  </div>
                  <h3 className="font-semibold mb-2" data-testid={`text-contact-info-title-${index}`}>
                    {info.title}
                  </h3>
                  <p className="text-muted-foreground text-sm" data-testid={`text-contact-info-content-${index}`}>
                    {info.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="shadow-sm border border-border" data-testid="card-contact-form">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="text-form-title">
                  Send us a Message
                </h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      className="mt-2"
                      data-testid="input-name"
                    />
                    {errors.name && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-name">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      className="mt-2"
                      data-testid="input-email"
                    />
                    {errors.email && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-email">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      {...register('message')}
                      className="mt-2"
                      data-testid="input-message"
                    />
                    {errors.message && (
                      <p className="text-destructive text-sm mt-1" data-testid="error-message">
                        {errors.message.message}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={contactMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {contactMutation.isPending ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* School Location */}
            <Card className="shadow-sm border border-border" data-testid="card-location">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="text-location-title">
                  Our Location
                </h2>
                <div className="aspect-video w-full rounded-lg overflow-hidden border border-border mb-6">
                  <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3962.774577134375!2d3.197!3d6.674!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwNDAnMjYuNCJOIDPCsDExJzQ5LjIiRQ!5e0!3m2!1sen!2sng!4v1700000000000!5m2!1sen!2sng" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen={true} 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-primary/10 p-2 rounded-lg mt-1">
                      <MapPin className="text-primary w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">School Address</p>
                      <p className="text-muted-foreground text-sm" data-testid="text-school-address">
                        {schoolAddress}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
