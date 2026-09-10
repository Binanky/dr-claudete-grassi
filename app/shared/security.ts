import { createHash } from "node:crypto";

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isTrackingToken(value: string) {
  return /^[A-Za-z0-9_-]{24,160}$/.test(value);
}
