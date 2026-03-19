import { v2 as cloudinary } from 'cloudinary';
import { deleteFile, useCloudinary } from '../cloudinary-service';
import fs from 'fs/promises';
import path from 'path';

export interface DeletionResult {
  success: boolean;
  deletedRecords: {
    tableName: string;
    count: number;
  }[];
  deletedFiles: {
    url: string;
    success: boolean;
    error?: string;
  }[];
  errors: string[];
  duration: number;
  summary: string;
}

export interface FileInfo {
  url: string;
  type: 'profile' | 'gallery' | 'study-resource' | 'signature' | 'general';
}

export class DeletionService {
  private deletedRecords: DeletionResult['deletedRecords'] = [];
  private deletedFiles: DeletionResult['deletedFiles'] = [];
  private errors: string[] = [];
  private startTime: number = 0;

  reset() {
    this.deletedRecords = [];
    this.deletedFiles = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  recordDeletion(tableName: string, count: number) {
    const existing = this.deletedRecords.find(r => r.tableName === tableName);
    if (existing) {
      existing.count += count;
    } else {
      this.deletedRecords.push({ tableName, count });
    }
  }

  recordError(error: string) {
    this.errors.push(error);
    console.error(`[DeletionService] ${error}`);
  }

  async deleteFileFromStorage(url: string | null | undefined): Promise<boolean> {
    if (!url) return true;

    try {
      const success = await deleteFile(url);
      this.deletedFiles.push({ url, success });
      return success;
    } catch (error: any) {
      this.deletedFiles.push({ 
        url, 
        success: false, 
        error: error.message || 'Unknown error' 
      });
      this.recordError(`Failed to delete file ${url}: ${error.message}`);
      return false;
    }
  }

  async deleteFilesInBatch(urls: (string | null | undefined)[]): Promise<number> {
    const validUrls = urls.filter((url): url is string => !!url);
    if (validUrls.length === 0) return 0;

    let successCount = 0;

    if (useCloudinary) {
      const cloudinaryUrls: string[] = [];
      const localUrls: string[] = [];

      for (const url of validUrls) {
        if (url.includes('cloudinary.com')) {
          cloudinaryUrls.push(url);
        } else {
          localUrls.push(url);
        }
      }

      if (cloudinaryUrls.length > 0) {
        const publicIds = cloudinaryUrls.map(url => {
          const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
          return match ? match[1] : url;
        }).filter(Boolean);

        try {
          const batchSize = 100;
          for (let i = 0; i < publicIds.length; i += batchSize) {
            const batch = publicIds.slice(i, i + batchSize);
            try {
              const result = await cloudinary.api.delete_resources(batch);
              const batchSuccess = Object.values(result.deleted || {}).filter(v => v === 'deleted').length;
              successCount += batchSuccess;
              
              batch.forEach((id, index) => {
                const url = cloudinaryUrls[i + index];
                const deleted = result.deleted?.[id] === 'deleted';
                this.deletedFiles.push({ url, success: deleted });
              });
            } catch (batchError: any) {
              this.recordError(`Cloudinary batch delete error: ${batchError.message}`);
              for (const id of batch) {
                try {
                  const singleResult = await cloudinary.uploader.destroy(id);
                  if (singleResult.result === 'ok') successCount++;
                  this.deletedFiles.push({ 
                    url: id, 
                    success: singleResult.result === 'ok' 
                  });
                } catch (singleError: any) {
                  this.deletedFiles.push({ 
                    url: id, 
                    success: false, 
                    error: singleError.message 
                  });
                }
              }
            }
          }
        } catch (error: any) {
          this.recordError(`Cloudinary batch deletion failed: ${error.message}`);
        }
      }

      for (const url of localUrls) {
        const success = await this.deleteLocalFile(url);
        if (success) successCount++;
      }
    } else {
      for (const url of validUrls) {
        const success = await this.deleteLocalFile(url);
        if (success) successCount++;
      }
    }

    return successCount;
  }

  private async deleteLocalFile(url: string): Promise<boolean> {
    try {
      const localPath = url.startsWith('/') ? url.substring(1) : url;
      await fs.unlink(localPath);
      this.deletedFiles.push({ url, success: true });
      return true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.deletedFiles.push({ url, success: false, error: error.message });
      }
      return false;
    }
  }

  getResult(): DeletionResult {
    const duration = Date.now() - this.startTime;
    const totalRecords = this.deletedRecords.reduce((sum, r) => sum + r.count, 0);
    const successfulFiles = this.deletedFiles.filter(f => f.success).length;
    
    return {
      success: this.errors.length === 0,
      deletedRecords: this.deletedRecords,
      deletedFiles: this.deletedFiles,
      errors: this.errors,
      duration,
      summary: `Deleted ${totalRecords} records from ${this.deletedRecords.length} tables, ` +
               `${successfulFiles}/${this.deletedFiles.length} files removed in ${duration}ms`
    };
  }
}

export function extractCloudinaryPublicId(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
  return match ? match[1] : null;
}

export function formatDeletionLog(result: DeletionResult, userId: string, userRole: string): string {
  const lines: string[] = [
    `════════════════════════════════════════════════════════`,
    `         USER DELETION AUDIT LOG                         `,
    `════════════════════════════════════════════════════════`,
    `User ID: ${userId}`,
    `Role: ${userRole}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Duration: ${result.duration}ms`,
    `Status: ${result.success ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`,
    ``,
    `─────────────── DELETED RECORDS ────────────────────────`,
  ];

  if (result.deletedRecords.length > 0) {
    for (const record of result.deletedRecords) {
      lines.push(`  ${record.tableName}: ${record.count} records`);
    }
  } else {
    lines.push(`  No records deleted`);
  }

  lines.push(``);
  lines.push(`─────────────── DELETED FILES ──────────────────────────`);
  
  if (result.deletedFiles.length > 0) {
    const successful = result.deletedFiles.filter(f => f.success);
    const failed = result.deletedFiles.filter(f => !f.success);
    
    lines.push(`  Successful: ${successful.length}`);
    lines.push(`  Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      lines.push(`  Failed files:`);
      for (const file of failed) {
        lines.push(`    - ${file.url}: ${file.error || 'Unknown error'}`);
      }
    }
  } else {
    lines.push(`  No files to delete`);
  }

  if (result.errors.length > 0) {
    lines.push(``);
    lines.push(`─────────────── ERRORS ─────────────────────────────────`);
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }

  lines.push(``);
  lines.push(`════════════════════════════════════════════════════════`);
  lines.push(result.summary);
  lines.push(`════════════════════════════════════════════════════════`);

  return lines.join('\n');
}

export const deletionService = new DeletionService();
