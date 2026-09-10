import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { eq } from "drizzle-orm";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!database && process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER) {
    const pool = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD ?? "", ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined, connectionLimit: 5, charset: "utf8mb4" });
    database = drizzle(pool);
  }
  return database;
}
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("openId é obrigatório");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: user.lastSignedIn ?? new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
