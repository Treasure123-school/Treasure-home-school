import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Briefcase, Calendar, CheckCircle, Mail, Phone, User, BookOpen, GraduationCap, FileText, Loader2 } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';
import { format } from 'date-fns';

const applicationSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  googleEmail: z.string().email().regex(/@gmail\.com$/, 'Must be a Gmail address'),
  phone: z.string().min(1, 'Phone number is required'),
  subjectSpecialty: z.string().min(1, 'Subject specialty is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  experienceYears: z.number().min(0, 'Experience must be 0 or greater'),
  bio: z.string().min(50, 'Bio must be at least 50 characters'),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

interface Vacancy {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  deadline: string;
  status: string;
  createdAt: string;
}
export default function JobVacancy() {
  const { toast } = useToast();
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const { data: vacancies = [], isLoading } = useQuery<Vacancy[]>({
    queryKey: ['/api/vacancies'],
  });

  const openVacancies = vacancies.filter(v => v.status === 'open');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      experienceYears: 0,
    },
  });

  const applicationMutation = useMutation({
    mutationFn: async (data: ApplicationForm) => {
      const response = await apiRequest('POST', '/api/teacher-applications', {
        ...data,
        vacancyId: selectedVacancy,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: 'Your application has been submitted successfully. We will review it and get back to you soon.',
        className: 'border-green-500 bg-green-50 dark:bg-green-950/50',
      });
      reset();
      setShowApplicationForm(false);
      setSelectedVacancy(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Application Failed',
        description: error.message || 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ApplicationForm) => {
    applicationMutation.mutate(data);
  };

  const handleApply = (vacancyId: string) => {
    setSelectedVacancy(vacancyId);
    setShowApplicationForm(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Career Opportunities
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join our team of dedicated educators at Treasure-Home School. Shape young minds and build a rewarding career in education.
          </p>
        </div>

        {/* Vacancies List */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Open Positions</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : openVacancies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No open positions at the moment. Please check back later.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {openVacancies.map((vacancy) => (
                <Card key={vacancy.id} className="hover:shadow-lg transition-shadow" data-testid={`card-vacancy-${vacancy.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl mb-2" data-testid={`text-vacancy-title-${vacancy.id}`}>
                          {vacancy.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2" data-testid={`text-vacancy-deadline-${vacancy.id}`}>
                          <Calendar className="h-4 w-4" />
                          Deadline: {format(new Date(vacancy.deadline), 'MMMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => handleApply(vacancy.id)}
                        data-testid={`button-apply-${vacancy.id}`}
                      >
                        Apply Now
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Description</h4>
                        <p className="text-gray-600 dark:text-gray-300">{vacancy.description}</p>
                      </div>
                      {vacancy.requirements && (
                        <div>
                          <h4 className="font-semibold mb-2">Requirements</h4>
                          <p className="text-gray-600 dark:text-gray-300">{vacancy.requirements}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Application Form */}
        {showApplicationForm && (
          <div id="application-form" className="mb-12">
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle className="text-2xl">Teacher Application Form</CardTitle>
                <CardDescription>
                  Please fill out the form below to apply. All fields are required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        {...register('fullName')}
                        placeholder="John Doe"
                        data-testid="input-fullname"
                      />
                      {errors.fullName && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-fullname">{errors.fullName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="googleEmail" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Gmail Address
                      </Label>
                      <Input
                        id="googleEmail"
                        type="email"
                        {...register('googleEmail')}
                        placeholder="teacher@gmail.com"
                        data-testid="input-email"
                      />
                      {errors.googleEmail && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-email">{errors.googleEmail.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        {...register('phone')}
                        placeholder="+234 XXX XXX XXXX"
                        data-testid="input-phone"
                      />
                      {errors.phone && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-phone">{errors.phone.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="subjectSpecialty" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Subject Specialty
                      </Label>
                      <Input
                        id="subjectSpecialty"
                        {...register('subjectSpecialty')}
                        placeholder="Mathematics, English, etc."
                        data-testid="input-subject"
                      />
                      {errors.subjectSpecialty && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-subject">{errors.subjectSpecialty.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="qualification" className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Qualification
                      </Label>
                      <Input
                        id="qualification"
                        {...register('qualification')}
                        placeholder="B.Ed., M.Sc., etc."
                        data-testid="input-qualification"
                      />
                      {errors.qualification && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-qualification">{errors.qualification.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="experienceYears" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Years of Experience
                      </Label>
                      <Input
                        id="experienceYears"
                        type="number"
                        {...register('experienceYears', { valueAsNumber: true })}
                        min="0"
                        data-testid="input-experience"
                      />
                      {errors.experienceYears && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-experience">{errors.experienceYears.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bio" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cover Letter / Bio (minimum 50 characters)
                    </Label>
                    <Textarea
                      id="bio"
                      {...register('bio')}
                      placeholder="Tell us about yourself, your teaching philosophy, and why you'd like to join Treasure-Home School..."
                      rows={6}
                      data-testid="input-bio"
                    />
                    {errors.bio && (
                      <p className="text-sm text-red-500 mt-1" data-testid="error-bio">{errors.bio.message}</p>
                    )}
                  </div>

                  <div className="flex gap-4 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowApplicationForm(false);
                        setSelectedVacancy(null);
                        reset();
                      }}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={applicationMutation.isPending}
                      data-testid="button-submit"
                    >
                      {applicationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Application'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
