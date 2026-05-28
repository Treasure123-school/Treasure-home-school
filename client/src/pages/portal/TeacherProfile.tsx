import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { User, Mail, Phone, MapPin, Save, Edit, Camera, GraduationCap, BookOpen, Users, CheckCircle, Clock, Award, FileText, Pen, X, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
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
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2"
                data-testid="button-save-changes"
              >
                <Save className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Profile Completion Banner — unified design matching student portal */}
      {!isLoading && teacherProfile && (() => {
        const bannerFields = [
          { key: 'phone',           label: 'Phone Number',      filled: !!teacherProfile.phone },
          { key: 'gender',          label: 'Gender',            filled: !!teacherProfile.gender },
          { key: 'dateOfBirth',     label: 'Date of Birth',     filled: !!teacherProfile.dateOfBirth },
          { key: 'nationalId',      label: 'National ID (NIN)', filled: !!teacherProfile.nationalId },
          { key: 'profileImageUrl', label: 'Profile Photo',     filled: !!teacherProfile.profileImageUrl },
          { key: 'staffId',         label: 'Staff ID',          filled: !!teacherProfile.staffId },
          { key: 'qualification',   label: 'Qualification',     filled: !!teacherProfile.qualification },
          { key: 'department',      label: 'Department',        filled: !!teacherProfile.department },
        ];
        const filledCount = bannerFields.filter(f => f.filled).length;
        const pct = Math.round((filledCount / bannerFields.length) * 100);
        const allDone = filledCount === bannerFields.length;

        if (allDone) {
          return (
            <div className="rounded-xl border border-green-200 dark:border-green-800/60 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 px-5 py-3 flex items-center gap-3 shadow-sm animate-in fade-in duration-500" data-testid="profile-complete-banner">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-200 text-sm">Profile complete!</p>
                <p className="text-xs text-green-700 dark:text-green-300/90">All key fields are filled. Your profile is fully set up.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-3 duration-500" data-testid="profile-completion-banner">
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-full p-2 mt-0.5">
                  <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm sm:text-base" data-testid="text-completion-title">
                    Complete your profile — {pct}% done ({filledCount} of {bannerFields.length} fields)
                  </p>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300/90 mt-0.5">
                    Fill in the fields below to get the most out of your teacher profile.
                  </p>
                </div>
              </div>
              <Progress value={pct} className="h-2 mb-3 bg-blue-100 dark:bg-blue-900/40" data-testid="progress-completion" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {bannerFields.map(field => (
                  <div key={field.key} className="flex items-center gap-2 py-0.5">
                    {field.filled ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500 dark:text-green-400" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 flex-shrink-0 text-blue-400 dark:text-blue-500" />
                    )}
                    <span className={`text-xs font-medium ${field.filled ? 'text-green-700 dark:text-green-400 line-through decoration-green-400/70' : 'text-blue-800 dark:text-blue-200'}`}>
                      {field.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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