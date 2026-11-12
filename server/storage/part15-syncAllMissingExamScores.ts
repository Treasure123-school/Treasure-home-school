/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { AboutSection, AdmissionsEnquiry, BillingFeatureLink, BillingItem, BillingPayment, Exam, Faq, Gallery, InsertAboutSection, InsertAdmissionsEnquiry, InsertBillingFeatureLink, InsertBillingItem, InsertBillingPayment, InsertFaq, InsertGallery, InsertMessage, InsertMonnifyVirtualAccount, InsertNewsPost, Message, MonnifyVirtualAccount, NewsPost, Student } from '@shared/schema';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseStorageP14 } from './part14-addMissingSubjectsToReportCards'
import type { IStorage } from './types'

export class DatabaseStorageP15 extends DatabaseStorageP14 {
  async syncAllMissingExamScores(termId?: number): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      console.log(`[SYNC-ALL-MISSING] Starting comprehensive sync of missing exam scores...`);

      // Get current term if not specified
      let targetTermId = termId;
      if (!targetTermId) {
        const currentTerm = await this.getCurrentTerm();
        if (currentTerm) {
          targetTermId = currentTerm.id;
        }
      }

      // Find all exam results where:
      // 1. The exam is of type 'exam' (main exam)
      // 2. There's a report card for that student/term
      // 3. The report card item exists but has NULL exam_score
      // OR the report card item doesn't exist at all
      const missingExamScores = await db.select({
        examResultId: schema.examResults.id,
        studentId: schema.examResults.studentId,
        examId: schema.examResults.examId,
        // COALESCE both score columns so whichever is populated wins
        score: sql<number>`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}, 0)`,
        // exam_results.maxScore is the ACTUAL max the exam was marked out of (e.g. 60).
        // exams.totalMarks is the template default (often 100) and must only be a fallback.
        maxScore: sql<number>`COALESCE(${schema.examResults.maxScore}, ${schema.exams.totalMarks}, 100)`,
        examType: schema.exams.examType,
        subjectId: schema.exams.subjectId,
        classId: schema.exams.classId,
        examTermId: schema.exams.termId,
        gradingScale: schema.exams.gradingScale,
        createdBy: schema.exams.createdBy,
        reportCardId: schema.reportCards.id,
        reportCardItemId: schema.reportCardItems.id,
        currentExamScore: schema.reportCardItems.examScore,
        currentTestScore: schema.reportCardItems.testScore
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .innerJoin(schema.reportCards, and(
          eq(schema.reportCards.studentId, schema.examResults.studentId),
          eq(schema.reportCards.termId, schema.exams.termId)
        ))
        .leftJoin(schema.reportCardItems, and(
          eq(schema.reportCardItems.reportCardId, schema.reportCards.id),
          eq(schema.reportCardItems.subjectId, schema.exams.subjectId)
        ))
        .where(and(
          // Only process results that actually have a score in at least one column
          sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`,
          targetTermId ? eq(schema.exams.termId, targetTermId) : undefined,
          // Only touch items that have NOT been manually overridden by a teacher/admin.
          // isNull covers brand-new items (no row yet); eq(...false) covers existing non-overridden rows.
          or(
            isNull(schema.reportCardItems.isOverridden),
            eq(schema.reportCardItems.isOverridden, false)
          )
          // NOTE: we intentionally do NOT filter on examScore IS NULL / testScore IS NULL.
          // This function must UPDATE stale/wrong scores, not only fill in blanks.
        ));

      console.log(`[SYNC-ALL-MISSING] Found ${missingExamScores.length} exam results to sync (including stale scores)`);

      // Group by report card to batch recalculations
      const reportCardIdsToRecalculate = new Set<number>();

      // Helper: process one score record — writes the score from exam_results into the report card item.
      // Runs for every graded result regardless of whether the item already has a score,
      // so stale/wrong scores are always corrected.
      const processRecord = async (record: typeof missingExamScores[number]): Promise<void> => {
        const isTest     = ['test', 'quiz', 'assignment'].includes(record.examType);
        const isMainExam = ['exam', 'final', 'midterm'].includes(record.examType);

        const safeScore    = typeof record.score    === 'number' ? record.score    : parseInt(String(record.score),    10) || 0;
        const safeMaxScore = typeof record.maxScore === 'number' ? record.maxScore : parseInt(String(record.maxScore), 10) || 0;

        if (record.reportCardItemId) {
          const updateData: any = { updatedAt: new Date() };
          if (isTest) {
            updateData.testExamId = record.examId; updateData.testExamCreatedBy = record.createdBy;
            updateData.testScore  = safeScore;     updateData.testMaxScore      = safeMaxScore;
          } else if (isMainExam) {
            updateData.examExamId = record.examId; updateData.examExamCreatedBy = record.createdBy;
            updateData.examScore  = safeScore;     updateData.examMaxScore      = safeMaxScore;
          }
          await db.update(schema.reportCardItems).set(updateData).where(eq(schema.reportCardItems.id, record.reportCardItemId));
          reportCardIdsToRecalculate.add(record.reportCardId);
          synced++;
        } else if (record.reportCardId && record.subjectId) {
          const newItem = await db.insert(schema.reportCardItems)
            .values({
              reportCardId:    record.reportCardId,
              subjectId:       record.subjectId,
              totalMarks:      100,
              obtainedMarks:   0,
              percentage:      0,
              testExamId:          isTest     ? record.examId    : null,
              testExamCreatedBy:   isTest     ? record.createdBy : null,
              testScore:           isTest     ? safeScore        : null,
              testMaxScore:        isTest     ? safeMaxScore     : null,
              examExamId:          isMainExam ? record.examId    : null,
              examExamCreatedBy:   isMainExam ? record.createdBy : null,
              examScore:           isMainExam ? safeScore        : null,
              examMaxScore:        isMainExam ? safeMaxScore     : null,
            })
            .onConflictDoNothing()
            .returning();
          if (newItem.length > 0) {
            reportCardIdsToRecalculate.add(record.reportCardId);
            synced++;
          }
        }
      };

      // Process records in concurrent batches of 40 — much faster than serial await
      const RECORD_BATCH = 40;
      for (let i = 0; i < missingExamScores.length; i += RECORD_BATCH) {
        const batch = missingExamScores.slice(i, i + RECORD_BATCH);
        const batchResults = await Promise.allSettled(batch.map((r: typeof missingExamScores[number]) => processRecord(r)));
        for (const result of batchResults) {
          if (result.status === 'rejected') {
            failed++;
            errors.push(String(result.reason?.message ?? result.reason));
          }
        }
      }

      // Re-apply weighted scores (testWeight/examWeight) and recalculate grades for all
      // affected report cards.  reapplyWeightedScoresToItems reads each card's own
      // gradingScale and the current system-settings weights, so this is consistent
      // with the individual "Recalculate" button.
      console.log(`[SYNC-ALL-MISSING] Recalculating weighted scores for ${reportCardIdsToRecalculate.size} report cards...`);
      const rcIds = [...reportCardIdsToRecalculate];
      const RECALC_BATCH = 40;
      for (let i = 0; i < rcIds.length; i += RECALC_BATCH) {
        const batch = rcIds.slice(i, i + RECALC_BATCH);
        await Promise.allSettled(batch.map(rcId =>
          this.reapplyWeightedScoresToItems(rcId).catch((e: any) => {
            errors.push(`Failed to recalculate report card ${rcId}: ${e.message}`);
          })
        ));
      }

      console.log(`[SYNC-ALL-MISSING] Completed: ${synced} synced, ${failed} failed`);
      return { synced, failed, errors };
    } catch (error: any) {
      console.error('[SYNC-ALL-MISSING] Error:', error);
      return { synced: 0, failed: 0, errors: [error.message] };
    }
  }

  /**
   * Bulk sync all results for a specific exam to report cards
   * Useful for teachers to sync all their exam results at once
   */

  async syncExamResultsToReportCards(examId: number): Promise<{ synced: number; failed: number; errors: string[] }> {
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      console.log(`[SYNC-EXAM-RESULTS] Starting bulk sync for exam ${examId}...`);

      // Get all results for this exam — COALESCE both score columns so whichever is populated wins
      const examResults = await db.select({
        id: schema.examResults.id,
        studentId: schema.examResults.studentId,
        score: sql<number>`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}, 0)`,
        maxScore: sql<number>`COALESCE(${schema.examResults.maxScore}, ${schema.exams.totalMarks}, 100)`
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(and(
          eq(schema.examResults.examId, examId),
          // Accept records where either score column has a value
          sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`
        ));

