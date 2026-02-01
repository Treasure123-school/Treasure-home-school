import { eq, and, desc, asc, sql, or } from "drizzle-orm";

export const createCommStorage = (db: any, schema: any) => ({
  async getAnnouncements(): Promise<any[]> {
    return await db.select().from(schema.announcements).orderBy(desc(schema.announcements.createdAt));
  },

  async createAnnouncement(announcement: any): Promise<any> {
    const result = await db.insert(schema.announcements).values(announcement).returning();
    return result[0];
  },

  async getMessages(userId: string): Promise<any[]> {
    return await db.select().from(schema.messages).where(
      or(
        eq(schema.messages.senderId, userId),
        eq(schema.messages.receiverId, userId)
      )
    ).orderBy(desc(schema.messages.sentAt));
  },

  async createMessage(message: any): Promise<any> {
    const result = await db.insert(schema.messages).values(message).returning();
    return result[0];
  }
});
