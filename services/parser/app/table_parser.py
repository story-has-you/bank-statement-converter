"""Generic table extraction for text-based bank statement PDFs."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any

from pdfplumber.utils import objects_to_bbox

from .models import ParseError, ParseIssue
from .pdf_reader import filter_watermark_page
from .row_validation import (
    is_amount_column,
    is_amount_value,
    is_balance_column,
    is_date_column,
    is_description_column,
    is_transaction_candidate,
)


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
SUMMARY_LABELS = frozenset(
    re.sub(r"\s+", "", term).lower()
    for term in (
        *SUMMARY_TERMS,
        "total withdrawals",
        "total deposits",
        "total debits",
        "total credits",
        "total transactions",
    )
)
DATE_HEADER_TERMS = ("日期", "时间", "date", "time", "datum", "wertstellung")
DATE_PATTERN = re.compile(
    r"^(?:\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)\b"
)
MONEY_PATTERN = re.compile(
    r"^(?:[€$£]?\(?[+-]?\d[\d.,]*[.,]\d{2}\)?|\([€$£]?[+-]?\d[\d.,]*[.,]\d{2}[€$£]?\))$",
    re.ASCII,
)
OPENING_BALANCE_TERMS = ("previous balance", "opening balance", "saldovortrag", "anfangssaldo")
OPENING_BALANCE_LABELS = frozenset(
    re.sub(r"\s+", "", term).lower() for term in OPENING_BALANCE_TERMS
)
SECTION_END_TERMS = ("checks", "daily balance summary", "fees", "interest charged")
ROW_Y_TOLERANCE = 3.0
HEADER_CELL_GAP = 6.0


@dataclass
class RawRow:
    """A row before it is converted into the public Pydantic model."""

    cells: list[str | None]
    page: int
    row: int
    warnings: list[ParseIssue] = field(default_factory=list)
    failed: bool = False


@dataclass
class RawTable:
    """A table with a single header and raw rows."""

    page_start: int
    page_end: int
    headers: list[str]
    rows: list[RawRow]
    bbox: tuple[float, float, float, float]
    warnings: list[ParseIssue] = field(default_factory=list)


@dataclass
class _WordLine:
    words: list[dict[str, object]]
    top: float


def extract_page_tables(
    page: Any,
    page_number: int,
    words: list[dict[str, object]],
) -> tuple[list[RawTable], list[ParseError]]:
    """Keep bordered tables and reconstruct the remaining page text."""

    page = filter_watermark_page(page)
    lines = _group_words_into_lines(words)
    tables = _extract_pdfplumber_tables(page, page_number, lines)
    covered = [table.bbox for table in tables]
    # Keep empty line slots so removing a grid does not renumber page sources.
    remaining_lines = [
        _WordLine(
            words=[
                word for word in line.words
                if not any(_word_in_bbox(word, bbox) for bbox in covered)
            ],
            top=line.top,
        )
        for line in lines
    ]
    tables.extend(_rebuild_tables_from_lines(remaining_lines, page_number))
    tables.sort(key=lambda table: (table.bbox[1], table.bbox[0]))

    uncovered = [word for line in remaining_lines for word in line.words]
    errors = []
    if page_contains_transaction_evidence(uncovered):
        errors.append(ParseError(code="PAGE_UNPARSED", page=page_number))
    return tables, errors


def _word_in_bbox(
    word: dict[str, object], bbox: tuple[float, float, float, float]
) -> bool:
    x = (float(word["x0"]) + float(word["x1"])) / 2
    y = (float(word["top"]) + float(word["bottom"])) / 2
    return bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]


def page_contains_transaction_evidence(words: list[dict[str, object]]) -> bool:
    """Detect unparsed transaction rows without combining unrelated page text."""

    for line in _group_words_into_lines(words):
        texts = [str(word["text"]).strip() for word in line.words]
        has_date = any(
            DATE_PATTERN.match(text) and not MONEY_PATTERN.fullmatch(text)
            for text in texts
        )
        if has_date and any(MONEY_PATTERN.fullmatch(text) for text in texts):
            return True
    return False


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


def _extract_pdfplumber_tables(
    page: Any,
    page_number: int,
    lines: list[_WordLine],
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
        source_rows = [
            sum(line.top < row.bbox[1] for line in lines) + 1
            for row in table.rows
        ]
        parsed = _raw_table_from_rows(rows, page_number, table.bbox, source_rows)
        if parsed is not None:
            extracted.append(parsed)
    return extracted


def _raw_table_from_rows(
    rows: list[list[object]],
    page_number: int,
    bbox: tuple[float, float, float, float],
    source_rows: list[int],
) -> RawTable | None:
    cleaned_rows = [[_clean_cell(cell) for cell in row] for row in rows]
    source_rows = [
        source for cells, source in zip(cleaned_rows, source_rows)
        if any(cell is not None for cell in cells)
    ]
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
        if cell in (None, "*") and all(
            index >= len(row) or row[index] is None
            for row in cleaned_rows[header_index + 1 :]
        ):
            continue
        kept_columns.append(index)
    if len(kept_columns) < 3:
        return None
    cleaned_rows = [
        [row[index] if index < len(row) else None for index in kept_columns]
        for row in cleaned_rows
    ]
    headers = _ensure_header_labels(cleaned_rows[header_index])
    data_start = _find_data_start(cleaned_rows, header_index + 1, headers)
    if data_start is None:
        return None
    parsed_rows: list[RawRow] = []
    table_warnings: list[ParseIssue] = []
    for offset, cells in enumerate(cleaned_rows[data_start:], start=data_start + 1):
        source_row = source_rows[offset - 1]
        if _is_repeated_header(cells, headers):
            table_warnings.append(ParseIssue(code="REPEATED_HEADER", params={"row": source_row}))
            continue
        if _is_summary_row(cells, headers):
            table_warnings.append(ParseIssue(code="SUMMARY_ROW", params={"row": source_row}))
            continue
        if _is_opening_balance(cells, headers):
            continue
        if not _is_data_candidate(headers, cells):
            continuation_index = _continuation_column(cells, headers)
            if parsed_rows and continuation_index is not None:
                previous = parsed_rows[-1].cells[continuation_index]
                parsed_rows[-1].cells[continuation_index] = _clean_text(
                    f"{previous or ''} {cells[continuation_index] or ''}"
                )
                continue
            if _looks_like_unverifiable_row(cells):
                parsed_rows.append(
                    RawRow(
                        cells=cells,
                        page=page_number,
                        row=source_row,
                        warnings=[ParseIssue(code="UNVERIFIABLE_ROW")],
                        failed=True,
                    )
                )
                continue
            break
        parsed_rows.append(RawRow(cells=cells, page=page_number, row=source_row))

    if not parsed_rows:
        return None
    if _requires_coordinate_rebuild(headers, parsed_rows):
        return None
    return RawTable(page_number, page_number, headers, parsed_rows, bbox, table_warnings)


def _rebuild_tables_from_lines(
    lines: list[_WordLine],
    page_number: int,
) -> list[RawTable]:
    """Reconstruct tables and remove only the lines they actually consumed."""

    if len(lines) < 2:
        return []

    header_indexes = [
        index for index in range(len(lines) - 1) if _is_coordinate_header(lines, index)
    ]
    boundaries = [*header_indexes, len(lines)]
    tables: list[RawTable] = []
    for header_index, end_index in zip(boundaries, boundaries[1:]):
        table = _rebuild_table_segment(lines, header_index, end_index, page_number)
        if table is None:
            continue
        if tables and _same_headers(tables[-1].headers, table.headers):
            tables[-1].warnings.append(
                ParseIssue(code="REPEATED_HEADER", params={"row": header_index + 1})
            )
        tables.append(table)
    return tables


def _rebuild_table_segment(
    lines: list[_WordLine],
    header_index: int,
    end_index: int,
    page_number: int,
) -> RawTable | None:
    """Reconstruct rows with the anchors from this segment's own header."""

    header_cells = _cluster_words(lines[header_index].words)
    headers = _ensure_header_labels([str(cell["text"]) for cell in header_cells])
    anchors = [float(cell["x0"]) for cell in header_cells]
    amount_edges = {
        index: float(cell["x1"])
        for index, cell in enumerate(header_cells)
        if _is_amount_header(headers[index])
    }
    parsed_rows: list[RawRow] = []
    warnings: list[ParseIssue] = []
    covered_lines = [header_index]
    seen_data = False
    last_data_top: float | None = None

    for line_index, line in enumerate(
        lines[header_index + 1 : end_index], start=header_index + 2
    ):
        cells = _assign_words_to_anchors(line.words, anchors, amount_edges)
        source_row = line_index
        if _is_section_end(line.words):
            break
        if _is_repeated_header(cells, headers):
            warnings.append(ParseIssue(code="REPEATED_HEADER", params={"row": source_row}))
        elif _is_summary_row(cells, headers):
            warnings.append(ParseIssue(code="SUMMARY_ROW", params={"row": source_row}))
        elif _is_page_number(cells) or _is_opening_balance(cells, headers):
            pass
        elif not _is_data_candidate(headers, cells):
            continuation_index = _continuation_column(cells, headers)
            if not (
                seen_data
                and continuation_index is not None
                and last_data_top is not None
                and line.top - last_data_top <= 60
            ):
                continue
            previous = parsed_rows[-1].cells[continuation_index]
            parsed_rows[-1].cells[continuation_index] = _clean_text(
                f"{previous or ''} {cells[continuation_index] or ''}"
            )
        else:
            seen_data = True
            parsed_rows.append(RawRow(cells=cells, page=page_number, row=source_row))
            last_data_top = line.top
        covered_lines.append(line_index - 1)

    if not parsed_rows:
        return None
    table_words = [word for index in covered_lines for word in lines[index].words]
    table = RawTable(
        page_number, page_number, headers, parsed_rows, objects_to_bbox(table_words), warnings
    )
    for index in covered_lines:
        lines[index].words = []
    return table


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
    headers = [str(cell["text"]) for cell in cells]
    if len(cells) < 3 or not _is_statement_header(headers):
        return False
    anchors = [float(cell["x0"]) for cell in cells]
    amount_edges = {
        column: float(cell["x1"])
        for column, cell in enumerate(cells)
        if _is_amount_header(headers[column])
    }
    following = lines[index + 1 : index + 7]
    for line in following:
        row = _assign_words_to_anchors(line.words, anchors, amount_edges)
        if _is_summary_row(row, headers) or _is_opening_balance(row, headers):
            continue
        if _is_data_candidate(headers, row):
            return True
    return False


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
        if amount_edges and MONEY_PATTERN.fullmatch(text):
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
    return [cell or "" for cell in row]