      console.log(`[SYNC-EXAM-RESULTS] Found ${examResults.length} results to sync for exam ${examId}`);

      // Get exam details
      const exam = await this.getExamById(examId);
      if (!exam) {
        return { synced: 0, failed: 0, errors: ['Exam not found'] };
      }

      for (const result of examResults) {
        try {
          const syncResult = await this.syncExamScoreToReportCard(
            result.studentId,
            examId,
            result.score || 0,
            result.maxScore || exam.totalMarks || 100,
            true  // forceSync = true: explicit teacher bulk sync bypasses isOverridden
          );

          if (syncResult.success) {
            synced++;
          } else {
            failed++;
            errors.push(`Student ${result.studentId}: ${syncResult.message}`);
          }
        } catch (studentError: any) {
          failed++;
          errors.push(`Student ${result.studentId}: ${studentError.message}`);
        }
      }

      console.log(`[SYNC-EXAM-RESULTS] Completed: ${synced} synced, ${failed} failed`);
      return { synced, failed, errors };
    } catch (error: any) {
      console.error('[SYNC-EXAM-RESULTS] Error:', error);
      return { synced: 0, failed: 0, errors: [error.message] };
    }
  }

  // Report Card Skills Methods

  async saveReportCardSkills(reportCardId: number, skills: any): Promise<any> {
    try {
      const existing = await this.getReportCardSkills(reportCardId);

      if (existing) {
        // Only update fields that are explicitly provided in the payload
        // Use incoming value if provided (including 0 for intentional clears), otherwise keep existing
        const mergeSkill = (key: string, existingVal: number) => {
          const newVal = skills[key];
          // If field is present in payload, use it (allows intentional 0s); otherwise keep existing
          return (newVal !== undefined) ? newVal : (existingVal ?? 0);
        };

        const result = await db.update(schema.reportCardSkills)
          .set({
            punctuality: mergeSkill('punctuality', existing.punctuality),
            neatness: mergeSkill('neatness', existing.neatness),
            attentiveness: mergeSkill('attentiveness', existing.attentiveness),
            teamwork: mergeSkill('teamwork', existing.teamwork),
            leadership: mergeSkill('leadership', existing.leadership),
            assignments: mergeSkill('assignments', existing.assignments),
            classParticipation: mergeSkill('classParticipation', existing.classParticipation),
            honesty: mergeSkill('honesty', existing.honesty ?? 0),
            politeness: mergeSkill('politeness', existing.politeness ?? 0),
            selfControl: mergeSkill('selfControl', existing.selfControl ?? 0),
            obedience: mergeSkill('obedience', existing.obedience ?? 0),
            reliability: mergeSkill('reliability', existing.reliability ?? 0),
            senseOfResponsibility: mergeSkill('senseOfResponsibility', existing.senseOfResponsibility ?? 0),
            relationshipWithOthers: mergeSkill('relationshipWithOthers', existing.relationshipWithOthers ?? 0),
            sports: mergeSkill('sports', existing.sports),
            handwriting: mergeSkill('handwriting', existing.handwriting),
            musicalSkills: mergeSkill('musicalSkills', existing.musicalSkills),
            creativity: mergeSkill('creativity', existing.creativity),
            handlingOfTools: mergeSkill('handlingOfTools', existing.handlingOfTools ?? 0),
            drawingPainting: mergeSkill('drawingPainting', existing.drawingPainting ?? 0),
            publicSpeaking: mergeSkill('publicSpeaking', existing.publicSpeaking ?? 0),
            speechFluency: mergeSkill('speechFluency', existing.speechFluency ?? 0),
            recordedBy: skills.recordedBy,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCardSkills.reportCardId, reportCardId))
          .returning();
        return result[0];
      } else {
        const result = await db.insert(schema.reportCardSkills)
          .values({
            reportCardId,
            punctuality: skills.punctuality || 0,
            neatness: skills.neatness || 0,
            attentiveness: skills.attentiveness || 0,
            teamwork: skills.teamwork || 0,
            leadership: skills.leadership || 0,
            assignments: skills.assignments || 0,
            classParticipation: skills.classParticipation || 0,
            honesty: skills.honesty || 0,
            politeness: skills.politeness || 0,
            selfControl: skills.selfControl || 0,
            obedience: skills.obedience || 0,
            reliability: skills.reliability || 0,
            senseOfResponsibility: skills.senseOfResponsibility || 0,
            relationshipWithOthers: skills.relationshipWithOthers || 0,
            sports: skills.sports || 0,
            handwriting: skills.handwriting || 0,
            musicalSkills: skills.musicalSkills || 0,
            creativity: skills.creativity || 0,
            handlingOfTools: skills.handlingOfTools || 0,
            drawingPainting: skills.drawingPainting || 0,
            publicSpeaking: skills.publicSpeaking || 0,
            speechFluency: skills.speechFluency || 0,
            recordedBy: skills.recordedBy
          })
          .returning();
        return result[0];
      }
    } catch (error: any) {
      console.error('Error saving report card skills:', error);
      throw error;
    }
  }

  // Monnify Virtual Accounts Methods

  async getMonnifyVirtualAccountByUserId(userId: string): Promise<MonnifyVirtualAccount | undefined> {
    try {
      const result = await this.db.select()
        .from(schema.monnifyVirtualAccounts)
        .where(eq(schema.monnifyVirtualAccounts.userId, userId))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error(`Error getting Monnify virtual account for user ${userId}:`, error);
      return undefined;
    }
  }


  async getMonnifyVirtualAccountByReference(accountReference: string): Promise<MonnifyVirtualAccount | undefined> {
    try {
      const result = await this.db.select()
        .from(schema.monnifyVirtualAccounts)
        .where(eq(schema.monnifyVirtualAccounts.accountReference, accountReference))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error(`Error getting Monnify virtual account by ref ${accountReference}:`, error);
      return undefined;
    }
  }


  async createMonnifyVirtualAccount(data: InsertMonnifyVirtualAccount): Promise<MonnifyVirtualAccount> {
    try {
      const result = await this.db.insert(schema.monnifyVirtualAccounts)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      console.error('Error creating Monnify virtual account:', error);
      throw error;
    }
  }

  // Messages

  async sendMessage(message: InsertMessage): Promise<Message> {
    const result = await this.db.insert(schema.messages).values(message).returning();
    return result[0];
  }


  async getMessagesByUser(userId: string): Promise<any[]> {
    const sender = alias(schema.users, "sender");
    const recipient = alias(schema.users, "recipient");

    return await this.db.select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      recipientId: schema.messages.recipientId,
      subject: schema.messages.subject,
      content: schema.messages.content,
      isRead: schema.messages.isRead,
      createdAt: schema.messages.createdAt,
      senderName: sql<string>`COALESCE(${sender.firstName}, '') || ' ' || COALESCE(${sender.lastName}, '')`,
      recipientName: sql<string>`COALESCE(${recipient.firstName}, '') || ' ' || COALESCE(${recipient.lastName}, '')`
    })
      .from(schema.messages)
      .leftJoin(sender, eq(schema.messages.senderId, sender.id))
      .leftJoin(recipient, eq(schema.messages.recipientId, recipient.id))
      .where(or(
        eq(schema.messages.senderId, userId),
        eq(schema.messages.recipientId, userId)
      ))
      .orderBy(desc(schema.messages.createdAt));
  }


  async markMessageAsRead(id: number): Promise<void> {
    await this.db.update(schema.messages)
      .set({ isRead: true })
      .where(eq(schema.messages.id, id));
  }

  // ─── Gallery extensions ──────────────────────────────────────

  async deleteGalleryCategory(id: number): Promise<boolean> {
    const result = await db.delete(schema.galleryCategories)
      .where(eq(schema.galleryCategories.id, id))
      .returning({ id: schema.galleryCategories.id });
    return result.length > 0;
  }


  async updateGalleryImage(id: string, data: Partial<InsertGallery>): Promise<Gallery | undefined> {
    const result = await db.update(schema.gallery)
      .set(data as any)
      .where(eq(schema.gallery.id, parseInt(id)))
      .returning();
    return result[0];
  }

  // ─── News Posts ───────────────────────────────────────────────

  async createNewsPost(post: InsertNewsPost): Promise<NewsPost> {
    const result = await db.insert(schema.newsPosts).values(post as any).returning();
    return result[0] as unknown as NewsPost;
  }


  async getNewsPosts(filters: { status?: string; category?: string }): Promise<NewsPost[]> {
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(schema.newsPosts.status, filters.status));
    if (filters.category) conditions.push(eq(schema.newsPosts.category, filters.category));
    const query = db.select().from(schema.newsPosts).orderBy(desc(schema.newsPosts.createdAt));
    const result = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await query;
    return result as unknown as NewsPost[];
  }


  async getNewsPostById(id: number): Promise<NewsPost | undefined> {
    const result = await db.select().from(schema.newsPosts).where(eq(schema.newsPosts.id, id)).limit(1);
    return result[0] as unknown as NewsPost | undefined;
  }


  async getNewsPostBySlug(slug: string): Promise<NewsPost | undefined> {
    const result = await db.select().from(schema.newsPosts).where(eq(schema.newsPosts.slug, slug)).limit(1);
    return result[0] as unknown as NewsPost | undefined;
  }


  async updateNewsPost(id: number, data: Partial<InsertNewsPost>): Promise<NewsPost | undefined> {
    const result = await db.update(schema.newsPosts).set(data as any).where(eq(schema.newsPosts.id, id)).returning();
    return result[0] as unknown as NewsPost | undefined;
  }


  async deleteNewsPost(id: number): Promise<boolean> {
    const result = await db.delete(schema.newsPosts).where(eq(schema.newsPosts.id, id)).returning({ id: schema.newsPosts.id });
    return result.length > 0;
  }

  // ─── FAQs ─────────────────────────────────────────────────────

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const result = await db.insert(schema.faqs).values(faq as any).returning();
    return result[0] as unknown as Faq;
  }


  async getFaqs(filters: { isActive?: boolean; category?: string }): Promise<Faq[]> {
    const conditions: any[] = [];
    if (filters.isActive !== undefined) conditions.push(eq(schema.faqs.isActive, filters.isActive));
    if (filters.category) conditions.push(eq(schema.faqs.category, filters.category));
    const query = db.select().from(schema.faqs).orderBy(asc(schema.faqs.displayOrder), asc(schema.faqs.id));
    const result = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await query;
    return result as unknown as Faq[];
  }


  async getFaqById(id: number): Promise<Faq | undefined> {
    const result = await db.select().from(schema.faqs).where(eq(schema.faqs.id, id)).limit(1);
    return result[0] as unknown as Faq | undefined;
  }


  async updateFaq(id: number, data: Partial<InsertFaq>): Promise<Faq | undefined> {
    const result = await db.update(schema.faqs).set(data as any).where(eq(schema.faqs.id, id)).returning();
    return result[0] as unknown as Faq | undefined;
  }


  async deleteFaq(id: number): Promise<boolean> {
    const result = await db.delete(schema.faqs).where(eq(schema.faqs.id, id)).returning({ id: schema.faqs.id });
    return result.length > 0;
  }

  // ─── About Sections ───────────────────────────────────────────

  async createAboutSection(section: InsertAboutSection): Promise<AboutSection> {
    const result = await db.insert(schema.aboutSections).values(section as any).returning();
    return result[0] as unknown as AboutSection;
  }


  async getAboutSections(filters: { isActive?: boolean }): Promise<AboutSection[]> {
    const conditions: any[] = [];
    if (filters.isActive !== undefined) conditions.push(eq(schema.aboutSections.isActive, filters.isActive));
    const query = db.select().from(schema.aboutSections).orderBy(asc(schema.aboutSections.displayOrder));
    const result = conditions.length > 0 ? await query.where(conditions[0]) : await query;
    return result as unknown as AboutSection[];
  }


  async getAboutSectionById(id: number): Promise<AboutSection | undefined> {
    const result = await db.select().from(schema.aboutSections).where(eq(schema.aboutSections.id, id)).limit(1);
    return result[0] as unknown as AboutSection | undefined;
  }


  async updateAboutSection(id: number, data: Partial<InsertAboutSection>): Promise<AboutSection | undefined> {
    const result = await db.update(schema.aboutSections).set(data as any).where(eq(schema.aboutSections.id, id)).returning();
    return result[0] as unknown as AboutSection | undefined;
  }


  async deleteAboutSection(id: number): Promise<boolean> {
    const result = await db.delete(schema.aboutSections).where(eq(schema.aboutSections.id, id)).returning({ id: schema.aboutSections.id });
    return result.length > 0;
  }

  // ─── Admissions Enquiries ─────────────────────────────────────

  async createAdmissionsEnquiry(enquiry: InsertAdmissionsEnquiry): Promise<AdmissionsEnquiry> {
    const result = await db.insert(schema.admissionsEnquiries).values(enquiry as any).returning();
    return result[0] as unknown as AdmissionsEnquiry;
  }


  async getAdmissionsEnquiries(status?: string): Promise<AdmissionsEnquiry[]> {
    if (status) {
      const result = await db.select().from(schema.admissionsEnquiries)
        .where(eq(schema.admissionsEnquiries.status, status))
        .orderBy(desc(schema.admissionsEnquiries.createdAt));
      return result as unknown as AdmissionsEnquiry[];
    }
    const result = await db.select().from(schema.admissionsEnquiries).orderBy(desc(schema.admissionsEnquiries.createdAt));
    return result as unknown as AdmissionsEnquiry[];
  }


  async updateAdmissionsEnquiry(id: number, data: Partial<AdmissionsEnquiry>): Promise<AdmissionsEnquiry | undefined> {
    const result = await db.update(schema.admissionsEnquiries).set(data as any).where(eq(schema.admissionsEnquiries.id, id)).returning();
    return result[0] as unknown as AdmissionsEnquiry | undefined;
  }


  async deleteAdmissionsEnquiry(id: number): Promise<boolean> {
    const result = await db.delete(schema.admissionsEnquiries).where(eq(schema.admissionsEnquiries.id, id)).returning({ id: schema.admissionsEnquiries.id });
    return result.length > 0;
  }

  // ─── Contact Messages (extended) ─────────────────────────────

  async deleteContactMessage(id: number): Promise<boolean> {
    const result = await db.delete(schema.contactMessages).where(eq(schema.contactMessages.id, id)).returning({ id: schema.contactMessages.id });
    return result.length > 0;
  }

  // ─── Billing & Payments ───────────────────────────────────────────────────

  async getBillingItems(filters?: { category?: string; isActive?: boolean }): Promise<BillingItem[]> {
    let query = db.select().from(schema.billingItems);
    const conditions = [];
    if (filters?.category) conditions.push(eq(schema.billingItems.category, filters.category));
    if (filters?.isActive !== undefined) conditions.push(eq(schema.billingItems.isActive, filters.isActive));
    if (conditions.length > 0) return query.where(and(...conditions)).orderBy(schema.billingItems.name);
    return query.orderBy(schema.billingItems.name);
  }


  async getBillingItem(id: number): Promise<BillingItem | undefined> {
    const [item] = await db.select().from(schema.billingItems).where(eq(schema.billingItems.id, id));
    return item;
  }


  async createBillingItem(data: InsertBillingItem): Promise<BillingItem> {
    const [item] = await db.insert(schema.billingItems).values(data).returning();
    return item;
  }


  async updateBillingItem(id: number, data: Partial<InsertBillingItem>): Promise<BillingItem | undefined> {
    const [item] = await db.update(schema.billingItems).set({ ...data, updatedAt: new Date() }).where(eq(schema.billingItems.id, id)).returning();
    return item;
  }


  async deleteBillingItem(id: number): Promise<boolean> {
    const result = await db.delete(schema.billingItems).where(eq(schema.billingItems.id, id)).returning({ id: schema.billingItems.id });
    return result.length > 0;
  }


  async getBillingPayments(filters?: { billingItemId?: number; studentId?: string; termId?: number; status?: string }): Promise<BillingPayment[]> {
    let query = db.select().from(schema.billingPayments);
    const conditions = [];
    if (filters?.billingItemId) conditions.push(eq(schema.billingPayments.billingItemId, filters.billingItemId));
    if (filters?.studentId) conditions.push(eq(schema.billingPayments.studentId, filters.studentId));
    if (filters?.termId) conditions.push(eq(schema.billingPayments.termId, filters.termId));
    if (filters?.status) conditions.push(eq(schema.billingPayments.status, filters.status));
    if (conditions.length > 0) return query.where(and(...conditions)).orderBy(sql`${schema.billingPayments.createdAt} desc`);
    return query.orderBy(sql`${schema.billingPayments.createdAt} desc`);
  }


  async getBillingPayment(id: number): Promise<BillingPayment | undefined> {
    const [p] = await db.select().from(schema.billingPayments).where(eq(schema.billingPayments.id, id));
    return p;
  }


  async getStudentBillingPayment(studentId: string, billingItemId: number, termId?: number): Promise<BillingPayment | undefined> {
    const conditions: any[] = [eq(schema.billingPayments.studentId, studentId), eq(schema.billingPayments.billingItemId, billingItemId)];
    if (termId) conditions.push(eq(schema.billingPayments.termId, termId));
    const [p] = await db.select().from(schema.billingPayments).where(and(...conditions)).limit(1);
    return p;
  }


  async createBillingPayment(data: InsertBillingPayment): Promise<BillingPayment> {
    try {
      const [p] = await db.insert(schema.billingPayments).values(data).returning();
      return p;
    } catch (err: any) {
      if (err?.code === '23505') {
        const existing = await this.getStudentBillingPayment(data.studentId, data.billingItemId, data.termId ?? undefined);
        if (existing) {
          const [updated] = await db.update(schema.billingPayments).set({ ...data }).where(eq(schema.billingPayments.id, existing.id)).returning();
          return updated;
        }
      }
      throw err;
    }
  }


  async updateBillingPayment(id: number, data: Partial<InsertBillingPayment>): Promise<BillingPayment | undefined> {
    const [p] = await db.update(schema.billingPayments).set(data).where(eq(schema.billingPayments.id, id)).returning();
    return p;
  }


  async deleteBillingPayment(id: number): Promise<boolean> {
    const result = await db.delete(schema.billingPayments).where(eq(schema.billingPayments.id, id)).returning({ id: schema.billingPayments.id });
    return result.length > 0;
  }


  async getOutstandingBillingPayments(billingItemId?: number, termId?: number): Promise<any[]> {
    // Returns students who have NOT paid a given billing item for a term
    const allStudents = await db.select({
      studentId: schema.students.id,
      admissionNumber: schema.students.admissionNumber,
      userId: schema.students.userId,
      classId: schema.students.classId,
    }).from(schema.students);

    const paidConditions: any[] = [eq(schema.billingPayments.status, 'paid')];
    if (billingItemId) paidConditions.push(eq(schema.billingPayments.billingItemId, billingItemId));
    if (termId) paidConditions.push(eq(schema.billingPayments.termId, termId));

    const paidPayments = await db.select({ studentId: schema.billingPayments.studentId })
      .from(schema.billingPayments).where(and(...paidConditions));
    const paidSet = new Set(paidPayments.map((p: any) => p.studentId));

    const outstanding = allStudents.filter((s: any) => !paidSet.has(s.studentId));
    // Enrich with user info
    const enriched = await Promise.all(outstanding.map(async (s: any) => {
      const user = s.userId ? await this.getUser(s.userId) : null;
      const cls = s.classId ? await this.getClass(s.classId) : null;
      return {
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        studentName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : s.admissionNumber,
        className: cls?.name || 'N/A',
      };
    }));
    return enriched;
  }


  async getBillingFinancialSummary(termId?: number): Promise<any> {
    const conditions: any[] = [eq(schema.billingPayments.status, 'paid')];
    if (termId) conditions.push(eq(schema.billingPayments.termId, termId));

    const payments = await db.select().from(schema.billingPayments).where(and(...conditions));
    const items = await this.getBillingItems();

    const totalCollected = payments.reduce((s: number, p: any) => s + (p.amountPaid || 0), 0);
    const byItem: Record<number, { name: string; count: number; total: number }> = {};
    for (const p of payments) {
      if (!byItem[p.billingItemId]) {
        const item = items.find((i: any) => i.id === p.billingItemId);
        byItem[p.billingItemId] = { name: item?.name || 'Unknown', count: 0, total: 0 };
      }
      byItem[p.billingItemId].count++;
      byItem[p.billingItemId].total += p.amountPaid || 0;
    }

    // Count total students
    const [{ count: totalStudents }] = await db.select({ count: sql<number>`count(*)` }).from(schema.students);

    return {
      totalCollected,
      totalPayments: payments.length,
      totalStudents: Number(totalStudents),
      byItem: Object.entries(byItem).map(([id, v]) => ({ billingItemId: Number(id), ...v })),
    };
  }


  async getBillingFeatureLink(featureKey: string): Promise<BillingFeatureLink | undefined> {
    const [link] = await db.select().from(schema.billingFeatureLinks).where(eq(schema.billingFeatureLinks.featureKey, featureKey));
    return link;
  }


  async getBillingFeatureLinks(): Promise<BillingFeatureLink[]> {
    return db.select().from(schema.billingFeatureLinks);
  }


  async createBillingFeatureLink(data: InsertBillingFeatureLink): Promise<BillingFeatureLink> {
    const [link] = await db.insert(schema.billingFeatureLinks).values(data).returning();
    return link;
  }


  async deleteBillingFeatureLink(id: number): Promise<boolean> {
    const result = await db.delete(schema.billingFeatureLinks).where(eq(schema.billingFeatureLinks.id, id)).returning({ id: schema.billingFeatureLinks.id });
    return result.length > 0;
  }


  async deleteBillingFeatureLinkByKey(featureKey: string): Promise<boolean> {
    const result = await db.delete(schema.billingFeatureLinks).where(eq(schema.billingFeatureLinks.featureKey, featureKey)).returning({ id: schema.billingFeatureLinks.id });
    return result.length > 0;
  }

}
