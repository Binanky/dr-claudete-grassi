import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { appointmentEvents, appointments, clients, services, weeklyAvailability } from "../../drizzle/schema";
import { canTransitionAppointmentStatus, isValidTime } from "../../shared/bookingRules";
import { isTrackingToken } from "../../shared/security";
import { ENV } from "../_core/env";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { isAdminRequest } from "../adminRoutes";
import {
  appendAppointmentEvent,
  assertAvailabilitySlot,
  ensureStudioDemoData,
  findOrCreateClient,
  getAvailableSlotsForDate,
  issueAppointmentToken,
  resolveAppointmentToken,
  studioProfile,
  weekdayLabels,
} from "../studio";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const appointmentStatusSchema = z.enum(["pending", "confirmed", "cancelled", "completed"]);

const studioAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!isAdminRequest(ctx.req) && (!ctx.user || ctx.user.openId !== ENV.ownerOpenId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este painel é exclusivo da profissional responsável." });
  }
  return next();
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

function toPublicStatus(status: "pending" | "confirmed" | "cancelled" | "completed") {
  return { pending: "Pendente", confirmed: "Confirmado", cancelled: "Cancelado", completed: "Concluído" }[status];
}

function previewDashboard() {
  const now = Date.now();
  const previewServices = [
    { id: 1, name: "Psicoterapia", description: "Atendimento individual para compreender sentimentos, relações e momentos de mudança.", durationMinutes: 50, priceCents: 0, displayOrder: 1, isActive: true, createdAt: new Date() },
    { id: 2, name: "Terapia EMDR", description: "Processo terapêutico focado na elaboração de experiências difíceis e traumas.", durationMinutes: 60, priceCents: 0, displayOrder: 2, isActive: true, createdAt: new Date() },
    { id: 3, name: "Educação parental", description: "Orientação para relações familiares mais conscientes e conectadas.", durationMinutes: 60, priceCents: 0, displayOrder: 3, isActive: true, createdAt: new Date() },
  ];
  const previewAvailability = weekdayLabels.map((label, weekday) => ({ id: weekday + 1, weekday, label, isActive: weekday >= 1 && weekday <= 5, startTime: "08:00", endTime: "20:00", slotMinutes: 60, updatedAt: new Date() }));
  const previewClients = [{ id: 1, name: "Solicitação demonstrativa", email: "cliente@exemplo.com", phone: "(46) 99999-0000", createdAt: new Date(), updatedAt: new Date(), appointmentCount: 1, latestAppointmentAt: now + 86400000 }];
  const previewAppointments = [{ id: 1, clientId: 1, serviceId: 1, scheduledAt: now + 86400000, status: "pending" as const, clientMessage: "Solicitação de demonstração do painel.", internalNotes: null, createdAt: new Date(), clientName: "Solicitação demonstrativa", clientEmail: "cliente@exemplo.com", clientPhone: "(46) 99999-0000", serviceName: "Psicoterapia" }];
  return { profile: studioProfile, appointments: previewAppointments, clients: previewClients, services: previewServices, availability: previewAvailability, metrics: { totalClients: 1, pending: 1, confirmed: 0, completed: 0 } };
}

