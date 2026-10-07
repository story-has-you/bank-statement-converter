import unittest
from app.convert import parse_statement
from pdf_fixtures import statement_pdf


class OriginalPageCountTests(unittest.TestCase):
    def test_two_different_headers_remain_separate(self):
        result = parse_statement(statement_pdf([
            [["Date", "Description", "Amount"], ["2026-10-01", "Shop A", "10.00"]],
            [["Date", "Description", "Debit", "Credit"], ["2026-10-02", "Shop B", "20.00", ""]],
        ]), "statement.pdf")
        self.assertEqual(result.page_count, 2)
        self.assertEqual(len(result.tables), 2)
        self.assertEqual((result.tables[1].page_start, result.tables[1].page_end), (2, 2))

    def test_matching_headers_merge_without_changing_page_count(self):
        result = parse_statement(statement_pdf([
            [["Date", "Description", "Amount"], ["2026-10-01", "Shop A", "10.00"]],
            [["Date", "Description", "Amount"], ["2026-10-02", "Shop B", "20.00"]],
        ]), "statement.pdf")
        self.assertEqual(result.page_count, 2)
        self.assertEqual(len(result.tables), 1)
        self.assertEqual((result.tables[0].page_start, result.tables[0].page_end), (1, 2))
        self.assertEqual([row.source.page for row in result.tables[0].rows], [1, 2])
