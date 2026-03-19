import { defineConfig } from "drizzle-kit";

// Database configuration - PostgreSQL only
// SQLite is not supported on cloud platforms like Render/Vercel
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('⚠️  DATABASE_URL not set. Using placeholder for drizzle-kit commands.');
}

export default defineConfig({
  // PostgreSQL (Neon) configuration
  out: "./migrations-pg",
  schema: "./shared/schema.pg.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
  verbose: true,
});
