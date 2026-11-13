/** Storage barrel — composes the DatabaseStorage chain into the singleton `storage`. */
import { DatabaseStorage } from './database-storage';
import type { IStorage } from './types';
export type { IStorage } from './types';
export { DatabaseStorage } from './database-storage';

// Initialize storage - PostgreSQL database only
function initializeStorageSync(): IStorage {
  // CRITICAL: Only use PostgreSQL database - no memory storage fallback
  if (!process.env.DATABASE_URL) {
    process.exit(1);
  }
  try {
    const dbStorage = new DatabaseStorage();
    return dbStorage;
  } catch (error) {
    process.exit(1);
  }
}

// Initialize storage - PostgreSQL database only
export const storage: IStorage = initializeStorageSync();
