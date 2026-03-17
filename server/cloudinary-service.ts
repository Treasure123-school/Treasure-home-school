/**
 * Cloudinary Upload Service
 * 
 * This service handles all file uploads to Cloudinary in production.
 * In development, it falls back to local storage.
 * 
 * Folder Structure:
 * - /students - Student profile pictures and documents
 * - /teachers - Teacher profile pictures and signatures
 * - /admins - Admin profile pictures and documents
 * - /assignments - Student assignment submissions
 * - /results - Report cards and result documents
 * - /gallery - School gallery images
 * - /homepage - Homepage content images
 * - /study-resources - Educational materials
 * - /general - Miscellaneous uploads
 */

import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.RENDER;
const hasCloudinaryConfig = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Force Cloudinary in production environments like Vercel/Render
export const useCloudinary = hasCloudinaryConfig && (isProduction || !!process.env.CLOUDINARY_CLOUD_NAME); 

// Storage initialization status flag
let storageInitialized = false;

/**
 * Initialize and log storage status
 */
export function initializeStorage(): void {
  if (storageInitialized) return;
  
  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│            FILE STORAGE CONFIGURATION                │');
  console.log('├─────────────────────────────────────────────────────┤');
  
  if (isProduction) {
    if (hasCloudinaryConfig) {
      // Configure Cloudinary for production
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      console.log('│  Environment: PRODUCTION                            │');
      console.log('│  Storage: CLOUDINARY CDN                            │');
      console.log(`│  Cloud Name: ${(process.env.CLOUDINARY_CLOUD_NAME || '').padEnd(36)}│`);
      console.log('│  Status: ✅ CONNECTED                               │');
    } else {
      console.log('│  Environment: PRODUCTION                            │');
      console.log('│  Storage: LOCAL (⚠️ Cloudinary not configured)      │');
      console.log('│  Warning: Files will not persist on restart!        │');
      console.log('│  Status: ⚠️ FALLBACK MODE                           │');
    }
  } else {
    console.log('│  Environment: DEVELOPMENT                           │');
    console.log('│  Storage: LOCAL FILESYSTEM                          │');
    console.log('│  Location: ./server/uploads/                        │');
    console.log('│  Status: ✅ READY                                    │');
    
    if (hasCloudinaryConfig) {
      // Configure Cloudinary even in development (for testing)
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
      });
      console.log('│  Note: Cloudinary available (set NODE_ENV=production│');
      console.log('│        to use Cloudinary in production)             │');
    }
  }
  
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
  
  storageInitialized = true;
}

// Auto-initialize on module load
initializeStorage();

// Upload types and their Cloudinary folder mappings
export type UploadType = 
  | 'student' 
  | 'teacher' 
  | 'admin' 
  | 'assignment' 
  | 'result' 
  | 'gallery' 
  | 'homepage' 
  | 'study-resource' 
  | 'profile'
  | 'general';

const folderMap: Record<UploadType, string> = {
  'student': 'students',
  'teacher': 'teachers',
  'admin': 'admins',
  'assignment': 'assignments',
  'result': 'results',
  'gallery': 'gallery',
  'homepage': 'homepage',
  'study-resource': 'study-resources',
  'profile': 'profiles',
  'general': 'general'
};

// File type validation
const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const documentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const allowedTypes = [...imageTypes, ...documentTypes];

// Size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadOptions {
  uploadType: UploadType;
  userId?: string;
  category?: string;
  maxSizeMB?: number;
  resourceType?: 'image' | 'raw' | 'auto';
}

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
  isCloudinary?: boolean;
}

/**
 * Validate file before upload
 */
