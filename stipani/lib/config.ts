// Server-only konfiguracija (env). Ne importirati iz client komponenti.
import type { Viewer } from "./types";

export function normalizeEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function allowedEmails(): string[] {
  return [process.env.ALLOWED_EMAIL_1, process.env.ALLOWED_EMAIL_2].map(normalizeEmail).filter(Boolean);
}

/** Fail-closed: ako allowlist nije postavljena, nitko ne ulazi. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return e !== "" && allowedEmails().includes(e);
}

export interface CalendarUser {
  key: Viewer;
  email: string;
  calendarId: string;
  name: string | null;
}

export function calendarUsers(): CalendarUser[] {
  const users: CalendarUser[] = [];
  const defs: [Viewer, string | undefined, string | undefined, string | undefined][] = [
    ["me", process.env.USER_1_EMAIL, process.env.USER_1_CALENDAR_ID, process.env.USER_1_NAME],
    ["wife", process.env.USER_2_EMAIL, process.env.USER_2_CALENDAR_ID, process.env.USER_2_NAME],
  ];
  for (const [key, email, calId, name] of defs) {
    const e = normalizeEmail(email);
    if (!e) continue;
    users.push({ key, email: e, calendarId: (calId ?? "").trim() || "primary", name: name?.trim() || null });
  }
  return users;
}

export function viewerForEmail(email: string | null | undefined): Viewer | null {
  const e = normalizeEmail(email);
  return calendarUsers().find((u) => u.email === e)?.key ?? null;
}
