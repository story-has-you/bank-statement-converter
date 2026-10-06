"""HTTP entry point for the parser service."""

from __future__ import annotations

import logging
import os
import secrets
from typing import Annotated

from fastapi import FastAPI, File, Request, UploadFile
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
async def parse(
    request: Request,
    file: Annotated[UploadFile, File(...)],
) -> ParseResponse | JSONResponse:
    """Parse one uploaded electronic PDF and return dynamic table JSON."""

    auth_error = _authorize_request(request)
    if auth_error is not None:
        return auth_error

    try:
        if file.content_type not in (None, "application/pdf", "application/octet-stream"):
            raise ParserError("INVALID_FILE_TYPE", 400)

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
            ).model_dump(by_alias=True),
        )
    finally:
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
