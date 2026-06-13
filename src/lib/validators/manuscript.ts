import { z } from "zod";

export const manuscriptKeywordSchema = z
  .string()
  .trim()
  .min(1, "Keyword is required.")
  .max(80, "Each keyword must be 80 characters or fewer.");

export const manuscriptTextSchema = {
  abstract: z
    .string()
    .trim()
    .min(1, "Abstract is required.")
    .max(5000, "Abstract must be 5,000 characters or fewer."),
  coverLetter: z
    .string()
    .trim()
    .max(10000, "Cover letter must be 10,000 characters or fewer.")
    .optional(),
  keywords: z
    .array(manuscriptKeywordSchema)
    .min(1, "Add at least one keyword.")
    .max(12, "Add 12 keywords or fewer."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(500, "Title must be 500 characters or fewer."),
};

export const createDraftShellSchema = z.object({
  articleTypeId: z.string().trim().min(1).optional().or(z.literal("")),
  journalId: z.string().trim().min(1, "Choose a journal."),
});

export const autosaveDraftSchema = z.object({
  abstract: manuscriptTextSchema.abstract,
  articleTypeId: z.string().trim().min(1).optional().or(z.literal("")),
  journalId: z.string().trim().min(1, "Choose a journal."),
  keywords: manuscriptTextSchema.keywords,
  manuscriptId: z.string().trim().min(1, "Choose a manuscript."),
  title: manuscriptTextSchema.title,
});

export function parseKeywordsInput(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}
