import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Save, Loader2, Plus, Edit, Trash2, Info, Hash, Mail, Phone, Globe, MapPin, X,
} from 'lucide-react';
import { SystemSettings } from './types';
import { parseJsonArray, stringToSchoolPhone, emailsToJsonString, countryCodes } from './helpers';
import { useAdminSettings } from './useSettings';
import { SettingCard, ReadOnlyField, SectionSkeleton } from './components';
// SECTION: School Profile
// ─────────────────────────────────────────────
interface ProfileForm {
  schoolName: string; schoolShortName: string; schoolMotto: string;
  schoolAddress: string; schoolPhones: string[]; schoolEmails: string[];
  websiteTitle: string; footerText: string;
}

function buildProfileForm(s?: SystemSettings): ProfileForm {
  return {
    schoolName: s?.schoolName || '',
    schoolShortName: s?.schoolShortName || '',
    schoolMotto: s?.schoolMotto || '',
    schoolAddress: s?.schoolAddress || '',
    schoolPhones: parseJsonArray(s?.schoolPhones).length > 0 ? parseJsonArray(s?.schoolPhones) : [''],
    schoolEmails: parseJsonArray(s?.schoolEmails).length > 0 ? parseJsonArray(s?.schoolEmails) : [''],
    websiteTitle: s?.websiteTitle || '',
    footerText: s?.footerText || '',
  };
}

