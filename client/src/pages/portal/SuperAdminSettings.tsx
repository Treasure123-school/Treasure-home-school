import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  X,
  Plus,
  Phone,
  Mail,
  Trash2,
  UserCheck,
  CheckCircle2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SystemSettings } from "@shared/schema";

const countryCodes = [
  { code: "+234", name: "Nigeria" },
  { code: "+1", name: "USA/Canada" },
  { code: "+44", name: "UK" },
  { code: "+233", name: "Ghana" },
  { code: "+254", name: "Kenya" },
  { code: "+27", name: "South Africa" },
];

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  // Principal designation (uses shared leadership endpoint — also accessible to School Admin)
  const { data: principalData, isLoading: principalLoading } = useQuery<{
    designatedPrincipalId: string | null;
    admins: Array<{ id: string; name: string; username: string; hasSignature: boolean }>;
    currentPrincipal: { id: string; name: string; username: string; hasSignature: boolean } | null;
  }>({
    queryKey: ["/api/leadership/principal"],
  });

  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string>("");

  useEffect(() => {
    if (principalData) {
      setSelectedPrincipalId(principalData.designatedPrincipalId || "");
    }
  }, [principalData]);

  const designatePrincipalMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("PUT", "/api/leadership/principal", { designatedPrincipalId: id || null }),
    onSuccess: () => {
      toast({ title: "Success", description: "School principal designation updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/leadership/principal"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
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

  const [phones, setPhones] = useState<Array<{ countryCode: string; number: string }>>([]);
  const [emails, setEmails] = useState<string[]>([]);

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

      try {
        setPhones(JSON.parse(settings.schoolPhones || "[]"));
        setEmails(JSON.parse(settings.schoolEmails || "[]"));
      } catch (e) {
        console.error("Error parsing settings JSON", e);
        setPhones([]);
        setEmails([]);
      }
    }
  }, [settings]);

  const addPhone = () => {
    setPhones([...phones, { countryCode: "+234", number: "" }]);
  };

  const removePhone = (index: number) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const updatePhone = (index: number, field: "countryCode" | "number", value: string) => {
    const newPhones = [...phones];
    newPhones[index] = { ...newPhones[index], [field]: value };
    setPhones(newPhones);
  };

  const addEmail = () => {
    setEmails([...emails, ""]);
  };

  const removeEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const finalData = {
        ...data,
        schoolPhones: JSON.stringify(phones),
        schoolEmails: JSON.stringify(emails)
      };
      return apiRequest("PUT", "/api/superadmin/settings", finalData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "School configuration saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/settings"] });
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
              <Building2 className="h-5 w-5 text-primary" />
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
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">School Motto</Label>
                    <Input 
                      disabled={!isEditing}
                      value={formData.schoolMotto}
                      onChange={(e) => setFormData({...formData, schoolMotto: e.target.value})}
                    />
                  </div>
                </div>
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Numbers
                  </Label>
                  {isEditing && (
                    <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {phones.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Select
                        disabled={!isEditing}
                        value={phone.countryCode}
                        onValueChange={(val) => updatePhone(index, "countryCode", val)}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryCodes.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        disabled={!isEditing}
                        value={phone.number}
                        onChange={(e) => updatePhone(index, "number", e.target.value)}
                        placeholder="Number"
                        className="flex-1"
                      />
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removePhone(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {phones.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No phone numbers added.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email Addresses
                  </Label>
                  {isEditing && (
                    <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        disabled={!isEditing}
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="Email Address"
                        className="flex-1"
                      />
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeEmail(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {emails.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No email addresses added.</p>
                  )}
                </div>
              </div>
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

        {/* 5. DESIGNATE PRINCIPAL */}
        <Card className="shadow-sm border-primary/20 dark:border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Designate School Principal
            </CardTitle>
            <CardDescription>
              Choose which admin account is the official school principal. Their name and signature will appear on all report cards.
              If no one is designated, the system falls back to the first admin with a signature on file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {principalLoading ? (
              <p className="text-sm text-muted-foreground">Loading admin accounts…</p>
            ) : (principalData?.admins?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No admin accounts found. Create an admin user first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Principal</Label>
                  <div className="flex gap-3 items-center">
                    <Select
                      value={selectedPrincipalId}
                      onValueChange={setSelectedPrincipalId}
                    >
                      <SelectTrigger className="w-full max-w-xs" data-testid="select-principal">
                        <SelectValue placeholder="— Select an admin —" />
                      </SelectTrigger>
                      <SelectContent>
                        {principalData?.admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id} data-testid={`option-principal-${admin.id}`}>
                            {admin.name || admin.username}
                            <span className="ml-2 text-muted-foreground text-xs">(@{admin.username})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => designatePrincipalMutation.mutate(selectedPrincipalId)}
                      disabled={designatePrincipalMutation.isPending || selectedPrincipalId === (principalData?.designatedPrincipalId || "")}
                      data-testid="button-save-principal"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {designatePrincipalMutation.isPending ? "Saving…" : "Confirm"}
                    </Button>
                  </div>
                </div>

                {principalData?.designatedPrincipalId && (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Current principal:{" "}
                      <span className="font-semibold">
                        {principalData.admins.find(a => a.id === principalData.designatedPrincipalId)?.name ||
                          principalData.admins.find(a => a.id === principalData.designatedPrincipalId)?.username ||
                          "Unknown"}
                      </span>
                    </span>
                  </div>
                )}

                {!principalData?.designatedPrincipalId && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                    No principal designated yet. The system will use the first admin with a saved signature.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
