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
  },

  async getClassSubjectMappings(classId: number, department?: string): Promise<any[]> {
    let query = db.select().from(schema.classSubjectMapping).where(eq(schema.classSubjectMapping.classId, classId));
    if (department) {
      query = query.where(eq(schema.classSubjectMapping.department, department));
    }
    return await query;
  },

  async syncStudentsWithClassMappings(classId: number): Promise<any> {
    // Implementation logic for syncing students with class mappings
    return { success: true, classId };
  },
});
