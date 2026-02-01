import { eq, and, desc, asc, sql } from "drizzle-orm";

export const createAcademicStorage = (db: any, schema: any) => ({
  async getClasses(): Promise<any[]> {
    return await db.select().from(schema.classes).orderBy(asc(schema.classes.name));
  },

  async getClass(id: number): Promise<any | undefined> {
    const result = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
    return result[0];
  },

  async getSubjects(): Promise<any[]> {
    return await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name));
  },

  async getSubject(id: number): Promise<any | undefined> {
    const result = await db.select().from(schema.subjects).where(eq(schema.subjects.id, id)).limit(1);
    return result[0];
  },

  async getAcademicTerms(): Promise<any[]> {
    return await db.select().from(schema.academicTerms).orderBy(desc(schema.academicTerms.startDate));
  },

  async getCurrentTerm(): Promise<any | undefined> {
    const result = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.isCurrent, true)).limit(1);
    return result[0];
  }
});
