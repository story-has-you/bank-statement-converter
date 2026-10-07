import unittest
from app.convert import parse_statement
from app.table_parser import _continuation_column
from pdf_fixtures import statement_pdf


class ContinuationTests(unittest.TestCase):
    def test_description_continuation_does_not_truncate_table(self):
        result = parse_statement(statement_pdf([[
            ["Date", "Description", "Amount"],
            ["2026-10-01", "Shop A", "10.00"],
            ["", "description continues", ""],
            ["2026-10-03", "Shop C", "30.00"],
        ]]), "x.pdf")
        self.assertEqual(result.summary.row_count, 2)
        self.assertEqual(result.tables[0].rows[0].values['c1'], "Shop A description continues")
        self.assertEqual(result.tables[0].rows[1].values['c1'], "Shop C")

    def test_continuation_uses_column_semantics(self):
        self.assertEqual(_continuation_column([None, 'continued', None], ['Date', 'Description', 'Amount']), 1)
        self.assertIsNone(_continuation_column([None, None, '10.00'], ['Date', 'Description', 'Amount']))
