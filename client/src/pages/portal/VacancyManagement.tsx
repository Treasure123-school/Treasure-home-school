import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { useToast } from '@/hooks/use-toast';
import {
  Briefcase, Plus, CheckCircle, XCircle, FileText, Mail, Phone,
  Calendar, User, AlertCircle, MoreVertical, Clock, BookOpen,
} from 'lucide-react';
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    filled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };
  return (
    <Badge className={`text-[10px] capitalize ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </Badge>
  );
}

export default function VacancyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  const form = useForm<VacancyFormData>({
    resolver: zodResolver(vacancySchema),
    defaultValues: { title: '', description: '', requirements: '', subjectArea: '', deadline: '' },
  });

  const { data: vacancies = [], isLoading: loadingVacancies } = useQuery<any[]>({ queryKey: ['/api/vacancies'] });
  const { data: applications = [], isLoading: loadingApplications } = useQuery<any[]>({ queryKey: ['/api/admin/applications'] });

  useSocketIORealtime({ table: 'job_vacancies', queryKey: ['/api/vacancies'] });
  useSocketIORealtime({ table: 'teacher_applications', queryKey: ['/api/admin/applications'] });

  const createVacancyMutation = useMutation({
    mutationFn: async (data: VacancyFormData) =>
      apiRequest('POST', '/api/admin/vacancies', { ...data, status: 'open' }),
    onMutate: async (newVacancy) => {
      await queryClient.cancelQueries({ queryKey: ['/api/vacancies'] });
      const prev = queryClient.getQueryData(['/api/vacancies']);
      queryClient.setQueryData(['/api/vacancies'], (old: any) => {
        const temp = { ...newVacancy, id: 'temp-' + Date.now(), status: 'open', createdAt: new Date() };
        return old ? [temp, ...old] : [temp];
      });
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacancies'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: 'Vacancy created successfully' });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/vacancies'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const closeVacancyMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('PATCH', `/api/admin/vacancies/${id}/close`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/vacancies'] });
      const prev = queryClient.getQueryData(['/api/vacancies']);
      queryClient.setQueryData(['/api/vacancies'], (old: any) =>
        old?.map((v: any) => v.id === id ? { ...v, status: 'closed' } : v) ?? old
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacancies'] });
      toast({ title: 'Vacancy closed' });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/vacancies'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      apiRequest('PATCH', `/api/admin/applications/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/admin/applications'] });
      const prev = queryClient.getQueryData(['/api/admin/applications']);
      queryClient.setQueryData(['/api/admin/applications'], (old: any) =>
        old?.map((a: any) => a.id === id ? { ...a, status } : a) ?? old
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/applications'] });
      setSelectedApplication(null);
      toast({ title: 'Application updated' });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['/api/admin/applications'], ctx.prev);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const pendingApplications = applications.filter((a: any) => a.status === 'pending');
  const approvedApplications = applications.filter((a: any) => a.status === 'approved');

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Job Vacancies & Applications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage teacher recruitment and review applications</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-vacancy">
          <Plus className="h-4 w-4 mr-2" />
          Post Vacancy
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Vacancies', value: vacancies.length, icon: Briefcase, color: 'text-primary' },
          { label: 'Open', value: vacancies.filter((v: any) => v.status === 'open').length, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Pending Review', value: pendingApplications.length, icon: AlertCircle, color: 'text-yellow-600' },
          { label: 'Approved', value: approvedApplications.length, icon: CheckCircle, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`h-6 w-6 ${s.color} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="vacancies" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="vacancies" className="flex-1 sm:flex-none" data-testid="tab-vacancies">
            <Briefcase className="h-4 w-4 mr-2" /> Vacancies
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex-1 sm:flex-none" data-testid="tab-applications">
            <FileText className="h-4 w-4 mr-2" />
            Applications
            {pendingApplications.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-yellow-500 text-white text-[10px] rounded-full">
                {pendingApplications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Vacancies Tab ── */}
        <TabsContent value="vacancies">
          {loadingVacancies ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : vacancies.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No vacancies posted yet</p>
              <p className="text-sm mt-1">Post your first vacancy to start recruiting</p>
              <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Post Vacancy
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vacancies.map((vacancy: any) => (
                <Card key={vacancy.id} className="group hover:border-primary/40 hover:shadow-sm transition-all" data-testid={`card-vacancy-${vacancy.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug truncate">{vacancy.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{vacancy.subjectArea}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={vacancy.status} />
                        {vacancy.status === 'open' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => closeVacancyMutation.mutate(vacancy.id)}
                                disabled={closeVacancyMutation.isPending}
                                data-testid={`button-close-vacancy-${vacancy.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" /> Close Vacancy
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{vacancy.description}</p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Deadline: {vacancy.deadline ? format(new Date(vacancy.deadline), 'MMM dd, yyyy') : 'N/A'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Applications Tab ── */}
        <TabsContent value="applications" className="space-y-6">
          {/* Pending */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold text-sm">Pending Review ({pendingApplications.length})</h3>
            </div>
            {loadingApplications ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : pendingApplications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-xl">
                <p className="text-sm">No pending applications</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingApplications.map((app: any) => {
                  const vacancy = vacancies.find((v: any) => v.id === app.vacancyId);
                  return (
                    <Card key={app.id} className="group hover:border-yellow-300 hover:shadow-sm transition-all" data-testid={`card-application-${app.id}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{app.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{vacancy?.title ?? 'Unknown vacancy'}</p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {app.googleEmail && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span className="truncate">{app.googleEmail}</span></div>}
                          {app.phoneNumber && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span>{app.phoneNumber}</span></div>}
                          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span>Applied {format(new Date(app.createdAt), 'MMM dd, yyyy')}</span></div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-border/50">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setSelectedApplication(app)} data-testid={`button-view-application-${app.id}`}>
                            <User className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => updateApplicationMutation.mutate({ id: app.id, status: 'approved' })}
                            disabled={updateApplicationMutation.isPending}
                            data-testid={`button-approve-${app.id}`}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" className="h-8 text-xs"
                            onClick={() => updateApplicationMutation.mutate({ id: app.id, status: 'rejected' })}
                            disabled={updateApplicationMutation.isPending}
                            data-testid={`button-reject-${app.id}`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Approved */}
          {approvedApplications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm">Approved ({approvedApplications.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {approvedApplications.map((app: any) => {
                  const vacancy = vacancies.find((v: any) => v.id === app.vacancyId);
                  return (
                    <Card key={app.id} className="border-green-200/60 dark:border-green-800/40">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{app.fullName}</p>
                            <p className="text-xs text-muted-foreground">{vacancy?.title ?? 'Unknown vacancy'}</p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {app.googleEmail && <p>{app.googleEmail}</p>}
                          <p>Applied {format(new Date(app.createdAt), 'MMM dd, yyyy')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Vacancy Dialog ── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Create New Vacancy
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createVacancyMutation.mutate(d))} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input placeholder="e.g. Mathematics Teacher" {...field} data-testid="input-vacancy-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subjectArea" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Area</FormLabel>
                    <FormControl><Input placeholder="e.g. Mathematics, Science" {...field} data-testid="input-subject-area" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="deadline" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Deadline</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-deadline" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe the role and responsibilities…" className="min-h-[90px]" {...field} data-testid="textarea-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="requirements" render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements</FormLabel>
                  <FormControl><Textarea placeholder="List the qualifications and requirements…" className="min-h-[90px]" {...field} data-testid="textarea-requirements" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-vacancy">Cancel</Button>
                <Button type="submit" disabled={createVacancyMutation.isPending} data-testid="button-submit-vacancy">
                  {createVacancyMutation.isPending ? 'Creating…' : 'Create Vacancy'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Application Detail Dialog ── */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application — {selectedApplication?.fullName}</DialogTitle>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Full Name', value: selectedApplication.fullName },
                  { label: 'Email', value: selectedApplication.googleEmail },
                  { label: 'Phone', value: selectedApplication.phoneNumber },
                  { label: 'Specialization', value: selectedApplication.subjectSpecialization },
                  { label: 'Experience', value: selectedApplication.yearsOfExperience ? `${selectedApplication.yearsOfExperience} years` : 'N/A' },
                  { label: 'Qualification', value: selectedApplication.highestQualification },
                ].map(f => (
                  <div key={f.label}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <p className="font-medium mt-0.5">{f.value || '—'}</p>
                  </div>
                ))}
              </div>
              {selectedApplication.coverLetter && (
                <div>
                  <Label className="text-xs text-muted-foreground">Cover Letter</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">{selectedApplication.coverLetter}</p>
                </div>
              )}
              {selectedApplication.resumeUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={selectedApplication.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" /> View Resume
                  </a>
                </Button>
              )}
              {selectedApplication.status === 'pending' && (
                <div className="flex gap-3 justify-end pt-3 border-t">
                  <Button variant="outline" onClick={() => setSelectedApplication(null)} data-testid="button-close-details">Close</Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => updateApplicationMutation.mutate({ id: selectedApplication.id, status: 'approved' })}
                    disabled={updateApplicationMutation.isPending}
                    data-testid="button-approve-detail"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateApplicationMutation.mutate({ id: selectedApplication.id, status: 'rejected' })}
                    disabled={updateApplicationMutation.isPending}
                    data-testid="button-reject-detail"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              )}
              {selectedApplication.status !== 'pending' && (
                <div className="flex justify-end pt-3 border-t">
                  <Button variant="outline" onClick={() => setSelectedApplication(null)}>Close</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
