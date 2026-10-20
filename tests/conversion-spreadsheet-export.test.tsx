import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import * as XLSX from "@e965/xlsx";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { ConversionDownloads } from "@/components/conversion/conversion-downloads";
import { buildTextExportFiles } from "@/lib/conversion-export";
import { buildDelimitedExportFiles, buildExcelWorkbook } from "@/lib/conversion-spreadsheet-export";

import { createExportFixture, formulaTexts, labels, unchangedTexts } from "./fixtures/conversion-export";

function readDelimited(content: string, format: "csv" | "tsv"): (string | number)[][] {
  const book = XLSX.read(content, { type: "string", raw: true, FS: format === "csv" ? "," : "\t" });
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "", blankrows: true });
}

for (const format of ["csv", "tsv"] as const) {
  test(`${format}: formula-shaped headers, descriptions and confirmed merchant names become text`, () => {
    const { result, merchants } = createExportFixture(formulaTexts);
    const before = structuredClone({ result, merchants });
    const [file] = buildDelimitedExportFiles(format, "statement.pdf", result, labels, merchants);
    const [headers, ...rows] = readDelimited(file.content, format);

    assert.equal(headers[1], "'=1+1");
    assert.equal(rows.length, formulaTexts.length);
    formulaTexts.forEach((text, index) => {
      assert.equal(rows[index][1], `'${text}`);
      assert.equal(rows[index][3], `'${text}`);
      assert.equal(rows[index][2], "-10.00");
      assert.deepEqual(rows[index].slice(5, 9), ["OK", "", "2", String(index + 3)]);
    });
    assert.deepEqual({ result, merchants }, before);
    assert.ok(file.content.startsWith("\uFEFF"));
    assert.equal(file.name, `statement.${format}`);
  });

  test(`${format}: amounts, Unicode, delimiters, quotes and multiline fields round-trip unchanged`, () => {
    const { result } = createExportFixture(unchangedTexts);
    const [file] = buildDelimitedExportFiles(format, "statement.pdf", result, labels);
    const [, ...rows] = readDelimited(file.content, format);

    assert.equal(rows.length, unchangedTexts.length);
    unchangedTexts.forEach((text, index) => {
      assert.equal(rows[index][1], text);
      assert.equal(rows[index].length, 9);
      assert.deepEqual(rows[index].slice(5, 7), ["2", String(index + 3)]);
    });
  });

  test(`${format}: protects risk metadata and an empty logical table's metadata-only row`, () => {
    const { result, merchants } = createExportFixture();
    result.errors.push({ code: "=1+1", page: 1 });
    result.tables[0].warnings.push({ code: "note", params: { message: "\t+1+1" } });
    result.tables[0].rows[0].warnings.push({ code: "note", params: { message: "@SUM(1,1)" } });
    result.tables.push({ ...result.tables[0], id: "empty", rows: [] });
    const files = buildDelimitedExportFiles(format, "statement.pdf", result, labels, merchants);

    assert.equal(files.length, 2);
    const [, row] = readDelimited(files[0].content, format);
    assert.equal(row[6], "'@SUM(1,1)");
    assert.deepEqual(row.slice(-2), ["'=1+1", "'\t+1+1"]);
    const [headers, metadata] = readDelimited(files[1].content, format);
    assert.equal(metadata.length, headers.length);
    assert.ok(metadata.slice(0, -2).every((value) => value === ""));
    assert.deepEqual(metadata.slice(-2), ["'=1+1", "'\t+1+1"]);
    assert.equal(files[1].name, `statement-2.${format}`);
  });

  test(`${format}: does not export failed results`, () => {
    const { result } = createExportFixture();
    result.summary.status = "failed";
    assert.deepEqual(buildDelimitedExportFiles(format, "statement.pdf", result, labels), []);
  });
}

test("JSON retains original headers, descriptions, merchant names and source evidence after delimited exports", () => {
  const descriptions = [...formulaTexts, ...unchangedTexts];
  const { result, merchants } = createExportFixture(descriptions);
  buildDelimitedExportFiles("csv", "statement.pdf", result, labels, merchants);
  buildDelimitedExportFiles("tsv", "statement.pdf", result, labels, merchants);
  const [file] = buildTextExportFiles("json", "statement.pdf", result, labels, merchants);
  const exported = JSON.parse(file.content);

  assert.equal(exported.tables[0].columns[1].label, "=1+1");
  descriptions.forEach((text, index) => {
    const row = exported.tables[0].rows[index];
    assert.deepEqual(row.values, result.tables[0].rows[index].values);
    assert.equal(row.merchantName, text);
    assert.deepEqual(row.source, { page: 2, row: index + 3 });
  });
});

test("XLSX formula-shaped text keeps string cell types and no formulas after serialization", () => {
  const { result, merchants } = createExportFixture(formulaTexts);
  const workbook = buildExcelWorkbook(result, labels, merchants);
  const book = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const sheet = book.Sheets[book.SheetNames[0]];

  assert.equal(sheet.B1.v, "=1+1");
  assert.equal(sheet.B1.t, "s");
  formulaTexts.forEach((text, index) => {
    for (const column of ["B", "D"]) {
      const cell = sheet[`${column}${index + 2}`];
      assert.equal(workbook.Sheets[workbook.SheetNames[0]][`${column}${index + 2}`].v, text);
      // XML parsers normalize CRLF to LF when reading the serialized workbook.
      assert.equal(cell.v, text.replace(/\r\n/g, "\n"));
      assert.equal(cell.t, "s");
      assert.equal(cell.f, undefined);
    }
  });
});

test("every locale provides the delimited safety notice and verified spreadsheet scope", () => {
  for (const file of readdirSync("messages").filter((name) => name.endsWith(".json"))) {
    const messages = JSON.parse(readFileSync(`messages/${file}`, "utf8"));
    assert.equal(typeof messages.ConversionResult.export.safetyNotice, "string", file);
    assert.equal(typeof messages.ConversionResult.export.safetyCompatibility, "string", file);
  }
});

test("download UI renders the original-value notice and TSV import guidance", () => {
  const { result } = createExportFixture();
  const messages = JSON.parse(readFileSync("messages/zh-CN.json", "utf8"));
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
      <ConversionDownloads filename="statement.pdf" result={result} />
    </NextIntlClientProvider>,
  );
  assert.ok(html.includes("未转义原文请下载 JSON"));
  assert.ok(html.includes("制表符分隔、双引号文本分隔符"));
});
