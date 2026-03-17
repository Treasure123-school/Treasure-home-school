import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_IDS } from '@/lib/roles';

interface GalleryImage {
  id: number;
  imageUrl: string;
  caption?: string;
  categoryId?: number;
  uploadedBy?: string;
  createdAt: string;
}
export default function Gallery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUpload, setShowUpload] = useState(false);

  if (!user) {
    return <div>Please log in to access the gallery.</div>;
  }
  const { data: galleryImages, isLoading } = useQuery({
    queryKey: ['gallery-images'],
    queryFn: async () => {
      const response = await fetch('/api/gallery', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch gallery images');
      return response.json();
    }
  });

  const handleImageUpload = (result: any) => {
    toast({
      title: "Image uploaded",
      description: "Your image has been added to the gallery successfully.",
    });
    
    // Refresh gallery images
    queryClient.invalidateQueries({ queryKey: ['gallery-images'] });
    setShowUpload(false);
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      const response = await fetch(`/api/gallery/${imageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: "Image deleted",
          description: "The image has been removed from the gallery.",
        });
        queryClient.invalidateQueries({ queryKey: ['gallery-images'] });
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
            <p className="text-muted-foreground">
              {user.roleId === ROLE_IDS.STUDENT ? "Upload and manage your images" : "Browse school gallery"}
            </p>
          </div>
          {user.roleId === ROLE_IDS.STUDENT && (
            <Button 
              onClick={() => setShowUpload(!showUpload)}
              data-testid="gallery-upload-toggle"
            >
              {showUpload ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Hide Upload
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Image
                </>
              )}
            </Button>
          )}
        </div>

        {/* Upload Section - Student Only */}
        {user.roleId === ROLE_IDS.STUDENT && showUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload New Image</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                type="gallery"
                userId={user.id}
                onUploadSuccess={handleImageUpload}
              />
            </CardContent>
          </Card>
        )}

        {/* Gallery Content */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Images</TabsTrigger>
            <TabsTrigger value="recent">Recently Added</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading gallery...</div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {galleryImages && galleryImages.length > 0 ? (
                  galleryImages.map((image: GalleryImage) => (
                    <Card key={image.id} className="overflow-hidden" data-testid={`gallery-image-${image.id}`}>
                      <div className="relative aspect-square">
                        <img
                          src={image.imageUrl}
                          alt={image.caption || 'Gallery image'}
                          className="w-full h-full object-cover"
                        />
                        {user.roleId === ROLE_IDS.STUDENT && (
                          <div className="absolute top-2 right-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-8 rounded-full p-0"
                              onClick={() => handleDeleteImage(image.id)}
                              data-testid={`delete-image-${image.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {image.caption && (
                        <CardContent className="p-3">
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {image.caption}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(image.createdAt).toLocaleDateString()}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full">
                    <Card>
                      <CardContent className="p-12 text-center">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No images yet
                        </h3>
                        <p className="text-gray-500 mb-4">
                          {user.roleId === ROLE_IDS.STUDENT ? "Upload your first image to get started." : "No images have been uploaded yet."}
                        </p>
                        {user.roleId === ROLE_IDS.STUDENT && (
                          <Button onClick={() => setShowUpload(true)} data-testid="upload-first-image">
                            <Plus className="h-4 w-4 mr-2" />
                            Upload Image
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="recent" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {galleryImages && galleryImages
                .sort((a: GalleryImage, b: GalleryImage) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .slice(0, 8)
                .map((image: GalleryImage) => (
                  <Card key={image.id} className="overflow-hidden" data-testid={`recent-image-${image.id}`}>
                    <div className="relative aspect-square">
                      <img
                        src={image.imageUrl}
                        alt={image.caption || 'Gallery image'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => handleDeleteImage(image.id)}
                          data-testid={`delete-recent-${image.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {image.caption && (
                      <CardContent className="p-3">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {image.caption}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(image.createdAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}