import type { PDFDocumentProxy } from "pdfjs-dist";
import { maxUploadBytes } from "@/config/conversion";
import { ConversionError } from "@/lib/conversion-errors";
import { positionedGlyphs } from "./glyphs";
import { pageEdges } from "./paths";
import type { PdfPage, PdfWord } from "./types";

type PdfModule = typeof import("pdfjs-dist");

export async function openPdf(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new ConversionError("INVALID_FILE_TYPE");
  }
  if (!file.size) {
    throw new ConversionError("EMPTY_FILE");
  }
  if (file.size > maxUploadBytes) {
    throw new ConversionError("FILE_TOO_LARGE");
  }
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-") {
    throw new ConversionError("INVALID_PDF");
  }
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
  signal.throwIfAborted();
  const task = pdf.getDocument({
    data,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
    enableXfa: false,
    fontExtraProperties: true,
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  const close = async () => {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  };
  try {
    const document = await task.promise;
    signal.throwIfAborted();
    if (!document.numPages) {
      throw new ConversionError("INVALID_PDF");
    }
    return { document, pdf, close };
  } catch (error) {
    await close();
    signal.throwIfAborted();
    if (error instanceof ConversionError) {
      throw error;
    }
    throw new ConversionError(error instanceof Error && error.name === "PasswordException" ? "PASSWORD_PROTECTED_PDF" : "INVALID_PDF");
  }
}

export async function readPdfPage(document: PDFDocumentProxy, number: number, pdf: PdfModule): Promise<PdfPage> {
  const page = await document.getPage(number);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const [content, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    const glyphs = await positionedGlyphs(page, viewport.transform, pdf);
    const items = content.items.flatMap((item) => {
      if (!("str" in item) || !item.str.trim()) {
        return [];
      }
      const transform = pdf.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(transform[2], transform[3]);
      const style = content.styles[item.fontName];
      const ascent = style.ascent ?? (style.descent === undefined ? 0.8 : 1 + style.descent);
      let angle = (Math.atan2(transform[1], transform[0]) * 180) / Math.PI;
      while (angle > 90) {
        angle -= 180;
      }
      while (angle < -90) {
        angle += 180;
      }
      return [{ item, transform, height, angle, top: transform[5] - height * ascent }];
    });
    const sizes = new Map<number, number>();
    for (const item of items) {
      const size = Math.round(item.height);
      sizes.set(size, (sizes.get(size) ?? 0) + item.item.str.length);
    }
    const bodySize = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = `${item.item.fontName}:${Math.round(item.height)}:${Math.round(item.angle)}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const watermarks = new Set<(typeof items)[number]>();
    for (const group of groups.values()) {
      const width = Math.max(...group.map((i) => i.transform[4] + i.item.width)) - Math.min(...group.map((i) => i.transform[4]));
      const height = Math.max(...group.map((i) => i.top + i.height)) - Math.min(...group.map((i) => i.top));
      const chars = group.reduce((count, i) => count + i.item.str.length, 0);
      if (
        chars >= 8 &&
        width >= viewport.width * 0.25 &&
        ((Math.abs(group[0].angle) >= 8 && height >= viewport.height * 0.15) ||
          (group[0].height >= bodySize * 1.8 && height >= viewport.height * 0.08))
      ) {
        for (const item of group) {
          watermarks.add(item);
        }
      }
    }
    const words: PdfWord[] = [];
    for (const entry of items) {
      if (watermarks.has(entry)) {
        continue;
      }
      const { item, transform, top, height } = entry;
      const x0 = transform[4];
      const original = { text: item.str, x0, x1: x0 + item.width, top, bottom: top + height, fontSize: height };
      const matched = glyphs
        .filter((g) => Math.abs(g.baseline - transform[5]) < 1 && g.x0 >= x0 - 0.5 && g.x1 <= original.x1 + 0.5)
        .sort((a, b) => a.x0 - b.x0);
      if (
        matched
          .map((g) => g.originalText)
          .join("")
          .replace(/\s/g, "") !== item.str.replace(/\s/g, "")
      ) {
        words.push(original);
        continue;
      }
      const parts: PdfWord[] = [];
      for (const glyph of matched) {
        if (!glyph.text.trim()) {
          continue;
        }
        const previous = parts.at(-1);
        if (previous && glyph.x0 - previous.x1 < Math.max(1, height * 0.2)) {
          previous.text += glyph.text;
          previous.x1 = glyph.x1;
          previous.unresolved ||= glyph.unresolved;
        } else {
          parts.push({
            text: glyph.text,
            x0: glyph.x0,
            x1: glyph.x1,
            top,
            bottom: top + height,
            fontSize: height,
            unresolved: glyph.unresolved,
          });
        }
      }
      words.push(...(parts.length ? parts : [original]));
    }
    return {
      words,
      ...pageEdges(ops, viewport.transform, pdf),
      hasImages: ops.fnArray.some((op) =>
        [pdf.OPS.paintImageXObject, pdf.OPS.paintInlineImageXObject, pdf.OPS.paintImageMaskXObject].includes(op),
      ),
    };
  } finally {
    page.cleanup();
  }
}
