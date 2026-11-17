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
import net from "net";
import * as pgSchema from "@shared/schema.pg";

const { Pool } = pg;

// Node >= 20 enables Happy-Eyeballs (autoSelectFamily) with a 250ms per-attempt
// timeout. Neon accepts connections in ~300-400ms+, so every pooled connection
// attempt was aborted with AggregateError ETIMEDOUT/ENETUNREACH while other
// clients (psql) connected fine. Give each address a realistic window and
// skip unreachable IPv6 entirely.
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === 'function') {
  net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
}

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
    // Neon's pooled endpoint (-pooler.) uses PgBouncer in transaction mode,
    // which does not support prepared statements used by Drizzle ORM.
    // Strip '-pooler' to use the direct connection endpoint for Drizzle.
    const directUrl = databaseUrl.replace('-pooler.', '.');
    pool = new Pool({
      connectionString: directUrl,
      // Pool sizing: default is 10. Exam submission fans out several parallel
      // queries (auto-scoring + per-question options) — keep enough headroom
      // without overloading Neon's connection limit.
      max: 10,
      // Fail fast instead of hanging: a connection that can't be established
      // within 15s should surface as an error, not freeze the request.
      connectionTimeoutMillis: 15000,
      // Reclaim idle connections so we don't hold Neon slots forever.
      idleTimeoutMillis: 30000,
      // Hard cap per statement: protects against pathological queries
      // stalling the pool on a slow remote database.
      statement_timeout: 30000,
    // Detect dead connections promptly (TCP keepalive on Neon).
    keepAlive: true,
  });
  // CRITICAL: without this handler, a network drop on an IDLE pooled connection
  // (e.g. ECONNABORTED on TLS socket) emits an unhandled 'error' event on the
  // pool and CRASHES the whole server. pg-pool removes the broken client and
  // continues serving when this handler is present.
  pool.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[DB] Idle client connection error (removed from pool):', err.code || err.message);
  });
  // Belt-and-braces: Neon closes idle pooled connections server-side, and a
  // client can emit a late 'error' AFTER pg-pool has detached it — that crashes
  // the process with an unhandled event. Swallow it at the client level too.
  pool.on('connect', (client: pg.PoolClient) => {
    client.on('error', (err: Error) => {
      console.error('[DB] Client connection error (handled):', err.message);
    });
  });
    const dbInstance = drizzle(pool, { schema: pgSchema });
    console.log('PostgreSQL database initialized (direct connection for Drizzle ORM compatibility)');
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
