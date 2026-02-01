import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { normalizeUuid } from "../utils";

export const createStudentStorage = (db: any, schema: any) => ({
  async getStudent(id: string): Promise<any | undefined> {
    const result = await db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1);
    const student = result[0];
    if (student && student.id) {
      const normalizedId = normalizeUuid(student.id);
      if (normalizedId) student.id = normalizedId;
    }
    return student;
  },

  async getStudentsByClass(classId: number): Promise<any[]> {
    const result = await db.select().from(schema.students).where(eq(schema.students.classId, classId));
    return result.map((student: any) => {
      if (student && student.id) {
        const normalizedId = normalizeUuid(student.id);
        if (normalizedId) student.id = normalizedId;
      }
      return student;
    });
  },

  async createStudent(student: any): Promise<any> {
    const result = await db.insert(schema.students).values(student).returning();
    return result[0];
  },

  async updateStudent(id: string, update: any): Promise<any> {
    const result = await db.update(schema.students).set(update).where(eq(schema.students.id, id)).returning();
    return result[0];
  }
});
