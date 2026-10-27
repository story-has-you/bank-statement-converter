import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const root = dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")));
const runtime = pathToFileURL(`${root}/legacy/build/pdf.mjs`).href;
const source = `import * as pdf from ${JSON.stringify(runtime)}; export * from ${JSON.stringify(runtime)};
export const GlobalWorkerOptions={set workerSrc(value){pdf.GlobalWorkerOptions.workerSrc=${JSON.stringify(`${root}/legacy/build/pdf.worker.mjs`)};}};
export function getDocument(options){return pdf.getDocument({...options,cMapUrl:${JSON.stringify(`${root}/cmaps/`)},standardFontDataUrl:${JSON.stringify(`${root}/standard_fonts/`)},wasmUrl:${JSON.stringify(`${root}/wasm/`)}});}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "pdfjs-dist") {
      return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("data:text/javascript,")) {
      return { format: "module", source: decodeURIComponent(url.slice(21)), shortCircuit: true };
    }
    return next(url, context);
  },
});
const { parseWithPdfJs } = await import("../src/lib/conversion/local/parser.ts");
const parse = (bytes, onPreview = () => {}, signal = new AbortController().signal) =>
  parseWithPdfJs(new File([bytes], "synthetic.pdf", { type: "application/pdf" }), signal, onPreview);
async function statement({ grid = false, pages = 1, multiple = false, repeat = false, watermark = false, bad = false } = {}) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  for (let number = 0; number < pages; number++) {
    const page = doc.addPage([600, 800]);
    if (watermark) {
      for (let i = 0; i < 4; i++) {
        page.drawText("CONFIDENTIAL", { x: 40 + i * 80, y: 120 + i * 110, size: 24, font, rotate: degrees(35), color: rgb(0.8, 0.8, 0.8) });
      }
    }
    function table(y, headers) {
      const xs = [40, 140, 360, 460, 570];
      headers.forEach((text, i) => page.drawText(text, { x: xs[i] + 4, y, size: 10, font }));
      const rows = [
        ["2026-10-01", "Store purchase", "-12.34", "987.66"],
        ["", "Wrapped description", "", ""],
        ["2026-10-02", "Deposit", bad ? "unknown" : "20.00", "1007.66"],
      ];
      rows.forEach((cells, r) =>
        cells.forEach((text, i) => {
          if (text) {
            page.drawText(text, { x: xs[i] + 4, y: y - (r + 1) * 20, size: 10, font });
          }
        }),
      );
      if (grid) {
        for (let r = 0; r <= 4; r++) {
          page.drawLine({ start: { x: xs[0], y: y + 14 - r * 20 }, end: { x: xs.at(-1), y: y + 14 - r * 20 }, thickness: 0.5 });
        }
        for (const x of xs) {
          page.drawLine({ start: { x, y: y + 14 }, end: { x, y: y + 14 - 80 }, thickness: 0.5 });
        }
      }
    }
    table(720, ["Date", "Description", "Amount", "Balance"]);
    if (multiple || repeat) {
      table(450, repeat ? ["Date", "Description", "Amount", "Balance"] : ["Date", "Transaction", "Credit", "Balance"]);
    }
  }
  return doc.save();
}
// Match a bilingual statement header whose amount label occupies separate lines.
async function multilineStatement({ firstDate = "2026-10-01", firstAmount = "12.34" } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([600, 800]);
  function line(y, cells) {
    for (const [x, text] of cells) {
      page.drawText(text, { x, y, size: 9, font });
    }
  }
  line(720, [
    [40, "Date"],
    [120, "Currency"],
    [220, "Amount"],
    [330, "Balance"],
    [430, "Description"],
  ]);
  line(702, [[220, "Transaction"]]);
  line(696, [
    [40, "Date"],
    [120, "Currency"],
    [330, "Balance"],
    [430, "Transaction Type"],
  ]);
  line(690, [[220, "Amount"]]);
  line(670, [
    [40, firstDate],
    [120, "CNY"],
    [220, firstAmount],
    [330, "987.66"],
    [430, "Store purchase"],
  ]);
  line(650, [
    [40, "2026-10-02"],
    [120, "CNY"],
    [220, "20.00"],
    [330, "1007.66"],
    [430, "Deposit"],
  ]);
  return doc.save();
}
const multiline = await parse(await multilineStatement());
assert.equal(multiline.tables[0].columns.length, 5);
assert.equal(multiline.summary.rowCount, 2);
assert.equal(multiline.summary.validRowCount, 2);
assert.equal(multiline.tables[0].rows[0].values.c2, "12.34");
assert.equal(multiline.tables[0].rows[0].values.c3, "987.66");
for (const input of [{ firstDate: "" }, { firstAmount: "" }]) {
  const incomplete = await parse(await multilineStatement(input));
  assert.equal(incomplete.summary.rowCount, 2);
  assert.equal(incomplete.summary.failedRowCount, 1);
  assert.equal(incomplete.summary.validRowCount, 1);
}

// Exercise full PDF extraction for shared dates, regional amounts and independent side-by-side tables.
async function regionalStatement({ sideBySide = false, issue = false } = {}) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([800, 800]);
  function text(value, x, y) {
    page.drawText(value, { x, y, size: 9, font });
  }
  function table(left, description, income = false) {
    [
      ["Date", left],
      ["Description", left + 70],
      [income ? "Money in" : "Paid Out", left + 190],
      ["Balance", left + 265],
    ].forEach(([value, x]) => text(value, x, 720));
    text("15 Mar", left, 700);
    text(description, left + 70, 700);
    text("12.34", left + 190, 700);
    text("987.66", left + 265, 700);
    text("Second item", left + 70, 680);
    text(".15", left + 190, 680);
    text("987.51", left + 265, 680);
    text("Total", left + 70, 660);
    text("12.49", left + 190, 660);
    text("Unrelated section", left + 70, 640);
  }
  table(40, "First item");
  if (sideBySide) {
    table(430, "Independent item", true);
  }
  if (issue) {
    text("2026-10-01", 40, 620);
    text("Unknown amount", 110, 620);
    text("invalid", 230, 620);
  }
  return doc.save();
}
const regional = await parse(await regionalStatement());
assert.equal(regional.summary.rowCount, 2);
assert.equal(regional.summary.validRowCount, 1);
assert.equal(regional.summary.warningRowCount, 1);
assert.equal(regional.tables[0].rows[1].values.c0, null);
assert.equal(regional.tables[0].rows[1].values.c2, ".15");
assert.equal(regional.tables[0].rows[1].warnings[0].code, "INHERITED_DATE");
assert.equal(regional.tables[0].rows[1].warnings[0].params.date, "15 Mar");
assert.equal(regional.tables[0].rows[0].values.c1, "First item");
const sideBySide = await parse(await regionalStatement({ sideBySide: true }));
assert.equal(sideBySide.summary.rowCount, 4);
assert.equal(sideBySide.tables[0].rows[0].values.c1, "First item");
assert.equal(sideBySide.tables[1].rows[0].values.c1, "Independent item");
for (const grid of [false, true]) {
  const result = await parse(await statement({ grid }));
  assert.equal(result.summary.rowCount, 2);
  assert.equal(result.summary.validRowCount, 2);
  assert.equal(result.tables[0].rows[0].values.c1, "Store purchase Wrapped description");
  assert.equal(result.tables[0].rows[0].values.c2, "-12.34");
}
assert.equal((await parse(await statement({ pages: 2 }))).tables[0].rows.length, 4);
for (const grid of [false, true]) {
  assert.equal((await parse(await statement({ multiple: true, grid }))).tables.length, 2);
}
assert.equal((await parse(await statement({ grid: true, watermark: true }))).summary.rowCount, 2);
assert.equal((await parse(await statement({ repeat: true }))).tables[0].rows.length, 4);
const last = new AbortController();
await assert.rejects(
  parse(await statement(), () => last.abort(), last.signal),
  (error) => error.name === "AbortError",
);
const partial = await parse(await statement({ bad: true }));
assert.equal(partial.summary.status, "partial");
assert.equal(partial.summary.failedRowCount, 1);
await assert.rejects(parse(new TextEncoder().encode("not a pdf")), (e) => e.code === "INVALID_PDF");
await assert.rejects(parse(new Uint8Array()), (e) => e.code === "EMPTY_FILE");
await assert.rejects(parse(new Uint8Array(4 * 1024 * 1024 + 1)), (e) => e.code === "FILE_TOO_LARGE");
await assert.rejects(parse(await statement({ pages: 51 })), (e) => e.code === "TOO_MANY_PAGES");
const controller = new AbortController();
controller.abort();
await assert.rejects(
  parse(await statement(), () => {}, controller.signal),
  (e) => e.name === "AbortError",
);
const mid = new AbortController();
await assert.rejects(
  parse(await statement({ pages: 2 }), () => mid.abort(), mid.signal),
  (e) => e.name === "AbortError",
);
const scanned = await PDFDocument.create();
const image = await scanned.embedPng(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j12sAAAAASUVORK5CYII=", "base64"),
);
scanned.addPage().drawImage(image, { x: 0, y: 0, width: 500, height: 700 });
await assert.rejects(parse(await scanned.save()), (e) => e.code === "UNSUPPORTED_SCANNED_PDF");
const empty = await PDFDocument.create();
empty.addPage().drawText("Not a bank statement");
await assert.rejects(parse(await empty.save()), (e) => e.code === "TABLE_NOT_FOUND");
console.log(
  "PDF.js integration: bordered/borderless, continuation, cross-page merging, multiple tables, watermark, partial result, invalid/empty/oversized/scanned/unsupported PDF, page limit and cancellation passed.",
);
if (process.argv[2]) {
  const result = await parse(await readFile(process.argv[2]));
  assert.equal(result.pageCount, 8);
  assert.equal(result.summary.rowCount, 112);
  assert.equal(result.summary.validRowCount, 112);
  assert.equal(result.errors.length, 0);
  if (process.argv[3]) {
    const baseline = JSON.parse(await readFile(process.argv[3], "utf8"));
    for (const [i, table] of result.tables.entries()) {
      for (const [j, row] of table.rows.entries()) {
        const original = baseline.tables[i].rows[j];
        assert.deepEqual(row.source, original.source);
        for (const key of Object.keys(row.values)) {
          assert.equal(row.values[key]?.replace(/\s/g, "") ?? null, original.values[key]?.replace(/\s/g, "") ?? null);
        }
      }
    }
  }
  console.log("Local sample: 8 pages, 112 valid rows, no page errors; normalized cells and source locations match the supplied baseline.");
}
