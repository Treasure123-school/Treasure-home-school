import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Download, Search, FileText, BookOpen, ArrowLeft, Filter } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
export default function StudentStudyResources() {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access study resources.</div>;
  }
  return <StudentStudyResourcesContent user={user} />;
}
function StudentStudyResourcesContent({ user }: { user: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const { data: resources = [], isLoading, error } = useQuery({
    queryKey: ['study-resources'],
    queryFn: async () => {
      const response = await fetch('/api/study-resources', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch study resources');
      return response.json();
    }
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = await fetch('/api/subjects', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch subjects');
      return response.json();
    }
  });

  // Map roleId to role name - matches ROLE_IDS in lib/roles.ts
  const getRoleName = (roleId: number): 'admin' | 'teacher' | 'parent' | 'student' => {
    const roleMap: { [key: number]: 'admin' | 'teacher' | 'parent' | 'student' } = {
      1: 'admin', 2: 'admin', 3: 'teacher', 4: 'student', 5: 'parent'
    };
    return roleMap[roleId] || 'student';
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'past_paper':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'study_guide':
        return <BookOpen className="h-5 w-5 text-green-600" />;
      case 'notes':
        return <FileText className="h-5 w-5 text-purple-600" />;
      case 'assignment':
        return <FileText className="h-5 w-5 text-orange-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResourceColor = (type: string) => {
    switch (type) {
      case 'past_paper':
        return 'bg-blue-100 text-blue-800';
      case 'study_guide':
        return 'bg-green-100 text-green-800';
      case 'notes':
        return 'bg-purple-100 text-purple-800';
      case 'assignment':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (resource: any) => {
    try {
      const response = await fetch(`/api/study-resources/${resource.id}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
    }
  };

  // Filter resources
  const filteredResources = resources.filter((resource: any) => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || resource.resourceType === selectedType;
    const matchesSubject = selectedSubject === 'all' || resource.subjectId?.toString() === selectedSubject;
    
    return matchesSearch && matchesType && matchesSubject;
  });

  const resourceTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'past_paper', label: 'Past Papers' },
    { value: 'study_guide', label: 'Study Guides' },
    { value: 'notes', label: 'Notes' },
    { value: 'assignment', label: 'Assignments' }
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/student">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Study Resources</h1>
              <p className="text-muted-foreground">
                Access past papers, study guides, and learning materials
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <Badge variant="secondary">{filteredResources.length} resources</Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="p-2 border rounded"
              >
                {resourceTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="p-2 border rounded"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id.toString()}>{subject.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center py-6 sm:py-8">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-red-800 dark:text-red-300">
                  Unable to Load Resources
                </h3>
                <p className="text-sm sm:text-base text-red-600 dark:text-red-400 mb-4 max-w-md mx-auto">
                  We couldn't load your study materials at this time. This might be a temporary issue.
                </p>
                
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 max-w-md mx-auto">
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suggested Actions:</p>
                  <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-left space-y-1">
                    <li>• Refresh the page to try again</li>
                    <li>• Ensure you have a stable internet connection</li>
                    <li>• Contact your subject teacher if resources are missing</li>
                    <li>• Check back later if the issue continues</li>
                  </ul>
                </div>

                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resources Grid */}
        {!isLoading && !error && (
          <>
            {filteredResources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource: any) => (
                  <Card key={resource.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getResourceIcon(resource.resourceType)}
                          <div className="flex-1">
                            <CardTitle className="text-base">{resource.title}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className={getResourceColor(resource.resourceType)}>
                                {resource.resourceType.replace('_', ' ')}
                              </Badge>
                              {resource.fileSize && (
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(resource.fileSize)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(resource)}
                          className="flex-shrink-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {resource.downloads || 0} downloads
                        </span>
                        <span>
                          {new Date(resource.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No resources found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || selectedType !== 'all' || selectedSubject !== 'all'
                        ? 'No resources match your current filters. Try adjusting your search criteria.'
                        : 'No study resources are available yet. Check back later for updates.'
                      }
                    </p>
                    {(searchTerm || selectedType !== 'all' || selectedSubject !== 'all') && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedType('all');
                          setSelectedSubject('all');
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
