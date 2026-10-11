"""Prepare per-page text or images for the Next.js model fallback."""

from __future__ import annotations

import base64
from io import BytesIO
from typing import Literal

import pypdfium2 as pdfium
from pydantic import Field

from .config import MAX_PAGE_COUNT
from .models import ParserModel
from .pdf_reader import ParserError, filter_watermark_page, open_text_pdf, validate_pdf_input

MAX_MODEL_INPUT_BYTES = 48 * 1024 * 1024


class TextPage(ParserModel):
    page: int = Field(ge=1)
    type: Literal["text"] = "text"
    text: str


class ImagePage(ParserModel):
    page: int = Field(ge=1)
    type: Literal["image"] = "image"
    mime_type: Literal["image/jpeg"] = Field(default="image/jpeg", alias="mimeType")
    data: str


class ModelInputResponse(ParserModel):
    schema_version: Literal["1"] = Field(default="1", alias="schemaVersion")
    page_count: int = Field(alias="pageCount", ge=1, le=MAX_PAGE_COUNT)
    pages: list[TextPage | ImagePage]


def prepare_model_input(data: bytes, filename: str) -> ModelInputResponse:
    """Count original pages and prepare every page, without retaining files."""

    validate_pdf_input(data, filename)
    pages: list[TextPage | ImagePage] = []
    rendered_pdf = None
    input_bytes = 0
    try:
        with open_text_pdf(data) as pdf:
            page_count = len(pdf.pages)
            if page_count == 0:
                raise ParserError("INVALID_PDF", 400)
            for number, page in enumerate(pdf.pages, start=1):
                text = _page_text(page, number)
                if text is not None:
                    prepared = TextPage(page=number, text=text)
                else:
                    if rendered_pdf is None:
                        rendered_pdf = pdfium.PdfDocument(data)
                        if len(rendered_pdf) != page_count:
                            raise ParserError("MODEL_INPUT_PREPARATION_FAILED", 422)
                    prepared = ImagePage(page=number, data=_page_image(rendered_pdf, number - 1))
                input_bytes += len(prepared.model_dump_json(by_alias=True).encode("utf-8"))
                if input_bytes > MAX_MODEL_INPUT_BYTES:
                    raise ParserError("MODEL_INPUT_TOO_LARGE", 413)
                pages.append(prepared)
            result = ModelInputResponse(pageCount=page_count, pages=pages)
            if len(result.model_dump_json(by_alias=True).encode("utf-8")) > MAX_MODEL_INPUT_BYTES:
                raise ParserError("MODEL_INPUT_TOO_LARGE", 413)
            return result
    except ParserError:
        raise
    except Exception as exc:
        raise ParserError("MODEL_INPUT_PREPARATION_FAILED", 422) from exc
    finally:
        if rendered_pdf is not None:
            rendered_pdf.close()


def _page_text(page, number: int) -> str | None:
    """Sparse or image-dominated pages require visual input, including blank pages."""

    try:
        area = float(page.width) * float(page.height)
        if any(float(image["width"]) * float(image["height"]) >= area / 2 for image in page.images):
            return None
        text = filter_watermark_page(page).extract_text(layout=True) or ""
        if sum(character.isalnum() for character in text) < 40:
            return None
        lines = [line.rstrip() for line in text.splitlines() if line.strip()]
        return f"Original PDF page {number}\n" + "\n".join(
            f"[{index}] {line}" for index, line in enumerate(lines, start=1)
        )
    except Exception:
        return None


def _page_image(document, index: int) -> str:
    page = document[index]
    bitmap = None
    image = None
    rgb = None
    try:
        width, height = page.get_size()
        scale = min(150 / 72, 2400 / max(width, height))
        bitmap = page.render(scale=scale, fill_color=(255, 255, 255, 255))
        image = bitmap.to_pil()
        rgb = image.convert("RGB")
        with BytesIO() as buffer:
            rgb.save(buffer, format="JPEG", quality=90)
            return base64.b64encode(buffer.getvalue()).decode("ascii")
    finally:
        if rgb is not None:
            rgb.close()
        if image is not None:
            image.close()
        if bitmap is not None:
            bitmap.close()
        page.close()
