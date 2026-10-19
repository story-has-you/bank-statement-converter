"""Reproduce the public, local-parser-only sample report. No account or AI calls."""
import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import subprocess
import sys
import urllib.request

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services/parser"))
from app.convert import parse_statement  # noqa: E402

SAMPLES = [
    ("carson", "Carson Bank", "https://www.carsonbank.com/wp-content/uploads/2021/01/Sample-Statement.pdf", [1, 2]),
    ("bhw", "BHW", "https://www.bhw.de/dam/bhwde/pdf/Jahreskontoauszuege_koop_2024.pdf", [12]),
]


def normalize(value):
    return " ".join((value or "").split())


def run(cache_dir):
    reference = json.loads((ROOT / "docs/seo/benchmark/reference.json").read_text())
    revision = subprocess.check_output(["git", "log", "-1", "--format=%H", "--", "services/parser/app"], cwd=ROOT, text=True).strip()
    parser_files = sorted((ROOT / "services/parser/app").rglob("*.py"))
    source_hash = hashlib.sha256(b"".join(str(p.relative_to(ROOT)).encode() + b"\0" + p.read_bytes() for p in parser_files)).hexdigest()
    report = {"schemaVersion": 1, "measuredAt": datetime.now(timezone.utc).isoformat(), "parserRevision": revision, "parserSourceSha256": source_hash, "referenceSha256": hashlib.sha256((ROOT / "docs/seo/benchmark/reference.json").read_bytes()).hexdigest(), "engine": "local-python-no-ai", "samples": []}
    for key, label, url, pages in SAMPLES:
        path = cache_dir / f"{key}.pdf"
        if not path.exists():
            request = urllib.request.Request(url, headers={"User-Agent": "StatementXL-Public-Sample-Report"})
            with urllib.request.urlopen(request, timeout=30) as response:
                path.write_bytes(response.read())
        source = path.read_bytes()
        reader = PdfReader(BytesIO(source))
        writer = PdfWriter()
        for page in pages:
            writer.add_page(reader.pages[page - 1])
        selected = BytesIO()
        writer.write(selected)
        result = parse_statement(selected.getvalue(), f"{key}.pdf")
        rows = [row for table in result.tables for row in table.rows]
        expected = reference["samples"][key]
        # Sequence alignment uses exact date + amount + direction; descriptions are checked separately.
        unmatched = list(enumerate(rows))
        mismatches = []
        missing = 0
        matched = 0
        for index, item in enumerate(expected):
            cells = item["cells"]
            match = next(((j, r) for j, r in unmatched if normalize(r.values.get("c0")) == normalize(cells[0]) and all(normalize(r.values.get(f"c{k}")) == normalize(cells[k]) for k in range(2, len(cells)))), None)
            if match is None:
                missing += 1
                continue
            unmatched.remove(match)
            matched += 1
            j, row = match
            for k, expected_value in enumerate(cells):
                if normalize(row.values.get(f"c{k}")) != normalize(expected_value):
                    mismatches.append({"referenceRow": index + 1, "originalPage": item["originalPage"], "column": k, "expected": expected_value, "actual": row.values.get(f"c{k}")})
        statuses = Counter({"valid": 0, "warning": 0, "failed": 0})
        statuses.update(row.status.value for row in rows)
        issues = Counter(issue.code for row in rows for issue in row.warnings)
        report["samples"].append({"id": key, "name": label, "sourceUrl": url, "sourceSha256": hashlib.sha256(source).hexdigest(), "sourcePageCount": len(reader.pages), "originalPages": pages, "selectedPageCount": len(pages), "referenceTransactions": len(expected), "extractedRows": len(rows), "statuses": {"OK": statuses["valid"], "DISCREPANCY": statuses["warning"], "UNVERIFIABLE": statuses["failed"]}, "matchedDateAmountDirectionRows": matched, "unmatchedReferenceRows": missing, "extraRows": len(unmatched), "fieldMismatches": mismatches, "extraRowDetails": [{"originalPage": pages[row.source.page - 1], "values": list(row.values.values()), "status": row.status.value} for _, row in unmatched], "rowIssues": dict(issues), "failedPages": [{"originalPage": pages[e.page - 1] if e.page else None, "code": e.code} for e in result.errors]})
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    report = run(args.cache_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "samples": [{"id": s["id"], "statuses": s["statuses"], "matched": s["matchedDateAmountDirectionRows"], "extra": s["extraRows"], "fieldMismatches": len(s["fieldMismatches"])} for s in report["samples"]]}))
