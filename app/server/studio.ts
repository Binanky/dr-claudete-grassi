import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import {
  appointmentEvents,
  appointmentTokens,
  appointments,
  clients,
  services,
  weeklyAvailability,
} from "../drizzle/schema";
import {
  AppointmentStatus,
  buildSlotTimes,
  formatTimeInStudioTimezone,
  toAppointmentTimestamp,
} from "../shared/bookingRules";
import { hashAccessToken } from "../shared/security";
import { getDb } from "./db";

type StudioDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const studioProfile = {
  name: "Dra. Claudete Grassi",
  role: "Psicóloga · CRP 08/22767",
  city: "Pato Branco, PR",
  instagram: "@grassiclaudete",
  bio: "Psicoterapia, terapia EMDR e educação parental com escuta, presença e respeito à sua história.",
};

export const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function nextDateForWeekday(weekday: number, occurrence = 1) {
  const date = new Date();
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
  throw new Error("Não foi possível gerar uma data demonstrativa");
}

function appointmentStatusLabel(status: AppointmentStatus) {
  return { pending: "Solicitação recebida", confirmed: "Agendamento confirmado", cancelled: "Agendamento cancelado", completed: "Atendimento concluído" }[status];
}

export async function ensureStudioDemoData() {
  const db = await getDb();
  if (!db) return;

  const existingServices = await db.select({ id: services.id }).from(services).limit(1);
  if (existingServices.length > 0) return;

  await db.insert(services).values([
    { name: "Psicoterapia", description: "Atendimento individual para compreender sentimentos, relações e momentos de mudança.", durationMinutes: 50, priceCents: 0, displayOrder: 1 },
    { name: "Terapia EMDR", description: "Processo terapêutico focado na elaboração de experiências difíceis e traumas.", durationMinutes: 60, priceCents: 0, displayOrder: 2 },
    { name: "Educação parental", description: "Orientação para relações familiares mais conscientes e conectadas.", durationMinutes: 60, priceCents: 0, displayOrder: 3 },
  ]);

  await db.insert(weeklyAvailability).values(
    weekdayLabels.map((label, weekday) => ({
      weekday,
      label,
      isActive: weekday >= 1 && weekday <= 5,
      startTime: weekday === 5 ? "09:00" : "10:00",
      endTime: weekday === 5 ? "16:00" : "18:00",
      slotMinutes: 60,
    })),
  );

  await db.insert(clients).values([
    { name: "Renata Almeida", email: "renata.almeida@example.com", phone: "(46) 98888-1212" },
    { name: "Beatriz Nogueira", email: "beatriz.nogueira@example.com", phone: "(46) 97777-3434" },
    { name: "Marina Sato", email: "marina.sato@example.com", phone: "(46) 96666-5656" },
  ]);

  const demoClients = await db.select().from(clients).orderBy(asc(clients.id));
  const demoServices = await db.select().from(services).orderBy(asc(services.id));
  const completedDate = nextDateForWeekday(2, 1);
  const futureDate = nextDateForWeekday(3, 1);
  const pendingDate = nextDateForWeekday(5, 1);
  const demoAppointments = [
    { clientId: demoClients[0]!.id, serviceId: demoServices[1]!.id, scheduledAt: toAppointmentTimestamp(futureDate, "10:00"), status: "confirmed" as const, clientMessage: "Gostaria de iniciar uma rotina de cuidados faciais.", internalNotes: "Primeira sessão confirmada. Preferência por atendimento pela manhã." },
    { clientId: demoClients[1]!.id, serviceId: demoServices[3]!.id, scheduledAt: toAppointmentTimestamp(pendingDate, "14:00"), status: "pending" as const, clientMessage: "Tenho disponibilidade nas tardes de sexta-feira.", internalNotes: "Aguardar confirmação de preferência de horário." },
    { clientId: demoClients[2]!.id, serviceId: demoServices[0]!.id, scheduledAt: toAppointmentTimestamp(completedDate, "16:00") - 7 * 24 * 60 * 60 * 1000, status: "completed" as const, clientMessage: "Quero entender quais cuidados combinam com minha rotina.", internalNotes: "Retornar em 30 dias para acompanhamento." },
  ];

  for (const demo of demoAppointments) {
    await db.insert(appointments).values(demo);
    const [appointment] = await db.select().from(appointments).where(eq(appointments.scheduledAt, demo.scheduledAt)).limit(1);
    if (!appointment) continue;
    await db.insert(appointmentEvents).values({
      appointmentId: appointment.id,
      eventType: demo.status,
      description: appointmentStatusLabel(demo.status),
    });
    await db.insert(appointmentTokens).values({
      appointmentId: appointment.id,
      tokenHash: hashAccessToken(randomBytes(32).toString("base64url")),
    });
  }
}

