import { FileCategory } from "@/generated/prisma/enums";

export const MAX_MANUSCRIPT_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  { extensions: [".pdf"], mimeTypes: ["application/pdf"] },
  {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  { extensions: [".doc"], mimeTypes: ["application/msword"] },
  {
    extensions: [".tex"],
    mimeTypes: ["application/x-tex", "text/plain"],
  },
  {
    extensions: [".zip"],
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
  },
  { extensions: [".jpg", ".jpeg"], mimeTypes: ["image/jpeg"] },
  { extensions: [".png"], mimeTypes: ["image/png"] },
  { extensions: [".tif", ".tiff"], mimeTypes: ["image/tiff"] },
] as const;

export const UPLOAD_FILE_CATEGORIES = [
  FileCategory.MANUSCRIPT,
  FileCategory.FIGURE,
  FileCategory.TABLE,
  FileCategory.SUPPLEMENTARY,
  FileCategory.COVER_LETTER,
] as const;

export type UploadFileCategory = (typeof UPLOAD_FILE_CATEGORIES)[number];

export function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

export function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .trim()
    .replaceAll(/[/\\]/g, "-")
    .replaceAll(/[^a-zA-Z0-9._ -]/g, "")
    .replaceAll(/\s+/g, " ")
    .slice(0, 180);

  return sanitized || "manuscript-file";
}

export function isAllowedUploadFile({
  fileName,
  fileSize,
  mimeType,
}: {
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  const extension = getFileExtension(fileName);

  if (fileSize <= 0 || fileSize > MAX_MANUSCRIPT_FILE_SIZE) {
    return false;
  }

  return ALLOWED_FILE_TYPES.some(
    (type) =>
      type.extensions.includes(extension as never) &&
      type.mimeTypes.includes(mimeType as never),
  );
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
