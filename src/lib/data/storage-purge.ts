import "server-only";

import { prisma } from "@/lib/prisma";

export type StoragePurgeCandidate = {
  id: string;
  filePath: string;
  storageBucket: string;
};

export async function listStoragePurgeCandidates({
  olderThan,
  take = 100,
}: {
  olderThan: Date;
  take?: number;
}): Promise<StoragePurgeCandidate[]> {
  return prisma.manuscriptFile.findMany({
    where: {
      deletedAt: {
        lte: olderThan,
      },
      storagePurgedAt: null,
    },
    orderBy: {
      deletedAt: "asc",
    },
    select: {
      id: true,
      filePath: true,
      storageBucket: true,
    },
    take,
  });
}
