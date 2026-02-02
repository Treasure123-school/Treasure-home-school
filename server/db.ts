/**
 * Database Factory
 * 
 * This module provides a unified database interface using PostgreSQL/Neon or SQLite.
 * 
 * Environment Detection:
 * - DATABASE_URL present → PostgreSQL (Neon) - REQUIRED for production
 * - No DATABASE_URL → Use SQLite in development
 * 
 * IMPORTANT: Uses neon-serverless driver with Pool for TRANSACTION SUPPORT.
 * The neon-http driver does NOT support transactions.
 * 
 * Exports:
 * - db: Drizzle ORM instance (for ORM queries with transaction support)
 * - getPgClient(): Returns neon() client for raw SQL tagged template queries
 * - getPgPool(): Returns Pool for lower-level operations
 */

import { drizzle as drizzlePg } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool, neonConfig, neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import * as pgSchema from "@shared/schema.pg";
import * as sqliteSchema from "@shared/schema";
import ws from "ws";

// Enable WebSocket support for Neon serverless driver (required for transactions)
neonConfig.webSocketConstructor = ws;

// Database instance types
type PgDb = ReturnType<typeof drizzlePg>;
type SqliteDb = ReturnType<typeof drizzleSqlite>;
type DatabaseInstance = PgDb | SqliteDb;
type NeonClient = ReturnType<typeof neon>;

// Configuration
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

// Type detection
export const isPostgres = !!databaseUrl;
export const isSqlite = !databaseUrl;

// Database instances
let dbInternal: DatabaseInstance | null = null;
let pool: Pool | null = null;
let neonClient: NeonClient | null = null;
let sqliteDb: any = null;

/**
 * Get the appropriate schema
 */
export function getSchema() {
  return isPostgres ? pgSchema : sqliteSchema;
}

/**
 * Initialize and return the database instance
 */
export function initializeDatabase(): DatabaseInstance {
  if (dbInternal) {
    return dbInternal;
  }

  if (isProduction && !databaseUrl) {
    console.error('❌ DATABASE_URL is required for PostgreSQL connection in production');
    throw new Error('DATABASE_URL environment variable is required in production.');
  }

  if (databaseUrl) {
    // PostgreSQL (Neon) for all environments with Pool for transaction support
    console.log('🐘 Initializing PostgreSQL database (Neon with WebSocket)...');
    try {
      pool = new Pool({ connectionString: databaseUrl });
      dbInternal = drizzlePg(pool, { schema: pgSchema });
      neonClient = neon(databaseUrl);
      console.log('✅ PostgreSQL database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL database:', error);
      throw error;
    }
  } else {
    // SQLite for local development
    console.log('📦 Initializing SQLite database (development)...');
    try {
      sqliteDb = new Database("sqlite.db");
      dbInternal = drizzleSqlite(sqliteDb, { schema: sqliteSchema });
      console.log('✅ SQLite database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  return dbInternal;
}

/**
 * Get the database instance (initializes if needed)
 */
export function getDatabase(): DatabaseInstance {
  if (!dbInternal) {
    return initializeDatabase();
  }
  return dbInternal;
}


/**
 * Get the neon client for raw SQL queries (tagged template literals)
 * Use this for: pgClient`SELECT * FROM users WHERE id = ${id}`
 */
export function getPgClient(): NeonClient | null {
  return neonClient;
}

/**
 * Get the raw PostgreSQL pool for lower-level operations
 */
export function getPgPool(): Pool | null {
  return pool;
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = null;
  neonClient = null;
  dbInternal = null;
}

// Export database type info for conditional logic
export const dbInfo = {
  type: 'postgresql',
  isProduction,
  connectionString: 'Neon PostgreSQL (WebSocket)'
};

// Initialize on import
const database = initializeDatabase();

// Export with proper PostgreSQL typing for TypeScript compatibility
// Since this project uses Neon PostgreSQL (DATABASE_URL is always set), we can safely type it
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
export const db = database as unknown as NeonDatabase<typeof pgSchema>;
