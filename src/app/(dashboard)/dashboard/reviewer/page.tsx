import { UserRole } from "@/generated/prisma/enums";
import { DashboardRolePage } from "@/components/layout/dashboard-role-page";

export default function ReviewerDashboardPage() {
  return <DashboardRolePage role={UserRole.REVIEWER} />;
}
