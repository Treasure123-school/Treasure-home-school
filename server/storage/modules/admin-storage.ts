import { eq, and, desc, asc, sql } from "drizzle-orm";

export const createAdminStorage = (db: any, schema: any) => ({
  async getSystemSettings(): Promise<any | undefined> {
    const result = await db.select().from(schema.systemSettings).limit(1);
    return result[0];
  },

  async updateSystemSettings(settings: any): Promise<any> {
    const result = await db.update(schema.systemSettings).set(settings).returning();
    return result[0];
  },

  async getAuditLogs(): Promise<any[]> {
    return await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp));
  },

  async createAuditLog(log: any): Promise<any> {
    const result = await db.insert(schema.auditLogs).values(log).returning();
    return result[0];
  },

  async getHomePageContent(): Promise<any[]> {
    return await db.select().from(schema.homePageContent);
  },

  async getNotificationsByUserId(userId: string): Promise<any[]> {
    return await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));
  },
});