export default function SchoolProfileSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(buildProfileForm());
  const [original, setOriginal] = useState<ProfileForm>(buildProfileForm());
  const [phones, setPhones] = useState<Array<{ countryCode: string; number: string }>>([]);
  const [originalPhones, setOriginalPhones] = useState<Array<{ countryCode: string; number: string }>>([]);

  useEffect(() => {
    if (settings) {
      const f = buildProfileForm(settings);
      setForm(f);
      setOriginal(f);
      try {
        const parsed = JSON.parse(settings.schoolPhones || '[]');
        const phoneObjs = Array.isArray(parsed)
          ? parsed.map((p: any) => typeof p === 'object' && p.countryCode
              ? p
              : stringToSchoolPhone(String(p)))
          : [];
        setPhones(phoneObjs);
        setOriginalPhones(phoneObjs);
      } catch {
        setPhones([]);
        setOriginalPhones([]);
      }
    }
  }, [settings]);

  const addPhone = () => setPhones(prev => [...prev, { countryCode: '+234', number: '' }]);
  const removePhone = (i: number) => setPhones(prev => prev.filter((_, j) => j !== i));
  const updatePhone = (i: number, field: 'countryCode' | 'number', value: string) =>
    setPhones(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p));

  const addEmail = () => setForm(prev => ({ ...prev, schoolEmails: [...prev.schoolEmails, ''] }));
  const removeEmail = (i: number) => setForm(prev => ({ ...prev, schoolEmails: prev.schoolEmails.filter((_, j) => j !== i) }));
  const updateEmail = (i: number, value: string) => setForm(prev => ({ ...prev, schoolEmails: prev.schoolEmails.map((e, j) => j === i ? value : e) }));

  const handleSave = async () => {
    await save.mutateAsync({
      schoolName: form.schoolName,
      schoolShortName: form.schoolShortName,
      schoolMotto: form.schoolMotto,
      schoolAddress: form.schoolAddress,
      schoolPhones: JSON.stringify(phones),
      schoolEmails: emailsToJsonString(form.schoolEmails),
      websiteTitle: form.websiteTitle,
      footerText: form.footerText,
    });
    setOriginal(form);
    setOriginalPhones(phones);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setForm(original);
    setPhones(originalPhones);
    setIsEditing(false);
  };

  const f = (key: keyof Pick<ProfileForm, 'schoolName' | 'schoolShortName' | 'schoolMotto' | 'schoolAddress' | 'websiteTitle' | 'footerText'>) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isEditing ? 'Make your changes below, then save.' : 'Click Edit to update school information.'}
        </p>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={save.isPending} data-testid="button-cancel-profile">
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={save.isPending} data-testid="button-save-school-profile">
                {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* Identity card */}
      <SettingCard title="Identity" description="School name, abbreviation and motto" icon={Building2}>
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School Name *</Label>
                <Input id="schoolName" {...f('schoolName')} data-testid="input-school-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schoolShortName">Short Name / Abbreviation</Label>
                <Input id="schoolShortName" placeholder="e.g. THS" {...f('schoolShortName')} data-testid="input-school-short-name" />
              </div>
            </div>
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="schoolMotto">School Motto</Label>
              <Input id="schoolMotto" placeholder="e.g. Honesty and Success" {...f('schoolMotto')} data-testid="input-school-motto" />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReadOnlyField label="School Name" value={form.schoolName} icon={Building2} />
            <ReadOnlyField label="Short Name" value={form.schoolShortName} icon={Hash} />
            <ReadOnlyField label="Motto" value={form.schoolMotto} icon={Info} />
          </div>
        )}
      </SettingCard>

      {/* Location */}
      <SettingCard title="Location" description="Physical address of the school" icon={MapPin}>
        {isEditing ? (
          <div className="space-y-1.5">
            <Label htmlFor="schoolAddress">Full Address</Label>
            <Textarea id="schoolAddress" rows={2} {...f('schoolAddress')} data-testid="textarea-school-address" />
          </div>
        ) : (
          <ReadOnlyField label="Address" value={form.schoolAddress} icon={MapPin} />
        )}
      </SettingCard>

      {/* Contact details */}
      <SettingCard title="Contact Details" description="Phone numbers and email addresses" icon={Phone}>
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Phone Numbers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone Numbers
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addPhone} data-testid="button-add-phone">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {phones.map((phone, index) => (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={phone.countryCode}
                      onValueChange={(val) => updatePhone(index, 'countryCode', val)}
                    >
                      <SelectTrigger className="w-[100px]" data-testid={`select-country-code-${index}`}>
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryCodes.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={phone.number}
                      onChange={(e) => updatePhone(index, 'number', e.target.value)}
                      placeholder="Number"
                      className="flex-1"
                      data-testid={`input-phone-${index}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhone(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-remove-phone-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {phones.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No phone numbers added.</p>
                )}
              </div>
            </div>

            {/* Email Addresses */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Addresses
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addEmail} data-testid="button-add-email">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {form.schoolEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="Email Address"
                      className="flex-1"
                      data-testid={`input-email-${index}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmail(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-remove-email-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.schoolEmails.filter(Boolean).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No email addresses added.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2"><Phone className="w-3 h-3" /> Phone Numbers</p>
              {form.schoolPhones.filter(Boolean).length > 0 ? (
                <ul className="space-y-1">
                  {form.schoolPhones.filter(Boolean).map((p, i) => (
                    <li key={i} className="text-sm font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2"><Mail className="w-3 h-3" /> Email Addresses</p>
              {form.schoolEmails.filter(Boolean).length > 0 ? (
                <ul className="space-y-1">
                  {form.schoolEmails.filter(Boolean).map((e, i) => (
                    <li key={i} className="text-sm font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{e}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
        )}
      </SettingCard>

      {/* Website */}
      <SettingCard title="Website & Portal" description="Website title and footer text shown on the school portal" icon={Globe}>
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="websiteTitle">Website Title</Label>
              <Input id="websiteTitle" placeholder="e.g. Treasure-Home School Portal" {...f('websiteTitle')} data-testid="input-website-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="footerText">Footer Text</Label>
              <Input id="footerText" placeholder="e.g. © 2025 Treasure-Home School" {...f('footerText')} data-testid="input-footer-text" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadOnlyField label="Website Title" value={form.websiteTitle} icon={Globe} />
            <ReadOnlyField label="Footer Text" value={form.footerText} icon={Globe} />
          </div>
        )}
      </SettingCard>
    </div>
  );
}
