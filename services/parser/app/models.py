"""Public JSON models returned by the parser service."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class RowStatus(StrEnum):
    """Status of one extracted table row."""

    VALID = "valid"
    WARNING = "warning"
    FAILED = "failed"


class SummaryStatus(StrEnum):
    """Overall status of a parsed document."""

    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class ParserModel(BaseModel):
    """Base model that accepts Python names and emits API aliases."""

    model_config = ConfigDict(populate_by_name=True)


class ColumnModel(ParserModel):
    key: str
    label: str
    index: int


class SourceLocation(ParserModel):
    page: int
    row: int


class ParsedRow(ParserModel):
    values: dict[str, str | None]
    source: SourceLocation
    status: RowStatus
    warnings: list[str] = Field(default_factory=list)


class ParsedTable(ParserModel):
    id: str
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    columns: list[ColumnModel]
    rows: list[ParsedRow]
    warnings: list[str] = Field(default_factory=list)


class ParseSummary(ParserModel):
    status: SummaryStatus
    table_count: int = Field(alias="tableCount")
    row_count: int = Field(alias="rowCount")
    valid_row_count: int = Field(alias="validRowCount")
    warning_row_count: int = Field(alias="warningRowCount")
    failed_row_count: int = Field(alias="failedRowCount")


class ParseError(ParserModel):
    code: str
    message: str
    page: int | None = None


class ParseResponse(ParserModel):
    schema_version: str = Field(default="1", alias="schemaVersion")
    filename: str
    page_count: int = Field(alias="pageCount")
    tables: list[ParsedTable]
    summary: ParseSummary
    errors: list[ParseError] = Field(default_factory=list)


class ErrorResponse(ParserModel):
    code: str
    message: str
