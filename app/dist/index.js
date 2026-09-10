var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/externalMysql.ts
var externalMysql_exports = {};
__export(externalMysql_exports, {
  ensureContactTable: () => ensureContactTable,
  getExternalMysql: () => getExternalMysql,
  hasExternalMysqlConfig: () => hasExternalMysqlConfig,
  saveContactMessage: () => saveContactMessage
});
import mysql2 from "mysql2/promise";
function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER);
}
function hasExternalMysqlConfig() {
  return mysqlConfigured();
}
async function getExternalMysql() {
  if (!mysqlConfigured()) return null;
  if (!pool) {
    pool = mysql2.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD ?? "",
      ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : void 0,
      waitForConnections: true,
      connectionLimit: 5,
      charset: "utf8mb4"
    });
  }
  return pool;
}
async function ensureContactTable() {
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
async function saveContactMessage(input) {
  const db = await getExternalMysql();
  if (!db) return { stored: false, reason: "mysql_not_configured" };
  await ensureContactTable();
  await db.execute("INSERT INTO site_contact_messages (name, phone, message) VALUES (?, ?, ?)", [input.name, input.phone, input.message]);
  return { stored: true };
}
var pool;
var init_externalMysql = __esm({
  "server/externalMysql.ts"() {
    "use strict";
    pool = null;
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { eq } from "drizzle-orm";

// drizzle/schema.ts
import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  durationMinutes: int("durationMinutes").notNull().default(60),
  priceCents: int("priceCents").notNull(),
  displayOrder: int("displayOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("clients_email_unique").on(table.email), index("clients_phone_idx").on(table.phone)]
);
var weeklyAvailability = mysqlTable(
  "weekly_availability",
  {
    id: int("id").autoincrement().primaryKey(),
    weekday: int("weekday").notNull(),
    label: varchar("label", { length: 20 }).notNull(),
    isActive: boolean("isActive").notNull().default(false),
    startTime: varchar("startTime", { length: 5 }).notNull(),
    endTime: varchar("endTime", { length: 5 }).notNull(),
    slotMinutes: int("slotMinutes").notNull().default(60),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("weekly_availability_weekday_unique").on(table.weekday)]
);
var appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    serviceId: int("serviceId").notNull().references(() => services.id),
    scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(),
    status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).notNull().default("pending"),
    clientMessage: text("clientMessage"),
    internalNotes: text("internalNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    index("appointments_scheduled_at_idx").on(table.scheduledAt),
    index("appointments_client_idx").on(table.clientId),
    index("appointments_status_idx").on(table.status)
  ]
);
var appointmentTokens = mysqlTable(
  "appointment_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt")
  },
  (table) => [uniqueIndex("appointment_tokens_hash_unique").on(table.tokenHash), index("appointment_tokens_appointment_idx").on(table.appointmentId)]
);
var appointmentEvents = mysqlTable(
  "appointment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    eventType: varchar("eventType", { length: 40 }).notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("appointment_events_appointment_idx").on(table.appointmentId)]
);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var database = null;
async function getDb() {
  if (!database && process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_USER) {
    const pool2 = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD ?? "", ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : void 0, connectionLimit: 5, charset: "utf8mb4" });
    database = drizzle(pool2);
  }
  return database;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("openId \xE9 obrigat\xF3rio");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret2 = ENV.cookieSecret;
    return new TextEncoder().encode(secret2);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/studio.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and as and2, asc as asc2, desc, eq as eq3 } from "drizzle-orm";
import { z as z2 } from "zod";

// shared/bookingRules.ts
function buildSlotTimes(startTime, endTime, slotMinutes = 60) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const slots = [];
  for (let minute = start; minute + slotMinutes <= end; minute += slotMinutes) {
    const hour = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    slots.push(`${hour}:${minutes}`);
  }
  return slots;
}
function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function toAppointmentTimestamp(date, time) {
  return (/* @__PURE__ */ new Date(`${date}T${time}:00-03:00`)).getTime();
}
function formatTimeInStudioTimezone(timestamp2) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp2));
}
function canTransitionAppointmentStatus(current, next) {
  if (current === next) return true;
  const transitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["cancelled", "completed"],
    cancelled: [],
    completed: []
  };
  return transitions[current].includes(next);
}

