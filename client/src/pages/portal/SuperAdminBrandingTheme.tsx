import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Palette, 
  Image as ImageIcon, 
  Type, 
  Save, 
  Upload,
  Sun,
  Moon
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";

export default function SuperAdminBrandingTheme() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    schoolName: "",
    schoolLogo: "",
    favicon: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#1e293b",
    defaultTheme: "light",
    loginPageText: "",
    dashboardWelcomeMessage: ""
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("uploadType", "logo");
      formData.append("file", file);
      const res = await fetch("/api/superadmin/branding/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, schoolLogo: data.url }));
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/settings"] });
      toast({ title: "Logo Uploaded", description: "The school logo has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    }
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("uploadType", "favicon");
      formData.append("file", file);
      const res = await fetch("/api/superadmin/branding/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, favicon: data.url }));
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/settings"] });
      
      // Update favicon in DOM immediately
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = data.url;
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = data.url;
        document.head.appendChild(link);
      }
      
      toast({ title: "Favicon Uploaded", description: "The school favicon has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    }
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogoMutation.mutate(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFaviconMutation.mutate(file);
  };

  useEffect(() => {
    if (settings) {
      setFormData({
        schoolName: settings.schoolName || "",
        schoolLogo: settings.schoolLogo || "",
        favicon: settings.favicon || "",
        primaryColor: settings.primaryColor || "#3b82f6",
        secondaryColor: settings.secondaryColor || "#1e293b",
        defaultTheme: settings.defaultTheme || "light",
        loginPageText: settings.loginPageText || "",
        dashboardWelcomeMessage: settings.dashboardWelcomeMessage || ""
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create a copy to avoid mutating state
      const settingsToSave = { ...data };
      
      // Ensure we don't send local default paths if they were just placeholders
      // (though here they are legitimate URLs or empty strings)
      
      return apiRequest("PUT", "/api/superadmin/settings", settingsToSave);
    },
    onSuccess: () => {
      toast({ title: "Branding Updated", description: "Your branding and theme settings have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading branding settings...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Branding & Theme</h1>
            <p className="text-muted-foreground mt-1">Customize the visual identity of your school's portal.</p>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Branding</Button>
            )}
          </div>
        </div>

        {/* 1. SCHOOL BRANDING */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              School Branding
            </CardTitle>
            <CardDescription>Manage logos and the primary display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold">School Logo</Label>
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                  {formData.schoolLogo ? (
                    <img src={formData.schoolLogo} alt="School Logo" className="h-24 w-auto object-contain" />
                  ) : (
                    <div className="h-24 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="relative w-full">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={!isEditing || uploadLogoMutation.isPending}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!isEditing || uploadLogoMutation.isPending} 
                      className="w-full"
                      asChild
                    >
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Favicon</Label>
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                  {formData.favicon ? (
                    <img src={formData.favicon} alt="Favicon" className="h-12 w-12 object-contain" />
                  ) : (
                    <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="relative w-full">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleFaviconUpload}
                      disabled={!isEditing || uploadFaviconMutation.isPending}
                      className="hidden"
                      id="favicon-upload"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!isEditing || uploadFaviconMutation.isPending} 
                      className="w-full"
                      asChild
                    >
                      <label htmlFor="favicon-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadFaviconMutation.isPending ? "Uploading..." : "Upload Favicon"}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Display Name</Label>
              <Input 
                disabled={!isEditing}
                value={formData.schoolName}
                onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                placeholder="Enter school name as it appears in the portal"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. COLOR & THEME */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-600" />
              Colors & Theme
            </CardTitle>
            <CardDescription>Define the core color palette and default appearance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Primary Color</Label>
                <div className="flex gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg border shadow-sm" 
                    style={{ backgroundColor: formData.primaryColor }}
                  />
                  <Input 
                    disabled={!isEditing}
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Secondary Color</Label>
                <div className="flex gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg border shadow-sm" 
                    style={{ backgroundColor: formData.secondaryColor }}
                  />
                  <Input 
                    disabled={!isEditing}
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Default Portal Theme</Label>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={formData.defaultTheme === 'light' ? 'default' : 'outline'}
                  disabled={!isEditing}
                  onClick={() => setFormData({...formData, defaultTheme: 'light'})}
                  className="h-20 flex flex-col gap-2"
                >
                  <Sun className="h-5 w-5" />
                  Light Mode
                </Button>
                <Button
                  variant={formData.defaultTheme === 'dark' ? 'default' : 'outline'}
                  disabled={!isEditing}
                  onClick={() => setFormData({...formData, defaultTheme: 'dark'})}
                  className="h-20 flex flex-col gap-2"
                >
                  <Moon className="h-5 w-5" />
                  Dark Mode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. INTERFACE TEXT */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-teal-600" />
              Interface Text
            </CardTitle>
            <CardDescription>Customize the messages users see when interacting with the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Login Page Welcome Text</Label>
              <Input 
                disabled={!isEditing}
                value={formData.loginPageText}
                onChange={(e) => setFormData({...formData, loginPageText: e.target.value})}
                placeholder="e.g. Welcome to Treasure Home School Portal"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Dashboard Welcome Message</Label>
              <Input 
                disabled={!isEditing}
                value={formData.dashboardWelcomeMessage}
                onChange={(e) => setFormData({...formData, dashboardWelcomeMessage: e.target.value})}
                placeholder="e.g. Welcome back to your dashboard"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
