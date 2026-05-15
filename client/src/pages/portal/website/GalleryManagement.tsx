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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Images, Plus, Trash2, Edit, Tag, FolderPlus, Upload, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface GalleryImage {
  id: number;
  title?: string;
  eventName?: string;
  imageUrl: string;
  altText?: string;
  caption?: string;
  categoryId?: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

interface GalleryCategory {
  id: number;
  name: string;
  description?: string;
}

type UploadFormData = {
  title: string;
  eventName: string;
  altText: string;
  caption: string;
  categoryId: string;
  displayOrder: string;
};

const DEFAULT_UPLOAD_FORM: UploadFormData = {
  title: '', eventName: '', altText: '', caption: '', categoryId: '', displayOrder: '0',
};

export default function GalleryManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormData>(DEFAULT_UPLOAD_FORM);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const token = () => localStorage.getItem('token') || '';

  const { data: images = [], isLoading } = useQuery<GalleryImage[]>({
    queryKey: ['/api/admin/gallery', selectedCategory],
    queryFn: async () => {
      const url = selectedCategory !== 'all'
        ? `/api/admin/gallery?categoryId=${selectedCategory}`
        : '/api/admin/gallery';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` }, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<GalleryCategory[]>({
    queryKey: ['/api/public/gallery/categories'],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('image', uploadFile);
      Object.entries(uploadForm).forEach(([k, v]) => { if (v) formData.append(k, v); });
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Upload failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/gallery'] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadForm(DEFAULT_UPLOAD_FORM);
      toast({ title: 'Image uploaded successfully' });
    },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<GalleryImage> }) =>
      apiRequest('PUT', `/api/admin/gallery/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/gallery'] });
      setEditingImage(null);
      toast({ title: 'Image updated' });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/admin/gallery/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/gallery'] });
      setDeleteTarget(null);
      toast({ title: 'Image deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/admin/gallery-categories', { name: newCategoryName, description: newCategoryDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public/gallery/categories'] });
      setShowCategoryDialog(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      toast({ title: 'Category created' });
    },
    onError: () => toast({ title: 'Failed to create category', variant: 'destructive' }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/admin/gallery-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public/gallery/categories'] });
      toast({ title: 'Category deleted' });
    },
    onError: () => toast({ title: 'Failed to delete category', variant: 'destructive' }),
  });

  const categoryName = (id?: number) => categories.find(c => c.id === id)?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Images className="h-6 w-6 text-primary" /> Gallery Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage school gallery images</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> Categories
          </Button>
          <Button size="sm" onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-1" /> Upload Image
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All ({images.length})
        </Button>
        {categories.map(cat => (
          <Button
            key={cat.id}
            variant={selectedCategory === String(cat.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(String(cat.id))}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Images className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No images yet. Upload your first image.</p>
            <Button className="mt-4" onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-4 w-4 mr-1" /> Upload Image
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(image => (
            <Card key={image.id} className={`overflow-hidden group relative ${!image.isActive ? 'opacity-60' : ''}`}>
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={image.imageUrl}
                  alt={image.altText || image.title || 'Gallery image'}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  data-testid={`gallery-img-${image.id}`}
                />
                {!image.isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <EyeOff className="h-6 w-6 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setEditingImage(image)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setDeleteTarget(image.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2">
                {image.title && <p className="text-xs font-medium truncate">{image.title}</p>}
                {image.eventName && <p className="text-xs text-muted-foreground truncate">{image.eventName}</p>}
                {image.categoryId && (
                  <Badge variant="secondary" className="text-[10px] mt-1">
                    <Tag className="h-2.5 w-2.5 mr-0.5" /> {categoryName(image.categoryId)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Gallery Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Image File *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                data-testid="input-gallery-file"
              />
              {uploadFile && (
                <img src={URL.createObjectURL(uploadFile)} alt="Preview" className="mt-2 h-32 w-full object-cover rounded" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input value={uploadForm.title} onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))} placeholder="Image title" data-testid="input-gallery-title" />
              </div>
              <div>
                <Label>Event Name</Label>
                <Input value={uploadForm.eventName} onChange={e => setUploadForm(p => ({ ...p, eventName: e.target.value }))} placeholder="e.g. Sports Day" data-testid="input-gallery-event" />
              </div>
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input value={uploadForm.altText} onChange={e => setUploadForm(p => ({ ...p, altText: e.target.value }))} placeholder="Describe image for accessibility" />
            </div>
            <div>
              <Label>Caption</Label>
              <Textarea value={uploadForm.caption} onChange={e => setUploadForm(p => ({ ...p, caption: e.target.value }))} placeholder="Optional caption" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={uploadForm.categoryId} onValueChange={v => setUploadForm(p => ({ ...p, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={uploadForm.displayOrder} onChange={e => setUploadForm(p => ({ ...p, displayOrder: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={!uploadFile || uploadMutation.isPending} data-testid="button-upload-gallery">
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingImage && (
        <Dialog open onOpenChange={() => setEditingImage(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Image Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img src={editingImage.imageUrl} alt="Preview" className="h-40 w-full object-cover rounded" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input value={editingImage.title || ''} onChange={e => setEditingImage(p => p ? ({ ...p, title: e.target.value }) : null)} />
                </div>
                <div>
                  <Label>Event Name</Label>
                  <Input value={editingImage.eventName || ''} onChange={e => setEditingImage(p => p ? ({ ...p, eventName: e.target.value }) : null)} />
                </div>
              </div>
              <div>
                <Label>Caption</Label>
                <Textarea value={editingImage.caption || ''} onChange={e => setEditingImage(p => p ? ({ ...p, caption: e.target.value }) : null)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={editingImage.categoryId ? String(editingImage.categoryId) : ''}
                    onValueChange={v => setEditingImage(p => p ? ({ ...p, categoryId: v ? parseInt(v) : undefined }) : null)}
                  >
                    <SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No category</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={editingImage.displayOrder} onChange={e => setEditingImage(p => p ? ({ ...p, displayOrder: parseInt(e.target.value) }) : null)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingImage.isActive} onCheckedChange={v => setEditingImage(p => p ? ({ ...p, isActive: v }) : null)} />
                <Label className="flex items-center gap-1">
                  {editingImage.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {editingImage.isActive ? 'Visible on website' : 'Hidden from website'}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingImage(null)}>Cancel</Button>
              <Button
                onClick={() => updateMutation.mutate({ id: editingImage.id, updates: editingImage })}
                disabled={updateMutation.isPending}
                data-testid="button-save-gallery-edit"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Category Management Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gallery Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No categories yet</p>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteCategoryMutation.mutate(cat.id)}
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <hr />
            <div className="space-y-2">
              <Label>New Category</Label>
              <Input placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} data-testid="input-category-name" />
              <Input placeholder="Description (optional)" value={newCategoryDesc} onChange={e => setNewCategoryDesc(e.target.value)} />
              <Button
                className="w-full"
                onClick={() => createCategoryMutation.mutate()}
                disabled={!newCategoryName || createCategoryMutation.isPending}
                data-testid="button-create-category"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the image from the gallery.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete-gallery"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
