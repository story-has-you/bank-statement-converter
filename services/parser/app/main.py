"""HTTP entry point for the parser service."""

from __future__ import annotations

import logging
import os
import secrets
import anyio.to_process
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .convert import parse_statement
from .models import ErrorResponse, ParseResponse
from .config import MAX_FILE_BYTES
from .pdf_reader import ParserError

app = FastAPI(title="Bank Statement Parser")
logger = logging.getLogger(__name__)
PARSE_CONCURRENCY = max(1, int(os.environ.get("PARSER_MAX_CONCURRENCY", "2")))
parse_limiter = anyio.to_process.CapacityLimiter(PARSE_CONCURRENCY)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse(
    request: Request,
) -> ParseResponse | JSONResponse:
    """Parse one uploaded electronic PDF and return dynamic table JSON."""

    auth_error = _authorize_request(request)
    if auth_error is not None:
        return auth_error

    try:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" not in content_type:
            raise ParserError("INVALID_FILE_TYPE", 400)
        form = await request.form()
        file = form.get("file")
        if not hasattr(file, "read"):
            raise ParserError("INVALID_FILE", 400)
        filename = getattr(file, "filename", None) or "statement.pdf"
        file_type = getattr(file, "content_type", None)
        if file_type not in (None, "application/pdf", "application/octet-stream"):
            raise ParserError("INVALID_FILE_TYPE", 400)

        data = bytearray()
        while True:
            chunk = await file.read(min(256 * 1024, MAX_FILE_BYTES + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > MAX_FILE_BYTES:
                raise ParserError("FILE_TOO_LARGE", 413)
        return await anyio.to_process.run_sync(
            parse_statement,
            bytes(data),
            filename,
            cancellable=True,
            limiter=parse_limiter,
        )
    except ParserError as exc:
        return _error_response(exc)
    except Exception:
        logger.exception("Unexpected parser failure")
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                code="PARSE_FAILED",
            ).model_dump(by_alias=True),
        )
    finally:
        if "file" in locals() and hasattr(file, "close"):
            await file.close()


def _error_response(error: ParserError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content=ErrorResponse(code=error.code).model_dump(by_alias=True),
    )


def _authorize_request(request: Request) -> JSONResponse | None:
    """Require the shared service secret before reading the uploaded file."""

    expected_secret = os.environ.get("PARSER_SHARED_SECRET", "").strip()
    if not expected_secret:
        return JSONResponse(
            status_code=503,
            content=ErrorResponse(
                code="PARSER_AUTH_NOT_CONFIGURED",
            ).model_dump(by_alias=True),
        )

    authorization = request.headers.get("authorization", "")
    scheme, _, supplied_secret = authorization.partition(" ")
    if scheme.lower() != "bearer" or not supplied_secret:
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                code="UNAUTHORIZED",
            ).model_dump(by_alias=True),
        )

    if not secrets.compare_digest(supplied_secret.strip(), expected_secret):
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                code="UNAUTHORIZED",
            ).model_dump(by_alias=True),
        )

    return None
