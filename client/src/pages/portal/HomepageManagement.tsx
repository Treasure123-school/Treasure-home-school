import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Upload, Edit, Save, X, Image as ImageIcon } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/config/api';
import { useAuth } from '@/lib/auth';
import type { HomePageContent } from '@shared/schema';

// Define sections with their content types
const SECTIONS = {
  hero: {
    label: 'Hero Section',
    icon: '🎯',
    types: ['hero_image'],
    description: 'Main banner images on the homepage'
  },
  gallery: {
    label: 'Gallery Preview',
    icon: '🖼️',
    types: ['gallery_preview_1', 'gallery_preview_2', 'gallery_preview_3'],
    description: 'Preview images shown on homepage gallery carousel'
  },
  about: {
    label: 'About Section',
    icon: '📖',
    types: ['about_section'],
    description: 'Images for the about page'
  },
  featured: {
    label: 'Featured Content',
    icon: '⭐',
    types: ['featured_content'],
    description: 'Featured/highlighted content images'
  }
};

export default function HomepageManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('hero');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingItem, setEditingItem] = useState<HomePageContent | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const [newContent, setNewContent] = useState({
    contentType: SECTIONS.hero.types[0],
    altText: '',
    caption: '',
    displayOrder: 0
  });

  // Fetch all home page content
  const { data: homePageContent = [], isLoading } = useQuery<HomePageContent[]>({
    queryKey: ['/api/homepage-content'],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Filter content by active section
  const sectionTypes = SECTIONS[activeSection as keyof typeof SECTIONS].types;
  const sectionContent = homePageContent.filter(item => sectionTypes.includes(item.contentType));

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, data }: { file: File; data: any }) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      console.log('📤 [UPLOAD] Starting logo upload with token:', token.substring(0, 10) + '...');

      const formData = new FormData();
      formData.append('file', file); // Use 'file' as expected by app.post("/api/upload")
      formData.append('uploadType', 'homepage'); 
      formData.append('contentType', data.contentType);
      formData.append('altText', data.altText);
      formData.append('caption', data.caption);
      formData.append('displayOrder', data.displayOrder.toString());

      const response = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('❌ [UPLOAD] Homepage image upload error:', result);
        throw new Error(result.message || `We couldn't upload your image (Error ${response.status}). Please try a different file or contact support.`);
      }
      
      console.log('✅ [UPLOAD] Homepage image upload successful:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      toast({ title: "Success", description: "Image uploaded successfully" });
      setUploadFile(null);
      setNewContent({ contentType: sectionTypes[0], altText: '', caption: '', displayOrder: 0 });
      setShowUploadForm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<HomePageContent> }) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(getApiUrl(`/api/homepage-content/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Update failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      toast({ title: "Success", description: "Content updated successfully" });
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(getApiUrl(`/api/homepage-content/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Delete failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      toast({ title: "Success", description: "Content deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = () => {
    if (!uploadFile || !newContent.contentType) {
      toast({ title: "Validation Error", description: "Please select a file and content type", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({ file: uploadFile, data: newContent });
  };

  const handleUpdate = (item: HomePageContent) => {
    if (!editingItem) return;
    updateMutation.mutate({
      id: item.id,
      data: {
        altText: editingItem.altText,
        caption: editingItem.caption,
        displayOrder: editingItem.displayOrder,
        isActive: editingItem.isActive
      }
    });
  };

  if (!user) return <div>Loading...</div>;

  const currentSection = SECTIONS[activeSection as keyof typeof SECTIONS];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Website Images & Content</h1>
        <p className="text-muted-foreground mt-2">Manage images for different sections of the school website</p>
      </div>

      {/* Tabs for Different Sections */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(SECTIONS).map(([key, section]) => (
            <TabsTrigger key={key} value={key} data-testid={`tab-${key}`}>
              <span className="mr-2">{section.icon}</span>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content for each section */}
        {Object.entries(SECTIONS).map(([sectionKey, section]) => (
          <TabsContent key={sectionKey} value={sectionKey} className="space-y-4">
            {/* Section Description */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <p className="text-sm text-foreground">{section.description}</p>
                <p className="text-xs text-muted-foreground mt-2">Allowed types: {section.types.join(', ')}</p>
              </CardContent>
            </Card>

            {/* Upload Form */}
            {showUploadForm && activeSection === sectionKey && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload New Image
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imageType">Image Type</Label>
                      <select
                        id="imageType"
                        value={newContent.contentType}
                        onChange={(e) => setNewContent(prev => ({ ...prev, contentType: e.target.value }))}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                        data-testid="select-image-type"
                      >
                        {section.types.map(type => (
                          <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayOrder">Display Order</Label>
                      <Input
                        id="displayOrder"
                        type="number"
                        value={newContent.displayOrder}
                        onChange={(e) => setNewContent(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                        data-testid="input-display-order"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file">Image File</Label>
                    <Input
                      id="file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      data-testid="input-image-file"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="altText">Alt Text (for accessibility)</Label>
                    <Input
                      id="altText"
                      value={newContent.altText}
                      onChange={(e) => setNewContent(prev => ({ ...prev, altText: e.target.value }))}
                      placeholder="Describe the image"
                      data-testid="input-alt-text"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caption">Caption (Optional)</Label>
                    <Textarea
                      id="caption"
                      value={newContent.caption}
                      onChange={(e) => setNewContent(prev => ({ ...prev, caption: e.target.value }))}
                      placeholder="Optional caption"
                      data-testid="textarea-caption"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleUpload} disabled={uploadMutation.isPending || !uploadFile || !newContent.contentType} data-testid="button-upload">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload Image'}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowUploadForm(false); setUploadFile(null); }} data-testid="button-cancel-upload">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Images List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Images in {section.label}</CardTitle>
                {!showUploadForm && activeSection === sectionKey && (
                  <Button onClick={() => { setShowUploadForm(true); setNewContent({ ...newContent, contentType: section.types[0] }); }} data-testid="button-add-image">
                    <Upload className="h-4 w-4 mr-2" />
                    Add Image
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : sectionContent.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">No images uploaded for this section yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sectionContent.sort((a, b) => a.displayOrder - b.displayOrder).map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 flex items-center gap-4 hover:bg-accent/5 transition-colors" data-testid={`image-item-${item.id}`}>
                        {/* Image Preview */}
                        <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.altText || 'Gallery image'} className="w-full h-full object-cover" data-testid={`img-preview-${item.id}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground opacity-50" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          {editingItem?.id === item.id ? (
                            <div className="space-y-2">
                              <Input value={editingItem.altText || ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, altText: e.target.value } : null)} placeholder="Alt text" data-testid={`input-edit-alt-${item.id}`} />
                              <Input type="number" value={editingItem.displayOrder || 0} onChange={(e) => setEditingItem(prev => prev ? { ...prev, displayOrder: parseInt(e.target.value) || 0 } : null)} placeholder="Order" data-testid={`input-edit-order-${item.id}`} />
                              <Textarea value={editingItem.caption ?? ''} onChange={(e) => setEditingItem(prev => prev ? { ...prev, caption: e.target.value } : null)} placeholder="Caption" className="resize-none h-20" data-testid={`textarea-edit-caption-${item.id}`} />
                              <div className="flex items-center gap-2">
                                <Switch checked={editingItem.isActive} onCheckedChange={(checked) => setEditingItem(prev => prev ? { ...prev, isActive: checked } : null)} data-testid={`switch-active-${item.id}`} />
                                <Label className="text-sm">Active</Label>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-sm truncate">{item.contentType.replace(/_/g, ' ')}</div>
                              <p className="text-xs text-muted-foreground truncate">Alt: {item.altText || '—'}</p>
                              {item.caption && <p className="text-xs text-muted-foreground truncate">Caption: {item.caption}</p>}
                              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                <span>Order: {item.displayOrder}</span>
                                <span className={item.isActive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 flex-shrink-0">
                          {editingItem?.id === item.id ? (
                            <>
                              <Button size="sm" variant="default" onClick={() => handleUpdate(item)} disabled={updateMutation.isPending} data-testid={`button-save-${item.id}`}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingItem(null)} data-testid={`button-cancel-edit-${item.id}`}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditingItem(item)} data-testid={`button-edit-${item.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-${item.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
