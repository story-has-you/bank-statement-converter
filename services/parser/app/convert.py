"""Coordinate PDF extraction and dynamic table JSON creation."""

from __future__ import annotations

from .models import (
    ColumnModel,
    ParseError,
    ParseIssue,
    ParseResponse,
    ParseSummary,
    ParsedRow,
    ParsedTable,
    RowStatus,
    SourceLocation,
    SummaryStatus,
)
from .pdf_reader import ParserError, extract_page_words, open_text_pdf, validate_pdf_input
from .row_validation import validate_row
from .table_parser import (
    RawTable,
    extract_page_tables,
    merge_compatible_tables,
    page_contains_transaction_evidence,
)


def parse_statement(data: bytes, filename: str) -> ParseResponse:
    """Parse one electronic PDF into dynamic tables and raw cell values."""

    validate_pdf_input(data, filename)
    with open_text_pdf(data) as pdf:
        page_words: list[list[dict[str, object]]] = []
        raw_tables: list[RawTable] = []
        errors: list[ParseError] = []

        for page_number, page in enumerate(pdf.pages, start=1):
            try:
                words = extract_page_words(page)
            except ParserError:
                errors.append(ParseError(code="PAGE_PARSE_FAILED", page=page_number))
                continue
            page_words.append(words)
            if not words:
                continue
            try:
                page_tables = extract_page_tables(page, page_number)
                raw_tables.extend(page_tables)
                if not page_tables and page_contains_transaction_evidence(words):
                    errors.append(ParseError(code="PAGE_UNPARSED", page=page_number))
            except Exception:
                errors.append(ParseError(code="PAGE_PARSE_FAILED", page=page_number))

        if not any(page_words):
            raise ParserError(
                "UNSUPPORTED_SCANNED_PDF",
                400,
            )

        tables = merge_compatible_tables(raw_tables)
        if not tables:
            raise ParserError(
                "TABLE_NOT_FOUND",
                422,
            )

        parsed_tables = [
            _to_parsed_table(table, index)
            for index, table in enumerate(tables, start=1)
        ]
        summary = _build_summary(parsed_tables)
        if summary.valid_row_count + summary.warning_row_count == 0:
            raise ParserError("NO_VERIFIABLE_TRANSACTIONS", 422)
        if errors and summary.status is SummaryStatus.SUCCESS:
            summary.status = SummaryStatus.PARTIAL
        return ParseResponse(
            filename=filename,
            pageCount=len(pdf.pages),
            tables=parsed_tables,
            summary=summary,
            errors=errors,
        )


def _to_parsed_table(table: RawTable, table_index: int) -> ParsedTable:
    max_width = max([len(table.headers), *(len(row.cells) for row in table.rows)])
    headers = list(table.headers)
    while len(headers) < max_width:
        headers.append(f"extra_{len(headers) - len(table.headers) + 1}")

    columns = [
        ColumnModel(key=f"c{index}", label=label, index=index)
        for index, label in enumerate(headers)
    ]
    parsed_rows: list[ParsedRow] = []
    for raw_row in table.rows:
        values = {
            f"c{index}": raw_row.cells[index] if index < len(raw_row.cells) else None
            for index in range(max_width)
        }
        evidence_issues = validate_row(table.headers, raw_row.cells)
        warnings = [*raw_row.warnings, *evidence_issues]
        if len(raw_row.cells) > len(table.headers):
            warnings.append(ParseIssue(code="EXTRA_CELLS"))
        if raw_row.failed or evidence_issues:
            status = RowStatus.FAILED
        elif warnings:
            status = RowStatus.WARNING
        else:
            status = RowStatus.VALID
        parsed_rows.append(
            ParsedRow(
                values=values,
                source=SourceLocation(page=raw_row.page, row=raw_row.row),
                status=status,
                warnings=warnings,
            )
        )

    return ParsedTable(
        id=f"table-{table_index}",
        pageStart=table.page_start,
        pageEnd=table.page_end,
        columns=columns,
        rows=parsed_rows,
        warnings=table.warnings,
    )


def _build_summary(tables: list[ParsedTable]) -> ParseSummary:
    rows = [row for table in tables for row in table.rows]
    valid_count = sum(row.status is RowStatus.VALID for row in rows)
    warning_count = sum(row.status is RowStatus.WARNING for row in rows)
    failed_count = sum(row.status is RowStatus.FAILED for row in rows)
    status = SummaryStatus.SUCCESS
    if failed_count or warning_count or any(table.warnings for table in tables):
        status = SummaryStatus.PARTIAL
    if not rows:
        status = SummaryStatus.FAILED
    return ParseSummary(
        status=status,
        tableCount=len(tables),
        rowCount=len(rows),
        validRowCount=valid_count,
        warningRowCount=warning_count,
        failedRowCount=failed_count,
    )
