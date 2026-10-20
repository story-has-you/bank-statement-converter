# Spreadsheet export safety

Issue: [#34](https://github.com/story-has-you/bank-statement-converter/issues/34).

## Policy

CSV and TSV are intended for spreadsheet viewing. Every header and data cell,
including confirmed merchant names, row warnings, page risks, table warnings and
metadata-only rows, passes through the same export-only policy:

- Look past leading whitespace (`\s`), Unicode control characters (`Cc`) and
  format characters (`Cf`) when detecting a formula prefix. Do not remove them
  from the exported source value.
- Prefix text beginning with `=`, `+`, `-`, `@`, `＝`, `＋`, `－` or `＠` with one
  ASCII apostrophe (`'`). Text already beginning with an apostrophe stays unchanged.
- Leave plain ASCII signed decimal numbers unchanged, including `-10.00`, `+10.00`
  and `-.50`. The entire value must match; no surrounding whitespace, exponent,
  grouping separator, currency symbol or trailing text is allowed by this
  exception. Other signed values receive the text prefix. `(10.00)` stays unchanged.
- Continue quoting fields and doubling embedded double quotes, using UTF-8 BOM,
  comma or tab delimiters and CRLF record separators. Commas, tabs, quotes and
  embedded newlines cannot create extra columns or transactions.
- Do not mutate the conversion result or merchant mappings. JSON preserves all
  original values and source references. XLSX stores formula-shaped values with
  string type `t: 's'` and no formula property `f`.

The download area explains the visible apostrophe and JSON's original values in
all supported UI languages. Compatibility is limited to the verified import
paths below. Other spreadsheet applications should use the XLSX download. Saving
and reopening CSV/TSV can remove protective prefixes and is outside this guarantee.

Sources:

- [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection): quoting
  and formula neutralization are separate concerns; apostrophe escaping and its
  save/reopen limitations. OWASP also documents an Excel-specific tab mitigation;
  this implementation uses apostrophes with the Calc behavior verified below and
  does not claim Excel CSV interoperability has been tested.
- [LibreOffice CSV filter parameters](https://help.libreoffice.org/latest/en-US/text/shared/guide/csv_params.html):
  import delimiters, quoted-field handling and formula evaluation options.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm test:exports
pnpm test:exports:calc
```

The first suite runs in CI. The Calc suite requires `soffice` with Calc installed;
set `SOFFICE` if it has a different path. To keep the generated CSV/TSV, imported
workbooks and the cell-level `acceptance.json` report, set `EXPORT_ACCEPTANCE_DIR`
to an absolute output directory. Otherwise temporary files are removed.

The integration suite uses the real exporter and imports each generated file
through the actual Calc engine. It first proves that the unprotected baseline is
evaluated, then checks the protected cells' displayed/cached values, string types,
absence of formulas, table dimensions, negative amounts and source references.
All formulas are harmless arithmetic; no network or command-execution payloads
are used.

## Verified import scope

Recorded 2026-10-20:

- Software: **LibreOfficeDev 26.8.0.0.alpha0**,
  build `2c87e51eeaa2b413ff4ae097b2705eea1995d8e5`, headless Calc on Linux.
- CSV default opening: `soffice --headless --convert-to xlsx file.csv`, with a
  fresh profile for each import.
- TSV: Text Import with tab as field delimiter and double quote as text
  delimiter, with formula evaluation both OFF and ON. In this build a fresh
  profile's automatic `.tsv` opening chooses comma and produces incorrect
  columns/rows. That path is recorded separately and excluded from supported
  import modes; the download UI tells users which delimiters to select.
- Formula-enabled import: `--infilter="Text - txt - csv (StarCalc):44,34,76,1,,1033,false,false,false,false,false,0,true"`.
  TSV uses `9` instead of `44`. This selects UTF-8, the actual delimiter, double
  quote text delimiters, Standard columns, English (US), quoted-as-text OFF,
  detect-special-numbers OFF, remove-spaces OFF and evaluate-formulas ON.
- Read the resulting workbook's values and cell types; no source-only quoting
  check is used as a substitute for spreadsheet execution.

| Sample                                      | Raw CSV/TSV, formulas enabled | Protected CSV/TSV, supported import modes            |
| ------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Column name `=1+1`                          | Formula; displayed result `2` | Text `'=1+1`, type `s`, no formula                   |
| Description `=1+1`                          | Formula; displayed result `2` | Text `'=1+1`, type `s`, no formula                   |
| Confirmed merchant `=1+1`                   | Formula; displayed result `2` | Text `'=1+1`, type `s`, no formula                   |
| `-10.00`                                    | Numeric `-10`                 | Numeric `-10`; original export bytes remain `-10.00` |
| `(10.00)`                                   | Text                          | Text `(10.00)`                                       |
| Unicode, comma, tab, quotes, multiline text | Single field                  | Single field, same row and source positions          |

Calc displays the added apostrophe literally. It normalizes CR/CRLF to LF and
discards some control characters on import; JSON remains the source of exact
original evidence. XLSX round-trip tests also account for XML newline normalization.
The available binary is a development build; these results do not certify other
LibreOffice releases, Microsoft Excel or Google Sheets.
