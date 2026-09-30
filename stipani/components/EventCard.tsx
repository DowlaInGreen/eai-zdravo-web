import { Clock, MapPin, Sun } from "lucide-react";
import { formatDayShort, formatEventTime, eventDays } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";

export function OwnerBadge({ event }: { event: CalendarEvent }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${event.color}1f`, color: event.color }}
    >
      <span
        aria-hidden
        className="inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: event.color }}
      >
        {event.ownerName.charAt(0).toUpperCase()}
      </span>
      {event.ownerName}
    </span>
  );
}

export function EventCard({
  event,
  todayKey,
  showDate = false,
  onOpen,
}: {
  event: CalendarEvent;
  todayKey: string | null;
  showDate?: boolean;
  onOpen: (e: CalendarEvent) => void;
}) {
  const first = eventDays(event).first;
  const dateLabel = showDate && todayKey && first !== todayKey ? formatDayShort(first) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="group flex w-full gap-3 rounded-2xl border border-line bg-white p-3.5 text-left shadow-sm transition hover:shadow-md sm:p-4"
    >
      <span aria-hidden className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {dateLabel && <span className="font-semibold capitalize text-ink">{dateLabel}</span>}
          <span className="inline-flex items-center gap-1">
            {event.allDay ? <Sun aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
            {formatEventTime(event)}
          </span>
        </span>
        <span className="mt-1 block break-words font-semibold leading-snug text-ink">{event.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <OwnerBadge event={event} />
          {event.location && (
            <span className="inline-flex min-w-0 items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
