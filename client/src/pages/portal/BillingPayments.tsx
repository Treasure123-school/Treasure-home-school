import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Search, Download, CreditCard, CheckCircle2 } from 'lucide-react';
import { PageHeader, MiniStatCard, MiniStatGrid } from '@/components/shared';

interface BillingPayment {
  id: number;
  billingItemId: number;
  billingItemName: string;
  billingItemCategory: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  termId: number | null;
  amountPaid: number;
  paymentMethod: string;
  paymentReference: string | null;
  status: string;
  provider: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface BillingItem { id: number; name: string; category: string; amount: number; }
interface Term { id: number; name: string; year: string; isCurrent: boolean; }
interface Student { id: string; admissionNumber: string; userId: string; classId: number | null; }

const fmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'paystack', 'monnify', 'online', 'other'];

const emptyForm = {
  billingItemId: '',
  studentId: '',
  termId: 'none',
  amountPaid: '',
  paymentMethod: 'cash',
  paymentReference: '',
  notes: '',
  paidAt: '',
};

export default function BillingPayments() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterItem, setFilterItem] = useState('all');
  const [filterTerm, setFilterTerm] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [deletePayment, setDeletePayment] = useState<BillingPayment | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const filters: Record<string, string> = {};
  if (filterItem !== 'all') filters.billingItemId = filterItem;
  if (filterTerm !== 'all') filters.termId = filterTerm;

  const { data: payments = [], isLoading } = useQuery<BillingPayment[]>({
    queryKey: ['/api/billing/payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/billing/payments?${params}`, { credentials: 'include' });
      return res.json();
    },
  });

  const { data: items = [] } = useQuery<BillingItem[]>({ queryKey: ['/api/billing/items'] });
  const { data: terms = [] } = useQuery<Term[]>({ queryKey: ['/api/terms'] });
  const { data: students = [] } = useQuery<Student[]>({ queryKey: ['/api/students'] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/billing/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/summary'] });
      toast({ title: 'Payment recorded' });
      setShowForm(false);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/billing/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/summary'] });
      toast({ title: 'Payment deleted' });
      setDeletePayment(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleSubmit = () => {
    if (!form.billingItemId || !form.studentId || !form.amountPaid) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    const selectedItem = items.find(i => i.id === Number(form.billingItemId));
    createMutation.mutate({
      billingItemId: Number(form.billingItemId),
      studentId: form.studentId,
      termId: (form.termId && form.termId !== 'none') ? Number(form.termId) : null,
      amountPaid: Math.round(parseFloat(form.amountPaid) * 100),
      paymentMethod: form.paymentMethod,
      paymentReference: form.paymentReference || null,
      notes: form.notes || null,
      paidAt: form.paidAt || null,
    });
  };

  const handleExport = () => {
    const rows = filtered.map(p => [
      p.admissionNumber, p.studentName, p.className,
      p.billingItemName, fmt(p.amountPaid), p.paymentMethod,
      p.paymentReference || '', p.status,
      p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '',
    ]);
    const csv = [
      ['Admission No', 'Student Name', 'Class', 'Billing Item', 'Amount', 'Method', 'Reference', 'Status', 'Date'],
      ...rows,
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = 'billing-payments.csv';
    a.click();
  };

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.studentName.toLowerCase().includes(q) || p.admissionNumber.toLowerCase().includes(q) || p.billingItemName.toLowerCase().includes(q) || (p.paymentReference || '').toLowerCase().includes(q);
    const matchMethod = filterMethod === 'all' || p.paymentMethod === filterMethod;
    return matchSearch && matchMethod;
  });

  const totalCollected = filtered.reduce((s, p) => s + p.amountPaid, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Payments"
        description="Complete payment history for all billing items"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        }
      />

      <MiniStatGrid>
        <MiniStatCard label="Total Payments" value={filtered.length} icon={CreditCard} />
        <MiniStatCard label="Total Collected" value={fmt(totalCollected)} icon={CheckCircle2} />
        <MiniStatCard label="Cash Payments" value={filtered.filter(p => p.paymentMethod === 'cash').length} icon={CreditCard} />
        <MiniStatCard label="Online Payments" value={filtered.filter(p => ['paystack', 'monnify', 'online'].includes(p.paymentMethod)).length} icon={CreditCard} />
      </MiniStatGrid>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by student, item, reference…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterItem} onValueChange={setFilterItem}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Items" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Billing Items</SelectItem>
                {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Terms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading payments…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No payments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Student</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Class</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Billing Item</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Amount</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Method</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Reference</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{p.studentName}</div>
                        <div className="text-xs text-muted-foreground">{p.admissionNumber}</div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.className}</td>
                      <td className="py-3 pr-4">{p.billingItemName}</td>
                      <td className="py-3 pr-4 font-semibold">{fmt(p.amountPaid)}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="capitalize">{p.paymentMethod.replace('_', ' ')}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{p.paymentReference || '—'}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletePayment(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setForm({ ...emptyForm }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Billing Item *</Label>
              <Select value={form.billingItemId} onValueChange={(v) => {
                const item = items.find(i => i.id === Number(v));
                setForm({ ...form, billingItemId: v, amountPaid: item ? String(item.amount / 100) : form.amountPaid });
              }}>
                <SelectTrigger><SelectValue placeholder="Select billing item…" /></SelectTrigger>
                <SelectContent>
                  {items.filter(i => i).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student *</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student…" /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName ? `${s.firstName} ${s.lastName}` : s.admissionNumber} — {s.admissionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₦) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Term</Label>
                <Select value={form.termId} onValueChange={(v) => setForm({ ...form, termId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select term…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific term</SelectItem>
                    {terms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Paid</Label>
                <Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Reference Number</Label>
              <Input value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} placeholder="Receipt / reference no." />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletePayment} onOpenChange={(open) => { if (!open) setDeletePayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the payment of <strong>{deletePayment && fmt(deletePayment.amountPaid)}</strong> for <strong>{deletePayment?.studentName}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePayment && deleteMutation.mutate(deletePayment.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
