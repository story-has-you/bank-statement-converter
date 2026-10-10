"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ArrowRightIcon, CircleAlertIcon, FileTextIcon, LoaderCircleIcon, UploadIcon, XIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isParseResponse } from "@/lib/conversion-types";
import { clearConversionPayload, saveConversionPayload } from "@/lib/conversion-storage";
import { usageQuotaConfig } from "@/lib/usage/config";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function PdfUpload() {
  const t = useTranslations("PdfUpload");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<
    | "invalidPdf"
    | "multipleFiles"
    | "conversionFailed"
    | "parserUnavailable"
    | "quotaExceeded"
    | "quotaUnavailable"
    | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    clearConversionPayload();
  }, []);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return t("fileSize.bytes", { size: format.number(bytes) });
    if (bytes < 1024 * 1024) {
      return t("fileSize.kilobytes", { size: format.number(Math.round(bytes / 1024)) });
    }
    return t("fileSize.megabytes", {
      size: format.number(bytes / (1024 * 1024), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    });
  }

  function selectFile(candidate: File | undefined) {
    if (!candidate) return;

    if (
      !candidate.name.toLowerCase().endsWith(".pdf") ||
      (candidate.type && candidate.type !== "application/pdf")
    ) {
      setFile(null);
      setError("invalidPdf");
      setServerError(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (candidate.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("invalidPdf");
      setServerError(t("fileTooLarge"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(candidate);
    setError(null);
    setServerError(null);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 1) {
      setFile(null);
      setError("multipleFiles");
      setServerError(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    selectFile(event.dataTransfer.files[0]);
  }

  function removeFile() {
    setFile(null);
    setError(null);
    setServerError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function startConversion() {
    if (!file || isPending) return;

    setError(null);
    setServerError(null);
    setIsPending(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
        headers: { "x-app-locale": locale },
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isParseResponse(payload)) {
        const code =
          typeof payload === "object" && payload !== null && "code" in payload && typeof payload.code === "string"
            ? payload.code
            : null;
        if (code === "PARSER_UNAVAILABLE") {
          setError("parserUnavailable");
        } else if (code === "QUOTA_EXCEEDED") {
          setError("quotaExceeded");
        } else if (code === "QUOTA_UNAVAILABLE") {
          setError("quotaUnavailable");
        } else {
          setError("conversionFailed");
        }
        if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string") {
          setServerError(payload.message);
        }
        return;
      }

      try {
        saveConversionPayload(file.name, payload);
    } catch {
        setError("conversionFailed");
        setServerError(null);
        return;
      }

      router.push("/result");
    } catch {
      setError("parserUnavailable");
      setServerError(null);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section
      id="workspace"
      className="rounded-md border border-border bg-card p-4 shadow-xs sm:p-5"
      aria-labelledby="workspace-title"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="workspace-title" className="text-base font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Badge variant="secondary">{isPending ? t("converting") : t("status")}</Badge>
      </div>

      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="statement-pdf" className="sr-only">{t("fileLabel")}</FieldLabel>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby="pdf-help"
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
            data-dragging={isDragging}
            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 sm:min-h-36"
          >
            <span className="flex size-11 items-center justify-center rounded-md border border-border bg-background text-primary">
              <UploadIcon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">{t("dropzone")}</span>
            <span className="text-xs font-normal text-muted-foreground">{t("dropzoneHint")}</span>
          </button>
          <Input
            ref={inputRef}
            id="statement-pdf"
            type="file"
            accept=".pdf,application/pdf"
            aria-invalid={Boolean(error)}
            aria-describedby="pdf-help"
            className="hidden"
            onChange={handleInputChange}
          />
          <FieldDescription id="pdf-help">{t("help")}</FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{serverError ?? t(error)}</AlertDescription>
        </Alert>
      )}

      {file && (
        <div
          className="mt-4 flex min-w-0 items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5"
          aria-live="polite"
        >
          <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeFile}
            aria-label={t("removeFile")}
            title={t("removeFile")}
          >
            <XIcon data-icon="inline-start" />
          </Button>
        </div>
      )}

      <Separator className="my-5" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {t("quota", {
              anonymousPages: usageQuotaConfig.anonymous.pages,
              authenticatedPages: usageQuotaConfig.authenticated.pages,
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t("serviceReady")}</p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={!file || isPending}
          onClick={startConversion}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <ArrowRightIcon data-icon="inline-start" />
          )}
          {isPending ? t("converting") : t("start")}
        </Button>
      </div>
    </section>
  );
}
