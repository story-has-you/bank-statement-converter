import unittest
from unittest.mock import patch
from app import convert
from pdf_fixtures import statement_pdf

TABLE = [["Date", "Description", "Amount"], ["2026-10-01", "Shop A", "10.00"]]


class PageRiskTests(unittest.TestCase):
    def test_unrecognized_transaction_page_is_reported(self):
        result = convert.parse_statement(statement_pdf([TABLE, '2026-10-02 Unrecognized transaction 20.00', TABLE]), 'x.pdf')
        self.assertEqual(result.summary.status, 'partial')
        self.assertEqual([(error.code, error.page) for error in result.errors], [('TABLE_NOT_FOUND', 2)])

    def test_blank_page_can_be_skipped_without_transaction_risk(self):
        result = convert.parse_statement(statement_pdf([TABLE, None, TABLE]), 'x.pdf')
        self.assertEqual(result.page_count, 3)
        self.assertEqual(result.errors, [])

    def test_one_page_text_failure_preserves_other_pages(self):
        original = convert.extract_page_words
        calls = 0
        def extract(page):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise ValueError('Synthetic extraction failure')
            return original(page)
        with patch.object(convert, 'extract_page_words', side_effect=extract):
            result = convert.parse_statement(statement_pdf([TABLE, TABLE, TABLE]), 'x.pdf')
        self.assertEqual(result.summary.row_count, 2)
        self.assertEqual(result.summary.status, 'partial')
        self.assertEqual(result.errors[0].page, 2)
