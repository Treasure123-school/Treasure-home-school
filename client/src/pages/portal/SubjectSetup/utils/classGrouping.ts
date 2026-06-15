import type { ClassInfo, ClassGroup } from '../types';

const LEVEL_LABEL_MAP: Record<string, string> = {
  primary: 'Primary',
  jss: 'Junior Secondary (JSS)',
  ss: 'Senior Secondary (SSS)',
  sss: 'Senior Secondary (SSS)',
};

const LEVEL_ORDER: Record<string, number> = {
  primary: 0,
  jss: 1,
  ss: 2,
  sss: 2,
};

export const getLevelLabel = (level: string): string =>
  LEVEL_LABEL_MAP[level.toLowerCase()] ?? level;

export const getLevelOrder = (level: string): number =>
  LEVEL_ORDER[level.toLowerCase()] ?? 99;

export const isSSLevel = (level: string): boolean =>
  ['ss', 'sss'].includes(level.toLowerCase());

export const isPrimaryLevel = (level: string): boolean =>
  level.toLowerCase() === 'primary';

export const isJSSLevel = (level: string): boolean =>
  level.toLowerCase() === 'jss';

export const groupClassesByLevel = (classes: ClassInfo[]): ClassGroup[] => {
  const map = new Map<string, ClassInfo[]>();

  for (const cls of classes) {
    const key = cls.level.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(cls);
  }

  return Array.from(map.entries())
    .map(([level, cls]) => ({
      level,
      label: getLevelLabel(level),
      classes: cls.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => getLevelOrder(a.level) - getLevelOrder(b.level));
};

export const getClassYearGroups = (classes: ClassInfo[]): Map<string, ClassInfo[]> => {
  const groups = new Map<string, ClassInfo[]>();
  for (const cls of classes) {
    const yearGroup = extractYearGroup(cls.name);
    if (!groups.has(yearGroup)) groups.set(yearGroup, []);
    groups.get(yearGroup)!.push(cls);
  }
  return groups;
};

const extractYearGroup = (className: string): string => {
  const match = className.match(/^([A-Za-z]+\s*\d+)/);
  return match ? match[1].trim() : className;
};
