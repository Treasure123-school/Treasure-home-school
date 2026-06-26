import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Link, Search, Package } from 'lucide-react';
import { PageHeader, MiniStatCard, MiniStatGrid } from '@/components/shared';

interface BillingItem {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  category: string;
  isActive: boolean;
  isRecurring: boolean;
  paymentType: string;
  classLevels: string | null;
  termId: number | null;
  session: string | null;
  dueDate: string | null;
  lateFee: number | null;
  discount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Term {
  id: number;
  name: string;
  year: string;
  isCurrent: boolean;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'exam', label: 'Examination' },
  { value: 'registration', label: 'Registration' },
  { value: 'resources', label: 'Resources / Notes' },
  { value: 'cbt', label: 'CBT Access' },
  { value: 'result_checker', label: 'Result Checker' },
  { value: 'library', label: 'Library Access' },
  { value: 'excursion', label: 'Excursion' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'pta', label: 'PTA Levy' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  exam: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  registration: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  resources: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  cbt: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  result_checker: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  library: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  excursion: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  uniform: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  pta: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const FEATURE_KEYS = [
  { value: 'exam_access', label: 'Exam Access' },
  { value: 'cbt_access', label: 'CBT Access' },
  { value: 'result_checker', label: 'Result Checking' },
  { value: 'resource_download', label: 'Resource Downloads' },
  { value: 'library_access', label: 'Library Access' },
];

const fmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);

const emptyForm = {
  name: '',
  description: '',
  amount: '',
  category: 'general',
  isActive: true,
  paymentType: 'one_time',
  classLevels: '',
  termId: '',
  session: '',
  dueDate: '',
  lateFee: '',
  discount: '',
};

export default function BillingItems() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BillingItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<BillingItem | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState<BillingItem | null>(null);
  const [linkFeatureKey, setLinkFeatureKey] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  const { data: items = [], isLoading } = useQuery<BillingItem[]>({
    queryKey: ['/api/billing/items'],
  });

  const { data: terms = [] } = useQuery<Term[]>({
    queryKey: ['/api/terms'],
  });

  const { data: featureLinks = [] } = useQuery<any[]>({
    queryKey: ['/api/billing/feature-links'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/billing/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/items'] });
      toast({ title: 'Billing item created' });
      handleClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/billing/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/items'] });
      toast({ title: 'Billing item updated' });
      handleClose();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/billing/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/items'] });
      toast({ title: 'Billing item deleted' });
      setDeleteItem(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const linkMutation = useMutation({
    mutationFn: ({ billingItemId, featureKey }: any) => apiRequest('POST', '/api/billing/feature-links', { billingItemId, featureKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/feature-links'] });
      toast({ title: 'Feature linked successfully' });
      setShowLinkDialog(null);
      setLinkFeatureKey('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (featureKey: string) => apiRequest('DELETE', `/api/billing/feature-links/${featureKey}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/feature-links'] });
      toast({ title: 'Feature unlinked' });
    },
  });

  const handleClose = () => {
    setShowForm(false);
    setEditItem(null);
    setForm({ ...emptyForm });
  };

  const openEdit = (item: BillingItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      amount: String(item.amount / 100),
      category: item.category,
      isActive: item.isActive,
      paymentType: item.paymentType || 'one_time',
      classLevels: item.classLevels || '',
      termId: item.termId ? String(item.termId) : '',
      session: item.session || '',
      dueDate: item.dueDate ? item.dueDate.substring(0, 10) : '',
      lateFee: item.lateFee ? String(item.lateFee / 100) : '',
      discount: item.discount ? String(item.discount / 100) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      amount: Math.round(parseFloat(form.amount || '0') * 100),
      category: form.category,
      isActive: form.isActive,
      paymentType: form.paymentType,
      classLevels: form.classLevels || null,
      termId: form.termId ? Number(form.termId) : null,
      session: form.session || null,
      dueDate: form.dueDate || null,
      lateFee: form.lateFee ? Math.round(parseFloat(form.lateFee) * 100) : 0,
      discount: form.discount ? Math.round(parseFloat(form.discount) * 100) : 0,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getItemLink = (itemId: number) =>
    featureLinks.find((l: any) => l.billingItemId === itemId);

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || item.category === filterCategory;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? item.isActive : !item.isActive);
    return matchSearch && matchCat && matchStatus;
  });

  const activeCount = items.filter((i) => i.isActive).length;
  const totalValue = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Billing Items"
        description="Create and manage all payable items in the school"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Billing Item
          </Button>
        }
      />

