import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trash2, Upload, Save, X, Image as ImageIcon, Globe,
  Eye, EyeOff, GripVertical, Plus, ExternalLink, Palette, Type,
  Layout, Layers, AlignLeft, BarChart2, MessageSquare, HelpCircle,
  Camera, FileEdit, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  Info, ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/config/api';
import { useAuth } from '@/lib/auth';
import type { HomePageContent } from '@shared/schema';

// ─── Section Configuration ────────────────────────────────────────────────────

interface SectionConfig {
  key: string;
  title: string;
  icon: React.ElementType;
  description: string;
  defaultContent: Record<string, any>;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    key: 'hero',
    title: 'Hero Section',
    icon: Layout,
    description: 'Main banner — heading lines with white + colored text, accent color, subheading, and CTA buttons.',
    defaultContent: {
      line1White: 'We Nurture ', line1Colored: 'Young Minds.',
      line2White: 'We Build ', line2Colored: 'Character.',
      line3White: 'We Shape the ', line3Colored: 'Future.',
      accentColor: '#00BFFF',
      subheading: 'Treasure Home School is a school where qualitative education and moral excellence shape confident learners.',
      primaryBtnText: 'ENROLL', primaryBtnLink: '/admissions',
      secondaryBtnText: 'CONTACT US', secondaryBtnLink: '/contact',
    },
  },
  {
    key: 'about',
    title: 'About Section',
    icon: AlignLeft,
    description: 'School overview — label, heading, body paragraphs, and call-to-action link.',
    defaultContent: {
      label: 'About Our School',
      heading: 'Qualitative Education and moral excellence',
      body1: 'Treasure Home School is a sanctuary of brilliance committed to providing quality education and strong moral upbringing.',
      body2: 'Our holistic teaching approach combines sound academics, discipline, creativity, and life skills to prepare pupils for the global stage.',
      ctaText: 'Discover Our Mission', ctaLink: '/about',
    },
  },
  {
    key: 'pillars',
    title: 'Core Pillars',
    icon: Layers,
    description: 'Why Choose Us — feature cards with icons and descriptions.',
    defaultContent: {
      heading: 'Our Core Pillars',
      subheading: 'These foundational values guide every interaction and lesson at Treasure-Home School.',
      pillars: [
        { title: 'Uprightness', desc: 'Promoting honesty, integrity, and moral values in all aspects of school life.' },
        { title: 'Academic Excellence', desc: 'Striving for high academic standards and continuous improvement in teaching.' },
        { title: 'Innovation', desc: 'Encouraging creativity, critical thinking, and advanced problem-solving skills.' },
        { title: 'Inclusivity', desc: 'Embracing diversity and ensuring that all students have equal access to quality education.' },
        { title: 'Community Engagement', desc: 'Fostering a sense of social responsibility and active involvement in the community.' },
        { title: 'Lifelong Learning', desc: 'Instilling a passion for learning that extends beyond the classroom.' },
      ],
    },
  },
  {
    key: 'stats',
    title: 'Statistics Banner',
    icon: BarChart2,
    description: 'Key metrics displayed in the blue banner strip.',
    defaultContent: {
      items: [
        { value: '100%', label: 'Satisfied Parents' },
        { value: '20+', label: 'Expert Teachers' },
        { value: '15', label: 'Avg. Class Size' },
        { value: '98%', label: 'Uni Acceptance' },
      ],
    },
  },
  {
    key: 'testimonials',
    title: 'Testimonials',
    icon: MessageSquare,
    description: 'Parent and alumni quotes displayed as a rotating card.',
    defaultContent: {
      heading: 'Voices from Our Community',
      subheading: 'Hear from parents and alumni about how Treasure-Home School has made a difference in their lives.',
      items: [
        { name: 'Mrs. Sarah Williams', role: 'Parent of 3', initials: 'SW', text: "Choosing Treasure-Home School was the best decision we ever made for our children's education." },
        { name: 'Adebayo Daniel', role: 'Satisfied Parent', initials: 'AD', text: 'The teachers are dedicated, the environment is nurturing, and my son has grown tremendously both academically and in character.' },
        { name: 'Folake Ogundimu', role: 'Satisfied Parent', initials: 'FO', text: 'The level of care and attention each child receives here is exceptional.' },
      ],
    },
  },
  {
    key: 'gallery',
    title: 'Gallery / Images',
    icon: Camera,
    description: 'Homepage gallery preview — upload and manage display images.',
    defaultContent: {},
  },
  {
    key: 'faq',
    title: 'FAQ Section',
    icon: HelpCircle,
    description: 'Frequently asked questions displayed in an accordion.',
    defaultContent: {
      heading: 'Frequently Asked Questions',
      items: [
        { question: 'What is the enrollment process?', answer: 'The process begins with an inquiry form, followed by a campus tour and a student assessment.' },
        { question: 'Do you offer extracurricular activities?', answer: 'Yes! We offer a wide range of activities including sports, arts, music, debate clubs, and STEM programs.' },
        { question: 'Is your curriculum accredited?', answer: 'Absolutely. Our curriculum is fully accredited and aligned with national standards.' },
      ],
    },
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomepageSection {
  id: number;
  sectionKey: string;
  sectionTitle: string;
  isEnabled: boolean;
  displayOrder: number;
  content: Record<string, any> | null;
  draftContent: Record<string, any> | null;
  status: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const token = () => localStorage.getItem('token') || '';
const authHdr = () => ({ Authorization: `Bearer ${token()}` });

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, isEnabled }: { status: string; isEnabled: boolean }) {
  if (!isEnabled) return (
    <Badge className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border-gray-200">Hidden</Badge>
  );
  if (status === 'draft') return (
    <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>
  );
  return (
    <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border-green-200">Published</Badge>
  );
}