export async function getAvailableSlotsForDate(db: StudioDb, date: string) {
  const reference = new Date(`${date}T12:00:00`);
  if (Number.isNaN(reference.getTime())) return [];
  const configuration = await db.select().from(weeklyAvailability).where(eq(weeklyAvailability.weekday, reference.getDay())).limit(1);
  const day = configuration[0];
  if (!day?.isActive) return [];

  const startOfDay = toAppointmentTimestamp(date, "00:00");
  const nextDate = new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endOfDay = toAppointmentTimestamp(nextDate.toLocaleDateString("en-CA"), "00:00");
  const booked = await db
    .select({ scheduledAt: appointments.scheduledAt, status: appointments.status })
    .from(appointments)
    .where(and(gte(appointments.scheduledAt, startOfDay), lt(appointments.scheduledAt, endOfDay)));
  const occupiedTimes = new Set(booked.filter(item => item.status !== "cancelled").map(item => formatTimeInStudioTimezone(item.scheduledAt)));

  return buildSlotTimes(day.startTime, day.endTime, day.slotMinutes).filter(time => {
    const timestamp = toAppointmentTimestamp(date, time);
    return timestamp > Date.now() + 5 * 60 * 1000 && !occupiedTimes.has(time);
  });
}

export async function findOrCreateClient(db: StudioDb, input: { name: string; email: string; phone: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (existing[0]) return existing[0];

  await db.insert(clients).values({ name: input.name.trim(), email, phone: input.phone.trim() });
  const [created] = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  if (!created) throw new Error("Não foi possível criar o cadastro do cliente");
  return created;
}

export async function issueAppointmentToken(db: StudioDb, appointmentId: number) {
  await db.update(appointmentTokens).set({ revokedAt: new Date() }).where(and(eq(appointmentTokens.appointmentId, appointmentId), isNull(appointmentTokens.revokedAt)));
  const token = randomBytes(32).toString("base64url");
  await db.insert(appointmentTokens).values({ appointmentId, tokenHash: hashAccessToken(token) });
  return token;
}

export async function resolveAppointmentToken(db: StudioDb, token: string) {
  const rows = await db
    .select({
      tokenId: appointmentTokens.id,
      revokedAt: appointmentTokens.revokedAt,
      appointmentId: appointments.id,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      clientMessage: appointments.clientMessage,
      clientName: clients.name,
      serviceName: services.name,
      durationMinutes: services.durationMinutes,
    })
    .from(appointmentTokens)
    .innerJoin(appointments, eq(appointmentTokens.appointmentId, appointments.id))
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointmentTokens.tokenHash, hashAccessToken(token)))
    .limit(1);
  const appointment = rows[0];
  if (!appointment || appointment.revokedAt) return null;

  const events = await db
    .select({ eventType: appointmentEvents.eventType, description: appointmentEvents.description, createdAt: appointmentEvents.createdAt })
    .from(appointmentEvents)
    .where(eq(appointmentEvents.appointmentId, appointment.appointmentId))
    .orderBy(asc(appointmentEvents.createdAt));
  return { ...appointment, events };
}

export async function appendAppointmentEvent(db: StudioDb, appointmentId: number, eventType: string, description: string) {
  await db.insert(appointmentEvents).values({ appointmentId, eventType, description });
}

export async function assertAvailabilitySlot(db: StudioDb, date: string, time: string) {
  const slots = await getAvailableSlotsForDate(db, date);
  if (!slots.includes(time)) throw new Error("Este horário não está mais disponível.");
  return toAppointmentTimestamp(date, time);
}
