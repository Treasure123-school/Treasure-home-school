import { Select, SelectTrigger, SelectValue, PortalSelectContent, PortalSelectItem } from '@/components/ui/portal-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClassGroup } from '../types';

const LEVEL_ICONS: Record<string, LucideIcon> = {
  primary: BookOpen,
  jss: Users,
  ss: GraduationCap,
  sss: GraduationCap,
};

interface LevelSwitcherProps {
  groups: ClassGroup[];
  value: string;
  onChange: (level: string) => void;
}

export function LevelSwitcher({ groups, value, onChange }: LevelSwitcherProps) {
  return (
    <>
      {/* Mobile: Select dropdown */}
      <div className="sm:hidden mb-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select level…" />
          </SelectTrigger>
          <PortalSelectContent>
            {groups.map((group) => {
              const Icon = LEVEL_ICONS[group.level.toLowerCase()] ?? BookOpen;
              return (
                <PortalSelectItem
                  key={group.level}
                  value={group.level}
                  icon={<Icon className="w-4 h-4" />}
                  label={group.label}
                  meta={`${group.classes.length} classes`}
                />
              );
            })}
          </PortalSelectContent>
        </Select>
      </div>

      {/* Desktop: TabsList */}
      <Tabs value={value} onValueChange={onChange} className="hidden sm:block">
        <TabsList
          className="w-full h-11 p-1 rounded-xl"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}
        >
          {groups.map((group) => {
            const Icon = LEVEL_ICONS[group.level.toLowerCase()] ?? BookOpen;
            return (
              <TabsTrigger
                key={group.level}
                value={group.level}
                className="flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{group.label}</span>
                <Badge variant="secondary" className="text-xs ml-0.5 px-1.5 shrink-0">
                  {group.classes.length}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </>
  );
}