function validateFile(file: Express.Multer.File, options: UploadOptions): { valid: boolean; error?: string } {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `File type ${file.mimetype} is not allowed. Allowed types: images (jpeg, png, gif, webp) and documents (pdf, doc, docx)` };
  }

  // Determine max size based on file type
  const isImage = imageTypes.includes(file.mimetype);
  const maxSize = options.maxSizeMB 
    ? options.maxSizeMB * 1024 * 1024 
    : (isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE);

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size exceeds maximum allowed size of ${maxSizeMB}MB` };
  }

  return { valid: true };
}

/**
 * Generate Cloudinary public ID
 */
function generatePublicId(uploadType: UploadType, userId?: string, originalName?: string): string {
  const folder = folderMap[uploadType];
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // Clean original filename
  const baseName = originalName 
    ? path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9-_]/g, '_')
    : 'file';
  
  if (userId) {
    return `${folder}/${userId}/${baseName}_${timestamp}_${randomSuffix}`;
  }
  
  return `${folder}/${baseName}_${timestamp}_${randomSuffix}`;
}

/**
 * Upload file to Cloudinary
 */
async function uploadToCloudinary(
  file: Express.Multer.File, 
  options: UploadOptions
): Promise<UploadResult> {
  const publicId = generatePublicId(options.uploadType, options.userId, file.originalname);
  const isImage = imageTypes.includes(file.mimetype);
  
  // Determine resource type
  const resourceType = options.resourceType || (isImage ? 'image' : 'raw');

  try {
    // Upload options
    const uploadOptions: any = {
      public_id: publicId,
      resource_type: resourceType,
      folder: '', // Folder is included in public_id
      overwrite: true,
      invalidate: true
    };

    // Add image-specific transformations
    if (isImage) {
      uploadOptions.transformation = [
        { quality: 'auto:best' },
        { fetch_format: 'auto' }
      ];
    }

    // Upload using buffer or file path
    let result: UploadApiResponse;
    
    if (file.buffer) {
      const folder = folderMap[options.uploadType] || 'general';
      console.log(`[CLOUDINARY] Uploading buffer to folder: ${folder}, publicId: ${publicId}`);
      // Upload from buffer
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            ...uploadOptions, 
            timeout: 60000,
            folder: folder // Explicitly set folder here as well
          },
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              console.error("[CLOUDINARY] Stream upload error:", error);
              reject(error);
            }
            else if (result) {
              console.log("[CLOUDINARY] Stream upload success:", result.secure_url);
              resolve(result);
            }
            else reject(new Error('No result from Cloudinary'));
          }
        );
        uploadStream.end(file.buffer);
      });
    } else if (file.path) {
      console.log("[CLOUDINARY] Uploading from file path:", file.path);
      result = await cloudinary.uploader.upload(file.path, uploadOptions);
    } else {
      return { success: false, error: 'No file data available for upload' };
    }

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      isCloudinary: true
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload to Cloudinary'
    };
  }
}

/**
 * Upload file to local storage (development fallback)
 * 
 * Files are stored in server/uploads/{folder}/... and served via /uploads route
 * URL returned here is relative to the /uploads static route
 */
async function uploadToLocal(
  file: Express.Multer.File, 
  options: UploadOptions
): Promise<UploadResult> {
  try {
    const folder = folderMap[options.uploadType] || 'general';
    const uploadDir = path.join('server/uploads', folder);
    
    // Create directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Generate unique filename with timestamp and random suffix for uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${baseName}_${timestamp}_${randomSuffix}${ext}`;
    
    // Determine full file path (may include user subdirectory)
    let filePath: string;
    if (options.userId) {
      const userDir = path.join(uploadDir, options.userId);
      await fs.mkdir(userDir, { recursive: true });
      filePath = path.join(userDir, filename);
    } else {
      filePath = path.join(uploadDir, filename);
    }
    
    // Write file to disk
    if (file.buffer) {
      await fs.writeFile(filePath, file.buffer);
    } else if (file.path) {
      await fs.copyFile(file.path, filePath);
    } else {
      return { success: false, error: 'No file data available for upload' };
    }
    
    // Generate URL for serving via /uploads static route
    // Extract path relative to server/uploads directory
    const relativeToUploads = filePath.replace(/\\/g, '/').replace(/^server\/uploads\//, '');
    const localUrl = `/uploads/${relativeToUploads}`;
    
    return {
      success: true,
      url: localUrl,
      isCloudinary: false
    };
  } catch (error: any) {
    console.error('Local upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file locally'
    };
  }
}

/**
 * Main upload function - automatically chooses Cloudinary or local storage
 */
export async function uploadFile(
  file: Express.Multer.File,
  options: UploadOptions
): Promise<UploadResult> {
  // Validate file
  const validation = validateFile(file, options);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Use Cloudinary in production, local storage in development
  if (useCloudinary) {
    return uploadToCloudinary(file, options);
  } else {
    console.log(`ℹ️ [STORAGE] Using local storage fallback for ${options.uploadType} upload`);
    return uploadToLocal(file, options);
  }
}

/**
 * Delete file from Cloudinary or local storage
 * 
 * Handles both Cloudinary URLs and local file URLs
 * Local URLs follow pattern: /uploads/{folder}/... which maps to server/uploads/{folder}/...
 */
export async function deleteFile(publicIdOrUrl: string): Promise<boolean> {
  if (!useCloudinary) {
    // For local files, reconstruct filesystem path from URL
    try {
      // Convert /uploads/homepage/file.jpg to server/uploads/homepage/file.jpg
      const localPath = publicIdOrUrl.startsWith('/uploads/')
        ? `server${publicIdOrUrl}`
        : publicIdOrUrl.startsWith('/')
        ? `server${publicIdOrUrl}`
        : publicIdOrUrl;
      
      await fs.unlink(localPath);
      return true;
    } catch (error) {
      console.error('Local file deletion error:', error);
      return false;
    }
  }

  try {
    // Extract public_id from Cloudinary URL if needed
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.includes('cloudinary.com')) {
      const match = publicIdOrUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (match) {
        publicId = match[1];
      }
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    return false;
  }
}

/**
 * Replace existing file with new upload
 */
export async function replaceFile(
  file: Express.Multer.File,
  oldPublicIdOrUrl: string | undefined,
  options: UploadOptions
): Promise<UploadResult> {
  // Upload new file first
  const uploadResult = await uploadFile(file, options);
  
  if (!uploadResult.success) {
    return uploadResult;
  }

  // Delete old file if provided
  if (oldPublicIdOrUrl) {
    await deleteFile(oldPublicIdOrUrl);
  }

  return uploadResult;
}

/**
 * Get optimized image URL with transformations
 */
export function getOptimizedUrl(
  url: string, 
  options?: { 
    width?: number; 
    height?: number; 
    quality?: number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  }
): string {
  // Only apply transformations to Cloudinary URLs
  if (!url.includes('cloudinary.com')) {
    return url;
  }

  const transformations: string[] = [];
  
  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.quality) transformations.push(`q_${options.quality}`);
  if (options?.format) transformations.push(`f_${options.format}`);
  
  if (transformations.length === 0) {
    return url;
  }

  // Insert transformations into Cloudinary URL
  return url.replace('/upload/', `/upload/${transformations.join(',')}/`);
}

/**
 * Check if Cloudinary is configured and ready
 */
export function isCloudinaryReady(): boolean {
  return hasCloudinaryConfig;
}

/**
 * Get storage info
 */
export function getStorageInfo() {
  return {
    type: useCloudinary ? 'cloudinary' : 'local',
    isProduction,
    cloudinaryConfigured: hasCloudinaryConfig
  };
}
