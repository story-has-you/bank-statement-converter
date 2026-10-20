import type { ConversionPayload, ParsedRow, ParsedTable } from "@/lib/conversion-types";

/** More than one alias page, two source columns, repeated names, and extraction risks. */
export function createMerchantFixture(): ConversionPayload {
  function table(id: string, columnKey: string, names: string[], page: number): ParsedTable {
    return {
      id,
      pageStart: page,
      pageEnd: page,
      columns: [
        { key: columnKey, label: "Description", index: 0 },
        { key: "amount", label: "Amount", index: 1 },
      ],
      rows: names.map((name, index): ParsedRow => ({
        values: { [columnKey]: name, amount: "-10.00" },
        source: { page, row: index + 1 },
        status: index === 0 ? "warning" : "valid",
        warnings: index === 0 ? [{ code: "UNKNOWN", params: { message: "Check original amount" } }] : [],
      })),
      warnings: [],
    };
  }
  const tables = [
    table("table-1", "description", ["Shared", "Shared", ...Array.from({ length: 51 }, (_, i) => `Merchant ${i + 1}`)], 1),
    table("table-2", "details", ["Shared", "Other", "Pending"], 2),
  ];
  return {
    version: 1,
    filename: "merchant-acceptance.pdf",
    result: {
      schemaVersion: "1",
      filename: "merchant-acceptance.pdf",
      pageCount: 2,
      tables,
      summary: {
        status: "partial",
        tableCount: 2,
        rowCount: 56,
        validRowCount: 54,
        warningRowCount: 2,
        failedRowCount: 0,
      },
      errors: [],
    },
    merchantNormalization: {
      "table-1": { columnKey: "description", aliases: { Shared: "First shop", "Merchant 51": "Last shop" } },
      "table-2": { columnKey: "details", aliases: { Shared: "Second shop", Other: "Other shop" } },
    },
  };
}
