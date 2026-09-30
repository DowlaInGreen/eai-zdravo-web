import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { auth, signIn } from "@/auth";
import { FamilyPhoto } from "@/components/FamilyPhoto";

export const metadata = { title: "Prijava" };

const MESSAGES: Record<string, string> = {
  AccessDenied: "Ovaj Google račun nema pristup Stipani aplikaciji.",
  SessionExpired: "Sesija je istekla. Prijavi se ponovno.",
};

async function loginAction() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user && !error) redirect("/dashboard");

  const message = error ? (MESSAGES[error] ?? "Google autorizacija nije uspjela.") : null;
  const denied = error === "AccessDenied";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <FamilyPhoto hideWhenMissing caption={false} className="mb-6 h-40 sm:h-48" />

      <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-4xl font-bold text-terracotta">Stipani</h1>
        <p className="mt-1 text-lg text-ink">Zajedno u istom smjeru.</p>
        <p className="mt-4 text-muted">
          Naš privatni kutak za pregled dana, obaveza i nadolazećih događaja. Dobro došli kući.
        </p>

        {message && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        <form action={loginAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-full bg-terracotta px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
          >
            {denied ? "Pokušaj s drugim Google računom" : "Prijavi se Google računom"}
          </button>
        </form>
      </div>
    </main>
  );
}
