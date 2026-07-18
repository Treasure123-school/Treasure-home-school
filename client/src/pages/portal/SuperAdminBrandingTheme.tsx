import { useState, useEffect, useRef } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { getApiUrl } from "@/config/api";
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

  // Pending upload states — holds the newly uploaded URL before "Save" is clicked.
  // These are separate from formData so that cancelling discards them cleanly.
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingFaviconUrl, setPendingFaviconUrl] = useState<string | null>(null);

  // After a successful save we have the confirmed data in hand already.
  // This ref prevents the useEffect from overwriting formData with stale
  // query data before the background refetch has completed.
  const justSavedDataRef = useRef<typeof formData | null>(null);

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("uploadType", "logo");
      fd.append("file", file);
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        const errorText = await res.text();
        let message = "Upload failed";
        try { message = JSON.parse(errorText).message || message; } catch {}
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Only show a preview — do NOT save to DB yet, do NOT update any public query cache.
      setPendingLogoUrl(data.url);
      setFormData(prev => ({ ...prev, schoolLogo: data.url }));
      toast({ title: "Success", description: "Logo ready — click 'Save Changes' to apply it." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Error uploading logo.", variant: "destructive" });
    }
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("uploadType", "favicon");
      fd.append("file", file);
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        body: fd,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        const errorText = await res.text();
        let message = "Upload failed";
        try { message = JSON.parse(errorText).message || message; } catch {}
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Only show a preview — do NOT update browser favicon tab yet.
      setPendingFaviconUrl(data.url);
      setFormData(prev => ({ ...prev, favicon: data.url }));
      toast({ title: "Success", description: "Favicon ready — click 'Save Changes' to apply it." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Error uploading favicon.", variant: "destructive" });
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

  const handleCancel = () => {
    // Discard pending uploads and revert form to last confirmed settings
    setPendingLogoUrl(null);
    setPendingFaviconUrl(null);
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
    setIsEditing(false);
  };

  // Populate form from server data — but ONLY when not actively editing and
  // there is no just-saved data in the ref (to avoid race-condition overwrites).
  useEffect(() => {
    if (settings && !isEditing) {
      if (justSavedDataRef.current) {
        // A save just completed; use the confirmed saved data, not the potentially
        // stale refetch. Clear the ref so future refetches flow through normally.
        setFormData(justSavedDataRef.current);
        justSavedDataRef.current = null;
      } else {
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
    }
  }, [settings, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", "/api/superadmin/settings", data);
      return res.json();
    },
    onSuccess: (savedData: any) => {
      const confirmed = {
        schoolName: savedData.schoolName || "",
        schoolLogo: savedData.schoolLogo || "",
        favicon: savedData.favicon || "",
        primaryColor: savedData.primaryColor || "#3b82f6",
        secondaryColor: savedData.secondaryColor || "#1e293b",
        defaultTheme: savedData.defaultTheme || "light",
        loginPageText: savedData.loginPageText || "",
        dashboardWelcomeMessage: savedData.dashboardWelcomeMessage || ""
      };

      // Store in ref BEFORE setIsEditing so the useEffect sees it
      justSavedDataRef.current = confirmed;

      // Apply favicon to browser tab NOW that the save is confirmed
      if (confirmed.favicon) {
        applyFaviconToDOM(confirmed.favicon);
      }

      // Apply brand color immediately — no need to wait for the refetch
      if (confirmed.primaryColor) {
        applyBrandColorNow(confirmed.primaryColor);
      }

      // Clear pending states — they are now persisted
      setPendingLogoUrl(null);
      setPendingFaviconUrl(null);

      toast({ title: "Success", description: "Branding and theme settings saved." });

      // Force-refetch both settings queries so BrandColorSync and the rest of
      // the app stay in sync (refetchQueries bypasses staleTime).
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.refetchQueries({ queryKey: ["/api/public/settings"] });

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
                <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Changes"}
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
              <ImageIcon className="h-5 w-5 text-primary" />
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
                    <div className="relative">
                      <img src={formData.schoolLogo} alt="School Logo" className="h-24 w-auto object-contain" />
                      {pendingLogoUrl && (
                        <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          PENDING
                        </span>
                      )}
                    </div>
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
                  {pendingLogoUrl && isEditing && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                      New logo staged — click Save Changes to apply.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Favicon</Label>
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                  {formData.favicon ? (
                    <div className="relative">
                      <img src={formData.favicon} alt="Favicon" className="h-12 w-12 object-contain" />
                      {pendingFaviconUrl && (
                        <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          PENDING
                        </span>
                      )}
                    </div>
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
                  {pendingFaviconUrl && isEditing && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                      New favicon staged — click Save Changes to apply.
                    </p>
                  )}
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
              {/* Primary Color */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Brand / Primary Color</Label>
                <p className="text-xs text-muted-foreground -mt-1">Used for buttons, links, badges, and highlights across the entire portal.</p>
                <div className="flex gap-3 items-center">
                  <label
                    className={`relative h-10 w-10 rounded-lg border shadow-sm overflow-hidden shrink-0 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary transition-all' : 'cursor-not-allowed opacity-60'}`}
                    title={isEditing ? 'Click to open color picker' : 'Enable editing to change color'}
                  >
                    <div className="absolute inset-0" style={{ backgroundColor: formData.primaryColor }} />
                    <input
                      type="color"
                      disabled={!isEditing}
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                    />
                  </label>
                  <Input
                    disabled={!isEditing}
                    value={formData.primaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#([0-9a-fA-F]{0,6})$/.test(v)) setFormData({...formData, primaryColor: v});
                    }}
                    placeholder="#3b82f6"
                    className="flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
                {isEditing && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['#3b82f6','#2563eb','#1d4ed8','#0ea5e9','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#14b8a6'].map(c => (
                      <button
                        key={c}
                        onClick={() => setFormData({...formData, primaryColor: c})}
                        title={c}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${formData.primaryColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Secondary Color */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Secondary / Accent Color</Label>
                <p className="text-xs text-muted-foreground -mt-1">Used for secondary buttons, badges, and subtle accents.</p>
                <div className="flex gap-3 items-center">
                  <label
                    className={`relative h-10 w-10 rounded-lg border shadow-sm overflow-hidden shrink-0 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary transition-all' : 'cursor-not-allowed opacity-60'}`}
                    title={isEditing ? 'Click to open color picker' : 'Enable editing to change color'}
                  >
                    <div className="absolute inset-0" style={{ backgroundColor: formData.secondaryColor }} />
                    <input
                      type="color"
                      disabled={!isEditing}
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                    />
                  </label>
                  <Input
                    disabled={!isEditing}
                    value={formData.secondaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#([0-9a-fA-F]{0,6})$/.test(v)) setFormData({...formData, secondaryColor: v});
                    }}
                    placeholder="#1e293b"
                    className="flex-1 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Live Preview */}
            {isEditing && (
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm" style={{ backgroundColor: formData.primaryColor }}>
                    Primary Button
                  </button>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium border-2 shadow-sm" style={{ borderColor: formData.primaryColor, color: formData.primaryColor }}>
                    Outline Button
                  </button>
                  <span className="px-2.5 py-1 rounded-full text-white text-xs font-medium" style={{ backgroundColor: formData.primaryColor }}>Badge</span>
                  <span className="text-sm font-medium" style={{ color: formData.primaryColor }}>Link text</span>
                  <div className="h-2 w-24 rounded-full" style={{ backgroundColor: formData.primaryColor + '33' }}>
                    <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: formData.primaryColor }} />
                  </div>
                </div>
              </div>
            )}

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

// Helper — updates all favicon <link> tags in the document head
function applyFaviconToDOM(url: string) {
  const links = document.querySelectorAll("link[rel*='icon']");
  links.forEach(l => { (l as HTMLLinkElement).href = url; });
  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  }
}

// Helper — converts hex to HSL and injects/updates the brand-color-sync <style> tag
function applyBrandColorNow(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return;
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  const lightHsl = `hsl(${hDeg}, ${sPct}%, ${lPct}%)`;
  const darkHsl = `hsl(${hDeg}, ${sPct}%, ${Math.min(lPct + 8, 88)}%)`;
  const styleId = 'brand-color-sync';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root {
      --primary: ${lightHsl} !important;
      --accent: ${lightHsl} !important;
      --ring: ${lightHsl} !important;
      --sidebar-primary: ${lightHsl} !important;
      --sidebar-ring: ${lightHsl} !important;
      --chart-1: ${lightHsl} !important;
    }
    .dark {
      --primary: ${darkHsl} !important;
      --accent: ${darkHsl} !important;
      --ring: ${darkHsl} !important;
      --sidebar-primary: ${darkHsl} !important;
      --sidebar-ring: ${darkHsl} !important;
      --chart-1: ${darkHsl} !important;
    }
  `;
}
