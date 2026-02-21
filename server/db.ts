/**
 * Database Factory
 * 
 * This module provides a unified database interface using PostgreSQL.
 * 
 * Environment Detection:
 * - DATABASE_URL present → PostgreSQL connection
 * 
 * Exports:
 * - db: Drizzle ORM instance (for ORM queries with transaction support)
 * - getPgPool(): Returns Pool for lower-level operations
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as pgSchema from "@shared/schema.pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

export const isPostgres = true;
export const isSqlite = false;

let pool: pg.Pool | null = null;

function initializeDatabase() {
  if (!databaseUrl) {
    console.error('DATABASE_URL is required for PostgreSQL connection');
    throw new Error('DATABASE_URL environment variable is required.');
  }

  console.log('Initializing PostgreSQL database...');
  try {
    pool = new Pool({ connectionString: databaseUrl });
    const dbInstance = drizzle(pool, { schema: pgSchema });
    console.log('PostgreSQL database initialized');
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize PostgreSQL database:', error);
    throw error;
  }
}

export function getPgPool(): pg.Pool | null {
  return pool;
}

export function getPgClient(): pg.Pool | null {
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = null;
}

export const dbInfo = {
  type: 'postgresql',
  isProduction,
  connectionString: 'PostgreSQL'
};

export function getSchema() {
  return pgSchema;
}

export const db = initializeDatabase();

export function getDatabase() {
  return db;
}
