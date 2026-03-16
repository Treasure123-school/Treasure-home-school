import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/config/api';
import { apiRequest } from '@/lib/queryClient';
import { User, Mail, Phone, MapPin, Calendar, School, Save, Edit, Camera, BookOpen, X } from 'lucide-react';
import { Link } from 'wouter';
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCapture } from '@/components/ui/image-capture';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    recoveryEmail: ''
  });

  if (!user) {
    return <div>Please log in to access your profile.</div>;
  }
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', user.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/students/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch student data');
      return response.json();
    }
  });

  const { data: classes } = useQuery({
    queryKey: ['student-classes', user.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/students/${user.id}/classes`);
      if (!response.ok) throw new Error('Failed to fetch classes');
      return response.json();
    }
  });

  // Initialize form data when student data loads
  React.useEffect(() => {
    if (student) {
      setProfileData({
        firstName: student.firstName || user.firstName || '',
        lastName: student.lastName || user.lastName || '',
        email: student.email || user.email || '',
        phone: student.phone || '',
        address: student.address || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
        recoveryEmail: student.recoveryEmail || user.recoveryEmail || ''
      });
    }
  }, [student, user]);


  const handleRemoveImage = async () => {
    try {
      const response = await apiRequest('DELETE', '/api/upload/profile');

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      toast({
        title: "Profile image removed",
        description: "Your profile image has been removed successfully.",
      });

      // Update auth context
      updateUser({ profileImageUrl: undefined });
      queryClient.invalidateQueries({ queryKey: ['student', user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowRemoveConfirm(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      let updatedProfileImageUrl = user?.profileImageUrl;

      // Handle image upload if a new file was selected/captured
      if (profileImageFile) {
        const formData = new FormData();
        formData.append('file', profileImageFile);
        formData.append('uploadType', 'profile');
        formData.append('userId', user?.id || '');

        const token = localStorage.getItem('token');
        const uploadResponse = await fetch(getApiUrl('/api/upload'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload profile image');
        }

        const uploadResult = await uploadResponse.json();
        updatedProfileImageUrl = uploadResult.url;
        
        // Update auth context so avatar displays immediately
        updateUser({ profileImageUrl: updatedProfileImageUrl });
      }

      const response = await apiRequest('PATCH', `/api/students/${user.id}`, {
        ...profileData,
        profileImageUrl: updatedProfileImageUrl
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
      const result = await response.json();

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });

      setProfileImageFile(null);
      setIsEditing(false);

      // Refresh student data
      queryClient.invalidateQueries({ queryKey: ['student', user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground">
              View and manage your personal information
            </p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading profile...</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Overview */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Profile Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  {isEditing ? (
                    <>
                      <ImageCapture
                        value={profileImageFile}
                        onChange={setProfileImageFile}
                        label="Profile Photo"
                        shape="circle"
                        existingImageUrl={user?.profileImageUrl || student?.profileImage}
                        onRemove={() => setShowRemoveConfirm(true)}
                      />

                      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently remove your profile image. You can always upload a new one later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRemoveImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remove Image
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <>
                      <Avatar className="h-24 w-24 mx-auto mb-4">
                        <AvatarImage src={user?.profileImageUrl || student?.profileImage} />
                        <AvatarFallback className="text-lg">
                          {user.firstName[0]}{user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                    </>
                  )}
                  <h3 className="text-lg font-semibold">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-muted-foreground">Student</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Student ID</p>
                      <p className="text-sm text-muted-foreground">
                        {user.username || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Date of Birth</p>
                      <p className="text-sm text-muted-foreground">
                        {student?.dateOfBirth
                          ? new Date(student.dateOfBirth).toLocaleDateString()
                          : 'Not provided'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Class</p>
                      <p className="text-sm text-muted-foreground">
                        {student?.className || 'Not assigned'}
                      </p>
                    </div>
                  </div>
                  {student?.department && (
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Department</p>
                        <p className="text-sm text-muted-foreground capitalize" data-testid="text-student-department">
                          {student.department}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter your email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5" />
                  <span>Emergency Contact</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                    <Input
                      id="emergencyContact"
                      value={profileData.emergencyContact}
                      onChange={(e) => handleChange('emergencyContact', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      value={profileData.emergencyPhone}
                      onChange={(e) => handleChange('emergencyPhone', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Security - Recovery Email */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Account Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="recoveryEmail">Recovery Email (for password resets)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      This email will be used to recover your account if you forget your password
                    </p>
                    <Input
                      id="recoveryEmail"
                      type="email"
                      value={profileData.recoveryEmail || ''}
                      onChange={(e) => handleChange('recoveryEmail', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter recovery email address"
                    />
                    {!profileData.recoveryEmail && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ No recovery email set. Add one to protect your account.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Classes */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <School className="h-5 w-5" />
                  <span>Current Classes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classes && classes.length > 0 ? (
                  <div className="space-y-3">
                    {classes.map((classItem: any, index: number) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-medium">{classItem.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {classItem.teacher || 'Teacher not assigned'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <School className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No classes assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Change Password */}
        <ChangePasswordCard />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
                <Link href="/portal/student/grades">
                  <School className="h-6 w-6" />
                  <span className="text-sm">View Grades</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
                <Link href="/portal/student/attendance">
                  <Calendar className="h-6 w-6" />
                  <span className="text-sm">Check Attendance</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
                <Link href="/portal/student/messages">
                  <Mail className="h-6 w-6" />
                  <span className="text-sm">Messages</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
                <Link href="/portal/student">
                  <User className="h-6 w-6" />
                  <span className="text-sm">Dashboard</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}