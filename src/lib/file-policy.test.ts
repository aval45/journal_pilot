import { describe, expect, test } from "vitest";

import {
  isAllowedUploadFile,
  MAX_MANUSCRIPT_FILE_SIZE,
  sanitizeFileName,
} from "@/lib/file-policy";

describe("file upload policy", () => {
  test("accepts allowed manuscript file type and size combinations", () => {
    expect(
      isAllowedUploadFile({
        fileName: "paper.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      }),
    ).toBe(true);
  });

  test("rejects mismatched extensions, executable content, and oversize files", () => {
    expect(
      isAllowedUploadFile({
        fileName: "paper.pdf",
        fileSize: 1024,
        mimeType: "application/x-msdownload",
      }),
    ).toBe(false);
    expect(
      isAllowedUploadFile({
        fileName: "script.exe",
        fileSize: 1024,
        mimeType: "application/x-msdownload",
      }),
    ).toBe(false);
    expect(
      isAllowedUploadFile({
        fileName: "paper.pdf",
        fileSize: MAX_MANUSCRIPT_FILE_SIZE + 1,
        mimeType: "application/pdf",
      }),
    ).toBe(false);
  });

  test("sanitizes file names before storage paths are generated", () => {
    expect(sanitizeFileName("../draft <final>.pdf")).toBe("..-draft final.pdf");
  });
});
