import { conversionLimits } from "@/config/conversion";

import { isPreviewTable, type ConversionStage } from "@/lib/conversion-events";
import { isParseResponse, type ParsedTable, type ParseResponse } from "@/lib/conversion-types";

export type ConversionPreview = { tables: ParsedTable[]; stage: ConversionStage };
export class ConversionStreamError extends Error {
  constructor(
    public readonly reason: "invalid" | "interrupted" | "request",
    public readonly serverMessage?: string,
  ) {
    super(reason);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readConversionStream(response: Response, onPreview: (preview: ConversionPreview) => void): Promise<ParseResponse> {
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new ConversionStreamError("request", isRecord(error) && typeof error.message === "string" ? error.message : undefined);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    throw new ConversionStreamError("invalid");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const tables: ParsedTable[] = [];
  let stage: ConversionStage = "reading";
  let buffer = "";
  let result: ParseResponse | null = null;
  let lastPublish = 0;
  let pendingPublish: ReturnType<typeof setTimeout> | undefined;

  function publish(force = false): void {
    if (!force && Date.now() - lastPublish < 100) {
      pendingPublish ??= setTimeout(() => {
        pendingPublish = undefined;
        publish(true);
      }, 100);
      return;
    }
    clearTimeout(pendingPublish);
    pendingPublish = undefined;
    lastPublish = Date.now();
    // React receives snapshots; the stream accumulator continues to mutate locally.
    onPreview({ stage, tables: tables.map((table) => ({ ...table, rows: [...table.rows] })) });
  }

  function processFrame(frame: string): void {
    const lines = frame.split("\n").map((line) => line.replace(/\r$/, ""));
    const type = lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const text = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!text) return; // SSE comments are heartbeats.
    const data: unknown = JSON.parse(text);
    if (!isRecord(data)) throw new ConversionStreamError("invalid");
    if (type === "error") {
      throw new ConversionStreamError("request", typeof data.message === "string" ? data.message : undefined);
    }
    if (type === "status") {
      if (data.stage !== "reading" && data.stage !== "extracting" && data.stage !== "finalizing") {
        throw new ConversionStreamError("invalid");
      }
      stage = data.stage;
      publish(true);
      return;
    }
    if (type === "table" || type === "rows") {
      if (typeof data.tableIndex !== "number" || !Number.isInteger(data.tableIndex) || data.tableIndex < 0 || data.tableIndex > tables.length) throw new ConversionStreamError("invalid");
      const index = data.tableIndex;
      if (type === "table") {
        if (!isRecord(data.table)) throw new ConversionStreamError("invalid");
        const candidate = { ...data.table, rows: [] };
        if (!isPreviewTable(candidate) || candidate.columns.length === 0) throw new ConversionStreamError("invalid");
        const previous = tables[index];
        if (previous && (previous.id !== candidate.id || JSON.stringify(previous.columns) !== JSON.stringify(candidate.columns))) {
          throw new ConversionStreamError("invalid");
        }
        tables[index] = { ...candidate, rows: previous?.rows ?? [] };
      } else {
        const table = tables[index];
        if (!table || !Array.isArray(data.rows) || data.startIndex !== table.rows.length) {
          throw new ConversionStreamError("invalid");
        }
        const candidate = { ...table, rows: data.rows };
        if (!isPreviewTable(candidate)) throw new ConversionStreamError("invalid");
        table.rows.push(...candidate.rows);
      }
      publish();
      return;
    }
    if (type === "complete") {
      const candidate = { ...data, tables };
      if (
        !isParseResponse(candidate) ||
        candidate.pageCount < 1 ||
        candidate.pageCount > conversionLimits.pages ||
        candidate.summary.status === "failed" ||
        candidate.summary.validRowCount + candidate.summary.warningRowCount === 0
      ) {
        throw new ConversionStreamError("invalid");
      }
      result = candidate;
      return;
    }
    throw new ConversionStreamError("invalid");
  }

  try {
    while (result === null) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 4 * 1024 * 1024) throw new ConversionStreamError("invalid");
      // Match LF and CRLF separators, including separators split across reads.
      let separator = /\r?\n\r?\n/.exec(buffer);
      while (separator && result === null) {
        processFrame(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        separator = /\r?\n\r?\n/.exec(buffer);
      }
      if (done && result === null) throw new ConversionStreamError("interrupted");
    }
    return result;
  } catch (error) {
    if (error instanceof ConversionStreamError) throw error;
    if (error instanceof SyntaxError || error instanceof TypeError) throw new ConversionStreamError("invalid");
    throw new ConversionStreamError("interrupted");
  } finally {
    clearTimeout(pendingPublish);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
