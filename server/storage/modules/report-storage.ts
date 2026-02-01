import { eq, and, desc, asc, sql } from "drizzle-orm";

export const createReportStorage = (db: any, schema: any) => ({
  async getReportCard(id: number): Promise<any | undefined> {
    const result = await db.select().from(schema.reportCards).where(eq(schema.reportCards.id, id)).limit(1);
    return result[0];
  },

  async getReportCardsByStudentId(studentId: string): Promise<any[]> {
    return await db.select().from(schema.reportCards).where(eq(schema.reportCards.studentId, studentId));
  },

  async getReportCardItems(reportCardId: number): Promise<any[]> {
    return await db.select().from(schema.reportCardItems).where(eq(schema.reportCardItems.reportCardId, reportCardId));
  }
});
