import type React from 'react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus, ExternalLink, X,
} from 'lucide-react';
// ─────────────────────────────────────────────
// SettingCard – consistent wrapper for each sub-card
// ─────────────────────────────────────────────
export function SettingCard({ title, description, icon: Icon, children }: {
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
export function SwitchRow({ id, label, description, checked, onCheckedChange }: {
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
export function MultiInput({ values, onChange, placeholder, icon: Icon, type = 'text' }: {
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
export function ReadOnlyField({ label, value, icon: Icon, empty = '—' }: {
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
export function QuickLinkCard({ title, description, icon: Icon, href }: {
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

export function SectionSkeleton() {
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
