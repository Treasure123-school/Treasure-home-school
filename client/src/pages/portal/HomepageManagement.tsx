import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Trash2, Upload, Edit, Save, X, Image as ImageIcon, Globe,
  Eye, EyeOff, GripVertical, Plus, ChevronDown, ChevronUp,
  ExternalLink, Palette, Type, Layout, Layers, AlignLeft,
  BarChart2, MessageSquare, HelpCircle, Camera,
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
    description: 'Main banner — heading text, accent color, subheading, call-to-action buttons, and background image.',
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
      body1: 'Treasure Home School is a sanctuary of brilliance committed to providing quality education and strong moral upbringing. We believe every child is unique and deserves careful guidance to discover their full potential.',
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
    title: 'Statistics',
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
        { name: 'Mrs. Sarah Williams', role: 'Parent of 3', initials: 'SW', text: 'Choosing Treasure-Home School was the best decision we ever made for our children\'s education.' },
        { name: 'Adebayo Daniel', role: 'Satisfied Parent', initials: 'AD', text: 'The teachers are dedicated, the environment is nurturing, and my son has grown tremendously both academically and in character.' },
        { name: 'Folake Ogundimu', role: 'Satisfied Parent', initials: 'FO', text: 'The level of care and attention each child receives here is exceptional.' },
      ],
    },
  },
  {
    key: 'gallery',
    title: 'Gallery Section',
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useToken() {
  return localStorage.getItem('token') || '';
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge variant={enabled ? 'default' : 'secondary'} className={`text-[10px] px-1.5 py-0.5 ${enabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}`}>
      {enabled ? 'Visible' : 'Hidden'}
    </Badge>
  );
}

// ─── Section Editors ──────────────────────────────────────────────────────────

function HeroEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (key: string, val: any) => onChange({ ...content, [key]: val });
  return (
    <div className="space-y-6">
      {/* Heading lines */}
      <div>
        <Label className="text-sm font-semibold text-foreground mb-3 block flex items-center gap-2"><Type className="h-4 w-4" /> Heading Lines</Label>
        <p className="text-xs text-muted-foreground mb-3">Each line has white text + colored text. Set the accent color below.</p>
        {[1, 2, 3].map((n) => (
          <div key={n} className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Line {n} — White text</Label>
              <Input value={content[`line${n}White`] ?? ''} onChange={e => set(`line${n}White`, e.target.value)} placeholder={`Line ${n} start`} data-testid={`input-line${n}white`} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Line {n} — Colored text</Label>
              <Input value={content[`line${n}Colored`] ?? ''} onChange={e => set(`line${n}Colored`, e.target.value)} placeholder={`Colored word(s)`} data-testid={`input-line${n}colored`} />
            </div>
          </div>
        ))}
      </div>

      {/* Accent color */}
      <div>
        <Label className="text-sm font-semibold mb-2 block flex items-center gap-2"><Palette className="h-4 w-4" /> Accent Color</Label>
        <p className="text-xs text-muted-foreground mb-2">This color is applied to the colored words in each heading line.</p>
        <div className="flex items-center gap-3">
          <input type="color" value={content.accentColor ?? '#00BFFF'} onChange={e => set('accentColor', e.target.value)} className="h-9 w-14 rounded border cursor-pointer" data-testid="input-accent-color" />
          <Input value={content.accentColor ?? '#00BFFF'} onChange={e => set('accentColor', e.target.value)} placeholder="#00BFFF" className="font-mono max-w-[120px]" data-testid="input-accent-color-text" />
          <div className="flex gap-1.5 flex-wrap">
            {['#00BFFF', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#F97316', '#FFFFFF'].map(c => (
              <button key={c} onClick={() => set('accentColor', c)} title={c}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: content.accentColor === c ? '#1D4ED8' : '#E5E7EB' }} />
            ))}
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-black/80 text-white text-sm">
          <span>Preview: </span>
          <span className="font-bold">We Nurture </span>
          <span className="font-bold" style={{ color: content.accentColor ?? '#00BFFF' }}>Young Minds.</span>
        </div>
      </div>

      {/* Subheading */}
      <div>
        <Label className="text-sm font-semibold mb-1 block">Subheading</Label>
        <Textarea value={content.subheading ?? ''} onChange={e => set('subheading', e.target.value)} rows={2} placeholder="Short description below the heading" data-testid="textarea-subheading" />
      </div>

      {/* CTA Buttons */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">Call-to-Action Buttons</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Primary Button Text</Label>
            <Input value={content.primaryBtnText ?? ''} onChange={e => set('primaryBtnText', e.target.value)} placeholder="ENROLL" data-testid="input-primary-btn-text" />
            <Label className="text-xs text-muted-foreground">Primary Button Link</Label>
            <Input value={content.primaryBtnLink ?? ''} onChange={e => set('primaryBtnLink', e.target.value)} placeholder="/admissions" data-testid="input-primary-btn-link" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Secondary Button Text</Label>
            <Input value={content.secondaryBtnText ?? ''} onChange={e => set('secondaryBtnText', e.target.value)} placeholder="CONTACT US" data-testid="input-secondary-btn-text" />
            <Label className="text-xs text-muted-foreground">Secondary Button Link</Label>
            <Input value={content.secondaryBtnLink ?? ''} onChange={e => set('secondaryBtnLink', e.target.value)} placeholder="/contact" data-testid="input-secondary-btn-link" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Label (small text above heading)</Label>
        <Input value={content.label ?? ''} onChange={e => set('label', e.target.value)} placeholder="About Our School" data-testid="input-about-label" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} placeholder="Qualitative Education and moral excellence" data-testid="input-about-heading" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">First Paragraph</Label>
        <Textarea value={content.body1 ?? ''} onChange={e => set('body1', e.target.value)} rows={3} data-testid="textarea-about-body1" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">Second Paragraph</Label>
        <Textarea value={content.body2 ?? ''} onChange={e => set('body2', e.target.value)} rows={3} data-testid="textarea-about-body2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs text-muted-foreground mb-1 block">Link Text</Label>
          <Input value={content.ctaText ?? ''} onChange={e => set('ctaText', e.target.value)} placeholder="Discover Our Mission" data-testid="input-about-cta-text" />
        </div>
        <div><Label className="text-xs text-muted-foreground mb-1 block">Link URL</Label>
          <Input value={content.ctaLink ?? ''} onChange={e => set('ctaLink', e.target.value)} placeholder="/about" data-testid="input-about-cta-link" />
        </div>
      </div>
    </div>
  );
}

function PillarsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const pillars: { title: string; desc: string }[] = content.pillars ?? [];
  const updatePillar = (i: number, field: string, val: string) => {
    const updated = pillars.map((p, idx) => idx === i ? { ...p, [field]: val } : p);
    set('pillars', updated);
  };
  const addPillar = () => set('pillars', [...pillars, { title: '', desc: '' }]);
  const removePillar = (i: number) => set('pillars', pillars.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} placeholder="Our Core Pillars" data-testid="input-pillars-heading" />
      </div>
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Subheading</Label>
        <Input value={content.subheading ?? ''} onChange={e => set('subheading', e.target.value)} placeholder="These foundational values..." data-testid="input-pillars-subheading" />
      </div>
      <Separator />
      <div className="space-y-3">
        {pillars.map((p, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Pillar {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => removePillar(i)} data-testid={`button-remove-pillar-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Input value={p.title} onChange={e => updatePillar(i, 'title', e.target.value)} placeholder="Pillar name" data-testid={`input-pillar-title-${i}`} />
            <Textarea value={p.desc} onChange={e => updatePillar(i, 'desc', e.target.value)} rows={2} placeholder="Description" data-testid={`textarea-pillar-desc-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addPillar} data-testid="button-add-pillar"><Plus className="h-4 w-4 mr-1" /> Add Pillar</Button>
      </div>
    </div>
  );
}

function StatsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const items: { value: string; label: string }[] = content.items ?? [];
  const update = (i: number, field: string, val: string) => {
    const updated = items.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    onChange({ ...content, items: updated });
  };
  const add = () => onChange({ ...content, items: [...items, { value: '', label: '' }] });
  const remove = (i: number) => onChange({ ...content, items: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={s.value} onChange={e => update(i, 'value', e.target.value)} placeholder="100%" className="w-24" data-testid={`input-stat-value-${i}`} />
          <Input value={s.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Satisfied Parents" className="flex-1" data-testid={`input-stat-label-${i}`} />
          <Button variant="ghost" size="sm" className="text-destructive h-9 w-9 p-0" onClick={() => remove(i)} data-testid={`button-remove-stat-${i}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} data-testid="button-add-stat"><Plus className="h-4 w-4 mr-1" /> Add Stat</Button>
    </div>
  );
}

function TestimonialsEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const items: { name: string; role: string; initials: string; text: string }[] = content.items ?? [];
  const update = (i: number, field: string, val: string) => set('items', items.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  const add = () => set('items', [...items, { name: '', role: '', initials: '', text: '' }]);
  const remove = (i: number) => set('items', items.filter((_, idx) => idx !== i));
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
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground">Testimonial {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => remove(i)} data-testid={`button-remove-testimonial-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={t.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Full name" data-testid={`input-testimonial-name-${i}`} />
              <Input value={t.initials} onChange={e => update(i, 'initials', e.target.value)} placeholder="Initials (SW)" className="w-full" data-testid={`input-testimonial-initials-${i}`} />
            </div>
            <Input value={t.role} onChange={e => update(i, 'role', e.target.value)} placeholder="Parent of 3" data-testid={`input-testimonial-role-${i}`} />
            <Textarea value={t.text} onChange={e => update(i, 'text', e.target.value)} rows={2} placeholder="Quote..." data-testid={`textarea-testimonial-text-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} data-testid="button-add-testimonial"><Plus className="h-4 w-4 mr-1" /> Add Testimonial</Button>
      </div>
    </div>
  );
}

function FaqEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const set = (k: string, v: any) => onChange({ ...content, [k]: v });
  const items: { question: string; answer: string }[] = content.items ?? [];
  const update = (i: number, field: string, val: string) => set('items', items.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  const add = () => set('items', [...items, { question: '', answer: '' }]);
  const remove = (i: number) => set('items', items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-4">
      <div><Label className="text-xs text-muted-foreground mb-1 block">Section Heading</Label>
        <Input value={content.heading ?? ''} onChange={e => set('heading', e.target.value)} placeholder="Frequently Asked Questions" data-testid="input-faq-heading" />
      </div>
      <Separator />
      <div className="space-y-3">
        {items.map((f, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-muted-foreground">Question {i + 1}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => remove(i)} data-testid={`button-remove-faq-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <Input value={f.question} onChange={e => update(i, 'question', e.target.value)} placeholder="Question..." data-testid={`input-faq-question-${i}`} />
            <Textarea value={f.answer} onChange={e => update(i, 'answer', e.target.value)} rows={2} placeholder="Answer..." data-testid={`textarea-faq-answer-${i}`} />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} data-testid="button-add-faq"><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
      </div>
    </div>
  );
}

function GalleryImageManager({ token }: { token: string }) {
  const { toast } = useToast();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [altText, setAltText] = useState('');

  const { data: allContent = [], isLoading } = useQuery<HomePageContent[]>({
    queryKey: ['/api/homepage-content'],
    refetchOnWindowFocus: false,
  });

  const galleryContent = allContent.filter(c =>
    ['hero_image', 'gallery_preview_1', 'gallery_preview_2', 'gallery_preview_3', 'about_section', 'featured_content'].includes(c.contentType)
  );

  const uploadMutation = useMutation({
    mutationFn: async ({ file, contentType, alt }: { file: File; contentType: string; alt: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadType', 'homepage');
      formData.append('contentType', contentType);
      formData.append('altText', alt);
      formData.append('displayOrder', '0');
      const response = await fetch(getApiUrl('/api/upload'), { method: 'POST', body: formData, headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.message || 'Upload failed'); }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] });
      toast({ title: 'Image uploaded' });
      setUploadFile(null); setAltText(''); setShowUpload(false);
    },
    onError: (e: Error) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(getApiUrl(`/api/homepage-content/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!r.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] }); toast({ title: 'Image deleted' }); },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(getApiUrl(`/api/homepage-content/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive }), credentials: 'include' });
      if (!r.ok) throw new Error('Update failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-content'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Upload images for hero banner and gallery preview sections.</p>
        <Button size="sm" onClick={() => setShowUpload(v => !v)} data-testid="button-toggle-upload">
          <Upload className="h-4 w-4 mr-1.5" />{showUpload ? 'Cancel' : 'Upload Image'}
        </Button>
      </div>

      {showUpload && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Content Type</Label>
                <select id="upload-content-type" className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm" data-testid="select-content-type">
                  <option value="hero_image">Hero Image</option>
                  <option value="gallery_preview_1">Gallery Preview 1</option>
                  <option value="gallery_preview_2">Gallery Preview 2</option>
                  <option value="gallery_preview_3">Gallery Preview 3</option>
                  <option value="about_section">About Section Image</option>
                  <option value="featured_content">Featured Content</option>
                </select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Alt Text</Label>
                <Input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Describe the image" data-testid="input-upload-alt" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Image File</Label>
              <Input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} data-testid="input-upload-file" />
            </div>
            <Button size="sm" disabled={!uploadFile || uploadMutation.isPending}
              onClick={() => {
                const sel = (document.getElementById('upload-content-type') as HTMLSelectElement).value;
                uploadMutation.mutate({ file: uploadFile!, contentType: sel, alt: altText });
              }} data-testid="button-do-upload">
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div> : galleryContent.length === 0 ? (
        <div className="text-center py-10">
          <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No images uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {galleryContent.map(item => (
            <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-muted" data-testid={`gallery-item-${item.id}`}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.altText || ''} className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground opacity-40" /></div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <span className="text-white text-[10px] font-medium px-2 text-center leading-tight">{item.contentType.replace(/_/g, ' ')}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleActive.mutate({ id: item.id, isActive: !item.isActive })} className={`p-1.5 rounded text-white ${item.isActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'}`} title={item.isActive ? 'Active — click to hide' : 'Hidden — click to show'} data-testid={`button-toggle-active-${item.id}`}>
                    {item.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(item.id)} className="p-1.5 rounded bg-red-600 hover:bg-red-700 text-white" data-testid={`button-delete-image-${item.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${item.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomepageManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const token = useToken();
  const [activeSection, setActiveSection] = useState('hero');
  const [localContent, setLocalContent] = useState<Record<string, Record<string, any>>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);

  const { data: sections = [], isLoading } = useQuery<HomepageSection[]>({
    queryKey: ['/api/homepage-sections'],
    refetchOnWindowFocus: false,
  });

  const sectionMap = Object.fromEntries(sections.map(s => [s.sectionKey, s]));

  const getContent = useCallback((key: string) => {
    if (localContent[key]) return localContent[key];
    const db = sectionMap[key]?.content;
    const defaults = SECTION_CONFIGS.find(s => s.key === key)?.defaultContent ?? {};
    return db ? { ...defaults, ...db } : defaults;
  }, [localContent, sectionMap]);

  const saveMutation = useMutation({
    mutationFn: async ({ sectionKey, isEnabled, displayOrder, content }: { sectionKey: string; isEnabled: boolean; displayOrder: number; content: Record<string, any> }) => {
      const r = await fetch(getApiUrl(`/api/homepage-sections/${sectionKey}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sectionTitle: SECTION_CONFIGS.find(s => s.key === sectionKey)?.title ?? sectionKey, isEnabled, displayOrder, content }),
        credentials: 'include',
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Save failed'); }
      return r.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] });
      setLocalContent(prev => { const n = { ...prev }; delete n[vars.sectionKey]; return n; });
      toast({ title: 'Section saved', description: 'Changes are now live on the website.' });
    },
    onError: (e: Error) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ sectionKey, isEnabled, displayOrder }: { sectionKey: string; isEnabled: boolean; displayOrder: number }) => {
      const r = await fetch(getApiUrl(`/api/homepage-sections/${sectionKey}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sectionTitle: SECTION_CONFIGS.find(s => s.key === sectionKey)?.title ?? sectionKey, isEnabled, displayOrder }),
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Toggle failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] }),
    onError: (e: Error) => toast({ title: 'Toggle failed', description: e.message, variant: 'destructive' }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: { sectionKey: string; displayOrder: number }[]) => {
      const r = await fetch(getApiUrl('/api/homepage-sections-order'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sections: ordered }),
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Reorder failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/homepage-sections'] }),
  });

  const orderedConfigs = [...SECTION_CONFIGS].sort((a, b) => {
    const ao = sectionMap[a.key]?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === a.key);
    const bo = sectionMap[b.key]?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === b.key);
    return ao - bo;
  });

  const activeCfg = SECTION_CONFIGS.find(s => s.key === activeSection);
  const activeDbSection = sectionMap[activeSection];
  const activeEnabled = activeDbSection?.isEnabled ?? true;
  const activeOrder = activeDbSection?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === activeSection);
  const hasLocalChanges = !!localContent[activeSection];

  const handleDragStart = (key: string) => setDragItem(key);
  const handleDragOver = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOver(key); };
  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!dragItem || dragItem === targetKey) { setDragItem(null); setDragOver(null); return; }
    const keys = orderedConfigs.map(c => c.key);
    const fromIdx = keys.indexOf(dragItem);
    const toIdx = keys.indexOf(targetKey);
    const newKeys = [...keys];
    newKeys.splice(fromIdx, 1);
    newKeys.splice(toIdx, 0, dragItem);
    const ordered = newKeys.map((k, i) => ({ sectionKey: k, displayOrder: i }));
    reorderMutation.mutate(ordered);
    setDragItem(null); setDragOver(null);
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Globe className="h-6 w-6 text-primary" /> Homepage Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Control all content, layout, and visibility of the public homepage.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')} data-testid="button-preview-homepage">
          <ExternalLink className="h-4 w-4 mr-1.5" /> Preview Homepage
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ─── Section List (left sidebar) ─── */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-3">
            Sections — drag to reorder
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : (
            orderedConfigs.map((cfg) => {
              const dbSec = sectionMap[cfg.key];
              const enabled = dbSec?.isEnabled ?? true;
              const Icon = cfg.icon;
              const isDragging = dragItem === cfg.key;
              const isOver = dragOver === cfg.key;
              return (
                <div
                  key={cfg.key}
                  draggable
                  onDragStart={() => handleDragStart(cfg.key)}
                  onDragOver={e => handleDragOver(e, cfg.key)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, cfg.key)}
                  onDragEnd={() => { setDragItem(null); setDragOver(null); }}
                  onClick={() => setActiveSection(cfg.key)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none
                    ${activeSection === cfg.key ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-card border-border hover:bg-accent/50'}
                    ${isDragging ? 'opacity-40' : ''}
                    ${isOver ? 'border-primary border-dashed bg-primary/5' : ''}
                  `}
                  data-testid={`section-item-${cfg.key}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                  <div className={`p-1.5 rounded-lg shrink-0 ${activeSection === cfg.key ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon className={`h-4 w-4 ${activeSection === cfg.key ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cfg.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <SectionBadge enabled={enabled} />
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      const order = dbSec?.displayOrder ?? SECTION_CONFIGS.findIndex(s => s.key === cfg.key);
                      toggleMutation.mutate({ sectionKey: cfg.key, isEnabled: checked, displayOrder: order });
                    }}
                    onClick={e => e.stopPropagation()}
                    data-testid={`switch-section-${cfg.key}`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ─── Editor Panel (right) ─── */}
        <div>
          {activeCfg && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <activeCfg.icon className="h-5 w-5 text-primary" />
                      {activeCfg.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">{activeCfg.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {activeEnabled ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{activeEnabled ? 'Visible' : 'Hidden'}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="pt-5">
                {activeSection === 'gallery' ? (
                  <GalleryImageManager token={token} />
                ) : (
                  <>
                    {activeSection === 'hero' && <HeroEditor content={getContent('hero')} onChange={c => setLocalContent(p => ({ ...p, hero: c }))} />}
                    {activeSection === 'about' && <AboutEditor content={getContent('about')} onChange={c => setLocalContent(p => ({ ...p, about: c }))} />}
                    {activeSection === 'pillars' && <PillarsEditor content={getContent('pillars')} onChange={c => setLocalContent(p => ({ ...p, pillars: c }))} />}
                    {activeSection === 'stats' && <StatsEditor content={getContent('stats')} onChange={c => setLocalContent(p => ({ ...p, stats: c }))} />}
                    {activeSection === 'testimonials' && <TestimonialsEditor content={getContent('testimonials')} onChange={c => setLocalContent(p => ({ ...p, testimonials: c }))} />}
                    {activeSection === 'faq' && <FaqEditor content={getContent('faq')} onChange={c => setLocalContent(p => ({ ...p, faq: c }))} />}

                    <Separator className="my-5" />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {hasLocalChanges && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Unsaved changes</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {hasLocalChanges && (
                          <Button variant="outline" size="sm" onClick={() => setLocalContent(p => { const n = { ...p }; delete n[activeSection]; return n; })} data-testid="button-discard-changes">
                            <X className="h-4 w-4 mr-1" /> Discard
                          </Button>
                        )}
                        <Button size="sm" disabled={saveMutation.isPending}
                          onClick={() => saveMutation.mutate({ sectionKey: activeSection, isEnabled: activeEnabled, displayOrder: activeOrder, content: getContent(activeSection) })}
                          data-testid="button-save-section">
                          <Save className="h-4 w-4 mr-1.5" />
                          {saveMutation.isPending ? 'Saving…' : 'Save & Publish'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
