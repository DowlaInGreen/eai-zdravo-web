// Server-only: pozivi Google Calendar API-ja i normalizacija događaja.
import { TZ, dayStart } from "./dates";
import type { CalendarEvent, Owner } from "./types";

export const OWNER_COLORS: Record<Owner, string> = {
  me: "#3d5a80", // zagasito plava
  wife: "#b5573a", // terakota
  both: "#66752f", // maslinasta
};

export const UNAVAILABLE_MESSAGE = "Jedan kalendar trenutno nije dostupan.";

export class CalendarFetchError extends Error {
  constructor(public status: number) {
    super(`Calendar API ${status}`);
  }
}

interface GEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  iCalUID?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { email?: string; responseStatus?: string; self?: boolean }[];
}

interface GEventsPage {
  summary?: string;
  nextPageToken?: string;
  items?: GEvent[];
}

const FIELDS =
  "summary,nextPageToken,items(id,status,summary,description,location,htmlLink,iCalUID,start,end,attendees(email,responseStatus,self))";

/** Calendar opisi mogu sadržavati HTML — pretvaramo u čisti tekst (React ga svejedno escapea). */
export function htmlToText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface RawEvent extends CalendarEvent {
  iCalUID: string;
  attendeeEmails: string[];
}

export async function fetchCalendarEvents(opts: {
  accessToken: string;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  owner: Owner;
  ownerName: string;
}): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  let pageToken: string | undefined;
  let calendarName = opts.calendarId;

  for (let page = 0; page < 4; page++) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opts.calendarId)}/events`,
    );
    url.searchParams.set("timeMin", opts.timeMin.toISOString());
    url.searchParams.set("timeMax", opts.timeMax.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("timeZone", TZ);
    url.searchParams.set("fields", FIELDS);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new CalendarFetchError(res.status);

    const data = (await res.json()) as GEventsPage;
    if (data.summary) calendarName = data.summary;
    for (const item of data.items ?? []) {
      const ev = normalize(item, opts, calendarName);
      if (ev) out.push(ev);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out.map((e) => ({ ...e, calendarName }));
}

function normalize(
  g: GEvent,
  opts: { owner: Owner; ownerName: string },
  calendarName: string,
): RawEvent | null {
  if (!g.id || g.status === "cancelled" || !g.start || !g.end) return null;
  if (g.attendees?.some((a) => a.self && a.responseStatus === "declined")) return null;

  let start: string;
  let end: string;
  let allDay = false;
  if (g.start.date && g.end.date) {
    allDay = true;
    start = dayStart(g.start.date).toISOString();
    end = dayStart(g.end.date).toISOString(); // Google: end.date je ekskluzivan
  } else if (g.start.dateTime && g.end.dateTime) {
    start = new Date(g.start.dateTime).toISOString();
    end = new Date(g.end.dateTime).toISOString();
  } else {
    return null;
  }

  return {
    id: g.id,
    iCalUID: g.iCalUID ?? g.id,
    title: g.summary?.trim() || "(Bez naslova)",
    description: g.description ? htmlToText(g.description) || null : null,
    start,
    end,
    allDay,
    owner: opts.owner,
    ownerName: opts.ownerName,
    calendarName,
    location: g.location?.trim() || null,
    htmlLink: g.htmlLink ?? null,
    color: OWNER_COLORS[opts.owner],
    attendeeEmails: (g.attendees ?? []).map((a) => (a.email ?? "").trim().toLowerCase()).filter(Boolean),
  };
}
