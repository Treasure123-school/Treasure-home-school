import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, CheckCircle2, XCircle, Trash2, Plus, Users, Settings, BookOpen } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PageHeader, SearchInput, MiniStatCard, MiniStatGrid } from "@/components/shared";

interface Term {
  id: number;
  name: string;
  year: string;
  isCurrent: boolean;
}

interface StudentStatus {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  hasPaid: boolean;
  paymentId: number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
}

interface SystemSettings {
  requireExamPayment: boolean;
  examFeeAmount: number;
}

export default function ExamPaymentManagement() {
  const { toast } = useToast();
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    studentId: '',
    termId: 0,
    amountPaid: 0,
    paymentMethod: 'cash' as string,
    paymentReference: '',
    notes: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    requireExamPayment: false,
    examFeeAmount: 0,
  });

  // Fetch academic calendar (provides currentTerm + allTerms)
  const { currentTerm, allTerms } = useAcademicCalendar();
  const terms = allTerms as Term[];
  const effectiveTermId = selectedTermId ?? currentTerm?.id ?? null;

  // Fetch payment overview
  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['/api/exam-payments', effectiveTermId],
    queryFn: async () => {
      const url = effectiveTermId ? `/api/exam-payments?termId=${effectiveTermId}` : '/api/exam-payments';
      const res = await apiRequest('GET', url);
      return res.json();
    },
    enabled: !!effectiveTermId,
  });

  // Fetch students status
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['/api/exam-payments/students-status', effectiveTermId],
    queryFn: async () => {
      const url = effectiveTermId
        ? `/api/exam-payments/students-status?termId=${effectiveTermId}`
        : '/api/exam-payments/students-status';
      const res = await apiRequest('GET', url);
      return res.json();
    },
    enabled: !!effectiveTermId,
  });

  // Fetch exam payment settings
  const { data: sysSettings } = useQuery<SystemSettings>({
    queryKey: ['/api/exam-payments/settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/exam-payments/settings');
      return res.json();
    },
  });

  const students: StudentStatus[] = studentsData?.students ?? [];
  const feeAmount: number = paymentsData?.feeAmount ?? sysSettings?.examFeeAmount ?? 0;
  const requirePayment: boolean = paymentsData?.requirePayment ?? sysSettings?.requireExamPayment ?? false;

  // Filter students
  const filtered = students.filter(s => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.className.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterPaid === 'all' ||
      (filterPaid === 'paid' && s.hasPaid) ||
      (filterPaid === 'unpaid' && !s.hasPaid);
    return matchesSearch && matchesFilter;
  });

  const paidCount = students.filter(s => s.hasPaid).length;
  const unpaidCount = students.filter(s => !s.hasPaid).length;

  // Record single payment
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await apiRequest('POST', '/api/exam-payments', data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to record payment');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Exam fee payment recorded.' });
      setShowAddDialog(false);
      setAddForm({ studentId: '', termId: effectiveTermId ?? 0, amountPaid: feeAmount, paymentMethod: 'cash', paymentReference: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments/students-status'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Bulk payment
  const bulkPayMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/exam-payments/bulk', {
        studentIds: selectedStudents,
        termId: effectiveTermId,
        amountPaid: feeAmount,
        paymentMethod: 'cash',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Bulk payment failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Bulk payment done',
        description: `${data.success} recorded, ${data.skipped} already paid, ${data.failed} failed.`,
      });
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments/students-status'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Revoke payment
  const revokePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await apiRequest('DELETE', `/api/exam-payments/${paymentId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to revoke payment');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Exam payment revoked.' });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments/students-status'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { requireExamPayment: boolean; examFeeAmount: number }) => {
      const res = await apiRequest('PUT', '/api/exam-payments/settings', data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update settings');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Exam fee settings saved.' });
      setShowSettingsDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-payments/status'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openSettings = () => {
    setSettingsForm({
      requireExamPayment: sysSettings?.requireExamPayment ?? false,
      examFeeAmount: sysSettings?.examFeeAmount ?? 0,
    });
    setShowSettingsDialog(true);
  };

  const openAddDialog = (studentId?: string) => {
    setAddForm({
      studentId: studentId ?? '',
      termId: effectiveTermId ?? 0,
      amountPaid: feeAmount,
      paymentMethod: 'cash',
      paymentReference: '',
      notes: '',
    });
    setShowAddDialog(true);
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const unpaidFiltered = filtered.filter(s => !s.hasPaid).map(s => s.studentId);
    if (selectedStudents.length === unpaidFiltered.length && unpaidFiltered.length > 0) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(unpaidFiltered);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Exam Fee Payments"
        description="Manage and track student exam fee payments"
        icon={CreditCard}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={openSettings} className="gap-2">
              <Settings className="h-4 w-4" />
              Fee Settings
            </Button>
            <Button size="sm" onClick={() => openAddDialog()} className="gap-2 bg-primary hover:bg-primary/90 text-white">
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </>
        }
      />

      {/* Fee status banner */}
      {!requirePayment && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <Settings className="h-4 w-4 shrink-0" />
          Exam fee requirement is currently <strong>disabled</strong>. Students can access exams without payment. Enable it in Fee Settings.
        </div>
      )}

      {/* Term selector & stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="sm:col-span-1">
          <CardContent className="p-4">
            <Label className="text-xs text-slate-500 font-medium mb-2 block">Select Term</Label>
            <Select
              value={effectiveTermId?.toString() ?? ''}
              onValueChange={(v) => setSelectedTermId(Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose term..." />
              </SelectTrigger>
              <SelectContent>
                {terms.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name} {t.year} {t.isCurrent ? '(Current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-2">Fee: ₦{feeAmount.toLocaleString()} per student</p>
          </CardContent>
        </Card>
        <div className="sm:col-span-3">
          <MiniStatGrid cols={3}>
            <MiniStatCard
              label="Paid"
              value={paidCount}
              icon={CheckCircle2}
              color="text-green-600"
            />
            <MiniStatCard
              label="Unpaid"
              value={unpaidCount}
              icon={XCircle}
              color="text-red-600"
            />
            <MiniStatCard
              label="Current Fee"
              value={`₦${feeAmount.toLocaleString()}`}
              icon={BookOpen}
              color="text-blue-600"
            />
          </MiniStatGrid>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Search by name, admission number, or class..."
          value={search}
          onChange={setSearch}
          className="flex-1"
        />
        <Select value={filterPaid} onValueChange={(v: any) => setFilterPaid(v)}>
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="paid">Paid Only</SelectItem>
            <SelectItem value="unpaid">Unpaid Only</SelectItem>
          </SelectContent>
        </Select>
        {selectedStudents.length > 0 && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-2 h-9"
            onClick={() => bulkPayMutation.mutate()}
            disabled={bulkPayMutation.isPending}
          >
            <Users className="h-4 w-4" />
            Mark {selectedStudents.length} as Paid
          </Button>
        )}
      </div>

      {/* Student table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Students</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="text-xs h-7">
              {selectedStudents.length === filtered.filter(s => !s.hasPaid).length && selectedStudents.length > 0
                ? 'Deselect All'
                : 'Select Unpaid'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingStudents ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading students...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No students found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="p-3 text-left text-xs font-medium text-slate-500 w-10"></th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Student</th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Admission No.</th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Class</th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Paid At</th>
                    <th className="p-3 text-left text-xs font-medium text-slate-500">Method</th>
                    <th className="p-3 text-right text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.studentId}
                      className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-3">
                        {!student.hasPaid && (
                          <Checkbox
                            checked={selectedStudents.includes(student.studentId)}
                            onCheckedChange={() => toggleSelectStudent(student.studentId)}
                          />
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{student.studentName}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{student.admissionNumber}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{student.className}</td>
                      <td className="p-3">
                        {student.hasPaid ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-1">
                            <XCircle className="h-3 w-3" />
                            Unpaid
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 text-xs">
                        {student.paidAt ? new Date(student.paidAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="p-3 text-slate-500 text-xs capitalize">{student.paymentMethod ?? '—'}</td>
                      <td className="p-3 text-right">
                        {student.hasPaid ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => student.paymentId && revokePaymentMutation.mutate(student.paymentId)}
                            disabled={revokePaymentMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => openAddDialog(student.studentId)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Exam Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!addForm.studentId && (
              <div className="space-y-1">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={addForm.studentId}
                  onChange={(e) => setAddForm(f => ({ ...f, studentId: e.target.value }))}
                  placeholder="Enter student ID"
                />
              </div>
            )}
            {addForm.studentId && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
                <span className="text-slate-500">Recording for student: </span>
                <span className="font-medium">{students.find(s => s.studentId === addForm.studentId)?.studentName ?? addForm.studentId}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Term</Label>
              <Select
                value={addForm.termId.toString()}
                onValueChange={(v) => setAddForm(f => ({ ...f, termId: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name} {t.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount Paid (₦)</Label>
              <Input
                type="number"
                value={addForm.amountPaid}
                onChange={(e) => setAddForm(f => ({ ...f, amountPaid: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select
                value={addForm.paymentMethod}
                onValueChange={(v) => setAddForm(f => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference (optional)</Label>
              <Input
                value={addForm.paymentReference}
                onChange={(e) => setAddForm(f => ({ ...f, paymentReference: e.target.value }))}
                placeholder="Receipt/transaction reference"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                value={addForm.notes}
                onChange={(e) => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => recordPaymentMutation.mutate(addForm)}
              disabled={recordPaymentMutation.isPending || !addForm.studentId || !addForm.termId}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {recordPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exam Fee Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Require Exam Fee Payment</p>
                <p className="text-xs text-slate-500">Block students from starting exams until fee is paid</p>
              </div>
              <Switch
                checked={settingsForm.requireExamPayment}
                onCheckedChange={(v) => setSettingsForm(f => ({ ...f, requireExamPayment: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Fee Amount (₦)</Label>
              <Input
                type="number"
                value={settingsForm.examFeeAmount}
                onChange={(e) => setSettingsForm(f => ({ ...f, examFeeAmount: Number(e.target.value) }))}
                min={0}
                disabled={!settingsForm.requireExamPayment}
              />
              <p className="text-xs text-slate-400">Amount shown to students on their exam page</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
            <Button
              onClick={() => updateSettingsMutation.mutate(settingsForm)}
              disabled={updateSettingsMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
