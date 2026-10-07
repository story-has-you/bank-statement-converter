"""Evidence checks for extracted transaction rows, preserving raw cell text."""
from datetime import date
import re
from .models import ParseIssue

DATE_HEADERS = ("date", "datum", "wertstellung", "日期", "时间")
DESCRIPTION_HEADERS = ("description", "transaction", "buchung", "摘要", "说明", "用途", "memo", "details")
AMOUNT_HEADERS = ("amount", "debit", "credit", "withdrawal", "deposit", "betrag", "lastschrift", "gutschrift", "金额", "借", "贷")
AMOUNT = re.compile(r"^(?:[A-Z]{3}|[€$£¥])?\s*\(?[+-]?\d[\d.,]*(?:\s*(?:[A-Z]{3}|[€$£¥]))?\)?$")


def _valid_date(value: str) -> bool:
    token = value.strip().split()[0] if value.strip() else ""
    if re.fullmatch(r"\d{8}", token):
        parts = [token[:4], token[4:6], token[6:]]
    else:
        parts = re.split(r"[-/.]", token)
    if len(parts) not in (2, 3) or not all(part.isdigit() for part in parts):
        return False
    candidates = []
    if len(parts[0]) == 4 and len(parts) == 3:
        candidates.append(tuple(map(int, parts)))
    else:
        year = int(parts[2]) if len(parts) == 3 else 2000
        if year < 100:
            year += 2000
        candidates.extend([(year, int(parts[0]), int(parts[1])), (year, int(parts[1]), int(parts[0]))])
    for candidate in candidates:
        try:
            date(*candidate)
            return True
        except ValueError:
            pass
    return False


def validate_row(headers: list[str], cells: list[str | None]) -> list[ParseIssue]:
    issues = []
    roles = [(DATE_HEADERS, "MISSING_DATE", _valid_date),
             (DESCRIPTION_HEADERS, "MISSING_DESCRIPTION", lambda value: bool(value.strip())),
             (AMOUNT_HEADERS, "MISSING_AMOUNT", lambda value: bool(AMOUNT.fullmatch(value.strip())))]
    for terms, code, check in roles:
        indexes = [index for index, header in enumerate(headers) if any(term in header.lower() for term in terms)]
        if not any(index < len(cells) and cells[index] and check(cells[index]) for index in indexes):
            issues.append(ParseIssue(code=code))
    return issues