// shared/security.ts
import { createHash } from "node:crypto";
function hashAccessToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function isTrackingToken(value) {
  return /^[A-Za-z0-9_-]{24,160}$/.test(value);
}

// server/adminRoutes.ts
init_externalMysql();
import crypto from "node:crypto";
var COOKIE = "dr_claudete_admin";
var DEFAULT_USER = "Admin";
var DEFAULT_PASSWORD = "Admin123@";
function validateAdminCredentials(username, password) {
  return username === (process.env.ADMIN_USERNAME || DEFAULT_USER) && password === (process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD);
}
function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || "dr-claudete-preview-secret";
}
function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}
function makeToken() {
  const expires = Date.now() + 1e3 * 60 * 60 * 12;
  const payload = `${DEFAULT_USER}:${expires}`;
  return `${payload}.${sign(payload)}`;
}
function readCookie(req) {
  const raw = req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return raw ? decodeURIComponent(raw) : void 0;
}
function isAdminRequest(req) {
  const token = readCookie(req);
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const provided = token.slice(lastDot + 1);
  const [user, expires] = payload.split(":");
  if (user !== DEFAULT_USER || Number(expires) < Date.now()) return false;
  const expected = sign(payload);
  return provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
function secureCookie(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}
function registerAdminRoutes(app) {
  app.get("/api/admin/me", (req, res) => res.json({ authenticated: isAdminRequest(req), username: isAdminRequest(req) ? DEFAULT_USER : void 0 }));
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!validateAdminCredentials(username, password)) return res.status(401).json({ message: "Usu\xE1rio ou senha inv\xE1lidos." });
    const token = makeToken();
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookie(req), maxAge: 1e3 * 60 * 60 * 12, path: "/" });
    return res.json({ authenticated: true, username: DEFAULT_USER });
  });
  app.post("/api/admin/logout", (_req, res) => {
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
    res.json({ success: true });
  });
  app.get("/api/admin/mysql-status", (req, res) => {
    if (!isAdminRequest(req)) return res.status(401).json({ message: "N\xE3o autorizado." });
    return res.json({ configured: hasExternalMysqlConfig(), provider: "mysql" });
  });
}
function registerContactRoutes(app) {
  app.post("/api/contact", async (req, res) => {
    const { name, phone, message } = req.body ?? {};
    if (!name || !phone || !message) return res.status(400).json({ message: "Preencha nome, telefone e mensagem." });
    try {
      const { saveContactMessage: saveContactMessage2 } = await Promise.resolve().then(() => (init_externalMysql(), externalMysql_exports));
      const result = await saveContactMessage2({ name: String(name).slice(0, 160), phone: String(phone).slice(0, 32), message: String(message).slice(0, 5e3) });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("[External MySQL] Failed to store contact message", error);
      return res.status(503).json({ message: "N\xE3o foi poss\xEDvel registrar a mensagem agora." });
    }
  });
}