def _is_repeated_header(row: list[str | None], headers: list[str]) -> bool:
    normalized_row = [_normalize_for_match(cell or "") for cell in row]
    normalized_headers = [_normalize_for_match(header) for header in headers]
    return normalized_row == normalized_headers


def _is_summary_row(row: list[str | None], headers: list[str]) -> bool:
    date_indexes = [
        index
        for index, header in enumerate(headers)
        if any(term in _normalize_for_match(header) for term in DATE_HEADER_TERMS)
    ]
    if any(
        index < len(row)
        and row[index]
        and DATE_PATTERN.match(row[index].strip())
        for index in date_indexes
    ):
        return False

    return any(
        cell and _normalize_for_match(cell) in SUMMARY_LABELS
        for index, cell in enumerate(row)
        if index not in date_indexes
    )


def _find_data_start(
    rows: list[list[str | None]], start: int, headers: list[str]
) -> int | None:
    for index in range(start, len(rows)):
        if _is_summary_row(rows[index], headers) or _is_opening_balance(rows[index], headers):
            continue
        if _is_data_candidate(headers, rows[index]):
            return index
    return None


def _is_statement_header(row: list[str | None]) -> bool:
    text = _normalize_for_match(" ".join(cell or "" for cell in row))
    has_date = any(term in text for term in ("日期", "时间", "date", "time", "datum", "wertstellung"))
    has_description = any(
        term in text
        for term in ("摘要", "交易名称", "description", "transaction", "buchung", "jahreskontoauszug")
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


def _is_opening_balance(row: list[str | None], headers: list[str]) -> bool:
    """Skip only standalone opening labels backed by a balance-only value."""

    has_label = False
    has_balance = False
    for index, cell in enumerate(row):
        if not cell:
            continue
        if is_amount_column(headers, index):
            return False
        if is_balance_column(headers, index):
            if not is_amount_value(cell):
                return False
            has_balance = True
        elif (
            (is_date_column(headers, index) or is_description_column(headers, index))
            and _normalize_for_match(cell) in OPENING_BALANCE_LABELS
        ):
            has_label = True
        else:
            return False
    return has_label and has_balance


def _is_data_candidate(headers: list[str], cells: list[str | None]) -> bool:
    """Keep uncertain opening-balance rows for the existing evidence validation."""

    if is_transaction_candidate(headers, cells):
        return True
    text = _normalize_for_match(" ".join(cell or "" for cell in cells))
    return any(term in text for term in OPENING_BALANCE_LABELS) and any(
        cell and not is_date_column(headers, index) and is_amount_value(cell)
        for index, cell in enumerate(cells)
    )


def _is_section_end(words: list[dict[str, object]]) -> bool:
    text = _normalize_for_match(" ".join(str(word["text"]) for word in words))
    return any(text.startswith(term.replace(" ", "")) for term in SECTION_END_TERMS)


def _continuation_column(cells: list[str | None], headers: list[str]) -> int | None:
    """Return the description column when a row contains only wrapped text."""

    populated = [index for index, cell in enumerate(cells) if cell]
    if len(populated) != 1:
        return None
    index = populated[0]
    cell = cells[index]
    if cell is None or is_date_column(headers, index):
        return None
    header = _normalize_for_match(headers[index]) if index < len(headers) else ""
    description_terms = (
        "摘要", "描述", "交易", "对手", "description", "transaction", "counterparty",
        "buchung", "jahreskontoauszug",
    )
    return index if any(term in header for term in description_terms) else None


def _looks_like_unverifiable_row(cells: list[str | None]) -> bool:
    """Keep suspicious text and amount rows instead of silently truncating a table."""

    populated = [cell for cell in cells if cell]
    if len(populated) < 2:
        return False
    return any(MONEY_PATTERN.fullmatch(cell.strip()) for cell in populated)


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
