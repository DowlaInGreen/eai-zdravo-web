"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import type { CalendarEvent, EventsResponse, Viewer } from "./types";

export type Status = "loading" | "ready" | "error";

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export function useCalendarEvents(from: string, to: string, opts: { autoRefresh?: boolean } = {}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer>("me");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (mode: "initial" | "manual" | "background"): Promise<boolean> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (mode === "manual") setRefreshing(true);
      if (mode === "initial") setStatus("loading");

      try {
        const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          await signOut({ redirectTo: "/login?error=SessionExpired" });
          return false;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as EventsResponse;
        setEvents(data.events);
        setWarnings(data.warnings);
        setLastUpdated(data.lastUpdated);
        setViewer(data.viewer);
        setStatus("ready");
        setError(null);
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return false;
        setError("Nije moguće učitati kalendar.");
        // Zadrži stare podatke ako ih imamo; puni error state samo bez njih.
        setStatus((s) => (s === "ready" ? "ready" : "error"));
        return false;
      } finally {
        if (mode === "manual" && abortRef.current === ctrl) setRefreshing(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    void load("initial");
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!opts.autoRefresh) return;
    const id = setInterval(() => {
      if (!document.hidden) void load("background");
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [opts.autoRefresh, load]);

  const refresh = useCallback(() => load("manual"), [load]);
  const retry = useCallback(() => load("initial"), [load]);

  return { events, warnings, lastUpdated, viewer, status, error, refreshing, refresh, retry };
}

/** Tekući trenutak; null do mounta (izbjegava hydration mismatch). */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
