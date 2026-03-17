import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { CheckCircle, XCircle, Eye, Users, UserCheck, Clock, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { TeacherProfile } from '@shared/schema';

// Type for the teacher profile data returned by the API
interface TeacherProfileData {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
    gender?: string;
    dateOfBirth?: string;
    phone?: string;
  };
  profile: TeacherProfile;
  assignedClassDetails?: Array<{ name: string }>;
}
export default function TeacherProfileVerification() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: pendingProfiles = [], isLoading: pendingLoading } = useQuery<TeacherProfileData[]>({
    queryKey: ['/api/admin/teacher-profiles/pending'],
    enabled: !!user
  });

  const { data: verifiedProfiles = [], isLoading: verifiedLoading } = useQuery<TeacherProfileData[]>({
    queryKey: ['/api/admin/teacher-profiles/verified'],
    enabled: !!user
  });

  useSocketIORealtime({ 
    table: 'teacher_profiles', 
    queryKey: ['/api/admin/teacher-profiles/pending']
  });
  
  useSocketIORealtime({ 
    table: 'teacher_profiles', 
    queryKey: ['/api/admin/teacher-profiles/verified']
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'approve' | 'reject' }) => {
      return apiRequest('POST', '/api/admin/teacher-profiles/verify', { userId, action });
    },
    onMutate: async ({ userId, action }: { userId: string; action: 'approve' | 'reject' }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/admin/teacher-profiles/pending'] });
      await queryClient.cancelQueries({ queryKey: ['/api/admin/teacher-profiles/verified'] });
      
      const previousPending = queryClient.getQueryData(['/api/admin/teacher-profiles/pending']);
      const previousVerified = queryClient.getQueryData(['/api/admin/teacher-profiles/verified']);
      
      if (action === 'approve') {
        const teacherToMove = (previousPending as TeacherProfileData[])?.find((t) => t.teacher.id === userId);
        
        if (teacherToMove) {
          queryClient.setQueryData(['/api/admin/teacher-profiles/pending'], (old: TeacherProfileData[] | undefined) => 
            old?.filter((t) => t.teacher.id !== userId)
          );
          
          queryClient.setQueryData(['/api/admin/teacher-profiles/verified'], (old: TeacherProfileData[] | undefined) => 
            old ? [...old, { ...teacherToMove, profile: { ...teacherToMove.profile, verified: true } }] : [teacherToMove]
          );
        }
      } else {
        queryClient.setQueryData(['/api/admin/teacher-profiles/pending'], (old: TeacherProfileData[] | undefined) => 
          old?.filter((t) => t.teacher.id !== userId)
        );
      }
      toast({
        title: action === 'approve' ? "Approving..." : "Rejecting...",
        description: "Processing teacher profile",
      });
      
      return { previousPending, previousVerified };
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === 'approve' ? "Profile Approved" : "Profile Rejected",
        description: variables.action === 'approve' 
          ? "Teacher profile has been verified successfully." 
          : "Teacher has been notified to revise their profile.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teacher-profiles/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teacher-profiles/verified'] });
      setIsDetailsOpen(false);
    },
    onError: (error: Error, variables: any, context: any) => {
      if (context?.previousPending) {
        queryClient.setQueryData(['/api/admin/teacher-profiles/pending'], context.previousPending);
      }
      if (context?.previousVerified) {
        queryClient.setQueryData(['/api/admin/teacher-profiles/verified'], context.previousVerified);
      }
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleViewDetails = async (teacherId: string) => {
    const response = await fetch(`/api/admin/teacher-profiles/${teacherId}`, {
      credentials: 'include'
    });
    const data = await response.json();
    setSelectedTeacher(data);
    setIsDetailsOpen(true);
  };

  const handleVerify = (userId: string, action: 'approve' | 'reject') => {
    verifyMutation.mutate({ userId, action });
  };

  const ProfileDetailsDialog = () => {
    if (!selectedTeacher) return null;

    const { teacher, profile, assignedClassDetails } = selectedTeacher;

    return (
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-profile-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3" data-testid="title-teacher-name">
              <Avatar className="h-12 w-12">
                <AvatarImage src={teacher.profileImageUrl} />
                <AvatarFallback>
                  {teacher.firstName[0]}{teacher.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-bold">{teacher.firstName} {teacher.lastName}</p>
                <p className="text-sm text-muted-foreground">{teacher.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid="heading-personal-info">
                <Users className="w-5 h-5" />
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Staff ID</p>
                  <p className="font-medium" data-testid="text-staff-id">{profile.staffId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="font-medium" data-testid="text-gender">{teacher.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="font-medium" data-testid="text-dob">
                    {teacher.dateOfBirth ? new Date(teacher.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium" data-testid="text-phone">{teacher.phone || 'N/A'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Academic & Professional Details */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid="heading-academic-info">
                <GraduationCap className="w-5 h-5" />
                Academic & Professional Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Qualification</p>
                  <p className="font-medium" data-testid="text-qualification">{profile.qualification || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Specialization</p>
                  <p className="font-medium" data-testid="text-specialization">{profile.specialization || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Years of Experience</p>
                  <p className="font-medium" data-testid="text-experience">{profile.yearsOfExperience || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium" data-testid="text-department">{profile.department || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Subjects</p>
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="container-subjects">
                    {profile.subjects?.map((subject: number, idx: number) => (
                      <Badge key={idx} variant="secondary" data-testid={`badge-subject-${idx}`}>{subject}</Badge>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Assigned Classes</p>
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="container-classes">
                    {assignedClassDetails?.map((cls: { name: string }, idx: number) => (
                      <Badge key={idx} variant="outline" data-testid={`badge-class-${idx}`}>{cls.name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Operational Preferences */}
            <div>
              <h3 className="text-lg font-semibold mb-3" data-testid="heading-preferences">Operational Preferences</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Grading Mode</p>
                  <p className="font-medium" data-testid="text-grading-mode">
                    {profile.gradingMode?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Notification Preference</p>
                  <p className="font-medium" data-testid="text-notification-pref">
                    {profile.notificationPreference || 'N/A'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Availability</p>
                  <p className="font-medium" data-testid="text-availability">{profile.availability || 'N/A'}</p>
                </div>
                {profile.signatureUrl && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Digital Signature</p>
                    <img 
                      src={profile.signatureUrl} 
                      alt="Signature" 
                      className="mt-2 max-h-20 border rounded" 
                      data-testid="img-signature"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!profile.verified && (
              <>
                <Separator />
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleVerify(teacher.id, 'reject')}
                    disabled={verifyMutation.isPending}
                    data-testid="button-reject"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Request Revision
                  </Button>
                  <Button
                    onClick={() => handleVerify(teacher.id, 'approve')}
                    disabled={verifyMutation.isPending}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {verifyMutation.isPending ? 'Approving...' : 'Approve Profile'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!user) {
    return <div>Please log in to access this page.</div>;
  }
  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-page-title">
            Teacher Profile Verification
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Review and verify teacher profile submissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-stat-pending">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-count">
                {pendingProfiles.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Profiles awaiting review
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-verified">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Profiles</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-verified-count">
                {verifiedProfiles.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Approved teacher profiles
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-total">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-count">
                {pendingProfiles.length + verifiedProfiles.length}
              </div>
              <p className="text-xs text-muted-foreground">
                All profile submissions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Pending and Verified */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({pendingProfiles.length})
            </TabsTrigger>
            <TabsTrigger value="verified" data-testid="tab-verified">
              Verified ({verifiedProfiles.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Profiles Tab */}
          <TabsContent value="pending" className="space-y-4" data-testid="tab-content-pending">
            <Card>
              <CardHeader>
                <CardTitle data-testid="title-pending">Pending Verification</CardTitle>
                <CardDescription data-testid="description-pending">
                  Review and approve teacher profile submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="text-center py-8" data-testid="loading-pending">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : pendingProfiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-pending">
                    No pending profiles to review
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Subjects</TableHead>
                        <TableHead>Classes</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingProfiles.map((item, index: number) => (
                        <TableRow key={item.teacher.id} data-testid={`row-pending-${index}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={item.teacher.profileImageUrl} />
                                <AvatarFallback>
                                  {item.teacher.firstName[0]}{item.teacher.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium" data-testid={`text-name-${index}`}>
                                  {item.teacher.firstName} {item.teacher.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground" data-testid={`text-email-${index}`}>
                                  {item.teacher.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-staffid-${index}`}>
                            {item.profile.staffId || 'N/A'}
                          </TableCell>
                          <TableCell data-testid={`text-dept-${index}`}>
                            {item.profile.department || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1" data-testid={`subjects-${index}`}>
                              {item.profile.subjects && (Array.isArray(item.profile.subjects) ? item.profile.subjects : String(item.profile.subjects).split(',') as any[]).slice(0, 2).map((subject: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {subject}
                                </Badge>
                              ))}
                              {item.profile.subjects && (Array.isArray(item.profile.subjects) ? item.profile.subjects.length : String(item.profile.subjects).split(',').length) > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(Array.isArray(item.profile.subjects) ? item.profile.subjects.length : String(item.profile.subjects).split(',').length) - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-classes-${index}`}>
                            {item.profile.assignedClasses?.length || 0}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(item.teacher.id)}
                              data-testid={`button-view-${index}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verified Profiles Tab */}
          <TabsContent value="verified" className="space-y-4" data-testid="tab-content-verified">
            <Card>
              <CardHeader>
                <CardTitle data-testid="title-verified">Verified Profiles</CardTitle>
                <CardDescription data-testid="description-verified">
                  All approved teacher profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                {verifiedLoading ? (
                  <div className="text-center py-8" data-testid="loading-verified">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : verifiedProfiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-verified">
                    No verified profiles yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Subjects</TableHead>
                        <TableHead>Classes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedProfiles.map((item, index: number) => (
                        <TableRow key={item.teacher.id} data-testid={`row-verified-${index}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={item.teacher.profileImageUrl} />
                                <AvatarFallback>
                                  {item.teacher.firstName[0]}{item.teacher.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium" data-testid={`text-verified-name-${index}`}>
                                  {item.teacher.firstName} {item.teacher.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground" data-testid={`text-verified-email-${index}`}>
                                  {item.teacher.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-verified-staffid-${index}`}>
                            {item.profile.staffId || 'N/A'}
                          </TableCell>
                          <TableCell data-testid={`text-verified-dept-${index}`}>
                            {item.profile.department || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1" data-testid={`verified-subjects-${index}`}>
                              {item.profile.subjects && (Array.isArray(item.profile.subjects) ? item.profile.subjects : String(item.profile.subjects).split(',') as any[]).slice(0, 2).map((subject: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {subject}
                                </Badge>
                              ))}
                              {item.profile.subjects && (Array.isArray(item.profile.subjects) ? item.profile.subjects.length : String(item.profile.subjects).split(',').length) > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(Array.isArray(item.profile.subjects) ? item.profile.subjects.length : String(item.profile.subjects).split(',').length) - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-verified-classes-${index}`}>
                            {item.profile.assignedClasses?.length || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" data-testid={`badge-verified-${index}`}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(item.teacher.id)}
                              data-testid={`button-view-verified-${index}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      {/* Profile Details Dialog */}
      <ProfileDetailsDialog />
    </div>
  );
}
