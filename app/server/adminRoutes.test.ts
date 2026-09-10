import { describe, expect, it } from "vitest";
import { validateAdminCredentials } from "./adminRoutes";

describe("admin credentials", () => {
  it("accepts the requested default credentials", () => {
    expect(validateAdminCredentials("Admin", "Admin123@")).toBe(true);
  });

  it("rejects invalid credentials", () => {
    expect(validateAdminCredentials("admin", "Admin123@")).toBe(false);
    expect(validateAdminCredentials("Admin", "wrong-password")).toBe(false);
  });
});
