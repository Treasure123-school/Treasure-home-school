import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
          <SelectTrigger className="w-full h-11 rounded-xl font-medium">
            <SelectValue placeholder="Select level…" />
          </SelectTrigger>
          <SelectContent className="rounded-xl overflow-hidden p-1">
            {groups.map((group) => {
              const Icon = LEVEL_ICONS[group.level.toLowerCase()] ?? BookOpen;
              const isActive = value === group.level;
              return (
                <SelectItem
                  key={group.level}
                  value={group.level}
                  className="rounded-lg py-2.5 px-3 cursor-pointer focus:bg-primary focus:text-white data-[state=checked]:bg-primary data-[state=checked]:text-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{group.label}</span>
                    <span className={`ml-auto text-xs rounded-full px-2 py-0.5 font-medium ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {group.classes.length} classes
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
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
