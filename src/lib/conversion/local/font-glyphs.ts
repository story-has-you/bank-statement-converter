// Compare embedded TrueType outlines, not character codes or the expected date shape.
export function glyphOutline(data: Uint8Array, character: number): string | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables = new Map<string, number>();
  if (data.length < 12) {
    return null;
  }
  const count = view.getUint16(4);
  if (12 + count * 16 > data.length) {
    return null;
  }
  for (let i = 0; i < count; i++) {
    const offset = 12 + i * 16;
    const tag = String.fromCharCode(...data.subarray(offset, offset + 4));
    const start = view.getUint32(offset + 8),
      size = view.getUint32(offset + 12);
    if (start + size > data.length) {
      return null;
    }
    tables.set(tag, start);
  }
  const head = tables.get("head"),
    loca = tables.get("loca"),
    glyf = tables.get("glyf"),
    cmap = tables.get("cmap");
  if (head === undefined || loca === undefined || glyf === undefined || cmap === undefined) {
    return null;
  }
  let glyph = 0;
  for (let i = 0; i < view.getUint16(cmap + 2); i++) {
    const sub = cmap + view.getUint32(cmap + 8 + i * 8),
      format = view.getUint16(sub);
    if (format === 12) {
      for (let j = 0; j < view.getUint32(sub + 12); j++) {
        const group = sub + 16 + j * 12,
          start = view.getUint32(group),
          end = view.getUint32(group + 4);
        if (character >= start && character <= end) {
          glyph = view.getUint32(group + 8) + character - start;
          break;
        }
      }
    } else if (format === 4 && character <= 0xffff) {
      const segments = view.getUint16(sub + 6) / 2;
      for (let j = 0; j < segments; j++) {
        const end = view.getUint16(sub + 14 + j * 2),
          start = view.getUint16(sub + 16 + segments * 2 + j * 2);
        if (character < start || character > end) {
          continue;
        }
        const delta = view.getInt16(sub + 16 + segments * 4 + j * 2),
          rangeOffset = sub + 16 + segments * 6 + j * 2;
        const range = view.getUint16(rangeOffset);
        glyph = range ? view.getUint16(rangeOffset + range + (character - start) * 2) : character;
        if (glyph) {
          glyph = (glyph + delta) & 0xffff;
        }
        break;
      }
    }
    if (glyph) {
      break;
    }
  }
  if (!glyph) {
    return null;
  }
  const long = view.getInt16(head + 50) === 1,
    units = view.getUint16(head + 18);
  const offset = long ? view.getUint32(loca + glyph * 4) : view.getUint16(loca + glyph * 2) * 2;
  const end = long ? view.getUint32(loca + (glyph + 1) * 4) : view.getUint16(loca + (glyph + 1) * 2) * 2;
  if (offset === end || glyf + end > data.length) {
    return null;
  }
  const base = glyf + offset,
    contours = view.getInt16(base);
  // Composite outlines are left unresolved rather than guessing a character.
  if (contours <= 0) {
    return null;
  }
  let cursor = base + 10;
  const endpoints: number[] = [];
  for (let i = 0; i < contours; i++, cursor += 2) {
    endpoints.push(view.getUint16(cursor));
  }
  const pointCount = endpoints.at(-1)! + 1;
  cursor += 2 + view.getUint16(cursor);
  const flags: number[] = [];
  while (flags.length < pointCount) {
    const flag = view.getUint8(cursor++);
    const repeat = flag & 8 ? view.getUint8(cursor++) : 0;
    for (let i = 0; i <= repeat; i++) {
      flags.push(flag);
    }
  }
  const xs: number[] = [],
    ys: number[] = [];
  for (const [shortBit, sameBit, values] of [
    [2, 16, xs],
    [4, 32, ys],
  ] as const) {
    let value = 0;
    for (const flag of flags) {
      if (flag & shortBit) {
        value += view.getUint8(cursor++) * (flag & sameBit ? 1 : -1);
      } else if (!(flag & sameBit)) {
        value += view.getInt16(cursor);
        cursor += 2;
      }
      values.push(Math.round((value / units) * 10000));
    }
  }
  return JSON.stringify([endpoints, flags.map((flag) => flag & 1), xs, ys]);
}