// ─── Section-Specific Editors ──────────────────────────────────────────────────

function HeroEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const accent = content.accentColor ?? '#00BFFF';
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Heading Lines</p>
        <p className="text-[11px] text-muted-foreground mb-3">Each line has a white prefix + a colored suffix. The accent color applies to all colored parts.</p>
        {([1, 2, 3] as const).map(n => (
          <div key={n} className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <Label className="text-[11px] text-muted-foreground block mb-1">Line {n} — White text</Label>
              <Input value={content[`line${n}White`] ?? ''} onChange={e => set(`line${n}White`, e.target.value)} data-testid={`input-line${n}white`} />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground block mb-1">Line {n} — Colored text</Label>
              <Input value={content[`line${n}Colored`] ?? ''} onChange={e => set(`line${n}Colored`, e.target.value)} data-testid={`input-line${n}colored`} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Accent Color</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="color" value={accent} onChange={e => set('accentColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" data-testid="input-accent-color" />
          <Input value={accent} onChange={e => set('accentColor', e.target.value)} className="font-mono w-28" data-testid="input-accent-color-text" />
          <div className="flex gap-1.5 flex-wrap">
            {['#00BFFF', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#F97316', '#FFFFFF'].map(c => (
              <button key={c} onClick={() => set('accentColor', c)} title={c}
                className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                style={{ backgroundColor: c, borderColor: accent === c ? '#1D4ED8' : '#E5E7EB' }} />
            ))}
          </div>
        </div>
        <div className="mt-3 px-4 py-3 rounded-lg bg-black/80 text-white text-sm font-bold">
          {content.line1White ?? 'We Nurture '}
          <span style={{ color: accent }}>{content.line1Colored ?? 'Young Minds.'}</span>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-1.5 block">Subheading</Label>
        <Textarea value={content.subheading ?? ''} onChange={e => set('subheading', e.target.value)} rows={2} data-testid="textarea-subheading" />
      </div>

      <div>
        <p className="text-xs font-semibold mb-3">Call-to-Action Buttons</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { labelT: 'Primary Button Text', keyT: 'primaryBtnText', labelL: 'Primary Button Link', keyL: 'primaryBtnLink', ph: ['ENROLL', '/admissions'] },
            { labelT: 'Secondary Button Text', keyT: 'secondaryBtnText', labelL: 'Secondary Button Link', keyL: 'secondaryBtnLink', ph: ['CONTACT US', '/contact'] },
          ].map(({ labelT, keyT, labelL, keyL, ph }) => (
            <div key={keyT} className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">{labelT}</Label>
              <Input value={content[keyT] ?? ''} onChange={e => set(keyT, e.target.value)} placeholder={ph[0]} data-testid={`input-${keyT}`} />
              <Label className="text-[11px] text-muted-foreground">{labelL}</Label>
              <Input value={content[keyL] ?? ''} onChange={e => set(keyL, e.target.value)} placeholder={ph[1]} data-testid={`input-${keyL}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  return (
    <div className="space-y-4">
      {[
        { label: 'Section Label (small text above heading)', key: 'label', ph: 'About Our School' },
        { label: 'Heading', key: 'heading', ph: 'Qualitative Education and moral excellence' },
      ].map(({ label, key, ph }) => (
        <div key={key}><Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
          <Input value={content[key] ?? ''} onChange={e => set(key, e.target.value)} placeholder={ph} data-testid={`input-about-${key}`} />
        </div>
      ))}
      {[
        { label: 'First Paragraph', key: 'body1' },
        { label: 'Second Paragraph', key: 'body2' },
      ].map(({ label, key }) => (
        <div key={key}><Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
          <Textarea value={content[key] ?? ''} onChange={e => set(key, e.target.value)} rows={3} data-testid={`textarea-about-${key}`} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs text-muted-foreground mb-1 block">Link Text</Label>
          <Input value={content.ctaText ?? ''} onChange={e => set('ctaText', e.target.value)} placeholder="Discover Our Mission" data-testid="input-about-ctatext" />
        </div>
        <div><Label className="text-xs text-muted-foreground mb-1 block">Link URL</Label>
          <Input value={content.ctaLink ?? ''} onChange={e => set('ctaLink', e.target.value)} placeholder="/about" data-testid="input-about-ctalink" />
        </div>
      </div>
    </div>
  );
}

function PillarsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const pillars: { title: string; desc: string }[] = content.pillars ?? [];
  const upd = (i: number, f: string, v: string) => set('pillars', pillars.map((p, idx) => idx === i ? { ...p, [f]: v } : p));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} data-testid="input-pillars-heading" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Subheading</Label>
        <Input value={content.subheading ?? ''} onChange={e => set('subheading', e.target.value)} data-testid="input-pillars-subheading" />
      </div>
      <Separator />
      <div className="space-y-3">
        {pillars.map((p, i) => (
          <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground">Pillar {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => set('pillars', pillars.filter((_, idx) => idx !== i))} data-testid={`button-remove-pillar-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Input value={p.title} onChange={e => upd(i, 'title', e.target.value)} placeholder="Pillar name" data-testid={`input-pillar-title-${i}`} />
            <Textarea value={p.desc} onChange={e => upd(i, 'desc', e.target.value)} rows={2} placeholder="Description" data-testid={`textarea-pillar-desc-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set('pillars', [...pillars, { title: '', desc: '' }])} data-testid="button-add-pillar">
          <Plus className="h-4 w-4 mr-1" /> Add Pillar
        </Button>
      </div>
    </div>
  );
}

function StatsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const items: { value: string; label: string }[] = content.items ?? [];
  const upd = (i: number, f: string, v: string) => onChange({ ...content, items: items.map((s, idx) => idx === i ? { ...s, [f]: v } : s) });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Each stat shows a big number/value and a small label underneath.</p>
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={s.value} onChange={e => upd(i, 'value', e.target.value)} placeholder="100%" className="w-24" data-testid={`input-stat-value-${i}`} />
          <Input value={s.label} onChange={e => upd(i, 'label', e.target.value)} placeholder="Satisfied Parents" className="flex-1" data-testid={`input-stat-label-${i}`} />
          <Button variant="ghost" size="sm" className="text-destructive h-9 w-9 p-0" onClick={() => onChange({ ...content, items: items.filter((_, idx) => idx !== i) })} data-testid={`button-remove-stat-${i}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...content, items: [...items, { value: '', label: '' }] })} data-testid="button-add-stat"><Plus className="h-4 w-4 mr-1" /> Add Stat</Button>
    </div>
  );
}

function TestimonialsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const items: { name: string; role: string; initials: string; text: string }[] = content.items ?? [];
  const upd = (i: number, f: string, v: string) => set('items', items.map((t, idx) => idx === i ? { ...t, [f]: v } : t));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} data-testid="input-testimonials-heading" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Subheading</Label>
        <Textarea value={content.subheading ?? ''} onChange={e => set('subheading', e.target.value)} rows={2} data-testid="textarea-testimonials-subheading" />
      </div>
      <Separator />
      <div className="space-y-3">
        {items.map((t, i) => (
          <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground">Testimonial {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => set('items', items.filter((_, idx) => idx !== i))} data-testid={`button-remove-testimonial-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={t.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Full name" data-testid={`input-testimonial-name-${i}`} />
              <Input value={t.initials} onChange={e => upd(i, 'initials', e.target.value)} placeholder="SW" data-testid={`input-testimonial-initials-${i}`} />
            </div>
            <Input value={t.role} onChange={e => upd(i, 'role', e.target.value)} placeholder="Parent of 3" data-testid={`input-testimonial-role-${i}`} />
            <Textarea value={t.text} onChange={e => upd(i, 'text', e.target.value)} rows={2} placeholder="Quote..." data-testid={`textarea-testimonial-text-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set('items', [...items, { name: '', role: '', initials: '', text: '' }])} data-testid="button-add-testimonial"><Plus className="h-4 w-4 mr-1" /> Add Testimonial</Button>
      </div>
    </div>
  );
}

function FaqEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const items: { question: string; answer: string }[] = content.items ?? [];
  const upd = (i: number, f: string, v: string) => set('items', items.map((f2, idx) => idx === i ? { ...f2, [f]: v } : f2));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} placeholder="Frequently Asked Questions" data-testid="input-faq-heading" />
      </div>
      <Separator />
      <div className="space-y-3">
        {items.map((f, i) => (
          <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground">Question {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => set('items', items.filter((_, idx) => idx !== i))} data-testid={`button-remove-faq-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Input value={f.question} onChange={e => upd(i, 'question', e.target.value)} placeholder="Question..." data-testid={`input-faq-question-${i}`} />
            <Textarea value={f.answer} onChange={e => upd(i, 'answer', e.target.value)} rows={2} placeholder="Answer..." data-testid={`textarea-faq-answer-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set('items', [...items, { question: '', answer: '' }])} data-testid="button-add-faq"><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
      </div>
    </div>
  );
}

// ─── Gallery Image Manager ─────────────────────────────────────────────────────

function GalleryImageManager() {
  const { toast } = useToast();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [contentType, setContentType] = useState('gallery_preview_1');

  const { data: allContent = [], isLoading } = useQuery<HomePageContent[]>({
    queryKey: ['/api/homepage-content'],
    refetchOnWindowFocus: false,
  });

  const gallery = allContent.filter(c =>
    ['hero_image', 'gallery_preview_1', 'gallery_preview_2', 'gallery_preview_3', 'about_section', 'featured_content'].includes(c.contentType)
  );

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('uploadType', 'homepage');
      form.append('contentType', contentType);
      form.append('altText', altText);
      form.append('displayOrder', '0');
      const r = await fetch(getApiUrl('/api/upload'), { method: 'POST', body: form, headers: authHdr(), credentials: 'include' });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Upload failed'); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      toast({ title: 'Image uploaded successfully' });
      setUploadFile(null); setAltText(''); setShowUpload(false);
    },
    onError: (e: Error) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(getApiUrl(`/api/homepage-content/${id}`), { method: 'DELETE', headers: authHdr(), credentials: 'include' });
      if (!r.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] }); toast({ title: 'Image deleted' }); },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(getApiUrl(`/api/homepage-content/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHdr() }, body: JSON.stringify({ isActive }), credentials: 'include' });
      if (!r.ok) throw new Error('Update failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] }),
  });

  const CONTENT_TYPE_LABELS: Record<string, string> = {
    hero_image: 'Hero Image',
    gallery_preview_1: 'Gallery Preview 1',
    gallery_preview_2: 'Gallery Preview 2',
    gallery_preview_3: 'Gallery Preview 3',
    about_section: 'About Section Image',
    featured_content: 'Featured Content',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Upload hero images and gallery preview photos.</p>
        <Button size="sm" variant={showUpload ? 'outline' : 'default'} onClick={() => setShowUpload(v => !v)} data-testid="button-toggle-upload">
          {showUpload ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Upload className="h-4 w-4 mr-1.5" /> Upload Image</>}
        </Button>
      </div>

      {showUpload && (
        <Card className="border-dashed border-2">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Image Type</Label>
                <select value={contentType} onChange={e => setContentType(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm" data-testid="select-content-type">
                  {Object.entries(CONTENT_TYPE_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Alt Text (accessibility)</Label>
                <Input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Describe the image" data-testid="input-upload-alt" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Image File (JPG, PNG, WebP)</Label>
              <Input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} data-testid="input-upload-file" />
            </div>
            {uploadFile && (
              <p className="text-xs text-muted-foreground">Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)</p>
            )}
            <Button size="sm" disabled={!uploadFile || uploadMutation.isPending} onClick={() => uploadMutation.mutate()} data-testid="button-do-upload">
              {uploadMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4 mr-1" /> Upload</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="aspect-[4/3] rounded-lg bg-muted animate-pulse" />)}</div>
      ) : gallery.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">No images uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Upload Image" to add your first photo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {gallery.map(item => (
            <div key={item.id} className="relative group rounded-xl overflow-hidden border bg-muted" data-testid={`gallery-item-${item.id}`}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.altText || ''} className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <span className="text-white text-[10px] font-medium text-center leading-tight px-1">
                  {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                    className={`p-1.5 rounded-lg text-white ${item.isActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'}`}
                    title={item.isActive ? 'Active — click to hide' : 'Hidden — click to show'} data-testid={`button-toggle-active-${item.id}`}>
                    {item.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(item.id)}
                    className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white" data-testid={`button-delete-image-${item.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-white/50 ${item.isActive ? 'bg-green-400' : 'bg-gray-400'}`} title={item.isActive ? 'Active' : 'Hidden'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomepageManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Working copies of content being edited (keyed by sectionKey)
  const [localContent, setLocalContent] = useState<Record<string, Record<string, any>>>({});
  const [activeSection, setActiveSection] = useState('hero');
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: sections = [], isLoading } = useQuery<HomepageSection[]>({
    queryKey: ['/api/homepage-sections'],
    refetchOnWindowFocus: false,
  });

  const sectionMap = Object.fromEntries(sections.map(s => [s.sectionKey, s]));

  // Get effective content for a section: prefer local edits, then DB content, then defaults
  const getContent = useCallback((key: string) => {
    if (localContent[key]) return localContent[key];
    const dbContent = sectionMap[key]?.content;
    const defaults = SECTION_CONFIGS.find(s => s.key === key)?.defaultContent ?? {};
    return dbContent ? { ...defaults, ...dbContent } : { ...defaults };
  }, [localContent, sectionMap]);

  // Get the PUBLISHED content (what visitors currently see)
  const getPublishedContent = useCallback((key: string) => {
    const dbContent = sectionMap[key]?.content;
    const defaults = SECTION_CONFIGS.find(s => s.key === key)?.defaultContent ?? {};
    return dbContent ? { ...defaults, ...dbContent } : { ...defaults };
  }, [sectionMap]);

  // Mutation: save draft or publish
  const saveMutation = useMutation({
    mutationFn: async ({ sectionKey, action, contentToSave }: { sectionKey: string; action: 'draft' | 'publish'; contentToSave: Record<string, any> }) => {
      const dbSec = sectionMap[sectionKey];
      const body: Record<string, any> = {
        sectionTitle: SECTION_CONFIGS.find(s => s.key === sectionKey)?.title ?? sectionKey,
        isEnabled: dbSec?.isEnabled ?? true,
        displayOrder: dbSec?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === sectionKey),
      };
      if (action === 'draft') {
        body.draftContent = contentToSave;
        body.status = 'draft';
        // Keep existing published content unchanged
        if (dbSec?.content) body.content = dbSec.content;
      } else {
        // Publish: move to content, clear draftContent
        body.content = contentToSave;
        body.draftContent = null;
        body.status = 'published';
      }
      const r = await fetch(getApiUrl(`/api/homepage-sections/${sectionKey}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Save failed'); }
      return r.json();
    },
    onSuccess: (_, { sectionKey, action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] });
      setLocalContent(prev => { const n = { ...prev }; delete n[sectionKey]; return n; });
      toast({
        title: action === 'draft' ? 'Draft saved' : '✓ Published to website',
        description: action === 'draft'
          ? 'Your changes are saved as a draft. Publish when ready to make them live.'
          : 'Changes are now visible to all website visitors.',
      });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  // Mutation: toggle section visibility
  const toggleMutation = useMutation({
    mutationFn: async ({ sectionKey, isEnabled }: { sectionKey: string; isEnabled: boolean }) => {
      const dbSec = sectionMap[sectionKey];
      const r = await fetch(getApiUrl(`/api/homepage-sections/${sectionKey}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({
          sectionTitle: SECTION_CONFIGS.find(s => s.key === sectionKey)?.title ?? sectionKey,
          isEnabled,
          displayOrder: dbSec?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === sectionKey),
          status: dbSec?.status ?? 'published',
        }),
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Toggle failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] }),
    onError: (e: Error) => toast({ title: 'Toggle failed', description: e.message, variant: 'destructive' }),
  });

  // Mutation: reorder sections
  const reorderMutation = useMutation({
    mutationFn: async (ordered: { sectionKey: string; displayOrder: number }[]) => {
      const r = await fetch(getApiUrl('/api/homepage-sections-order'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({ sections: ordered }),
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Reorder failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] }),
  });

  // Sort sidebar configs by their DB display order
  const orderedConfigs = [...SECTION_CONFIGS].sort((a, b) => {
    const ao = sectionMap[a.key]?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === a.key);
    const bo = sectionMap[b.key]?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === b.key);
    return ao - bo;
  });

  const activeCfg = SECTION_CONFIGS.find(s => s.key === activeSection)!;
  const activeDbSection = sectionMap[activeSection];
  const activeEnabled = activeDbSection?.isEnabled ?? true;
  const activeOrder = activeDbSection?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === activeSection);
  const activeStatus = activeDbSection?.status ?? 'published';
  const hasLocalChanges = !!localContent[activeSection];
  const hasDraftInDB = !!activeDbSection?.draftContent;

  // Drag and drop reorder
  const handleDrop = (targetKey: string) => {
    if (!dragItem || dragItem === targetKey) { setDragItem(null); setDragOver(null); return; }
    const keys = orderedConfigs.map(c => c.key);
    const from = keys.indexOf(dragItem);
    const to = keys.indexOf(targetKey);
    const newKeys = [...keys];
    newKeys.splice(from, 1);
    newKeys.splice(to, 0, dragItem);
    reorderMutation.mutate(newKeys.map((k, i) => ({ sectionKey: k, displayOrder: i })));
    setDragItem(null); setDragOver(null);
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Globe className="h-5 w-5 text-primary" /> Homepage Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all sections of the school's public homepage. Changes are reflected on the website immediately when published.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')} data-testid="button-preview-homepage">
            <ExternalLink className="h-4 w-4 mr-1.5" /> Preview Live Site
          </Button>
        </div>
      </div>

      {/* ─── Status summary bar ─── */}
      {sections.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 rounded-xl border text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><strong>{sections.filter(s => s.isEnabled && s.status !== 'draft').length}</strong> published</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /><strong>{sections.filter(s => s.status === 'draft' || !!s.draftContent).length}</strong> with drafts</span>
          <span className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5 text-gray-400" /><strong>{sections.filter(s => !s.isEnabled).length}</strong> hidden</span>
          <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Info className="h-3 w-3" /> Toggle visibility with the switch · Drag items to reorder</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* ─── Section Sidebar ─── */}
        <div className="space-y-1.5">
          {isLoading ? (
            [...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)
          ) : (
            orderedConfigs.map(cfg => {
              const dbSec = sectionMap[cfg.key];
              const enabled = dbSec?.isEnabled ?? true;
              const status = dbSec?.status ?? 'published';
              const hasDraft = !!dbSec?.draftContent;
              const isActive = activeSection === cfg.key;
              const Icon = cfg.icon;
              return (
                <div
                  key={cfg.key}
                  draggable
                  onDragStart={() => setDragItem(cfg.key)}
                  onDragOver={e => { e.preventDefault(); setDragOver(cfg.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(cfg.key)}
                  onDragEnd={() => { setDragItem(null); setDragOver(null); }}
                  onClick={() => setActiveSection(cfg.key)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all
                    ${isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-card border-border hover:bg-accent/40'}
                    ${dragItem === cfg.key ? 'opacity-40' : ''}
                    ${dragOver === cfg.key ? 'border-primary border-dashed bg-primary/5' : ''}
                  `}
                  data-testid={`section-item-${cfg.key}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                  <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cfg.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <StatusBadge status={status} isEnabled={enabled} />
                      {hasDraft && enabled && <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/30">Has draft</Badge>}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={checked => toggleMutation.mutate({ sectionKey: cfg.key, isEnabled: checked })}
                    onClick={e => e.stopPropagation()}
                    data-testid={`switch-section-${cfg.key}`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ─── Editor Panel ─── */}
        {activeCfg && (
          <div className="space-y-4">
            {/* Section header card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <activeCfg.icon className="h-5 w-5 text-primary" />
                      {activeCfg.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">{activeCfg.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={activeStatus} isEnabled={activeEnabled} />
                    {hasDraftInDB && <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/30">Has draft</Badge>}
                    {activeDbSection?.updatedAt && (
                      <span className="text-xs text-muted-foreground hidden sm:block">Updated {relativeTime(activeDbSection.updatedAt)}</span>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Draft notification */}
            {hasDraftInDB && !hasLocalChanges && activeSection !== 'gallery' && (
              <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/30 rounded-xl text-sm text-primary">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="flex-1">This section has a saved draft that hasn't been published yet.</span>
                <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 h-8"
                  onClick={() => {
                    const draftC = activeDbSection?.draftContent ?? {};
                    const defaults = activeCfg.defaultContent;
                    setLocalContent(prev => ({ ...prev, [activeSection]: { ...defaults, ...draftC } }));
                  }} data-testid="button-load-draft">
                  <FileEdit className="h-3.5 w-3.5 mr-1" /> Edit Draft
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90 h-8"
                  onClick={() => saveMutation.mutate({ sectionKey: activeSection, action: 'publish', contentToSave: { ...activeCfg.defaultContent, ...activeDbSection?.draftContent } })}
                  disabled={saveMutation.isPending} data-testid="button-publish-draft">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Publish Draft
                </Button>
              </div>
            )}

            {/* Main editor card */}
            <Card className="shadow-sm">
              <CardContent className="pt-5">
                {activeSection === 'gallery' ? (
                  <GalleryImageManager />
                ) : (
                  <>
                    {activeSection === 'hero' && <HeroEditor content={getContent('hero')} onChange={c => setLocalContent(p => ({ ...p, hero: c }))} />}
                    {activeSection === 'about' && <AboutEditor content={getContent('about')} onChange={c => setLocalContent(p => ({ ...p, about: c }))} />}
                    {activeSection === 'pillars' && <PillarsEditor content={getContent('pillars')} onChange={c => setLocalContent(p => ({ ...p, pillars: c }))} />}
                    {activeSection === 'stats' && <StatsEditor content={getContent('stats')} onChange={c => setLocalContent(p => ({ ...p, stats: c }))} />}
                    {activeSection === 'testimonials' && <TestimonialsEditor content={getContent('testimonials')} onChange={c => setLocalContent(p => ({ ...p, testimonials: c }))} />}
                    {activeSection === 'faq' && <FaqEditor content={getContent('faq')} onChange={c => setLocalContent(p => ({ ...p, faq: c }))} />}

                    <Separator className="my-5" />

                    {/* Action bar */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        {hasLocalChanges && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Unsaved changes
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {hasLocalChanges && (
                          <Button variant="ghost" size="sm" onClick={() => setLocalContent(p => { const n = { ...p }; delete n[activeSection]; return n; })} data-testid="button-discard-changes">
                            <X className="h-4 w-4 mr-1" /> Discard
                          </Button>
                        )}
                        {hasLocalChanges && (
                          <Button variant="outline" size="sm" disabled={saveMutation.isPending}
                            onClick={() => saveMutation.mutate({ sectionKey: activeSection, action: 'draft', contentToSave: getContent(activeSection) })}
                            data-testid="button-save-draft">
                            <Clock className="h-4 w-4 mr-1.5" />
                            {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
                          </Button>
                        )}
                        <Button size="sm" disabled={saveMutation.isPending || (!hasLocalChanges && !hasDraftInDB && !!activeDbSection)}
                          onClick={() => saveMutation.mutate({ sectionKey: activeSection, action: 'publish', contentToSave: getContent(activeSection) })}
                          data-testid="button-publish-section"
                          className="bg-primary hover:bg-primary/90">
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          {saveMutation.isPending ? 'Publishing…' : 'Publish'}
                        </Button>
                      </div>
                    </div>

                    {/* Current live content indicator */}
                    {activeDbSection && activeStatus === 'published' && !hasLocalChanges && (
                      <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        This section is currently live on the website.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
