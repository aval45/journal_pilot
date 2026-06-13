"use client";

import { Loader2, Upload } from "lucide-react";
import { useState, useTransition } from "react";

import { FileCategory } from "@/generated/prisma/enums";
import { createManuscriptUploadUrlAction } from "@/lib/actions/manuscript";
import {
  formatFileSize,
  isAllowedUploadFile,
  UPLOAD_FILE_CATEGORIES,
} from "@/lib/file-policy";

type FileUploadCardProps = {
  manuscriptId: string;
};

const CATEGORY_LABELS: Record<FileCategory, string> = {
  COVER_LETTER: "Cover letter",
  DECISION_LETTER: "Decision letter",
  FIGURE: "Figure",
  MANUSCRIPT: "Manuscript",
  REVIEW_ATTACHMENT: "Review attachment",
  SUPPLEMENTARY: "Supplementary",
  TABLE: "Table",
};

export function FileUploadCard({ manuscriptId }: FileUploadCardProps) {
  const [category, setCategory] = useState<FileCategory>(FileCategory.MANUSCRIPT);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function uploadSelectedFile() {
    setMessage(null);

    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

    if (
      !isAllowedUploadFile({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
    ) {
      setMessage("Choose an accepted file type under 50 MB.");
      return;
    }

    startTransition(async () => {
      const signedUpload = await createManuscriptUploadUrlAction({
        fileCategory: category,
        fileName: file.name,
        fileSize: file.size,
        manuscriptId,
        mimeType: file.type,
      });

      if (!signedUpload.success) {
        setMessage(signedUpload.error);
        return;
      }

      const uploadBody = new FormData();
      uploadBody.append("cacheControl", "3600");
      uploadBody.append("", file);

      const uploadResponse = await fetch(signedUpload.data.signedUrl, {
        body: uploadBody,
        headers: {
          "x-upsert": "false",
        },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        setMessage("Upload failed. Please try again.");
        return;
      }

      setFile(null);
      setMessage("File uploaded and metadata saved.");
      window.location.reload();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-card-foreground">
          Files
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Uploads use a server-generated signed URL. The app stores private file
          paths, never public URLs.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr_auto]">
        <label className="block text-sm font-semibold text-card-foreground">
          Category
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            onChange={(event) => setCategory(event.target.value as FileCategory)}
            value={category}
          >
            {UPLOAD_FILE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-card-foreground">
          File
          <input
            className="mt-2 block h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-secondary-foreground"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            PDF, Word, TeX, ZIP, JPG, PNG, or TIFF. Maximum 50 MB.
          </span>
        </label>

        <button
          className="inline-flex h-10 cursor-pointer items-center justify-center self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={uploadSelectedFile}
          type="button"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          Upload
        </button>
      </div>

      {file ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Selected: {file.name} · {formatFileSize(file.size)}
        </p>
      ) : null}
    </section>
  );
}
