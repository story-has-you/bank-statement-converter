import type { ParseColumn, ParsedTable, ParseIssue, ParsedRow } from "@/lib/conversion-types";
import {
  isValidAmount,
  isValidDate,
  hasDateShape,
  isDateHeader,
  isDescriptionHeader,
  isAmountHeader,
  validateRowEvidence,
} from "@/lib/conversion/row-validation";
import type { PdfLine, PdfPage, PdfWord } from "./types";

const MONEY = /^(?:[€$£]?\(?[+-]?\d[\d.,]*[.,]\d{2}\)?|\([€$£]?[+-]?\d[\d.,]*[.,]\d{2}[€$£]?\))$/;
const DATE_HEADER = /日期|时间|date|time|datum|wertstellung/i;
const DESCRIPTION_HEADER =
  /摘要|描述|交易名称|description|transaction|buchung|jahreskontoauszug|说明|用途|备注|memo|details|check\s*number|cheque\s*number|reference\s*number|security\s*name|payee/i;
const AMOUNT_HEADER =
  /金额|发生额|借|贷|收入|支出|amount|debit|credit|withdrawal|deposit|betrag|lastschrift|gutschrift|paid\s*(?:out|in)|money\s*(?:out|in)|transaction\s*total/i;
const BALANCE_HEADER = /余额|balance|saldo/i;
const OPENING = new Set(["previousbalance", "openingbalance", "saldovortrag", "anfangssaldo"]);
type Cells = (string | null)[];
type CellRow = { cells: Cells; source: number; top: number; unresolved?: boolean };
type LocatedTable = { table: ParsedTable; box: number[] };
const normalize = (text: string) => text.replace(/\s/g, "").toLowerCase();
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function groupLines(words: PdfWord[]): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const word of [...words].sort((a, b) => a.top - b.top || a.x0 - b.x0)) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.top - word.top) <= 3) {
      previous.words.push(word);
    } else {
      lines.push({ words: [word], top: word.top });
    }
  }
  return lines;
}

