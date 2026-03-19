
import { db } from './storage';
import { academicTerms } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function seedAcademicTerms() {
  try {
    
    const existingTerms = await db.select().from(academicTerms);
    
    if (existingTerms.length === 0) {
      
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const academicYear = `${currentYear}/${nextYear}`;
      
      const defaultTerms = [
        {
          name: 'First Term',
          year: academicYear,
          startDate: `${currentYear}-09-01`,
          endDate: `${currentYear}-12-15`,
          isCurrent: true
        },
        {
          name: 'Second Term',
          year: academicYear,
          startDate: `${nextYear}-01-06`,
          endDate: `${nextYear}-04-10`,
          isCurrent: false
        },
        {
          name: 'Third Term',
          year: academicYear,
          startDate: `${nextYear}-04-21`,
          endDate: `${nextYear}-07-18`,
          isCurrent: false
        }
      ];
      
      for (const term of defaultTerms) {
        await db.insert(academicTerms).values(term);
      }
    } else {
    }
  } catch (error) {
    throw error;
  }
}
