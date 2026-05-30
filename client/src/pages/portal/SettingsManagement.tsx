import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Settings, Building2, GraduationCap, BarChart3, Users, ClipboardList,
  FileText, FileBarChart2, CalendarCheck, Bell, CreditCard, Palette,
  Shield, Database, Save, Loader2, Plus, Edit, Trash2, Info,
  ChevronRight, ChevronDown, Search, ExternalLink, Hash, Scale,
  Mail, Phone, Globe, MapPin, Key, AlertTriangle, CheckCircle,
  RefreshCw, Download, Upload, Lock, Eye, EyeOff, Percent, X
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface SystemSettings {
  id?: number;
  schoolName?: string;
  schoolShortName?: string;
  schoolMotto?: string;
  schoolLogo?: string;
  favicon?: string;
  schoolAddress?: string;
  schoolPhones?: string;
  schoolEmails?: string;
  websiteTitle?: string;
  footerText?: string;
  maintenanceMode?: boolean;
  enableSmsNotifications?: boolean;
  enableEmailNotifications?: boolean;
  enableExamsModule?: boolean;
  enableAttendanceModule?: boolean;
  enableResultsModule?: boolean;
  themeColor?: string;
  usernameStudentPrefix?: string;
  usernameParentPrefix?: string;
  usernameTeacherPrefix?: string;
  usernameAdminPrefix?: string;
  tempPasswordFormat?: string;
  hideAdminAccountsFromAdmins?: boolean;
  testWeight?: number;
  examWeight?: number;
  defaultGradingScale?: string;
  scoreAggregationMode?: string;
  autoCreateReportCard?: boolean;
  showGradeBreakdown?: boolean;
  allowTeacherOverrides?: boolean;
  positioningMethod?: string;
  requireExamPayment?: boolean;
  examFeeAmount?: number;
  designatedPrincipalId?: string | null;
}