function headerScore(cells: Cells) {
  const text = normalize(cells.join(" "));
  return [DATE_HEADER, DESCRIPTION_HEADER, AMOUNT_HEADER, BALANCE_HEADER].filter((pattern) => pattern.test(text)).length;
}
function statementHeader(cells: Cells) {
  const text = normalize(cells.join(" "));
  if (/dailybalance|totaladditions|interestcharge|interestrate|percentagerate/.test(text)) {
    return false;
  }
  return (
    cells.filter(Boolean).length >= 3 &&
    DATE_HEADER.test(text) &&
    (DESCRIPTION_HEADER.test(text) || (/number/.test(text) && /amount/.test(text))) &&
    (AMOUNT_HEADER.test(text) || BALANCE_HEADER.test(text))
  );
}
function summaryRow(cells: Cells, headers: string[]) {
  if (cells.some((cell, index) => cell && isDateHeader(headers[index] ?? "") && isValidDate(cell))) {
    return false;
  }
  return cells.some((cell) => cell && /^(?:total(?:\s|$)|net securities(?:\s|$)|subtotal(?:\s|$)|合计|总计|本页小计|累计)/i.test(cell));
}
function openingRow(cells: Cells) {
  const balanceLabel = cells.some(
    (cell) =>
      cell &&
      /^(?:previous balance|opening balance|closing balance|ending balance|start balance|end balance|balance (?:brought|carried) forward|saldovortrag|anfangssaldo|kontostand per|期初余额|期末余额)(?:\s|$)/i.test(
        cell,
      ),
  );
  return balanceLabel;
}
function candidate(cells: Cells, headers: string[]) {
  if (cells.some((cell, i) => cell && DATE_HEADER.test(headers[i] ?? "") && hasDateShape(cell))) {
    return true;
  }
  const hasDescription = cells.some(
    (cell, i) => cell && DESCRIPTION_HEADER.test(headers[i] ?? "") && !DATE_HEADER.test(headers[i]) && !AMOUNT_HEADER.test(headers[i]),
  );
  const hasAmount = cells.some((cell, i) => cell && AMOUNT_HEADER.test(headers[i] ?? "") && !BALANCE_HEADER.test(headers[i]));
  if (hasDescription && hasAmount) {
    return true;
  }
  return (
    cells.some((cell) => cell && [...OPENING].some((term) => normalize(cell).includes(term))) &&
    cells.some((cell, i) => cell && !DATE_HEADER.test(headers[i] ?? "") && isValidAmount(cell))
  );
}
function continuationColumn(cells: Cells, headers: string[]) {
  const indexes = cells.flatMap((cell, i) => (cell ? [i] : []));
  if (indexes.length !== 1) {
    return -1;
  }
  const index = indexes[0],
    header = headers[index] ?? "";
  return !DATE_HEADER.test(header) && /摘要|描述|交易|对手|description|transaction|counterparty|buchung|jahreskontoauszug/i.test(header)
    ? index
    : -1;
}
function columnsFor(headers: string[]): ParseColumn[] {
  return headers.map((label, index) => ({ key: `c${index}`, label, index }));
}
function parseRows(headers: string[], input: CellRow[], page: number, grid: boolean): ParsedTable | null {
  const columns = columnsFor(headers),
    rows: ParsedRow[] = [],
    warnings: ParseIssue[] = [];
  const dateColumns = columns.filter((column) => isDateHeader(column.label));
  const amountColumns = columns.filter((column) => isAmountHeader(column.label));
  const descriptionColumns = columns.filter((column) => isDescriptionHeader(column.label));
  let previousDate: { value: string; row: number } | null = null;
  let lastDataTop: number | null = null;
  let pending: CellRow[] = [];
  for (const item of input) {
    const { cells, source, top } = item;
    const text = clean(cells.join(" "));
    if (
      /^(?:number of checks|fees$|fees and charges|foreign taxes|federal taxes|state taxes|other account activity|bill payments|checking activity|securities (?:bought|sold|transferred)|deposits|withdrawals)(?:\s|$)/i.test(
        text,
      ) &&
      !cells.some((cell) => cell && isValidDate(cell))
    ) {
      break;
    }
    if (
      /^(?:date issued|continued on|end of (?:account|statement)|your transactions|transactions (?:to be|not)|important information|please (?:check|retain)|member fdic|page \d)/i.test(
        text,
      )
    ) {
      break;
    }
    if (!cells.some(Boolean)) {
      continue;
    }
    if (cells.length === headers.length && cells.every((cell, i) => normalize(cell ?? "") === normalize(headers[i]))) {
      previousDate = null;
      pending = [];
      continue;
    }
    if (summaryRow(cells, headers)) {
      break;
    }
    if (openingRow(cells)) {
      previousDate = null;
      pending = [];
      continue;
    }
    if (cells.filter(Boolean).length === 1 && /^\d+\s*(?:\/|of)\s*\d+$/.test(cells.filter(Boolean)[0]!)) {
      continue;
    }
    const hasDate = dateColumns.some((column) => cells[column.index] && isValidDate(cells[column.index]!));
    const hasAmount = amountColumns.some((column) => cells[column.index] && isValidAmount(cells[column.index]!));
    const hasDescription = descriptionColumns.some((column) => cells[column.index]);
    if (!hasDate && !hasAmount) {
      const index = continuationColumn(cells, headers);
      if (
        rows.length &&
        cells.some((cell, i) => cell && (isDescriptionHeader(headers[i] ?? "") || /security|cusip/i.test(headers[i] ?? ""))) &&
        dateColumns.every((column) => !cells[column.index]) &&
        lastDataTop !== null &&
        top - lastDataTop <= 60
      ) {
        const previous = rows.at(-1)!;
        columns.forEach((column) => {
          if (cells[column.index]) {
            previous.values[column.key] = clean(`${previous.values[column.key] ?? ""} ${cells[column.index]}`);
          }
        });
        continue;
      }
      if (index >= 0 && rows.length && lastDataTop !== null && top - lastDataTop <= 60) {
        const row = rows.at(-1)!;
        row.values[`c${index}`] = clean(`${row.values[`c${index}`] ?? ""} ${cells[index]}`);
      } else if (index >= 0 && !rows.length) {
        pending.push(item);
      } else {
        pending = [];
      }
      continue;
    }
    if (!hasDate && !hasDescription && !candidate(cells, headers)) {
      pending = [];
      continue;
    }
    if (lastDataTop !== null && top - lastDataTop > 90 && !grid) {
      previousDate = null;
      pending = [];
    }
    const values = Object.fromEntries(columns.map((column) => [column.key, cells[column.index] ?? null]));
    let sourceRow = source;
    if (pending.length && hasDate && hasAmount && descriptionColumns.length) {
      const column = descriptionColumns[0];
      values[column.key] = clean([...pending.map((row) => row.cells[column.index] ?? ""), values[column.key] ?? ""].join(" "));
      sourceRow = pending[0].source;
    }
    pending = [];
    const checkValues = { ...values };
    const rowWarnings: ParseIssue[] = [];
    const dateColumn = dateColumns.find((column) => values[column.key] && isValidDate(values[column.key]!));
    if (dateColumn) {
      previousDate = { value: values[dateColumn.key]!, row: source };
    } else if (dateColumns.length && dateColumns.every((column) => !values[column.key]) && previousDate && hasAmount && hasDescription) {
      checkValues[dateColumns[0].key] = previousDate.value;
      rowWarnings.push({ code: "INHERITED_DATE", params: { date: previousDate.value, page, row: previousDate.row } });
    }
    const issues = validateRowEvidence(columns, checkValues);
    const unresolved = Object.values(values).some((value) => value && /[\u0000-\u0008\u000e-\u001f\ufffd]/.test(value));
    if (unresolved || item.unresolved) {
      issues.push({ code: "UNRESOLVED_CHARACTERS", params: {} });
    }
    rows.push({
      values,
      source: { page, row: sourceRow },
      status: issues.length ? "failed" : rowWarnings.length ? "warning" : "valid",
      warnings: [...rowWarnings, ...issues],
    });
    lastDataTop = top;
  }
  if (!rows.length) {
    return null;
  }
  warnings.push(
    ...columns.filter((column) => !column.label).map((column) => ({ code: "MISSING_HEADER", params: { column: column.index + 1 } })),
  );
  return { id: "", pageStart: page, pageEnd: page, columns, rows, warnings };
}

