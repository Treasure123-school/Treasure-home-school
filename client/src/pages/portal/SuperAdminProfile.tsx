import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getApiUrl } from '@/config/api';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, User, Shield, Camera, X, Pen } from "lucide-react";
import { ChangePasswordLinkCard } from "@/components/ChangePasswordCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCapture } from "@/components/ui/image-capture";
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

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
}

export default function SuperAdminProfile() {
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/users/${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditing(false);
    },
  });

  const handleProfileUpdate = async () => {
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

      // Update profile data in backend
      await updateProfileMutation.mutateAsync({
        ...profileData,
        profileImageUrl: updatedProfileImageUrl
      });

      setProfileImageFile(null);
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
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

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white flex items-center gap-2" data-testid="text-page-title">
            <User className="h-7 w-7 shrink-0" />
            My Profile
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            Manage your account information
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleProfileUpdate} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Pen className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview Card */}
          <Card className="lg:col-span-1 dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="dark:text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Overview
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
                        existingImageUrl={user?.profileImageUrl}
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
                        <AvatarImage src={user?.profileImageUrl} />
                        <AvatarFallback className="text-lg">
                          {(user?.firstName || 'S')[0]}{(user?.lastName || 'A')[0]}
                        </AvatarFallback>
                      </Avatar>
                    </>
                  )}
                  <h3 className="text-lg font-semibold dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-muted-foreground">Super Admin</p>
                </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium dark:text-slate-200">Super Admin ID</p>
                    <p className="text-sm text-muted-foreground">{user?.username || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="lg:col-span-2 dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username" className="dark:text-slate-200">Username (Login ID)</Label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    value={user?.username || ""}
                    disabled
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Your login username cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="dark:text-slate-200">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    placeholder="Enter your email address"
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="dark:text-slate-200">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    data-testid="input-first-name"
                    value={profileData.firstName}
                    onChange={(e) => { setProfileData({ ...profileData, firstName: e.target.value }); if (formErrors.firstName) setFormErrors(p => ({ ...p, firstName: undefined })); }}
                    className={`dark:bg-slate-900 dark:border-slate-700 dark:text-white${formErrors.firstName ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                    disabled={!isEditing}
                  />
                  {formErrors.firstName && <p className="text-xs text-destructive">{formErrors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="dark:text-slate-200">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    data-testid="input-last-name"
                    value={profileData.lastName}
                    onChange={(e) => { setProfileData({ ...profileData, lastName: e.target.value }); if (formErrors.lastName) setFormErrors(p => ({ ...p, lastName: undefined })); }}
                    className={`dark:bg-slate-900 dark:border-slate-700 dark:text-white${formErrors.lastName ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                    disabled={!isEditing}
                  />
                  {formErrors.lastName && <p className="text-xs text-destructive">{formErrors.lastName}</p>}
                </div>
              </div>
              {isEditing && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleProfileUpdate}
                    disabled={isSaving}
                    data-testid="button-save-profile"
                    className="w-full sm:w-auto"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password */}
          <div className="lg:col-span-3">
            <ChangePasswordLinkCard href="/portal/superadmin/change-password" />
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