      <MiniStatGrid>
        <MiniStatCard label="Total Items" value={items.length} icon={Package} />
        <MiniStatCard label="Active Items" value={activeCount} icon={Package} />
        <MiniStatCard label="Inactive" value={items.length - activeCount} icon={Package} />
        <MiniStatCard label="Highest Fee" value={items.length ? fmt(Math.max(...items.map(i => i.amount))) : '₦0'} icon={Package} />
      </MiniStatGrid>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search billing items..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading billing items…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No billing items found.</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowForm(true)}>Create your first billing item</Button>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((item) => {
                const link = getItemLink(item.id);
                return (
                  <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.name}</span>
                        <Badge className={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}>
                          {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                        </Badge>
                        {!item.isActive && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                        {link && (
                          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                            <Link className="h-3 w-3 mr-1" />
                            {FEATURE_KEYS.find(f => f.value === link.featureKey)?.label || link.featureKey}
                          </Badge>
                        )}
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-semibold text-foreground">{fmt(item.amount)}</span>
                        {item.paymentType === 'recurring' && <span>Recurring</span>}
                        {item.dueDate && <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>}
                        {item.session && <span>Session: {item.session}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setShowLinkDialog(item)} title="Link to feature">
                        <Link className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteItem(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Billing Item' : 'New Billing Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Third Term Exam Fee" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional details…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₦) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Type</Label>
                <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring (Per Term)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Term (Optional)</Label>
                <Select value={form.termId} onValueChange={(v) => setForm({ ...form, termId: v })}>
                  <SelectTrigger><SelectValue placeholder="Any term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any Term</SelectItem>
                    {terms.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Academic Session</Label>
                <Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="e.g. 2024/2025" />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Late Fee (₦)</Label>
                <Input type="number" min="0" step="0.01" value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Discount (₦)</Label>
                <Input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Class Levels (comma-separated, leave blank for all)</Label>
              <Input value={form.classLevels} onChange={(e) => setForm({ ...form, classLevels: e.target.value })} placeholder="e.g. JSS 1, JSS 2, SS 1" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.amount || createMutation.isPending || updateMutation.isPending}>
              {editItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Link Dialog */}
      <Dialog open={!!showLinkDialog} onOpenChange={(open) => { if (!open) { setShowLinkDialog(null); setLinkFeatureKey(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link to Feature Gate</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Link <strong>{showLinkDialog?.name}</strong> to a feature so students must pay before accessing it.
          </p>
          <div className="space-y-3">
            <Label>Feature</Label>
            <Select value={linkFeatureKey} onValueChange={setLinkFeatureKey}>
              <SelectTrigger><SelectValue placeholder="Select feature…" /></SelectTrigger>
              <SelectContent>
                {FEATURE_KEYS.map((f) => {
                  const existingLink = featureLinks.find((l: any) => l.featureKey === f.value);
                  return (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label} {existingLink ? `(currently: ${items.find(i => i.id === existingLink.billingItemId)?.name || '?'})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              disabled={!linkFeatureKey || linkMutation.isPending}
              onClick={() => showLinkDialog && linkMutation.mutate({ billingItemId: showLinkDialog.id, featureKey: linkFeatureKey })}
              className="w-full"
            >
              Link Feature
            </Button>
            {showLinkDialog && getItemLink(showLinkDialog.id) && (
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={() => {
                  const link = getItemLink(showLinkDialog.id);
                  if (link) unlinkMutation.mutate(link.featureKey);
                  setShowLinkDialog(null);
                }}
              >
                Remove Current Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Billing Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
