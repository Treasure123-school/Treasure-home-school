/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { BillingItem } from '@shared/schema.pg';
import { eq } from 'drizzle-orm';
import { DatabaseStorageP15 } from './part15-syncAllMissingExamScores'
import type { IStorage } from './types'

export class DatabaseStorage extends DatabaseStorageP15 implements IStorage {
  async ensureDefaultBillingItem(): Promise<BillingItem> {
    const existing = await db.select().from(schema.billingItems).where(eq(schema.billingItems.category, 'exam')).limit(1);
    if (existing.length > 0) return existing[0];
    const settings = await this.getSystemSettings();
    const amount = settings?.examFeeAmount ?? 500000;
    const [item] = await db.insert(schema.billingItems).values({
      name: 'Examination Fee',
      description: 'Termly examination access fee',
      amount,
      category: 'exam',
      isActive: true,
      isRecurring: true,
    }).returning();
    return item;
  }
}
