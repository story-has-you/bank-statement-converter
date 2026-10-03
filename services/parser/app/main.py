"""HTTP entry point for the parser service."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from .convert import parse_statement
from .models import ErrorResponse, ParseResponse
from .pdf_reader import MAX_FILE_BYTES, ParserError

app = FastAPI(title="Bank Statement Parser")
logger = logging.getLogger(__name__)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse(file: Annotated[UploadFile, File(...)]) -> ParseResponse | JSONResponse:
    """Parse one uploaded electronic PDF and return dynamic table JSON."""

    try:
        if file.content_type not in (None, "application/pdf", "application/octet-stream"):
            raise ParserError("INVALID_FILE_TYPE", "只支持 PDF 文件", 400)

        data = await file.read(MAX_FILE_BYTES + 1)
        return parse_statement(data, file.filename or "statement.pdf")
    except ParserError as exc:
        return _error_response(exc)
    except Exception:
        logger.exception("Unexpected parser failure")
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                code="PARSE_FAILED",
                message="PDF 解析失败，请稍后重试",
            ).model_dump(by_alias=True),
        )
    finally:
        await file.close()


def _error_response(error: ParserError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=error.code, message=error.message).model_dump(by_alias=True),
    )
