import { UserRole } from "@/generated/prisma/enums";
import { DashboardRolePage } from "@/components/layout/dashboard-role-page";

export default function AuthorDashboardPage() {
  return <DashboardRolePage role={UserRole.AUTHOR} />;
}
