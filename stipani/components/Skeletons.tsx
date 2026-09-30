const pulse = "animate-pulse rounded-2xl bg-sand/70";

export function EventCardSkeleton() {
  return (
    <div aria-hidden className="flex gap-3 rounded-2xl border border-line bg-white p-4">
      <div className="w-1.5 rounded-full bg-sand" />
      <div className="flex-1 space-y-2">
        <div className={`${pulse} h-3 w-24`} />
        <div className={`${pulse} h-4 w-3/4`} />
        <div className={`${pulse} h-5 w-20`} />
      </div>
    </div>
  );
}

export function EventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Učitavanje događaja" className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${pulse} h-24`} />
      ))}
    </div>
  );
}

export function WeekSkeleton() {
  return (
    <div role="status" aria-label="Učitavanje tjedna" className="space-y-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className={`${pulse} h-5 w-40`} />
          <EventCardSkeleton />
        </div>
      ))}
    </div>
  );
}
