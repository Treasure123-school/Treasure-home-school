import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BookOpen, Plus, Trash2, Edit, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

interface AboutSection {
  id: number;
  sectionKey: string;
  title: string;
  content: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

const SECTION_KEY_SUGGESTIONS = ['mission', 'vision', 'history', 'principal_message', 'facilities', 'values', 'achievements', 'programs'];

const EMPTY_FORM = { sectionKey: '', title: '', content: '', imageUrl: '', displayOrder: 0, isActive: true };

export default function AboutPageManagement() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<AboutSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const token = () => localStorage.getItem('token') || '';

  const { data: sections = [], isLoading } = useQuery<AboutSection[]>({
    queryKey: ['/api/admin/about-sections'],
  });

  function openCreate() {
    setEditingSection(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setShowForm(true);
  }

  function openEdit(section: AboutSection) {
    setEditingSection(section);
    setForm({
      sectionKey: section.sectionKey, title: section.title, content: section.content,
      imageUrl: section.imageUrl || '', displayOrder: section.displayOrder, isActive: section.isActive,
    });
    setImageFile(null);
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, String(v)));
      if (imageFile) formData.append('image', imageFile);
      const url = editingSection ? `/api/admin/about-sections/${editingSection.id}` : '/api/admin/about-sections';
      const method = editingSection ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token()}` },
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/about-sections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/about-sections'] });
      setShowForm(false);
      toast({ title: editingSection ? 'Section updated' : 'Section created' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest('PUT', `/api/admin/about-sections/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/about-sections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/about-sections'] });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/about-sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/about-sections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/about-sections'] });
      setDeleteTarget(null);
      toast({ title: 'Section deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 truncate">
            <BookOpen className="h-6 w-6 text-primary shrink-0" /> <span className="truncate">About Page Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">Manage the content sections on the public About page</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-about-section" className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add Section
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sections yet. Add your first about section.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Section</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map(section => (
            <Card key={section.id} className={`${!section.isActive ? 'opacity-60' : ''}`} data-testid={`card-about-${section.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {section.imageUrl ? (
                    <img src={section.imageUrl} alt={section.title} className="h-16 w-20 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="h-16 w-20 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm" data-testid={`text-about-title-${section.id}`}>{section.title}</h3>
                      <Badge variant="outline" className="text-xs">{section.sectionKey}</Badge>
                      {!section.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{section.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">Order: {section.displayOrder}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={section.isActive}
                      onCheckedChange={v => toggleMutation.mutate({ id: section.id, isActive: v })}
                      data-testid={`switch-about-active-${section.id}`}
                    />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {section.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {section.isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(section)} data-testid={`button-edit-about-${section.id}`}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(section.id)} data-testid={`button-delete-about-${section.id}`}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Add About Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Key * <span className="text-xs text-muted-foreground">(unique identifier, no spaces)</span></Label>
              <Input
                value={form.sectionKey}
                onChange={e => setForm(p => ({ ...p, sectionKey: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="e.g. mission, vision, history"
                disabled={!!editingSection}
                data-testid="input-about-key"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {SECTION_KEY_SUGGESTIONS.filter(k => !sections.some(s => s.sectionKey === k) || editingSection?.sectionKey === k).map(k => (
                  <button key={k} type="button" className="text-xs px-2 py-0.5 rounded border hover:bg-muted"
                    onClick={() => setForm(p => ({ ...p, sectionKey: k }))}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Section heading" data-testid="input-about-title" />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Section content text" rows={6} data-testid="input-about-content" />
            </div>
            <div>
              <Label>Image</Label>
              <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              {(imageFile || form.imageUrl) && (
                <img src={imageFile ? URL.createObjectURL(imageFile) : form.imageUrl} alt="Preview" className="mt-2 h-28 w-full object-cover rounded" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={form.displayOrder} onChange={e => setForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                <Label>{form.isActive ? 'Visible' : 'Hidden'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.sectionKey || !form.title || !form.content || saveMutation.isPending}
              data-testid="button-save-about-section"
            >
              {saveMutation.isPending ? 'Saving…' : (editingSection ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this about section from the website.</AlertDialogDescription>
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
