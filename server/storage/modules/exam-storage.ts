import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

export const createExamStorage = (db: any, schema: any) => ({
  async createExam(exam: any): Promise<any> {
    const result = await db.insert(schema.exams).values(exam).returning();
    return result[0];
  },

  async getAllExams(): Promise<any[]> {
    return await db.select().from(schema.exams).orderBy(desc(schema.exams.date));
  },

  async getExamById(id: number): Promise<any | undefined> {
    const result = await db.select().from(schema.exams).where(eq(schema.exams.id, id)).limit(1);
    return result[0];
  },

  async getExamsByClass(classId: number): Promise<any[]> {
    return await db.select().from(schema.exams).where(eq(schema.exams.classId, classId));
  }
});
