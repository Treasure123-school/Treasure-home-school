import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Building2, 
  Settings as SettingsIcon, 
  AlertTriangle, 
  Copyright,
  Save,
  Globe,
  MapPin,
  Clock,
  Languages,
  CalendarDays,
  Upload,
  X
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    schoolName: "",
    schoolShortName: "",
    schoolMotto: "",
    schoolAddress: "",
    schoolPhones: "[]",
    schoolEmails: "[]",
    portalName: "Treasure Home School Portal",
    timezone: "Africa/Lagos",
    language: "en",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    maintenanceMode: false,
    maintenanceModeMessage: "",
    footerText: "",
    schoolLogo: "",
    favicon: ""
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        schoolName: settings.schoolName || "",
        schoolShortName: settings.schoolShortName || "",
        schoolMotto: settings.schoolMotto || "",
        schoolAddress: settings.schoolAddress || "",
        schoolPhones: settings.schoolPhones || "[]",
        schoolEmails: settings.schoolEmails || "[]",
        portalName: settings.portalName || "Treasure Home School Portal",
        timezone: settings.timezone || "Africa/Lagos",
        language: settings.language || "en",
        dateFormat: settings.dateFormat || "DD/MM/YYYY",
        timeFormat: settings.timeFormat || "HH:mm",
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceModeMessage: settings.maintenanceModeMessage || "",
        footerText: settings.footerText || "",
        schoolLogo: settings.schoolLogo || "",
        favicon: settings.favicon || ""
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Configuration Saved", description: "General configuration has been successfully updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/settings"] });
      
      // Update favicon in the browser immediately if it changed
      if (formData.favicon) {
        const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (link) {
          link.href = formData.favicon;
        } else {
          const newLink = document.createElement('link');
          newLink.rel = 'icon';
          newLink.href = formData.favicon;
          document.head.appendChild(newLink);
        }
      }
      
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading configuration...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">General Configuration</h1>
            <p className="text-muted-foreground mt-1">Manage global system identity and core behavior.</p>
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
              <Button onClick={() => setIsEditing(true)}>Edit Configuration</Button>
            )}
          </div>
        </div>

        {/* 1. SCHOOL INFORMATION */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              School Information
            </CardTitle>
            <CardDescription>Fundamental details about the educational institution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Full Name</Label>
                    <Input 
                      disabled={!isEditing}
                      value={formData.schoolName}
                      onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Short Name / Acronym</Label>
                    <Input 
                      disabled={!isEditing}
                      value={formData.schoolShortName}
                      onChange={(e) => setFormData({...formData, schoolShortName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">School Motto</Label>
                  <Input 
                    disabled={!isEditing}
                    value={formData.schoolMotto}
                    onChange={(e) => setFormData({...formData, schoolMotto: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">School Logo</Label>
                    <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50 relative group">
                      {formData.schoolLogo ? (
                        <>
                          <img src={formData.schoolLogo} alt="School Logo" className="h-20 w-auto object-contain" />
                          {isEditing && (
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                              onClick={() => setFormData({...formData, schoolLogo: ""})}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <Building2 className="h-8 w-8 text-muted-foreground opacity-20" />
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">No Logo</p>
                        </div>
                      )}
                      {isEditing && (
                        <div className="w-full mt-2">
                          <Input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            id="logo-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const formDataUpload = new FormData();
                                formDataUpload.append("file", file);
                                formDataUpload.append("uploadType", "logo");
                                try {
                                  const res = await fetch("/api/superadmin/branding/upload", {
                                    method: "POST",
                                    body: formDataUpload
                                  });
                                  const data = await res.json();
                                  if (data.url) setFormData(prev => ({...prev, schoolLogo: data.url}));
                                } catch (err) {
                                  toast({ title: "Upload Failed", variant: "destructive" });
                                }
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full h-8 text-[11px] font-bold"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                          >
                            <Upload className="h-3 w-3 mr-2" />
                            Upload Logo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Favicon</Label>
                    <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50 relative group">
                      {formData.favicon ? (
                        <>
                          <img src={formData.favicon} alt="Favicon" className="h-10 w-10 object-contain" />
                          {isEditing && (
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                              onClick={() => setFormData({...formData, favicon: ""})}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <Globe className="h-8 w-8 text-muted-foreground opacity-20" />
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">No Favicon</p>
                        </div>
                      )}
                      {isEditing && (
                        <div className="w-full mt-2">
                          <Input 
                            type="file" 
                            accept="image/*"
                            className="hidden" 
                            id="favicon-upload"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const formDataUpload = new FormData();
                                formDataUpload.append("file", file);
                                formDataUpload.append("uploadType", "favicon");
                                try {
                                  const res = await fetch("/api/superadmin/branding/upload", {
                                    method: "POST",
                                    body: formDataUpload
                                  });
                                  const data = await res.json();
                                  if (data.url) setFormData(prev => ({...prev, favicon: data.url}));
                                } catch (err) {
                                  toast({ title: "Upload Failed", variant: "destructive" });
                                }
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full h-8 text-[11px] font-bold"
                            onClick={() => document.getElementById('favicon-upload')?.click()}
                          >
                            <Upload className="h-3 w-3 mr-2" />
                            Upload Fav
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">School Motto</Label>
              <Input 
                disabled={!isEditing}
                value={formData.schoolMotto}
                onChange={(e) => setFormData({...formData, schoolMotto: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Address
              </Label>
              <Textarea 
                disabled={!isEditing}
                value={formData.schoolAddress}
                onChange={(e) => setFormData({...formData, schoolAddress: e.target.value})}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. SYSTEM BASICS */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-slate-600" />
              System Basics
            </CardTitle>
            <CardDescription>Regional and localization settings for the portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Portal Name
              </Label>
              <Input 
                disabled={!isEditing}
                value={formData.portalName}
                onChange={(e) => setFormData({...formData, portalName: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Timezone
                </Label>
                <Input 
                  disabled={!isEditing}
                  value={formData.timezone}
                  readOnly
                  className="bg-slate-50 dark:bg-slate-900/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  Language
                </Label>
                <Input 
                  disabled={!isEditing}
                  value={formData.language}
                  readOnly
                  className="bg-slate-50 dark:bg-slate-900/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Date Format
                </Label>
                <Input 
                  disabled={!isEditing}
                  value={formData.dateFormat}
                  onChange={(e) => setFormData({...formData, dateFormat: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Time Format
                </Label>
                <Input 
                  disabled={!isEditing}
                  value={formData.timeFormat}
                  onChange={(e) => setFormData({...formData, timeFormat: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. SYSTEM CONTROL */}
        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              System Control
            </CardTitle>
            <CardDescription>Manage system availability and maintenance status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50/20 dark:bg-amber-950/10">
              <div className="space-y-0.5">
                <Label className="font-semibold">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Disables public access to the portal</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.maintenanceMode}
                onCheckedChange={(val) => setFormData({...formData, maintenanceMode: val})}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Maintenance Message</Label>
              <Textarea 
                disabled={!isEditing || !formData.maintenanceMode}
                value={formData.maintenanceModeMessage}
                onChange={(e) => setFormData({...formData, maintenanceModeMessage: e.target.value})}
                placeholder="Message users see during maintenance..."
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. FOOTER */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copyright className="h-5 w-5 text-slate-500" />
              Footer
            </CardTitle>
            <CardDescription>Text displayed at the bottom of the portal pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Copyright Text</Label>
              <Input 
                disabled={!isEditing}
                value={formData.footerText}
                onChange={(e) => setFormData({...formData, footerText: e.target.value})}
                placeholder="e.g. © 2026 Treasure Home School. All Rights Reserved."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
