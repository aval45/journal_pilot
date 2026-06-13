import { UserRole } from "@/generated/prisma/enums";
import { DashboardRolePage } from "@/components/layout/dashboard-role-page";

export default function AdminDashboardPage() {
  return <DashboardRolePage role={UserRole.ADMIN} />;
}
