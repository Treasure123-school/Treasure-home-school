import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GraduationCap, User, Mail, Phone, Calendar, Trash2, Eye, Clock, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';

interface AdmissionsEnquiry {
  id: number;
  studentName: string;
  dateOfBirth?: string;
  gender?: string;
  classApplying?: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  address?: string;
  previousSchool?: string;
  medicalInfo?: string;
  additionalInfo?: string;
  status: 'new' | 'reviewing' | 'accepted' | 'rejected' | 'waitlisted';
  notes?: string;
  reviewedAt?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  new: { label: 'New', className: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70', icon: AlertCircle },
  reviewing: { label: 'Reviewing', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Loader },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  waitlisted: { label: 'Waitlisted', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Clock },
};

export default function AdmissionsManagement() {
  const { toast } = useToast();
  const [selectedEnquiry, setSelectedEnquiry] = useState<AdmissionsEnquiry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  const { data: enquiries = [], isLoading } = useQuery<AdmissionsEnquiry[]>({
    queryKey: ['/api/admin/admissions-enquiries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/admissions-enquiries', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const filtered = filterStatus === 'all' ? enquiries : enquiries.filter(e => e.status === filterStatus);

  function openDetail(e: AdmissionsEnquiry) {
    setSelectedEnquiry(e);
    setUpdateStatus(e.status);
    setUpdateNotes(e.notes || '');
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes: string }) =>
      apiRequest('PATCH', `/api/admin/admissions-enquiries/${id}/status`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admissions-enquiries'] });
      setSelectedEnquiry(null);
      toast({ title: 'Enquiry status updated' });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/admissions-enquiries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/admissions-enquiries'] });
      if (selectedEnquiry?.id === deleteTarget) setSelectedEnquiry(null);
      setDeleteTarget(null);
      toast({ title: 'Enquiry deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = enquiries.filter(e => e.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
    const Icon = cfg.icon;
    return (
      <Badge className={`text-xs ${cfg.className}`}>
        <Icon className="h-2.5 w-2.5 mr-0.5" /> {cfg.label}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Admissions Enquiries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage admission applications from the website</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {enquiries.filter(e => e.status === 'new').length} new enquiries
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filterStatus === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('all')}>
          All ({enquiries.length})
        </Button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => statusCounts[key] > 0 && (
          <Button key={key} variant={filterStatus === key ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(key)}>
            {cfg.label} ({statusCounts[key]})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filterStatus === 'all' ? 'No admissions enquiries yet' : `No ${filterStatus} enquiries`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(enquiry => (
            <Card key={enquiry.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetail(enquiry)} data-testid={`card-enquiry-${enquiry.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-enquiry-name-${enquiry.id}`}>{enquiry.studentName}</span>
                      <StatusBadge status={enquiry.status} />
                      {enquiry.classApplying && <Badge variant="outline" className="text-xs">{enquiry.classApplying}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> Parent: {enquiry.parentName}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {enquiry.parentEmail}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {enquiry.parentPhone}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Applied {format(new Date(enquiry.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive flex-shrink-0"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(enquiry.id); }}
                    data-testid={`button-delete-enquiry-${enquiry.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedEnquiry && (
        <Dialog open onOpenChange={() => setSelectedEnquiry(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" /> {selectedEnquiry.studentName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-muted/50 rounded-lg p-3 text-sm">
                {selectedEnquiry.dateOfBirth && <div><span className="font-medium">DOB:</span> {selectedEnquiry.dateOfBirth}</div>}
                {selectedEnquiry.gender && <div><span className="font-medium">Gender:</span> {selectedEnquiry.gender}</div>}
                {selectedEnquiry.classApplying && <div><span className="font-medium">Class:</span> {selectedEnquiry.classApplying}</div>}
                {selectedEnquiry.previousSchool && <div><span className="font-medium">Prev. School:</span> {selectedEnquiry.previousSchool}</div>}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-xs uppercase text-muted-foreground mb-1">Parent/Guardian</p>
                <p>{selectedEnquiry.parentName}</p>
                <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedEnquiry.parentEmail}</p>
                <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedEnquiry.parentPhone}</p>
                {selectedEnquiry.address && <p>{selectedEnquiry.address}</p>}
              </div>
              {selectedEnquiry.medicalInfo && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Medical Information</p>
                  <p className="text-sm bg-muted/30 rounded p-2">{selectedEnquiry.medicalInfo}</p>
                </div>
              )}
              {selectedEnquiry.additionalInfo && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Additional Information</p>
                  <p className="text-sm bg-muted/30 rounded p-2">{selectedEnquiry.additionalInfo}</p>
                </div>
              )}
              <hr />
              <div className="space-y-3">
                <div>
                  <Label>Update Status</Label>
                  <Select value={updateStatus} onValueChange={setUpdateStatus}>
                    <SelectTrigger data-testid="select-enquiry-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Internal Notes</Label>
                  <Textarea value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} placeholder="Add notes about this application..." rows={3} data-testid="input-enquiry-notes" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedEnquiry(null)}>Cancel</Button>
              <Button
                onClick={() => updateMutation.mutate({ id: selectedEnquiry.id, status: updateStatus, notes: updateNotes })}
                disabled={updateMutation.isPending}
                data-testid="button-update-enquiry"
              >
                {updateMutation.isPending ? 'Saving…' : 'Update Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Enquiry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this admissions enquiry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
