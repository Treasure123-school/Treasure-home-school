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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Newspaper, Plus, Trash2, Edit, Eye, Calendar, Tag, Globe, FileEdit } from 'lucide-react';
import { format } from 'date-fns';

interface NewsPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImageUrl?: string;
  category: string;
  tags: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const NEWS_CATEGORIES = ['general', 'academic', 'events', 'sports', 'achievements', 'announcements'];

const EMPTY_FORM = {
  title: '', content: '', excerpt: '', category: 'general', tags: '', status: 'draft' as const,
};

function parseTags(tags: string): string[] {
  try { return JSON.parse(tags); } catch { return []; }
}

function statusBadge(status: string) {
  return status === 'published'
    ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Published</Badge>
    : <Badge variant="secondary">Draft</Badge>;
}

export default function NewsManagement() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const token = () => localStorage.getItem('token') || '';

  const { data: posts = [], isLoading } = useQuery<NewsPost[]>({
    queryKey: ['/api/admin/news'],
  });

  const filtered = filterStatus === 'all' ? posts : posts.filter(p => p.status === filterStatus);

  function openCreate() {
    setEditingPost(null);
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setShowForm(true);
  }

  function openEdit(post: NewsPost) {
    setEditingPost(post);
    setForm({
      title: post.title, content: post.content, excerpt: post.excerpt || '',
      category: post.category, tags: parseTags(post.tags).join(', '), status: post.status,
    });
    setCoverFile(null);
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('content', form.content);
      formData.append('excerpt', form.excerpt);
      formData.append('category', form.category);
      formData.append('status', form.status);
      const tagArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      formData.append('tags', JSON.stringify(tagArray));
      if (coverFile) formData.append('coverImage', coverFile);
      const url = editingPost ? `/api/admin/news/${editingPost.id}` : '/api/admin/news';
      const method = editingPost ? 'PUT' : 'POST';
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/news'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/news'] });
      setShowForm(false);
      toast({ title: editingPost ? 'Post updated' : 'Post created' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/news/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/news'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/news'] });
      setDeleteTarget(null);
      toast({ title: 'Post deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 truncate">
            <Newspaper className="h-6 w-6 text-primary shrink-0" /> <span className="truncate">News Management</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">Create and publish news posts for the school website</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-news" className="w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New Post
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'draft', 'published'] as const).map(s => (
          <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && <span className="ml-1 text-xs">({posts.filter(p => p.status === s).length})</span>}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No posts found. Create your first news post.</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Create Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <Card key={post.id} className="overflow-hidden" data-testid={`card-news-${post.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {post.coverImageUrl && (
                    <img src={post.coverImageUrl} alt={post.title} className="h-16 w-24 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate" data-testid={`text-news-title-${post.id}`}>{post.title}</h3>
                      {statusBadge(post.status)}
                      <Badge variant="outline" className="text-xs capitalize">
                        <Tag className="h-3 w-3 mr-0.5" /> {post.category}
                      </Badge>
                    </div>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.publishedAt
                          ? `Published ${format(new Date(post.publishedAt), 'MMM d, yyyy')}`
                          : `Created ${format(new Date(post.createdAt), 'MMM d, yyyy')}`}
                      </span>
                      {post.status === 'published' && (
                        <a
                          href={`/news/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Globe className="h-3 w-3" /> View on website
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(post)} data-testid={`button-edit-news-${post.id}`}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(post.id)} data-testid={`button-delete-news-${post.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              {editingPost ? 'Edit Post' : 'Create News Post'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Post title" data-testid="input-news-title" />
            </div>
            <div>
              <Label>Cover Image</Label>
              <Input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} />
              {editingPost?.coverImageUrl && !coverFile && (
                <img src={editingPost.coverImageUrl} alt="Current cover" className="mt-2 h-28 object-cover rounded w-full" />
              )}
              {coverFile && <img src={URL.createObjectURL(coverFile)} alt="Preview" className="mt-2 h-28 object-cover rounded w-full" />}
            </div>
            <div>
              <Label>Excerpt</Label>
              <Textarea value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))} placeholder="Short summary (shown in post lists)" rows={2} data-testid="input-news-excerpt" />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Full post content" rows={8} data-testid="input-news-content" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger data-testid="select-news-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEWS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger data-testid="select-news-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. sports, graduation, awards" data-testid="input-news-tags" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title || !form.content || saveMutation.isPending}
              data-testid="button-save-news"
            >
              {saveMutation.isPending ? 'Saving…' : (editingPost ? 'Update Post' : 'Create Post')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this news post.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete-news"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
