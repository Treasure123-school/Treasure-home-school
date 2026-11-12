import { db } from './server/db.js';
import { examSessions } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkSessions() {
  try {
    const sessions = await db.select().from(examSessions).limit(5);
    console.log("Found sessions:");
    sessions.forEach(s => {
      console.log(`ID: ${s.id}, studentId: ${s.studentId}, examId: ${s.examId}`);
      console.log(`  startedAt: ${s.startedAt}`);
      console.log(`  submittedAt: ${s.submittedAt}`);
      console.log(`  isCompleted: ${s.isCompleted}, status: ${s.status}`);
      console.log(`  metadata: ${s.metadata}`);
      
      // Test calculation
      if (s.startedAt && s.submittedAt && s.isCompleted) {
        const start = new Date(s.startedAt).getTime();
        const end = new Date(s.submittedAt).getTime();
        console.log(`  --> Calc duration: ${Math.floor((end - start)/1000)}s`);
      }
    });

    console.log("\nResults verification completed.");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

checkSessions();
