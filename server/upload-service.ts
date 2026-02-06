import { uploadFile, deleteFile, replaceFile as replaceFileCloudinary, isCloudinaryReady, getOptimizedUrl } from './cloudinary-service';
import type { UploadType as CloudinaryUploadType } from './cloudinary-service';

// Use the Multer.File type from the express namespace
type MulterFile = Express.Multer.File;

/**
 * Unified Upload Service
 * 
 * Automatically switches between Cloudinary (production) and local storage (development)
 * based on environment configuration.
 */

export type UploadType = 'homepage' | 'gallery' | 'profile' | 'study-resource' | 'general' | 'student' | 'teacher' | 'admin' | 'assignment' | 'result' | 'system_settings' | 'system-settings' | 'favicon' | 'logo';

export interface UploadOptions {
  uploadType: UploadType | string;
  maxSizeMB?: number;
  userId?: string;
  category?: string;
  classId?: number;
  subjectId?: number;
}

export interface UploadResponse {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
  isCloudinary?: boolean;
}

    // Map UploadType to Cloudinary upload types
    const uploadTypeMap: Record<string, CloudinaryUploadType> = {
      'profile': 'profile',
      'homepage': 'homepage',
      'gallery': 'gallery',
      'study-resource': 'study-resource',
      'general': 'general',
      'student': 'student',
      'teacher': 'teacher',
      'admin': 'admin',
      'assignment': 'assignment',
      'result': 'result',
      'system_settings': 'homepage',
      'system-settings': 'homepage',
      'favicon': 'homepage',
      'logo': 'homepage',
      'branding': 'homepage',
      'branding_upload': 'homepage',
      'schoolLogo': 'homepage'
    };

/**
 * Upload file using Cloudinary or local storage
 */
export async function uploadFileToStorage(
  file: Express.Multer.File,
  options: UploadOptions
): Promise<UploadResponse> {
  try {
    const cloudinaryType = uploadTypeMap[options.uploadType] || 'general';
    
    const result = await uploadFile(file, {
      uploadType: cloudinaryType as CloudinaryUploadType,
      userId: options.userId,
      category: options.category,
      maxSizeMB: options.maxSizeMB || 5
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'The storage service was unable to accept this file. Please ensure it is a valid image and try again.'
      };
    }

    return {
      success: true,
      url: result.url,
      isCloudinary: result.isCloudinary
    };
  } catch (error: any) {
    console.error('Upload service error:', error);
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
}

/**
 * Replace an existing file with a new one
 */
export async function replaceFile(
  file: Express.Multer.File,
  oldUrl: string | undefined,
  options: UploadOptions
): Promise<UploadResponse> {
  try {
    const cloudinaryType = uploadTypeMap[options.uploadType] || 'general';
    
    const result = await replaceFileCloudinary(file, oldUrl, {
      uploadType: cloudinaryType as CloudinaryUploadType,
      userId: options.userId,
      category: options.category,
      maxSizeMB: options.maxSizeMB || 5
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'File replacement failed'
      };
    }

    return {
      success: true,
      url: result.url,
      isCloudinary: result.isCloudinary
    };
  } catch (error: any) {
    console.error('File replacement error:', error);
    return {
      success: false,
      error: error.message || 'File replacement failed'
    };
  }
}

/**
 * Delete a file
 */
export async function deleteFileFromStorage(url: string | undefined): Promise<boolean> {
  if (!url) {
    return true; // No file to delete
  }

  try {
    return await deleteFile(url);
  } catch (error: any) {
    console.error('File deletion error:', error);
    return false;
  }
}

/**
 * Get optimized image URL (Cloudinary only)
 */
export function getOptimizedImageUrl(
  url: string,
  options?: { width?: number; height?: number; quality?: number; format?: 'auto' | 'webp' | 'jpg' | 'png' }
): string {
  return getOptimizedUrl(url, options);
}

/**
 * Check if storage is ready
 */
export function isStorageReady(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return isCloudinaryReady();
  }
  return true; // Local storage always ready
}
