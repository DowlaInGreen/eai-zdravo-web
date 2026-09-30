import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken, readSession } from "@/lib/access-token";
import { calendarUsers, isAllowedEmail, normalizeEmail, viewerForEmail } from "@/lib/config";
import { addDays, dayStart, isValidDayKey } from "@/lib/dates";
import {
  CalendarFetchError,
  OWNER_COLORS,
  UNAVAILABLE_MESSAGE,
  fetchCalendarEvents,
  type RawEvent,
} from "@/lib/google-calendar";
import type { CalendarEvent, EventsResponse, Viewer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, private, max-age=0" };
const MAX_SPAN_DAYS = 92;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

/**
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 * `to` je ekskluzivan. Datumi su lokalni (Europe/Zagreb).
 */
export async function GET(req: NextRequest) {
  const session = await readSession(req);
  if (!session || !isAllowedEmail(session.email)) return json({ error: "unauthorized" }, 401);

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isValidDayKey(from) || !isValidDayKey(to) || to <= from || to > addDays(from, MAX_SPAN_DAYS)) {
    return json({ error: "invalid_range" }, 400);
  }

  const accessToken = await getAccessToken(session);
  if (!accessToken) return json({ error: "reauth" }, 401);

  const users = calendarUsers();
  const viewerEmail = normalizeEmail(session.email);
  const viewer: Viewer = viewerForEmail(viewerEmail) ?? "me";

  // Imena: env > Google profil (vlastiti slot) > neutralna zadana vrijednost.
  const ownName = firstName(session.name);
  const nameFor = (key: Viewer) => {
    const cfg = users.find((u) => u.key === key)?.name;
    if (cfg) return cfg;
    if (key === viewer) return ownName ?? (key === "me" ? "On" : "Ona");
    return key === "me" ? "On" : "Ona";
  };
  const names: Record<Viewer, string> = { me: nameFor("me"), wife: nameFor("wife") };

  // Koji kalendari se čitaju: vlastiti (primary) i kalendar druge osobe
  // (dostupan samo ako ga je ta osoba podijelila — id je njezin email).
  const targets = (users.length ? users : [{ key: viewer, email: viewerEmail, calendarId: "primary", name: null }]).map(
    (u) => ({
      owner: u.key,
      calendarId: u.calendarId === "primary" && u.email !== viewerEmail ? u.email : u.calendarId,
    }),
  );

  const timeMin = dayStart(from);
  const timeMax = dayStart(to);

  const results = await Promise.allSettled(
    targets.map((t) =>
      fetchCalendarEvents({
        accessToken,
        calendarId: t.calendarId,
        timeMin,
        timeMax,
        owner: t.owner,
        ownerName: names[t.owner],
      }),
    ),
  );

  const warnings: string[] = [];
  const raw: RawEvent[] = [];
  let authFailures = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      raw.push(...r.value);
      return;
    }
    const status = r.reason instanceof CalendarFetchError ? r.reason.status : 0;
    if (status === 401) authFailures++;
    // Bez tokena/tijela: samo kalendar i HTTP status.
    console.error(`[stipani] kalendar ${targets[i].owner} nedostupan (status ${status || "network"})`);
    if (!warnings.includes(UNAVAILABLE_MESSAGE)) warnings.push(UNAVAILABLE_MESSAGE);
  });

  if (raw.length === 0 && results.every((r) => r.status === "rejected")) {
    return json({ error: authFailures ? "reauth" : "calendar_unavailable" }, authFailures ? 401 : 502);
  }

  // Objedini isti događaj iz oba kalendara ili s oba pozvana → "zajednički".
  const bothEmails = users.map((u) => u.email);
  const merged = new Map<string, RawEvent>();
  for (const ev of raw) {
    const key = `${ev.iCalUID}|${ev.start}`;
    const existing = merged.get(key);
    if (existing) {
      if (existing.owner !== ev.owner) existing.owner = "both";
    } else {
      merged.set(key, { ...ev });
    }
  }
  const events: CalendarEvent[] = [...merged.values()].map(({ attendeeEmails, ...ev }) => {
    const shared =
      ev.owner === "both" || (bothEmails.length === 2 && bothEmails.every((e) => attendeeEmails.includes(e)));
    const owner = shared ? "both" : ev.owner;
    delete (ev as { iCalUID?: string }).iCalUID;
    return {
      ...ev,
      owner,
      ownerName: owner === "both" ? "Zajedno" : ev.ownerName,
      color: OWNER_COLORS[owner],
    };
  });

  events.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "hr"),
  );

  const body: EventsResponse = { events, lastUpdated: new Date().toISOString(), warnings, viewer };
  return json(body);
}
