"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { CircleAlertIcon, Clock3Icon, FileTextIcon, UploadIcon, XIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + " B";
  }
  if (bytes < 1024 * 1024) {
    return Math.round(bytes / 1024) + " KB";
  }
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function PdfUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(candidate: File | undefined) {
    if (!candidate) return;

    if (
      !candidate.name.toLowerCase().endsWith(".pdf") ||
      (candidate.type && candidate.type !== "application/pdf")
    ) {
      setFile(null);
      setError("请选择 PDF 文件。");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(candidate);
    setError(null);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 1) {
      setFile(null);
      setError("请一次选择一个 PDF 文件。");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    selectFile(event.dataTransfer.files[0]);
  }

  function removeFile() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section
      id="workspace"
      className="rounded-md border border-border bg-card p-4 shadow-xs sm:p-5"
      aria-labelledby="workspace-title"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="workspace-title" className="text-base font-semibold">新建转换</h2>
          <p className="text-sm text-muted-foreground">一次处理一份 PDF 文件</p>
        </div>
        <Badge variant="secondary">服务准备中</Badge>
      </div>

      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="statement-pdf" className="sr-only">银行流水 PDF 文件</FieldLabel>
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
            <span className="text-sm font-medium">点击选择或拖放 PDF 文件</span>
            <span className="text-xs font-normal text-muted-foreground">仅选择文件，不会上传</span>
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
          <FieldDescription id="pdf-help">选择后可查看文件名并随时移除。</FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>文件无法使用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
            aria-label="移除文件"
            title="移除文件"
          >
            <XIcon data-icon="inline-start" />
          </Button>
        </div>
      )}

      <Separator className="my-5" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">匿名每天 1 页，登录每天 5 页</p>
          <p className="text-xs text-muted-foreground">订阅会员可转换更多文件。转换服务尚未开放。</p>
        </div>
        <Button type="button" size="lg" disabled className="w-full sm:w-auto">
          <Clock3Icon data-icon="inline-start" />
          开始转换
        </Button>
      </div>
    </section>
  );
}
