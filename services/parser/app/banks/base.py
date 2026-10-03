"""Extension protocol for future bank-specific statement parsers."""

from __future__ import annotations

from typing import Any, Protocol

from ..table_parser import RawTable


class BankAdapter(Protocol):
    """Contract for adding a bank-specific parser without changing the API."""

    name: str

    def detect(self, page_words: list[dict[str, object]]) -> float:
        """Return a confidence score between 0 and 1 for one page."""

    def parse(self, pages: list[Any]) -> list[RawTable]:
        """Parse pages that were selected by ``detect``."""
