import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { hasExternalMysqlConfig } from "./externalMysql";

const COOKIE = "dr_claudete_admin";
const DEFAULT_USER = "Admin";
const DEFAULT_PASSWORD = "Admin123@";

export function validateAdminCredentials(username: unknown, password: unknown) {
  return username === (process.env.ADMIN_USERNAME || DEFAULT_USER) && password === (process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD);
}

function secret() { return process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || "dr-claudete-preview-secret"; }
function sign(payload: string) { return crypto.createHmac("sha256", secret()).update(payload).digest("hex"); }
function makeToken() { const expires = Date.now() + 1000 * 60 * 60 * 12; const payload = `${DEFAULT_USER}:${expires}`; return `${payload}.${sign(payload)}`; }
function readCookie(req: Request) {
  const raw = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return raw ? decodeURIComponent(raw) : undefined;
}
export function isAdminRequest(req: Request) {
  const token = readCookie(req); if (!token) return false;
  const lastDot = token.lastIndexOf("."); if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot); const provided = token.slice(lastDot + 1); const [user, expires] = payload.split(":");
  if (user !== DEFAULT_USER || Number(expires) < Date.now()) return false;
  const expected = sign(payload);
  return provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
function secureCookie(req: Request) { return req.secure || req.headers["x-forwarded-proto"] === "https"; }

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/me", (req, res) => res.json({ authenticated: isAdminRequest(req), username: isAdminRequest(req) ? DEFAULT_USER : undefined }));
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!validateAdminCredentials(username, password)) return res.status(401).json({ message: "Usuário ou senha inválidos." });
    const token = makeToken();
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie(req), maxAge: 1000 * 60 * 60 * 12, path: "/" });
    return res.json({ authenticated: true, username: DEFAULT_USER });
  });
  app.post("/api/admin/logout", (_req, res) => { res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", path: "/" }); res.json({ success: true }); });
  app.get("/api/admin/mysql-status", (req, res) => { if (!isAdminRequest(req)) return res.status(401).json({ message: "Não autorizado." }); return res.json({ configured: hasExternalMysqlConfig(), provider: "mysql" }); });
}

export function registerContactRoutes(app: Express) {
  app.post("/api/contact", async (req: Request, res: Response) => {
    const { name, phone, message } = req.body ?? {};
    if (!name || !phone || !message) return res.status(400).json({ message: "Preencha nome, telefone e mensagem." });
    try {
      const { saveContactMessage } = await import("./externalMysql");
      const result = await saveContactMessage({ name: String(name).slice(0, 160), phone: String(phone).slice(0, 32), message: String(message).slice(0, 5000) });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("[External MySQL] Failed to store contact message", error);
      return res.status(503).json({ message: "Não foi possível registrar a mensagem agora." });
    }
  });
}
