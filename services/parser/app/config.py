"""Shared upload limits used by Next.js and the Python parser."""

import json
from pathlib import Path

_limits = json.loads(Path(__file__).with_name("conversion-limits.json").read_text())
MAX_FILE_BYTES = int(_limits["megabytes"] * 1024 * 1024)
MAX_PAGE_COUNT = int(_limits["pages"])
