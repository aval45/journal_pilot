import { describe, expect, test, vi } from "vitest";

import { generateDisplayId, type DisplayIdDb } from "@/lib/manuscripts/display-id";

describe("generateDisplayId", () => {
  test("uses the returned nextValue minus one as the assigned sequence", async () => {
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ nextValue: 43 }]),
    } satisfies DisplayIdDb;

    await expect(
      generateDisplayId({
        db,
        journalId: "journal-1",
        year: 2026,
      }),
    ).resolves.toBe("JP-2026-00042");
  });

  test("returns unique IDs when the atomic counter returns unique values", async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ nextValue: 2 }])
        .mockResolvedValueOnce([{ nextValue: 3 }])
        .mockResolvedValueOnce([{ nextValue: 4 }]),
    } satisfies DisplayIdDb;

    const ids = await Promise.all([
      generateDisplayId({ db, journalId: "journal-1", year: 2026 }),
      generateDisplayId({ db, journalId: "journal-1", year: 2026 }),
      generateDisplayId({ db, journalId: "journal-1", year: 2026 }),
    ]);

    expect(ids).toEqual(["JP-2026-00001", "JP-2026-00002", "JP-2026-00003"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
