import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Building2, FileText, FileBarChart2, Loader2, Info, AlertTriangle, CheckCircle, Upload, X, Crown, UserCheck, FileBarChart, Award, Stamp,
} from 'lucide-react';
import { SettingCard, SectionSkeleton } from './components';
// SchoolLeadershipSection
// ─────────────────────────────────────────────
interface LeadershipAdmin {
  id: string;
  name: string;
  username: string;
  signatureUrl: string | null;
  hasSignature: boolean;
}
interface LeadershipData {
  designatedPrincipalId: string | null;
  admins: LeadershipAdmin[];
  currentPrincipal: LeadershipAdmin | null;
}

export default function SchoolLeadershipSection() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery<LeadershipData>({
    queryKey: ['/api/leadership/principal'],
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) setSelectedId(data.designatedPrincipalId || '');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (id: string | null) =>
      apiRequest('PUT', '/api/leadership/principal', { designatedPrincipalId: id }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leadership/principal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/superadmin/principal'] });
      setClearConfirmOpen(false);
      toast({ title: 'Success', description: 'School leadership updated.' });
    },
    onError: (e: any) => toast({ title: 'Failed to update', description: e.message, variant: 'destructive' }),
  });

  const currentPrincipal = data?.currentPrincipal;
  const isDirty = selectedId !== (data?.designatedPrincipalId || '');

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-5">

      {/* Current Principal Status */}
      <SettingCard
        title="Active Principal"
        description="The designated principal whose name and signature appear on all school documents."
        icon={Crown}
      >
        {currentPrincipal ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-green-700 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-base">{currentPrincipal.name}</p>
                  <Badge className="bg-green-600 text-white text-xs">Active Principal</Badge>
                </div>
                <p className="text-sm text-muted-foreground">@{currentPrincipal.username}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {currentPrincipal.hasSignature ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" /> Signature on file
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> No signature uploaded yet
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                onClick={() => setClearConfirmOpen(true)}
                data-testid="button-clear-principal"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            </div>

            {!currentPrincipal.hasSignature && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{currentPrincipal.name}</strong> has no signature on file. Their name will still appear on documents, but the signature area will be blank. Upload a signature in their admin profile.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-sm font-medium">No principal designated</p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              The system will automatically use the first admin with a saved signature. Assign a principal below for consistent branding on all documents.
            </p>
          </div>
        )}
      </SettingCard>

      {/* Assignment */}
      <SettingCard
        title="Assign Principal"
        description="Select which admin staff member serves as the school principal. Only one principal can be active at a time."
        icon={UserCheck}
      >
        {(data?.admins?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No admin accounts found. Create an admin user first before assigning a principal.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Staff Member</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full max-w-sm" data-testid="select-principal">
                  <SelectValue placeholder="— Choose an admin —" />
                </SelectTrigger>
                <SelectContent>
                  {data?.admins.map(admin => (
                    <SelectItem key={admin.id} value={admin.id} data-testid={`option-principal-${admin.id}`}>
                      <span className="flex items-center gap-2">
                        <span>{admin.name || admin.username}</span>
                        <span className="text-muted-foreground text-xs">(@{admin.username})</span>
                        {admin.hasSignature && <span className="text-green-600 text-xs">✓ sig</span>}
                        {admin.id === data?.designatedPrincipalId && (
                          <Badge className="text-xs py-0 bg-primary/10 text-primary border-0 ml-1">current</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">✓ sig = has signature uploaded</p>
            </div>

            <Button
              onClick={() => saveMutation.mutate(selectedId || null)}
              disabled={saveMutation.isPending || !isDirty || !selectedId}
              data-testid="button-assign-principal"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              {saveMutation.isPending ? 'Saving…' : 'Assign as Principal'}
            </Button>
          </div>
        )}
      </SettingCard>

      {/* Signature Status */}
      <SettingCard
        title="Principal Signature"
        description="The signature is uploaded to an admin's profile and automatically appears on all school documents."
        icon={Stamp}
      >
        <div className="space-y-4">
          {currentPrincipal?.hasSignature && currentPrincipal.signatureUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Current signature preview:</p>
              <div className="border rounded-lg p-4 bg-white dark:bg-gray-950 inline-block">
                <img
                  src={currentPrincipal.signatureUrl}
                  alt="Principal signature"
                  className="h-16 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                To update this signature, go to the admin user's profile and upload a new signature image.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-1">
              {currentPrincipal
                ? `No signature on file for ${currentPrincipal.name}. Navigate to their admin profile to upload one.`
                : 'Assign a principal above, then upload their signature in their admin profile.'}
            </p>
          )}
        </div>
      </SettingCard>

      {/* Where the principal appears */}
      <SettingCard
        title="Where Principal Information Appears"
        description="All the following documents automatically pull principal data from this single source of truth."
        icon={Info}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { icon: FileBarChart2, label: 'Report Cards', desc: 'Name & signature on every student report card' },
            { icon: FileBarChart, label: 'Result Sheets', desc: 'Class result summaries and transcripts' },
            { icon: Award, label: 'Certificates', desc: 'School-issued award certificates' },
            { icon: FileText, label: 'Official Documents', desc: 'Letters and school correspondence' },
            { icon: CheckCircle, label: 'Approval Workflows', desc: 'Published reports and signed records' },
            { icon: Building2, label: 'School Profile', desc: 'Publicly visible leadership information' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-md border bg-muted/30">
              <item.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      {/* Clear confirmation dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear Principal Assignment?</DialogTitle>
            <DialogDescription>
              This will remove the current principal designation. The system will fall back to the first admin with a saved signature until a new principal is assigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => saveMutation.mutate(null)}
              disabled={saveMutation.isPending}
              data-testid="button-confirm-clear-principal"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Clear Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