// server/studio.ts
import { randomBytes } from "node:crypto";
import { and, asc, eq as eq2, gte, isNull, lt } from "drizzle-orm";
var studioProfile = {
  name: "Dra. Claudete Grassi",
  role: "Psic\xF3loga \xB7 CRP 08/22767",
  city: "Pato Branco, PR",
  instagram: "@grassiclaudete",
  bio: "Psicoterapia, terapia EMDR e educa\xE7\xE3o parental com escuta, presen\xE7a e respeito \xE0 sua hist\xF3ria."
};
var weekdayLabels = ["Domingo", "Segunda-feira", "Ter\xE7a-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "S\xE1bado"];
function nextDateForWeekday(weekday, occurrence = 1) {
  const date = /* @__PURE__ */ new Date();
  let added = 1;
  let found = 0;
  while (added < 28) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + added);
    if (candidate.getDay() === weekday) {
      found += 1;
      if (found === occurrence) {
        return candidate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      }
    }
    added += 1;
  }
  throw new Error("N\xE3o foi poss\xEDvel gerar uma data demonstrativa");
}
function appointmentStatusLabel(status) {
  return { pending: "Solicita\xE7\xE3o recebida", confirmed: "Agendamento confirmado", cancelled: "Agendamento cancelado", completed: "Atendimento conclu\xEDdo" }[status];
}
async function ensureStudioDemoData() {
  const db = await getDb();
  if (!db) return;
  const existingServices = await db.select({ id: services.id }).from(services).limit(1);
  if (existingServices.length > 0) return;
  await db.insert(services).values([
    { name: "Psicoterapia", description: "Atendimento individual para compreender sentimentos, rela\xE7\xF5es e momentos de mudan\xE7a.", durationMinutes: 50, priceCents: 0, displayOrder: 1 },
    { name: "Terapia EMDR", description: "Processo terap\xEAutico focado na elabora\xE7\xE3o de experi\xEAncias dif\xEDceis e traumas.", durationMinutes: 60, priceCents: 0, displayOrder: 2 },
    { name: "Educa\xE7\xE3o parental", description: "Orienta\xE7\xE3o para rela\xE7\xF5es familiares mais conscientes e conectadas.", durationMinutes: 60, priceCents: 0, displayOrder: 3 }
  ]);
  await db.insert(weeklyAvailability).values(
    weekdayLabels.map((label, weekday) => ({
      weekday,
      label,
      isActive: weekday >= 1 && weekday <= 5,
      startTime: weekday === 5 ? "09:00" : "10:00",
      endTime: weekday === 5 ? "16:00" : "18:00",
      slotMinutes: 60
    }))
  );
  await db.insert(clients).values([
    { name: "Renata Almeida", email: "renata.almeida@example.com", phone: "(46) 98888-1212" },
    { name: "Beatriz Nogueira", email: "beatriz.nogueira@example.com", phone: "(46) 97777-3434" },
    { name: "Marina Sato", email: "marina.sato@example.com", phone: "(46) 96666-5656" }
  ]);
  const demoClients = await db.select().from(clients).orderBy(asc(clients.id));
  const demoServices = await db.select().from(services).orderBy(asc(services.id));
  const completedDate = nextDateForWeekday(2, 1);
  const futureDate = nextDateForWeekday(3, 1);
  const pendingDate = nextDateForWeekday(5, 1);
  const demoAppointments = [
    { clientId: demoClients[0].id, serviceId: demoServices[1].id, scheduledAt: toAppointmentTimestamp(futureDate, "10:00"), status: "confirmed", clientMessage: "Gostaria de iniciar uma rotina de cuidados faciais.", internalNotes: "Primeira sess\xE3o confirmada. Prefer\xEAncia por atendimento pela manh\xE3." },
    { clientId: demoClients[1].id, serviceId: demoServices[3].id, scheduledAt: toAppointmentTimestamp(pendingDate, "14:00"), status: "pending", clientMessage: "Tenho disponibilidade nas tardes de sexta-feira.", internalNotes: "Aguardar confirma\xE7\xE3o de prefer\xEAncia de hor\xE1rio." },
    { clientId: demoClients[2].id, serviceId: demoServices[0].id, scheduledAt: toAppointmentTimestamp(completedDate, "16:00") - 7 * 24 * 60 * 60 * 1e3, status: "completed", clientMessage: "Quero entender quais cuidados combinam com minha rotina.", internalNotes: "Retornar em 30 dias para acompanhamento." }
  ];
  for (const demo of demoAppointments) {
    await db.insert(appointments).values(demo);
    const [appointment] = await db.select().from(appointments).where(eq2(appointments.scheduledAt, demo.scheduledAt)).limit(1);
    if (!appointment) continue;
    await db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      eventType: demo.status,
      description: appointmentStatusLabel(demo.status)
    });
    await db.insert(appointmentTokens).values({
      appointmentId: appointment.id,
      tokenHash: hashAccessToken(randomBytes(32).toString("base64url"))
    });
  }
}
async function getAvailableSlotsForDate(db, date) {
  const reference = /* @__PURE__ */ new Date(`${date}T12:00:00`);
  if (Number.isNaN(reference.getTime())) return [];
  const configuration = await db.select().from(weeklyAvailability).where(eq2(weeklyAvailability.weekday, reference.getDay())).limit(1);
  const day = configuration[0];
  if (!day?.isActive) return [];
  const startOfDay = toAppointmentTimestamp(date, "00:00");
  const nextDate = /* @__PURE__ */ new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endOfDay = toAppointmentTimestamp(nextDate.toLocaleDateString("en-CA"), "00:00");
  const booked = await db.select({ scheduledAt: appointments.scheduledAt, status: appointments.status }).from(appointments).where(and(gte(appointments.scheduledAt, startOfDay), lt(appointments.scheduledAt, endOfDay)));
  const occupiedTimes = new Set(booked.filter((item) => item.status !== "cancelled").map((item) => formatTimeInStudioTimezone(item.scheduledAt)));
  return buildSlotTimes(day.startTime, day.endTime, day.slotMinutes).filter((time) => {
    const timestamp2 = toAppointmentTimestamp(date, time);
    return timestamp2 > Date.now() + 5 * 60 * 1e3 && !occupiedTimes.has(time);
  });
}
async function findOrCreateClient(db, input) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(clients).where(eq2(clients.email, email)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(clients).values({ name: input.name.trim(), email, phone: input.phone.trim() });
  const [created] = await db.select().from(clients).where(eq2(clients.email, email)).limit(1);
  if (!created) throw new Error("N\xE3o foi poss\xEDvel criar o cadastro do cliente");
  return created;
}
async function issueAppointmentToken(db, appointmentId) {
  await db.update(appointmentTokens).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and(eq2(appointmentTokens.appointmentId, appointmentId), isNull(appointmentTokens.revokedAt)));
  const token = randomBytes(32).toString("base64url");
  await db.insert(appointmentTokens).values({ appointmentId, tokenHash: hashAccessToken(token) });
  return token;
}
async function resolveAppointmentToken(db, token) {
  const rows = await db.select({
    tokenId: appointmentTokens.id,
    revokedAt: appointmentTokens.revokedAt,
    appointmentId: appointments.id,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    clientMessage: appointments.clientMessage,
    clientName: clients.name,
    serviceName: services.name,
    durationMinutes: services.durationMinutes
  }).from(appointmentTokens).innerJoin(appointments, eq2(appointmentTokens.appointmentId, appointments.id)).innerJoin(clients, eq2(appointments.clientId, clients.id)).innerJoin(services, eq2(appointments.serviceId, services.id)).where(eq2(appointmentTokens.tokenHash, hashAccessToken(token))).limit(1);
  const appointment = rows[0];
  if (!appointment || appointment.revokedAt) return null;
  const events = await db.select({ eventType: appointmentEvents.eventType, description: appointmentEvents.description, createdAt: appointmentEvents.createdAt }).from(appointmentEvents).where(eq2(appointmentEvents.appointmentId, appointment.appointmentId)).orderBy(asc(appointmentEvents.createdAt));
  return { ...appointment, events };
}
async function appendAppointmentEvent(db, appointmentId, eventType, description) {
  await db.insert(appointmentEvents).values({ appointmentId, eventType, description });
}
async function assertAvailabilitySlot(db, date, time) {
  const slots = await getAvailableSlotsForDate(db, date);
  if (!slots.includes(time)) throw new Error("Este hor\xE1rio n\xE3o est\xE1 mais dispon\xEDvel.");
  return toAppointmentTimestamp(date, time);
}

