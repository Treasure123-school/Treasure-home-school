import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Download, AlertCircle, Bell, Users } from 'lucide-react';
import { PageHeader, MiniStatCard, MiniStatGrid } from '@/components/shared';

interface OutstandingStudent {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  className: string;
}

interface BillingItem { id: number; name: string; amount: number; category: string; dueDate: string | null; }
interface Term { id: number; name: string; year: string; isCurrent: boolean; }

const fmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

export default function BillingOutstanding() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterItem, setFilterItem] = useState('all');
  const [filterTerm, setFilterTerm] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: items = [] } = useQuery<BillingItem[]>({ queryKey: ['/api/billing/items'] });
  const { data: terms = [] } = useQuery<Term[]>({ queryKey: ['/api/terms'] });

  const params = new URLSearchParams();
  if (filterItem !== 'all') params.set('billingItemId', filterItem);
  if (filterTerm !== 'all') params.set('termId', filterTerm);

  const { data: outstanding = [], isLoading } = useQuery<OutstandingStudent[]>({
    queryKey: ['/api/billing/outstanding', filterItem, filterTerm],
    queryFn: async () => {
      const res = await fetch(`/api/billing/outstanding?${params}`, { credentials: 'include' });
      return res.json();
    },
    enabled: filterItem !== 'all',
  });

  const recordBulkMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/billing/payments/bulk', data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payments'] });
      toast({ title: 'Bulk payment recorded' });
      setSelected([]);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const filtered = outstanding.filter(s => {
    const q = search.toLowerCase();
    return !search || s.studentName.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q) || s.className.toLowerCase().includes(q);
  });

  const selectedItem = items.find(i => i.id === Number(filterItem));
  const overdue = filtered.filter(s => selectedItem?.dueDate && daysOverdue(selectedItem.dueDate) !== null);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelected(selected.length === filtered.length ? [] : filtered.map(s => s.studentId));

  const handleBulkRecord = () => {
    if (!filterItem || filterItem === 'all' || selected.length === 0) return;
    recordBulkMutation.mutate({
      billingItemId: Number(filterItem),
      studentIds: selected,
      termId: filterTerm !== 'all' ? Number(filterTerm) : null,
      amountPaid: selectedItem?.amount || 0,
      paymentMethod: 'cash',
    });
  };

  const handleExport = () => {
    const rows = filtered.map(s => [
      s.admissionNumber, s.studentName, s.className,
      selectedItem?.name || '', selectedItem ? fmt(selectedItem.amount) : '',
      selectedItem?.dueDate ? new Date(selectedItem.dueDate).toLocaleDateString() : '',
      selectedItem?.dueDate ? (daysOverdue(selectedItem.dueDate) ?? 0) + ' days' : '',
    ]);
    const csv = [
      ['Admission No', 'Student Name', 'Class', 'Item', 'Amount Due', 'Due Date', 'Days Overdue'],
      ...rows,
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = 'outstanding-payments.csv';
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Outstanding Payments"
        description="Students with unpaid billing obligations"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {selected.length > 0 && (
              <Button onClick={handleBulkRecord} disabled={recordBulkMutation.isPending}>
                Mark {selected.length} as Paid
              </Button>
            )}
          </div>
        }
      />

      <MiniStatGrid>
        <MiniStatCard label="Students with Dues" value={outstanding.length} icon={Users} />
        <MiniStatCard label="Filtered View" value={filtered.length} icon={AlertCircle} />
        <MiniStatCard label="Overdue" value={overdue.length} icon={AlertCircle} />
        <MiniStatCard label="Total Outstanding" value={selectedItem ? fmt(filtered.length * selectedItem.amount) : '—'} icon={Bell} />
      </MiniStatGrid>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filterItem} onValueChange={(v) => { setFilterItem(v); setSelected([]); }}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Select billing item…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">— Select a billing item —</SelectItem>
                {items.filter((i: any) => i.isActive).map((i: any) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Terms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {terms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search students…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filterItem === 'all' ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Select a billing item above to view outstanding payments.</p>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground">All students have paid for this item.</p>
            </div>
          ) : (
            <>
              {selectedItem && (
                <div className="mb-4 p-3 rounded-lg bg-muted flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-medium">{selectedItem.name}</span>
                    <span className="text-muted-foreground ml-2">— {fmt(selectedItem.amount)} per student</span>
                  </div>
                  {selectedItem.dueDate && (
                    <Badge variant={daysOverdue(selectedItem.dueDate) ? 'destructive' : 'outline'}>
                      Due: {new Date(selectedItem.dueDate).toLocaleDateString()}
                      {daysOverdue(selectedItem.dueDate) !== null && ` (${daysOverdue(selectedItem.dueDate)}d overdue)`}
                    </Badge>
                  )}
                </div>
              )}
              <div className="mb-3 flex items-center gap-3">
                <Checkbox
                  checked={selected.length === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selected.length > 0 ? `${selected.length} selected` : `Select all ${filtered.length} students`}
                </span>
              </div>
              <div className="divide-y">
                {filtered.map((s) => {
                  const overdueDays = selectedItem?.dueDate ? daysOverdue(selectedItem.dueDate) : null;
                  return (
                    <div key={s.studentId} className="py-3 flex items-center gap-3">
                      <Checkbox
                        checked={selected.includes(s.studentId)}
                        onCheckedChange={() => toggleSelect(s.studentId)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{s.studentName}</div>
                        <div className="text-xs text-muted-foreground">{s.admissionNumber} · {s.className}</div>
                      </div>
                      {selectedItem && (
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-sm">{fmt(selectedItem.amount)}</div>
                          {overdueDays !== null && (
                            <Badge variant="destructive" className="text-xs mt-0.5">{overdueDays}d overdue</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
