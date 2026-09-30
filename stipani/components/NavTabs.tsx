"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/week", label: "Tjedan", Icon: CalendarDays },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Glavna navigacija" className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-terracotta text-terracotta"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
