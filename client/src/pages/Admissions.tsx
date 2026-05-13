import PublicLayout from '@/components/layout/PublicLayout';
import { motion } from 'framer-motion';
import heroStudents from "@/assets/hero-students.png";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Search,
  UserCheck,
  CheckCircle,
  ClipboardList,
  Check,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Calendar,
  User,
  Home,
  ArrowRight,
  Info
} from 'lucide-react';

import { ContactUtils } from '@shared/contact-utils';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolEmails: any;
  schoolPhones: any;
  schoolAddress: string;
}

const admissionSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  classApplying: z.string().min(1, 'Class is required'),
  parentName: z.string().min(1, 'Parent name is required'),
  parentEmail: z.string().email('Valid email is required'),
  parentPhone: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  previousSchool: z.string().optional().default(''),
  medicalInfo: z.string().optional().default(''),
  additionalInfo: z.string().optional().default(''),
});

type AdmissionForm = z.infer<typeof admissionSchema>;

export default function Admissions() {
  const { toast } = useToast();

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "";
  const schoolEmail = ContactUtils.getPrimaryEmail(settings);
  const schoolPhone = ContactUtils.getFormattedPrimaryPhone(settings);
  const schoolAddress = settings?.schoolAddress || "";

  const form = useForm<AdmissionForm>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      studentName: '',
      dateOfBirth: '',
      gender: '',
      classApplying: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      address: '',
      previousSchool: '',
      medicalInfo: '',
      additionalInfo: '',
    },
  });

  const admissionMutation = useMutation({
    mutationFn: (data: AdmissionForm) => apiRequest('POST', '/api/admissions', data),
    onSuccess: () => {
      toast({
        title: 'Application Submitted!',
        description: 'Thank you for your application. We will contact you soon with next steps.',
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AdmissionForm) => {
    admissionMutation.mutate(data);
  };

  const admissionProcess = [
    {
      step: '1',
      title: 'Submit Application',
      description: 'Complete and submit the online application form with required documents.',
      icon: FileText,
    },
    {
      step: '2',
      title: 'Document Review',
      description: 'Our admissions team reviews your application and supporting documents.',
      icon: Search,
    },
    {
      step: '3',
      title: 'Assessment & Interview',
      description: 'Student assessment and parent interview (if applicable for the grade level).',
      icon: UserCheck,
    },
    {
      step: '4',
      title: 'Admission Decision',
      description: 'Receive admission decision and enrollment instructions within 5-7 business days.',
      icon: CheckCircle,
    }
  ];

  const requirements = [
    'Completed application form',
    'Birth certificate or passport copy',
    'Recent passport photographs (2 copies)',
    'Previous school report cards',
    'Medical examination report',
    'Immunization records',
    'Transfer certificate',
    'Application fee receipt'
  ];

  const classOptions = [
    'Playgroup', 'Nursery 1', 'Nursery 2',
    'Primary 1', 'Primary 2', 'Primary 3',
    'Primary 4', 'Primary 5', 'Primary 6',
    'JSS 1', 'JSS 2', 'JSS 3',
    'SSS 1', 'SSS 2', 'SSS 3'
  ];

  return (
    <PublicLayout>
      {/* Hero Section with Background Image */}
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
            data-testid="text-admissions-title"
          >
            Admissions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-gray-200"
            data-testid="text-admissions-subtitle"
          >
            Begin your child's journey to academic excellence and moral development
          </motion.p>
        </div>
      </section>

      {/* Admission Process */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground" data-testid="text-process-title">
              Admission Process
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground" data-testid="text-process-description">
              Our streamlined admission process ensures a smooth enrollment experience
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {admissionProcess.map((process, index) => (
              <Card key={index} className="card-hover border border-border text-center shadow-sm" data-testid={`card-process-${index}`}>
                <CardContent className="p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white font-bold">
                    {process.step}
                  </div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <process.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-3 font-semibold" data-testid={`text-process-title-${index}`}>
                    {process.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {process.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements & Form */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {/* Requirements */}
            <div className="lg:col-span-1">
              <Card className="border border-border shadow-sm" data-testid="card-requirements">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <span data-testid="text-requirements-title">Required Documents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-3" data-testid={`requirement-${index}`}>
                        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="text-sm text-foreground">{req}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 rounded-lg bg-secondary/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4 text-secondary" />
                      <span className="text-sm font-semibold">Application Fee</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ₦5,000 (Non-refundable application processing fee)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Application Form */}
            <div className="lg:col-span-2">
              <Card className="border border-border shadow-sm" data-testid="card-application-form">
                <CardHeader>
                  <CardTitle data-testid="text-form-title">Application Form</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* Section 1: Student */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">Student Information</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="studentName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Student Full Name *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-student-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="dateOfBirth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date of Birth *</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-date-of-birth" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="gender"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Gender *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-gender">
                                      <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="classApplying"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Class Applying For *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-class">
                                      <SelectValue placeholder="Select class" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {classOptions.map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Section 2: Parent */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">Parent/Guardian Information</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="parentName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Parent/Guardian Name *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-parent-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="parentEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address *</FormLabel>
                                <FormControl>
                                  <Input type="email" {...field} data-testid="input-parent-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="parentPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-parent-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Home Address *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-address" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Section 3: Additional */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="previousSchool"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Previous School (if applicable)</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-previous-school" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="medicalInfo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Medical Information / Allergies</FormLabel>
                                <FormControl>
                                  <Textarea rows={3} placeholder="Please list any medical conditions, allergies, or special needs" {...field} data-testid="input-medical-info" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="additionalInfo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Additional Comments</FormLabel>
                                <FormControl>
                                  <Textarea rows={3} placeholder="Any additional information you'd like us to know" {...field} data-testid="input-additional-info" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={admissionMutation.isPending}
                        data-testid="button-submit-application"
                      >
                        {admissionMutation.isPending ? 'Submitting Application...' : 'Submit Application'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h2 className="mb-6 text-3xl font-bold text-foreground" data-testid="text-contact-title">
            Need Help with Your Application?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground" data-testid="text-contact-description">
            Our admissions team is here to assist you throughout the process
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="text-center" data-testid="contact-phone">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">Call Us</h3>
              <p className="text-sm text-muted-foreground">{schoolPhone}</p>
            </div>

            <div className="text-center" data-testid="contact-email">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">Email Us</h3>
              <p className="text-sm text-muted-foreground">{schoolEmail}</p>
            </div>

            <div className="text-center" data-testid="contact-visit">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">Visit Us</h3>
              <p className="text-sm text-muted-foreground">{schoolAddress}</p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}