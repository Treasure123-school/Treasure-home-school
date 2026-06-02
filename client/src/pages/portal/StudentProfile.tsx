import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChangePasswordLinkCard } from '@/components/ChangePasswordCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/config/api';
import { apiRequest } from '@/lib/queryClient';
import { User, Mail, Phone, MapPin, Calendar, School, Save, Edit, BookOpen, CheckCircle2, Circle, ShieldAlert, HeartPulse, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'wouter';
import React, { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCapture } from '@/components/ui/image-capture';
import { useToast } from '@/hooks/use-toast';
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
  const [formErrors, setFormErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalInfo: '',
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

  React.useEffect(() => {
    if (student) {
      setProfileData({
        firstName: student.firstName || user.firstName || '',
        lastName: student.lastName || user.lastName || '',
        email: student.email || user.email || '',
        phone: student.phone || '',
        address: student.address || '',
        dateOfBirth: student.dateOfBirth
          ? new Date(student.dateOfBirth).toISOString().split('T')[0]
          : '',
        gender: student.gender || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
        medicalInfo: student.medicalInfo || '',
        recoveryEmail: student.recoveryEmail || user.recoveryEmail || ''
      });
    }
  }, [student, user]);

  const trackedFields = useMemo(() => [
    { key: 'phone',            label: 'Phone Number',           value: student?.phone },
    { key: 'address',          label: 'Home Address',           value: student?.address },
    { key: 'dateOfBirth',      label: 'Date of Birth',          value: student?.dateOfBirth },
    { key: 'gender',           label: 'Gender',                 value: student?.gender },
    { key: 'emergencyContact', label: 'Emergency Contact Name', value: student?.emergencyContact },
    { key: 'medicalInfo',      label: 'Medical Information',    value: student?.medicalInfo },
    { key: 'profileImageUrl',  label: 'Profile Photo',          value: student?.profileImageUrl || user?.profileImageUrl },
  ], [student, user]);

  const missingFields = useMemo(() => trackedFields.filter(f => !f.value), [trackedFields]);
  const completedCount = trackedFields.length - missingFields.length;
  const completionPct = Math.round((completedCount / trackedFields.length) * 100);
  const isComplete = missingFields.length === 0;

  const handleRemoveImage = async () => {
    try {
      const response = await apiRequest('DELETE', '/api/upload/profile');
      if (!response.ok) throw new Error('Failed to remove image');
      toast({ title: "Profile image removed", description: "Your profile image has been removed successfully." });
      updateUser({ profileImageUrl: undefined });
      const cached = queryClient.getQueryData<any>(['student', user.id]);
      if (cached) {
        queryClient.setQueryData(['student', user.id], { ...cached, profileImageUrl: null });
      }
      queryClient.invalidateQueries({ queryKey: ['student', user.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({ title: "Removal Failed", description: error?.message || "Could not remove profile image. Please try again.", variant: "destructive" });
    } finally {
      setShowRemoveConfirm(false);
    }
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
      let updatedProfileImageUrl = user?.profileImageUrl;

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
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        if (!uploadResponse.ok) throw new Error('Failed to upload profile image');
        const uploadResult = await uploadResponse.json();
        updatedProfileImageUrl = uploadResult.url;
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

      toast({ title: "Profile Updated", description: "Your profile has been updated successfully." });
      setProfileImageFile(null);
      setIsEditing(false);

      // Immediately patch the cached student data so gates and banners update
      // without waiting for a server round-trip. The invalidate below will then
      // sync the full authoritative payload in the background.
      const cached = queryClient.getQueryData<any>(['student', user.id]);
      if (cached) {
        queryClient.setQueryData(['student', user.id], {
          ...cached,
          phone: profileData.phone,
          address: profileData.address,
          gender: profileData.gender,
          dateOfBirth: profileData.dateOfBirth,
          emergencyContact: profileData.emergencyContact,
          emergencyPhone: profileData.emergencyPhone,
          medicalInfo: profileData.medicalInfo,
          recoveryEmail: profileData.recoveryEmail,
          profileImageUrl: updatedProfileImageUrl,
        });
      }

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
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground text-sm sm:text-base">View and manage your personal information</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
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

        {/* ── Profile Completion Banner ── */}
        {!isLoading && !isComplete && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-3 duration-500" data-testid="profile-completion-banner">
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-full p-2 mt-0.5">
                  <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm sm:text-base">
                    Complete your profile — {completionPct}% done ({completedCount} of {trackedFields.length} fields)
                  </p>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300/90 mt-0.5">
                    Fill in the fields below to unlock exams, report cards, and all academic features.
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <Progress
                value={completionPct}
                className="h-2 mb-3 bg-blue-100 dark:bg-blue-900/40"
              />

              {/* Missing fields checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {trackedFields.map(field => {
                  const filled = !!field.value;
                  return (
                    <div key={field.key} className="flex items-center gap-2 py-0.5">
                      {filled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500 dark:text-green-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 flex-shrink-0 text-blue-400 dark:text-blue-500" />
                      )}
                      <span className={`text-xs font-medium ${filled ? 'text-green-700 dark:text-green-400 line-through decoration-green-400/70' : 'text-blue-800 dark:text-blue-200'}`}>
                        {field.label}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* Profile complete success state */}
        {!isLoading && isComplete && (
          <div className="rounded-xl border border-green-200 dark:border-green-800/60 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 px-5 py-3 flex items-center gap-3 shadow-sm animate-in fade-in duration-500" data-testid="profile-complete-banner">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-200 text-sm">Profile complete!</p>
              <p className="text-xs text-green-700 dark:text-green-300/90">All required fields are filled. You have full access to all features.</p>
            </div>
          </div>
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
                    <Avatar className="h-24 w-24 mx-auto mb-4">
                      <AvatarImage src={user?.profileImageUrl || student?.profileImage} />
                      <AvatarFallback className="text-lg">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
                  <p className="text-muted-foreground">Student</p>
                </div>

                <div className="space-y-3">
                  {student?.admissionNumber && (
                    <div className="flex items-center space-x-3">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Admission Number</p>
                        <p className="text-sm text-muted-foreground font-mono" data-testid="text-admission-number-profile">{student.admissionNumber}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Student ID</p>
                      <p className="text-sm text-muted-foreground">{user.username || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Date of Birth</p>
                      <p className="text-sm text-muted-foreground">
                        {student?.dateOfBirth
                          ? new Date(student.dateOfBirth).toLocaleDateString()
                          : 'Not provided'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Gender</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {student?.gender || 'Not provided'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Class</p>
                      <p className="text-sm text-muted-foreground">{student?.className || 'Not assigned'}</p>
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
                    <Label htmlFor="firstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
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
                      value={profileData.lastName}
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
                      value={profileData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter your email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      Phone Number
                      {!student?.phone && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g. 08012345678"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">
                      Date of Birth
                      {!student?.dateOfBirth && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={profileData.dateOfBirth}
                      disabled
                      data-testid="input-date-of-birth"
                    />
                    <p className="text-xs text-muted-foreground">Contact an admin to update your date of birth.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">
                      Gender
                      {!student?.gender && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <Input
                      id="gender"
                      value={profileData.gender ? profileData.gender.replace(/_/g, ' ') : ''}
                      disabled
                      placeholder="Not provided"
                      className="capitalize"
                      data-testid="input-gender"
                    />
                    <p className="text-xs text-muted-foreground">Contact an admin to update your gender.</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">
                      Home Address
                      {!student?.address && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter your home address"
                      data-testid="input-address"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact & Medical */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HeartPulse className="h-5 w-5" />
                  <span>Emergency Contact &amp; Medical</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">
                      Emergency Contact Name
                      {!student?.emergencyContact && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <Input
                      id="emergencyContact"
                      value={profileData.emergencyContact}
                      onChange={(e) => handleChange('emergencyContact', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g. Mr. John Doe"
                      data-testid="input-emergency-contact"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      value={profileData.emergencyPhone}
                      onChange={(e) => handleChange('emergencyPhone', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g. 08012345678"
                      data-testid="input-emergency-phone"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="medicalInfo">
                      Medical Information
                      {!student?.medicalInfo && <span className="ml-1 text-xs text-amber-600 font-normal">(required for completion)</span>}
                    </Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      List any known allergies, health conditions, or medications the school should know about.
                    </p>
                    <Textarea
                      id="medicalInfo"
                      value={profileData.medicalInfo}
                      onChange={(e) => handleChange('medicalInfo', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g. Allergic to penicillin. Asthmatic — inhaler kept in school bag."
                      rows={3}
                      data-testid="textarea-medical-info"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Security */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Account Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="recoveryEmail">
                      Recovery Email
                      <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Used to recover your account if you forget your password
                    </p>
                    <Input
                      id="recoveryEmail"
                      type="email"
                      value={profileData.recoveryEmail || ''}
                      onChange={(e) => handleChange('recoveryEmail', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter recovery email address"
                      data-testid="input-recovery-email"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {/* Change Password */}
        <ChangePasswordLinkCard href="/portal/student/change-password" />

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
