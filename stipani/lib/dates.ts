// Datumski helperi — sve u Europe/Zagreb, bez vanjskih biblioteka.
// "Day key" je lokalni datum u formatu YYYY-MM-DD.

export const TZ = "Europe/Zagreb";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(ts: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(new Date(ts))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

function offsetMs(ts: number): number {
  const p = parts(ts);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Lokalna ponoć (Europe/Zagreb) zadanog dana kao UTC Date. */
export function dayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - offsetMs(guess);
  ts = guess - offsetMs(ts);
  return new Date(ts);
}

export function dayKey(date: Date | number): string {
  const p = parts(+date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Ponedjeljak tjedna u kojem je zadani dan. */
export function weekStartKey(key: string): string {
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = nedjelja
  return addDays(key, -((dow + 6) % 7));
}

export function hourInZagreb(date: Date): number {
  return parts(+date).hour;
}

export function greetingFor(date: Date): string {
  const h = hourInZagreb(date);
  if (h >= 5 && h < 10) return "Dobro jutro";
  if (h >= 10 && h < 18) return "Dobar dan";
  return "Dobra večer";
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const dayLongFmt = new Intl.DateTimeFormat("hr-HR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayShortFmt = new Intl.DateTimeFormat("hr-HR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("hr-HR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TZ,
});

/** "Srijeda, 30. rujna" */
export function formatDayLong(key: string): string {
  return capitalize(dayLongFmt.format(new Date(`${key}T12:00:00Z`)));
}

/** "sri, 30. rujna" */
export function formatDayShort(key: string): string {
  return dayShortFmt.format(new Date(`${key}T12:00:00Z`));
}

export function formatTime(date: Date | string): string {
  return timeFmt.format(new Date(date));
}

function formatDuration(startMs: number, endMs: number): string {
  const mins = Math.round((endMs - startMs) / 60000);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export interface TimeSpan {
  start: string;
  end: string;
  allDay: boolean;
}

/** "14:30 – 15:30 · 1 h" ili "Cijeli dan" */
export function formatEventTime(ev: TimeSpan): string {
  if (ev.allDay) return "Cijeli dan";
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  if (e <= s) return formatTime(s);
  const sameDay = dayKey(s) === dayKey(e);
  const end = sameDay ? formatTime(e) : `${formatDayShort(dayKey(e))} ${formatTime(e)}`;
  const dur = sameDay ? ` · ${formatDuration(+s, +e)}` : "";
  return `${formatTime(s)} – ${end}${dur}`;
}

/** Zadnji dan koji događaj stvarno pokriva (all-day end je ekskluzivan). */
export function eventDays(ev: TimeSpan): { first: string; last: string } {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const first = dayKey(s);
  if (e <= s) return { first, last: first };
  const last = dayKey(new Date(+e - 1));
  return { first, last: last < first ? first : last };
}

export function eventOverlapsDay(ev: TimeSpan, key: string): boolean {
  const s = +new Date(ev.start);
  const e = +new Date(ev.end);
  const ds = +dayStart(key);
  const de = +dayStart(addDays(key, 1));
  if (e <= s) return s >= ds && s < de;
  return s < de && e > ds;
}

export function formatSync(lastUpdated: string | null, now: Date | null): string {
  if (!lastUpdated || !now) return "Sinkronizacija…";
  const mins = Math.floor((+now - +new Date(lastUpdated)) / 60000);
  if (mins < 1) return "Ažurirano upravo sada";
  if (mins === 1) return "Ažurirano prije 1 minutu";
  return `Ažurirano prije ${mins} min`;
}
