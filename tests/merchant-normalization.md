# Merchant mapping clear safeguards

Issue: [#53](https://github.com/story-has-you/bank-statement-converter/issues/53).

The panel uses a confirmation dialog before clearing the entire file. There is
no undo snapshot or edit history. Cancelling the dialog, including Escape,
does not call the workspace update handler or change the current selection,
search, page, or name input. Initial focus is on **Keep mappings**.

The impact count is the sum of saved mapping entries in every table, including
entries outside the current search/page. The same source text mapped in two
tables counts twice. Affected transactions count only rows with a confirmed
mapping in their own table; an unconfirmed occurrence in another table does
not count. A retained mapping without a matching row counts as one mapping and
zero transactions.

The three actions have different effects:

| Action                   | Selection                             | Saved mappings                              |
| ------------------------ | ------------------------------------- | ------------------------------------------- |
| Clear selection          | Cleared                               | Kept                                        |
| Remove selected mappings | Cleared                               | Selected source names removed               |
| Clear all file mappings  | Kept until confirmation, then cleared | Every table cleared only after confirmation |

## Automated regression checks

```bash
pnpm test:merchants
pnpm test:exports
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

The merchant suite and export suite also run in GitHub Actions. Merchant tests
cover cross-table counts, repeated transactions, aliases beyond the first
page, partially confirmed shared names, retained mappings without rows,
empty mappings, prototype-property source names, and all supported locales.

## Browser acceptance

Recorded on 2026-10-20 with Chromium 141.0.7390.37 against the production
build, using only the synthetic `createMerchantFixture()` in
`tests/fixtures/merchant-normalization.ts`:

1. Put the fixture into session storage under
   `bank-statement-converter:conversion-result` and open `/zh-CN/result`.
   There are two tables, 56 transactions, 54 distinct source names, four saved
   mappings and five affected transactions. The two tables use different
   source columns and include extraction risk flags.
2. Select `Shared`, enter an unapplied name and move to the second alias page.
   The clear dialog reports **4 mappings / 5 transactions**. Opening and
   cancelling do not change session storage, selection or the name input.
   Escape also cancels; focus returns to the trigger.
3. Clear selection and verify every saved mapping remains. Search for a value
   with no matches; the clear dialog still reports **4 / 5**.
4. Search for `Merchant 51` and remove its mapping. Only that mapping is
   deleted. A subsequent whole-file confirmation reports **3 / 4**.
5. At 1440 px desktop and 390 px mobile widths, verify that the entire dialog,
   description and both actions fit the viewport. Confirm clearing while
   filtering to `Other`. Both tables' aliases become empty, their source
   columns remain selected, the selection clears and the trigger is disabled.
6. Compare the stored result before and after clearing. Original transaction
   values, extraction risks and source positions are identical. Reload:
   mappings stay cleared and the dialog is closed.
7. Download real XLSX and JSON files. Read the workbook back and verify both
   logical tables, source text and `DISCREPANCY` flags remain. JSON equals the
   original parse result after clearing. Cleared merchant names are absent
   from the workbook.
8. Reset via **Convert again** and accept leaving. Session storage is cleared.
   Load a new synthetic result: the dialog starts closed and reports its own
   **4 / 5** mappings and transactions. No browser runtime errors occur.

All checks above passed. No production conversion or real statement was used.
