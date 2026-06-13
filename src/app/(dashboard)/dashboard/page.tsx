import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { resolveDefaultDashboardRole, roleDashboardPath } from "@/lib/roles";

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  redirect(roleDashboardPath(resolveDefaultDashboardRole(user)));
}
