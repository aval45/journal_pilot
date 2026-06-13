import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireCurrentUser } from "@/lib/auth";
import { resolveDefaultDashboardRole } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();
  const activeRole = resolveDefaultDashboardRole(user);

  return (
    <DashboardShell user={user} activeRole={activeRole}>
      {children}
    </DashboardShell>
  );
}
