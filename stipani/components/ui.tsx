"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Coffee, RefreshCw } from "lucide-react";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 2500);
    return () => clearTimeout(id);
  }, [message, onDone]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {message && (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
          <CheckCircle2 aria-hidden className="size-4 text-emerald-300" />
          {message}
        </div>
      )}
    </div>
  );
}

export function WarningBanner({ messages, onRetry, busy }: { messages: string[]; onRetry: () => void; busy: boolean }) {
  if (!messages.length) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle aria-hidden className="size-5 shrink-0" />
      <p className="flex-1">{messages.join(" ")}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="rounded-full border border-amber-300 bg-white px-3 py-1 font-medium hover:bg-amber-100 disabled:opacity-60"
      >
        Osvježi
      </button>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
      <AlertTriangle aria-hidden className="mx-auto size-8 text-terracotta" />
      <p className="mt-3 font-semibold">{message}</p>
      <p className="text-muted">Pokušaj ponovno.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 font-semibold text-white hover:bg-terracotta-dark"
      >
        <RefreshCw aria-hidden className="size-4" />
        Pokušaj ponovno
      </button>
    </div>
  );
}

export function EmptyToday({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center">
      <Coffee aria-hidden className="mx-auto size-8 text-terracotta" />
      <p className="mt-3 font-semibold">Danas nema planiranih događaja.</p>
      <p className="text-muted">Možda je dobar trenutak za kavu zajedno.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-sand"
      >
        Pokušaj ponovno
      </button>
    </div>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium transition hover:bg-sand disabled:opacity-70"
    >
      <RefreshCw aria-hidden className={`size-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Osvježavam…" : "Osvježi"}
    </button>
  );
}
