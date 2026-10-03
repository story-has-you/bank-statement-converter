"""In-memory PDF validation and text extraction helpers."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pdfplumber


MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_PAGE_COUNT = 50


class ParserError(Exception):
    """A safe, user-facing parser error."""

    def __init__(self, code: str, message: str, status_code: int, page: int | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.page = page


def validate_pdf_input(data: bytes, filename: str) -> None:
    """Validate size, filename, and the PDF signature before opening the file."""

    if len(data) > MAX_FILE_BYTES:
        raise ParserError("FILE_TOO_LARGE", "PDF 文件不能超过 20 MB", 413)

    if not filename.lower().endswith(".pdf"):
        raise ParserError("INVALID_FILE_TYPE", "只支持 PDF 文件", 400)

    if not data.startswith(b"%PDF-"):
        raise ParserError("INVALID_PDF", "文件不是有效的 PDF", 400)


def open_text_pdf(data: bytes) -> Any:
    """Open a validated PDF and apply page and encryption constraints."""

    try:
        pdf = pdfplumber.open(BytesIO(data))
    except Exception as exc:
        message = str(exc).lower()
        if "password" in message or "encrypt" in message:
            raise ParserError(
                "PASSWORD_PROTECTED_PDF",
                "不支持需要密码的 PDF",
                400,
            ) from exc
        raise ParserError("INVALID_PDF", "无法读取 PDF 文件", 400) from exc

    try:
        if len(pdf.pages) > MAX_PAGE_COUNT:
            raise ParserError("TOO_MANY_PAGES", "PDF 不能超过 50 页", 413)

        document = getattr(pdf, "doc", None)
        if document is not None and getattr(document, "is_extractable", True) is False:
            raise ParserError(
                "PASSWORD_PROTECTED_PDF",
                "PDF 禁止文本提取或需要密码",
                400,
            )
    except Exception:
        pdf.close()
        raise

    return pdf


def extract_page_words(page: Any) -> list[dict[str, object]]:
    """Extract non-empty words and their coordinates from one text PDF page."""

    try:
        words = page.extract_words(
            x_tolerance=3,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
        )
    except Exception as exc:
        raise ParserError("PARSE_FAILED", "无法提取 PDF 页面文字", 500) from exc

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
