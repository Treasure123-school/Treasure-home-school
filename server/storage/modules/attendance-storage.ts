import { eq, and, desc, asc, sql } from "drizzle-orm";

export const createAttendanceStorage = (db: any, schema: any) => ({
  async getAttendance(classId: number, date: Date): Promise<any[]> {
    return await db.select().from(schema.attendance).where(
      and(
        eq(schema.attendance.classId, classId),
        eq(schema.attendance.date, date)
      )
    );
  },

  async createAttendance(attendance: any): Promise<any> {
    const result = await db.insert(schema.attendance).values(attendance).returning();
    return result[0];
  }
});
