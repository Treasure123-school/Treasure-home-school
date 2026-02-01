import { eq, and, desc, asc, sql, inArray, isNull, or, gte } from "drizzle-orm";
import { normalizeUuid } from "../utils";

export const createUserStorage = (db: any, schema: any) => ({
  async getUser(id: string): Promise<any | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) user.id = normalizedId;
    }
    return user;
  },

  async getUserByEmail(email: string): Promise<any | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  },

  async getUserByUsername(username: string): Promise<any | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  },

  async createUser(user: any): Promise<any> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  },

  async getAllUsers(): Promise<any[]> {
    const result = await db.select().from(schema.users);
    return result.map((user: any) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) user.id = normalizedId;
      }
      return user;
    });
  },

  async getUsersByRole(roleId: number): Promise<any[]> {
    const result = await db.select().from(schema.users).where(eq(schema.users.roleId, roleId));
    return result.map((user: any) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) user.id = normalizedId;
      }
      return user;
    });
  }
});
