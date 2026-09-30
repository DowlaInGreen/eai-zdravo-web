"use client";

import { useEffect, useRef, useState } from "react";
import { Home } from "lucide-react";

const SRC = "/family-photo.jpg";

/**
 * Obiteljska fotografija iz /public/family-photo.jpg.
 * Ako datoteka ne postoji nema broken imagea: prikazuje se gradijent placeholder
 * (ili se komponenta sakrije — `hideWhenMissing`).
 */
export function FamilyPhoto({
  className = "",
  hideWhenMissing = false,
  placeholderOnDesktopOnly = false,
  caption = true,
}: {
  className?: string;
  hideWhenMissing?: boolean;
  placeholderOnDesktopOnly?: boolean;
  caption?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "ok" : "missing");
  }, []);

  if (state === "missing" && hideWhenMissing) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-sand via-[#e7d3bd] to-[#d9b9a3] shadow-sm ${
        state === "missing" && placeholderOnDesktopOnly ? "hidden lg:block" : ""
      } ${className}`}
    >
      {state === "missing" && (
        <Home aria-hidden className="absolute right-4 top-4 size-8 text-terracotta/40" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={SRC}
        alt="Naša obitelj"
        onLoad={() => setState("ok")}
        onError={() => setState("missing")}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
          state === "ok" ? "opacity-100" : "opacity-0"
        }`}
      />
      {caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-10">
          <p className="font-display text-lg leading-snug text-white drop-shadow">
            Jedan dom. Jedan pregled. Isti smjer.
          </p>
        </div>
      )}
    </div>
  );
}
