"""Generic table extraction for text-based bank statement PDFs."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any

from .pdf_reader import filter_watermark_page


HEADER_TERMS = (
    "日期",
    "时间",
    "摘要",
    "金额",
    "余额",
    "交易",
    "借",
    "贷",
    "对手",
    "币种",
    "date",
    "time",
    "description",
    "amount",
    "balance",
    "transaction",
    "debit",
    "credit",
    "currency",
    "counterparty",
    "datum",
    "wertstellung",
    "buchung",
    "betrag",
    "saldo",
    "lastschrift",
    "gutschrift",
    "jahreskontoauszug",
)
SUMMARY_TERMS = ("合计", "总计", "本页小计", "累计", "total", "subtotal", "ending balance")
DATE_PATTERN = re.compile(
    r"^(?:\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)\b"
)
MONEY_PATTERN = re.compile(
    r"^(?:[€$£]?\(?[+-]?\d[\d.,]*[.,]\d{2}\)?|\([€$£]?[+-]?\d[\d.,]*[.,]\d{2}[€$£]?\))$",
    re.ASCII,
)
OPENING_BALANCE_TERMS = ("previous balance", "opening balance", "saldovortrag", "anfangssaldo")
SECTION_END_TERMS = ("checks", "daily balance summary", "fees", "interest charged")
ROW_Y_TOLERANCE = 3.0
HEADER_CELL_GAP = 6.0


@dataclass
class RawRow:
    """A row before it is converted into the public Pydantic model."""

    cells: list[str | None]
    page: int
    row: int
    warnings: list[str] = field(default_factory=list)
    failed: bool = False


@dataclass
class RawTable:
    """A table with a single header and raw rows."""

    page_start: int
    page_end: int
    headers: list[str]
    rows: list[RawRow]
    warnings: list[str] = field(default_factory=list)


@dataclass
class _WordLine:
    words: list[dict[str, object]]
    top: float


def extract_page_tables(page: Any, page_number: int) -> list[RawTable]:
    """Extract bordered tables first and use coordinate reconstruction as fallback."""

    page = filter_watermark_page(page)
    tables = _extract_pdfplumber_tables(page, page_number)
    if tables:
        return tables

    return _rebuild_table_from_words(page, page_number)


def merge_compatible_tables(tables: list[RawTable]) -> list[RawTable]:
    """Merge adjacent tables whose normalized headers are identical."""

    merged: list[RawTable] = []
    for table in tables:
        if not table.headers:
            continue
        if (
            merged
            and table.page_start <= merged[-1].page_end + 1
            and _same_headers(merged[-1].headers, table.headers)
        ):
            previous = merged[-1]
            previous.page_end = max(previous.page_end, table.page_end)
            previous.rows.extend(table.rows)
            previous.warnings.extend(table.warnings)
            continue
        merged.append(table)
    return merged


def merge_tables_into_single_table(tables: list[RawTable]) -> list[RawTable]:
    """Flatten parsed tables into one logical table while preserving source rows."""

    if not tables:
        return []

    headers: list[str] = []
    header_indexes: dict[str, list[int]] = {}
    for table in tables:
        occurrences: dict[str, int] = {}
        for header in table.headers:
            normalized = _normalize_for_match(header)
            occurrence = occurrences.get(normalized, 0)
            occurrences[normalized] = occurrence + 1
            indexes = header_indexes.setdefault(normalized, [])
            if occurrence == len(indexes):
                indexes.append(len(headers))
                headers.append(header)

    rows: list[RawRow] = []
    warnings: list[str] = []
    for table in tables:
        occurrences: dict[str, int] = {}
        indexes: list[int] = []
        for header in table.headers:
            normalized = _normalize_for_match(header)
            occurrence = occurrences.get(normalized, 0)
            occurrences[normalized] = occurrence + 1
            indexes.append(header_indexes[normalized][occurrence])
        for row in table.rows:
            cells: list[str | None] = [None] * len(headers)
            for index, cell in zip(indexes, row.cells):
                cells[index] = cell
            rows.append(
                RawRow(
                    cells=cells,
                    page=row.page,
                    row=row.row,
                    warnings=list(row.warnings),
                    failed=row.failed,
                )
            )
        warnings.extend(table.warnings)

    return [RawTable(page_start=1, page_end=1, headers=headers, rows=rows, warnings=warnings)]


def _extract_pdfplumber_tables(
    page: Any,
    page_number: int,
) -> list[RawTable]:
    try:
        found_tables = page.find_tables()
    except Exception:
        return []

    extracted: list[RawTable] = []
    for table in found_tables:
        try:
            rows = table.extract()
        except Exception:
            continue
        parsed = _raw_table_from_rows(rows, page_number)
        if parsed is not None:
            extracted.append(parsed)
    return extracted


def _raw_table_from_rows(rows: list[list[object]], page_number: int) -> RawTable | None:
    cleaned_rows = [[_clean_cell(cell) for cell in row] for row in rows]
    cleaned_rows = [row for row in cleaned_rows if any(cell is not None for cell in row)]
    if not cleaned_rows:
        return None

    header_index = _select_header_index(cleaned_rows)
    if header_index is None:
        return None

    if not _is_statement_header(cleaned_rows[header_index]):
        return None
    kept_columns = []
    for index, cell in enumerate(cleaned_rows[header_index]):
        if cell is None:
            continue
        if cell == "*" and all(
            index >= len(row) or row[index] is None
            for row in cleaned_rows[header_index + 1 :]
        ):
            continue
        kept_columns.append(index)
    if len(kept_columns) < 3:
        return None
    headers = _ensure_header_labels([cleaned_rows[header_index][index] for index in kept_columns])
    data_start = _find_data_start(cleaned_rows, header_index + 1)
    if data_start is None:
        return None
    parsed_rows: list[RawRow] = []
    table_warnings: list[str] = []
    for offset, cells in enumerate(cleaned_rows[data_start:], start=data_start + 1):
        cells = [cells[index] if index < len(cells) else None for index in kept_columns]
        if _is_repeated_header(cells, headers):
            table_warnings.append(f"第 {offset} 行重复表头，已忽略")
            continue
        if _is_summary_row(cells):
            table_warnings.append(f"第 {offset} 行疑似合计行，已忽略")
            break
        if _is_opening_balance(cells):
            continue
        if not _looks_like_data_row(cells):
            break
        parsed_rows.append(RawRow(cells=cells, page=page_number, row=offset))

    if not parsed_rows:
        return None
    if _requires_coordinate_rebuild(headers, parsed_rows):
        return None
    return RawTable(page_number, page_number, headers, parsed_rows, table_warnings)


def _rebuild_table_from_words(
    page: Any,
    page_number: int,
    extracted_words: list[dict[str, object]] | None = None,
) -> list[RawTable]:
    if extracted_words is None:
        try:
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=False,
            )
        except Exception:
            return []
    else:
        words = extracted_words

    normalized_words = [
        {
            "text": str(word.get("text", "")).strip(),
            "x0": float(word.get("x0", 0)),
            "x1": float(word.get("x1", 0)),
            "top": float(word.get("top", 0)),
            "bottom": float(word.get("bottom", 0)),
        }
        for word in words
        if str(word.get("text", "")).strip()
    ]
    lines = _group_words_into_lines(normalized_words)
    if len(lines) < 2:
        return []

    header_index = next(
        (index for index in range(len(lines) - 1) if _is_coordinate_header(lines, index)),
        None,
    )
    if header_index is None:
        return []

    header_cells = _cluster_words(lines[header_index].words)
    headers = _ensure_header_labels([str(cell["text"]) for cell in header_cells])
    anchors = [float(cell["x0"]) for cell in header_cells]
    amount_edges = {
        index: float(cell["x1"])
        for index, cell in enumerate(header_cells)
        if _is_amount_header(headers[index])
    }
    parsed_rows: list[RawRow] = []
    warnings: list[str] = []
    seen_data = False
    last_data_top: float | None = None

    for line_index, line in enumerate(lines[header_index + 1 :], start=header_index + 2):
        cells = _assign_words_to_anchors(line.words, anchors, amount_edges)
        source_row = line_index
        if _is_section_end(line.words):
            break
        if _is_repeated_header(cells, headers):
            warnings.append(f"第 {source_row} 行重复表头，已忽略")
            continue
        if _is_summary_row(cells):
            warnings.append(f"第 {source_row} 行疑似合计行，已忽略")
            break
        if _is_page_number(cells):
            continue
        if _is_opening_balance(cells):
            continue
        if not _looks_like_data_row(cells):
            continuation_index = _continuation_column(cells)
            if (
                seen_data
                and continuation_index is not None
                and last_data_top is not None
                and line.top - last_data_top <= 60
            ):
                previous = parsed_rows[-1].cells[continuation_index]
                parsed_rows[-1].cells[continuation_index] = _clean_text(
                    f"{previous or ''} {cells[continuation_index] or ''}"
                )
            continue
        seen_data = True
        parsed_rows.append(RawRow(cells=cells, page=page_number, row=source_row))
        last_data_top = line.top

    if not parsed_rows:
        return []
    return [RawTable(page_number, page_number, headers, parsed_rows, warnings)]


def _group_words_into_lines(words: list[dict[str, object]]) -> list[_WordLine]:
    lines: list[_WordLine] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        top = float(word["top"])
        if not lines or abs(top - lines[-1].top) > ROW_Y_TOLERANCE:
            lines.append(_WordLine(words=[word], top=top))
        else:
            lines[-1].words.append(word)
    return lines


def _is_coordinate_header(lines: list[_WordLine], index: int) -> bool:
    cells = _cluster_words(lines[index].words)
    if len(cells) < 3 or not _is_statement_header([str(cell["text"]) for cell in cells]):
        return False
    following = lines[index + 1 : index + 7]
    return any(
        _looks_like_data_row([str(word["text"]) for word in line.words])
        for line in following
    )


def _cluster_words(words: list[dict[str, object]]) -> list[dict[str, object]]:
    ordered = sorted(words, key=lambda item: float(item["x0"]))
    if not ordered:
        return []

    clusters: list[list[dict[str, object]]] = [[ordered[0]]]
    for word in ordered[1:]:
        previous = clusters[-1][-1]
        gap = float(word["x0"]) - float(previous["x1"])
        if gap <= HEADER_CELL_GAP:
            clusters[-1].append(word)
        else:
            clusters.append([word])

    result: list[dict[str, object]] = []
    for cluster in clusters:
        x0 = float(cluster[0]["x0"])
        x1 = float(cluster[-1]["x1"])
        result.append(
            {
                "text": _clean_text(" ".join(str(word["text"]) for word in cluster)),
                "x0": x0,
                "x1": x1,
            }
        )
    return result


def _assign_words_to_anchors(
    words: list[dict[str, object]],
    anchors: list[float],
    amount_edges: dict[int, float],
) -> list[str | None]:
    values: list[list[str]] = [[] for _ in anchors]
    for word in sorted(words, key=lambda item: float(item["x0"])):
        text = str(word["text"])
        if amount_edges and MONEY_PATTERN.fullmatch(text) and not DATE_PATTERN.fullmatch(text):
            column = min(amount_edges, key=lambda index: abs(float(word["x1"]) - amount_edges[index]))
            if abs(float(word["x1"]) - amount_edges[column]) <= 45:
                values[column].append(text)
                continue
        start = float(word["x0"])
        column = max(
            (index for index, anchor in enumerate(anchors) if anchor <= start + 3),
            default=0,
        )
        values[column].append(text)
    return [_clean_text(" ".join(value)) if value else None for value in values]


def _select_header_index(rows: list[list[str | None]]) -> int | None:
    candidates = [
        (index, _header_score(row))
        for index, row in enumerate(rows[:-1])
        if sum(cell is not None for cell in row) >= 2
    ]
    if not candidates:
        return None
    best_index, best_score = max(candidates, key=lambda candidate: candidate[1])
    return best_index if best_score >= 2 else None


def _header_score(row: list[str | None]) -> int:
    text = " ".join(cell or "" for cell in row)
    normalized = _normalize_for_match(text)
    return sum(term in normalized for term in HEADER_TERMS)


def _ensure_header_labels(row: list[str | None]) -> list[str]:
    labels: list[str] = []
    for index, cell in enumerate(row):
        label = cell or f"未命名列 {index + 1}"
        labels.append(label)
    return labels


def _is_repeated_header(row: list[str | None], headers: list[str]) -> bool:
    normalized_row = [_normalize_for_match(cell or "") for cell in row]
    normalized_headers = [_normalize_for_match(header) for header in headers]
    return normalized_row == normalized_headers


def _is_summary_row(row: list[str | None]) -> bool:
    text = _normalize_for_match(" ".join(cell or "" for cell in row))
    return any(term in text for term in SUMMARY_TERMS)


def _find_data_start(rows: list[list[str | None]], start: int) -> int | None:
    for index in range(start, len(rows)):
        if _looks_like_data_row(rows[index]):
            return index
    return None


def _looks_like_data_row(row: list[str | None]) -> bool:
    return any(DATE_PATTERN.match(cell.strip()) for cell in row if cell)


def _is_statement_header(row: list[str | None]) -> bool:
    text = _normalize_for_match(" ".join(cell or "" for cell in row))
    has_date = any(term in text for term in ("日期", "时间", "date", "time", "datum", "wertstellung"))
    has_description = any(
        term in text
        for term in ("摘要", "description", "transaction", "buchung", "jahreskontoauszug")
    )
    has_amounts = (
        "余额" in text
        or "balance" in text
        or "amount" in text
        or ("debit" in text and "credit" in text)
        or ("withdrawal" in text and "deposit" in text)
        or ("lastschrift" in text and "gutschrift" in text)
    )
    return has_date and has_description and has_amounts


def _is_amount_header(label: str) -> bool:
    text = label.lower()
    return any(
        term in text
        for term in (
            "金额", "余额", "amount", "balance", "debit", "credit",
            "withdrawal", "deposit", "betrag", "saldo", "lastschrift", "gutschrift",
        )
    )


def _is_opening_balance(row: list[str | None]) -> bool:
    text = " ".join(cell or "" for cell in row).lower()
    return any(term in text for term in OPENING_BALANCE_TERMS)


def _is_section_end(words: list[dict[str, object]]) -> bool:
    text = _normalize_for_match(" ".join(str(word["text"]) for word in words))
    return any(text.startswith(term.replace(" ", "")) for term in SECTION_END_TERMS)


def _continuation_column(cells: list[str | None]) -> int | None:
    """Return the only populated non-date column on a wrapped transaction line."""

    populated = [index for index, cell in enumerate(cells) if cell]
    if len(populated) != 1:
        return None
    index = populated[0]
    cell = cells[index]
    if cell is None or DATE_PATTERN.match(cell.strip()) or index < 2:
        return None
    return index


def _requires_coordinate_rebuild(headers: list[str], rows: list[RawRow]) -> bool:
    """Reject collapsed date/currency columns produced by text table detection."""

    first_data_cell = next((row.cells[0] for row in rows if row.cells and row.cells[0]), "")
    if not first_data_cell:
        return False
    has_date_and_currency = bool(
        re.match(r"^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+[A-Z]{3}$", first_data_cell)
    )
    first_header = headers[0] if headers else ""
    return has_date_and_currency and ("日期" in first_header or "date" in first_header.lower())


def _is_page_number(row: list[str | None]) -> bool:
    populated = [cell for cell in row if cell]
    if len(populated) != 1:
        return False
    text = populated[0]
    return bool(re.fullmatch(r"\d+\s*/\s*\d+", text.strip()))


def _same_headers(left: list[str], right: list[str]) -> bool:
    return [_normalize_for_match(item) for item in left] == [
        _normalize_for_match(item) for item in right
    ]


def _clean_cell(value: object) -> str | None:
    if value is None:
        return None
    text = _clean_text(str(value))
    return text or None


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _normalize_for_match(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()
