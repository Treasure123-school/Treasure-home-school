import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Key, User, Shield, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileUpload } from "@/components/ui/file-upload";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SuperAdminProfile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showImageUpload, setShowImageUpload] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/users/${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Password changed successfully" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  const handleProfileImageUpload = () => {
    toast({
      title: "Profile image updated",
      description: "Your profile image has been uploaded successfully.",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    setShowImageUpload(false);
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white flex items-center gap-2" data-testid="text-page-title">
            <User className="h-7 w-7" />
            My Profile
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            Manage your account information
          </p>
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
                <div className="relative inline-block">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="text-lg">
                      {(user?.firstName || 'S')[0]}{(user?.lastName || 'A')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => setShowImageUpload(!showImageUpload)}
                    data-testid="profile-image-upload-button"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="text-lg font-semibold dark:text-white">
                  {user?.firstName} {user?.lastName}
                </h3>
                <p className="text-muted-foreground">Super Admin</p>

                {showImageUpload && user && (
                  <div className="mt-4">
                    <FileUpload
                      type="profile"
                      userId={user.id}
                      onUploadSuccess={handleProfileImageUpload}
                      className="max-w-sm mx-auto"
                    />
                  </div>
                )}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="dark:text-slate-200">First Name</Label>
                  <Input
                    id="firstName"
                    data-testid="input-first-name"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="dark:text-slate-200">Last Name</Label>
                  <Input
                    id="lastName"
                    data-testid="input-last-name"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleProfileUpdate}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="lg:col-span-3 dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="dark:text-white flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Update your login password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="dark:text-slate-200">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    data-testid="input-current-password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="dark:text-slate-200">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    data-testid="input-new-password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="dark:text-slate-200">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    data-testid="input-confirm-password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handlePasswordChange}
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                  className="w-full sm:w-auto"
                >
                  <Key className="mr-2 h-4 w-4" />
                  {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
