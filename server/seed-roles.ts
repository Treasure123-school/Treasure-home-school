import { db } from './storage';
import * as schema from "@shared/schema";

/**
 * Seeds the 5 core roles into the database
 */
export async function seedRoles() {
  try {
    // Check if roles already exist
    const existingRoles = await db.select().from(schema.roles);
    
    if (existingRoles.length > 0) {
      console.log(`ℹ️  Roles already exist (${existingRoles.length} found)`);
      return;
    }

    const requiredRoles = [
      { 
        id: 1, 
        name: 'Super Admin', 
        permissions: JSON.stringify(['*']) 
      },
      { 
        id: 2, 
        name: 'Admin', 
        permissions: JSON.stringify(['manage_users', 'manage_classes', 'manage_students', 'manage_teachers', 'manage_exams', 'view_reports', 'manage_announcements', 'manage_gallery', 'manage_content']) 
      },
      { 
        id: 3, 
        name: 'Teacher', 
        permissions: JSON.stringify(['view_students', 'manage_attendance', 'manage_exams', 'grade_exams', 'view_classes', 'manage_resources']) 
      },
      { 
        id: 4, 
        name: 'Student', 
        permissions: JSON.stringify(['view_exams', 'take_exams', 'view_results', 'view_resources', 'view_announcements']) 
      },
      { 
        id: 5, 
        name: 'Parent', 
        permissions: JSON.stringify(['view_students', 'view_results', 'view_attendance', 'view_announcements']) 
      },
    ];

    console.log('📚 Creating 5 core roles...');
    
    for (const roleData of requiredRoles) {
      await db.insert(schema.roles).values(roleData);
      console.log(`  ✅ Created role: ${roleData.name}`);
    }

    console.log('✅ All 5 roles created successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error seeding roles: ${errorMessage}`);
    throw error;
  }
}