function gridTables(page: PdfPage, lines: PdfLine[], number: number): LocatedTable[] {
  const groups: { top: number; bottom: number; xs: number[] }[] = [];
  for (const edge of page.vertical) {
    const group = groups.find((group) => Math.abs(group.top - edge.start) <= 3 && Math.abs(group.bottom - edge.end) <= 3);
    if (group) {
      group.xs.push(edge.position);
    } else {
      groups.push({ top: edge.start, bottom: edge.end, xs: [edge.position] });
    }
  }
  const tables: LocatedTable[] = [];
  for (const { top, bottom, xs: edges } of groups) {
    const xs = edges.sort((a, b) => a - b).filter((x, i, sorted) => i === 0 || x - sorted[i - 1] > 3);
    if (xs.length < 4) {
      continue;
    }
    const left = xs[0],
      right = xs.at(-1)!;
    const boundaries = [
      top,
      ...page.horizontal
        .filter((edge) => edge.start <= left + 3 && edge.end >= right - 3 && edge.position > top + 3 && edge.position < bottom - 3)
        .map((edge) => edge.position),
      bottom,
    ]
      .sort((a, b) => a - b)
      .filter((y, i, sorted) => i === 0 || y - sorted[i - 1] > 3);
    const input: CellRow[] = [];
    function cellsFor(words: PdfWord[]): Cells {
      return xs.slice(0, -1).map((x, column) => {
        const content = words.filter((word) => (word.x0 + word.x1) / 2 >= x && (word.x0 + word.x1) / 2 < xs[column + 1]);
        return (
          clean(
            groupLines(content)
              .map((line) =>
                line.words
                  .sort((a, b) => a.x0 - b.x0)
                  .map((word) => word.text)
                  .join(" "),
              )
              .join(" "),
          ) || null
        );
      });
    }
    const regionWords = page.words.filter((word) => inside(word, [left, top, right, bottom]));
    const sizes = new Map<number, number>();
    for (const word of regionWords) {
      const size = Math.round(word.fontSize ?? 8);
      sizes.set(size, (sizes.get(size) ?? 0) + word.text.length);
    }
    const bodySize = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 8;
    const words = regionWords.filter(
      (word) => !(/^\d{1,2}$/.test(word.text) && (word.fontSize ?? bodySize) > bodySize * 1.25 && word.top > top + 20),
    );
    if (boundaries.length > 3) {
      for (let i = 0; i < boundaries.length - 1; i++) {
        const y0 = boundaries[i],
          y1 = boundaries[i + 1];
        const cells = cellsFor(
          words.filter((word) => {
            const y = (word.top + word.bottom) / 2;
            return y >= y0 && y < y1;
          }),
        );
        if (cells.some(Boolean)) {
          input.push({
            cells,
            source: lines.filter((line) => line.top < y0).length + 1,
            top: y0,
            unresolved: words.some((word) => word.unresolved && word.top >= y0 && word.top < y1),
          });
        }
      }
    } else {
      for (const [index, line] of lines.entries()) {
        const cells = cellsFor(words.filter((word) => line.words.includes(word)));
        if (cells.some(Boolean)) {
          input.push({ cells, source: index + 1, top: line.top, unresolved: line.words.some((word) => word.unresolved) });
        }
      }
    }
    let header = -1;
    for (let i = 0; i < input.length - 1; i++) {
      if (headerScore(input[i].cells) > (header < 0 ? 1 : headerScore(input[header].cells))) {
        header = i;
      }
    }
    if (header < 0 || !statementHeader(input[header].cells)) {
      continue;
    }
    const keep = input[header].cells.flatMap((cell, i) =>
      (!cell || cell === "*") && input.slice(header + 1).every((row) => !row.cells[i]) ? [] : [i],
    );
    if (keep.length < 3) {
      continue;
    }
    const headers = keep.map((i) => input[header].cells[i] ?? "");
    if (headers.some((label) => /paid\s*out\s*in|money\s*out\s*money\s*in/i.test(label))) {
      continue;
    }
    const start = input.findIndex(
      (row, i) =>
        i > header &&
        !summaryRow(
          keep.map((i) => row.cells[i]),
          headers,
        ) &&
        !openingRow(keep.map((i) => row.cells[i])) &&
        candidate(
          keep.map((i) => row.cells[i]),
          headers,
        ),
    );
    if (start < 0) {
      continue;
    }
    const table = parseRows(
      headers,
      input.slice(start).map((row) => ({ ...row, cells: keep.map((i) => row.cells[i]) })),
      number,
      true,
    );
    if (!table) {
      continue;
    }
    const first = table.rows.find((row) => row.values.c0)?.values.c0;
    if (first && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+[A-Z]{3}$/.test(first) && DATE_HEADER.test(headers[0])) {
      continue;
    }
    const box = [left, top, right, bottom];
    if (!tables.some((existing) => inside({ x0: left, x1: right, top, bottom, text: "" }, existing.box))) {
      tables.push({ table, box });
    }
  }
  return tables;
}
function inside(word: PdfWord, box: number[]) {
  const x = (word.x0 + word.x1) / 2,
    y = (word.top + word.bottom) / 2;
  return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}
