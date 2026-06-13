import { describe, expect, test } from "vitest";

import {
  activeArticleTypeWhere,
  activeEmailTemplateWhere,
  activeJournalWhere,
  activeManuscriptWhere,
  withActiveRecord,
  withAvailableFile,
} from "@/lib/data/active-records";

describe("active record query helpers", () => {
  test("adds deletedAt null to normal queries", () => {
    expect(withActiveRecord({ id: "record-1" })).toEqual({
      id: "record-1",
      deletedAt: null,
    });
  });

  test("overrides accidental deletedAt filters for normal active queries", () => {
    expect(withActiveRecord({ deletedAt: { not: null } })).toEqual({
      deletedAt: null,
    });
  });

  test("adds file availability constraints", () => {
    expect(withAvailableFile({ manuscriptId: "manuscript-1" })).toEqual({
      manuscriptId: "manuscript-1",
      deletedAt: null,
      storagePurgedAt: null,
    });
  });

  test("domain helpers all exclude soft-deleted rows", () => {
    expect(activeManuscriptWhere()).toEqual({ deletedAt: null });
    expect(activeJournalWhere()).toEqual({ deletedAt: null });
    expect(activeArticleTypeWhere()).toEqual({ deletedAt: null });
    expect(activeEmailTemplateWhere()).toEqual({ deletedAt: null });
  });
});
