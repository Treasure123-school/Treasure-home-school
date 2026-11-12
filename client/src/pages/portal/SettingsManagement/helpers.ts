// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Normalize any stored phone/email item to a plain string. */
export function itemToString(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    // Handle SchoolPhone { countryCode, number } format
    if ('countryCode' in o && 'number' in o) {
      return `${o.countryCode ?? ''}${o.number ?? ''}`.trim();
    }
    // Generic: take first string value found
    const firstStr = Object.values(o).find(v => typeof v === 'string');
    if (firstStr) return String(firstStr).trim();
  }
  return '';
}

/** Parse a JSON-encoded array (of strings OR SchoolPhone objects) to string[]. */
export function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(itemToString).filter(Boolean);
  } catch {
    return [];
  }
}

/** Convert strings to SchoolPhone objects so SuperAdminSettings stays compatible. */
export function stringToSchoolPhone(phone: string): { countryCode: string; number: string } {
  const s = phone.trim();
  if (s.startsWith('+')) {
    const match = s.match(/^(\+\d{1,3})(.+)$/);
    if (match) return { countryCode: match[1], number: match[2].replace(/[\s\-()]/g, '') };
  }
  if (s.startsWith('0') && s.length >= 10) {
    return { countryCode: '+234', number: s.slice(1) };
  }
  return { countryCode: '+234', number: s };
}

/** Serialize phone strings back to SchoolPhone JSON (keeps SuperAdminSettings compatible). */
export function phonesToJsonString(arr: string[]): string {
  return JSON.stringify(arr.filter(Boolean).map(stringToSchoolPhone));
}

/** Serialize email strings as a plain JSON string array. */
export function emailsToJsonString(arr: string[]): string {
  return JSON.stringify(arr.filter(Boolean));
}

export const countryCodes = [
  { code: "+234", name: "Nigeria" },
  { code: "+1", name: "USA/Canada" },
  { code: "+44", name: "UK" },
  { code: "+233", name: "Ghana" },
  { code: "+254", name: "Kenya" },
  { code: "+27", name: "South Africa" },
];
