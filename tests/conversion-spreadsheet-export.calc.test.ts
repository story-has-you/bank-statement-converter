import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import * as XLSX from "@e965/xlsx";

import { getTableHeaders, getTableRows } from "@/lib/conversion-export";
import { buildDelimitedExportFiles } from "@/lib/conversion-spreadsheet-export";

import { createExportFixture, formulaTexts, labels, unchangedTexts } from "./fixtures/conversion-export";

// Run explicitly with pnpm test:exports:calc on a host with LibreOffice Calc.
const soffice = process.env.SOFFICE ?? "soffice";
const version = execFileSync(soffice, ["--version"], { encoding: "utf8", timeout: 30000 }).trim();
console.info(`Spreadsheet acceptance: ${version}`);

for (const format of ["csv", "tsv"] as const) {
  test(`${format}: Calc evaluates the baseline but treats all protected fields as text`, { timeout: 180000 }, () => {
    const directory = process.env.EXPORT_ACCEPTANCE_DIR
      ? join(process.env.EXPORT_ACCEPTANCE_DIR, format)
      : mkdtempSync(join(tmpdir(), `export-calc-${format}-`));
    mkdirSync(directory, { recursive: true });
    const delimiter = format === "csv" ? "," : "\t";
    const { result: baseline, merchants: baselineMerchants } = createExportFixture();
    const rawContent = XLSX.utils.sheet_to_csv(
      XLSX.utils.aoa_to_sheet([
        getTableHeaders(baseline.tables[0], labels, baselineMerchants),
        ...getTableRows(baseline.tables[0], labels.issue, baselineMerchants),
      ]),
      { FS: delimiter, RS: "\r\n", forceQuotes: true },
    );
    const rawPath = join(directory, `baseline.${format}`);
    writeFileSync(rawPath, `\uFEFF${rawContent}`);
    const { result, merchants } = createExportFixture([...formulaTexts, ...unchangedTexts]);
    const [file] = buildDelimitedExportFiles(format, "protected.pdf", result, labels, merchants);
    const safePath = join(directory, file.name);
    writeFileSync(safePath, file.content);

    function importWithCalc(path: string, output: string, options?: string): XLSX.WorkSheet {
      const outputDirectory = join(directory, output);
      mkdirSync(outputDirectory, { recursive: true });
      execFileSync(
        soffice,
        [
          `-env:UserInstallation=file://${join(directory, `profile-${output}`)}`,
          "--headless",
          ...(options ? [`--infilter=Text - txt - csv (StarCalc):${options}`] : []),
          "--convert-to",
          "xlsx",
          "--outdir",
          outputDirectory,
          path,
        ],
        { encoding: "utf8", timeout: 60000 },
      );
      const name = path.endsWith(`baseline.${format}`) ? "baseline" : "protected";
      const workbook = XLSX.readFile(join(outputDirectory, `${name}.xlsx`));
      return workbook.Sheets[workbook.SheetNames[0]];
    }

    try {
      // UTF-8, selected delimiter, double quotes, Standard columns, en-US,
      // quoted-as-text OFF, detect-special-numbers OFF, evaluate-formulas ON.
      const options = `${delimiter.charCodeAt(0)},34,76,1,,1033,false,false,false,false,false,0,true`;
      const raw = importWithCalc(rawPath, "baseline-evaluate", options);
      assert.equal(raw.B1.f, "1+1");
      assert.equal(raw.B2.v, 2);
      assert.equal(raw.D2.v, 2);

      const report: Record<string, unknown> = {
        version,
        format,
        options,
        baseline: { header: raw.B1, description: raw.B2, merchant: raw.D2 },
      };
      for (const [mode, importOptions] of [
        ["evaluate", options],
        // Calc's fresh-profile command-line default selects comma even for .tsv.
        // TSV therefore uses Text Import with tab and double-quote delimiters.
        [format === "csv" ? "default" : "text-import", format === "csv" ? undefined : options.replace(/true$/, "false")],
      ] as const) {
        const sheet = importWithCalc(safePath, `protected-${mode}`, importOptions);
        assert.equal(sheet.B1.v, "'=1+1");
        assert.equal(sheet.B2.v, "'=1+1");
        assert.equal(sheet.D2.v, "'=1+1");
        for (const [address, cell] of Object.entries(sheet)) {
          if (!address.startsWith("!")) {
            assert.equal(cell.f, undefined, `${mode}: ${address} must not be a formula`);
          }
        }
        formulaTexts.forEach((_, index) => {
          assert.equal(sheet[`B${index + 2}`].t, "s");
          assert.equal(sheet[`D${index + 2}`].t, "s");
        });
        unchangedTexts.forEach((text, index) => {
          const row = formulaTexts.length + index + 2;
          if (text && !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
            assert.equal(sheet[`B${row}`].v, text.replace(/\r\n/g, "\n"));
          }
          assert.equal(sheet[`C${row}`].v, -10);
          assert.equal(sheet[`H${row}`].v, 2);
          assert.equal(sheet[`I${row}`].v, formulaTexts.length + index + 3);
        });
        assert.deepEqual(XLSX.utils.decode_range(sheet["!ref"]!), {
          s: { r: 0, c: 0 },
          e: { r: formulaTexts.length + unchangedTexts.length, c: 10 },
        });
        report[mode] = { header: sheet.B1, description: sheet.B2, merchant: sheet.D2, amount: sheet.C2, range: sheet["!ref"] };
      }
      if (format === "tsv") {
        const automatic = importWithCalc(safePath, "automatic-default");
        report.automaticDefault = {
          range: automatic["!ref"],
          header: automatic.A1.v,
          delimitersRecognized: automatic.B1?.v === "'=1+1",
          note: "Use Text Import with tab as field delimiter and double quote as text delimiter; automatic detection is not supported.",
        };
      }
      writeFileSync(join(directory, "acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.info(
        `${format}: baseline =1+1 -> 2; protected header/description/merchant -> "'=1+1" (text); amounts and source positions intact`,
      );
    } finally {
      if (!process.env.EXPORT_ACCEPTANCE_DIR) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
}
