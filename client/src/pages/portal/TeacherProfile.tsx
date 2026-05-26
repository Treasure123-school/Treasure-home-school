import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { User, Mail, Phone, MapPin, Save, Edit, Camera, GraduationCap, BookOpen, Users, CheckCircle, Clock, Award, FileText, Pen, X } from 'lucide-react';
import { Link } from 'wouter';
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileUpload } from '@/components/ui/file-upload';
import { ImageCapture } from '@/components/ui/image-capture';
import { SignatureDialog } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/config/api';
import type { TeacherProfileWithUser, Class } from '@shared/schema';

export default function TeacherProfile() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    recoveryEmail: '',
    gender: '',
    dateOfBirth: '',
    nationalId: '',
    profileImageUrl: ''
  });
  const [professionalData, setProfessionalData] = useState({
    qualification: '',
    specialization: '',
    yearsOfExperience: 0,
    department: '',
    gradingMode: 'manual',
    notificationPreference: 'all',
    availability: 'full-time',
    subjects: [] as number[],
    assignedClasses: [] as number[],
    staffId: '',
    signatureUrl: ''
  });

  if (!user) {
    return <div>Please log in to access your profile.</div>;
  }

  // Fetch teacher professional profile - this already has merged user data from both users and teacher_profiles tables
  const { data: teacherProfile, isLoading: teacherProfileLoading, error: teacherProfileError } = useQuery<TeacherProfileWithUser>({
    queryKey: ['/api/teacher/profile/me'],
    enabled: !!user
  });

  // Fetch actual teacher assignments from the assignments table (admin-assigned)
  const { data: teacherAssignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/teacher-assignments'],
    enabled: !!user
  });

  // Extract unique classes and subjects from actual assignments
  const uniqueAssignedClasses = React.useMemo(() => {
    const classMap = new Map<number, { id: number; name: string }>();
    (teacherAssignments as any[]).forEach((assignment: any) => {
      if (assignment.classId && assignment.className && !classMap.has(assignment.classId)) {
        classMap.set(assignment.classId, { id: assignment.classId, name: assignment.className });
      }
    });
    return Array.from(classMap.values());
  }, [teacherAssignments]);

  const uniqueAssignedSubjects = React.useMemo(() => {
    const subjectMap = new Map<number, { id: number; name: string; code: string }>();
    (teacherAssignments as any[]).forEach((assignment: any) => {
      if (assignment.subjectId && assignment.subjectName && !subjectMap.has(assignment.subjectId)) {
        subjectMap.set(assignment.subjectId, {
          id: assignment.subjectId,
          name: assignment.subjectName,
          code: assignment.subjectCode || ''
        });
      }
    });
    return Array.from(subjectMap.values());
  }, [teacherAssignments]);

  // Fetch classes for display (fallback)
  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ['/api/classes'],
    enabled: !!user
  });

  // Fetch subjects for display (fallback)
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<any[]>({
    queryKey: ['/api/subjects'],
    enabled: !!user
  });

  const isLoading = teacherProfileLoading || classesLoading || subjectsLoading || assignmentsLoading;

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    if (!teacherProfile) return 0;
    let completed = 0;
    let total = 15; // Total fields from setup form

    // Professional fields (from setup)
    if (teacherProfile.staffId) completed++;
    if (teacherProfile.qualification) completed++;
    if (teacherProfile.specialization) completed++;
    if (teacherProfile.yearsOfExperience && teacherProfile.yearsOfExperience > 0) completed++;
    // Use actual assignments instead of profile data
    if (uniqueAssignedSubjects.length > 0) completed++;
    if (uniqueAssignedClasses.length > 0) completed++;
    if (teacherProfile.department) completed++;

    // Personal fields (from setup) - now from teacherProfile which has merged data
    if (teacherProfile.gender) completed++;
    if (teacherProfile.dateOfBirth) completed++;
    if (teacherProfile.phone) completed++;
    if (teacherProfile.profileImageUrl) completed++;

    // Operational preferences (from setup)
    if (teacherProfile.gradingMode) completed++;
    if (teacherProfile.notificationPreference) completed++;
    if (teacherProfile.availability) completed++;

    // Optional: Digital signature (bonus for 100%)
    if (teacherProfile.signatureUrl) completed++;

    return Math.round((completed / total) * 100);
  };

  // Check for missing critical fields
  const getMissingCriticalFields = () => {
    if (!teacherProfile) return [];
    const missing = [];

    if (!teacherProfile.nationalId) missing.push({ field: 'National ID (NIN)', key: 'nationalId' });
    if (!teacherProfile.profileImageUrl) missing.push({ field: 'Profile Image', key: 'profileImageUrl' });
    if (!teacherProfile.phone) missing.push({ field: 'Phone Number', key: 'phone' });
    if (!teacherProfile.gender) missing.push({ field: 'Gender', key: 'gender' });
    if (!teacherProfile.dateOfBirth) missing.push({ field: 'Date of Birth', key: 'dateOfBirth' });

    return missing;
  };

  const profileCompletion = calculateCompletion();

  // Initialize form data when teacher profile loads - ALL DATA IS IN teacherProfile
  React.useEffect(() => {
    if (teacherProfile) {

      // teacherProfile from /api/teacher/profile/me already has everything merged (user + profile)
      // Use ONLY teacherProfile data, no fallbacks to avoid overwriting
      const newProfileData = {
        firstName: teacherProfile.firstName || '',
        lastName: teacherProfile.lastName || '',
        email: teacherProfile.email || '',
        phone: teacherProfile.phone || '',
        address: teacherProfile.address || '',
        recoveryEmail: teacherProfile.recoveryEmail || '',
        gender: teacherProfile.gender || '',
        dateOfBirth: teacherProfile.dateOfBirth || '',
        nationalId: teacherProfile.nationalId || '',
        profileImageUrl: teacherProfile.profileImageUrl || ''
      };

      setProfileData(newProfileData);
    }
  }, [teacherProfile]); // Remove 'user' from dependencies to prevent re-initialization

  // Initialize professional data when teacher profile loads
  // NOTE: subjects and assignedClasses are NOT from profile - they come from assignments table
  React.useEffect(() => {
    if (teacherProfile) {
      const newProfessionalData = {
        qualification: teacherProfile.qualification || '',
        specialization: teacherProfile.specialization || '',
        yearsOfExperience: teacherProfile.yearsOfExperience || 0,
        department: teacherProfile.department || '',
        gradingMode: teacherProfile.gradingMode || 'manual',
        notificationPreference: teacherProfile.notificationPreference || 'all',
        availability: teacherProfile.availability || 'full-time',
        subjects: [], // Admin-controlled via teacher_class_assignments
        assignedClasses: [], // Admin-controlled via teacher_class_assignments
        staffId: teacherProfile.staffId || '',
        signatureUrl: teacherProfile.signatureUrl || ''
      };

      setProfessionalData(newProfessionalData);
    }
  }, [teacherProfile]);

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

      // Update local state
      setProfileData(prev => ({ ...prev, profileImageUrl: '' }));
      // Update auth context
      updateUser({ profileImageUrl: undefined });
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/teacher/profile/me'] });
    } catch (error: any) {
      toast({
        title: "Removal Failed",
        description: error?.message || "Could not remove profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowRemoveConfirm(false);
    }
  };

  const handleProfileImageUpload = (result: any) => {
    // Update auth context so avatar displays immediately
    if (result?.url) {
      updateUser({ profileImageUrl: result.url });
    }

    toast({
      title: "Profile image updated",
      description: "Your profile image has been uploaded successfully.",
    });

    queryClient.invalidateQueries({ queryKey: ['/api/teacher/profile/me'] });
    setShowImageUpload(false);
  };

  const handleSave = async () => {
    const errors: { firstName?: string; lastName?: string } = {};
    if (!profileData.firstName.trim()) errors.firstName = 'First name is required.';
    if (!profileData.lastName.trim()) errors.lastName = 'Last name is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({ title: 'Missing required fields', description: 'First name and last name cannot be empty.', variant: 'destructive' });
      return;
    }
    setFormErrors({});
    try {
      setIsSaving(true);

      // Create FormData to handle both file uploads and text data
      const formData = new FormData();

      // Add profile image if changed
      if (profileImageFile) {
        formData.append('file', profileImageFile);
      }
      // Add signature if changed
      if (signatureFile) {
        formData.append('signature', signatureFile);
      }
      // Explicitly set uploadType for teacher profile updates
      formData.append('uploadType', 'profile');
      // Add all personal data
      formData.append('firstName', profileData.firstName);
      formData.append('lastName', profileData.lastName);
      formData.append('email', profileData.email);
      formData.append('phone', profileData.phone || '');
      formData.append('address', profileData.address || '');
      formData.append('recoveryEmail', profileData.recoveryEmail || '');
      formData.append('gender', profileData.gender || '');
      formData.append('dateOfBirth', profileData.dateOfBirth || '');
      formData.append('nationalId', profileData.nationalId || '');

      // Add professional data
      formData.append('qualification', professionalData.qualification || '');
      formData.append('specialization', professionalData.specialization || '');
      formData.append('yearsOfExperience', String(professionalData.yearsOfExperience || 0));
      formData.append('department', professionalData.department || '');
      formData.append('gradingMode', professionalData.gradingMode || 'manual');
      formData.append('notificationPreference', professionalData.notificationPreference || 'all');
      formData.append('availability', professionalData.availability || 'full-time');

      // NOTE: subjects and assignedClasses are NOT sent here
      // They are admin-controlled via teacher_class_assignments table

      // Add current URLs if no new files uploaded
      if (!profileImageFile && profileData.profileImageUrl) {
        formData.append('profileImageUrl', profileData.profileImageUrl);
      }
      if (!signatureFile && professionalData.signatureUrl) {
        formData.append('signatureUrl', professionalData.signatureUrl);
      }
      // Send update request
      const response = await fetch(getApiUrl('/api/teacher/profile/me'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'We could not update your profile at this time. Please check your information and try again.');
      }
      const result = await response.json();

      toast({
        title: "✅ Profile Updated",
        description: "Your profile has been updated successfully.",
      });

      // Clear file inputs
      setProfileImageFile(null);
      setSignatureFile(null);

      setIsEditing(false);

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/teacher/profile/me'] });

    } catch (error) {
      toast({
        title: "❌ Update Failed",
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

  const handleProfessionalChange = (field: string, value: string | number) => {
    setProfessionalData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (teacherProfileError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Error loading profile. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            View and manage your personal information
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                size="sm"
                className="sm:size-auto"
              >
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="sm:size-auto transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg"
                data-testid="button-save-changes"
              >
                <Save className={`h-4 w-4 sm:mr-2 ${isSaving ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="px-4 py-2">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Profile Completion Progress */}
      {teacherProfile && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-progress">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold" data-testid="text-completion-title">Profile Completion</h3>
                <p className="text-sm text-muted-foreground">
                  {profileCompletion === 100 ? 'Your profile is complete! ✅' : 'Complete your profile for better visibility'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary" data-testid="text-completion-percentage">{profileCompletion}%</p>
              </div>
            </div>
            <Progress value={profileCompletion} className="h-2" data-testid="progress-completion" />
            {profileCompletion < 100 && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-missing-info">
                {(() => {
                  const missing = [];
                  if (!teacherProfile?.staffId) missing.push('Staff ID');
                  if (!teacherProfile?.qualification) missing.push('Qualification');
                  if (!teacherProfile?.department) missing.push('Department');
                  // Use actual assignments for subjects/classes check
                  if (uniqueAssignedSubjects.length === 0) missing.push('Subjects (Admin assigns)');
                  if (uniqueAssignedClasses.length === 0) missing.push('Classes (Admin assigns)');
                  if (!teacherProfile?.gender) missing.push('Gender');
                  if (!teacherProfile?.dateOfBirth) missing.push('Date of Birth');
                  if (!teacherProfile?.phone) missing.push('Phone');
                  if (!teacherProfile?.profileImageUrl) missing.push('Profile Photo');
                  if (!teacherProfile?.signatureUrl) missing.push('Digital Signature (Optional)');

                  return missing.length > 0
                    ? `Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3} more` : ''}`
                    : 'Complete your profile to reach 100%';
                })()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Critical Missing Fields Alert */}
      {teacherProfile && getMissingCriticalFields().length > 0 && !isEditing && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950" data-testid="card-missing-fields">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">Complete Your Profile</h3>
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                  You're missing some important information:
                </p>
                <ul className="mt-2 text-sm text-orange-700 dark:text-orange-300 list-disc list-inside">
                  {getMissingCriticalFields().map(item => (
                    <li key={item.key}>{item.field}</li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-complete-profile"
                >
                  Complete Profile Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      existingImageUrl={profileData.profileImageUrl}
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
                      <AvatarImage
                        src={teacherProfile?.profileImageUrl || profileData.profileImageUrl || ''}
                        alt={`${profileData.firstName || user.firstName} ${profileData.lastName || user.lastName}`}
                      />
                      <AvatarFallback className="text-lg">
                        {(profileData.firstName || user.firstName || 'U')[0].toUpperCase()}{(profileData.lastName || user.lastName || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-semibold">
                      {profileData.firstName} {profileData.lastName}
                    </h3>
                    <p className="text-muted-foreground">Teacher</p>
                    {teacherProfile?.profileImageUrl && (
                      <p className="text-xs text-green-600 mt-1">✓ Profile photo uploaded</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Teacher ID</p>
                    <p className="text-sm text-muted-foreground">
                      {user.username || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground break-all">
                      {profileData.email || 'Not set'}
                    </p>
                  </div>
                </div>
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
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName || ''}
                    onChange={(e) => { handleChange('firstName', e.target.value); if (formErrors.firstName) setFormErrors(p => ({ ...p, firstName: undefined })); }}
                    disabled={!isEditing}
                    className={formErrors.firstName ? 'border-destructive focus-visible:ring-destructive' : ''}
                    data-testid="input-first-name"
                  />
                  {formErrors.firstName && <p className="text-xs text-destructive">{formErrors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName || ''}
                    onChange={(e) => { handleChange('lastName', e.target.value); if (formErrors.lastName) setFormErrors(p => ({ ...p, lastName: undefined })); }}
                    disabled={!isEditing}
                    className={formErrors.lastName ? 'border-destructive focus-visible:ring-destructive' : ''}
                    data-testid="input-last-name"
                  />
                  {formErrors.lastName && <p className="text-xs text-destructive">{formErrors.lastName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={profileData.gender || ''}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={profileData.dateOfBirth || ''}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId">National ID (NIN)</Label>
                  <Input
                    id="nationalId"
                    value={profileData.nationalId || ''}
                    onChange={(e) => handleChange('nationalId', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g., 12345678901"
                    data-testid="input-national-id"
                  />
                  {profileData.nationalId && !isEditing && (
                    <p className="text-xs text-green-600">✓ National ID verified</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="recoveryEmail">Recovery Email</Label>
                  <Input
                    id="recoveryEmail"
                    type="email"
                    value={profileData.recoveryEmail || ''}
                    onChange={(e) => handleChange('recoveryEmail', e.target.value)}
                    disabled={!isEditing}
                    placeholder="alternate@email.com"
                    data-testid="input-recovery-email"
                  />
                  <p className="text-xs text-muted-foreground">Used for account recovery purposes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic & Professional Details */}
          {teacherProfile && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" data-testid="heading-academic">
                  <GraduationCap className="h-5 w-5" />
                  <span>Academic & Professional Details</span>
                </CardTitle>
                <CardDescription>Your qualifications and professional information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground">Staff ID</Label>
                    <p className="text-lg font-medium mt-1" data-testid="text-staff-id">{teacherProfile.staffId || 'Not set'}</p>
                  </div>
                  <div>
                    <Label htmlFor="qualification">Qualification</Label>
                    {isEditing ? (
                      <Input
                        id="qualification"
                        value={professionalData.qualification}
                        onChange={(e) => handleProfessionalChange('qualification', e.target.value)}
                        placeholder="e.g., B.Ed, M.Ed, Ph.D"
                      />
                    ) : (
                      <p className="text-lg font-medium mt-1" data-testid="text-qualification">{teacherProfile.qualification || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="specialization">Specialization</Label>
                    {isEditing ? (
                      <Input
                        id="specialization"
                        value={professionalData.specialization}
                        onChange={(e) => handleProfessionalChange('specialization', e.target.value)}
                        placeholder="e.g., Mathematics, Science"
                      />
                    ) : (
                      <p className="text-lg font-medium mt-1" data-testid="text-specialization">{teacherProfile.specialization || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                    {isEditing ? (
                      <Input
                        id="yearsOfExperience"
                        type="number"
                        value={professionalData.yearsOfExperience}
                        onChange={(e) => handleProfessionalChange('yearsOfExperience', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    ) : (
                      <p className="text-lg font-medium mt-1" data-testid="text-experience">
                        {teacherProfile.yearsOfExperience ? `${teacherProfile.yearsOfExperience} years` : 'Not set'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    {isEditing ? (
                      <Input
                        id="department"
                        value={professionalData.department}
                        onChange={(e) => handleProfessionalChange('department', e.target.value)}
                        placeholder="e.g., Science, Arts"
                      />
                    ) : (
                      <p className="text-lg font-medium mt-1" data-testid="text-department">{teacherProfile.department || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Verification Status</Label>
                    <div className="mt-1">
                      {teacherProfile.verified ? (
                        <Badge variant="default" className="gap-1" data-testid="badge-verified">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1" data-testid="badge-pending">
                          <Clock className="w-3 h-3" />
                          Pending Verification
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teaching Assignments - Read Only (Admin Assigned) */}
          {teacherProfile && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" data-testid="heading-assignments">
                  <BookOpen className="h-5 w-5" />
                  <span>Teaching Assignments</span>
                </CardTitle>
                <CardDescription>
                  Your assigned subjects and classes (managed by school administrators)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Assigned Subjects</Label>
                  {/* Subjects are admin-controlled - read-only display from actual assignments */}
                  <div className="flex flex-wrap gap-2" data-testid="container-subjects">
                    {uniqueAssignedSubjects.length > 0 ? (
                      uniqueAssignedSubjects.map((subject, idx) => (
                        <Badge key={`subject-${subject.id}`} variant="secondary" className="text-sm" data-testid={`badge-subject-${idx}`}>
                          <BookOpen className="w-3 h-3 mr-1" />
                          {subject.name}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No subjects assigned yet</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Contact your administrator to update subject assignments
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground mb-2 block">Assigned Classes</Label>
                  {/* Classes are admin-controlled - read-only display from actual assignments */}
                  <div className="flex flex-wrap gap-2" data-testid="container-classes">
                    {uniqueAssignedClasses.length > 0 ? (
                      uniqueAssignedClasses.map((classItem, idx) => (
                        <Badge key={`class-${classItem.id}`} variant="outline" className="text-sm" data-testid={`badge-class-${idx}`}>
                          <Users className="w-3 h-3 mr-1" />
                          {classItem.name}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No classes assigned yet</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Contact your administrator to update class assignments
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground mb-2 block">Digital Signature</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Your signature will be used when signing report cards for your assigned classes.
                  </p>
                  {teacherProfile.signatureUrl ? (
                    <div className="space-y-3">
                      <div className="border rounded-lg p-4 bg-white dark:bg-slate-950 inline-block">
                        <img
                          src={teacherProfile.signatureUrl}
                          alt="Digital Signature"
                          className="max-h-20 max-w-xs"
                          data-testid="img-signature"
                        />
                      </div>
                      <div>
                        <SignatureDialog
                          trigger={
                            <Button variant="outline" size="sm" data-testid="button-update-signature">
                              <Pen className="w-4 h-4 mr-2" />
                              Update Signature
                            </Button>
                          }
                          onSave={async (signatureDataUrl: string) => {
                            try {
                              await apiRequest('POST', '/api/user/signature', { signatureDataUrl });
                              queryClient.invalidateQueries({ queryKey: ['/api/teacher/profile/me'] });
                              toast({
                                title: 'Signature Updated',
                                description: 'Your digital signature has been updated successfully.',
                              });
                            } catch (error: any) {
                              toast({
                                title: 'Error',
                                description: error.message || 'Failed to update signature',
                                variant: 'destructive'
                              });
                            }
                          }}
                          initialSignature={teacherProfile.signatureUrl}
                          title="Update Your Digital Signature"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">No signature set up yet</p>
                      <SignatureDialog
                        trigger={
                          <Button variant="default" size="sm" data-testid="button-setup-signature">
                            <Pen className="w-4 h-4 mr-2" />
                            Draw Your Signature
                          </Button>
                        }
                        onSave={async (signatureDataUrl: string) => {
                          try {
                            await apiRequest('POST', '/api/user/signature', { signatureDataUrl });
                            queryClient.invalidateQueries({ queryKey: ['/api/teacher/profile/me'] });
                            toast({
                              title: 'Signature Saved',
                              description: 'Your digital signature has been saved successfully.',
                            });
                          } catch (error: any) {
                            toast({
                              title: 'Error',
                              description: error.message || 'Failed to save signature',
                              variant: 'destructive'
                            });
                          }
                        }}
                        title="Set Up Your Digital Signature"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operational Preferences */}
          {teacherProfile && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" data-testid="heading-preferences">
                  <Award className="h-5 w-5" />
                  <span>Operational Preferences</span>
                </CardTitle>
                <CardDescription>Your teaching and notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="gradingMode">Grading Mode</Label>
                    {isEditing ? (
                      <Select
                        value={professionalData.gradingMode}
                        onValueChange={(value) => handleProfessionalChange('gradingMode', value)}
                      >
                        <SelectTrigger id="gradingMode">
                          <SelectValue placeholder="Select grading mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-lg font-medium mt-1 capitalize" data-testid="text-grading-mode">
                        {teacherProfile.gradingMode || 'Manual'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="notificationPreference">Notification Preference</Label>
                    {isEditing ? (
                      <Select
                        value={professionalData.notificationPreference}
                        onValueChange={(value) => handleProfessionalChange('notificationPreference', value)}
                      >
                        <SelectTrigger id="notificationPreference">
                          <SelectValue placeholder="Select notification preference" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Notifications</SelectItem>
                          <SelectItem value="important">Important Only</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-lg font-medium mt-1 capitalize" data-testid="text-notification-pref">
                        {teacherProfile.notificationPreference || 'All'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    {isEditing ? (
                      <Select
                        value={professionalData.availability}
                        onValueChange={(value) => handleProfessionalChange('availability', value)}
                      >
                        <SelectTrigger id="availability">
                          <SelectValue placeholder="Select availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="on-leave">On Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-lg font-medium mt-1 capitalize" data-testid="text-availability">
                        {teacherProfile.availability || 'Full-time'}
                      </p>
                    )}
                  </div>
                </div>
                {teacherProfile.updatedAt && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground" data-testid="text-last-updated">
                      Last updated: {new Date(teacherProfile.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              <Link href="/portal/teacher">
                <User className="h-6 w-6" />
                <span className="text-sm">Dashboard</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
              <Link href="/portal/teacher/exams">
                <GraduationCap className="h-6 w-6" />
                <span className="text-sm">My Exams</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col space-y-2" asChild>
              <Link href="/portal/teacher/attendance">
                <GraduationCap className="h-6 w-6" />
                <span className="text-sm">Attendance</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

  );
}