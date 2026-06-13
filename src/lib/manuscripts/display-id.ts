import "server-only";

import { randomUUID } from "node:crypto";

export type DisplayIdDb = {
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>;
};

type CounterRow = {
  nextValue: number;
};

export async function generateDisplayId({
  db,
  journalId,
  prefix = "JP",
  year = new Date().getUTCFullYear(),
}: {
  db: DisplayIdDb;
  journalId: string;
  prefix?: string;
  year?: number;
}) {
  const rows = await db.$queryRaw<CounterRow[]>`
    INSERT INTO "app"."ManuscriptCounter"
      ("id", "journalId", "year", "nextValue", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${journalId}, ${year}, 2, NOW(), NOW())
    ON CONFLICT ("journalId", "year")
    DO UPDATE SET
      "nextValue" = "app"."ManuscriptCounter"."nextValue" + 1,
      "updatedAt" = NOW()
    RETURNING "nextValue"
  `;
  const nextValue = rows[0]?.nextValue;

  if (!nextValue) {
    throw new Error("Could not generate manuscript display ID.");
  }

  const assignedSequence = nextValue - 1;

  return `${prefix}-${year}-${String(assignedSequence).padStart(5, "0")}`;
}
