"""Public JSON models returned by the parser service."""

from enum import StrEnum

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    index: int = Field(ge=0)


class SourceLocation(ParserModel):
    page: int = Field(ge=1)
    row: int = Field(ge=1)


class ParseIssue(ParserModel):
    code: str
    params: dict[str, int | str] = Field(default_factory=dict)


class ParsedRow(ParserModel):
    values: dict[str, str | None]
    source: SourceLocation
    status: RowStatus
    warnings: list[ParseIssue] = Field(default_factory=list)


class ParsedTable(ParserModel):
    id: str
    page_start: int = Field(alias="pageStart")
    page_end: int = Field(alias="pageEnd")
    columns: list[ColumnModel]
    rows: list[ParsedRow]
    warnings: list[ParseIssue] = Field(default_factory=list)


class ParseSummary(ParserModel):
    status: SummaryStatus
    table_count: int = Field(alias="tableCount", ge=0)
    row_count: int = Field(alias="rowCount", ge=0)
    valid_row_count: int = Field(alias="validRowCount", ge=0)
    warning_row_count: int = Field(alias="warningRowCount", ge=0)
    failed_row_count: int = Field(alias="failedRowCount", ge=0)


class ParseError(ParserModel):
    code: str
    page: int | None = Field(default=None, ge=1)


class ParseResponse(ParserModel):
    schema_version: Literal["1"] = Field(default="1", alias="schemaVersion")
    filename: str
    page_count: int = Field(alias="pageCount", ge=1)
    tables: list[ParsedTable]
    summary: ParseSummary
    errors: list[ParseError] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_contract(self) -> "ParseResponse":
        if self.summary.table_count != len(self.tables):
            raise ValueError("summary table count does not match tables")
        rows = [row for table in self.tables for row in table.rows]
        if self.summary.row_count != len(rows):
            raise ValueError("summary row count does not match rows")
        if self.summary.valid_row_count != sum(row.status is RowStatus.VALID for row in rows):
            raise ValueError("summary valid row count does not match rows")
        if self.summary.warning_row_count != sum(row.status is RowStatus.WARNING for row in rows):
            raise ValueError("summary warning row count does not match rows")
        if self.summary.failed_row_count != sum(row.status is RowStatus.FAILED for row in rows):
            raise ValueError("summary failed row count does not match rows")
        for table in self.tables:
            if table.page_start < 1 or table.page_end < table.page_start or table.page_end > self.page_count:
                raise ValueError("table page range is invalid")
            keys = [column.key for column in table.columns]
            if len(keys) != len(set(keys)):
                raise ValueError("table column keys must be unique")
            for row in table.rows:
                if row.source.page < table.page_start or row.source.page > table.page_end:
                    raise ValueError("row source page is outside table range")
        return self


class ErrorResponse(ParserModel):
    code: str