// server/routers/studio.ts
var dateSchema = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var appointmentStatusSchema = z2.enum(["pending", "confirmed", "cancelled", "completed"]);
var studioAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!isAdminRequest(ctx.req) && (!ctx.user || ctx.user.openId !== ENV.ownerOpenId)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Este painel \xE9 exclusivo da profissional respons\xE1vel." });
  }
  return next();
});
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return db;
}
function toPublicStatus(status) {
  return { pending: "Pendente", confirmed: "Confirmado", cancelled: "Cancelado", completed: "Conclu\xEDdo" }[status];
}
function previewDashboard() {
  const now = Date.now();
  const previewServices = [
    { id: 1, name: "Psicoterapia", description: "Atendimento individual para compreender sentimentos, rela\xE7\xF5es e momentos de mudan\xE7a.", durationMinutes: 50, priceCents: 0, displayOrder: 1, isActive: true, createdAt: /* @__PURE__ */ new Date() },
    { id: 2, name: "Terapia EMDR", description: "Processo terap\xEAutico focado na elabora\xE7\xE3o de experi\xEAncias dif\xEDceis e traumas.", durationMinutes: 60, priceCents: 0, displayOrder: 2, isActive: true, createdAt: /* @__PURE__ */ new Date() },
    { id: 3, name: "Educa\xE7\xE3o parental", description: "Orienta\xE7\xE3o para rela\xE7\xF5es familiares mais conscientes e conectadas.", durationMinutes: 60, priceCents: 0, displayOrder: 3, isActive: true, createdAt: /* @__PURE__ */ new Date() }
  ];
  const previewAvailability = weekdayLabels.map((label, weekday) => ({ id: weekday + 1, weekday, label, isActive: weekday >= 1 && weekday <= 5, startTime: "08:00", endTime: "20:00", slotMinutes: 60, updatedAt: /* @__PURE__ */ new Date() }));
  const previewClients = [{ id: 1, name: "Solicita\xE7\xE3o demonstrativa", email: "cliente@exemplo.com", phone: "(46) 99999-0000", createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date(), appointmentCount: 1, latestAppointmentAt: now + 864e5 }];
  const previewAppointments = [{ id: 1, clientId: 1, serviceId: 1, scheduledAt: now + 864e5, status: "pending", clientMessage: "Solicita\xE7\xE3o de demonstra\xE7\xE3o do painel.", internalNotes: null, createdAt: /* @__PURE__ */ new Date(), clientName: "Solicita\xE7\xE3o demonstrativa", clientEmail: "cliente@exemplo.com", clientPhone: "(46) 99999-0000", serviceName: "Psicoterapia" }];
  return { profile: studioProfile, appointments: previewAppointments, clients: previewClients, services: previewServices, availability: previewAvailability, metrics: { totalClients: 1, pending: 1, confirmed: 0, completed: 0 } };
}
var studioRouter = router({
  publicProfile: publicProcedure.query(async () => {
    await ensureStudioDemoData();
    const db = await requireDb();
    const activeServices = await db.select().from(services).where(eq3(services.isActive, true)).orderBy(asc2(services.displayOrder));
    return { profile: studioProfile, services: activeServices };
  }),
  availabilityForDate: publicProcedure.input(z2.object({ date: dateSchema })).query(async ({ input }) => {
    await ensureStudioDemoData();
    const db = await requireDb();
    return { date: input.date, slots: await getAvailableSlotsForDate(db, input.date) };
  }),
  requestAppointment: publicProcedure.input(z2.object({ name: z2.string().min(3).max(160), cpf: z2.string().regex(/^\d{11}$/, "CPF inv\xE1lido"), email: z2.string().email().max(320), phone: z2.string().min(8).max(32), serviceId: z2.number().int().positive(), message: z2.string().max(1200).optional(), date: dateSchema, time: z2.string().refine(isValidTime, "Hor\xE1rio inv\xE1lido") })).mutation(async ({ input }) => {
    await ensureStudioDemoData();
    const db = await requireDb();
    const service = await db.select().from(services).where(and2(eq3(services.id, input.serviceId), eq3(services.isActive, true))).limit(1);
    if (!service[0]) throw new TRPCError3({ code: "BAD_REQUEST", message: "Servi\xE7o n\xE3o encontrado." });
    let scheduledAt;
    try {
      scheduledAt = await assertAvailabilitySlot(db, input.date, input.time);
    } catch (error) {
      throw new TRPCError3({ code: "CONFLICT", message: error instanceof Error ? error.message : "Hor\xE1rio indispon\xEDvel." });
    }
    const client = await findOrCreateClient(db, input);
    try {
      await db.insert(appointments).values({ clientId: client.id, serviceId: service[0].id, scheduledAt, status: "pending", clientMessage: `CPF: ${input.cpf}${input.message?.trim() ? `
${input.message.trim()}` : ""}` });
    } catch {
      throw new TRPCError3({ code: "CONFLICT", message: "Este hor\xE1rio acabou de ser reservado. Escolha outro hor\xE1rio." });
    }
    const [appointment] = await db.select().from(appointments).where(and2(eq3(appointments.clientId, client.id), eq3(appointments.scheduledAt, scheduledAt))).orderBy(desc(appointments.id)).limit(1);
    if (!appointment) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel concluir a solicita\xE7\xE3o." });
    await appendAppointmentEvent(db, appointment.id, "pending", "Solicita\xE7\xE3o recebida pela Dra. Claudete Grassi.");
    const token = await issueAppointmentToken(db, appointment.id);
    return { appointmentId: appointment.id, token };
  }),
  trackAppointment: publicProcedure.input(z2.object({ token: z2.string().refine(isTrackingToken, "Token inv\xE1lido") })).query(async ({ input }) => {
    const db = await requireDb();
    const appointment = await resolveAppointmentToken(db, input.token);
    if (!appointment) throw new TRPCError3({ code: "NOT_FOUND", message: "Link de acompanhamento n\xE3o encontrado ou revogado." });
    return { ...appointment, publicStatus: toPublicStatus(appointment.status) };
  }),
  cancelWithToken: publicProcedure.input(z2.object({ token: z2.string().refine(isTrackingToken, "Token inv\xE1lido") })).mutation(async ({ input }) => {
    const db = await requireDb();
    const appointment = await resolveAppointmentToken(db, input.token);
    if (!appointment) throw new TRPCError3({ code: "NOT_FOUND", message: "Link de acompanhamento n\xE3o encontrado." });
    if (!canTransitionAppointmentStatus(appointment.status, "cancelled")) throw new TRPCError3({ code: "BAD_REQUEST", message: "Este agendamento n\xE3o pode mais ser cancelado." });
    await db.update(appointments).set({ status: "cancelled" }).where(eq3(appointments.id, appointment.appointmentId));
    await appendAppointmentEvent(db, appointment.appointmentId, "cancelled", "Agendamento cancelado pela cliente.");
    return { success: true };
  }),
  dashboard: studioAdminProcedure.query(async () => {
    await ensureStudioDemoData();
    const db = await getDb();
    if (!db) return previewDashboard();
    const [allAppointments, allClients, allServices, availability] = await Promise.all([
      db.select({ id: appointments.id, clientId: appointments.clientId, serviceId: appointments.serviceId, scheduledAt: appointments.scheduledAt, status: appointments.status, clientMessage: appointments.clientMessage, internalNotes: appointments.internalNotes, createdAt: appointments.createdAt, clientName: clients.name, clientEmail: clients.email, clientPhone: clients.phone, serviceName: services.name }).from(appointments).innerJoin(clients, eq3(appointments.clientId, clients.id)).innerJoin(services, eq3(appointments.serviceId, services.id)).orderBy(desc(appointments.scheduledAt)),
      db.select().from(clients).orderBy(desc(clients.createdAt)),
      db.select().from(services).orderBy(asc2(services.displayOrder)),
      db.select().from(weeklyAvailability).orderBy(asc2(weeklyAvailability.weekday))
    ]);
    const enrichedClients = allClients.map((client) => ({ ...client, appointmentCount: allAppointments.filter((item) => item.clientId === client.id).length, latestAppointmentAt: allAppointments.find((item) => item.clientId === client.id)?.scheduledAt ?? null }));
    return {
      profile: studioProfile,
      appointments: allAppointments,
      clients: enrichedClients,
      services: allServices,
      availability,
      metrics: {
        totalClients: allClients.length,
        pending: allAppointments.filter((item) => item.status === "pending").length,
        confirmed: allAppointments.filter((item) => item.status === "confirmed").length,
        completed: allAppointments.filter((item) => item.status === "completed").length
      }
    };
  }),
  updateAppointment: studioAdminProcedure.input(z2.object({ appointmentId: z2.number().int().positive(), status: appointmentStatusSchema.optional(), internalNotes: z2.string().max(2e3).optional() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const current = await db.select().from(appointments).where(eq3(appointments.id, input.appointmentId)).limit(1);
    if (!current[0]) throw new TRPCError3({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado." });
    if (input.status && !canTransitionAppointmentStatus(current[0].status, input.status)) throw new TRPCError3({ code: "BAD_REQUEST", message: "Transi\xE7\xE3o de status n\xE3o permitida." });
    await db.update(appointments).set({ status: input.status ?? current[0].status, internalNotes: input.internalNotes ?? current[0].internalNotes }).where(eq3(appointments.id, input.appointmentId));
    if (input.status && input.status !== current[0].status) await appendAppointmentEvent(db, input.appointmentId, input.status, toPublicStatus(input.status));
    return { success: true };
  }),
  issueTrackingToken: studioAdminProcedure.input(z2.object({ appointmentId: z2.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const result = await db.select({ id: appointments.id }).from(appointments).where(eq3(appointments.id, input.appointmentId)).limit(1);
    if (!result[0]) throw new TRPCError3({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado." });
    return { token: await issueAppointmentToken(db, input.appointmentId) };
  }),
  updateAvailability: studioAdminProcedure.input(z2.object({ days: z2.array(z2.object({ weekday: z2.number().int().min(0).max(6), isActive: z2.boolean(), startTime: z2.string().refine(isValidTime), endTime: z2.string().refine(isValidTime), slotMinutes: z2.number().int().min(30).max(120) })).length(7) })).mutation(async ({ input }) => {
    const db = await requireDb();
    for (const day of input.days) {
      if (day.startTime >= day.endTime) throw new TRPCError3({ code: "BAD_REQUEST", message: "O hor\xE1rio inicial deve ser anterior ao final." });
      await db.update(weeklyAvailability).set({ isActive: day.isActive, startTime: day.startTime, endTime: day.endTime, slotMinutes: day.slotMinutes }).where(eq3(weeklyAvailability.weekday, day.weekday));
    }
    return { success: true };
  }),
  clientHistory: studioAdminProcedure.input(z2.object({ clientId: z2.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const client = await db.select().from(clients).where(eq3(clients.id, input.clientId)).limit(1);
    if (!client[0]) throw new TRPCError3({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado." });
    const history = await db.select({ id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status, serviceName: services.name, internalNotes: appointments.internalNotes }).from(appointments).innerJoin(services, eq3(appointments.serviceId, services.id)).where(eq3(appointments.clientId, input.clientId)).orderBy(desc(appointments.scheduledAt));
    return { client: client[0], appointments: history };
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  studio: studioRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port;
  throw new Error("No available port found");
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAdminRoutes(app);
  registerContactRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}
startServer().catch(console.error);
