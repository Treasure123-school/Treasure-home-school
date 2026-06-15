---
name: Neon pooler + Drizzle ORM incompatibility
description: Why Drizzle ORM returns 0 rows and silent INSERT failures when DATABASE_URL uses Neon's pooled (-pooler.) endpoint
---

## The Rule
When DATABASE_URL contains `-pooler.` (Neon's PgBouncer endpoint), Drizzle ORM queries silently return empty results and INSERTs appear to succeed but data is never written to PostgreSQL.

**Why:** Neon's pooled endpoint runs PgBouncer in transaction mode. PgBouncer in transaction mode does not support PostgreSQL's extended query protocol (prepared statements). Drizzle ORM uses prepared statements internally. The queries run but return no rows, and mutations are dropped.

**Raw `pool.query()` works fine** because it uses the simple query protocol by default.

**How to apply:** In `server/db.ts`, strip `-pooler.` from the connection URL before creating the Pool for Drizzle:
```typescript
const directUrl = databaseUrl.replace('-pooler.', '.');
pool = new Pool({ connectionString: directUrl });
const dbInstance = drizzle(pool, { schema: pgSchema });
```

This causes Drizzle to use Neon's direct (non-pooled) endpoint, which supports prepared statements. Raw SQL via `getPgPool()` also uses this pool — non-pooled connections work fine for all query types.

**Symptom checklist:**
- `db.select().from(table)` returns `[]` even though DB has rows
- `db.insert().returning()` returns a row but `SELECT` in psql shows nothing
- Cache pre-warming logs `0 classes, 0 subjects` despite seeded data
- All Drizzle queries broken; raw `pool.query(sql, params)` works
- Login may work if it uses a code path that happens to return data another way
