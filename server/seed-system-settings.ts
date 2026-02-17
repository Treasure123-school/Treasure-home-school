import { db } from "./storage";
import { systemSettings } from "../shared/schema.pg";

export async function seedSystemSettings() {
  try {
    // Check if settings already exist
    const existingSettings = await db.select().from(systemSettings).limit(1);

    if (existingSettings.length === 0) {
      // Create default system settings
      await db.insert(systemSettings).values({
        schoolName: "Treasure-Home School",
        schoolMotto: "Honesty and Success",
        schoolEmails: JSON.stringify(["info@treasurehomeschool.edu.ng"]),
        schoolPhones: JSON.stringify(["+234-XXX-XXX-XXXX"]),
        schoolAddress: "Lagos, Nigeria",
        maintenanceMode: false,
        enableSmsNotifications: false,
        enableEmailNotifications: true,
        enableExamsModule: true,
        enableAttendanceModule: true,
        enableResultsModule: true,
        themeColor: "blue",
        usernameStudentPrefix: "THS-STU",
        usernameParentPrefix: "THS-PAR",
        usernameTeacherPrefix: "THS-TCH",
        usernameAdminPrefix: "THS-ADM",
        tempPasswordFormat: "THS@{year}#{random4}",
        hideAdminAccountsFromAdmins: true,
      });
      console.log("✅ Default system settings created");
    } else {
      console.log("ℹ️  System settings already exist");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ System settings seeding error: ${errorMessage}`);
    throw error;
  }
}
