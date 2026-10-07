"""In-memory PDF validation and text extraction helpers."""

from __future__ import annotations

from collections import Counter, defaultdict
from io import BytesIO
from math import atan2, degrees
from typing import Any

import pdfplumber


MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_PAGE_COUNT = 50


class ParserError(Exception):
    """A parser error identified by a stable code."""

    def __init__(self, code: str, status_code: int, page: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code
        self.page = page

    def __reduce__(self) -> tuple[object, tuple[str, int, int | None]]:
        return type(self), (self.code, self.status_code, self.page)


def validate_pdf_input(data: bytes, filename: str) -> None:
    """Validate size, filename, and the PDF signature before opening the file."""

    if len(data) > MAX_FILE_BYTES:
        raise ParserError("FILE_TOO_LARGE", 413)

    if not filename.lower().endswith(".pdf"):
        raise ParserError("INVALID_FILE_TYPE", 400)

    if not data.startswith(b"%PDF-"):
        raise ParserError("INVALID_PDF", 400)


def open_text_pdf(data: bytes) -> Any:
    """Open a validated PDF and apply page and encryption constraints."""

    try:
        pdf = pdfplumber.open(BytesIO(data))
    except Exception as exc:
        message = str(exc).lower()
        if "password" in message or "encrypt" in message:
            raise ParserError(
                "PASSWORD_PROTECTED_PDF",
                400,
            ) from exc
        raise ParserError("INVALID_PDF", 400) from exc

    try:
        if len(pdf.pages) > MAX_PAGE_COUNT:
            raise ParserError("TOO_MANY_PAGES", 413)

        document = getattr(pdf, "doc", None)
        if document is not None and getattr(document, "is_extractable", True) is False:
            raise ParserError(
                "PASSWORD_PROTECTED_PDF",
                400,
            )
    except Exception:
        pdf.close()
        raise

    return pdf


def extract_page_words(page: Any) -> list[dict[str, object]]:
    """Extract non-empty words and their coordinates from one text PDF page."""

    page = filter_watermark_page(page)
    try:
        words = page.extract_words(
            x_tolerance=3,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
            extra_attrs=["size"],
        )
    except Exception as exc:
        raise ParserError("PARSE_FAILED", 500) from exc

    extracted: list[dict[str, object]] = []
    for word in words:
        text = str(word.get("text", "")).strip()
        if not text:
            continue
        extracted.append(
            {
                "text": text,
                "x0": float(word.get("x0", 0)),
                "x1": float(word.get("x1", 0)),
                "top": float(word.get("top", 0)),
                "bottom": float(word.get("bottom", 0)),
            }
        )
    return extracted


def page_contains_watermark(page: Any) -> bool:
    """Return whether repeated overlay-like glyphs are present on the page."""

    return bool(_detect_watermark_char_keys(page))


def filter_watermark_page(page: Any) -> Any:
    """Return a pdfplumber page with detected watermark glyphs removed."""

    watermark_keys = _detect_watermark_char_keys(page)
    if not watermark_keys:
        return page
    return page.filter(lambda obj: _char_key(obj) not in watermark_keys)


def _detect_watermark_char_keys(page: Any) -> set[tuple[object, ...]]:
    chars = [char for char in getattr(page, "chars", []) if str(char.get("text", ""))]
    if not chars:
        return set()

    body_size = _most_common_font_size(chars)
    groups: defaultdict[tuple[str, float, float], list[dict[str, object]]] = defaultdict(list)
    for char in chars:
        groups[_watermark_style_key(char)].append(char)

    watermark_keys: set[tuple[object, ...]] = set()
    min_group_size = max(8, int(len(chars) * 0.005))
    page_width = float(getattr(page, "width", 0))
    page_height = float(getattr(page, "height", 0))
    for (font_name, font_size, angle), group in groups.items():
        if len(group) < min_group_size:
            continue

        x_values = [float(char["x0"]) for char in group]
        x_end_values = [float(char["x1"]) for char in group]
        top_values = [float(char["top"]) for char in group]
        bottom_values = [float(char["bottom"]) for char in group]
        width = max(x_end_values) - min(x_values)
        height = max(bottom_values) - min(top_values)
        spans_page = width >= page_width * 0.25 and height >= page_height * 0.15
        is_rotated_overlay = abs(angle) >= 8 and spans_page
        is_large_overlay = (
            font_size >= body_size * 1.8
            and width >= page_width * 0.25
            and height >= page_height * 0.08
        )
        if is_rotated_overlay or is_large_overlay:
            watermark_keys.update(_char_key(char) for char in group)

    return watermark_keys


def _char_key(char: dict[str, object]) -> tuple[object, ...]:
    return (
        str(char.get("text", "")),
        str(char.get("fontname", "")),
        round(float(char.get("size", 0)), 3),
        round(float(char.get("x0", 0)), 3),
        round(float(char.get("top", 0)), 3),
    )


def _watermark_style_key(char: dict[str, object]) -> tuple[str, float, float]:
    matrix = char.get("matrix", (1, 0, 0, 1, 0, 0))
    angle = degrees(atan2(float(matrix[1]), float(matrix[0])))
    while angle > 90:
        angle -= 180
    while angle < -90:
        angle += 180
    return (
        str(char.get("fontname", "")),
        round(float(char.get("size", 0)), 1),
        round(angle, 1),
    )


def _most_common_font_size(chars: list[dict[str, object]]) -> float:
    sizes = Counter(round(float(char.get("size", 0)), 1) for char in chars)
    return sizes.most_common(1)[0][0] if sizes else 1.0
