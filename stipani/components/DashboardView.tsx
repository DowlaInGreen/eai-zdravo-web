"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { addDays, dayKey, eventDays, eventOverlapsDay, formatDayLong, formatDayShort, formatEventTime, formatSync, greetingFor, weekStartKey } from "@/lib/dates";
import { useCalendarEvents, useNow } from "@/lib/use-calendar";
import type { CalendarEvent } from "@/lib/types";
import { EventCard } from "./EventCard";
import { EventModal } from "./EventModal";
import { FamilyPhoto } from "./FamilyPhoto";
import { EventListSkeleton, StatsSkeleton } from "./Skeletons";
import { EmptyToday, ErrorState, RefreshButton, Toast, WarningBanner } from "./ui";

export function DashboardView({ firstName }: { firstName: string }) {
  const now = useNow();
  // Raspon se fiksira pri mountu: od ponedjeljka tekućeg tjedna + 45 dana.
  const [range] = useState(() => {
    const today = dayKey(new Date());
    const from = weekStartKey(today);
    return { from, to: addDays(from, 52) };
  });
  const cal = useCalendarEvents(range.from, range.to, { autoRefresh: true });
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const todayKey = now ? dayKey(now) : null;

  const { today, next, weekCount } = useMemo(() => {
    if (!now || !todayKey) return { today: [], next: [], weekCount: 0 };
    const ws = weekStartKey(todayKey);
    const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return {
      today: cal.events.filter((e) => eventOverlapsDay(e, todayKey)),
      next: cal.events.filter((e) => +new Date(e.start) > +now).slice(0, 6),
      weekCount: cal.events.filter((e) => week.some((d) => eventOverlapsDay(e, d))).length,
    };
  }, [cal.events, now, todayKey]);

  const onRefresh = async () => {
    if (await cal.refresh()) setToast("Kalendar osvježen.");
  };

  const loading = cal.status === "loading" || !now;
  const nextEvent = next[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <aside className="order-first lg:order-last">
        <FamilyPhoto
          placeholderOnDesktopOnly
          className="h-44 sm:h-52 lg:sticky lg:top-6 lg:h-[26rem]"
        />
      </aside>

      <div className="min-w-0 space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
              {now ? `${greetingFor(now)}, ${firstName}` : " "}
            </h1>
            <p className="mt-1 text-muted">{todayKey ? formatDayLong(todayKey) : " "}</p>
            <p className="text-sm text-muted">Naš zajednički pregled dana.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted" aria-live="polite">
              {formatSync(cal.lastUpdated, now)}
            </span>
            <RefreshButton onClick={onRefresh} busy={cal.refreshing} />
          </div>
        </section>

        <WarningBanner messages={cal.warnings} onRetry={onRefresh} busy={cal.refreshing} />

        {cal.status === "error" ? (
          <ErrorState message={cal.error ?? "Nije moguće učitati kalendar."} onRetry={cal.retry} />
        ) : (
          <>
            {loading ? (
              <StatsSkeleton />
            ) : (
              <section aria-label="Brze statistike" className="grid grid-cols-3 gap-3">
                <Stat label="Danas" value={String(today.length)} />
                <Stat label="Ovaj tjedan" value={String(weekCount)} />
                <Stat
                  label="Sljedeće"
                  value={nextEvent ? nextEvent.title : "—"}
                  hint={nextEvent ? nextHint(nextEvent, todayKey) : undefined}
                  small
                />
              </section>
            )}

            <section aria-labelledby="h-today">
              <h2 id="h-today" className="mb-3 font-display text-2xl font-bold">
                Danas
              </h2>
              {loading ? (
                <EventListSkeleton />
              ) : today.length === 0 ? (
                <EmptyToday onRetry={onRefresh} />
              ) : (
                <ul className="space-y-3">
                  {today.map((e) => (
                    <li key={`${e.id}-${e.start}`}>
                      <EventCard event={e} todayKey={todayKey} onOpen={setSelected} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="h-next">
              <h2 id="h-next" className="mb-3 font-display text-2xl font-bold">
                Sljedeće
              </h2>
              {loading ? (
                <EventListSkeleton />
              ) : next.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line p-5 text-muted">
                  Nema nadolazećih događaja.
                </p>
              ) : (
                <ul className="space-y-3">
                  {next.map((e) => (
                    <li key={`${e.id}-${e.start}`}>
                      <EventCard event={e} todayKey={todayKey} showDate onOpen={setSelected} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link
              href="/week"
              className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-2.5 font-semibold text-terracotta-dark transition hover:bg-[#e6d9c2]"
            >
              Tjedni pregled
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </>
        )}
      </div>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function Stat({ label, value, hint, small }: { label: string; value: string; hint?: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-3.5 shadow-sm sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display font-bold leading-tight ${small ? "line-clamp-2 text-base sm:text-lg" : "text-3xl"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

function nextHint(e: CalendarEvent, todayKey: string | null): string {
  const first = eventDays(e).first;
  const time = e.allDay ? "Cijeli dan" : formatEventTime(e).split(" – ")[0];
  return first === todayKey ? time : `${formatDayShort(first)}, ${time}`;
}
