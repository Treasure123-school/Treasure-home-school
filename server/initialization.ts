import { seedAcademicTerms } from "./seed-terms";
import fs from "fs/promises";
import { isPostgres } from "./db";

export async function initializeSystem() {
  if (isPostgres) {
    console.log("✅ Using POSTGRESQL database");
  }
  
  try {
    console.log("Seeding academic terms...");
    await seedAcademicTerms();
    
    const { seedSystemSettings } = await import("./seed-system-settings");
    await seedSystemSettings();
    
    const { seedRoles } = await import("./seed-roles");
    await seedRoles();
    
    const { seedTestUsers } = await import("./seed-test-users");
    await seedTestUsers();
    
    await fs.mkdir('server/uploads/profiles', { recursive: true });
    await fs.mkdir('server/uploads/homepage', { recursive: true });
    await fs.mkdir('server/uploads/gallery', { recursive: true });
    await fs.mkdir('server/uploads/study-resources', { recursive: true });
    await fs.mkdir('server/uploads/general', { recursive: true });
    await fs.mkdir('server/uploads/csv', { recursive: true });
    console.log("✅ Initialization completed");
  } catch (error) {
    console.error("❌ Initialization error:", error);
  }
}
