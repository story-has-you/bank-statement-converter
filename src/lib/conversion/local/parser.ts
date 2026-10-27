import { conversionLimits, MAX_RESPONSE_BYTES } from "@/config/conversion";
import { ConversionError } from "@/lib/conversion-errors";
import { isParseResponse, type ParseResponse, type ParsedTable } from "@/lib/conversion-types";
import type { ConversionPreview } from "@/lib/conversion-stream-client";
import { openPdf, readPdfPage } from "./pdf-reader";
import { extractPageTables, mergeTables } from "./tables";

export async function parseWithPdfJs(
  file: File,
  signal: AbortSignal,
  onPreview: (preview: ConversionPreview) => void,
): Promise<ParseResponse> {
  const { document, pdf, close } = await openPdf(file, signal);
  const tables: ParsedTable[] = [],
    errors: ParseResponse["errors"] = [];
  let hasText = false;
  try {
    if (document.numPages > conversionLimits.pages) {
      throw new ConversionError("TOO_MANY_PAGES");
    }
    for (let number = 1; number <= document.numPages; number++) {
      signal.throwIfAborted();
      try {
        const page = await readPdfPage(document, number, pdf);
        signal.throwIfAborted();
        if (page.words.length) {
          hasText = true;
        } else if (page.hasImages) {
          errors.push({ code: "PAGE_IMAGE_UNPARSED", page: number });
        }
        const extracted = extractPageTables(page, number);
        tables.push(...extracted.tables);
        if (extracted.unparsed) {
          errors.push({ code: "PAGE_UNPARSED", page: number });
        }
      } catch {
        signal.throwIfAborted();
        errors.push({ code: "PAGE_PARSE_FAILED", page: number });
      }
      onPreview({ stage: "extracting", tables: mergeTables(tables) });
      // Give the browser a chance to paint and process cancellation between pages.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    if (!hasText) {
      throw new ConversionError("UNSUPPORTED_SCANNED_PDF");
    }
    const merged = mergeTables(tables);
    if (!merged.length) {
      throw new ConversionError("TABLE_NOT_FOUND");
    }
    const rows = merged.flatMap((table) => table.rows);
    const validRowCount = rows.filter((row) => row.status === "valid").length;
    const warningRowCount = rows.filter((row) => row.status === "warning").length;
    if (!validRowCount && !warningRowCount) {
      throw new ConversionError("NO_VERIFIABLE_TRANSACTIONS");
    }
    const failedRowCount = rows.length - validRowCount - warningRowCount;
    const result: ParseResponse = {
      schemaVersion: "1",
      filename: file.name,
      pageCount: document.numPages,
      tables: merged,
      summary: {
        status: failedRowCount || warningRowCount || errors.length || merged.some((table) => table.warnings.length) ? "partial" : "success",
        tableCount: merged.length,
        rowCount: rows.length,
        validRowCount,
        warningRowCount,
        failedRowCount,
      },
      errors,
    };
    if (!isParseResponse(result)) {
      throw new ConversionError("INVALID_PARSER_RESPONSE");
    }
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_RESPONSE_BYTES) {
      throw new ConversionError("PARSER_RESPONSE_TOO_LARGE");
    }
    return result;
  } finally {
    await close();
  }
}