interface GradingBoundary {
  id: number;
  name: string;
  grade: string;
  minScore: number;
  maxScore: number;
  remark?: string;
  gradePoint?: number;
  isDefault: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function arrayToJsonString(arr: string[]): string {
  return JSON.stringify(arr.filter(Boolean));
}

function commaSepToArray(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────
// Shared save hook
// ─────────────────────────────────────────────
function useAdminSettings() {
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/admin/settings'],
    staleTime: 30_000,
  });

  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => apiRequest('PUT', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/settings'] });
      toast({ title: 'Saved', description: 'Settings updated successfully.' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return { settings, isLoading, save: mutation };
}

// ─────────────────────────────────────────────
// SettingCard – consistent wrapper for each sub-card
// ─────────────────────────────────────────────
function SettingCard({ title, description, icon: Icon, children }: {
  title: string; description?: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// SwitchRow
// ─────────────────────────────────────────────
function SwitchRow({ id, label, description, checked, onCheckedChange }: {
  id: string; label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} data-testid={`switch-${id}`} />
    </div>
  );
}

// ─────────────────────────────────────────────
// MultiInput – add/remove items for phones, emails
// ─────────────────────────────────────────────
function MultiInput({ values, onChange, placeholder, icon: Icon, type = 'text' }: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  icon?: React.ElementType;
  type?: string;
}) {
  const updateAt = (i: number, val: string) => onChange(values.map((x, j) => j === i ? val : x));
  const removeAt = (i: number) => onChange(values.filter((_, j) => j !== i));
  const add = () => onChange([...values, '']);

  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
          <Input
            type={type}
            value={v}
            onChange={e => updateAt(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1"
            data-testid={`multi-input-${i}`}
          />
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeAt(i)}
            type="button"
            data-testid={`button-remove-item-${i}`}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" type="button" onClick={add} data-testid="button-add-item">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// ReadOnlyField – shows a label + value in view mode
// ─────────────────────────────────────────────
function ReadOnlyField({ label, value, icon: Icon, empty = '—' }: {
  label: string; value?: string | null; icon?: React.ElementType; empty?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </p>
      <p className="text-sm font-medium break-words">{value || empty}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// QuickLinkCard – for sections that primarily link elsewhere
// ─────────────────────────────────────────────
function QuickLinkCard({ title, description, icon: Icon, href }: {
  title: string; description: string; icon: React.ElementType; href: string;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className="w-full text-left flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/30 transition-all group"
      data-testid={`link-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────
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

function SchoolProfileSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(buildProfileForm());
  const [original, setOriginal] = useState<ProfileForm>(buildProfileForm());

  useEffect(() => {
    if (settings) {
      const f = buildProfileForm(settings);
      setForm(f);
      setOriginal(f);
    }
  }, [settings]);

  const handleSave = async () => {
    await save.mutateAsync({
      schoolName: form.schoolName,
      schoolShortName: form.schoolShortName,
      schoolMotto: form.schoolMotto,
      schoolAddress: form.schoolAddress,
      schoolPhones: arrayToJsonString(form.schoolPhones.filter(Boolean)),
      schoolEmails: arrayToJsonString(form.schoolEmails.filter(Boolean)),
      websiteTitle: form.websiteTitle,
      footerText: form.footerText,
    });
    setOriginal(form);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setForm(original);
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Numbers</Label>
              <MultiInput
                values={form.schoolPhones}
                onChange={v => setForm(p => ({ ...p, schoolPhones: v }))}
                placeholder="+234 801 234 5678"
                icon={Phone}
                type="tel"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Addresses</Label>
              <MultiInput
                values={form.schoolEmails}
                onChange={v => setForm(p => ({ ...p, schoolEmails: v }))}
                placeholder="admin@school.com"
                icon={Mail}
                type="email"
              />
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

// ─────────────────────────────────────────────
// SECTION: Academic Settings
// ─────────────────────────────────────────────
function AcademicSettingsSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [testWeight, setTestWeight] = useState(40);
  const [scoreAggregation, setScoreAggregation] = useState('last');
  const [autoCreateReportCard, setAutoCreateReportCard] = useState(true);
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(true);
  const [allowTeacherOverrides, setAllowTeacherOverrides] = useState(true);

  useEffect(() => {
    if (settings) {
      setTestWeight(settings.testWeight ?? 40);
      setScoreAggregation(settings.scoreAggregationMode || 'last');
      setAutoCreateReportCard(settings.autoCreateReportCard ?? true);
      setShowGradeBreakdown(settings.showGradeBreakdown ?? true);
      setAllowTeacherOverrides(settings.allowTeacherOverrides ?? true);
    }
  }, [settings]);

  const handleSave = () => {
    save.mutate({
      testWeight,
      examWeight: 100 - testWeight,
      scoreAggregationMode: scoreAggregation,
      autoCreateReportCard,
      showGradeBreakdown,
      allowTeacherOverrides,
    });
  };

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Assessment Weights" description="How CA (test) and examination scores are weighted for the final grade" icon={Percent}>
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-blue-600 dark:text-blue-400">CA / Test: {testWeight}%</span>
            <span className="text-purple-600 dark:text-purple-400">Exam: {100 - testWeight}%</span>
          </div>
          <Slider
            value={[testWeight]}
            onValueChange={v => setTestWeight(v[0])}
            min={0} max={100} step={5}
            data-testid="slider-test-weight"
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>CA Score carries <strong>{testWeight}%</strong> of total</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Exam Score carries <strong>{100 - testWeight}%</strong> of total</span>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Score Aggregation" description="When a student has multiple CA scores for the same subject, which score is used?" icon={BarChart3}>
        <div className="space-y-3">
          <Select value={scoreAggregation} onValueChange={setScoreAggregation}>
            <SelectTrigger data-testid="select-score-aggregation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Most Recent Score (Last submitted)</SelectItem>
              <SelectItem value="highest">Highest Score</SelectItem>
              <SelectItem value="average">Average of All Scores</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {scoreAggregation === 'last' && 'Only the most recently entered CA score is used for grading.'}
              {scoreAggregation === 'highest' && 'The highest CA score from all entries is used — benefits the student.'}
              {scoreAggregation === 'average' && 'All CA scores are averaged together for a balanced result.'}
            </span>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Report Card Behaviour" description="Control how report cards are created and displayed" icon={FileBarChart2}>
        <div className="space-y-1">
          <SwitchRow id="autoCreateReportCard" label="Auto-create Report Cards" description="Automatically generate a report card for each student when a term starts" checked={autoCreateReportCard} onCheckedChange={setAutoCreateReportCard} />
          <SwitchRow id="showGradeBreakdown" label="Show Grade Breakdown" description="Display CA and exam scores separately on the report card" checked={showGradeBreakdown} onCheckedChange={setShowGradeBreakdown} />
          <SwitchRow id="allowTeacherOverrides" label="Allow Teacher Score Overrides" description="Teachers can manually override auto-calculated scores on report cards" checked={allowTeacherOverrides} onCheckedChange={setAllowTeacherOverrides} />
        </div>
      </SettingCard>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending} data-testid="button-save-academic">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Academic Settings
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Grading Scale (preserved + enhanced)
// ─────────────────────────────────────────────
function GradingScaleSection() {
  const { settings, isLoading: settingsLoading, save } = useAdminSettings();
  const { toast } = useToast();
  const [positioningMethod, setPositioningMethod] = useState('average');
  const [defaultScale, setDefaultScale] = useState('standard');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBoundary, setEditingBoundary] = useState<GradingBoundary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [boundaryForm, setBoundaryForm] = useState({ name: 'Standard', grade: '', minScore: 0, maxScore: 100, remark: '', gradePoint: 0, isDefault: true });

  useEffect(() => {
    if (settings) {
      setPositioningMethod(settings.positioningMethod || 'average');
      setDefaultScale(settings.defaultGradingScale || 'standard');
    }
  }, [settings]);

  const { data: boundaries = [], isLoading: boundariesLoading } = useQuery<GradingBoundary[]>({
    queryKey: ['/api/grading-boundaries'],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof boundaryForm) => apiRequest('POST', '/api/grading-boundaries', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] }); setIsDialogOpen(false); toast({ title: 'Boundary created' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof boundaryForm }) => apiRequest('PATCH', `/api/grading-boundaries/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] }); setIsDialogOpen(false); toast({ title: 'Boundary updated' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/grading-boundaries/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] }); setDeleteConfirmId(null); toast({ title: 'Boundary deleted' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/grading-boundaries/bulk', {
      name: 'Standard', isDefault: true,
      boundaries: [
        { grade: 'A1', minScore: 75, maxScore: 100, remark: 'Distinction', gradePoint: 4.0 },
        { grade: 'B2', minScore: 70, maxScore: 74, remark: 'Very Good', gradePoint: 3.5 },
        { grade: 'B3', minScore: 65, maxScore: 69, remark: 'Good', gradePoint: 3.0 },
        { grade: 'C4', minScore: 60, maxScore: 64, remark: 'Credit', gradePoint: 2.5 },
        { grade: 'C5', minScore: 55, maxScore: 59, remark: 'Credit', gradePoint: 2.0 },
        { grade: 'C6', minScore: 50, maxScore: 54, remark: 'Credit', gradePoint: 1.5 },
        { grade: 'D7', minScore: 45, maxScore: 49, remark: 'Pass', gradePoint: 1.0 },
        { grade: 'E8', minScore: 40, maxScore: 44, remark: 'Pass', gradePoint: 0.5 },
        { grade: 'F9', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: 0.0 },
      ],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/grading-boundaries'] }); toast({ title: 'Default scale created' }); },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const handleSaveBoundaryForm = () => {
    if (!boundaryForm.grade) { toast({ title: 'Grade letter is required', variant: 'destructive' }); return; }
    if (boundaryForm.minScore > boundaryForm.maxScore) { toast({ title: 'Min score cannot exceed max', variant: 'destructive' }); return; }
    if (editingBoundary) updateMutation.mutate({ id: editingBoundary.id, data: boundaryForm });
    else createMutation.mutate(boundaryForm);
  };

  const openEdit = (b: GradingBoundary) => {
    setBoundaryForm({ name: b.name, grade: b.grade, minScore: b.minScore, maxScore: b.maxScore, remark: b.remark || '', gradePoint: b.gradePoint || 0, isDefault: b.isDefault });
    setEditingBoundary(b); setIsDialogOpen(true);
  };

  const resetBoundaryForm = () => { setBoundaryForm({ name: 'Standard', grade: '', minScore: 0, maxScore: 100, remark: '', gradePoint: 0, isDefault: true }); setEditingBoundary(null); };

  if (settingsLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Class Position Method" description="How students are ranked within their class" icon={Scale}>
        <div className="space-y-3">
          <Select value={positioningMethod} onValueChange={v => { setPositioningMethod(v); save.mutate({ positioningMethod: v }); }}>
            <SelectTrigger data-testid="select-positioning-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="average">By Average Score (Recommended)</SelectItem>
              <SelectItem value="total">By Total Marks</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{positioningMethod === 'average' ? 'Ranks by average % — fairer when students take different numbers of subjects.' : 'Ranks by total marks — may disadvantage students with fewer subjects.'}</span>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Grade Boundaries" description="Define the score ranges that map to each grade letter" icon={BarChart3}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <p className="text-sm text-muted-foreground">{boundaries.length} boundaries configured</p>
          <div className="flex gap-2 flex-wrap">
            {boundaries.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => bulkCreateMutation.mutate()} disabled={bulkCreateMutation.isPending} data-testid="button-create-defaults">
                {bulkCreateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Load WAEC/NECO Scale
              </Button>
            )}
            <Button size="sm" onClick={() => { resetBoundaryForm(); setIsDialogOpen(true); }} data-testid="button-add-boundary">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Boundary
            </Button>
          </div>
        </div>

        {boundariesLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : boundaries.length === 0 ? (
          <div className="text-center py-8 bg-muted/20 rounded-lg border-2 border-dashed">
            <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No grade boundaries configured.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Load WAEC/NECO Scale" to add the standard Nigerian grading scale.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Score Range</TableHead>
                  <TableHead className="hidden sm:table-cell">GPA</TableHead>
                  <TableHead className="hidden md:table-cell">Remark</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boundaries.map(b => (
                  <TableRow key={b.id} data-testid={`row-boundary-${b.id}`}>
                    <TableCell><Badge variant="outline" className="font-bold">{b.grade}</Badge></TableCell>
                    <TableCell className="text-sm">{b.minScore}% – {b.maxScore}%</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{b.gradePoint?.toFixed(1) ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.remark || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)} data-testid={`button-edit-boundary-${b.id}`}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteConfirmId(b.id)} data-testid={`button-delete-boundary-${b.id}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingCard>

      {/* Boundary form dialog */}
      <Dialog open={isDialogOpen} onOpenChange={v => { setIsDialogOpen(v); if (!v) resetBoundaryForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBoundary ? 'Edit Grading Boundary' : 'Add Grading Boundary'}</DialogTitle>
            <DialogDescription>Define the score range and grade point for this level.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Grade Letter</Label>
                <Input placeholder="e.g. A1, B2" value={boundaryForm.grade} onChange={e => setBoundaryForm(p => ({ ...p, grade: e.target.value.toUpperCase() }))} data-testid="input-grade" />
              </div>
              <div className="space-y-1.5">
                <Label>Grade Point</Label>
                <Input type="number" step="0.1" min="0" max="4" value={boundaryForm.gradePoint} onChange={e => setBoundaryForm(p => ({ ...p, gradePoint: parseFloat(e.target.value) || 0 }))} data-testid="input-grade-point" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Score (%)</Label>
                <Input type="number" min="0" max="100" value={boundaryForm.minScore} onChange={e => setBoundaryForm(p => ({ ...p, minScore: parseInt(e.target.value) || 0 }))} data-testid="input-min-score" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Score (%)</Label>
                <Input type="number" min="0" max="100" value={boundaryForm.maxScore} onChange={e => setBoundaryForm(p => ({ ...p, maxScore: parseInt(e.target.value) || 100 }))} data-testid="input-max-score" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Remark</Label>
              <Input placeholder="e.g. Distinction, Credit, Fail" value={boundaryForm.remark} onChange={e => setBoundaryForm(p => ({ ...p, remark: e.target.value }))} data-testid="input-remark" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBoundaryForm} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-boundary">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBoundary ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={v => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Boundary</DialogTitle>
            <DialogDescription>This cannot be undone. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Users & Roles
// ─────────────────────────────────────────────
function UsersRolesSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    usernameStudentPrefix: 'THS-STU',
    usernameParentPrefix: 'THS-PAR',
    usernameTeacherPrefix: 'THS-TCH',
    usernameAdminPrefix: 'THS-ADM',
    tempPasswordFormat: 'THS@{year}#{random4}',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        usernameStudentPrefix: settings.usernameStudentPrefix || 'THS-STU',
        usernameParentPrefix: settings.usernameParentPrefix || 'THS-PAR',
        usernameTeacherPrefix: settings.usernameTeacherPrefix || 'THS-TCH',
        usernameAdminPrefix: settings.usernameAdminPrefix || 'THS-ADM',
        tempPasswordFormat: settings.tempPasswordFormat || 'THS@{year}#{random4}',
      });
    }
  }, [settings]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Username Prefixes" description="Prefix prepended to auto-generated usernames for each role" icon={Hash}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'usernameStudentPrefix' as const, label: 'Student Prefix', example: 'THS-STU-001' },
            { key: 'usernameTeacherPrefix' as const, label: 'Teacher Prefix', example: 'THS-TCH-001' },
            { key: 'usernameParentPrefix' as const, label: 'Parent Prefix', example: 'THS-PAR-001' },
            { key: 'usernameAdminPrefix' as const, label: 'Admin Prefix', example: 'THS-ADM-001' },
          ].map(({ key, label, example }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} {...field(key)} data-testid={`input-${key}`} />
              <p className="text-xs text-muted-foreground">e.g. {form[key]}-001 → <strong>{example.replace('THS', form[key].split('-')[0] || 'THS')}</strong></p>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Temporary Password Format" description="Format used when a new account is created and a temporary password is generated" icon={Key}>
        <div className="space-y-2">
          <Input value={form.tempPasswordFormat} onChange={e => setForm(p => ({ ...p, tempPasswordFormat: e.target.value }))} data-testid="input-temp-password-format" />
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Available placeholders:</p>
              <p><code>{'{year}'}</code> → current year &nbsp;|&nbsp; <code>{'{random4}'}</code> → 4 random digits &nbsp;|&nbsp; <code>{'{random6}'}</code> → 6 random digits</p>
              <p className="mt-1">Example: <code>THS@{'{year}'}#{'{random4}'}</code> → <strong>THS@2025#7342</strong></p>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="User Management" description="Manage users, teachers, students, and parents" icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Student Management" description="Add, edit, block students" icon={Users} href="/portal/admin/students" />
          <QuickLinkCard title="Teacher Management" description="Add, verify, manage teachers" icon={Users} href="/portal/admin/teachers" />
          <QuickLinkCard title="Parent Management" description="Link parents to students" icon={Users} href="/portal/admin/parents" />
          <QuickLinkCard title="Roles & Permissions" description="Super admin manages global roles" icon={Shield} href="/portal/admin/dashboard" />
        </div>
      </SettingCard>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="button-save-users">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save User Settings
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Exams & CBT
// ─────────────────────────────────────────────
function ExamsCBTSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [requirePayment, setRequirePayment] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);

  useEffect(() => {
    if (settings) {
      setRequirePayment(settings.requireExamPayment ?? false);
      setFeeAmount(settings.examFeeAmount ?? 0);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Exam Fee Payment" description="Control whether students must pay before they can access exams" icon={CreditCard}>
        <div className="space-y-4">
          <SwitchRow id="requireExamPayment" label="Require Exam Fee Payment" description="Students must pay the exam fee before their exams are unlocked" checked={requirePayment} onCheckedChange={setRequirePayment} />
          {requirePayment && (
            <div className="space-y-1.5 pl-1">
              <Label htmlFor="examFeeAmount">Exam Fee Amount (₦)</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input id="examFeeAmount" type="number" min="0" value={feeAmount} onChange={e => setFeeAmount(parseInt(e.target.value) || 0)} data-testid="input-exam-fee-amount" />
              </div>
            </div>
          )}
          <Button size="sm" onClick={() => save.mutate({ requireExamPayment: requirePayment, examFeeAmount: feeAmount })} disabled={save.isPending} data-testid="button-save-exam-payment">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Exam Management" description="Configure exams, CBT sessions, and results" icon={ClipboardList}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Management" description="Create and manage exams" icon={ClipboardList} href="/portal/admin/exams" />
          <QuickLinkCard title="Exam Sessions" description="Monitor active CBT sessions" icon={Eye} href="/portal/admin/exam-sessions" />
          <QuickLinkCard title="Payment Records" description="View and manage exam fee payments" icon={CreditCard} href="/portal/admin/exam-payments" />
          <QuickLinkCard title="Question Banks" description="Manage question bank items" icon={Database} href="/portal/admin/question-bank" />
        </div>
      </SettingCard>

      <SettingCard title="Result Controls" description="Control how results are released and reported" icon={FileBarChart2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Results" description="View and publish exam results" icon={BarChart3} href="/portal/admin/exam-results" />
          <QuickLinkCard title="Report Cards" description="Manage student report cards" icon={FileBarChart2} href="/portal/admin/reports" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Lesson Notes
// ─────────────────────────────────────────────
function LessonNotesSection() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Configuration via Management Pages</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Lesson note approval workflows, topic visibility, and submission rules are managed per-teacher and per-class via the Lesson Note management pages below.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Lesson & Scheme Management" description="Manage lesson notes, topics, and scheme of work" icon={FileText}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Lesson Notes" description="View and approve teacher lesson notes" icon={FileText} href="/portal/admin/lesson-notes" />
          <QuickLinkCard title="Syllabus & Topics" description="Manage scheme of work and topics" icon={GraduationCap} href="/portal/admin/syllabus" />
          <QuickLinkCard title="Teacher Assignments" description="Assign teachers to subjects and classes" icon={Users} href="/portal/admin/teacher-assignments" />
          <QuickLinkCard title="Study Resources" description="Upload and manage study materials" icon={Database} href="/portal/admin/study-resources" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Report Card Settings
// ─────────────────────────────────────────────
function ReportCardSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(true);
  const [autoCreate, setAutoCreate] = useState(true);

  useEffect(() => {
    if (settings) {
      setShowGradeBreakdown(settings.showGradeBreakdown ?? true);
      setAutoCreate(settings.autoCreateReportCard ?? true);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Report Card Configuration" description="How report cards are generated and displayed to students and parents" icon={FileBarChart2}>
        <div className="space-y-1">
          <SwitchRow id="rc-autoCreate" label="Auto-create Report Cards" description="Automatically generate report cards when a term is configured" checked={autoCreate} onCheckedChange={setAutoCreate} />
          <SwitchRow id="rc-gradeBreakdown" label="Show CA / Exam Breakdown" description="Display separate CA and exam scores alongside the total score" checked={showGradeBreakdown} onCheckedChange={setShowGradeBreakdown} />
        </div>
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={() => save.mutate({ showGradeBreakdown, autoCreateReportCard: autoCreate })} disabled={save.isPending} data-testid="button-save-report-card">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Signature & Stamp" description="Principal signature and school stamp are configured by Super Admin in Branding" icon={Shield}>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
          <Lock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Managed by Super Admin</p>
            <p className="text-xs text-muted-foreground mt-0.5">School logo, principal signature, and school stamp are uploaded and managed in the Super Admin Branding section. The Designated Principal is set in Super Admin Settings.</p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Report Card Actions" description="View, publish, and manage student report cards" icon={FileBarChart2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Report Cards" description="View and publish report cards" icon={FileBarChart2} href="/portal/admin/reports" />
          <QuickLinkCard title="Report Comments" description="Manage comment templates" icon={FileText} href="/portal/admin/report-comments" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Attendance Settings
// ─────────────────────────────────────────────
function AttendanceSection() {
  return (
    <div className="space-y-4">
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-blue-800 dark:text-blue-300">Attendance is module-managed</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Attendance status types (Present, Absent, Late, Excused) are built-in. Recording permissions and visibility are controlled per-teacher via the Attendance management page.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Attendance Management" description="Record, review, and export attendance data" icon={CalendarCheck}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Attendance Overview" description="School-wide attendance dashboard" icon={CalendarCheck} href="/portal/admin/attendance" />
          <QuickLinkCard title="Class Management" description="Configure classes and teachers" icon={Building2} href="/portal/admin/classes" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Notifications
// ─────────────────────────────────────────────
function NotificationsSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableSms, setEnableSms] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnableEmail(settings.enableEmailNotifications ?? true);
      setEnableSms(settings.enableSmsNotifications ?? false);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Notification Channels" description="Control which channels are active for sending alerts to students, teachers, and parents" icon={Bell}>
        <div className="space-y-1">
          <SwitchRow
            id="enableEmail"
            label="Email Notifications"
            description="Send result alerts, payment confirmations, and announcements via email (requires RESEND_API_KEY)"
            checked={enableEmail}
            onCheckedChange={setEnableEmail}
          />
          <SwitchRow
            id="enableSms"
            label="SMS Notifications"
            description="Send result alerts and payment confirmations via SMS (requires Twilio credentials)"
            checked={enableSms}
            onCheckedChange={setEnableSms}
          />
        </div>
        {(enableEmail || enableSms) && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground border">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>API keys for email (RESEND_API_KEY) and SMS (Twilio credentials) must be configured in the Secrets tab by the Super Admin for notifications to send.</span>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={() => save.mutate({ enableEmailNotifications: enableEmail, enableSmsNotifications: enableSms })} disabled={save.isPending} data-testid="button-save-notifications">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Announcement Distribution" description="Send announcements to specific audiences" icon={Bell}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Announcements" description="Create and publish announcements" icon={Bell} href="/portal/admin/announcements" />
          <QuickLinkCard title="Events Calendar" description="Schedule school events" icon={CalendarCheck} href="/portal/admin/events" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Finance
// ─────────────────────────────────────────────
function FinanceSection() {
  const { settings, isLoading, save } = useAdminSettings();
  const [requirePayment, setRequirePayment] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);

  useEffect(() => {
    if (settings) {
      setRequirePayment(settings.requireExamPayment ?? false);
      setFeeAmount(settings.examFeeAmount ?? 0);
    }
  }, [settings]);

  if (isLoading) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      <SettingCard title="Exam Fee Configuration" description="Set whether exam payment is required and the fee amount" icon={CreditCard}>
        <div className="space-y-4">
          <SwitchRow id="financeRequirePayment" label="Require Exam Fee Payment" description="Students cannot access exams until the fee is paid" checked={requirePayment} onCheckedChange={setRequirePayment} />
          {requirePayment && (
            <div className="space-y-1.5">
              <Label htmlFor="financeFeeAmount">Exam Fee Amount</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input id="financeFeeAmount" type="number" min="0" value={feeAmount} onChange={e => setFeeAmount(parseInt(e.target.value) || 0)} data-testid="input-finance-fee-amount" />
              </div>
            </div>
          )}
          <Button size="sm" onClick={() => save.mutate({ requireExamPayment: requirePayment, examFeeAmount: feeAmount })} disabled={save.isPending} data-testid="button-save-finance">
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save
          </Button>
        </div>
      </SettingCard>

      <SettingCard title="Payment Records" description="View, verify, and manage all exam fee payments" icon={CreditCard}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Exam Payments" description="View and manage payment records" icon={CreditCard} href="/portal/admin/exam-payments" />
          <QuickLinkCard title="Integrations" description="Configure Paystack and Monnify keys" icon={Key} href="/portal/superadmin/settings/integrations" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Appearance
// ─────────────────────────────────────────────
function AppearanceSection() {
  const { data: settings } = useQuery<SystemSettings>({ queryKey: ['/api/admin/settings'] });

  return (
    <div className="space-y-4">
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-purple-800 dark:text-purple-300">Branding managed by Super Admin</p>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Logo, favicon, theme colour and full branding customization are controlled in the Super Admin Branding section for consistency across the platform.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Current Branding" description="Active branding configuration for this school" icon={Palette}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            {settings?.schoolLogo ? (
              <img src={settings.schoolLogo} alt="School Logo" className="h-12 w-12 object-contain rounded" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center"><Building2 className="w-6 h-6 text-muted-foreground" /></div>
            )}
            <span className="text-xs text-muted-foreground">School Logo</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `var(--primary)` }}>
              <Palette className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-muted-foreground">Theme Colour</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 border">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {settings?.schoolShortName || 'THS'}
            </div>
            <span className="text-xs text-muted-foreground">Short Name</span>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Branding Controls" description="Access Super Admin branding settings" icon={Palette}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Branding & Theme" description="Logo, favicon, theme colour" icon={Palette} href="/portal/superadmin/settings/branding" />
          <QuickLinkCard title="Homepage Management" description="Edit the public homepage content" icon={Globe} href="/portal/admin/homepage" />
          <QuickLinkCard title="Gallery" description="Manage the public photo gallery" icon={Building2} href="/portal/admin/gallery" />
          <QuickLinkCard title="About Page" description="Edit the About Us page content" icon={FileText} href="/portal/admin/about-page" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Security
// ─────────────────────────────────────────────
function SecuritySection() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-4">
      <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-red-800 dark:text-red-300">Platform security managed by Super Admin</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">Password policies, session timeouts, MFA settings, and global access controls are platform-level and managed by the Super Admin.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingCard title="Security Recommendations" description="Best practices for your school portal" icon={Shield}>
        <div className="space-y-3">
          {[
            { icon: Key, title: 'Strong Passwords', desc: 'Ensure all staff use the provided temp password on first login and change it immediately.' },
            { icon: Users, title: 'Regular User Audits', desc: 'Periodically review active accounts and suspend students who have left.' },
            { icon: Lock, title: 'Block Inactive Accounts', desc: 'Block student accounts after the exam season to prevent unauthorized access.' },
            { icon: AlertTriangle, title: 'Review Audit Logs', desc: 'Check audit logs regularly for any suspicious activity.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
              <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Security Controls" description="Access security settings and audit logs" icon={Shield}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Audit Logs" description="View all system activity logs" icon={Database} href="/portal/admin/audit-logs" />
          <QuickLinkCard title="Security Policies" description="Super Admin security configuration" icon={Shield} href="/portal/superadmin/settings/security" />
          <QuickLinkCard title="User Management" description="Block, suspend, or delete users" icon={Users} href="/portal/admin/students" />
          <QuickLinkCard title="Auth Settings" description="MFA and authentication options" icon={Key} href="/portal/superadmin/settings/authentication" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// SECTION: Data Management
// ─────────────────────────────────────────────
function DataManagementSection() {
  return (
    <div className="space-y-4">
      <SettingCard title="Data Import" description="Bulk import students, teachers, classes, and results" icon={Upload}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Import Students" description="Upload CSV to bulk-create students" icon={Upload} href="/portal/admin/students" />
          <QuickLinkCard title="Import Results" description="Upload exam results via CSV" icon={Upload} href="/portal/admin/reports" />
        </div>
      </SettingCard>

      <SettingCard title="Data Export" description="Download reports and records as files" icon={Download}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Export Students" description="Download student list as CSV" icon={Download} href="/portal/admin/students" />
          <QuickLinkCard title="Export Attendance" description="Download attendance records" icon={Download} href="/portal/admin/attendance" />
          <QuickLinkCard title="Export Results" description="Download exam results" icon={Download} href="/portal/admin/exam-results" />
          <QuickLinkCard title="Export Report Cards" description="Download report cards as PDF" icon={Download} href="/portal/admin/reports" />
        </div>
      </SettingCard>

      <SettingCard title="Backup & Restore" description="Database backup and restore operations (Super Admin)" icon={Database}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLinkCard title="Backup & Restore" description="Create and restore database backups" icon={Database} href="/portal/superadmin/settings/backup" />
          <QuickLinkCard title="Audit Logs" description="View system-wide activity logs" icon={RefreshCw} href="/portal/admin/audit-logs" />
        </div>
      </SettingCard>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton loader for sections
// ─────────────────────────────────────────────
function SectionSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border p-5 space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-2/3" />
          <div className="h-10 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Nav config
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'school', label: 'School Profile', icon: Building2, description: 'Name, contact, address, motto' },
  { id: 'academic', label: 'Academic', icon: GraduationCap, description: 'Weights, report cards, overrides' },
  { id: 'grading', label: 'Grading Scale', icon: BarChart3, description: 'Grade boundaries & class ranking' },
  { id: 'users', label: 'Users & Roles', icon: Users, description: 'Username formats & permissions' },
  { id: 'exams', label: 'Exams & CBT', icon: ClipboardList, description: 'Exam config, payment, CBT rules' },
  { id: 'lessons', label: 'Lesson Notes', icon: FileText, description: 'Approval & visibility rules' },
  { id: 'reports', label: 'Report Cards', icon: FileBarChart2, description: 'Report card config & signatures' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Status types & permissions' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & SMS alert settings' },
  { id: 'finance', label: 'Finance', icon: CreditCard, description: 'Fee & payment configuration' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, branding & display' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Access & password policies' },
  { id: 'data', label: 'Data & Backup', icon: Database, description: 'Import, export & backups' },
];

function renderSection(id: string) {
  switch (id) {
    case 'school': return <SchoolProfileSection />;
    case 'academic': return <AcademicSettingsSection />;
    case 'grading': return <GradingScaleSection />;
    case 'users': return <UsersRolesSection />;
    case 'exams': return <ExamsCBTSection />;
    case 'lessons': return <LessonNotesSection />;
    case 'reports': return <ReportCardSection />;
    case 'attendance': return <AttendanceSection />;
    case 'notifications': return <NotificationsSection />;
    case 'finance': return <FinanceSection />;
    case 'appearance': return <AppearanceSection />;
    case 'security': return <SecuritySection />;
    case 'data': return <DataManagementSection />;
    default: return null;
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function SettingsManagement() {
  const [activeSection, setActiveSection] = useState('school');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileNavOpen]);

  const filteredNav = NAV_ITEMS.filter(item =>
    !search || item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const activeItem = NAV_ITEMS.find(i => i.id === activeSection);
  const ActiveIcon = activeItem?.icon ?? Settings;

  const handleNavClick = useCallback((id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    setSearch('');
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0" data-testid="settings-management">

      {/* ── Mobile nav dropdown (floating overlay) ── */}
      <div className="lg:hidden relative z-30" ref={mobileNavRef}>
        <Button
          variant="outline"
          onClick={() => setMobileNavOpen(v => !v)}
          className="w-full justify-between"
          data-testid="button-mobile-nav"
        >
          <span className="flex items-center gap-2">
            <ActiveIcon className="w-4 h-4" />
            {activeItem?.label}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', mobileNavOpen && 'rotate-180')} />
        </Button>
        {mobileNavOpen && (
          <Card className="absolute top-full left-0 right-0 mt-1 shadow-xl border z-50">
            <CardContent className="p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search settings…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-settings-search-mobile"
                />
              </div>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {filteredNav.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-sm transition-colors',
                      activeSection === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                    data-testid={`nav-mobile-${item.id}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
                {filteredNav.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No settings found</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-settings-search"
                />
              </div>
              <div className="space-y-0.5">
                {filteredNav.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors group',
                      activeSection === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-foreground'
                    )}
                    data-testid={`nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className={cn('text-xs truncate leading-tight', activeSection === item.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={cn('w-3.5 h-3.5 shrink-0', activeSection === item.id ? 'text-primary-foreground/60' : 'text-muted-foreground/60')} />
                  </button>
                ))}
                {filteredNav.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No settings found</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h1 className="text-xl font-bold flex items-center gap-2 truncate">
            <ActiveIcon className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">{activeItem?.label}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeItem?.description}</p>
        </div>
        {renderSection(activeSection)}
      </div>
    </div>
  );
}
