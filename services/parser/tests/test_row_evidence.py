import unittest
from app.convert import parse_statement
from app.pdf_reader import ParserError
from pdf_fixtures import statement_pdf


class TransactionEvidenceTests(unittest.TestCase):
    def test_date_only_document_is_a_hard_failure(self):
        with self.assertRaises(ParserError) as caught:
            parse_statement(statement_pdf([[["Date", "Description", "Amount"], ["2026-10-01", "", ""]]]), "x.pdf")
        self.assertEqual(caught.exception.code, "NO_VERIFIABLE_TRANSACTIONS")

    def test_missing_evidence_and_invalid_date_are_unverifiable(self):
        result = parse_statement(statement_pdf([[
            ["Date", "Description", "Amount"],
            ["2026-10-01", "Shop A", "10.00"],
            ["2026-10-02", "", "20.00"],
            ["2026-10-03", "Shop C", ""],
            ["2026-99-99", "Shop D", "30.00"],
        ]]), "x.pdf")
        self.assertEqual(result.summary.status, "partial")
        self.assertEqual(result.summary.valid_row_count, 1)
        self.assertEqual(result.summary.failed_row_count, 3)
        self.assertEqual([row.warnings[0].code for row in result.tables[0].rows[1:]],
                         ["MISSING_DESCRIPTION", "MISSING_AMOUNT", "MISSING_DATE"])
