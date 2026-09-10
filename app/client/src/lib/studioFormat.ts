export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function formatAppointment(timestamp: number, withWeekday = true) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: withWeekday ? "long" : undefined,
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

export function upcomingDates(days = 7, startOffset = 1) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + startOffset);
    return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  });
}
