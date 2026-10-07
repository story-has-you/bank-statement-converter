"""Synthetic statements generated in memory for parser regression tests."""
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors


def statement_pdf(pages):
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(600, 800))
    for rows in pages:
        if isinstance(rows, str):
            pdf.drawString(40, 740, rows)
        elif rows:
            table = Table(rows, colWidths=[125] * len(rows[0]), rowHeights=[28] * len(rows))
            table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
                ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
            ]))
            _, height = table.wrap(520, 720)
            table.drawOn(pdf, 40, 740 - height)
        pdf.showPage()
    pdf.save()
    return output.getvalue()
