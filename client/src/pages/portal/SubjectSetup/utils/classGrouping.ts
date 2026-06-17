import type { ClassInfo, ClassGroup } from '../types';

/**
 * Normalise the raw `level` value from the DB into a stable shortcode.
 *
 * The DB may store full strings like:
 *   "Primary" | "Junior Secondary" | "Junior Secondary School"
 *   "Senior Secondary" | "Senior Secondary School"
 * OR historical shortcodes: "primary" | "jss" | "ss" | "sss"
 *
 * Returns one of: "primary" | "jss" | "ss"
 */
export function normaliseLevel(raw: string): string {
  const l = (raw ?? '').trim().toLowerCase();
  if (l === 'primary' || l.startsWith('prim')) return 'primary';
  if (l === 'ss' || l === 'sss' || l.includes('senior secondary') || l.includes('senior_secondary')) return 'ss';
  if (l === 'jss' || l.includes('junior secondary') || l.includes('junior_secondary')) return 'jss';
  return l; // unknown — pass through and let grouping handle it
}

const LEVEL_LABEL_MAP: Record<string, string> = {
  primary: 'Primary',
  jss: 'Junior Secondary (JSS)',
  ss: 'Senior Secondary (SSS)',
};

const LEVEL_ORDER: Record<string, number> = {
  primary: 0,
  jss: 1,
  ss: 2,
};

export const getLevelLabel = (level: string): string =>
  LEVEL_LABEL_MAP[normaliseLevel(level)] ?? level;

export const getLevelOrder = (level: string): number =>
  LEVEL_ORDER[normaliseLevel(level)] ?? 99;

/** Returns true for any Senior Secondary level (SS / SSS / "Senior Secondary") */
export const isSSLevel = (level: string): boolean =>
  normaliseLevel(level) === 'ss';

export const isPrimaryLevel = (level: string): boolean =>
  normaliseLevel(level) === 'primary';

export const isJSSLevel = (level: string): boolean =>
  normaliseLevel(level) === 'jss';

/** Group classes by normalised level key. */
export const groupClassesByLevel = (classes: ClassInfo[]): ClassGroup[] => {
  const map = new Map<string, ClassInfo[]>();

  for (const cls of classes) {
    const key = normaliseLevel(cls.level);
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

/**
 * Group classes within a level by year group (e.g. "JSS 1", "JSS 2").
 * Returns a Map from year-group label → ClassInfo[].
 */
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
