import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Plus, Edit, Trash2, CheckCircle, XCircle, FileText, Mail, Phone, Calendar, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const vacancySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  requirements: z.string().min(10, 'Requirements must be at least 10 characters'),
  subjectArea: z.string().min(1, 'Subject area is required'),
  deadline: z.string().min(1, 'Deadline is required'),
});

type VacancyFormData = z.infer<typeof vacancySchema>;

export default function VacancyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedVacancy, setSelectedVacancy] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  const form = useForm<VacancyFormData>({
    resolver: zodResolver(vacancySchema),
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      subjectArea: '',
      deadline: '',
    },
  });

  // Fetch vacancies
  const { data: vacancies = [], isLoading: loadingVacancies } = useQuery<any[]>({
    queryKey: ['/api/vacancies'],
  });

  // Fetch applications
  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({
    queryKey: ['/api/admin/applications'],
  });

  useSocketIORealtime({ 
    table: 'job_vacancies', 
    queryKey: ['/api/vacancies']
  });
  
  useSocketIORealtime({ 
    table: 'teacher_applications', 
    queryKey: ['/api/admin/applications']
  });

  // Create vacancy mutation
  const createVacancyMutation = useMutation({
    mutationFn: async (data: VacancyFormData) => {
      return apiRequest('POST', '/api/admin/vacancies', { ...data, status: 'open' });
    },
    onMutate: async (newVacancy) => {
      await queryClient.cancelQueries({ queryKey: ['/api/vacancies'] });
      const previousData = queryClient.getQueryData(['/api/vacancies']);
      
      queryClient.setQueryData(['/api/vacancies'], (old: any) => {
        const tempVacancy = { ...newVacancy, id: 'temp-' + Date.now(), status: 'open', createdAt: new Date() };
        if (!old) return [tempVacancy];
        return [tempVacancy, ...old];
      });
      
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacancies'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Vacancy created successfully',
      });
    },
    onError: (error: any, newVacancy, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/vacancies'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to create vacancy',
        variant: 'destructive',
      });
    },
  });

  // Close vacancy mutation
  const closeVacancyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('PATCH', `/api/admin/vacancies/${id}/close`);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/vacancies'] });
      const previousData = queryClient.getQueryData(['/api/vacancies']);
      
      queryClient.setQueryData(['/api/vacancies'], (old: any) => {
        if (!old) return old;
        return old.map((vacancy: any) => 
          vacancy.id === id ? { ...vacancy, status: 'closed' } : vacancy
        );
      });
      
      toast({ title: "Closing...", description: "Updating vacancy status" });
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacancies'] });
      toast({
        title: 'Success',
        description: 'Vacancy closed successfully',
      });
    },
    onError: (error: any, id: string, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/vacancies'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to close vacancy',
        variant: 'destructive',
      });
    },
  });

  // Approve/Reject application mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => {
      return apiRequest('PATCH', `/api/admin/applications/${id}/status`, { status });
    },
    onMutate: async ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/admin/applications'] });
      const previousData = queryClient.getQueryData(['/api/admin/applications']);
      
      queryClient.setQueryData(['/api/admin/applications'], (old: any) => {
        if (!old) return old;
        return old.map((app: any) => 
          app.id === id ? { ...app, status } : app
        );
      });
      
      toast({ 
        title: status === 'approved' ? "Approving..." : "Rejecting...", 
        description: "Processing application" 
      });
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/applications'] });
      setSelectedApplication(null);
      toast({
        title: 'Success',
        description: 'Application updated successfully',
      });
    },
    onError: (error: any, variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/admin/applications'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to update application',
        variant: 'destructive',
      });
    },
  });

  const onSubmitVacancy = (data: VacancyFormData) => {
    createVacancyMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">Open</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      case 'filled':
        return <Badge className="bg-blue-500">Filled</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const approvedApplications = applications.filter(app => app.status === 'approved');
  const rejectedApplications = applications.filter(app => app.status === 'rejected');

  if (!user) return null;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Job Vacancies & Applications</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage teacher recruitment and review applications</p>
        </div>

        <Tabs defaultValue="vacancies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="vacancies" data-testid="tab-vacancies">
              <Briefcase className="h-4 w-4 mr-2" />
              Vacancies
            </TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">
              <FileText className="h-4 w-4 mr-2" />
              Applications ({pendingApplications.length})
            </TabsTrigger>
          </TabsList>

          {/* Vacancies Tab */}
          <TabsContent value="vacancies">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Job Vacancies</CardTitle>
                    <CardDescription>Create and manage teacher job postings</CardDescription>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-vacancy">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Vacancy
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Vacancy</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitVacancy)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Job Title</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Mathematics Teacher" {...field} data-testid="input-vacancy-title" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="subjectArea"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subject Area</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Mathematics, Science, English" {...field} data-testid="input-subject-area" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Describe the role and responsibilities..." 
                                    className="min-h-[100px]"
                                    {...field}
                                    data-testid="textarea-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="requirements"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Requirements</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="List the qualifications and requirements..." 
                                    className="min-h-[100px]"
                                    {...field}
                                    data-testid="textarea-requirements"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="deadline"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Application Deadline</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-deadline" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsCreateDialogOpen(false)}
                              data-testid="button-cancel-vacancy"
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createVacancyMutation.isPending}
                              data-testid="button-submit-vacancy"
                            >
                              {createVacancyMutation.isPending ? 'Creating...' : 'Create Vacancy'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingVacancies ? (
                  <p className="text-center py-8">Loading vacancies...</p>
                ) : vacancies.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No vacancies created yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Subject Area</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacancies.map((vacancy) => (
                        <TableRow key={vacancy.id}>
                          <TableCell className="font-medium">{vacancy.title}</TableCell>
                          <TableCell>{vacancy.subjectArea}</TableCell>
                          <TableCell>{format(new Date(vacancy.deadline), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{getStatusBadge(vacancy.status)}</TableCell>
                          <TableCell>
                            {vacancy.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => closeVacancyMutation.mutate(vacancy.id)}
                                disabled={closeVacancyMutation.isPending}
                                data-testid={`button-close-vacancy-${vacancy.id}`}
                              >
                                Close Vacancy
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <div className="space-y-6">
              {/* Pending Applications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 text-yellow-500" />
                    Pending Review ({pendingApplications.length})
                  </CardTitle>
                  <CardDescription>Applications awaiting your review</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingApplications ? (
                    <p className="text-center py-8">Loading applications...</p>
                  ) : pendingApplications.length === 0 ? (
                    <p className="text-center py-8 text-gray-600 dark:text-gray-400">No pending applications</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Vacancy</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingApplications.map((app) => {
                          const vacancy = vacancies.find(v => v.id === app.vacancyId);
                          return (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium">{app.fullName}</TableCell>
                              <TableCell>{app.googleEmail}</TableCell>
                              <TableCell>{app.phoneNumber}</TableCell>
                              <TableCell>{vacancy?.title || 'N/A'}</TableCell>
                              <TableCell>{format(new Date(app.createdAt), 'MMM dd, yyyy')}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedApplication(app)}
                                    data-testid={`button-view-application-${app.id}`}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600"
                                    onClick={() => updateApplicationMutation.mutate({ id: app.id, status: 'approved' })}
                                    disabled={updateApplicationMutation.isPending}
                                    data-testid={`button-approve-${app.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updateApplicationMutation.mutate({ id: app.id, status: 'rejected' })}
                                    disabled={updateApplicationMutation.isPending}
                                    data-testid={`button-reject-${app.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Approved Applications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                    Approved ({approvedApplications.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {approvedApplications.length === 0 ? (
                    <p className="text-center py-8 text-gray-600 dark:text-gray-400">No approved applications</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Vacancy</TableHead>
                          <TableHead>Approved Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedApplications.map((app) => {
                          const vacancy = vacancies.find(v => v.id === app.vacancyId);
                          return (
                            <TableRow key={app.id}>
                              <TableCell className="font-medium">{app.fullName}</TableCell>
                              <TableCell>{app.googleEmail}</TableCell>
                              <TableCell>{vacancy?.title || 'N/A'}</TableCell>
                              <TableCell>{format(new Date(app.createdAt), 'MMM dd, yyyy')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Application Detail Dialog */}
        {selectedApplication && (
          <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                    <p className="text-base">{selectedApplication.fullName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <p className="text-base">{selectedApplication.googleEmail}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Phone</Label>
                    <p className="text-base">{selectedApplication.phoneNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Subject Specialization</Label>
                    <p className="text-base">{selectedApplication.subjectSpecialization}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Years of Experience</Label>
                    <p className="text-base">{selectedApplication.yearsOfExperience}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Highest Qualification</Label>
                    <p className="text-base">{selectedApplication.highestQualification}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Cover Letter</Label>
                  <p className="text-base mt-1 whitespace-pre-wrap">{selectedApplication.coverLetter}</p>
                </div>
                {selectedApplication.resumeUrl && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Resume</Label>
                    <div className="mt-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={selectedApplication.resumeUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          View Resume
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedApplication(null)}
                    data-testid="button-close-details"
                  >
                    Close
                  </Button>
                  {selectedApplication.status === 'pending' && (
                    <>
                      <Button
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => {
                          updateApplicationMutation.mutate({ id: selectedApplication.id, status: 'approved' });
                        }}
                        disabled={updateApplicationMutation.isPending}
                        data-testid="button-approve-detail"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          updateApplicationMutation.mutate({ id: selectedApplication.id, status: 'rejected' });
                        }}
                        disabled={updateApplicationMutation.isPending}
                        data-testid="button-reject-detail"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
}
