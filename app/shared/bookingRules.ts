export const appointmentStatuses = ["pending", "confirmed", "cancelled", "completed"] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export function buildSlotTimes(startTime: string, endTime: string, slotMinutes = 60) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const slots: string[] = [];

  for (let minute = start; minute + slotMinutes <= end; minute += slotMinutes) {
    const hour = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    slots.push(`${hour}:${minutes}`);
  }

  return slots;
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function toAppointmentTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).getTime();
}

export function formatTimeInStudioTimezone(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function canTransitionAppointmentStatus(current: AppointmentStatus, next: AppointmentStatus) {
  if (current === next) return true;
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["cancelled", "completed"],
    cancelled: [],
    completed: [],
  };

  return transitions[current].includes(next);
}
