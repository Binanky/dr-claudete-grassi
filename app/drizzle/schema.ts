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
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  durationMinutes: int("durationMinutes").notNull().default(60),
  priceCents: int("priceCents").notNull(),
  displayOrder: int("displayOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("clients_email_unique").on(table.email), index("clients_phone_idx").on(table.phone)],
);

export const weeklyAvailability = mysqlTable(
  "weekly_availability",
  {
    id: int("id").autoincrement().primaryKey(),
    weekday: int("weekday").notNull(),
    label: varchar("label", { length: 20 }).notNull(),
    isActive: boolean("isActive").notNull().default(false),
    startTime: varchar("startTime", { length: 5 }).notNull(),
    endTime: varchar("endTime", { length: 5 }).notNull(),
    slotMinutes: int("slotMinutes").notNull().default(60),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("weekly_availability_weekday_unique").on(table.weekday)],
);

export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    serviceId: int("serviceId")
      .notNull()
      .references(() => services.id),
    scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(),
    status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"])
      .notNull()
      .default("pending"),
    clientMessage: text("clientMessage"),
    internalNotes: text("internalNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("appointments_scheduled_at_idx").on(table.scheduledAt),
    index("appointments_client_idx").on(table.clientId),
    index("appointments_status_idx").on(table.status),
  ],
);

export const appointmentTokens = mysqlTable(
  "appointment_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  table => [uniqueIndex("appointment_tokens_hash_unique").on(table.tokenHash), index("appointment_tokens_appointment_idx").on(table.appointmentId)],
);

export const appointmentEvents = mysqlTable(
  "appointment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    eventType: varchar("eventType", { length: 40 }).notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("appointment_events_appointment_idx").on(table.appointmentId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
