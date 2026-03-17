import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Calendar, Filter, Search } from 'lucide-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function StudentAnnouncements() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  if (!user) {
    return <div>Please log in to access announcements.</div>;
  }
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements', 'Student'],
    queryFn: async () => {
      const response = await fetch('/api/announcements?role=Student', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch announcements');
      return response.json();
    }
  });

  // Format announcements for display
  const formattedAnnouncements = announcements?.map((announcement: any) => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    publishedAt: new Date(announcement.createdAt || announcement.publishedAt),
    author: announcement.authorName || announcement.author || 'School Administration',
    priority: announcement.priority || 'normal',
    category: announcement.category || 'general'
  })) || [];

  // Filter announcements based on search term
  const filteredAnnouncements = formattedAnnouncements.filter((announcement: any) =>
    announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    announcement.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Get priority label
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Urgent';
      case 'medium':
        return 'Important';
      default:
        return 'General';
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">
              Stay updated with school news and important information
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>{filteredAnnouncements.length} announcement(s)</span>
          </div>
        </div>

        {/* Announcements List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading announcements...</div>
            </CardContent>
          </Card>
        ) : filteredAnnouncements.length > 0 ? (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement: any) => (
              <Card key={announcement.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{announcement.title}</CardTitle>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{announcement.publishedAt.toLocaleDateString()}</span>
                        </div>
                        <span>By {announcement.author}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getPriorityColor(announcement.priority)}>
                        {getPriorityLabel(announcement.priority)}
                      </Badge>
                      {announcement.category && (
                        <Badge variant="outline">
                          {announcement.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {announcement.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchTerm ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No matching announcements</h3>
                <p className="text-muted-foreground mb-4">
                  No announcements found for "{searchTerm}". Try a different search term.
                </p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No announcements yet</h3>
                <p className="text-muted-foreground mb-4">
                  School announcements will appear here. Check back later for updates.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/portal/student">
                    Back to Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}