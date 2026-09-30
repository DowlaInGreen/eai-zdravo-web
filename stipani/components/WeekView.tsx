"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dayKey, eventOverlapsDay, formatDayLong, formatSync, weekStartKey } from "@/lib/dates";
import { useCalendarEvents, useNow } from "@/lib/use-calendar";
import type { CalendarEvent } from "@/lib/types";
import { EventCard } from "./EventCard";
import { EventModal } from "./EventModal";
import { WeekSkeleton } from "./Skeletons";
import { ErrorState, RefreshButton, Toast, WarningBanner } from "./ui";

type Filter = "all" | "mine" | "theirs" | "both";

export function WeekView() {
  const now = useNow();
  const [weekStart, setWeekStart] = useState(() => weekStartKey(dayKey(new Date())));
  const cal = useCalendarEvents(weekStart, addDays(weekStart, 7), { autoRefresh: true });
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const todayKey = now ? dayKey(now) : null;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const filtered = useMemo(
    () =>
      cal.events.filter((e) => {
        switch (filter) {
          case "mine":
            return e.owner === cal.viewer || e.owner === "both";
          case "theirs":
            return e.owner !== cal.viewer;
          case "both":
            return e.owner === "both";
          default:
            return true;
        }
      }),
    [cal.events, cal.viewer, filter],
  );

  const theirsLabel = cal.viewer === "me" ? "Njeni" : "Njegovi";
  const filters: [Filter, string][] = [
    ["all", "Svi"],
    ["mine", "Moji"],
    ["theirs", theirsLabel],
    ["both", "Zajednički"],
  ];

  const onRefresh = async () => {
    if (await cal.refresh()) setToast("Kalendar osvježen.");
  };

  const isCurrentWeek = todayKey ? weekStartKey(todayKey) === weekStart : true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Prethodni tjedan"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-full border border-line bg-white p-2 hover:bg-sand"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <h1 className="font-display text-xl font-bold sm:text-2xl">
            {formatDayLong(weekStart).split(",")[1]?.trim()} – {formatDayLong(addDays(weekStart, 6)).split(",")[1]?.trim()}
          </h1>
          <button
            type="button"
            aria-label="Sljedeći tjedan"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-full border border-line bg-white p-2 hover:bg-sand"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
          {!isCurrentWeek && todayKey && (
            <button
              type="button"
              onClick={() => setWeekStart(weekStartKey(todayKey))}
              className="rounded-full bg-sand px-3 py-1.5 text-sm font-medium text-terracotta-dark"
            >
              Ovaj tjedan
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted" aria-live="polite">
            {formatSync(cal.lastUpdated, now)}
          </span>
          <RefreshButton onClick={onRefresh} busy={cal.refreshing} />
        </div>
      </div>

      <div role="group" aria-label="Filter događaja" className="flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filter === key
                ? "border-terracotta bg-terracotta text-white"
                : "border-line bg-white text-ink hover:bg-sand"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <WarningBanner messages={cal.warnings} onRetry={onRefresh} busy={cal.refreshing} />

      {cal.status === "error" ? (
        <ErrorState message={cal.error ?? "Nije moguće učitati kalendar."} onRetry={cal.retry} />
      ) : cal.status === "loading" || !now ? (
        <WeekSkeleton />
      ) : (
        <div className="space-y-6">
          {days.map((d) => {
            const list = filtered.filter((e) => eventOverlapsDay(e, d));
            const isToday = d === todayKey;
            return (
              <section
                key={d}
                aria-labelledby={`day-${d}`}
                className={`rounded-3xl p-4 sm:p-5 ${
                  isToday ? "bg-[#f6e4d8] ring-2 ring-terracotta/50" : "border border-line bg-paper"
                }`}
              >
                <h2 id={`day-${d}`} className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  {formatDayLong(d)}
                  {isToday && (
                    <span className="rounded-full bg-terracotta px-2.5 py-0.5 font-sans text-xs font-semibold text-white">
                      Danas
                    </span>
                  )}
                </h2>
                {list.length === 0 ? (
                  <p className="text-sm text-muted">Nema događaja.</p>
                ) : (
                  <ul className="space-y-3">
                    {list.map((e) => (
                      <li key={`${e.id}-${e.start}-${d}`}>
                        <EventCard event={e} todayKey={d} onOpen={setSelected} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
