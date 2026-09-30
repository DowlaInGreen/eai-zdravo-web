"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, ExternalLink, MapPin, Tag, X } from "lucide-react";
import { eventDays, formatDayLong, formatDayShort, formatTime } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";
import { OwnerBadge } from "./EventCard";

export function EventModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Nativni <dialog>: focus trap, Escape i inert pozadina dolaze iz preglednika.
  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
    return () => dlg?.close();
  }, []);

  const { first, last } = eventDays(event);
  const dateLabel = first === last ? formatDayLong(first) : `${formatDayLong(first)} – ${formatDayLong(last)}`;

  const endLabel = last === first ? formatTime(event.end) : `${formatDayShort(last)} ${formatTime(event.end)}`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="event-title"
      className="m-auto max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-3xl bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40 max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <OwnerBadge event={event} />
            <h2 id="event-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight">
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Zatvori"
            className="shrink-0 rounded-full p-2 text-muted transition hover:bg-sand hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm">
          <Row icon={<CalendarDays aria-hidden className="size-4" />} label="Kada">
            <p className="font-medium">{dateLabel}</p>
            <p className="text-muted">
              {event.allDay ? (
                "Cijeli dan"
              ) : (
                <>
                  Početak {formatTime(event.start)} · Kraj {endLabel}
                </>
              )}
            </p>
          </Row>
          {event.location && (
            <Row icon={<MapPin aria-hidden className="size-4" />} label="Lokacija">
              <p className="break-words">{event.location}</p>
            </Row>
          )}
          <Row icon={<Tag aria-hidden className="size-4" />} label="Kalendar">
            <p className="break-words">{event.calendarName}</p>
          </Row>
          {event.description && (
            <div>
              <p className="mb-1 font-semibold">Opis</p>
              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-muted">{event.description}</p>
            </div>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 font-semibold text-white transition hover:bg-terracotta-dark"
            >
              Otvori u Google Calendaru
              <ExternalLink aria-hidden className="size-4" />
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted" title={label}>
        {icon}
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
