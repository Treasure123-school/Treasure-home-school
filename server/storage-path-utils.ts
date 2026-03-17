/**
 * Storage path organization utility
 * Generates organized folder structures within MinIO buckets
 * Format: {bucket}/{category}/{date}/{prefix_filename}
 */

export interface PathOptions {
  userId?: string;
  classId?: number;
  subjectId?: number;
  contentType?: string;
  originalFilename?: string;
}

/**
 * Generate UUID-based prefix to ensure uniqueness and prevent collisions
 */
function generateFilePrefix(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Homepage images: homepage/{YYYY-MM-DD}/{timestamp}_{filename}
 */
export function getHomepageImagePath(originalFilename: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const prefix = generateFilePrefix();
  const safeFilename = sanitizeFilename(originalFilename);
  return `homepage/${date}/${prefix}_${safeFilename}`;
}

/**
 * Gallery images: gallery/{YYYY}/{MM}/{timestamp}_{filename}
 */
export function getGalleryImagePath(originalFilename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = generateFilePrefix();
  const safeFilename = sanitizeFilename(originalFilename);
  return `gallery/${year}/${month}/${prefix}_${safeFilename}`;
}

/**
 * Profile images: profiles/{userId}/{timestamp}_{filename}
 */
export function getProfileImagePath(userId: string, originalFilename: string): string {
  const prefix = generateFilePrefix();
  const safeFilename = sanitizeFilename(originalFilename);
  return `profiles/${userId}/${prefix}_${safeFilename}`;
}

/**
 * Study resources: study-resources/{classId}/{subjectId}/{YYYY-MM-DD}/{timestamp}_{filename}
 */
export function getStudyResourcePath(
  classId: number,
  subjectId: number,
  originalFilename: string
): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const prefix = generateFilePrefix();
  const safeFilename = sanitizeFilename(originalFilename);
  return `study-resources/${classId}/${subjectId}/${date}/${prefix}_${safeFilename}`;
}

/**
 * General uploads: general/{YYYY-MM-DD}/{type}/{timestamp}_{filename}
 */
export function getGeneralUploadPath(
  originalFilename: string,
  type: string = 'misc'
): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const prefix = generateFilePrefix();
  const safeFilename = sanitizeFilename(originalFilename);
  const safeType = sanitizeFilename(type).toLowerCase();
  return `general/${date}/${safeType}/${prefix}_${safeFilename}`;
}

/**
 * Sanitize filename to prevent path traversal and special characters
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
    .substring(0, 200); // Limit length
}

/**
 * Extract original filename from organized path for downloads
 */
export function extractFilenameFromPath(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Get file date from organized path (YYYY-MM-DD)
 * Returns null if path doesn't contain a valid date
 */
export function getFileDateFromPath(path: string): string | null {
  const dateMatch = path.match(/(\d{4})-(\d{2})-(\d{2})/);
  return dateMatch ? dateMatch[0] : null;
}

/**
 * Build delete path for old file cleanup
 * Example: Delete all files older than 90 days from homepage
 */
export function getCleanupDateThreshold(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Batch organize files by date for archival
 * Returns grouped paths for bulk operations
 */
export function groupFilesByDate(paths: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  
  for (const path of paths) {
    const dateStr = getFileDateFromPath(path);
    if (dateStr) {
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)?.push(path);
    }
  }
  
  return grouped;
}
