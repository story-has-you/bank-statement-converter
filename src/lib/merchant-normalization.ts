import type { ParsedRow, ParseResponse } from "@/lib/conversion-types";

export type MerchantTableNormalization = { columnKey: string; aliases: Record<string, string> };
export type MerchantNormalization = Record<string, MerchantTableNormalization>;
export type MerchantAlias = { value: string; rowCount: number; tableIds: string[]; names: Array<string | null> };

export function getMerchantTable(normalization: MerchantNormalization, tableId: string): MerchantTableNormalization | undefined {
  return Object.hasOwn(normalization, tableId) ? normalization[tableId] : undefined;
}

export function getMerchantName(normalization: MerchantNormalization, tableId: string, row: ParsedRow): string | null {
  const table = getMerchantTable(normalization, tableId);
  const original = table && row.values[table.columnKey];
  // Statement text is an arbitrary key, including names such as "constructor".
  return table && original != null && Object.hasOwn(table.aliases, original) ? table.aliases[original] : null;
}

export function hasMerchantNames(normalization: MerchantNormalization): boolean {
  return Object.values(normalization).some((table) => Object.keys(table.aliases).length > 0);
}

/** Exact source text groups aliases across the selected columns of this file only. */
export function getMerchantAliases(result: ParseResponse, normalization: MerchantNormalization): MerchantAlias[] {
  const aliases = new Map<string, MerchantAlias>();
  for (const table of result.tables) {
    const source = getMerchantTable(normalization, table.id);
    if (!source) {
      continue;
    }
    for (const row of table.rows) {
      const value = row.values[source.columnKey];
      if (value == null || value.trim() === "") {
        continue;
      }
      let alias = aliases.get(value);
      if (!alias) {
        alias = { value, rowCount: 0, tableIds: [], names: [] };
        aliases.set(value, alias);
      }
      alias.rowCount += 1;
      if (!alias.tableIds.includes(table.id)) {
        alias.tableIds.push(table.id);
      }
      const name = getMerchantName(normalization, table.id, row);
      if (!alias.names.includes(name)) {
        alias.names.push(name);
      }
    }
  }
  return [...aliases.values()];
}

/** A null name removes the selected mappings without changing the source values. */
export function assignMerchantAliases(
  normalization: MerchantNormalization,
  aliases: MerchantAlias[],
  name: string | null,
): MerchantNormalization {
  let next = { ...normalization };
  for (const alias of aliases) {
    for (const tableId of alias.tableIds) {
      const table = next[tableId];
      const names = name === null ? { ...table.aliases } : { ...table.aliases, [alias.value]: name };
      if (name === null) {
        delete names[alias.value];
      }
      next = { ...next, [tableId]: { ...table, aliases: names } };
    }
  }
  return next;
}

/** Session data is a browser input boundary; invalid edits must not hide a usable result. */
export function isMerchantNormalization(value: unknown, result: ParseResponse): value is MerchantNormalization {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(([id, entry]) => {
    if (typeof entry !== "object" || entry === null || !("columnKey" in entry) || !("aliases" in entry)) {
      return false;
    }
    const table = result.tables.find((table) => table.id === id);
    if (!table?.columns.some((column) => column.key === entry.columnKey)) {
      return false;
    }
    const aliases = entry.aliases;
    return (
      typeof aliases === "object" &&
      aliases !== null &&
      !Array.isArray(aliases) &&
      Object.entries(aliases).every(([original, name]) => original.trim() !== "" && typeof name === "string" && name.trim() !== "")
    );
  });
}
