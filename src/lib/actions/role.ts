"use server";

import { z } from "zod";

import { UserRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { AUDIT_ACTIONS, tryWriteAuditLog } from "@/lib/audit";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const switchRoleSchema = z.object({
  role: z.enum(UserRole),
});

export async function switchDashboardRoleAction(
  input: z.infer<typeof switchRoleSchema>,
): Promise<ActionResult<{ role: UserRole }>> {
  const parsed = switchRoleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Choose a valid role." };
  }

  const user = await requireCurrentUser();

  if (!user.roles.includes(parsed.data.role)) {
    await tryWriteAuditLog({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actorType: "USER",
      actorUserId: user.id,
      entityType: "UserRole",
      entityId: parsed.data.role,
      outcome: "DENIED",
    });
    return { success: false, error: "You do not have that role." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveRole: parsed.data.role },
  });

  await tryWriteAuditLog({
    action: AUDIT_ACTIONS.ROLE_CONTEXT_CHANGED,
    actorType: "USER",
    actorUserId: user.id,
    entityType: "User",
    entityId: user.id,
    metadata: {
      lastActiveRole: parsed.data.role,
    },
  });

  return {
    success: true,
    data: {
      role: parsed.data.role,
    },
  };
}
