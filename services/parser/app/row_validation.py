"""Identify transaction evidence in extracted table columns."""

from __future__ import annotations

import re
from datetime import date

from .models import ParseIssue


DATE_HEADERS = ("date", "time", "datum", "wertstellung", "日期", "时间")
DESCRIPTION_HEADERS = (
    "description", "transaction", "buchung", "jahreskontoauszug",
    "摘要", "说明", "用途", "备注", "memo", "details",
)
AMOUNT_HEADERS = (
    "amount", "debit", "credit", "withdrawal", "deposit", "betrag",
    "lastschrift", "gutschrift", "金额", "发生额", "借", "贷", "收入", "支出",
)
BALANCE_HEADERS = ("balance", "saldo", "余额")
DATE_SHAPE = re.compile(
    r"^(?:\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|"
    r"\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)(?:\s|$)"
)
AMOUNT_SHAPE = re.compile(
    r"^(?:(?:[A-Z]{3}|[€$£¥])\s*)?[+-]?"
    r"(?:\d{1,3}(?:[ ,.]\d{3})+|\d+)(?:[,.]\d{1,2})?"
    r"(?:\s*(?:[A-Z]{3}|[€$£¥]))?$"
)


def _indexes(headers: list[str], terms: tuple[str, ...]) -> list[int]:
    return [
        index for index, header in enumerate(headers)
        if any(term in header.lower() for term in terms)
    ]


def _cell(cells: list[str | None], index: int) -> str:
    return (cells[index] or "").strip() if index < len(cells) else ""


def _amount_indexes(headers: list[str]) -> list[int]:
    return [
        index for index in _indexes(headers, AMOUNT_HEADERS)
        if not any(term in headers[index].lower() for term in BALANCE_HEADERS)
    ]


def _description_indexes(headers: list[str]) -> list[int]:
    date_indexes = set(_indexes(headers, DATE_HEADERS))
    amount_indexes = set(_amount_indexes(headers))
    return [
        index for index in _indexes(headers, DESCRIPTION_HEADERS)
        if index not in date_indexes and index not in amount_indexes
    ]


def is_date_column(headers: list[str], index: int) -> bool:
    return index in _indexes(headers, DATE_HEADERS)


def _valid_date(value: str) -> bool:
    token = value.split()[0] if value else ""
    if not DATE_SHAPE.match(value):
        return False
    if re.fullmatch(r"\d{8}", token):
        parts = (int(token[:4]), int(token[4:6]), int(token[6:]))
        try:
            date(*parts)
            return True
        except ValueError:
            return False

    parts = token.replace("-", "/").replace(".", "/").split("/")
    if len(parts) == 2:
        first, second = map(int, parts)
        for month, day in ((first, second), (second, first)):
            try:
                date(2000, month, day)
                return True
            except ValueError:
                continue
        return False

    first, second, third = parts
    candidates = (
        [(int(first), int(second), int(third))]
        if len(first) == 4
        else [(int(third), int(first), int(second)), (int(third), int(second), int(first))]
    )
    for year, month, day in candidates:
        if year < 100:
            year += 2000
        try:
            date(year, month, day)
            return True
        except ValueError:
            continue
    return False


def _valid_amount(value: str) -> bool:
    amount = value.strip()
    if amount.startswith("(") != amount.endswith(")"):
        return False
    if amount.startswith("("):
        amount = amount[1:-1].strip()
    return bool(AMOUNT_SHAPE.fullmatch(amount))


def is_transaction_candidate(headers: list[str], cells: list[str | None]) -> bool:
    """Keep incomplete rows when their table columns still identify a transaction."""

    date_indexes = _indexes(headers, DATE_HEADERS)
    if any(DATE_SHAPE.match(_cell(cells, index)) for index in date_indexes):
        return True

    description_indexes = _description_indexes(headers)
    amount_indexes = _amount_indexes(headers)
    return any(_cell(cells, index) for index in description_indexes) and any(
        _cell(cells, index) for index in amount_indexes
    )


def validate_row(headers: list[str], cells: list[str | None]) -> list[ParseIssue]:
    """Report missing or misplaced date, description, and transaction amount."""

    issues: list[ParseIssue] = []
    date_values = [_cell(cells, index) for index in _indexes(headers, DATE_HEADERS)]
    if not any(_valid_date(value) for value in date_values):
        issues.append(ParseIssue(code="INVALID_DATE" if any(date_values) else "MISSING_DATE"))

    if not any(_cell(cells, index) for index in _description_indexes(headers)):
        issues.append(ParseIssue(code="MISSING_DESCRIPTION"))

    amount_indexes = _amount_indexes(headers)
    amount_values = [_cell(cells, index) for index in amount_indexes]
    if not any(_valid_amount(value) for value in amount_values):
        balance_indexes = set(_indexes(headers, BALANCE_HEADERS))
        date_indexes = set(_indexes(headers, DATE_HEADERS))
        other_amount = any(
            _valid_amount(_cell(cells, index))
            for index in range(len(cells))
            if index not in amount_indexes and index not in balance_indexes
            and index not in date_indexes
        )
        if other_amount:
            code = "AMOUNT_COLUMN_MISMATCH"
        elif any(amount_values):
            code = "INVALID_AMOUNT"
        else:
            code = "MISSING_AMOUNT"
        issues.append(ParseIssue(code=code))
    return issues
