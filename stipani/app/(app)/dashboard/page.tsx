import { auth } from "@/auth";
import { DashboardView } from "@/components/DashboardView";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "";
  return <DashboardView firstName={firstName} />;
}
