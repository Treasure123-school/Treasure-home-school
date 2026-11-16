/** UserDataDeleter — common user data + file batch cleanup. */
import { eq, or } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";
import { deleteFile, useCloudinary } from "../cloudinary-service";
import { v2 as cloudinary } from "cloudinary";
import { UserRoleDataDeleter } from "./user-role-deleter";

export class UserDataDeleter extends UserRoleDataDeleter {
  async deleteCommonUserData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting common user data...');

    try {
      const homePageContent = await db.select({ imageUrl: schema.homePageContent.imageUrl })
        .from(schema.homePageContent)
        .where(eq(schema.homePageContent.uploadedBy, userId));
      
      for (const content of homePageContent) {
        this.addFileToDelete(content.imageUrl);
      }
      
      await db.update(schema.homePageContent)
        .set({ uploadedBy: null })
        .where(eq(schema.homePageContent.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling homepage content: ${(e as Error).message}`);
    }

    try {
      const galleryItems = await db.select({ imageUrl: schema.gallery.imageUrl })
        .from(schema.gallery)
        .where(eq(schema.gallery.uploadedBy, userId));
      
      for (const item of galleryItems) {
        this.addFileToDelete(item.imageUrl);
      }
      
      await db.update(schema.gallery)
        .set({ uploadedBy: null })
        .where(eq(schema.gallery.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling gallery: ${(e as Error).message}`);
    }

    try {
      const studyResources = await db.select({ fileUrl: schema.studyResources.fileUrl })
        .from(schema.studyResources)
        .where(eq(schema.studyResources.uploadedBy, userId));
      
      for (const resource of studyResources) {
        this.addFileToDelete(resource.fileUrl);
      }
      
      await db.update(schema.studyResources)
        .set({ uploadedBy: null })
        .where(eq(schema.studyResources.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling study resources: ${(e as Error).message}`);
    }

    try {
      const tokensResult = await db.delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, userId))
        .returning();
      this.deletionService.recordDeletion('password_reset_tokens', tokensResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting password tokens: ${(e as Error).message}`);
    }

    try {
      const invitesAcceptedResult = await db.delete(schema.invites)
        .where(eq(schema.invites.acceptedBy, userId))
        .returning();
      const invitesCreatedResult = await db.delete(schema.invites)
        .where(eq(schema.invites.createdBy, userId))
        .returning();
      this.deletionService.recordDeletion('invites', invitesAcceptedResult.length + invitesCreatedResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting invites: ${(e as Error).message}`);
    }

    try {
      const notificationsResult = await db.delete(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .returning();
      this.deletionService.recordDeletion('notifications', notificationsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting notifications: ${(e as Error).message}`);
    }

    try {
      const messagesResult = await db.delete(schema.messages)
        .where(or(
          eq(schema.messages.senderId, userId),
          eq(schema.messages.recipientId, userId)
        ))
        .returning();
      this.deletionService.recordDeletion('messages', messagesResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting messages: ${(e as Error).message}`);
    }

    try {
      const announcementsResult = await db.delete(schema.announcements)
        .where(eq(schema.announcements.authorId, userId))
        .returning();
      this.deletionService.recordDeletion('announcements', announcementsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting announcements: ${(e as Error).message}`);
    }

    try {
      const perfEventsResult = await db.delete(schema.performanceEvents)
        .where(eq(schema.performanceEvents.userId, userId))
        .returning();
      this.deletionService.recordDeletion('performance_events', perfEventsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting performance events: ${(e as Error).message}`);
    }

    try {
      const auditResult = await db.delete(schema.auditLogs)
        .where(eq(schema.auditLogs.userId, userId))
        .returning();
      this.deletionService.recordDeletion('audit_logs', auditResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting audit logs: ${(e as Error).message}`);
    }

    try {
      const accessLogsResult = await db.delete(schema.unauthorizedAccessLogs)
        .where(eq(schema.unauthorizedAccessLogs.userId, userId))
        .returning();
      this.deletionService.recordDeletion('unauthorized_access_logs', accessLogsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting access logs: ${(e as Error).message}`);
    }

    try {
      await db.update(schema.contactMessages)
        .set({ respondedBy: null })
        .where(eq(schema.contactMessages.respondedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.systemSettings)
        .set({ updatedBy: null })
        .where(eq(schema.systemSettings.updatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.settings)
        .set({ updatedBy: null })
        .where(eq(schema.settings.updatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.attendance)
        .set({ recordedBy: null })
        .where(eq(schema.attendance.recordedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.questionBanks)
        .set({ createdBy: null })
        .where(eq(schema.questionBanks.createdBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.gradingBoundaries)
        .set({ createdBy: null })
        .where(eq(schema.gradingBoundaries.createdBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherClassAssignments)
        .set({ assignedBy: null })
        .where(eq(schema.teacherClassAssignments.assignedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherAssignmentHistory)
        .set({ performedBy: null })
        .where(eq(schema.teacherAssignmentHistory.performedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.studentSubjectAssignments)
        .set({ assignedBy: null })
        .where(eq(schema.studentSubjectAssignments.assignedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCards)
        .set({ generatedBy: null })
        .where(eq(schema.reportCards.generatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCards)
        .set({ signedBy: null })
        .where(eq(schema.reportCards.signedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherProfiles)
        .set({ verifiedBy: null })
        .where(eq(schema.teacherProfiles.verifiedBy, userId));
    } catch (e) {}
  }

  async deleteFilesInBatch(urls: string[]): Promise<number> {
    const validUrls = urls.filter(url => url && url.trim().length > 0);
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
              this.deletionService.recordDeletion('cloudinary_files', batchSuccess);
              console.log(`[SmartDeletion] Cloudinary batch: ${batchSuccess}/${batch.length} files deleted`);
            } catch (batchError: any) {
              console.error(`[SmartDeletion] Cloudinary batch error:`, batchError.message);
              this.deletionService.recordError(`Cloudinary batch error: ${batchError.message}`);
              for (const id of batch) {
                try {
                  const singleResult = await cloudinary.uploader.destroy(id);
                  if (singleResult.result === 'ok') {
                    successCount++;
                    this.deletionService.recordDeletion('cloudinary_files', 1);
                  }
                } catch (singleError) {
                  console.error(`[SmartDeletion] Failed to delete ${id}`);
                }
              }
            }
          }
        } catch (error: any) {
          console.error('[SmartDeletion] Cloudinary deletion failed:', error.message);
          this.deletionService.recordError(`Cloudinary deletion failed: ${error.message}`);
        }
      }

      for (const url of localUrls) {
        const success = await deleteFile(url);
        if (success) {
          successCount++;
          this.deletionService.recordDeletion('local_files', 1);
        }
      }
    } else {
      for (const url of validUrls) {
        const success = await deleteFile(url);
        if (success) {
          successCount++;
          this.deletionService.recordDeletion('local_files', 1);
        }
      }
    }

    console.log(`[SmartDeletion] File cleanup complete: ${successCount}/${validUrls.length} files deleted`);
    return successCount;
  }

  getFilesToDelete(): string[] {
    return this.filesToDelete;
  }

  resetFiles() {
    this.filesToDelete = [];
  }
}
