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

export const coAuthorSchema = z.object({
  affiliation: z
    .string()
    .trim()
    .max(300, "Affiliation must be 300 characters or fewer.")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(320, "Email must be 320 characters or fewer.")
    .transform((value) => value.toLowerCase()),
  manuscriptId: z.string().trim().min(1, "Choose a manuscript."),
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(200, "Name must be 200 characters or fewer."),
});

export const removeCoAuthorSchema = z.object({
  authorId: z.string().trim().min(1, "Choose a co-author."),
  manuscriptId: z.string().trim().min(1, "Choose a manuscript."),
});

export const reorderCoAuthorsSchema = z.object({
  authorIds: z.array(z.string().trim().min(1)).min(1),
  manuscriptId: z.string().trim().min(1, "Choose a manuscript."),
});

export function parseKeywordsInput(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}
