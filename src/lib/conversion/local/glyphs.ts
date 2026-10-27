import type { PDFPageProxy, Util, OPS } from "pdfjs-dist";

import { glyphOutline } from "./font-glyphs";

type Matrix = number[];
type PositionedGlyph = { text: string; originalText: string; unresolved: boolean; x0: number; x1: number; baseline: number };

// PDF.js text items can span cells. Use the PDF's glyph advances, never equal-width character estimates.
export async function positionedGlyphs(
  page: PDFPageProxy,
  viewport: Matrix,
  pdf: { Util: typeof Util; OPS: typeof OPS },
): Promise<PositionedGlyph[]> {
  const ops = await page.getOperatorList();
  const recovered = recoverCharacters(page, ops, pdf.OPS);
  let state = {
    ctm: [1, 0, 0, 1, 0, 0],
    matrix: [1, 0, 0, 1, 0, 0],
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    size: 0,
    scale: 1,
    char: 0,
    word: 0,
    leading: 0,
    rise: 0,
    font: "",
  };
  const stack: (typeof state)[] = [],
    glyphs: PositionedGlyph[] = [];
  function move(x: number, y: number): void {
    state.x = state.lineX += x;
    state.y = state.lineY += y;
  }
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    switch (fn) {
      case pdf.OPS.save:
        stack.push(structuredClone(state));
        break;
      case pdf.OPS.restore:
        state = stack.pop() ?? state;
        break;
      case pdf.OPS.transform:
        state.ctm = pdf.Util.transform(state.ctm, args);
        break;
      case pdf.OPS.beginText:
        state.matrix = [1, 0, 0, 1, 0, 0];
        state.x = state.y = state.lineX = state.lineY = 0;
        break;
      case pdf.OPS.setFont:
        state.font = args[0];
        state.size = args[1];
        break;
      case pdf.OPS.setCharSpacing:
        state.char = args[0];
        break;
      case pdf.OPS.setWordSpacing:
        state.word = args[0];
        break;
      case pdf.OPS.setHScale:
        state.scale = args[0] / 100;
        break;
      case pdf.OPS.setLeading:
        state.leading = -args[0];
        break;
      case pdf.OPS.setTextRise:
        state.rise = args[0];
        break;
      case pdf.OPS.setTextMatrix:
        state.matrix = Array.from(args[0]);
        state.x = state.y = state.lineX = state.lineY = 0;
        break;
      case pdf.OPS.moveText:
        move(args[0], args[1]);
        break;
      case pdf.OPS.setLeadingMoveText:
        state.leading = args[1];
        move(args[0], args[1]);
        break;
      case pdf.OPS.nextLine:
        move(0, state.leading);
        break;
      case pdf.OPS.showText: {
        const matrix = pdf.Util.transform(viewport, pdf.Util.transform(state.ctm, state.matrix));
        for (const glyph of args[0] as Array<number | { unicode: string; fontChar: string; width: number; isSpace: boolean }>) {
          if (typeof glyph === "number") {
            state.x -= ((glyph * state.size) / 1000) * state.scale;
            continue;
          }
          const width = ((glyph.width * state.size) / 1000) * state.scale;
          const start = [state.x, state.y + state.rise];
          pdf.Util.applyTransform(start, matrix);
          const end = [state.x + width, state.y + state.rise];
          pdf.Util.applyTransform(end, matrix);
          if (Math.abs(end[1] - start[1]) < 1) {
            glyphs.push({
              text: recovered.get(`${state.font}:${glyph.fontChar}`) ?? glyph.unicode,
              originalText: glyph.unicode,
              unresolved: recovered.has(`${state.font}:${glyph.fontChar}`) && recovered.get(`${state.font}:${glyph.fontChar}`) === null,
              x0: Math.min(start[0], end[0]),
              x1: Math.max(start[0], end[0]),
              baseline: start[1],
            });
          }
          state.x += width + (state.char + (glyph.isSpace ? state.word : 0)) * state.scale;
        }
        break;
      }
    }
  }
  return glyphs;
}

function recoverCharacters(
  page: PDFPageProxy,
  ops: Awaited<ReturnType<PDFPageProxy["getOperatorList"]>>,
  codes: typeof OPS,
): Map<string, string | null> {
  type Font = { name?: string; data?: Uint8Array };
  const entries = new Map<string, { font: Font; family: string; character: string; unicode: string; originalCode: number }>();
  let fontId = "";
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === codes.setFont) {
      fontId = ops.argsArray[i][0];
    }
    if (ops.fnArray[i] !== codes.showText) {
      continue;
    }
    const font: Font = page.commonObjs.get(fontId);
    for (const glyph of ops.argsArray[i][0]) {
      if (typeof glyph === "number") {
        continue;
      }
      entries.set(`${fontId}:${glyph.fontChar}`, {
        font,
        family: (font.name ?? fontId).replace(/^[A-Z]{6}\+/, ""),
        character: glyph.fontChar,
        unicode: glyph.unicode,
        originalCode: glyph.originalCharCode,
      });
    }
  }
  const result = new Map<string, string | null>();
  const suspectFonts = new Set(
    [...entries].filter(([, entry]) => /[\u0000-\u001f\ufffd]/.test(entry.unicode)).map(([key]) => key.split(":")[0]),
  );
  const unresolved = [...entries].filter(
    ([key, entry]) => suspectFonts.has(key.split(":")[0]) || entry.originalCode !== entry.unicode.codePointAt(0),
  );
  if (!unresolved.length) {
    return result;
  }
  const known = new Map<string, Set<string>>();
  for (const [entryKey, entry] of entries) {
    if (
      suspectFonts.has(entryKey.split(":")[0]) ||
      !entry.font.data ||
      entry.unicode.length !== 1 ||
      entry.originalCode !== entry.unicode.codePointAt(0) ||
      /[\u0000-\u0020\ufffd]/.test(entry.unicode)
    ) {
      continue;
    }
    const outline = glyphOutline(entry.font.data, entry.character.codePointAt(0)!);
    if (!outline) {
      continue;
    }
    const key = `${entry.family}:${outline}`,
      characters = known.get(key) ?? new Set<string>();
    characters.add(entry.unicode);
    known.set(key, characters);
  }
  for (const [key, entry] of unresolved) {
    if (!entry.font.data) {
      continue;
    }
    const outline = glyphOutline(entry.font.data, entry.character.codePointAt(0)!);
    const matches = outline ? known.get(`${entry.family}:${outline}`) : undefined;
    if (matches?.size === 1) {
      result.set(key, [...matches][0]);
    } else if (suspectFonts.has(key.split(":")[0])) {
      result.set(key, null);
    }
  }
  return result;
}
