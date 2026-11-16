/** Shared deletion types — extracted from smart-deletion-manager.ts. */
import { DeletionResult } from "./deletion-service";

export interface DeletionValidation {
  canDelete: boolean;
  reason?: string;
  blockedBy?: {
    type: string;
    description: string;
    count?: number;
  }[];
  affectedRecords?: {
    tableName: string;
    count: number;
  }[];
  filesToDelete?: string[];
}

export interface SmartDeletionResult extends DeletionResult {
  userId: string;
  userRole: string;
  userEmail?: string;
  username?: string;
}

export type UserRole = 'Super Admin' | 'Admin' | 'Teacher' | 'Student' | 'Parent' | 'Unknown';


export function getRoleFromId(roleId: number): UserRole {
  switch (roleId) {
    case 1: return 'Super Admin';
    case 2: return 'Admin';
    case 3: return 'Teacher';
    case 4: return 'Student';
    case 5: return 'Parent';
    default: return 'Unknown';
  }
}
