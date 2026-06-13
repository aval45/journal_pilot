import "server-only";

import { prisma } from "@/lib/prisma";

export type SubmissionWizardOptions = Awaited<
  ReturnType<typeof getSubmissionWizardOptions>
>;

export async function getSubmissionWizardOptions() {
  return prisma.journal.findMany({
    where: {
      deletedAt: null,
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      articleTypes: {
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });
}
