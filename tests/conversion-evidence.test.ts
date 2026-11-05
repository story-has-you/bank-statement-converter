import assert from "node:assert/strict";
import { test } from "node:test";

import { extractPageTables } from "@/lib/conversion/local/tables";
import type { PdfPage, PdfWord } from "@/lib/conversion/local/types";
import { validateRowEvidence } from "@/lib/conversion/row-validation";

const headers = ["Date", "Description", "Amount", "Balance"];
const transaction = ["2026-10-01", "Store", "10.00", "990.00"];

function page(rows: string[][], unresolvedRow = -1, grid = false): PdfPage {
  const words: PdfWord[] = rows.flatMap((cells, row) =>
    cells.flatMap((text, column) =>
      text
        ? [
            {
              text,
              x0: [40, 140, 360, 460][column],
              x1: [80, 270, 400, 505][column],
              top: 40 + row * 22,
              bottom: 50 + row * 22,
              fontSize: 10,
              unresolved: row === unresolvedRow,
            },
          ]
        : [],
    ),
  );
  return {
    words,
    horizontal: grid ? [30, ...rows.map((_, row) => 57 + row * 22)].map((position) => ({ position, start: 30, end: 550 })) : [],
    vertical: grid ? [30, 130, 350, 450, 550].map((position) => ({ position, start: 30, end: 35 + rows.length * 22 })) : [],
    hasImages: false,
  };
}

test("headerless transaction pages retain an omission warning", () => {
  const result = extractPageTables(page([transaction]), 2);
  assert.equal(result.tables.length, 0);
  assert.equal(result.unparsed, true);
});

for (const grid of [false, true]) {
  test(`subtotals retain later transactions and reset inherited dates (grid=${grid})`, () => {
    const result = extractPageTables(
      page(
        [
          headers,
          transaction,
          ["", "Subtotal", "10.00", ""],
          ["", "Next group", "20.00", "970.00"],
          ["2026-10-02", "Second store", "30.00", "940.00"],
        ],
        -1,
        grid,
      ),
      1,
    );
    assert.equal(result.tables[0].rows.length, 3);
    assert.equal(result.tables[0].rows[1].status, "failed");
    assert.equal(result.tables[0].rows[1].warnings[0].code, "MISSING_DATE");
    assert.equal(result.tables[0].rows[2].values.c1, "Second store");
  });

  test(`transactions after a section stop retain an omission warning (grid=${grid})`, () => {
    const result = extractPageTables(
      page([headers, transaction, ["", "Important information", "", ""], ["2026-10-02", "Second store", "20.00", "970.00"]], -1, grid),
      1,
    );
    assert.equal(result.tables[0].rows.length, 1);
    assert.equal(result.unparsed, true);
  });
}

test("an invalid amount on a following line cannot corrupt a valid transaction", () => {
  const result = extractPageTables(page([headers, transaction, ["", "continued", "oops", ""]]), 1);
  const [first, second] = result.tables[0].rows;
  assert.equal(first.values.c2, "10.00");
  assert.equal(first.status, "valid");
  assert.equal(second.values.c2, "oops");
  assert.equal(second.status, "failed");
  assert(second.warnings.some((issue) => issue.code === "INVALID_AMOUNT"));
});

test("continuation text preserves unresolved glyph risks", () => {
  for (const text of ["broken details", "broken\ufffd details"]) {
    const result = extractPageTables(page([headers, transaction, ["", text, "", ""]], 2), 1);
    const row = result.tables[0].rows[0];
    assert.equal(row.values.c1, `Store ${text}`);
    assert.equal(row.status, "failed");
    assert(row.warnings.some((issue) => issue.code === "UNRESOLVED_CHARACTERS"));
  }
});

test("nonempty invalid debit, credit and date values cannot hide behind another valid field", () => {
  const columns = ["Date", "Posting Date", "Description", "Debit", "Credit"].map((label, index) => ({ label, index, key: `c${index}` }));
  const values = { c0: "2026-10-01", c1: "", c2: "Store", c3: "", c4: "10.00" };
  assert.deepEqual(validateRowEvidence(columns, values), []);
  assert(validateRowEvidence(columns, { ...values, c3: "oops" }).some((issue) => issue.code === "INVALID_AMOUNT"));
  assert(validateRowEvidence(columns, { ...values, c1: "2026-02-30" }).some((issue) => issue.code === "INVALID_DATE"));
});

test("separate clock-time columns remain valid beside a date", () => {
  const columns = ["Date", "Time", "Description", "Amount"].map((label, index) => ({ label, index, key: `c${index}` }));
  for (const time of ["14:30", "23:59:59", "2:30 PM"]) {
    assert.deepEqual(validateRowEvidence(columns, { c0: "2026-10-01", c1: time, c2: "Store", c3: "10.00" }), []);
  }
  assert(
    validateRowEvidence(columns, { c0: "2026-10-01", c1: "25:00", c2: "Store", c3: "10.00" }).some(
      (issue) => issue.code === "INVALID_DATE",
    ),
  );
});
