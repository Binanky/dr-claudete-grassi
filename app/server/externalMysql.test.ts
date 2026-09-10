import { describe, expect, it } from "vitest";
import { getExternalMysql, hasExternalMysqlConfig } from "./externalMysql";

describe("external MySQL configuration", () => {
  it("connects with the configured credentials using a lightweight query", async () => {
    expect(hasExternalMysqlConfig()).toBe(true);
    const pool = await getExternalMysql();
    expect(pool).not.toBeNull();
    const [rows] = await pool!.query("SELECT 1 AS ok");
    expect((rows as Array<{ ok: number }>)[0]?.ok).toBe(1);
  }, 15000);
});
