import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { HelpCircle, Plus, Trash2, Edit, GripVertical } from 'lucide-react';

interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

const FAQ_CATEGORIES = ['general', 'admissions', 'academics', 'fees', 'exams', 'portal'];
const EMPTY_FORM = { question: '', answer: '', category: 'general', displayOrder: 0, isActive: true };

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    admissions: 'bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/70',
    academics: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    fees: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    exams: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    portal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return map[cat] || map.general;
}

export default function FaqManagement() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState('all');

  const { data: faqs = [], isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/admin/faq'],
  });

  const filtered = filterCategory === 'all' ? faqs : faqs.filter(f => f.category === filterCategory);

  function openCreate() {
    setEditingFaq(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(faq: Faq) {
    setEditingFaq(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category, displayOrder: faq.displayOrder, isActive: faq.isActive });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => editingFaq
      ? apiRequest('PUT', `/api/admin/faq/${editingFaq.id}`, form)
      : apiRequest('POST', '/api/admin/faq', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/faq'] });
      setShowForm(false);
      toast({ title: editingFaq ? 'FAQ updated' : 'FAQ created' });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest('PUT', `/api/admin/faq/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/faq'] });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/faq/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/faq'] });
      setDeleteTarget(null);
      toast({ title: 'FAQ deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const categoryCounts = FAQ_CATEGORIES.reduce((acc, c) => {
    acc[c] = faqs.filter(f => f.category === c).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 truncate">
            <HelpCircle className="h-6 w-6 text-primary shrink-0" /> <span className="truncate">FAQ Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">Manage frequently asked questions shown on the website</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-faq" className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add FAQ
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filterCategory === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterCategory('all')}>
          All ({faqs.length})
        </Button>
        {FAQ_CATEGORIES.map(c => categoryCounts[c] > 0 && (
          <Button key={c} variant={filterCategory === c ? 'default' : 'outline'} size="sm" onClick={() => setFilterCategory(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)} ({categoryCounts[c]})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No FAQs yet. Add your first FAQ.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add FAQ</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(faq => (
            <Card key={faq.id} className={`${!faq.isActive ? 'opacity-60' : ''}`} data-testid={`card-faq-${faq.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" data-testid={`text-faq-question-${faq.id}`}>{faq.question}</p>
                      <Badge className={`text-xs ${categoryColor(faq.category)}`}>{faq.category}</Badge>
                      {!faq.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                    <p className="text-xs text-muted-foreground mt-1">Order: {faq.displayOrder}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={faq.isActive}
                      onCheckedChange={v => toggleMutation.mutate({ id: faq.id, isActive: v })}
                      data-testid={`switch-faq-active-${faq.id}`}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(faq)} data-testid={`button-edit-faq-${faq.id}`}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(faq.id)} data-testid={`button-delete-faq-${faq.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question *</Label>
              <Input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} placeholder="What is the question?" data-testid="input-faq-question" />
            </div>
            <div>
              <Label>Answer *</Label>
              <Textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} placeholder="Provide a clear answer" rows={4} data-testid="input-faq-answer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={form.displayOrder} onChange={e => setForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
              <Label>{form.isActive ? 'Visible on website' : 'Hidden'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.question || !form.answer || saveMutation.isPending}
              data-testid="button-save-faq"
            >
              {saveMutation.isPending ? 'Saving…' : (editingFaq ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this FAQ.</AlertDialogDescription>
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
