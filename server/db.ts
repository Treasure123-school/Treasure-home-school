import { drizzle as drizzlePg } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool, neonConfig, neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import * as pgSchema from "@shared/schema.pg";
import * as sqliteSchema from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;
export const isPostgres = !!databaseUrl;
export const isSqlite = !databaseUrl;

let dbInstance: any = null;
let pool: Pool | null = null;
let neonClient: any = null;

export function initializeDatabase() {
  if (dbInstance) return dbInstance;

  if (databaseUrl) {
    pool = new Pool({ connectionString: databaseUrl });
    dbInstance = drizzlePg(pool, { schema: pgSchema });
    neonClient = neon(databaseUrl);
  } else {
    const sqliteDb = new Database("sqlite.db");
    dbInstance = drizzleSqlite(sqliteDb, { schema: sqliteSchema });
  }
  return dbInstance;
}

export const db = initializeDatabase();
export function getDatabase() { return db; }
export function getSchema() { return isPostgres ? pgSchema : sqliteSchema; }
export function getPgClient() { return neonClient; }
export function getPgPool() { return pool; }
export { pgSchema as schema };
