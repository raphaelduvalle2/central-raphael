// Janelas de decisão. Fora delas, a Central mostra só o que é urgente.
export const WINDOWS = [
  { start: "09:00", minutes: 30 },
  { start: "13:00", minutes: 30 },
  { start: "17:30", minutes: 30 },
];

const TZ = "America/Sao_Paulo";

function minutesNow(d = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d).split(":").map(Number);
  return h * 60 + m;
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function windowState(d = new Date()) {
  const now = minutesNow(d);
  for (const w of WINDOWS) {
    const s = toMin(w.start);
    if (now >= s && now < s + w.minutes) {
      return { open: true as const, endsIn: s + w.minutes - now, next: w.start };
    }
  }
  const next = WINDOWS.find((w) => toMin(w.start) > now) || WINDOWS[0];
  return { open: false as const, endsIn: 0, next: next.start, tomorrow: toMin(next.start) <= now };
}
