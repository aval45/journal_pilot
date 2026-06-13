import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("migration integrity checks", () => {
  test("rejects users with an empty roles array at the database layer", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "prisma/migrations/0001_init/migration.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("ADD CONSTRAINT user_roles_not_empty");
    expect(migrationSql).toContain('CHECK (array_length("roles", 1) >= 1)');
  });
});