function clusters(words: PdfWord[]): PdfWord[] {
  const result: PdfWord[] = [];
  for (const word of [...words].sort((a, b) => a.x0 - b.x0)) {
    const previous = result.at(-1);
    if (previous && word.x0 - previous.x1 <= 6 && !(isAmountHeader(previous.text) && /^(?:in|out|amount)$/i.test(word.text))) {
      previous.text = clean(`${previous.text} ${word.text}`);
      previous.x1 = word.x1;
    } else {
      result.push({ ...word });
    }
  }
  return result;
}
function assign(words: PdfWord[], headers: PdfWord[]): Cells {
  const values = headers.map(() => [] as string[]);
  const ordered = [...words].sort((a, b) => a.x0 - b.x0);
  for (const word of ordered) {
    let column = -1,
      distance = 45;
    if (isValidAmount(word.text) || /^[+−-]?[€$£¥]?\d[\d,.]*$/.test(word.text)) {
      headers.forEach((header, i) => {
        const delta = Math.abs(word.x1 - header.x1);
        if (
          (isAmountHeader(header.text) ||
            /balance|余额|quantity|price|cost|principal|interest|fees|credit life|accident|health/i.test(header.text)) &&
          delta < distance
        ) {
          column = i;
          distance = delta;
        }
      });
    }
    if (column < 0 && isValidDate(word.text) && !MONEY.test(word.text)) {
      let distance = Infinity;
      headers.forEach((header, i) => {
        const delta = Math.abs((word.x0 + word.x1) / 2 - (header.x0 + header.x1) / 2);
        if (isDateHeader(header.text) && delta < distance && word.x0 >= header.x0 - 25 && word.x0 < (headers[i + 1]?.x0 ?? Infinity)) {
          column = i;
          distance = delta;
        }
      });
    }
    if (column < 0 && /^(?:OD|DR|CR|[-−])$/.test(word.text)) {
      const previous = ordered[ordered.indexOf(word) - 1];
      if (previous && isValidAmount(previous.text) && word.x0 - previous.x1 < Math.max(8, word.fontSize ?? 8)) {
        column = values.findIndex((value) => value.at(-1) === previous.text);
      }
    }
    if (column < 0) {
      column = 0;
      headers.forEach((header, i) => {
        if (header.x0 <= word.x0 + 3) {
          column = i;
        }
      });
    }
    values[column].push(word.text);
  }
  return values.map((value) => clean(value.join(" ")) || null);
}
function hasTransactionEvidence(words: PdfWord[]): boolean {
  return words.some((word) => hasDateShape(word.text) && !MONEY.test(word.text)) && words.some((word) => MONEY.test(word.text));
}
function hasTransactionValue(words: PdfWord[]): boolean {
  return words.some((word) => (isValidDate(word.text) && !MONEY.test(word.text)) || MONEY.test(word.text));
}
export function extractPageTables(page: PdfPage, number: number) {
  const lines = groupLines(page.words);
  const tables = gridTables(page, lines, number);
  const remaining = lines.map((line) => ({
    ...line,
    words: line.words.filter((word) => !tables.some((table) => inside(word, table.box))),
  }));
  type Region = { start: number; end: number; left: number; right: number; header: PdfWord[] };
  const candidates: Array<{ index: number; header: PdfWord[] }> = [];
  for (let index = 0; index < remaining.length; index++) {
    const header = clusters(remaining[index].words);
    if (statementHeader(header.map((cell) => cell.text))) {
      candidates.push({ index, header });
    }
  }
  const selected = candidates.filter(
    (candidate, position) =>
      position === 0 ||
      remaining.slice(candidates[position - 1].index + 1, candidate.index).some((line) => hasTransactionValue(line.words)),
  );
  const regions: Region[] = [];
  for (let i = 0; i < selected.length; i++) {
    const { index, header } = selected[i];
    const next = selected[i + 1]?.index ?? remaining.length;
    const starts = [0];
    for (let j = 1; j < header.length; j++) {
      if (
        normalize(header[j].text) === normalize(header[0].text) &&
        statementHeader(header.slice(starts.at(-1)!, j).map((cell) => cell.text))
      ) {
        starts.push(j);
      }
    }
    // A side summary is not a column of the adjacent transaction table.
    let first = 0;
    while (
      first < header.length &&
      !isDateHeader(header[first].text) &&
      !isDescriptionHeader(header[first].text) &&
      !/check|number/i.test(header[first].text)
    ) {
      first++;
    }
    for (let group = 0; group < starts.length; group++) {
      const start = group === 0 ? Math.max(first, starts[group]) : starts[group],
        stop = starts[group + 1] ?? header.length;
      let cells = header.slice(start, stop).map((cell) => ({ ...cell }));
      const prior = remaining[index - 1];
      if (prior && remaining[index].top - prior.top <= Math.max(...cells.map((cell) => cell.fontSize ?? 8)) * 1.5) {
        const fragments = clusters(prior.words);
        for (const fragment of fragments) {
          if (!/^(?:Settlement|Symbol\/|Cost Basis|Transaction|Trade|Unit)$/i.test(fragment.text)) {
            continue;
          }
          const target = cells.find(
            (cell) => Math.abs(cell.x0 - fragment.x0) <= 6 || (cell.x0 >= fragment.x0 && cell.x1 <= fragment.x1 + 3),
          );
          if (target && !normalize(target.text).includes(normalize(fragment.text))) {
            target.text = clean(`${fragment.text} ${target.text}`);
          }
        }
      }
      const left = cells[0].x0 - 10;
      const right = starts[group + 1] === undefined ? Infinity : header[starts[group + 1]].x0 - 10;
      let end = next;
      // Summary-only regions delimit transactions even when they have no description column.
      for (let row = index + 1; row < next; row++) {
        const text = normalize(remaining[row].words.map((word) => word.text).join(" "));
        if (
          /totaladditions.*totalsubtractions|datepercentagerate|dailybalancesummary|interestcharged|interestperiod|datedescriptionrate|periodperiodbalancerate/.test(
            text,
          )
        ) {
          end = row;
          break;
        }
      }
      const dataStart = remaining.findIndex(
        (line, row) => row > index && row < end && hasTransactionValue(line.words.filter((word) => word.x0 >= left && word.x0 < right)),
      );
      if (dataStart < 0) {
        continue;
      }
      // Only recognized header vocabulary extends a multiline header; leading descriptions belong to data.
      for (const line of remaining.slice(index + 1, dataStart)) {
        const parts = clusters(line.words.filter((word) => word.x0 >= left && word.x0 < right));
        if (
          !parts.length ||
          !parts.every(
            (cell) =>
              /^(?:[A-Za-z &/.€$£-]+|[\u3400-\u9fff]+)$/.test(cell.text) &&
              /date|amount|transaction|description|principal|interest|late fees|credit life|accident|health|money|paid|out|in|余额|日期|金额|摘要/i.test(
                cell.text,
              ),
          )
        ) {
          break;
        }
        for (const cell of parts) {
          const column = cells.find((column) => Math.abs(column.x0 - cell.x0) <= Math.max(6, (cell.fontSize ?? 8) * 0.8));
          if (column) {
            if (!normalize(column.text).includes(normalize(cell.text))) {
              column.text = clean(`${column.text} ${cell.text}`);
            }
            column.x1 = Math.max(column.x1, cell.x1);
          } else {
            cells.push({ ...cell });
          }
        }
      }
      cells = cells.sort((a, b) => a.x0 - b.x0);

      regions.push({ start: index, end, left, right, header: cells });
    }
  }
  for (const region of regions) {
    const { start, end, left, right, header } = region,
      labels = header.map((word) => word.text);
    const headerBottom = Math.max(...header.map((word) => word.bottom));
    const input: CellRow[] = [];
    for (let row = start + 1; row < end; row++) {
      const line = remaining[row];
      if (
        /^(?:date issued|page \d|your (?:statement|transactions)|continued on)/i.test(
          clean(
            [...line.words]
              .sort((a, b) => a.x0 - b.x0)
              .map((word) => word.text)
              .join(" "),
          ),
        )
      ) {
        break;
      }
      const words = line.words.filter((word) => word.x0 >= left && word.x0 < right && word.top >= headerBottom - 2);
      if (!words.length) {
        continue;
      }
      input.push({ cells: assign(words, header), source: row + 1, top: line.top, unresolved: words.some((word) => word.unresolved) });
    }
    const loanDescription = remaining
      .slice(start + 1, end)
      .find((line) => line.words.some((word) => /^PAYMENT$/i.test(word.text)) && !hasTransactionValue(line.words));
    const loanColumn = labels.findIndex((label) => /^transaction$/i.test(label));
    if (loanDescription && loanColumn >= 0 && labels.some((label) => /principal.*interest/i.test(label))) {
      const description = clean(
        [...loanDescription.words]
          .sort((a, b) => a.x0 - b.x0)
          .map((word) => word.text)
          .join(" "),
      );
      const amountColumn = labels.findIndex((label) => /^amount$/i.test(label));
      const dateColumn = labels.findIndex((label) => isDateHeader(label));
      for (let i = input.length - 1; i >= 0; i--) {
        if (input[i].source <= remaining.indexOf(loanDescription) + 1 || /^fees$/i.test(clean(input[i].cells.join(" ")))) {
          input.splice(i, 1);
          continue;
        }
        if (amountColumn >= 0 && !input[i].cells[amountColumn] && i > 0 && isValidDate(input[i].cells[dateColumn] ?? "")) {
          const previous = input[i - 1];
          input[i].cells.forEach((cell, column) => {
            if (cell && column !== loanColumn) {
              previous.cells[column] = clean(`${previous.cells[column] ?? ""} ${cell}`);
            }
          });
          input.splice(i, 1);
          continue;
        }
        input[i].cells[loanColumn] = description;
        input[i].source = remaining.indexOf(loanDescription) + 1;
      }
    }
    const table = parseRows(labels, input, number, false);
    if (!table) {
      continue;
    }
    const used = remaining.slice(start, end).flatMap((line) => line.words.filter((word) => word.x0 >= left && word.x0 < right));
    const box = [left, remaining[start].top, Math.max(...used.map((word) => word.x1)), Math.max(...used.map((word) => word.bottom))];
    tables.push({ table, box });
    for (let row = start; row < end; row++) {
      // Mark only rows belonging to this table, keeping unrelated areas available for omission checks.
      remaining[row].words = remaining[row].words.filter((word) => word.x0 < left || word.x0 >= right);
    }
  }
  const unparsed = remaining.some((line, index) => {
    if (!hasTransactionEvidence(line.words)) {
      return false;
    }
    const preceding = lines
      .slice(0, index)
      .findLastIndex((candidate) => statementHeader(clusters(candidate.words).map((cell) => cell.text)));
    if (preceding < 0) {
      return false;
    }
    const section = lines.slice(preceding + 1, index).map((candidate) => normalize(candidate.words.map((word) => word.text).join(" ")));
    return !section.some((text) =>
      /totaladditions.*totalsubtractions|dailybalance|interestcharged|interestcalculation|percentagerate/.test(text),
    );
  });
  tables.sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  return { tables: tables.map((item) => item.table), unparsed };
}

export function mergeTables(tables: ParsedTable[]): ParsedTable[] {
  const merged: ParsedTable[] = [];
  for (const table of tables) {
    const previous = merged.at(-1);
    if (
      previous &&
      table.pageStart <= previous.pageEnd + 1 &&
      previous.columns.length === table.columns.length &&
      previous.columns.every((column, i) => normalize(column.label) === normalize(table.columns[i].label))
    ) {
      previous.pageEnd = table.pageEnd;
      previous.rows.push(...table.rows);
      previous.warnings.push(...table.warnings);
    } else {
      merged.push({ ...table, rows: [...table.rows], warnings: [...table.warnings] });
    }
  }
  return merged.map((table, i) => ({ ...table, id: `table-${i + 1}` }));
}
