import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Avatar } from "./Avatar";
import { NavTabs } from "./NavTabs";

export function AppHeader({ name, image }: { name: string; image?: string | null }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-none text-terracotta">Stipani</p>
          <p className="mt-1 truncate text-xs text-muted">Zajedno u istom smjeru</p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={name} src={image} />
            <span className="max-w-[7rem] truncate text-sm font-medium sm:max-w-[14rem]">{name}</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-sand"
            >
              <LogOut aria-hidden className="size-4" />
              Odjava
            </button>
          </form>
        </div>
      </div>
      <NavTabs />
    </header>
  );
}
