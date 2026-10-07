import unittest
from app.convert import parse_statement
from pdf_fixtures import statement_pdf


class SummaryRowsTests(unittest.TestCase):
    def test_total_in_description_is_a_transaction(self):
        result = parse_statement(statement_pdf([[
            ["Date", "Description", "Amount"],
            ["2026-10-01", "Shop A", "10.00"],
            ["2026-10-02", "Total Foods", "20.00"],
            ["2026-10-03", "Shop C", "30.00"],
        ]]), "x.pdf")
        self.assertEqual(result.summary.row_count, 3)
        self.assertEqual(result.summary.status, "success")

    def test_actual_summary_does_not_discard_following_transactions(self):
        result = parse_statement(statement_pdf([[
            ["Date", "Description", "Amount"],
            ["2026-10-01", "Shop A", "10.00"],
            ["Total", "", "10.00"],
            ["2026-10-03", "Shop C", "30.00"],
        ]]), "x.pdf")
        self.assertEqual(result.summary.row_count, 2)
        self.assertEqual(result.summary.status, "partial")
        self.assertEqual(result.tables[0].warnings[0].code, "SUMMARY_ROW")
