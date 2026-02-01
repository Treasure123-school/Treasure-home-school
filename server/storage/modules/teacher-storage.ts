import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { normalizeUuid } from "../utils";

export const createTeacherStorage = (db: any, schema: any) => ({
  async getTeacherProfile(userId: string): Promise<any | undefined> {
    const result = await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, userId)).limit(1);
    return result[0];
  },

  async getAllTeachers(): Promise<any[]> {
    return await db.select().from(schema.teacherProfiles);
  },

  async createTeacherProfile(profile: any): Promise<any> {
    const result = await db.insert(schema.teacherProfiles).values(profile).returning();
    return result[0];
  }
});