export const studioRouter = router({
  publicProfile: publicProcedure.query(async () => {
    await ensureStudioDemoData();
    const db = await requireDb();
    const activeServices = await db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.displayOrder));
    return { profile: studioProfile, services: activeServices };
  }),

  availabilityForDate: publicProcedure.input(z.object({ date: dateSchema })).query(async ({ input }) => {
    await ensureStudioDemoData();
    const db = await requireDb();
    return { date: input.date, slots: await getAvailableSlotsForDate(db, input.date) };
  }),

  requestAppointment: publicProcedure
    .input(z.object({ name: z.string().min(3).max(160), cpf: z.string().regex(/^\d{11}$/, "CPF inválido"), email: z.string().email().max(320), phone: z.string().min(8).max(32), serviceId: z.number().int().positive(), message: z.string().max(1200).optional(), date: dateSchema, time: z.string().refine(isValidTime, "Horário inválido") }))
    .mutation(async ({ input }) => {
      await ensureStudioDemoData();
      const db = await requireDb();
      const service = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.isActive, true))).limit(1);
      if (!service[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Serviço não encontrado." });

      let scheduledAt: number;
      try {
        scheduledAt = await assertAvailabilitySlot(db, input.date, input.time);
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Horário indisponível." });
      }

      const client = await findOrCreateClient(db, input);
      try {
        await db.insert(appointments).values({ clientId: client.id, serviceId: service[0].id, scheduledAt, status: "pending", clientMessage: `CPF: ${input.cpf}${input.message?.trim() ? `\n${input.message.trim()}` : ""}` });
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "Este horário acabou de ser reservado. Escolha outro horário." });
      }
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.clientId, client.id), eq(appointments.scheduledAt, scheduledAt)))
        .orderBy(desc(appointments.id))
        .limit(1);
      if (!appointment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir a solicitação." });
      await appendAppointmentEvent(db, appointment.id, "pending", "Solicitação recebida pela Dra. Claudete Grassi.");
      const token = await issueAppointmentToken(db, appointment.id);
      return { appointmentId: appointment.id, token };
    }),

  trackAppointment: publicProcedure.input(z.object({ token: z.string().refine(isTrackingToken, "Token inválido") })).query(async ({ input }) => {
    const db = await requireDb();
    const appointment = await resolveAppointmentToken(db, input.token);
    if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Link de acompanhamento não encontrado ou revogado." });
    return { ...appointment, publicStatus: toPublicStatus(appointment.status) };
  }),

  cancelWithToken: publicProcedure.input(z.object({ token: z.string().refine(isTrackingToken, "Token inválido") })).mutation(async ({ input }) => {
    const db = await requireDb();
    const appointment = await resolveAppointmentToken(db, input.token);
    if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Link de acompanhamento não encontrado." });
    if (!canTransitionAppointmentStatus(appointment.status, "cancelled")) throw new TRPCError({ code: "BAD_REQUEST", message: "Este agendamento não pode mais ser cancelado." });
    await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointment.appointmentId));
    await appendAppointmentEvent(db, appointment.appointmentId, "cancelled", "Agendamento cancelado pela cliente.");
    return { success: true };
  }),

  dashboard: studioAdminProcedure.query(async () => {
    await ensureStudioDemoData();
    const db = await getDb();
    if (!db) return previewDashboard();
    const [allAppointments, allClients, allServices, availability] = await Promise.all([
      db.select({ id: appointments.id, clientId: appointments.clientId, serviceId: appointments.serviceId, scheduledAt: appointments.scheduledAt, status: appointments.status, clientMessage: appointments.clientMessage, internalNotes: appointments.internalNotes, createdAt: appointments.createdAt, clientName: clients.name, clientEmail: clients.email, clientPhone: clients.phone, serviceName: services.name }).from(appointments).innerJoin(clients, eq(appointments.clientId, clients.id)).innerJoin(services, eq(appointments.serviceId, services.id)).orderBy(desc(appointments.scheduledAt)),
      db.select().from(clients).orderBy(desc(clients.createdAt)),
      db.select().from(services).orderBy(asc(services.displayOrder)),
      db.select().from(weeklyAvailability).orderBy(asc(weeklyAvailability.weekday)),
    ]);
    const enrichedClients = allClients.map(client => ({ ...client, appointmentCount: allAppointments.filter(item => item.clientId === client.id).length, latestAppointmentAt: allAppointments.find(item => item.clientId === client.id)?.scheduledAt ?? null }));
    return {
      profile: studioProfile,
      appointments: allAppointments,
      clients: enrichedClients,
      services: allServices,
      availability,
      metrics: {
        totalClients: allClients.length,
        pending: allAppointments.filter(item => item.status === "pending").length,
        confirmed: allAppointments.filter(item => item.status === "confirmed").length,
        completed: allAppointments.filter(item => item.status === "completed").length,
      },
    };
  }),

  updateAppointment: studioAdminProcedure
    .input(z.object({ appointmentId: z.number().int().positive(), status: appointmentStatusSchema.optional(), internalNotes: z.string().max(2000).optional() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const current = await db.select().from(appointments).where(eq(appointments.id, input.appointmentId)).limit(1);
      if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
      if (input.status && !canTransitionAppointmentStatus(current[0].status, input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Transição de status não permitida." });
      await db.update(appointments).set({ status: input.status ?? current[0].status, internalNotes: input.internalNotes ?? current[0].internalNotes }).where(eq(appointments.id, input.appointmentId));
      if (input.status && input.status !== current[0].status) await appendAppointmentEvent(db, input.appointmentId, input.status, toPublicStatus(input.status));
      return { success: true };
    }),

  issueTrackingToken: studioAdminProcedure.input(z.object({ appointmentId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const result = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.id, input.appointmentId)).limit(1);
    if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
    return { token: await issueAppointmentToken(db, input.appointmentId) };
  }),

  updateAvailability: studioAdminProcedure
    .input(z.object({ days: z.array(z.object({ weekday: z.number().int().min(0).max(6), isActive: z.boolean(), startTime: z.string().refine(isValidTime), endTime: z.string().refine(isValidTime), slotMinutes: z.number().int().min(30).max(120) })).length(7) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      for (const day of input.days) {
        if (day.startTime >= day.endTime) throw new TRPCError({ code: "BAD_REQUEST", message: "O horário inicial deve ser anterior ao final." });
        await db.update(weeklyAvailability).set({ isActive: day.isActive, startTime: day.startTime, endTime: day.endTime, slotMinutes: day.slotMinutes }).where(eq(weeklyAvailability.weekday, day.weekday));
      }
      return { success: true };
    }),

  clientHistory: studioAdminProcedure.input(z.object({ clientId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const client = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
    if (!client[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
    const history = await db.select({ id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status, serviceName: services.name, internalNotes: appointments.internalNotes }).from(appointments).innerJoin(services, eq(appointments.serviceId, services.id)).where(eq(appointments.clientId, input.clientId)).orderBy(desc(appointments.scheduledAt));
    return { client: client[0], appointments: history };
  }),
});
