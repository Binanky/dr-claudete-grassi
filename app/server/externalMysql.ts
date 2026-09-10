import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | null = null;

function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
}

export function hasExternalMysqlConfig() {
  return mysqlConfigured();
}

export async function getExternalMysql() {
  if (!mysqlConfigured()) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD ?? "",
      ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export async function ensureContactTable() {
  const db = await getExternalMysql();
  if (!db) return false;
  await db.execute(`CREATE TABLE IF NOT EXISTS site_contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  return true;
}

export async function saveContactMessage(input: { name: string; phone: string; message: string }) {
  const db = await getExternalMysql();
  if (!db) return { stored: false, reason: "mysql_not_configured" as const };
  await ensureContactTable();
  await db.execute("INSERT INTO site_contact_messages (name, phone, message) VALUES (?, ?, ?)", [input.name, input.phone, input.message]);
  return { stored: true as const };
}
